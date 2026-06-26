import { assertValidTerrainScene, normalizeTerrainScene } from "@seekstar/core-schema";
import type { LayerId, ScoutObservation, ScoutPlan, SourceRef, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import {
  applyExplorationEvent,
  createDirectUrlScoutPlan,
  createDefaultNewSeekScene,
  createExplorationObjectPool,
  createFailedScoutObservation,
  createSeedScene,
  defaultSeekStarSeedScene,
  isDirectHttpUrl,
  resolveFrontierTrigger,
  resolveZoomForLayer,
  resolveActiveDomainLexicon,
  ScoutJobCoordinator,
  TabSessionCoordinator,
  type DirectUrlSourceIntakeResult,
  type CartographerLevelBandId,
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
import {
  compareCartographerChunkRecords,
  createCartographerChunkKeyForViewport,
  createCartographerRuntimeRecordKey,
  createQueuedCartographerChunkRecord,
  mergeCartographerChunkRecords,
  type CartographerChunkRuntimeRecord,
  type CartographerRuntimeStatus,
} from "./cartographerRuntimeClient";

interface UseExplorationSessionOptions {
  initialScene?: TerrainScene;
  runtimeTabId?: string;
}

interface SelectionSyncResult {
  scene?: TerrainScene;
  selectedNodeIds: string[];
  focusNodeId?: string;
}

interface SeedTabCreationResult extends SelectionSyncResult {
  createdTabId: string;
  originTabId: string;
}

interface SyncWorkspaceFromStoreOptions {
  preferredActiveTabId?: string;
  registerRuntimeTabs?: boolean;
  shouldCancel?: () => boolean;
  protectLocalNavigation?: boolean;
  suppressAutosave?: boolean;
}

const DIRECT_URL_SOURCE_INTAKE_TIMEOUT_MS = 52_000;
const STALE_DIRECT_URL_PENDING_MS = 90_000;

export interface CartographerChunkSchedulingPolicy {
  auto_expand_enabled: boolean;
  auto_preload_ring: number;
  boundary_debounce_ms: number;
  chunk_height: number;
  chunk_width: number;
  manual_preload_range: number;
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
  const [cartographerStatus, setCartographerStatus] = useState<CartographerRuntimeStatus>({
    message: "Cartographer ready",
    phase: "idle",
    updatedAt: new Date().toISOString(),
  });
  const [cartographerChunksByTabId, setCartographerChunksByTabId] = useState<Record<string, Record<string, CartographerChunkRuntimeRecord>>>({});

  const activeTabIdRef = useRef(activeTabId);
  const scenesByTabIdRef = useRef(scenesByTabId);
  const basketByTabIdRef = useRef(basketByTabId);
  const frontierTimersRef = useRef<Record<string, number>>({});
  const discoveredFrontiersRef = useRef<Set<string>>(new Set());
  const localNavigationRevisionRef = useRef(0);
  const lastPersistedLocalNavigationRevisionRef = useRef(0);
  const lastWorkspaceChangeRevisionRef = useRef(0);
  const suppressNextAutosaveRef = useRef(false);
  const cartographerBootstrapRef = useRef<Set<string>>(new Set());
  const cartographerChunkRecords = useMemo(
    () => Object.values(cartographerChunksByTabId[activeTabId] ?? {}).sort(compareCartographerChunkRecords),
    [activeTabId, cartographerChunksByTabId],
  );

  const recordCartographerChunk = useCallback((tabId: string, record: CartographerChunkRuntimeRecord): void => {
    setCartographerChunksByTabId((current) => {
      const tabRecords = current[tabId] ?? {};

      return {
        ...current,
        [tabId]: {
          ...tabRecords,
          [createCartographerRuntimeRecordKey(record)]: record,
        },
      };
    });
  }, []);
  const applyCartographerChunkSnapshot = useCallback((snapshot: { records: CartographerChunkRuntimeRecord[]; tab_id: string }): void => {
    setCartographerChunksByTabId((current) => ({
      ...current,
      [snapshot.tab_id]: mergeCartographerChunkRecords(current[snapshot.tab_id] ?? {}, snapshot.records),
    }));
  }, []);

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

  useEffect(() => {
    if (!workspaceHydrated) {
      return undefined;
    }

    return window.seekstar.cartographer.subscribeChunkRecords(activeTabId, (snapshot) => {
      applyCartographerChunkSnapshot(snapshot);
    });
  }, [activeTabId, applyCartographerChunkSnapshot, workspaceHydrated]);

  const replaceScene = useCallback((tabId: string, nextScene: TerrainScene): Record<string, TerrainScene> => {
    const normalized = assertValidTerrainScene(nextScene, `replaceScene:${tabId}`);
    const nextScenesByTabId = {
      ...scenesByTabIdRef.current,
      [tabId]: normalized,
    };

    localNavigationRevisionRef.current += 1;
    scenesByTabIdRef.current = nextScenesByTabId;
    setScenesByTabId(nextScenesByTabId);
    return nextScenesByTabId;
  }, []);

  const syncWorkspaceFromStore = useCallback(
    async (syncOptions: SyncWorkspaceFromStoreOptions = {}): Promise<SelectionSyncResult | undefined> => {
      const revisionAtStart = localNavigationRevisionRef.current;

      try {
        if (syncOptions.protectLocalNavigation && revisionAtStart !== lastPersistedLocalNavigationRevisionRef.current) {
          return undefined;
        }

        const launch = await workspacePersistence.hydrate({
          preferredActiveTabId: syncOptions.preferredActiveTabId,
          runtimeTabId,
        });
        const settledLaunch = settleStaleDirectUrlPendingScenes(launch.scenesByTabId);
        const launchScenesByTabId = settledLaunch.scenesByTabId;

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

        activeTabIdRef.current = launch.activeTabId;
        scenesByTabIdRef.current = launchScenesByTabId;
        basketByTabIdRef.current = launch.basketByTabId;
        setActiveTabId(launch.activeTabId);
        setScenesByTabId(launchScenesByTabId);
        setBasketByTabId(launch.basketByTabId);

        const shouldRegisterRuntimeTabs = !runtimeTabId && (syncOptions.registerRuntimeTabs ?? true);

        if (shouldRegisterRuntimeTabs) {
          await registerRuntimeScenes(launchScenesByTabId, launch.activeTabId);
        }

        if (settledLaunch.changed) {
          suppressNextAutosaveRef.current = true;
          void workspacePersistence
            .persist({
              activeTabId: launch.activeTabId,
              basketByTabId: launch.basketByTabId,
              fallbackScene: launch.fallbackScene,
              scenesByTabId: launchScenesByTabId,
            })
            .catch(() => undefined);
        }

        setHydratedSelection(nextSelection);
        lastPersistedLocalNavigationRevisionRef.current = localNavigationRevisionRef.current;
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
        const revisionAtSaveStart = localNavigationRevisionRef.current;

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
            if (localNavigationRevisionRef.current === revisionAtSaveStart) {
              lastPersistedLocalNavigationRevisionRef.current = revisionAtSaveStart;
            }
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

  const persistWorkspaceAfterSceneChange = useCallback(
    async (tabId: string, scenesOverride?: Record<string, TerrainScene>): Promise<void> => {
      await workspacePersistence.persist({
        activeTabId: tabId,
        basketByTabId: basketByTabIdRef.current,
        fallbackScene: initialScene,
        scenesByTabId: scenesOverride ?? scenesByTabIdRef.current,
        targetLockedTabId: tabId,
      });
    },
    [initialScene, workspacePersistence],
  );

  const bootstrapCartographerTerrain = useCallback(
    async (input: {
      forceRefresh?: boolean;
      scene: TerrainScene;
      seed: string;
      tabId: string;
    }): Promise<SelectionSyncResult | undefined> => {
      const seed = input.seed.trim() || input.scene.metadata.title;

      if (!seed) {
        return undefined;
      }

      const bootstrapKey = `${input.tabId}:${seed.toLowerCase()}:p6-bootstrap`;

      if (!input.forceRefresh && cartographerBootstrapRef.current.has(bootstrapKey)) {
        return undefined;
      }

      cartographerBootstrapRef.current.add(bootstrapKey);
      setPersistenceStatus("saving");

      try {
        const latestScene = scenesByTabIdRef.current[input.tabId] ?? input.scene;
        const result = await window.seekstar.cartographer.runBootstrapTransaction({
          forceRefresh: input.forceRefresh,
          scene: latestScene,
          seed,
          tabId: input.tabId,
        });

        if (!scenesByTabIdRef.current[input.tabId]) {
          return undefined;
        }

        applyCartographerChunkSnapshot(result.snapshot);
        const nextScene = result.scene;
        const nextScenesByTabId = replaceScene(input.tabId, nextScene);
        await persistWorkspaceAfterSceneChange(input.tabId, nextScenesByTabId);
        setCartographerStatus(result.status);
        setPersistenceStatus("saved");

        return {
          selectedNodeIds: nextScene.selection.node_ids,
          focusNodeId: nextScene.runtime.focused_node_id ?? nextScene.selection.node_ids[0],
        };
      } catch {
        setCartographerStatus({
          message: `Cartographer bootstrap failed for ${seed}`,
          phase: "error",
          updatedAt: new Date().toISOString(),
        });
        setPersistenceStatus("error");
        return undefined;
      }
    },
    [applyCartographerChunkSnapshot, persistWorkspaceAfterSceneChange, replaceScene],
  );

  const ingestDirectUrlSourceIntoScene = useCallback(
    async (input: {
      createdFrom?: NonNullable<TerrainScene["tabs"][number]["parent_backlink"]>;
      reliabilityHints?: string[];
      scene: TerrainScene;
      tabId: string;
      tags?: string[];
      targetNodeIds?: string[];
      title?: string;
      url: string;
    }): Promise<SelectionSyncResult | undefined> => {
      const url = input.url.trim();

      if (!isDirectHttpUrl(url)) {
        return undefined;
      }

      setPersistenceStatus("saving");

      let pendingScene: TerrainScene | undefined;

      try {
        const pendingObservation = createPendingDirectUrlObservation({
          createdAt: new Date().toISOString(),
          tabId: input.tabId,
          targetNodeIds: input.targetNodeIds ?? [],
          url,
        });
        const pendingResult = applyExplorationEvent(input.scene, {
          type: "scout.observations.appended",
          observations: [pendingObservation],
          viewport: {
            ...input.scene.viewport,
            layer: "L3",
            zoom: Math.max(input.scene.viewport.zoom, resolveZoomForLayer("L3")),
          },
          description: `${input.scene.metadata.title} is observing ${url} through Scout.`,
        });
        pendingScene = pendingResult.scene;
        const pendingScenesByTabId = replaceScene(input.tabId, pendingScene);
        await persistWorkspaceAfterSceneChange(input.tabId, pendingScenesByTabId);

        const result = await withTimeout(
          scoutJobs.ingestDirectUrlSource({
            createdFrom: input.createdFrom,
            pendingObservationId: pendingObservation.id,
            reliabilityHints: input.reliabilityHints,
            scene: pendingScene,
            tabId: input.tabId,
            tags: input.tags,
            targetNodeIds: input.targetNodeIds,
            title: input.title,
            url,
          }),
          DIRECT_URL_SOURCE_INTAKE_TIMEOUT_MS,
          () =>
            createDirectUrlIntakeFailureResult({
              pendingObservationId: pendingObservation.id,
              scene: pendingResult.scene,
              tabId: input.tabId,
              targetNodeIds: input.targetNodeIds ?? [],
              url,
              reason: `Playwright Scout did not return within ${Math.round(DIRECT_URL_SOURCE_INTAKE_TIMEOUT_MS / 1000)} seconds.`,
            }),
        );

        if (!scenesByTabIdRef.current[input.tabId]) {
          return undefined;
        }

        const resultScenesByTabId = replaceScene(input.tabId, result.scene);
        await persistWorkspaceAfterSceneChange(input.tabId, resultScenesByTabId);
        setPersistenceStatus("saved");

        return {
          selectedNodeIds: result.scene.selection.node_ids,
          focusNodeId: result.scene.runtime.focused_node_id ?? result.scene.selection.node_ids[0],
          scene: result.scene,
        };
      } catch (error) {
        const sourceScene = pendingScene ?? input.scene;

        if (scenesByTabIdRef.current[input.tabId]) {
          const failedResult = createDirectUrlIntakeFailureResult({
            pendingObservationId: sourceScene.scout_observations?.find((observation) => observation.status === "pending")?.id,
            scene: sourceScene,
            tabId: input.tabId,
            targetNodeIds: input.targetNodeIds ?? [],
            url,
            reason: getErrorMessage(error, "Direct URL source intake failed before Scout returned."),
          });
          const failedScenesByTabId = replaceScene(input.tabId, failedResult.scene);
          await persistWorkspaceAfterSceneChange(input.tabId, failedScenesByTabId).catch(() => undefined);
        }

        setPersistenceStatus("saved");
        return undefined;
      }
    },
    [persistWorkspaceAfterSceneChange, replaceScene, scoutJobs],
  );

  const handleIngestDirectUrlIntoCurrentTab = useCallback(
    async (url: string): Promise<SelectionSyncResult | undefined> => {
      const normalizedUrl = url.trim();

      if (!isDirectHttpUrl(normalizedUrl)) {
        return undefined;
      }

      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const selectedNodeId = currentScene.selection.node_ids[0];

      return ingestDirectUrlSourceIntoScene({
        createdFrom: {
          tab_id: tabId,
          node_id: selectedNodeId,
          label: `Direct URL command in ${currentScene.metadata.title}`,
          excerpt: normalizedUrl,
        },
        scene: currentScene,
        tabId,
        tags: ["scout-observation", "direct-url", "source-backed-command", "current-seek"],
        targetNodeIds: currentScene.selection.node_ids,
        url: normalizedUrl,
      });
    },
    [ingestDirectUrlSourceIntoScene, scene],
  );

  const handleOpenDirectUrlAsSeek = useCallback(
    async (url: string): Promise<SelectionSyncResult | undefined> => {
      const normalizedUrl = url.trim();

      if (!isDirectHttpUrl(normalizedUrl)) {
        return undefined;
      }

      const originTabId = activeTabIdRef.current;
      const originScene = scenesByTabIdRef.current[originTabId] ?? scene;
      const originNodeId = originScene.selection.node_ids[0];
      const parentBacklink = {
        tab_id: originTabId,
        node_id: originNodeId,
        label: `Direct URL from ${originScene.metadata.title}`,
        excerpt: normalizedUrl,
      };
      const openedScene = await openSeedScene(
        createSeedScene(normalizedUrl, {
          sourceMode: "new_seed",
          parentBacklink,
        }),
      );
      const tabId = openedScene.active_tab_id;
      const latestScene = scenesByTabIdRef.current[tabId] ?? openedScene;

      return ingestDirectUrlSourceIntoScene({
        createdFrom: parentBacklink,
        scene: latestScene,
        tabId,
        tags: ["scout-observation", "direct-url", "source-backed-command", "source-backed-tab"],
        title: normalizedUrl,
        url: normalizedUrl,
      });
    },
    [ingestDirectUrlSourceIntoScene, openSeedScene, scene],
  );

  const handleObserveCandidateIntoCurrentTab = useCallback(
    async (observationId: string): Promise<SelectionSyncResult | undefined> => {
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const observation = currentScene.scout_observations?.find((candidate) => candidate.id === observationId);
      const url = observation?.url?.trim();

      if (!observation || !url || !isDirectHttpUrl(url)) {
        return undefined;
      }

      return ingestDirectUrlSourceIntoScene({
        createdFrom: {
          tab_id: tabId,
          node_id: observation.target_node_ids[0] ?? currentScene.selection.node_ids[0],
          label: `Candidate source: ${observation.title}`,
          excerpt: observation.snippet ?? observation.query,
        },
        reliabilityHints: [
          "observed from user-selected source candidate",
          observation.provider_id ? `candidate provider: ${observation.provider_id}` : "candidate provider unavailable",
        ],
        scene: currentScene,
        tabId,
        tags: ["scout-observation", "candidate-observed", "source-backed-command"],
        targetNodeIds: observation.target_node_ids,
        title: observation.title,
        url,
      });
    },
    [ingestDirectUrlSourceIntoScene, scene],
  );

  const handleOpenCandidateAsSeek = useCallback(
    async (observationId: string): Promise<SelectionSyncResult | undefined> => {
      const originTabId = activeTabIdRef.current;
      const originScene = scenesByTabIdRef.current[originTabId] ?? scene;
      const observation = originScene.scout_observations?.find((candidate) => candidate.id === observationId);
      const url = observation?.url?.trim();

      if (!observation || !url || !isDirectHttpUrl(url)) {
        return undefined;
      }

      const parentBacklink = {
        tab_id: originTabId,
        node_id: observation.target_node_ids[0] ?? originScene.selection.node_ids[0],
        label: `Candidate source from ${originScene.metadata.title}`,
        excerpt: observation.snippet ?? observation.query,
      };
      const openedScene = await openSeedScene(
        createSeedScene(observation.title || url, {
          sourceMode: "new_seed",
          parentBacklink,
        }),
      );
      const tabId = openedScene.active_tab_id;
      const latestScene = scenesByTabIdRef.current[tabId] ?? openedScene;

      return ingestDirectUrlSourceIntoScene({
        createdFrom: parentBacklink,
        reliabilityHints: [
          "opened from source candidate as new Seek",
          observation.provider_id ? `candidate provider: ${observation.provider_id}` : "candidate provider unavailable",
        ],
        scene: latestScene,
        tabId,
        tags: ["scout-observation", "candidate-new-seek", "source-backed-tab"],
        title: observation.title || url,
        url,
      });
    },
    [ingestDirectUrlSourceIntoScene, openSeedScene, scene],
  );

  const handleUseAsSeed = useCallback(
    async (seed: string): Promise<SeedTabCreationResult | undefined> => {
      const query = seed.trim();

      if (!query) {
        return undefined;
      }

      const originTabId = activeTabIdRef.current;
      const openedScene = await openSeedScene(createSeedScene(query));
      const tabId = openedScene.active_tab_id;
      const latestScene = scenesByTabIdRef.current[tabId] ?? openedScene;
      const fallbackSelection = {
        focusNodeId: latestScene.runtime.focused_node_id ?? latestScene.selection.node_ids[0],
        selectedNodeIds: latestScene.selection.node_ids,
      };
      const result = await bootstrapCartographerTerrain({
        scene: latestScene,
        seed: query,
        tabId,
      }) ?? fallbackSelection;

      return {
        ...result,
        createdTabId: tabId,
        originTabId,
      };
    },
    [bootstrapCartographerTerrain, openSeedScene],
  );

  const handleExploreInCurrentTab = useCallback(
    async (seed: string): Promise<SelectionSyncResult | undefined> => {
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

      const searchResult = await bootstrapCartographerTerrain({
        scene: nextScene,
        seed: title,
        tabId: activeTabId,
      });

      return searchResult ?? {
        selectedNodeIds: nextScene.selection.node_ids,
        focusNodeId: nextScene.selection.node_ids[0],
      };
    },
    [activeTabId, bootstrapCartographerTerrain, scene.id],
  );

  useEffect(() => {
    if (!workspaceHydrated) {
      return;
    }

    const currentScene = scenesByTabId[activeTabId];

    if (!currentScene || !shouldBootstrapCartographerTerrain(currentScene)) {
      return;
    }

    const activeTab = currentScene.tabs.find((tab) => tab.id === currentScene.active_tab_id) ?? currentScene.tabs[0];
    const query = (activeTab?.seed || currentScene.metadata.title).trim();
    const bootstrapKey = `${activeTabId}:${query.toLowerCase()}:p6-bootstrap`;

    if (cartographerBootstrapRef.current.has(bootstrapKey)) {
      return;
    }

    void bootstrapCartographerTerrain({
      scene: currentScene,
      seed: query,
      tabId: activeTabId,
    });
  }, [activeTabId, bootstrapCartographerTerrain, scenesByTabId, workspaceHydrated]);

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
      setCartographerChunksByTabId((current) => {
        const next = { ...current };
        delete next[tabId];
        return next;
      });
      setPersistenceStatus("saving");

      await tabSessions.commitCloseTab({
        fallbackScene: initialScene,
        transaction,
      });
      await window.seekstar.cartographer.clearChunkRecords(tabId).catch(() => undefined);
      setPersistenceStatus("saved");

      return {
        selectedNodeIds: transaction.selectedNodeIds,
        focusNodeId: transaction.focusNodeId,
      };
    },
    [initialScene, tabSessions],
  );

  const handleRestoreSceneSnapshot = useCallback(
    async (tabId: string, snapshot: TerrainScene): Promise<SelectionSyncResult | undefined> => {
      if (!scenesByTabIdRef.current[tabId]) {
        return undefined;
      }

      const normalized = assertValidTerrainScene(snapshot, `restoreSceneSnapshot:${tabId}`);
      const nextScenesByTabId = replaceScene(tabId, normalized);

      localNavigationRevisionRef.current += 1;
      activeTabIdRef.current = tabId;
      setActiveTabId(tabId);
      setPersistenceStatus("saving");
      await persistWorkspaceAfterSceneChange(tabId, nextScenesByTabId);
      await tabSessions.activateTab(tabId);
      setPersistenceStatus("saved");

      return {
        focusNodeId: normalized.runtime.focused_node_id ?? normalized.selection.node_ids[0],
        selectedNodeIds: normalized.selection.node_ids,
      };
    },
    [persistWorkspaceAfterSceneChange, replaceScene, tabSessions],
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

  const expandCartographerChunk = useCallback(
    async (input: {
      forceRefresh?: boolean;
      ignoreDedupe?: boolean;
      scene: TerrainScene;
      tabId: string;
      viewport: TerrainScene["viewport"];
    }): Promise<void> => {
      if (!isCartographerExpandableLayer(input.viewport.layer)) {
        return;
      }

      const chunk = createCartographerChunkKeyForViewport(input.viewport);
      const expansionKey = `${input.tabId}:${input.viewport.layer}:${chunk.key}`;

      if (!input.forceRefresh && !input.ignoreDedupe && discoveredFrontiersRef.current.has(expansionKey)) {
        return;
      }

      if (!input.forceRefresh) {
        discoveredFrontiersRef.current.add(expansionKey);
      } else {
        discoveredFrontiersRef.current.delete(expansionKey);
      }
      setPersistenceStatus("saving");

      try {
        const latestScene = scenesByTabIdRef.current[input.tabId] ?? input.scene;
        setCartographerStatus({
          chunkKey: chunk.key,
          levelId: input.viewport.layer,
          message: `Generating adjacent ${input.viewport.layer} chunk ${chunk.key}`,
          mode: "expand_horizontal",
          phase: "generating",
          updatedAt: new Date().toISOString(),
        });
        const transaction = await window.seekstar.cartographer.runViewportExpansionTransaction({
          forceRefresh: input.forceRefresh,
          scene: latestScene,
          tabId: input.tabId,
          viewport: input.viewport,
        });
        applyCartographerChunkSnapshot(transaction.snapshot);
        setCartographerStatus(transaction.status);
        const nextScene = transaction.result.sceneApply?.scene;

        if (!nextScene || !scenesByTabIdRef.current[input.tabId]) {
          setPersistenceStatus("saved");
          return;
        }

        const nextScenesByTabId = replaceScene(input.tabId, nextScene);
        await persistWorkspaceAfterSceneChange(input.tabId, nextScenesByTabId);
        setPersistenceStatus("saved");
      } catch {
        setCartographerStatus({
          chunkKey: chunk.key,
          levelId: input.viewport.layer,
          message: `Failed to generate ${input.viewport.layer} chunk ${chunk.key}`,
          mode: "expand_horizontal",
          phase: "error",
          updatedAt: new Date().toISOString(),
        });
        setPersistenceStatus("error");
      }
    },
    [applyCartographerChunkSnapshot, persistWorkspaceAfterSceneChange, replaceScene],
  );

  const handleCartographerChunkRefresh = useCallback(
    (viewport: TerrainScene["viewport"], scheduling?: CartographerChunkSchedulingPolicy): void => {
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const policy = normalizeCartographerChunkSchedulingPolicy(scheduling);
      const refreshViewport = {
        ...viewport,
        x: Math.round(viewport.x / policy.chunk_width) * policy.chunk_width,
        y: Math.round(viewport.y / policy.chunk_height) * policy.chunk_height,
      };

      void expandCartographerChunk({
        forceRefresh: true,
        ignoreDedupe: true,
        scene: currentScene,
        tabId,
        viewport: refreshViewport,
      });
    },
    [expandCartographerChunk, scene],
  );

  const handleCartographerTransactionCancel = useCallback((): void => {
    const tabId = activeTabIdRef.current;

    void window.seekstar.cartographer
      .cancelTransaction({ tabId })
      .then((result) => {
        if (result.cancelled <= 0) {
          return;
        }

        setCartographerStatus({
          message: `Cancelled ${result.cancelled} Cartographer transaction${result.cancelled === 1 ? "" : "s"}`,
          phase: "cancelled",
          updatedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        setCartographerStatus({
          message: "Failed to cancel Cartographer transaction",
          phase: "error",
          updatedAt: new Date().toISOString(),
        });
      });
  }, []);

  const handleCartographerChunkDirectionExpand = useCallback(
    (
      direction: "east" | "north" | "south" | "west",
      viewport: TerrainScene["viewport"],
      scheduling?: CartographerChunkSchedulingPolicy,
    ): void => {
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const policy = normalizeCartographerChunkSchedulingPolicy(scheduling);
      const range = Math.max(1, Math.min(3, Math.round(policy.manual_preload_range)));

      for (let step = 1; step <= range; step += 1) {
        const nextViewport = createAdjacentCartographerViewport(viewport, direction, step, policy);

        void expandCartographerChunk({
          ignoreDedupe: true,
          scene: currentScene,
          tabId,
          viewport: nextViewport,
        });
      }
    },
    [expandCartographerChunk, scene],
  );

  const handleAssistantChunkExpansion = useCallback(
    async (
      viewport: TerrainScene["viewport"],
      scheduling?: CartographerChunkSchedulingPolicy,
    ): Promise<SelectionSyncResult | undefined> => {
      if (!isCartographerExpandableLayer(viewport.layer)) {
        return undefined;
      }

      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const policy = normalizeCartographerChunkSchedulingPolicy(scheduling);
      const chunk = createCartographerChunkKeyForViewport(viewport, policy.chunk_width, policy.chunk_height);
      const expansionKey = `${tabId}:${viewport.layer}:${chunk.key}`;
      discoveredFrontiersRef.current.add(expansionKey);
      setPersistenceStatus("saving");
      setCartographerStatus({
        chunkKey: chunk.key,
        levelId: viewport.layer,
        message: `Generating assistant-requested ${viewport.layer} chunk ${chunk.key}`,
        mode: "expand_horizontal",
        phase: "generating",
        updatedAt: new Date().toISOString(),
      });

      try {
        const transaction = await window.seekstar.cartographer.runViewportExpansionTransaction({
          forceRefresh: false,
          scene: currentScene,
          tabId,
          viewport,
        });
        applyCartographerChunkSnapshot(transaction.snapshot);
        setCartographerStatus(transaction.status);
        const nextScene = transaction.result.sceneApply?.scene;

        if (!nextScene || !scenesByTabIdRef.current[tabId]) {
          setPersistenceStatus("saved");
          return {
            scene: currentScene,
            selectedNodeIds: currentScene.selection.node_ids,
            focusNodeId: currentScene.runtime.focused_node_id ?? currentScene.selection.node_ids[0],
          };
        }

        const nextScenesByTabId = replaceScene(tabId, nextScene);
        await persistWorkspaceAfterSceneChange(tabId, nextScenesByTabId);
        setPersistenceStatus("saved");

        return {
          scene: nextScene,
          selectedNodeIds: nextScene.selection.node_ids,
          focusNodeId: nextScene.runtime.focused_node_id ?? nextScene.selection.node_ids[0],
        };
      } catch (error) {
        setCartographerStatus({
          chunkKey: chunk.key,
          levelId: viewport.layer,
          message: `Failed assistant-requested ${viewport.layer} chunk ${chunk.key}`,
          mode: "expand_horizontal",
          phase: "error",
          updatedAt: new Date().toISOString(),
        });
        setPersistenceStatus("error");
        throw error;
      }
    },
    [applyCartographerChunkSnapshot, persistWorkspaceAfterSceneChange, replaceScene, scene],
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
    (nextViewport: TerrainScene["viewport"], scheduling?: CartographerChunkSchedulingPolicy) => {
      if (isCartographerExpandableLayer(nextViewport.layer)) {
        const policy = normalizeCartographerChunkSchedulingPolicy(scheduling);

        if (!policy.auto_expand_enabled || policy.auto_preload_ring <= 0) {
          return;
        }

        const tabId = activeTabIdRef.current;
        const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
        const chunk = createCartographerChunkKeyForViewport(nextViewport, policy.chunk_width, policy.chunk_height);
        const timerKey = `cartographer:${tabId}:${nextViewport.layer}:${chunk.key}`;
        const existingTimer = frontierTimersRef.current[timerKey];

        if (existingTimer) {
          window.clearTimeout(existingTimer);
        }

        recordCartographerChunk(
          tabId,
          createQueuedCartographerChunkRecord({
            chunk,
            levelId: nextViewport.layer,
            message: `Queued ${nextViewport.layer} chunk ${chunk.key}`,
            mode: "expand_horizontal",
          }),
        );
        frontierTimersRef.current[timerKey] = window.setTimeout(() => {
          void expandCartographerChunk({
            scene: currentScene,
            tabId,
            viewport: nextViewport,
          });
        }, policy.boundary_debounce_ms);
        return;
      }

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
    [expandCartographerChunk, recordCartographerChunk, runFrontierDiscovery, scene],
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

  const handleReplaceFailedSourceCandidate = useCallback(
    async (observationId: string): Promise<SelectionSyncResult | undefined> => {
      const tabId = activeTabIdRef.current;
      const currentScene = scenesByTabIdRef.current[tabId] ?? scene;
      const observation = (currentScene.scout_observations ?? []).find((candidate) => candidate.id === observationId);

      if (!observation || (observation.status !== "failed" && !observation.failure_reason)) {
        return undefined;
      }

      setPersistenceStatus("saving");
      setCartographerStatus({
        levelId: "L3",
        message: `Replacing failed source candidate ${observation.url ?? observation.title}`,
        mode: "replace_failed_source",
        phase: "generating",
        updatedAt: new Date().toISOString(),
      });

      try {
        const transaction = await window.seekstar.cartographer.runSourceReplacementTransaction({
          observationId,
          scene: currentScene,
          tabId,
        });
        const nextScene = transaction.result.sceneApply?.scene;

        applyCartographerChunkSnapshot(transaction.snapshot);
        setCartographerStatus(transaction.status);

        if (!nextScene || !scenesByTabIdRef.current[tabId]) {
          setPersistenceStatus("saved");
          return undefined;
        }

        const nextScenesByTabId = replaceScene(tabId, nextScene);
        await persistWorkspaceAfterSceneChange(tabId, nextScenesByTabId);
        setPersistenceStatus("saved");

        return {
          selectedNodeIds: nextScene.selection.node_ids,
          focusNodeId: nextScene.runtime.focused_node_id,
        };
      } catch {
        setCartographerStatus({
          levelId: "L3",
          message: `Failed to replace source candidate ${observation.url ?? observation.title}`,
          mode: "replace_failed_source",
          phase: "error",
          updatedAt: new Date().toISOString(),
        });
        setPersistenceStatus("error");
        return undefined;
      }
    },
    [applyCartographerChunkSnapshot, persistWorkspaceAfterSceneChange, replaceScene, scene],
  );

  const handleUseSelectionAsSeed = useCallback(
    async (selectedNodes: TerrainNode[]): Promise<SeedTabCreationResult | undefined> => {
      if (selectedNodes.length === 0) {
        return undefined;
      }

      const seedTitle =
        selectedNodes.length === 1 ? selectedNodes[0].title : `${selectedNodes[0].title} + ${selectedNodes.length - 1} nearby`;
      const originNode = selectedNodes[0];
      const originTabId = activeTabIdRef.current;

      const openedScene = await openSeedScene(
        createSeedScene(seedTitle, {
          sourceMode: "selection",
          parentBacklink: {
            tab_id: originTabId,
            node_id: originNode.id,
            label: selectedNodes.length === 1 ? `Selection: ${originNode.title}` : `Region: ${seedTitle}`,
            excerpt: selectedNodes.map((node) => node.title).join(", "),
          },
        }),
      );

      return {
        createdTabId: openedScene.active_tab_id,
        focusNodeId: openedScene.runtime.focused_node_id ?? openedScene.selection.node_ids[0],
        originTabId,
        selectedNodeIds: openedScene.selection.node_ids,
      };
    },
    [openSeedScene],
  );

  const handleUseNodeAsSeed = useCallback(
    async (node: TerrainNode, source?: SourceRef): Promise<SeedTabCreationResult | undefined> => {
      const seedTitle = node.title.trim() || source?.title || "Source-backed seed";
      const excerpt = node.quote ?? node.summary ?? source?.snippet;
      const createdFromLabel = node.created_from?.label ?? node.semantic_breadcrumb?.join(" / ");
      const originTabId = activeTabIdRef.current;

      const openedScene = await openSeedScene(
        createSeedScene(seedTitle, {
          sourceMode: "selection",
          parentBacklink: {
            tab_id: originTabId,
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

      return {
        createdTabId: openedScene.active_tab_id,
        focusNodeId: openedScene.runtime.focused_node_id ?? openedScene.selection.node_ids[0],
        originTabId,
        selectedNodeIds: openedScene.selection.node_ids,
      };
    },
    [openSeedScene],
  );

  return {
    scene,
    objectPool,
    activeTabId,
    scenesByTabId,
    basketByTabId,
    setBasketByTabId,
    cartographerChunkRecords,
    cartographerStatus,
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
    handleIngestDirectUrlIntoCurrentTab,
    handleOpenDirectUrlAsSeek,
    handleObserveCandidateIntoCurrentTab,
    handleOpenCandidateAsSeek,
    handleTabSelect,
    handleCloseTab,
    handleRestoreSceneSnapshot,
    handleReorderTabs,
    handleBacklinkFocus,
    handleAddSource,
    handleRunScoutPlan,
    handleScoutDirectUrl,
    handleScoutSourceLinks,
    handleCanvasFrontierDiscovery,
    handleAssistantChunkExpansion,
    handleCartographerChunkDirectionExpand,
    handleCartographerChunkRefresh,
    handleCartographerTransactionCancel,
    handleConvertScoutObservation,
    handleReplaceFailedSourceCandidate,
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
  await window.seekstar.tabs.syncWorkspaceTabs({
    activeTabId,
    closeDeprecatedDefaultTabs: true,
    tabs: Object.values(scenesByTabId)
      .map((hydratedScene) => hydratedScene.tabs.find((tab) => tab.id === hydratedScene.active_tab_id) ?? hydratedScene.tabs[0])
      .filter((hydratedTab): hydratedTab is NonNullable<typeof hydratedTab> => Boolean(hydratedTab))
      .map((hydratedTab) => ({
        seed: hydratedTab.seed,
        tabId: hydratedTab.id,
        title: hydratedTab.title,
      })),
  });
}

function createPendingDirectUrlObservation(input: {
  createdAt: string;
  tabId: string;
  targetNodeIds: string[];
  url: string;
}): ScoutObservation {
  return {
    id: `observation-direct-url-pending-${Date.now()}`,
    tab_id: input.tabId,
    status: "pending",
    adapter: "playwright",
    layer: "L3",
    position_hint: { x: 0, y: 0 },
    discovery_mode: "direct_url",
    confidence: 0.36,
    query: input.url,
    title: `Observing ${input.url}`,
    target_node_ids: input.targetNodeIds,
    url: input.url,
    snippet: "Playwright Scout is observing this URL before source-backed terrain is created.",
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function shouldBootstrapCartographerTerrain(scene: TerrainScene): boolean {
  if (scene.sources.length > 0 || isDirectHttpUrl(scene.metadata.title)) {
    return false;
  }

  if (scene.nodes.some((node) => node.source_state === "cartographer_primary" || node.tags?.includes("cartographer"))) {
    return false;
  }

  if ((scene.scout_observations ?? []).some((observation) => observation.provider_id === "ai-cartographer")) {
    return false;
  }

  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];
  const seed = (activeTab?.seed || scene.metadata.title).trim();

  return Boolean(seed) && !isDirectHttpUrl(seed);
}

function isCartographerExpandableLayer(layer: LayerId): layer is CartographerLevelBandId {
  return layer === "L0" || layer === "L1" || layer === "L2" || layer === "L3";
}

function settleStaleDirectUrlPendingScenes(scenesByTabId: Record<string, TerrainScene>): {
  changed: boolean;
  scenesByTabId: Record<string, TerrainScene>;
} {
  let changed = false;
  const now = Date.now();
  const nextScenesByTabId = Object.fromEntries(
    Object.entries(scenesByTabId).map(([tabId, scene]) => {
      let nextScene = scene;
      const staleObservations = (scene.scout_observations ?? []).filter(
        (observation) =>
          observation.discovery_mode === "direct_url" &&
          observation.status === "pending" &&
          isStaleTimestamp(observation.updated_at, now, STALE_DIRECT_URL_PENDING_MS),
      );

      for (const observation of staleObservations) {
        changed = true;
        nextScene = createDirectUrlIntakeFailureResult({
          pendingObservationId: observation.id,
          scene: nextScene,
          tabId,
          targetNodeIds: observation.target_node_ids,
          url: observation.url ?? observation.query,
          reason: "Direct URL Scout was interrupted before returning. Run source intake again to retry.",
        }).scene;
      }

      return [tabId, nextScene];
    }),
  );

  return {
    changed,
    scenesByTabId: nextScenesByTabId,
  };
}

function createDirectUrlIntakeFailureResult(input: {
  pendingObservationId?: string;
  reason: string;
  scene: TerrainScene;
  tabId: string;
  targetNodeIds: string[];
  url: string;
}): DirectUrlSourceIntakeResult {
  const timestamp = new Date().toISOString();
  const plan = createDirectUrlScoutPlan(input.url, input.targetNodeIds, timestamp);
  const failedObservation = createFailedScoutObservation({
    tabId: input.tabId,
    plan,
    title: `Direct URL Scout failed: ${input.url}`,
    failureReason: input.reason,
    timestamp,
  });
  const failedResult = applyExplorationEvent(settleScoutObservation(input.scene, input.pendingObservationId, "duplicate"), {
    type: "scout.observations.appended",
    observations: [failedObservation],
    description: `${input.scene.metadata.title} could not observe ${input.url} through Scout.`,
  });

  return {
    observation: failedObservation,
    observations: [failedObservation],
    scene: failedResult.scene,
  };
}

function settleScoutObservation(
  scene: TerrainScene,
  observationId: string | undefined,
  status: ScoutObservation["status"],
): TerrainScene {
  if (!observationId || !(scene.scout_observations ?? []).some((observation) => observation.id === observationId)) {
    return scene;
  }

  const updatedAt = new Date().toISOString();

  return {
    ...scene,
    scout_observations: (scene.scout_observations ?? []).map((observation) =>
      observation.id === observationId
        ? {
            ...observation,
            status,
            updated_at: updatedAt,
          }
        : observation,
    ),
    metadata: {
      ...scene.metadata,
      updated_at: updatedAt,
    },
    runtime: {
      ...scene.runtime,
      updated_at: updatedAt,
    },
  };
}

function isStaleTimestamp(value: string, now: number, thresholdMs: number): boolean {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return now - timestamp > thresholdMs;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      resolve(onTimeout());
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function normalizeCartographerChunkSchedulingPolicy(
  policy?: Partial<CartographerChunkSchedulingPolicy>,
): CartographerChunkSchedulingPolicy {
  return {
    auto_expand_enabled: policy?.auto_expand_enabled ?? true,
    auto_preload_ring: clampCartographerPolicyNumber(policy?.auto_preload_ring, 0, 2, 1),
    boundary_debounce_ms: clampCartographerPolicyNumber(policy?.boundary_debounce_ms, 120, 5_000, 520),
    chunk_height: clampCartographerPolicyNumber(policy?.chunk_height, 480, 3_200, 900),
    chunk_width: clampCartographerPolicyNumber(policy?.chunk_width, 480, 3_200, 1200),
    manual_preload_range: clampCartographerPolicyNumber(policy?.manual_preload_range, 1, 3, 1),
  };
}

function clampCartographerPolicyNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function createAdjacentCartographerViewport(
  viewport: TerrainScene["viewport"],
  direction: "east" | "north" | "south" | "west",
  step = 1,
  policy: CartographerChunkSchedulingPolicy = normalizeCartographerChunkSchedulingPolicy(),
): TerrainScene["viewport"] {
  const chunkWidth = policy.chunk_width * step;
  const chunkHeight = policy.chunk_height * step;

  switch (direction) {
    case "west":
      return { ...viewport, x: viewport.x - chunkWidth };
    case "north":
      return { ...viewport, y: viewport.y - chunkHeight };
    case "south":
      return { ...viewport, y: viewport.y + chunkHeight };
    case "east":
    default:
      return { ...viewport, x: viewport.x + chunkWidth };
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
