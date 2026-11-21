import React, { useCallback, useRef, useEffect } from 'react';

interface VirtualJoystickProps {
  /** Called every frame with normalized x/y in [-1, 1]. Called with 0,0 on release. */
  onSteer: (x: number, y: number) => void;
  /** Outer radius in px */
  size?: number;
}

/**
 * A single-touch virtual joystick.
 * Uses pointer events so it works on both touch screens and mouse (for testing).
 * The knob tracks the finger up to `deadRadius` before the base follows (floating base).
 */
export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onSteer, size = 110 }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  // Mutable state — no re-renders needed for position tracking
  const state = useRef({
    active: false,
    pointerId: -1,
    // base center in page coords (floats toward finger)
    baseCX: 0,
    baseCY: 0,
    // current knob offset from base, in px
    kx: 0,
    ky: 0,
  });

  const maxRadius = size * 0.38; // knob travel radius
  const knobSize  = size * 0.38; // knob diameter

  const updateKnobDOM = useCallback((kx: number, ky: number) => {
    if (!knobRef.current) return;
    knobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.current.active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    state.current.active    = true;
    state.current.pointerId = e.pointerId;
    state.current.baseCX    = rect.left + rect.width  / 2;
    state.current.baseCY    = rect.top  + rect.height / 2;
    state.current.kx        = 0;
    state.current.ky        = 0;
    updateKnobDOM(0, 0);
  }, [updateKnobDOM]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;

    const dx = e.clientX - s.baseCX;
    const dy = e.clientY - s.baseCY;
    const dist = Math.hypot(dx, dy);

    let kx: number, ky: number;
    if (dist <= maxRadius) {
      kx = dx;
      ky = dy;
    } else {
      // clamp knob to rim
      kx = (dx / dist) * maxRadius;
      ky = (dy / dist) * maxRadius;
    }

    s.kx = kx;
    s.ky = ky;
    updateKnobDOM(kx, ky);

    // Normalize: Y axis — up is negative on screen, but we want forward = +1
    const normX =  kx / maxRadius;
    const normY = -ky / maxRadius;

    // Dead zone
    const mag = Math.hypot(normX, normY);
    if (mag < 0.08) {
      onSteer(0, 0);
    } else {
      onSteer(normX, normY);
    }
  }, [maxRadius, onSteer, updateKnobDOM]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== state.current.pointerId) return;
    state.current.active    = false;
    state.current.pointerId = -1;
    state.current.kx        = 0;
    state.current.ky        = 0;
    updateKnobDOM(0, 0);
    onSteer(0, 0);
  }, [onSteer, updateKnobDOM]);

  // Release on pointercancel, window blur, or page visibility change (e.g. app switch mid-drag)
  useEffect(() => {
    const reset = () => {
      if (!state.current.active) return;
      state.current.active    = false;
      state.current.pointerId = -1;
      updateKnobDOM(0, 0);
      onSteer(0, 0);
    };
    const cancelPointer = (e: PointerEvent) => {
      if (e.pointerId === state.current.pointerId) reset();
    };
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [onSteer, updateKnobDOM]);

  return (
    <div
      ref={outerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: size, height: size, touchAction: 'none', userSelect: 'none' }}
      className="relative flex items-center justify-center rounded-full bg-white/5 border-2 border-white/20 cursor-pointer select-none"
      aria-label="Virtual joystick"
    >
      {/* Direction hints */}
      <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold pointer-events-none select-none">▲</span>
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold pointer-events-none select-none">▼</span>
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40 font-bold pointer-events-none select-none">◀</span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40 font-bold pointer-events-none select-none">▶</span>

      {/* Knob */}
      <div
        ref={knobRef}
        style={{ width: knobSize, height: knobSize, willChange: 'transform' }}
        className="rounded-full bg-white/25 border border-white/40 shadow-lg pointer-events-none select-none"
      />
    </div>
  );
};
