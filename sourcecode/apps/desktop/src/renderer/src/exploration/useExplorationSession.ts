import { assertValidTerrainScene, normalizeTerrainScene } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import {
  applyExplorationEvent,
  createDefaultNewSeekScene,
  createExplorationObjectPool,
  createSeedScene,
  defaultSeekStarSeedScene,
  isDirectHttpUrl,
  DEPRECATED_DEFAULT_TAB_IDS,
  resolveFrontierTrigger,
  resolveActiveDomainLexicon,
  ScoutJobCoordinator,
  TabSessionCoordinator,
  WorkspacePersistenceCoordinator,
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
  suppressAutosave?: boolean;
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
  const lastWorkspaceChangeRevisionRef = useRef(0);
  const suppressNextAutosaveRef = useRef(false);

  const workspacePersistence = useMemo(
    () =>
      new WorkspacePersistenceCoordinator<SelectionBasketItem>({
        resolveFallbackScene: () => loadConfiguredDefaultScene(initialScene),
        storage: {
          clearWorkspaceSnapshot: () => window.seekstar.workspace.clearSnapshot(),
          loadWorkspaceSnapshot: async () =>
            (await window.seekstar.workspace.loadSnapshot()) as WorkspaceSnapshot<SelectionBasketItem> | undefined,
          saveWorkspaceSnapshot: (snapshot) => window.seekstar.workspace.saveSnapshot(snapshot),
        },
      }),
    [initialScene],
  );
  const scoutJobs = useMemo(
    () =>
      new ScoutJobCoordinator({
        scout: {
          runPlan: (tabId, plan) => window.seekstar.scout.runPlan(tabId, plan),
        },
      }),
    [],
  );
  const tabSessions = useMemo(
    () =>
      new TabSessionCoordinator<SelectionBasketItem>({
        persistence: workspacePersistence,
        tabRuntime: {
          activateTab: async (tabId) => {
            await window.seekstar.tabs.activate(tabId);
          },
          closeTab: async (tabId) => {
            await window.seekstar.tabs.close(tabId);
          },
          createTab: async (input) => {
            await window.seekstar.tabs.create(input);
          },
          reorderTabs: async (sourceTabId, targetTabId) => {
            await window.seekstar.tabs.reorder(sourceTabId, targetTabId);
          },
        },
      }),
    [workspacePersistence],
  );

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
        const launch = await workspacePersistence.hydrate({
          preferredActiveTabId: syncOptions.preferredActiveTabId,
          runtimeTabId,
        });

        if (syncOptions.shouldCancel?.()) {
          return undefined;
        }

        if (syncOptions.protectLocalNavigation && revisionAtStart !== localNavigationRevisionRef.current) {
          return undefined;
        }

        const nextSelection = {
          selectedNodeIds: launch.selectedNodeIds,
          focusNodeId: launch.focusNodeId,
        };

        if (syncOptions.suppressAutosave) {
          suppressNextAutosaveRef.current = true;
        }

        setActiveTabId(launch.activeTabId);
        setScenesByTabId(launch.scenesByTabId);
        setBasketByTabId(launch.basketByTabId);

        const shouldRegisterRuntimeTabs = !runtimeTabId && (syncOptions.registerRuntimeTabs ?? true);

        if (shouldRegisterRuntimeTabs) {
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
    [runtimeTabId, workspacePersistence],
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
    return window.seekstar.workspace.onChanged((event) => {
      if (event.revision <= lastWorkspaceChangeRevisionRef.current) {
        return;
      }

      lastWorkspaceChangeRevisionRef.current = event.revision;
      void syncWorkspaceFromStore({
        preferredActiveTabId: runtimeTabId ? activeTabIdRef.current : undefined,
        protectLocalNavigation: true,
        registerRuntimeTabs: true,
        suppressAutosave: true,
      });
    });
  }, [syncWorkspaceFromStore]);

  useEffect(() => {
    if (!workspaceHydrated) {
      return undefined;
    }

    if (suppressNextAutosaveRef.current) {
      suppressNextAutosaveRef.current = false;
      setPersistenceStatus("saved");
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        setPersistenceStatus("saving");
        void workspacePersistence
          .persist({
            activeTabId,
            basketByTabId,
            fallbackScene: initialScene,
            lockedTabId: runtimeTabId,
            scenesByTabId,
          })
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
  }, [activeTabId, basketByTabId, initialScene, runtimeTabId, scenesByTabId, workspaceHydrated, workspacePersistence]);

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

  const openSeedScene = useCallback((nextScene: TerrainScene): Promise<TerrainScene> => {
    const transaction = tabSessions.prepareOpenScene({
      basketByTabId: basketByTabIdRef.current,
      nextScene,
      runtimeTabId,
      scenesByTabId: scenesByTabIdRef.current,
    });

    localNavigationRevisionRef.current += 1;
    scenesByTabIdRef.current = transaction.scenesByTabId;

    if (transaction.shouldAdoptLocally) {
      activeTabIdRef.current = transaction.activeTabId;
      setScenesByTabId(transaction.scenesByTabId);
      setActiveTabId(transaction.activeTabId);
    }

    setPersistenceStatus("saving");
    const savePromise = tabSessions
      .commitOpenScene({
        fallbackScene: initialScene,
        transaction,
      })
      .then(() => {
        setPersistenceStatus("saved");
        return transaction.scene;
      })
      .catch(() => {
        setPersistenceStatus("error");
        return transaction.scene;
      });

    void savePromise;
    return savePromise;
  }, [initialScene, runtimeTabId, tabSessions]);

  const handleUseAsSeed = useCallback(
    (seed: string) => {
      if (!seed.trim()) {
        return;
      }

      openSeedScene(createSeedScene(seed.trim()));
    },
    [openSeedScene],
  );

  const ingestHyperlinkSourceIntoScene = useCallback(
    async (
      openedScene: TerrainScene,
      url: string,
      parentBacklink: NonNullable<TerrainScene["tabs"][number]["parent_backlink"]>,
    ): Promise<void> => {
      const tabId = openedScene.active_tab_id;

      setPersistenceStatus("saving");

      try {
        const latestScene = scenesByTabIdRef.current[tabId] ?? openedScene;
        const { scene: nextScene } = await scoutJobs.ingestHyperlinkSource({
          parentBacklink,
          scene: latestScene,
          tabId,
          url,
        });
        const nextScenesByTabId = {
          ...scenesByTabIdRef.current,
          [tabId]: nextScene,
        };

        scenesByTabIdRef.current = nextScenesByTabId;
        setScenesByTabId(nextScenesByTabId);

        await workspacePersistence.persist({
          activeTabId: tabId,
          basketByTabId: basketByTabIdRef.current,
          fallbackScene: initialScene,
          scenesByTabId: nextScenesByTabId,
        });

        setPersistenceStatus("saved");
      } catch {
        setPersistenceStatus("error");
      }
    },
    [initialScene, scoutJobs, workspacePersistence],
  );

  const handleUseHyperlinkAsSeed = useCallback(
    (input: { originNodeId?: string; originSourceId?: string; originTitle?: string; title?: string; url: string }) => {
      const url = input.url.trim();

      if (!url) {
        return;
      }

      const parentBacklink = {
        tab_id: activeTabId,
        node_id: input.originNodeId,
        source_id: input.originSourceId,
        label: input.originTitle ? `Hyperlink from ${input.originTitle}` : "Hyperlink",
        excerpt: url,
      };

      void openSeedScene(
        createSeedScene(input.title?.trim() || url, {
          sourceMode: "hyperlink",
          parentBacklink,
        }),
      ).then((openedScene) => ingestHyperlinkSourceIntoScene(openedScene, url, parentBacklink));
    },
    [activeTabId, ingestHyperlinkSourceIntoScene, openSeedScene],
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
      void tabSessions.activateTab(tabId);
      return {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [scenesByTabId, tabSessions],
  );

  const handleResetWorkspace = useCallback(async (): Promise<SelectionSyncResult> => {
    await workspacePersistence.clear();
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
  }, [initialScene, initialTabId, workspacePersistence]);

  const handleCloseTab = useCallback(
    async (tabId: string): Promise<SelectionSyncResult | undefined> => {
      const transaction = tabSessions.prepareCloseTab({
        activeTabId: activeTabIdRef.current,
        basketByTabId: basketByTabIdRef.current,
        scenesByTabId: scenesByTabIdRef.current,
        tabId,
      });

      if (!transaction) {
        return undefined;
      }

      localNavigationRevisionRef.current += 1;
      activeTabIdRef.current = transaction.activeTabId;
      scenesByTabIdRef.current = transaction.scenesByTabId;
      basketByTabIdRef.current = transaction.basketByTabId;
      setScenesByTabId(transaction.scenesByTabId);
      setBasketByTabId(transaction.basketByTabId);
      setActiveTabId(transaction.activeTabId);
      setPersistenceStatus("saving");

      await tabSessions.commitCloseTab({
        fallbackScene: initialScene,
        transaction,
      });
      setPersistenceStatus("saved");

      return {
        selectedNodeIds: transaction.selectedNodeIds,
        focusNodeId: transaction.focusNodeId,
      };
    },
    [initialScene, tabSessions],
  );

  const handleReorderTabs = useCallback(async (sourceTabId: string, targetTabId: string): Promise<void> => {
    const transaction = tabSessions.prepareReorderTabs({
      scenesByTabId: scenesByTabIdRef.current,
      sourceTabId,
      targetTabId,
    });

    if (!transaction) {
      return;
    }

    scenesByTabIdRef.current = transaction.scenesByTabId;
    setScenesByTabId(transaction.scenesByTabId);
    await tabSessions.commitReorderTabs(transaction);
  }, [tabSessions]);

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

  const handleTileFocus = useCallback(
    (nodeId: string): SelectionSyncResult => {
      const result = applyExplorationEvent(scene, {
        type: "tile.focused",
        nodeId,
      });
      replaceScene(activeTabId, result.scene);

      return {
        selectedNodeIds: result.selectedNodeIds ?? result.scene.selection.node_ids,
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const handleTileAbsorptionEnter = useCallback(
    (nodeId: string, trigger: "threshold" | "click" | "command" = "click"): SelectionSyncResult => {
      const result = applyExplorationEvent(scene, {
        type: "tile.absorption.entered",
        nodeId,
        trigger,
      });
      replaceScene(activeTabId, result.scene);

      return {
        selectedNodeIds: result.selectedNodeIds ?? result.scene.selection.node_ids,
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene],
  );

  const handleTileAbsorptionExit = useCallback((): SelectionSyncResult => {
    const result = applyExplorationEvent(scene, {
      type: "tile.absorption.exited",
    });
    replaceScene(activeTabId, result.scene);

    return {
      selectedNodeIds: result.selectedNodeIds ?? result.scene.selection.node_ids,
      focusNodeId: result.focusNodeId,
    };
  }, [activeTabId, replaceScene, scene]);

  const handleRunScoutPlan = useCallback(
    async (plan: ScoutPlan, placement?: ScoutObservationPlacement): Promise<ScoutObservation | undefined> => {
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const result = await scoutJobs.runPlan({
        plan,
        placement,
        scene: currentScene,
        tabId,
      });

      replaceScene(tabId, result.scene);
      return result.observation;
    },
    [replaceScene, scene, scoutJobs],
  );

  const handleScoutDirectUrl = useCallback(
    async (url: string, targetNodeIds: string[]) => {
      if (!isDirectHttpUrl(url)) {
        return undefined;
      }

      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const result = await scoutJobs.runDirectUrl({
        scene: currentScene,
        tabId,
        targetNodeIds,
        url,
      });

      replaceScene(tabId, result.scene);
      return result.observation;
    },
    [replaceScene, scene, scoutJobs],
  );

  const handleScoutSourceLinks = useCallback(
    async (node: TerrainNode, source: SourceRef) => {
      if (!source.url || node.source_state !== "source_backed") {
        return undefined;
      }

      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const result = await scoutJobs.runSourceOutlinks({
        node,
        scene: currentScene,
        source,
        tabId,
      });

      if (!result) {
        return undefined;
      }

      replaceScene(tabId, result.scene);
      return result.observation;
    },
    [replaceScene, scene, scoutJobs],
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

      const result = await scoutJobs.runFrontier({
        scene: currentScene,
        tabId,
        trigger,
      });

      replaceScene(tabId, result.scene);
    },
    [replaceScene, scoutJobs],
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
      const result = scoutJobs.convertObservationToSource({
        activeTabIdForConversion,
        observation,
        scene,
      });

      if (!result) {
        return undefined;
      }

      replaceScene(activeTabId, result.scene);
      return {
        selectedNodeIds: result.selectedNodeIds ?? [],
        focusNodeId: result.focusNodeId,
      };
    },
    [activeTabId, replaceScene, scene, scoutJobs],
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
    handleTileFocus,
    handleTileAbsorptionEnter,
    handleTileAbsorptionExit,
    handleResetWorkspace,
    handleExploreInCurrentTab,
    handleApplyDomainLexiconToDefaultSeek,
    handleUseAsSeed,
    handleUseHyperlinkAsSeed,
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
