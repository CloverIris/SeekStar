import { assertValidTerrainScene, normalizeTerrainScene } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import {
  applyExplorationEvent,
  createPersistableWorkspaceSnapshot,
  createDefaultNewSeekScene,
  createDirectUrlScoutPlan,
  createExplorationObjectPool,
  createFailedScoutObservation,
  createFrontierScoutPlan,
  createPageOutlinksScoutPlan,
  createSeedScene,
  defaultSeekStarSeedScene,
  isDirectHttpUrl,
  DEPRECATED_DEFAULT_TAB_IDS,
  positionAnchoredScoutObservations,
  positionFrontierObservations,
  prepareWorkspaceLaunch,
  resolveFrontierTrigger,
  resolveActiveDomainLexicon,
  type DomainLexicon,
  type FrontierTrigger,
  type PersistenceStatus,
  type ScoutObservationPlacement,
  type SourceIngestionInput,
  type WorkspaceSnapshot,
} from "@seekstar/constellation-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SelectionBasketItem } from "../selection/selectionBasket";

interface UseExplorationSessionOptions {
  initialScene?: TerrainScene;
  runtimeTabId?: string;
}

interface SelectionSyncResult {
  selectedNodeIds: string[];
  focusNodeId?: string;
}

interface SyncWorkspaceFromStoreOptions {
  preferredActiveTabId?: string;
  registerRuntimeTabs?: boolean;
  shouldCancel?: () => boolean;
  protectLocalNavigation?: boolean;
}

export function useExplorationSession(options: UseExplorationSessionOptions = {}) {
  const initialScene = options.initialScene ?? defaultSeekStarSeedScene;
  const initialTabId = initialScene.active_tab_id;
  const runtimeTabId = options.runtimeTabId;

  const [scenesByTabId, setScenesByTabId] = useState<Record<string, TerrainScene>>({
    [initialTabId]: initialScene,
  });
  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [basketByTabId, setBasketByTabId] = useState<Record<string, SelectionBasketItem[]>>({});
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("loading");
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [hydratedSelection, setHydratedSelection] = useState<SelectionSyncResult | undefined>();

  const activeTabIdRef = useRef(activeTabId);
  const scenesByTabIdRef = useRef(scenesByTabId);
  const basketByTabIdRef = useRef(basketByTabId);
  const frontierTimersRef = useRef<Record<string, number>>({});
  const discoveredFrontiersRef = useRef<Set<string>>(new Set());
  const localNavigationRevisionRef = useRef(0);

  const scene = scenesByTabId[activeTabId] ?? initialScene;
  const objectPool = useMemo(() => createExplorationObjectPool(scene), [scene]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    scenesByTabIdRef.current = scenesByTabId;
  }, [scenesByTabId]);

  useEffect(() => {
    basketByTabIdRef.current = basketByTabId;
  }, [basketByTabId]);

  useEffect(
    () => () => {
      Object.values(frontierTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    },
    [],
  );

  const replaceScene = useCallback((tabId: string, nextScene: TerrainScene) => {
    const normalized = assertValidTerrainScene(nextScene, `replaceScene:${tabId}`);
    setScenesByTabId((current) => ({
      ...current,
      [tabId]: normalized,
    }));
  }, []);

  const syncWorkspaceFromStore = useCallback(
    async (syncOptions: SyncWorkspaceFromStoreOptions = {}): Promise<SelectionSyncResult | undefined> => {
      const revisionAtStart = localNavigationRevisionRef.current;

      try {
        const configuredDefaultScene = await loadConfiguredDefaultScene(initialScene);
        const snapshot = await window.seekstar.workspace.loadSnapshot();

        if (syncOptions.shouldCancel?.()) {
          return undefined;
        }

        if (syncOptions.protectLocalNavigation && revisionAtStart !== localNavigationRevisionRef.current) {
          return undefined;
        }

        const launch = prepareWorkspaceLaunch<SelectionBasketItem>({
          fallbackScene: configuredDefaultScene,
          runtimeTabId: syncOptions.preferredActiveTabId ?? runtimeTabId,
          snapshot,
        });

        const nextScene = launch.scenesByTabId[launch.activeTabId] ?? configuredDefaultScene;
        const nextSelection = {
          selectedNodeIds: nextScene.selection.node_ids,
          focusNodeId: nextScene.selection.node_ids[0],
        };

        setActiveTabId(launch.activeTabId);
        setScenesByTabId(launch.scenesByTabId);
        setBasketByTabId(launch.basketByTabId);

        if (syncOptions.registerRuntimeTabs ?? true) {
          await registerRuntimeScenes(launch.scenesByTabId, launch.activeTabId);
          void closeDeprecatedRuntimeTabs();
        }

        setHydratedSelection(nextSelection);
        setPersistenceStatus("saved");

        return nextSelection;
      } catch {
        setPersistenceStatus("error");
        return undefined;
      } finally {
        if (!syncOptions.shouldCancel?.()) {
          setWorkspaceHydrated(true);
        }
      }
    },
    [initialScene, runtimeTabId],
  );

  useEffect(() => {
    let cancelled = false;

    void syncWorkspaceFromStore({
      protectLocalNavigation: true,
      registerRuntimeTabs: true,
      shouldCancel: () => cancelled,
    });

    return () => {
      cancelled = true;
    };
  }, [syncWorkspaceFromStore]);

  useEffect(() => {
    if (!workspaceHydrated) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        setPersistenceStatus("saving");
        void buildPersistableWorkspaceSnapshot({
          activeTabId,
          basketByTabId,
          fallbackScene: initialScene,
          lockedTabId: runtimeTabId,
          scenesByTabId,
        })
          .then((snapshot) => window.seekstar.workspace.saveSnapshot(snapshot satisfies WorkspaceSnapshot<SelectionBasketItem>))
          .then(() => {
            setPersistenceStatus("saved");
          })
          .catch(() => {
            setPersistenceStatus("error");
          });
      } catch {
        setPersistenceStatus("error");
      }
    }, 650);

    setPersistenceStatus("unsaved");

    return () => {
      clearTimeout(timeoutId);
    };
  }, [activeTabId, basketByTabId, runtimeTabId, scenesByTabId, workspaceHydrated]);

  const syncSceneSelection = useCallback(
    (nodeIds: string[], focusNodeId?: string): SelectionSyncResult => {
      const result = applyExplorationEvent(scene, {
        type: "selection.changed",
        nodeIds,
        focusNodeId,
        intent: "inspect",
      });
      replaceScene(activeTabId, result.scene);
      return {
        selectedNodeIds: nodeIds,
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const syncSceneViewport = useCallback(
    (viewport: TerrainScene["viewport"], selectedNodeIds: string[]): string[] => {
      const result = applyExplorationEvent(scene, {
        type: "viewport.changed",
        viewport,
        selectedNodeIds,
      });
      const nextScene = result.scene;
      const nextSelectedNodeIds = nextScene.selection.node_ids;
      replaceScene(activeTabId, nextScene);
      return nextSelectedNodeIds;
    },
    [activeTabId, replaceScene, scene],
  );

  const handleLayerSelect = useCallback(
    (layer: LayerId, focusNodeId?: string): SelectionSyncResult => {
      const result = applyExplorationEvent(scene, {
        type: "layer.changed",
        layer,
        focusNodeId,
      });
      replaceScene(activeTabId, result.scene);
      return {
        selectedNodeIds: result.selectedNodeIds ?? [],
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const openSeedScene = useCallback((nextScene: TerrainScene) => {
    const normalized = assertValidTerrainScene(nextScene, "openSeedScene");
    const nextTabId = normalized.active_tab_id;
    const nextTab = normalized.tabs.find((tab) => tab.id === nextTabId) ?? normalized.tabs[0];
    const nextScenesByTabId = {
      ...scenesByTabIdRef.current,
      [nextTabId]: normalized,
    };
    const shouldAdoptNewSceneLocally = !runtimeTabId || runtimeTabId === nextTabId;

    localNavigationRevisionRef.current += 1;
    scenesByTabIdRef.current = nextScenesByTabId;

    if (shouldAdoptNewSceneLocally) {
      setScenesByTabId(nextScenesByTabId);
      setActiveTabId(nextTabId);
    }

    setPersistenceStatus("saving");
    void buildPersistableWorkspaceSnapshot({
      activeTabId: nextTabId,
      basketByTabId: basketByTabIdRef.current,
      fallbackScene: initialScene,
      scenesByTabId: nextScenesByTabId,
    })
      .then((snapshot) => window.seekstar.workspace.saveSnapshot(snapshot satisfies WorkspaceSnapshot<SelectionBasketItem>))
      .then(() =>
        window.seekstar.tabs.create({
          activate: true,
          tabId: nextTabId,
          title: nextTab?.title ?? normalized.metadata.title,
          seed: nextTab?.seed ?? normalized.metadata.title,
        }),
      )
      .then(() => {
        setPersistenceStatus("saved");
      })
      .catch(() => {
        setPersistenceStatus("error");
      });
  }, [initialScene, runtimeTabId]);

  const handleUseAsSeed = useCallback(
    (seed: string) => {
      if (!seed.trim()) {
        return;
      }

      openSeedScene(createSeedScene(seed.trim()));
    },
    [openSeedScene],
  );

  const handleExploreInCurrentTab = useCallback(
    (seed: string): SelectionSyncResult | undefined => {
      const title = seed.trim();

      if (!title) {
        return undefined;
      }

      const nextScene = assertValidTerrainScene(
        createSeedScene(title, {
          sceneId: scene.id,
          sourceMode: "new_seed",
          tabId: activeTabId,
        }),
        "exploreInCurrentTab",
      );
      const nextTab = nextScene.tabs.find((tab) => tab.id === nextScene.active_tab_id) ?? nextScene.tabs[0];

      localNavigationRevisionRef.current += 1;
      setScenesByTabId((current) => ({
        ...current,
        [activeTabId]: nextScene,
      }));
      setActiveTabId(activeTabId);
      void window.seekstar.tabs.create({
        tabId: activeTabId,
        title: nextTab?.title ?? title,
        seed: nextTab?.seed ?? title,
      });

      return {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [activeTabId, scene.id],
  );

  const handleApplyDomainLexiconToDefaultSeek = useCallback(
    (domainLexicons: readonly DomainLexicon[] | undefined, activeLexiconId?: string): SelectionSyncResult => {
      const domainLexicon = resolveActiveDomainLexicon(domainLexicons, activeLexiconId);
      const nextScene = assertValidTerrainScene(
        createDefaultNewSeekScene({
          domainLexicon,
          timestamp: new Date().toISOString(),
        }),
        "applyDomainLexiconToDefaultSeek",
      );
      const nextTabId = nextScene.active_tab_id;
      const nextTab = nextScene.tabs.find((tab) => tab.id === nextTabId) ?? nextScene.tabs[0];

      localNavigationRevisionRef.current += 1;
      setScenesByTabId((current) => ({
        ...current,
        [nextTabId]: nextScene,
      }));
      setActiveTabId(nextTabId);
      void window.seekstar.tabs.create({
        tabId: nextTabId,
        title: nextTab?.title ?? nextScene.metadata.title,
        seed: nextTab?.seed ?? nextScene.metadata.title,
      });

      return {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [],
  );

  const handleTabSelect = useCallback(
    (tabId: string): SelectionSyncResult | undefined => {
      const nextScene = scenesByTabId[tabId];

      if (!nextScene) {
        return undefined;
      }

      localNavigationRevisionRef.current += 1;
      setActiveTabId(tabId);
      void window.seekstar.tabs.activate(tabId);
      return {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [scenesByTabId],
  );

  const handleResetWorkspace = useCallback(async (): Promise<SelectionSyncResult> => {
    await window.seekstar.workspace.clearSnapshot();
    await window.seekstar.tabs.create({
      tabId: initialTabId,
      title: initialScene.metadata.title,
      seed: initialScene.tabs[0]?.seed ?? initialScene.metadata.title,
    });
    localNavigationRevisionRef.current += 1;
    setScenesByTabId({
      [initialTabId]: initialScene,
    });
    setActiveTabId(initialTabId);
    setBasketByTabId({});
    setHydratedSelection({
      selectedNodeIds: initialScene.selection.node_ids,
      focusNodeId: initialScene.selection.node_ids[0],
    });
    setPersistenceStatus("saved");

    return {
      selectedNodeIds: initialScene.selection.node_ids,
      focusNodeId: initialScene.selection.node_ids[0],
    };
  }, [initialScene, initialTabId]);

  const handleCloseTab = useCallback(
    async (tabId: string): Promise<SelectionSyncResult | undefined> => {
      if (Object.keys(scenesByTabIdRef.current).length <= 1) {
        return undefined;
      }

      const orderedTabIds = Object.keys(scenesByTabIdRef.current);
      const closingIndex = orderedTabIds.indexOf(tabId);
      const nextTabId = activeTabIdRef.current === tabId ? orderedTabIds[Math.max(0, closingIndex - 1)] ?? orderedTabIds.find((id) => id !== tabId) : activeTabIdRef.current;

      if (!nextTabId || nextTabId === tabId) {
        return undefined;
      }

      const nextScene = scenesByTabIdRef.current[nextTabId];

      if (!nextScene) {
        return undefined;
      }

      localNavigationRevisionRef.current += 1;
      setScenesByTabId((current) =>
        Object.fromEntries(Object.entries(current).filter(([candidateTabId]) => candidateTabId !== tabId)),
      );
      setBasketByTabId((current) =>
        Object.fromEntries(Object.entries(current).filter(([candidateTabId]) => candidateTabId !== tabId)),
      );
      setActiveTabId(nextTabId);
      await window.seekstar.tabs.close(tabId);
      await window.seekstar.tabs.activate(nextTabId);

      return {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [],
  );

  const handleReorderTabs = useCallback(async (sourceTabId: string, targetTabId: string): Promise<void> => {
    if (sourceTabId === targetTabId) {
      return;
    }

    setScenesByTabId((current) => {
      const entries = Object.entries(current);
      const sourceIndex = entries.findIndex(([tabId]) => tabId === sourceTabId);
      const targetIndex = entries.findIndex(([tabId]) => tabId === targetTabId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const [source] = entries.splice(sourceIndex, 1);
      entries.splice(targetIndex, 0, source);
      return Object.fromEntries(entries);
    });
    await window.seekstar.tabs.reorder(sourceTabId, targetTabId);
  }, []);

  const handleBacklinkFocus = useCallback(
    (backlink: NonNullable<TerrainScene["tabs"][number]["parent_backlink"]>): SelectionSyncResult | undefined => {
      const originScene = scenesByTabId[backlink.tab_id];
      const originNode = backlink.node_id ? originScene?.nodes.find((node) => node.id === backlink.node_id) : undefined;

      if (!originScene) {
        return undefined;
      }

      const nextViewport = originNode?.position_hint
        ? {
            ...originScene.viewport,
            x: originNode.position_hint.x,
            y: originNode.position_hint.y,
            layer: originNode.layer,
            zoom: Math.max(originScene.viewport.zoom, 1.35),
          }
        : originScene.viewport;

      const nextScene = normalizeTerrainScene({
        ...originScene,
        selection: {
          ...originScene.selection,
          node_ids: originNode ? [originNode.id] : originScene.selection.node_ids,
        },
        viewport: nextViewport,
        tabs: originScene.tabs.map((tab) =>
          tab.id === originScene.active_tab_id
            ? {
                ...tab,
                current_layer: nextViewport.layer,
                viewport: nextViewport,
              }
            : tab,
        ),
      });

      replaceScene(backlink.tab_id, nextScene);
      localNavigationRevisionRef.current += 1;
      setActiveTabId(backlink.tab_id);

      return {
        selectedNodeIds: originNode ? [originNode.id] : originScene.selection.node_ids,
        focusNodeId: originNode?.id,
      };
    },
    [replaceScene, scenesByTabId],
  );

  const handleAddSource = useCallback(
    (input: SourceIngestionInput): SelectionSyncResult => {
      const result = applyExplorationEvent(scene, {
        type: "source.snapshot.ingested",
        input,
      });

      replaceScene(activeTabId, result.scene);

      return {
        selectedNodeIds: result.selectedNodeIds ?? [],
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const handleRunScoutPlan = useCallback(
    async (plan: ScoutPlan, placement?: ScoutObservationPlacement): Promise<ScoutObservation | undefined> => {
      const updatedAt = new Date().toISOString();
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;

      try {
        const runResult = await runScoutPlan(tabId, plan);
        const observations = placement
          ? positionAnchoredScoutObservations(runResult.observations, currentScene, placement)
          : runResult.observations;
        const result = applyExplorationEvent(currentScene, {
          type: "scout.observations.appended",
          observations,
          viewport: placement
            ? {
                ...currentScene.viewport,
                x: placement.anchor.x,
                y: placement.anchor.y,
                layer: placement.layer,
                zoom: Math.max(currentScene.viewport.zoom, 1.2),
              }
            : undefined,
          description: `${currentScene.metadata.title} now includes ${runResult.adapter} Scout observations. Observations are not source-backed terrain.`,
        });

        replaceScene(tabId, result.scene);
        return observations[0];
      } catch (error) {
        const failedObservation = createFailedScoutObservation({
          tabId,
          plan,
          title: `Scout adapter failed: ${plan.title}`,
          failureReason: error instanceof Error ? error.message : "Scout adapter failed before producing observations.",
          timestamp: updatedAt,
        });
        const observations = placement
          ? positionAnchoredScoutObservations([failedObservation], currentScene, placement)
          : [failedObservation];
        const result = applyExplorationEvent(currentScene, {
          type: "scout.observations.appended",
          observations,
          description: `${currentScene.metadata.title} received a failed Scout adapter observation.`,
        });

        replaceScene(tabId, result.scene);
        return observations[0];
      }
    },
    [replaceScene, scene],
  );

  const handleScoutDirectUrl = useCallback(
    async (url: string, targetNodeIds: string[]) => {
      if (!isDirectHttpUrl(url)) {
        return undefined;
      }

      const plan = createDirectUrlScoutPlan(url.trim(), targetNodeIds, new Date().toISOString());
      return handleRunScoutPlan(plan);
    },
    [handleRunScoutPlan],
  );

  const handleScoutSourceLinks = useCallback(
    async (node: TerrainNode, source: SourceRef) => {
      if (!source.url || node.source_state !== "source_backed") {
        return undefined;
      }

      const plan = createPageOutlinksScoutPlan(node.id, source.url, source.title, new Date().toISOString());
      const anchor = node.position_hint ?? { x: scene.viewport.x, y: scene.viewport.y };

      return handleRunScoutPlan(plan, {
        anchor,
        discoveryMode: "page_outlinks",
        frontierId: `source-outlinks-${node.id}-${Date.now()}`,
        layer: node.layer,
        radius: 340,
      });
    },
    [handleRunScoutPlan, scene.viewport.x, scene.viewport.y],
  );

  const runFrontierDiscovery = useCallback(
    async (trigger: FrontierTrigger) => {
      if (discoveredFrontiersRef.current.has(trigger.id)) {
        return;
      }

      discoveredFrontiersRef.current.add(trigger.id);
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId];

      if (!currentScene) {
        return;
      }

      const createdAt = new Date().toISOString();
      const plan = createFrontierScoutPlan(currentScene, trigger, createdAt);

      try {
        const runResult = await runScoutPlan(tabId, plan);
        const positionedObservations = positionFrontierObservations(runResult.observations, currentScene, trigger);
        const result = applyExplorationEvent(currentScene, {
          type: "scout.observations.appended",
          observations: positionedObservations,
          description: `${currentScene.metadata.title} discovered a ${trigger.layer} ${trigger.direction} frontier through Scout observations.`,
        });

        replaceScene(tabId, result.scene);
      } catch (error) {
        const failedObservation = positionFrontierObservations(
          [
            createFailedScoutObservation({
              tabId,
              plan,
              discoveryMode: "frontier_web_search",
              title: `Frontier Scout failed: ${trigger.direction}`,
              failureReason: error instanceof Error ? error.message : "Frontier Scout failed before producing observations.",
              timestamp: createdAt,
              suffix: trigger.id,
            }),
          ],
          currentScene,
          trigger,
        );
        const result = applyExplorationEvent(currentScene, {
          type: "scout.observations.appended",
          observations: failedObservation,
        });
        replaceScene(tabId, result.scene);
      }
    },
    [replaceScene],
  );

  const handleCanvasFrontierDiscovery = useCallback(
    (nextViewport: TerrainScene["viewport"]) => {
      const trigger = resolveFrontierTrigger(scene, nextViewport);

      if (!trigger || discoveredFrontiersRef.current.has(trigger.id)) {
        return;
      }

      const existingTimer = frontierTimersRef.current[trigger.id];

      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      frontierTimersRef.current[trigger.id] = window.setTimeout(() => {
        void runFrontierDiscovery(trigger);
      }, 950);
    },
    [runFrontierDiscovery, scene],
  );

  const handleConvertScoutObservation = useCallback(
    (observation: ScoutObservation, activeTabIdForConversion: string): SelectionSyncResult | undefined => {
      if (observation.status !== "source_candidate" && observation.status !== "observed") {
        return undefined;
      }

      const result = applyExplorationEvent(scene, {
        type: "source.snapshot.ingested",
        input: {
          title: observation.title,
          url: observation.url,
          body: observation.snippet ?? observation.query,
          sourceType: observation.source_type,
          retrievedAt: observation.retrieved_at,
          reliabilityHints: [
            "user-confirmed Scout observation",
            observation.adapter === "playwright"
              ? "observed by Playwright Scout adapter"
              : "non-Playwright Scout observation",
            `Scout status: ${observation.status.replace("_", " ")}`,
          ],
          tags: ["scout-observation"],
          createdFrom: {
            tab_id: activeTabIdForConversion,
            node_id: observation.target_node_ids[0],
            label: `Scout observation: ${observation.title}`,
            excerpt: observation.snippet ?? observation.query,
          },
          observationId: observation.id,
        },
      });

      replaceScene(activeTabId, result.scene);

      return {
        selectedNodeIds: result.selectedNodeIds ?? [],
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const handleUseSelectionAsSeed = useCallback(
    (selectedNodes: TerrainNode[]) => {
      if (selectedNodes.length === 0) {
        return;
      }

      const seedTitle =
        selectedNodes.length === 1 ? selectedNodes[0].title : `${selectedNodes[0].title} + ${selectedNodes.length - 1} nearby`;
      const originNode = selectedNodes[0];

      openSeedScene(
        createSeedScene(seedTitle, {
          sourceMode: "selection",
          parentBacklink: {
            tab_id: activeTabId,
            node_id: originNode.id,
            label: selectedNodes.length === 1 ? `Selection: ${originNode.title}` : `Region: ${seedTitle}`,
            excerpt: selectedNodes.map((node) => node.title).join(", "),
          },
        }),
      );
    },
    [activeTabId, openSeedScene],
  );

  const handleUseNodeAsSeed = useCallback(
    (node: TerrainNode, source?: SourceRef) => {
      const seedTitle = node.title.trim() || source?.title || "Source-backed seed";
      const excerpt = node.quote ?? node.summary ?? source?.snippet;
      const createdFromLabel = node.created_from?.label ?? node.semantic_breadcrumb?.join(" / ");

      openSeedScene(
        createSeedScene(seedTitle, {
          sourceMode: "selection",
          parentBacklink: {
            tab_id: activeTabId,
            node_id: node.id,
            source_id: source?.id ?? node.source_id,
            label: source
              ? `Source: ${source.title}`
              : createdFromLabel
                ? `Deep zoom: ${createdFromLabel}`
                : `Node: ${node.title}`,
            excerpt,
          },
        }),
      );
    },
    [activeTabId, openSeedScene],
  );

  return {
    scene,
    objectPool,
    activeTabId,
    scenesByTabId,
    basketByTabId,
    setBasketByTabId,
    persistenceStatus,
    workspaceHydrated,
    hydratedSelection,
    syncWorkspaceFromStore,
    syncSceneSelection,
    syncSceneViewport,
    handleLayerSelect,
    handleResetWorkspace,
    handleExploreInCurrentTab,
    handleApplyDomainLexiconToDefaultSeek,
    handleUseAsSeed,
    handleTabSelect,
    handleCloseTab,
    handleReorderTabs,
    handleBacklinkFocus,
    handleAddSource,
    handleRunScoutPlan,
    handleScoutDirectUrl,
    handleScoutSourceLinks,
    handleCanvasFrontierDiscovery,
    handleConvertScoutObservation,
    handleUseSelectionAsSeed,
    handleUseNodeAsSeed,
  };
}

async function loadConfiguredDefaultScene(fallbackScene: TerrainScene): Promise<TerrainScene> {
  try {
    const settings = await window.seekstar.settings.load();
    const domainLexicon = resolveActiveDomainLexicon(settings.domain_lexicons, settings.active_domain_lexicon_id);

    return createDefaultNewSeekScene({
      domainLexicon,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return fallbackScene;
  }
}

async function registerRuntimeScenes(scenesByTabId: Record<string, TerrainScene>, activeTabId: string): Promise<void> {
  for (const hydratedScene of Object.values(scenesByTabId)) {
    const hydratedTab = hydratedScene.tabs.find((tab) => tab.id === hydratedScene.active_tab_id) ?? hydratedScene.tabs[0];

    if (hydratedTab) {
      await window.seekstar.tabs.create({
        activate: hydratedTab.id === activeTabId,
        tabId: hydratedTab.id,
        title: hydratedTab.title,
        seed: hydratedTab.seed,
      });
    }
  }

  await window.seekstar.tabs.activate(activeTabId);
}

async function closeDeprecatedRuntimeTabs(): Promise<void> {
  for (const tabId of DEPRECATED_DEFAULT_TAB_IDS) {
    await window.seekstar.tabs.close(tabId).catch(() => undefined);
  }
}

async function buildPersistableWorkspaceSnapshot(input: {
  activeTabId: string;
  scenesByTabId: Record<string, TerrainScene>;
  basketByTabId: WorkspaceSnapshot<SelectionBasketItem>["basket_by_tab_id"];
  fallbackScene: TerrainScene;
  lockedTabId?: string;
}): Promise<WorkspaceSnapshot<SelectionBasketItem>> {
  const latestSnapshot = await window.seekstar.workspace.loadSnapshot().catch(() => undefined);

  return createPersistableWorkspaceSnapshot({
    activeTabId: input.activeTabId,
    basketByTabId: input.basketByTabId,
    fallbackScene: input.fallbackScene,
    latestSnapshot,
    lockedTabId: input.lockedTabId,
    scenesByTabId: input.scenesByTabId,
  });
}

async function runScoutPlan(tabId: string, plan: ScoutPlan): Promise<Awaited<ReturnType<typeof window.seekstar.scout.runPlan>>> {
  return window.seekstar.scout.runPlan(tabId, plan);
}
