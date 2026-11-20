import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrestSummary,
  CONTRACTS,
  CameraMode,
  FINE_PER_NPC,
  GamePhase,
  LiveRunStats,
  PlayerSaveState,
  UPGRADE_CONFIGS,
  UpgradeKey,
  VictorySummary,
  loadSaveState,
  persistSaveState,
} from './game/types';
import { SnowPlowEngine } from './game/engine';
import { TitleScreen } from './components/TitleScreen';
import { HudOverlay } from './components/HudOverlay';
import { ArrestModal, CityShopModal, GarageModal, PauseModal, VictoryModal } from './components/Modals';

const INITIAL_STATS: LiveRunStats = {
  contractIndex: 0,
  difficulty: CONTRACTS[0].difficulty,
  clearPercent: 0,
  targetPercent: CONTRACTS[0].targetPercent,
  masteryPercent: CONTRACTS[0].masteryPercent,
  comboMultiplier: 1,
  comboTimerRatio: 0,
  comboScoreStreak: 0,
  peakCombo: 1,
  coinsEarnedThisRun: 0,
  boostEnergy: 1,
  isBoosting: false,
  elapsedSeconds: 0,
  priorityCleared: 0,
  priorityTotal: CONTRACTS[0].priorityZones.length,
  contractReadyToFinish: false,
  lastCallout: null,
  policeChaseActive: false,
  policeChaseRemaining: 0,
  npcHitsCount: 0,
  pendingFine: 0,
  nearbyShop: null,
  allShops: [],
  weatherIntensity: 'flurries',
  weatherLabel: 'Light Flurries',
  roadGripPercent: 86,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SnowPlowEngine | null>(null);

  const [saveState, setSaveState] = useState<PlayerSaveState>(() => loadSaveState());
  const [phase, setPhase] = useState<GamePhase>('title');
  const [returnPhaseFromGarage, setReturnPhaseFromGarage] = useState<GamePhase>('title');
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [selectedContractIndex, setSelectedContractIndex] = useState<number>(() =>
    loadSaveState().unlockedContractIndex
  );
  const [liveStats, setLiveStats] = useState<LiveRunStats>(INITIAL_STATS);
  const [victorySummary, setVictorySummary] = useState<VictorySummary | null>(null);
  const [arrestSummary, setArrestSummary] = useState<ArrestSummary | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const saveRef = useRef(saveState);
  saveRef.current = saveState;

  const updateAndPersistSave = useCallback((updater: (prev: PlayerSaveState) => PlayerSaveState) => {
    setSaveState((prev) => {
      const next = updater(prev);
      persistSaveState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialSave = saveRef.current;
    const engine = new SnowPlowEngine(
      container,
      initialSave.upgrades,
      initialSave.muted,
      initialSave.steeringMode,
      initialSave.cameraMode,
      {
        onStatsUpdate: (stats) => {
          setLiveStats(stats);
        },
        onPhaseRequestPause: () => {
          setPhase((curr) => {
            if (curr === 'playing') {
              engine.setPhase('paused');
              return 'paused';
            }
            return curr;
          });
        },
        onOpenNearbyShop: (shopId) => {
          setPhase((curr) => {
            if (curr === 'playing') {
              setSelectedShopId(shopId);
              engine.setPhase('shop');
              return 'shop';
            }
            return curr;
          });
        },
        onContractFinished: (summary) => {
          setPhase('victory');
          updateAndPersistSave((prev) => {
            const prevStars = prev.contractStars[summary.contract.id] || 0;
            const nextUnlocked = Math.max(
              prev.unlockedContractIndex,
              Math.min(CONTRACTS.length - 1, summary.contract.index + 1)
            );
            return {
              ...prev,
              coins: prev.coins + summary.totalEarned,
              contractStars: {
                ...prev.contractStars,
                [summary.contract.id]: Math.max(prevStars, summary.starsEarned),
              },
              unlockedContractIndex: nextUnlocked,
            };
          });
          setVictorySummary(summary);
        },
        onContextLost: (lost) => {
          setContextLost(lost);
        },
        onCameraModeChange: (mode: CameraMode) => {
          updateAndPersistSave((prev) => ({
            ...prev,
            cameraMode: mode,
          }));
        },
        onArrestStarted: () => {
          setPhase('arresting');
        },
        onArrestFinished: ({ npcHitCount, coinsEarnedThisRun }) => {
          const coinsBefore = saveRef.current.coins + coinsEarnedThisRun;
          const totalFine = npcHitCount * FINE_PER_NPC;
          const coinsAfter = Math.max(0, coinsBefore - totalFine);
          updateAndPersistSave((prev) => ({
            ...prev,
            coins: coinsAfter,
            unlockedContractIndex: 0,
            contractStars: {},
          }));
          setArrestSummary({
            npcHitCount,
            finePerNpc: FINE_PER_NPC,
            totalFine,
            coinsBefore,
            coinsAfter,
          });
          setPhase('arrested');
        },
      }
    );

    engine.loadContract(CONTRACTS[initialSave.unlockedContractIndex] ?? CONTRACTS[0], true);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [updateAndPersistSave]);

  const handleSelectContract = useCallback((index: number) => {
    const contract = CONTRACTS[index];
    if (!contract) return;
    setSelectedContractIndex(index);
    engineRef.current?.loadContract(contract, true);
  }, []);

  const handleStartShift = useCallback(() => {
    const contract = CONTRACTS[selectedContractIndex] ?? CONTRACTS[0];
    setVictorySummary(null);
    setArrestSummary(null);
    engineRef.current?.loadContract(contract, true);
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, [selectedContractIndex]);

  const handleOpenGarage = useCallback((from: GamePhase) => {
    setReturnPhaseFromGarage(from);
    engineRef.current?.setPhase('garage');
    setPhase('garage');
  }, []);

  const handleCloseGarage = useCallback(() => {
    const backTo = returnPhaseFromGarage;
    engineRef.current?.setPhase(backTo);
    setPhase(backTo);
  }, [returnPhaseFromGarage]);

  const handleOpenShop = useCallback(
    (shopId?: string) => {
      const targetId = shopId || liveStats.nearbyShop?.id || liveStats.allShops[0]?.id || '';
      if (!targetId) return;
      setSelectedShopId(targetId);
      engineRef.current?.setPhase('shop');
      setPhase('shop');
    },
    [liveStats.nearbyShop, liveStats.allShops]
  );

  const handleCloseShop = useCallback(() => {
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, []);

  const spendAvailableCoins = useCallback(
    (cost: number): boolean => {
      const saved = saveRef.current.coins;
      const runCoins = liveStats.coinsEarnedThisRun;
      if (saved + runCoins < cost) return false;
      const fromSaved = Math.min(saved, cost);
      const fromRun = cost - fromSaved;
      if (fromSaved > 0) {
        updateAndPersistSave((prev) => ({ ...prev, coins: Math.max(0, prev.coins - fromSaved) }));
      }
      if (fromRun > 0) {
        engineRef.current?.deductRunCoins(fromRun);
      }
      return true;
    },
    [liveStats.coinsEarnedThisRun, updateAndPersistSave]
  );

  const handleClaimShopTip = useCallback((shopId: string) => {
    engineRef.current?.sound.unlock();
    engineRef.current?.claimShopTip(shopId);
  }, []);

  const handleBuyCocoa = useCallback(
    (shopId: string) => {
      if (!spendAvailableCoins(25)) return;
      engineRef.current?.sound.unlock();
      engineRef.current?.activateShopCocoa(shopId);
    },
    [spendAvailableCoins]
  );

  const handleBuySaltBag = useCallback(
    (shopId: string) => {
      if (!spendAvailableCoins(35)) return;
      engineRef.current?.sound.unlock();
      engineRef.current?.activateShopSaltBag(shopId);
    },
    [spendAvailableCoins]
  );

  const handleBuyUpgrade = useCallback(
    (key: UpgradeKey) => {
      const cfg = UPGRADE_CONFIGS.find((u) => u.key === key);
      if (!cfg) return;
      const cur = saveRef.current;
      const lvl = cur.upgrades[key];
      if (lvl >= cfg.maxLevel) return;
      const cost = cfg.costs[lvl];
      if (cur.coins < cost) return;

      const nextUpgrades = { ...cur.upgrades, [key]: lvl + 1 };
      updateAndPersistSave((prev) => ({
        ...prev,
        coins: prev.coins - cost,
        upgrades: nextUpgrades,
      }));
      engineRef.current?.sound.unlock();
      engineRef.current?.sound.playUpgradePurchase();
      engineRef.current?.applyUpgrades(nextUpgrades);
    },
    [updateAndPersistSave]
  );

  const handleToggleMute = useCallback(() => {
    engineRef.current?.sound.unlock();
    updateAndPersistSave((prev) => {
      const nextMuted = !prev.muted;
      engineRef.current?.sound.setMuted(nextMuted);
      return { ...prev, muted: nextMuted };
    });
  }, [updateAndPersistSave]);

  const handleToggleSteeringMode = useCallback(() => {
    updateAndPersistSave((prev) => {
      const nextMode = prev.steeringMode === 'camera' ? 'car' : 'camera';
      engineRef.current?.setSteeringMode(nextMode);
      return { ...prev, steeringMode: nextMode };
    });
  }, [updateAndPersistSave]);

  const handleCycleCameraMode = useCallback(() => {
    const order: CameraMode[] = ['isometric', 'chase', 'cab'];
    updateAndPersistSave((prev) => {
      const nextCam = order[(order.indexOf(prev.cameraMode) + 1) % order.length];
      engineRef.current?.setCameraMode(nextCam, true);
      return { ...prev, cameraMode: nextCam };
    });
  }, [updateAndPersistSave]);

  const handleResume = useCallback(() => {
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, []);

  const handleRestart = useCallback(() => {
    const contract = CONTRACTS[selectedContractIndex] ?? CONTRACTS[0];
    setVictorySummary(null);
    setArrestSummary(null);
    engineRef.current?.loadContract(contract, true);
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, [selectedContractIndex]);

  const handleArrestRestart = useCallback(() => {
    setArrestSummary(null);
    setVictorySummary(null);
    setSelectedContractIndex(0);
    engineRef.current?.loadContract(CONTRACTS[0], true);
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, []);

  const handleReturnTitle = useCallback(() => {
    setVictorySummary(null);
    setArrestSummary(null);
    const contract = CONTRACTS[selectedContractIndex] ?? CONTRACTS[0];
    engineRef.current?.loadContract(contract, true);
    engineRef.current?.setPhase('title');
    setPhase('title');
  }, [selectedContractIndex]);

  const handleNextContract = useCallback(() => {
    if (!victorySummary) return;
    const nextIdx = Math.min(CONTRACTS.length - 1, victorySummary.contract.index + 1);
    setSelectedContractIndex(nextIdx);
    setVictorySummary(null);
    setArrestSummary(null);
    engineRef.current?.loadContract(CONTRACTS[nextIdx], true);
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  }, [victorySummary]);

  const handleFinishShift = useCallback(() => {
    engineRef.current?.finishShiftEarly();
  }, []);

  const handleTouchSteer = useCallback((x: number, y: number) => {
    engineRef.current?.setTouchControls(x, y);
  }, []);

  const handleTouchBoost = useCallback(() => {
    engineRef.current?.triggerBoost();
  }, []);

  const activeContract = CONTRACTS[selectedContractIndex] ?? CONTRACTS[0];

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#111827]">
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1622] text-slate-200 p-6">
          <div className="max-w-sm text-center">
            <h2 className="font-display text-xl font-bold text-white mb-2">Graphics Context Paused</h2>
            <p className="text-sm text-slate-400">Restoring 3D snow-plowing viewport...</p>
          </div>
        </div>
      )}

      {phase === 'title' && (
        <TitleScreen
          saveState={saveState}
          selectedContractIndex={selectedContractIndex}
          onSelectContract={handleSelectContract}
          onStartShift={handleStartShift}
          onOpenGarage={() => handleOpenGarage('title')}
          onToggleMute={handleToggleMute}
          onToggleSteeringMode={handleToggleSteeringMode}
          onCycleCameraMode={handleCycleCameraMode}
        />
      )}

      {phase === 'playing' && (
        <HudOverlay
          stats={liveStats}
          savedCoins={saveState.coins}
          muted={saveState.muted}
          steeringMode={saveState.steeringMode}
          cameraMode={saveState.cameraMode}
          onToggleMute={handleToggleMute}
          onToggleSteeringMode={handleToggleSteeringMode}
          onCycleCameraMode={handleCycleCameraMode}
          onOpenPause={() => {
            engineRef.current?.setPhase('paused');
            setPhase('paused');
          }}
          onOpenGarage={() => handleOpenGarage('playing')}
          onOpenShop={handleOpenShop}
          onFinishShift={handleFinishShift}
          onTouchSteer={handleTouchSteer}
          onTouchBoost={handleTouchBoost}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          contractName={activeContract.name}
          steeringMode={saveState.steeringMode}
          cameraMode={saveState.cameraMode}
          onToggleSteeringMode={handleToggleSteeringMode}
          onCycleCameraMode={handleCycleCameraMode}
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenGarage={() => handleOpenGarage('paused')}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {phase === 'garage' && (
        <GarageModal
          saveState={saveState}
          onBuyUpgrade={handleBuyUpgrade}
          onClose={handleCloseGarage}
        />
      )}

      {phase === 'shop' && (
        <CityShopModal
          shops={liveStats.allShops}
          selectedShopId={selectedShopId}
          availableCoins={saveState.coins + liveStats.coinsEarnedThisRun}
          onSelectShop={setSelectedShopId}
          onClaimTip={handleClaimShopTip}
          onBuyCocoa={handleBuyCocoa}
          onBuySaltBag={handleBuySaltBag}
          onClose={handleCloseShop}
        />
      )}

      {phase === 'victory' && victorySummary && (
        <VictoryModal
          summary={victorySummary}
          hasNextContract={victorySummary.contract.index < CONTRACTS.length - 1}
          onNextContract={handleNextContract}
          onReplay={handleRestart}
          onOpenGarage={() => handleOpenGarage('victory')}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {phase === 'arresting' && (
        <div className="pointer-events-none fixed inset-x-0 top-5 z-20 flex justify-center px-4">
          <div className="px-4 py-2.5 rounded-xl bg-[#0f1622]/95 border border-red-500/50 shadow-xl text-center">
            <div className="text-xs font-bold text-red-400">Pulling Over · Officer Approaching Cab</div>
            <div className="text-xs text-slate-300 font-mono-num mt-0.5">
              Villagers Hit: {liveStats.npcHitsCount} · Fine: -{liveStats.pendingFine} Coins
            </div>
          </div>
        </div>
      )}

      {phase === 'arrested' && arrestSummary && (
        <ArrestModal summary={arrestSummary} onRestartGame={handleArrestRestart} />
      )}
    </div>
  );
}
