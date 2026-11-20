import React from 'react';
import {
  X,
  Star,
  ArrowRight,
  RotateCcw,
  Wrench,
  Home,
  Play,
  Compass,
  Video,
  ShieldAlert,
  Store,
  Users,
  Coffee,
  Sparkles,
} from 'lucide-react';
import {
  ArrestSummary,
  CameraMode,
  CONTRACTS,
  LiveShopStatus,
  PlayerSaveState,
  SteeringMode,
  UPGRADE_CONFIGS,
  UpgradeKey,
  VictorySummary,
} from '../game/types';

interface GarageModalProps {
  saveState: PlayerSaveState;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({ saveState, onBuyUpgrade, onClose }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div className="w-full max-w-2xl bg-[#0f1622] border border-white/15 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Truck Garage &amp; Upgrades</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Install modular plow parts and winter gear directly onto your pickup.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-sm">
              <span className="text-slate-400 mr-2">Coins</span>
              <span className="font-mono-num font-bold text-amber-400">{saveState.coins}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close garage"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
          {UPGRADE_CONFIGS.map((cfg) => {
            const level = saveState.upgrades[cfg.key];
            const isMax = level >= cfg.maxLevel;
            const nextCost = isMax ? 0 : cfg.costs[level];
            const canAfford = !isMax && saveState.coins >= nextCost;

            return (
              <div
                key={cfg.key}
                className="flex flex-col justify-between p-4 rounded-xl bg-slate-900/80 border border-white/10"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="font-display font-bold text-base text-white">{cfg.name}</h3>
                    <span className="text-xs font-mono-num text-sky-400">{cfg.statLabel(level)}</span>
                  </div>
                  <div className="text-xs text-amber-300/90 font-medium mb-2">
                    Tier {level}/{cfg.maxLevel} · {cfg.tierNames[level]}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{cfg.description}</p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/8">
                  {/* Tier Step Bars */}
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((step) => (
                      <div
                        key={step}
                        className={`h-2 w-6 rounded-sm ${
                          step <= level ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {isMax ? (
                    <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
                      Max Upgraded
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyUpgrade(cfg.key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono-num transition-colors whitespace-nowrap shrink-0 ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Upgrade · {nextCost}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Back to Route
          </button>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  contractName: string;
  steeringMode: SteeringMode;
  cameraMode: CameraMode;
  onToggleSteeringMode: () => void;
  onCycleCameraMode: () => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenGarage: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  contractName,
  steeringMode,
  cameraMode,
  onToggleSteeringMode,
  onCycleCameraMode,
  onResume,
  onRestart,
  onOpenGarage,
  onReturnTitle,
}) => {
  const cameraLabel =
    cameraMode === 'cab' ? '1st-Person Cab' : cameraMode === 'chase' ? 'Top-Side Chase' : 'Isometric';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div className="w-full max-w-sm bg-[#0f1622] border border-white/15 rounded-2xl p-6 shadow-2xl">
        <div className="text-xs text-slate-400 mb-1">Shift Paused</div>
        <h2 className="font-display text-xl font-bold text-white mb-5">{contractName}</h2>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Resume Shift</span>
          </button>
          <button
            type="button"
            onClick={onCycleCameraMode}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>Camera: {cameraLabel}</span>
          </button>
          <button
            type="button"
            onClick={onToggleSteeringMode}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Compass className="w-4 h-4 text-sky-400" />
            <span>
              Isometric Steer: {steeringMode === 'camera' ? 'Camera-Relative' : 'Truck-Relative'}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Open Garage</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-sky-400" />
            <span>Restart Route</span>
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-sm font-medium transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Title Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  summary: VictorySummary;
  hasNextContract: boolean;
  onNextContract: () => void;
  onReplay: () => void;
  onOpenGarage: () => void;
  onReturnTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  summary,
  hasNextContract,
  onNextContract,
  onReplay,
  onOpenGarage,
  onReturnTitle,
}) => {
  const nextContract = CONTRACTS[summary.contract.index + 1];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div className="w-full max-w-md bg-[#0f1622] border border-white/15 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-sky-400">Shift Complete</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-5 h-5 ${
                  s <= summary.starsEarned ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold text-white mb-4">{summary.contract.name}</h2>

        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10">
            <div className="text-xs text-slate-400">Cleared</div>
            <div className="font-mono-num text-lg font-bold text-sky-400">
              {summary.clearPercent.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10">
            <div className="text-xs text-slate-400">Peak Combo</div>
            <div className="font-mono-num text-lg font-bold text-amber-400">{summary.peakCombo}x</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10">
            <div className="text-xs text-slate-400">Time</div>
            <div className="font-mono-num text-lg font-bold text-white">
              {Math.round(summary.elapsedSeconds)}s
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm py-3 border-y border-white/10 mb-5 font-mono-num">
          <div className="flex justify-between text-slate-300">
            <span className="font-sans">Base Route Payout</span>
            <span>+{summary.basePayout}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="font-sans">Combo &amp; Priority Zones</span>
            <span>+{summary.comboAndPriorityCoins}</span>
          </div>
          {summary.masteryBonus > 0 && (
            <div className="flex justify-between text-amber-300">
              <span className="font-sans">Star Mastery Bonus</span>
              <span>+{summary.masteryBonus}</span>
            </div>
          )}
          {summary.timeBonus > 0 && (
            <div className="flex justify-between text-sky-300">
              <span className="font-sans">Quick Shift Bonus</span>
              <span>+{summary.timeBonus}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-amber-400 pt-2 border-t border-white/10">
            <span className="font-sans">Total Coins Earned</span>
            <span>+{summary.totalEarned}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {hasNextContract && nextContract && (
            <button
              type="button"
              onClick={onNextContract}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
            >
              <span>Next Route: {nextContract.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenGarage}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Garage</span>
            </button>
            <button
              type="button"
              onClick={onReplay}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-sky-400" />
              <span>Replay</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Title Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ArrestModalProps {
  summary: ArrestSummary;
  onRestartGame: () => void;
}

export const ArrestModal: React.FC<ArrestModalProps> = ({ summary, onRestartGame }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-[#0f1622] border border-red-500/40 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-xs font-semibold text-red-400">Police Citation &amp; Arrest</span>
        </div>

        <h2 className="font-display text-2xl font-bold text-white mb-1.5">Pulled Over for Pedestrian Hit</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-5">
          Village police intercepted your snowplow after colliding with neighborhood residents. Watch sidewalks and
          driveway aprons carefully.
        </p>

        <div className="space-y-2.5 text-sm py-3.5 border-y border-white/10 mb-5 font-mono-num">
          <div className="flex justify-between text-slate-300">
            <span className="font-sans">Villagers Hit</span>
            <span className="font-bold text-red-400">{summary.npcHitCount}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="font-sans">Fine Per Person</span>
            <span>-{summary.finePerNpc} Coins</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="font-sans">Previous Balance</span>
            <span>{summary.coinsBefore} Coins</span>
          </div>
          <div className="flex justify-between text-red-400 font-semibold">
            <span className="font-sans">Total Fine Deducted</span>
            <span>-{summary.totalFine} Coins</span>
          </div>
          <div className="flex justify-between text-base font-bold text-amber-400 pt-2.5 border-t border-white/10">
            <span className="font-sans">Remaining Coins</span>
            <span>{summary.coinsAfter} Coins</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestartGame}
          className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restart Game (Level 1)</span>
        </button>
      </div>
    </div>
  );
};

interface CityShopModalProps {
  shops: LiveShopStatus[];
  selectedShopId: string;
  availableCoins: number;
  onSelectShop: (shopId: string) => void;
  onClaimTip: (shopId: string) => void;
  onBuyCocoa: (shopId: string) => void;
  onBuySaltBag: (shopId: string) => void;
  onClose: () => void;
}

const CROWD_LABELS = [
  'Shopkeeper · Warm Counter',
  'Neighbor · Hot Cocoa Cup',
  'Resident · Checking Forecast',
  'Walker · Warming Mittens',
  'Villager · Chatting Outside',
  'Local · Buying Fresh Bread',
  'Commuter · Waiting Safely',
  'Shopper · Browsing Window',
];

export const CityShopModal: React.FC<CityShopModalProps> = ({
  shops,
  selectedShopId,
  availableCoins,
  onSelectShop,
  onClaimTip,
  onBuyCocoa,
  onBuySaltBag,
  onClose,
}) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || (e.code === 'KeyE' && !e.repeat)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeShop = shops.find((s) => s.id === selectedShopId) ?? shops[0];
  if (!activeShop) return null;

  const crowdCards = Array.from({ length: Math.max(1, activeShop.crowdCount) }, (_, idx) => ({
    id: idx,
    role: CROWD_LABELS[idx % CROWD_LABELS.length],
  }));

  const categorySubtitle =
    activeShop.category === 'bakery'
      ? 'Hot Pastries, Hearth Bread & Fresh Cocoa'
      : activeShop.category === 'hardware'
      ? 'Alpine Plow Supply, Curb Salt & Winter Gear'
      : activeShop.category === 'market'
      ? 'City Winter Market & Neighborhood Gathering'
      : 'Spiced Apple Cider & Espresso Bar';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
      <div className="w-full max-w-2xl bg-[#0f1622] border border-emerald-400/35 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-4 h-4 text-emerald-400" />
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-bold text-emerald-300">
                OPEN SHOP
              </span>
              <span className="text-xs text-slate-400">City Storefront</span>
            </div>
            <h2 className="font-display text-xl font-bold text-white">{activeShop.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{categorySubtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-sm">
              <span className="text-slate-400 mr-2">Coins</span>
              <span className="font-mono-num font-bold text-amber-400">{availableCoins}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close city shop"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Switch between Open Shops in City */}
        {shops.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {shops.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => onSelectShop(sp.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  sp.id === activeShop.id
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-white/10 text-slate-300'
                }`}
              >
                <span>{sp.name}</span>
                <span className="font-mono-num text-[11px] text-slate-400">({sp.crowdCount})</span>
              </button>
            ))}
          </div>
        )}

        {/* Live Crowd inside & outside this Open Shop */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Crowd at {activeShop.name}</span>
            </div>
            <span className="font-mono-num text-xs font-bold text-emerald-300">
              {activeShop.crowdCount} Villagers Present
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {crowdCards.map((person) => (
              <div
                key={person.id}
                className="px-2.5 py-2 rounded-lg bg-slate-950/80 border border-white/8 text-[11px] text-slate-300 truncate"
              >
                {person.role}
              </div>
            ))}
          </div>
        </div>

        {/* Shop Counter Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div>
              <div className="text-xs font-bold text-amber-300 mb-1">Neighbor Curb Tip</div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Clear snow right outside the shopfront to earn a warm thank-you tip.
              </p>
            </div>
            <button
              type="button"
              disabled={!activeShop.apronCleared || activeShop.tipClaimed}
              onClick={() => onClaimTip(activeShop.id)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors ${
                activeShop.tipClaimed
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 cursor-default'
                  : activeShop.apronCleared
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {activeShop.tipClaimed ? 'Claimed (+20)' : activeShop.apronCleared ? 'Claim +20 Coins' : 'Clear Front Curb'}
            </button>
          </div>

          <div className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 mb-1">
                <Coffee className="w-3.5 h-3.5" />
                <span>Hot Cocoa Thermos</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Refills Plow Boost to 100% and speeds Boost recharge for 22s.
              </p>
            </div>
            <button
              type="button"
              disabled={availableCoins < 25}
              onClick={() => onBuyCocoa(activeShop.id)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors ${
                availableCoins >= 25
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Buy · 25 Coins
            </button>
          </div>

          <div className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shopkeeper Salt Bag</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Spreads instant snow-melt across the street outside this shop.
              </p>
            </div>
            <button
              type="button"
              disabled={availableCoins < 35}
              onClick={() => onBuySaltBag(activeShop.id)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono-num transition-colors ${
                availableCoins >= 35
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Buy · 35 Coins
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Back to Truck
          </button>
        </div>
      </div>
    </div>
  );
};
