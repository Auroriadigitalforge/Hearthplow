import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Pause, Wrench, CheckCircle2, Zap, Compass, Video, Siren, Store, Users, CloudSnow, Snowflake, Wind, Moon } from 'lucide-react';
import { CameraMode, CONTRACTS, LiveRunStats, SteeringMode } from '../game/types';

interface HudOverlayProps {
  stats: LiveRunStats;
  savedCoins: number;
  muted: boolean;
  steeringMode: SteeringMode;
  cameraMode: CameraMode;
  onToggleMute: () => void;
  onToggleSteeringMode: () => void;
  onCycleCameraMode: () => void;
  onOpenPause: () => void;
  onOpenGarage: () => void;
  onOpenShop: (shopId?: string) => void;
  onFinishShift: () => void;
  onTouchSteer: (x: number, y: number) => void;
  onTouchBoost: () => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  stats,
  savedCoins,
  muted,
  steeringMode,
  cameraMode,
  onToggleMute,
  onToggleSteeringMode,
  onCycleCameraMode,
  onOpenPause,
  onOpenGarage,
  onOpenShop,
  onFinishShift,
  onTouchSteer,
  onTouchBoost,
}) => {
  const contract = CONTRACTS[stats.contractIndex] ?? CONTRACTS[0];
  const [visibleCallout, setVisibleCallout] = useState<LiveRunStats['lastCallout']>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  }, []);

  useEffect(() => {
    if (!stats.lastCallout) return;
    setVisibleCallout(stats.lastCallout);
    const t = window.setTimeout(() => {
      setVisibleCallout((curr) => (curr?.id === stats.lastCallout?.id ? null : curr));
    }, 1700);
    return () => window.clearTimeout(t);
  }, [stats.lastCallout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && stats.contractReadyToFinish) {
        onFinishShift();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stats.contractReadyToFinish, onFinishShift]);

  const progressRatio = Math.min(100, stats.clearPercent);
  const targetLeftPct = Math.min(98, stats.targetPercent);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5">
      {/* Top Perimeter Status Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Route Clear Progress */}
        <div className="bg-[#0f1622]/88 border border-white/12 rounded-xl px-4 py-3 min-w-[240px] max-w-[330px]">
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display font-bold text-sm text-white truncate">{contract.name}</span>
              {stats.difficulty === 'hard' && (
                <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-[10px] font-bold text-red-300 shrink-0">
                  HARD
                </span>
              )}
            </div>
            <span className="font-mono-num text-sm font-bold text-sky-400 shrink-0">
              {stats.clearPercent.toFixed(1)}%
            </span>
          </div>

          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-[width] duration-150 ${
                stats.contractReadyToFinish ? 'bg-amber-400' : 'bg-sky-400'
              }`}
              style={{ width: `${progressRatio}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80"
              style={{ left: `${targetLeftPct}%` }}
              title={`Target ${stats.targetPercent}%`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 font-mono-num">
            <span>
              Priority {stats.priorityCleared}/{stats.priorityTotal}
              {stats.clearPercent >= 85 ? ' · Patches Lit' : ''}
            </span>
            <span className="text-slate-400">{formatClock(stats.elapsedSeconds)}</span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 mt-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              {stats.weatherIntensity === 'blizzard' ? (
                <Wind className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              ) : stats.weatherIntensity === 'snowfall' ? (
                <CloudSnow className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              ) : stats.weatherIntensity === 'flurries' ? (
                <Snowflake className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              )}
              <span
                className={`font-medium truncate ${
                  stats.weatherIntensity === 'blizzard'
                    ? 'text-cyan-200'
                    : stats.weatherIntensity === 'snowfall'
                    ? 'text-sky-200'
                    : stats.weatherIntensity === 'flurries'
                    ? 'text-slate-200'
                    : 'text-amber-200'
                }`}
              >
                {stats.weatherLabel}
              </span>
            </div>
            <span
              className={`font-mono-num font-bold shrink-0 ${
                stats.roadGripPercent >= 75
                  ? 'text-emerald-400'
                  : stats.roadGripPercent >= 60
                  ? 'text-amber-300'
                  : 'text-red-400'
              }`}
            >
              Grip {stats.roadGripPercent}%
            </span>
          </div>
        </div>

        {/* Top-Center: Police Dispatch Alert or Dynamic Callout Toast */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 pt-1">
          {stats.policeChaseActive && (
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-lg border bg-[#161e2e]/95 border-red-500/75 text-red-200 font-display font-bold text-xs shadow-lg">
              <Siren className="w-4 h-4 text-red-400 shrink-0" />
              <span>Police Dispatched</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono-num text-amber-300">
                {stats.npcHitsCount} {stats.npcHitsCount === 1 ? 'Hit' : 'Hits'} (-{stats.pendingFine})
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono-num text-sky-300">{stats.policeChaseRemaining.toFixed(1)}s</span>
            </div>
          )}
          {visibleCallout && (
            <div
              className={`px-4 py-1.5 rounded-lg border font-display font-bold text-sm shadow-lg transition-opacity duration-200 ${
                visibleCallout.accent === 'amber'
                  ? 'bg-[#161e2e]/95 border-amber-400/60 text-amber-300'
                  : 'bg-[#161e2e]/95 border-sky-400/60 text-sky-300'
              }`}
            >
              {visibleCallout.text}
            </div>
          )}
        </div>

        {/* Top-Right: Coins, Combo Multiplier & Utility Actions */}
        <div className="flex items-start gap-2.5">
          {/* Combo Multiplier Readout */}
          <div className="bg-[#0f1622]/88 border border-white/12 rounded-xl px-3.5 py-2.5 min-w-[110px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-400">Combo</span>
              <span
                className={`font-mono-num font-bold text-base ${
                  stats.comboMultiplier >= 4
                    ? 'text-amber-400'
                    : stats.comboMultiplier >= 2
                    ? 'text-sky-400'
                    : 'text-slate-200'
                }`}
              >
                {stats.comboMultiplier}x
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-amber-400 transition-[width] duration-100"
                style={{ width: `${Math.round(stats.comboTimerRatio * 100)}%` }}
              />
            </div>
          </div>

          {/* Coins Balance */}
          <div className="bg-[#0f1622]/88 border border-white/12 rounded-xl px-3.5 py-2.5">
            <div className="text-xs text-slate-400">Coins</div>
            <div className="font-mono-num font-bold text-base text-amber-400">
              {savedCoins + stats.coinsEarnedThisRun}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onCycleCameraMode}
              title="Switch camera angle (C)"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {cameraMode === 'cab' ? 'Cab' : cameraMode === 'chase' ? 'Chase' : 'Isometric'}
              </span>
            </button>
            {cameraMode === 'isometric' && (
              <button
                type="button"
                onClick={onToggleSteeringMode}
                title={`Steering: ${steeringMode === 'camera' ? 'Camera-Relative' : 'Truck-Relative'}`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>{steeringMode === 'camera' ? 'Camera' : 'Truck'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenShop(stats.nearbyShop?.id)}
              title="Open City Shops & Crowd"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-emerald-400/35 text-emerald-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Shops ({stats.allShops.length})</span>
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              title="Open Garage"
              className="p-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute audio' : 'Mute audio'}
              className="p-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>
            <button
              type="button"
              onClick={onOpenPause}
              title="Pause (Esc)"
              className="p-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter Row: Boost Gauge & Finish Shift CTA */}
      <div className="flex items-end justify-between gap-4">
        {/* Mobile Touch Controls (shown only on touch devices) */}
        {isTouchDevice ? (
          <div className="pointer-events-auto grid grid-cols-3 gap-1.5 w-36">
            <div />
            <button
              type="button"
              onTouchStart={() => onTouchSteer(0, 1)}
              onTouchEnd={() => onTouchSteer(0, 0)}
              className="h-11 rounded-lg bg-[#0f1622]/85 border border-white/15 text-white font-bold active:bg-amber-500/30"
            >
              W
            </button>
            <div />
            <button
              type="button"
              onTouchStart={() => onTouchSteer(-1, 0.7)}
              onTouchEnd={() => onTouchSteer(0, 0)}
              className="h-11 rounded-lg bg-[#0f1622]/85 border border-white/15 text-white font-bold active:bg-amber-500/30"
            >
              A
            </button>
            <button
              type="button"
              onTouchStart={() => onTouchSteer(0, -1)}
              onTouchEnd={() => onTouchSteer(0, 0)}
              className="h-11 rounded-lg bg-[#0f1622]/85 border border-white/15 text-white font-bold active:bg-amber-500/30"
            >
              S
            </button>
            <button
              type="button"
              onTouchStart={() => onTouchSteer(1, 0.7)}
              onTouchEnd={() => onTouchSteer(0, 0)}
              className="h-11 rounded-lg bg-[#0f1622]/85 border border-white/15 text-white font-bold active:bg-amber-500/30"
            >
              D
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-300/80 bg-[#0f1622]/80 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap">
            WASD Drive · Space Boost · E Shop · C Camera · Esc Pause
          </div>
        )}

        {/* Center Compact Shop Prompt, Boost & Finish Shift Cluster */}
        <div className="flex items-center gap-3 mx-auto md:mx-0">
          {stats.nearbyShop && (
            <button
              type="button"
              onClick={() => onOpenShop(stats.nearbyShop?.id)}
              className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs shadow-lg shadow-emerald-600/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Open {stats.nearbyShop.name} (E)</span>
              <span className="flex items-center gap-1 font-mono-num text-emerald-100 bg-black/25 px-1.5 py-0.5 rounded">
                <Users className="w-3 h-3" />
                {stats.nearbyShop.crowdCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onTouchBoost}
            className="pointer-events-auto flex items-center gap-2.5 bg-[#0f1622]/90 border border-white/12 rounded-xl px-3.5 py-2 cursor-pointer hover:bg-[#1a2436] transition-colors"
          >
            <Zap className={`w-4 h-4 ${stats.boostEnergy >= 0.35 ? 'text-sky-400' : 'text-slate-500'}`} />
            <div className="w-24">
              <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                <span>Boost</span>
                <span className="font-mono-num">{Math.round(stats.boostEnergy * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    stats.isBoosting ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.round(stats.boostEnergy * 100)}%` }}
                />
              </div>
            </div>
          </button>

          {stats.contractReadyToFinish && (
            <button
              type="button"
              onClick={onFinishShift}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm shadow-lg shadow-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finish Shift (F)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
