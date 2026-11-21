import React, { useEffect, useState } from 'react';
import { VirtualJoystick } from './VirtualJoystick';
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
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-4 md:p-5">

      {/* ── TOP ROW ── */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-3">

        {/* Top-Left: Progress card — fluid width, no fixed min-w */}
        <div className="bg-[#0f1622]/88 border border-white/12 rounded-xl px-2.5 py-2 sm:px-4 sm:py-3 w-[48vw] max-w-[320px] min-w-0 shrink-0">
          <div className="flex items-baseline justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-display font-bold text-[11px] sm:text-sm text-white truncate leading-tight">{contract.name}</span>
              {stats.difficulty === 'hard' && (
                <span className="hidden sm:inline px-1 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-[9px] font-bold text-red-300 shrink-0">
                  HARD
                </span>
              )}
            </div>
            <span className="font-mono-num text-xs sm:text-sm font-bold text-sky-400 shrink-0">
              {stats.clearPercent.toFixed(1)}%
            </span>
          </div>

          <div className="relative h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
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

          {/* Clock + priority — hide on very small portrait to save space */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-300 font-mono-num">
            <span className="truncate">
              {stats.priorityCleared}/{stats.priorityTotal} prio
            </span>
            <span className="text-slate-400 ml-1 shrink-0">{formatClock(stats.elapsedSeconds)}</span>
          </div>

          {/* Weather + grip — hide on tiny screens, show from sm */}
          <div className="hidden sm:flex items-center justify-between gap-2 border-t border-white/10 pt-2 mt-2 text-xs">
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
              <span className={`font-medium truncate ${
                stats.weatherIntensity === 'blizzard' ? 'text-cyan-200'
                : stats.weatherIntensity === 'snowfall' ? 'text-sky-200'
                : stats.weatherIntensity === 'flurries' ? 'text-slate-200'
                : 'text-amber-200'
              }`}>{stats.weatherLabel}</span>
            </div>
            <span className={`font-mono-num font-bold shrink-0 ${
              stats.roadGripPercent >= 75 ? 'text-emerald-400'
              : stats.roadGripPercent >= 60 ? 'text-amber-300'
              : 'text-red-400'
            }`}>
              Grip {stats.roadGripPercent}%
            </span>
          </div>
        </div>

        {/* Top-Center: callout toasts — hidden on xs, visible from sm */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 pt-1 flex-1 min-w-0">
          {stats.policeChaseActive && (
            <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-4 py-1.5 rounded-lg border bg-[#161e2e]/95 border-red-500/75 text-red-200 font-display font-bold text-xs shadow-lg">
              <Siren className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 shrink-0" />
              <span>Police!</span>
              <span className="font-mono-num text-amber-300">-{stats.pendingFine}</span>
              <span className="font-mono-num text-sky-300">{stats.policeChaseRemaining.toFixed(1)}s</span>
            </div>
          )}
          {visibleCallout && (
            <div className={`px-3 py-1.5 rounded-lg border font-display font-bold text-xs sm:text-sm shadow-lg transition-opacity duration-200 ${
              visibleCallout.accent === 'amber'
                ? 'bg-[#161e2e]/95 border-amber-400/60 text-amber-300'
                : 'bg-[#161e2e]/95 border-sky-400/60 text-sky-300'
            }`}>
              {visibleCallout.text}
            </div>
          )}
        </div>

        {/* Top-Right: compact icon-only buttons on mobile, labelled on sm+ */}
        <div className="flex items-start gap-1 sm:gap-2">
          {/* Combo + Coins — combined into one tiny pill on xs */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Combo: icon-only on xs */}
            <div className="bg-[#0f1622]/88 border border-white/12 rounded-lg px-2 py-1.5 sm:px-3.5 sm:py-2.5 sm:min-w-[90px]">
              <div className="flex items-center sm:items-baseline justify-between gap-1">
                <span className="hidden sm:inline text-xs text-slate-400">Combo</span>
                <span className={`font-mono-num font-bold text-xs sm:text-base ${
                  stats.comboMultiplier >= 4 ? 'text-amber-400'
                  : stats.comboMultiplier >= 2 ? 'text-sky-400'
                  : 'text-slate-200'
                }`}>{stats.comboMultiplier}x</span>
              </div>
              <div className="hidden sm:block h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-amber-400 transition-[width] duration-100"
                  style={{ width: `${Math.round(stats.comboTimerRatio * 100)}%` }} />
              </div>
            </div>

            {/* Coins */}
            <div className="bg-[#0f1622]/88 border border-white/12 rounded-lg px-2 py-1.5 sm:px-3.5 sm:py-2.5">
              <div className="hidden sm:block text-xs text-slate-400">Coins</div>
              <div className="font-mono-num font-bold text-xs sm:text-base text-amber-400">
                {savedCoins + stats.coinsEarnedThisRun}
              </div>
            </div>
          </div>

          {/* Action icon buttons */}
          <div className="flex items-center gap-1 pointer-events-auto">
            {/* Camera — icon only on xs */}
            <button type="button" onClick={onCycleCameraMode} title="Switch camera (C)"
              className="p-2 sm:flex sm:items-center sm:gap-1.5 sm:px-3 sm:py-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 text-xs font-medium transition-colors cursor-pointer">
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">
                {cameraMode === 'cab' ? 'Cab' : cameraMode === 'chase' ? 'Chase' : 'Iso'}
              </span>
            </button>

            {/* Steering mode — only on sm+ */}
            {cameraMode === 'isometric' && (
              <button type="button" onClick={onToggleSteeringMode}
                title={`Steering: ${steeringMode === 'camera' ? 'Camera-Relative' : 'Truck-Relative'}`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 text-xs font-medium transition-colors cursor-pointer">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>{steeringMode === 'camera' ? 'Cam' : 'Truck'}</span>
              </button>
            )}

            {/* Shop icon */}
            <button type="button" onClick={() => onOpenShop(stats.nearbyShop?.id)} title="Shops"
              className="p-2 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-emerald-400/35 text-emerald-300 transition-colors cursor-pointer">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {/* Garage icon */}
            <button type="button" onClick={onOpenGarage} title="Garage"
              className="p-2 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
            </button>

            {/* Mute */}
            <button type="button" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}
              className="p-2 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer">
              {muted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            {/* Pause */}
            <button type="button" onClick={onOpenPause} title="Pause (Esc)"
              className="p-2 rounded-xl bg-[#0f1622]/88 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer">
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Police alert on xs (top-center was hidden) */}
      {stats.policeChaseActive && (
        <div className="sm:hidden flex justify-center mt-1 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg border bg-[#161e2e]/95 border-red-500/75 text-red-200 font-display font-bold text-xs shadow-lg">
            <Siren className="w-3 h-3 text-red-400" />
            <span>Police! -{stats.pendingFine} · {stats.policeChaseRemaining.toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* ── BOTTOM ROW ── */}
      <div className="flex items-end justify-between gap-2">

        {/* Left: joystick or keyboard hint */}
        {isTouchDevice ? (
          <div className="pointer-events-auto flex items-end gap-2">
            <VirtualJoystick onSteer={onTouchSteer} size={Math.min(120, Math.round(window.innerWidth * 0.28))} />
            <button
              type="button"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onTouchBoost(); }}
              className="mb-1 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-sky-500/20 border-2 border-sky-400/50 flex flex-col items-center justify-center text-sky-300 text-[9px] sm:text-[10px] font-bold active:bg-sky-500/40 select-none"
              style={{ touchAction: 'none' }}
              aria-label="Boost"
            >
              <span className="text-base sm:text-lg leading-none">⚡</span>
              <span>BOOST</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-300/80 bg-[#0f1622]/80 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap">
            WASD · Space Boost · E Shop · C Cam · Esc Pause
          </div>
        )}

        {/* Center / right: nearby shop prompt + boost gauge + finish shift */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {stats.nearbyShop && (
            <button type="button" onClick={() => onOpenShop(stats.nearbyShop?.id)}
              className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs shadow-lg shadow-emerald-600/25 transition-colors whitespace-nowrap cursor-pointer">
              <Store className="w-3.5 h-3.5 shrink-0" />
              {/* Show full label on sm+, icon-only on xs */}
              <span className="hidden sm:inline">Open {stats.nearbyShop.name}</span>
              <span className="sm:hidden">Shop</span>
              <span className="flex items-center gap-1 font-mono-num text-emerald-100 bg-black/25 px-1 py-0.5 rounded text-[10px]">
                <Users className="w-2.5 h-2.5" />
                {stats.nearbyShop.crowdCount}
              </span>
            </button>
          )}

          {/* Boost gauge — narrower on mobile */}
          <button type="button" onClick={onTouchBoost}
            className="pointer-events-auto flex items-center gap-2 bg-[#0f1622]/90 border border-white/12 rounded-xl px-2.5 sm:px-3.5 py-2 cursor-pointer hover:bg-[#1a2436] transition-colors">
            <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${stats.boostEnergy >= 0.35 ? 'text-sky-400' : 'text-slate-500'}`} />
            <div className="w-14 sm:w-24">
              <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-300 mb-1">
                <span>Boost</span>
                <span className="font-mono-num">{Math.round(stats.boostEnergy * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-[width] duration-100 ${stats.isBoosting ? 'bg-amber-400' : 'bg-sky-400'}`}
                  style={{ width: `${Math.round(stats.boostEnergy * 100)}%` }} />
              </div>
            </div>
          </button>

          {stats.contractReadyToFinish && (
            <button type="button" onClick={onFinishShift}
              className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-colors whitespace-nowrap cursor-pointer">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Finish Shift (F)</span>
              <span className="sm:hidden">Finish</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
