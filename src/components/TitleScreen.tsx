import React, { useEffect } from 'react';
import { Volume2, VolumeX, Wrench, Star, Lock, Play } from 'lucide-react';
import { CONTRACTS, PlayerSaveState } from '../game/types';

interface TitleScreenProps {
  saveState: PlayerSaveState;
  selectedContractIndex: number;
  onSelectContract: (index: number) => void;
  onStartShift: () => void;
  onOpenGarage: () => void;
  onToggleMute: () => void;
  onToggleSteeringMode: () => void;
  onCycleCameraMode: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saveState,
  selectedContractIndex,
  onSelectContract,
  onStartShift,
  onOpenGarage,
  onToggleMute,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartShift();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStartShift]);

  const activeContract = CONTRACTS[selectedContractIndex] ?? CONTRACTS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-6 md:p-10 pointer-events-none overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className="flex items-start justify-between gap-2">

        {/* Logo — scales fluidly */}
        <div className="pointer-events-auto min-w-0">
          <svg
            viewBox="0 0 380 86"
            className="w-44 sm:w-64 md:w-80 h-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.65)]"
            aria-label="Hearthplow"
            role="img"
          >
            <g transform="translate(4, 10)">
              <path d="M6 48 L22 18 L48 18 L36 48 Z" fill="#F59E0B" stroke="#FDE68A" strokeWidth="2" strokeLinejoin="round" />
              <path d="M2 52 L42 52" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="48" cy="14" r="3.5" fill="#38BDF8" />
            </g>
            <text x="66" y="50" fill="#F8FAFC" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="42" letterSpacing="-1">
              Hearthplow
            </text>
            <text x="68" y="72" fill="#CBD5E1" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="500" fontSize="13.5" letterSpacing="0.4">
              Twilight Snow-Clearing &amp; Neighborhood Routes
            </text>
          </svg>
        </div>

        {/* Top-right controls — only coins + garage + mute on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 pointer-events-auto shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#0f1622]/90 border border-white/12 text-xs sm:text-sm">
            <span className="text-amber-400 font-semibold">Coins</span>
            <span className="font-mono-num font-bold text-white">{saveState.coins}</span>
          </div>
          <button type="button" onClick={onOpenGarage}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#0f1622]/90 hover:bg-[#1a2436] border border-white/12 text-slate-100 text-xs sm:text-sm font-medium transition-colors cursor-pointer">
            <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="hidden sm:inline">Garage</span>
          </button>
          <button type="button" onClick={onToggleMute} aria-label={saveState.muted ? 'Unmute' : 'Mute'}
            className="p-2 sm:p-2.5 rounded-lg bg-[#0f1622]/90 hover:bg-[#1a2436] border border-white/12 text-slate-200 transition-colors cursor-pointer">
            {saveState.muted
              ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* ── BOTTOM LAUNCH PANEL ── */}
      <div className="pointer-events-auto w-full bg-[#0f1622]/90 border border-white/12 rounded-xl p-3 sm:p-5 shadow-2xl">

        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <span className="text-[10px] sm:text-xs font-medium text-slate-400">Select Route</span>
          <span className="text-[10px] sm:text-xs font-mono-num text-amber-400">
            Target {activeContract.targetPercent}% · {activeContract.baseReward} Coins
          </span>
        </div>

        {/* Contract grid — 2 cols on xs, 4 on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          {CONTRACTS.map((c, idx) => {
            const unlocked = idx <= saveState.unlockedContractIndex;
            const selected = idx === selectedContractIndex;
            const stars = saveState.contractStars[c.id] || 0;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!unlocked}
                onClick={() => onSelectContract(idx)}
                className={`flex flex-col items-start p-2 sm:p-2.5 rounded-lg border text-left transition-colors ${
                  selected
                    ? 'bg-amber-500/18 border-amber-400/70 text-white'
                    : unlocked
                    ? 'bg-slate-900/70 hover:bg-slate-800/80 border-white/10 text-slate-200 cursor-pointer'
                    : 'bg-slate-950/60 border-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1">
                    <span className="font-mono-num text-[10px] sm:text-xs font-semibold">0{idx + 1}</span>
                    {c.difficulty === 'hard' && (
                      <span className="px-1 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-[8px] sm:text-[9px] font-bold text-red-300 leading-none">
                        HARD
                      </span>
                    )}
                  </div>
                  {unlocked ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star key={s} className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                      ))}
                    </div>
                  ) : (
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-600" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-semibold truncate w-full">{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected contract info + Start button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 sm:pt-3 border-t border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display text-sm sm:text-lg font-bold text-white truncate">{activeContract.name}</div>
              {activeContract.difficulty === 'hard' && (
                <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-[9px] sm:text-[10px] font-bold text-red-300 shrink-0">
                  HARD
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed line-clamp-2">{activeContract.subtitle}</p>
          </div>
          <button type="button" onClick={onStartShift}
            className="flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display font-bold text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-amber-500/20">
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950" />
            <span>Start Shift</span>
          </button>
        </div>
      </div>
    </div>
  );
};
