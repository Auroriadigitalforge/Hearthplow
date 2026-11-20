# Hearthplow

A 3D winter snow-plowing game set across golden-twilight alpine neighborhoods and bustling village squares. Clear snowbound roads, carve through dynamic snow berms, dodge winter pedestrians, visit open city shops, upgrade your rig in the garage, and adapt your driving to changing blizzards and road traction.

---
# Try our Game
https://heartplow.ai.studio/

## Features

- **Dynamic Snow Deformation & Berm Physics**: Real-time heightfield snow grid with curb and driveway pile-ups. Heavy banks slow stock blades down—hit **Boost** to breach deep snow ridges with hitstop and particle bursts.
- **Dynamic Weather & Tire Traction Physics**: Shifts smoothly across **Clear Twilight**, **Light Flurries**, **Steady Snowfall**, and **Heavy Blizzard**. Storm states adjust snowflake density, wind gusts, atmospheric fog, procedural wind audio, and 2D longitudinal/lateral tire grip. Cleared asphalt offers stronger traction than unplowed snow, and tire-chain upgrades improve icy cornering.
- **Three Live Camera Perspectives**: Toggle anytime (`C` key or HUD button) between **Isometric** view, **Top-Chase** angled roof view, and **Cab View** (1st-person driver perspective looking over the hood and plow blade).
- **Four Neighborhood Contracts (Normal & Hard)**:
  1. **Maple Hollow Lane** *(Normal — 85% target)*: Cozy evening lane with two open shops and light powder.
  2. **Pinecrest Cul-de-Sac** *(Normal — 85% target)*: Twin-loop avenue circling village shops and lantern green.
  3. **Timberline Ridge** *(Hard — 90% target)*: Deep snow drifts, icy corners, denser crowds, and frequent blizzards.
  4. **Summit Village Square** *(Hard — 92% target)*: Severe storm across a four-shop market ring with heavy snowfall.
- **Living Winter Village, Open Shops & Police Enforcement**:
  - Porch residents and bundled-up villagers walk sidewalks and gather around open **bakeries, cafes, markets, and hardware shops**.
  - Clear a shop's front apron and press `E` (or click **Shops**) to collect clearing tips, buy **Hot Cocoa** (temporary boost recharge surge), or buy **Salt Bags** (instant bonus clearing pass).
  - Hitting pedestrians triggers a **Police Chase** (`100` coins fine per villager hit). If caught, an arrest sequence plays, fines are deducted from your coins, and progression resets to Level 1.
- **Modular Garage Upgrades**: Spend earned coins on **Modular Plow Blade** (wider sweep & berm push), **V8 Torque & Chains** (speed & icy road grip), **Rear Salt Spreader** (melts trailing snow), and **Beacon & Combo Rig** (longer combo window & faster boost recharge).
- **Procedural Web Audio Synth**: Real-time synthesized engine hum, blade scrape, snow crunch, chime combos, police sirens, and dynamic storm wind bed with mute toggle.

---

## Controls

| Action | Keys / Input |
| :--- | :--- |
| Drive / Steer | `W` `A` `S` `D` or Arrow Keys (touch D-pad on mobile) |
| Boost / Breach Berms | `Space` or `Shift` |
| Switch Camera (`Isometric` / `Top-Chase` / `Cab View`) | `C` or HUD Camera button |
| Open Nearby Shop | `E` or HUD **Shops** button |
| Finish Shift (once target % cleared) | `F` or HUD **Finish Shift** button |
| Pause / Resume | `Esc` |

You can also toggle between **Camera-Relative** and **Truck-Relative** steering directly in the HUD (automatically locks to Truck-Relative while in Cab or Top-Chase view).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **3D Engine & Rendering**: Three.js (custom snow heightfield mesh, instanced snow/exhaust/spray particles, dynamic lighting & shadows)
- **Audio**: Web Audio API procedural synthesizer
- **Build & Tooling**: Vite 8, `tsc`

---

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)

### Installation & Development

```bash
# Install dependencies
npm install

# Start the development server on http://localhost:3000
npm run dev
```

### Other Scripts

```bash
# Type-check with TypeScript
npm run lint

# Build production bundle into dist/
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```text
src/
├── App.tsx                   # Top-level game phase, save state, shop/garage/modal orchestration
├── index.css                 # Tailwind v4 setup and typography utilities
├── components/
│   ├── TitleScreen.tsx       # Contract selector, difficulty badges, and garage entry
│   ├── HudOverlay.tsx        # Clear %, weather & road grip readout, camera/shop/boost controls
│   └── Modals.tsx            # Garage upgrades, city shop storefront modal, pause, victory & arrest screens
└── game/
    ├── engine.ts             # Core Three.js loop, 2D road friction physics, weather transitions, police chase
    ├── snowField.ts          # Dynamic heightfield grid, plowing, berm displacement & priority zone checks
    ├── worldBuilder.ts       # Procedural roads, cottages, open shops, lamps, trees & decorations
    ├── npcManager.ts         # Porch/walking villagers, shop crowds, police cruiser & arrest officer animation
    ├── truckModel.ts         # Modular 3D plow truck with visual blade, spreader & beacon tier upgrades
    ├── particles.ts          # Instanced snowfall, plow spray, tire slip spray, chimney & exhaust smoke
    ├── soundEngine.ts        # Procedural Web Audio engine, snow scrape, siren & weather wind audio
    └── types.ts              # Contracts, upgrade definitions, weather types & localStorage persistence
```
