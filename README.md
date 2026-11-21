# Hearthplow

A 3D winter snow-plowing game set across golden-twilight alpine neighborhoods and bustling village squares. Clear snowbound roads, carve through dynamic snow berms, dodge winter pedestrians, visit open city shops, upgrade your rig in the garage, and adapt your driving to changing blizzards and road traction.

---

## Play Now

[**Play on itch.io →**](https://auroria-digital-forge.itch.io/hearthplow)

Runs entirely in the browser — no install needed. Fully playable on desktop and mobile.

---

## Features

- **Dynamic Snow Deformation & Berm Physics**: Real-time heightfield snow grid with curb and driveway pile-ups. Heavy banks slow stock blades down — hit **Boost** to breach deep snow ridges with hitstop and particle bursts.
- **Dynamic Weather & Tire Traction Physics**: Shifts smoothly across **Clear Twilight**, **Light Flurries**, **Steady Snowfall**, and **Heavy Blizzard**. Storm states adjust snowflake density, wind gusts, atmospheric fog, procedural wind audio, and 2D longitudinal/lateral tire grip. Cleared asphalt offers stronger traction than unplowed snow, and tire-chain upgrades improve icy cornering.
- **Three Live Camera Perspectives**: Toggle anytime (`C` key or HUD button) between **Isometric** view, **Top-Chase** angled roof view, and **Cab View** (1st-person driver perspective looking over the hood and plow blade).
- **Four Neighborhood Contracts (Normal & Hard)**:
  1. **Maple Hollow Lane** *(Normal — 85% target)*: Cozy evening lane with two open shops and light powder.
  2. **Pinecrest Cul-de-Sac** *(Normal — 85% target)*: Twin-loop avenue circling village shops and lantern green.
  3. **Timberline Ridge** *(Hard — 90% target)*: Deep snow drifts, icy corners, denser crowds, and frequent blizzards.
  4. **Summit Village Square** *(Hard — 92% target)*: Severe storm across a four-shop market ring with heavy snowfall.
- **Living Winter Village, Open Shops & Police Enforcement**:
  - Porch residents and bundled-up villagers walk sidewalks and gather around open **bakeries, cafes, markets, and hardware shops**.
  - Clear a shop's front apron and press `E` (or tap **Shops**) to collect clearing tips, buy **Hot Cocoa** (temporary boost recharge surge), or buy **Salt Bags** (instant bonus clearing pass).
  - Hitting pedestrians triggers a **Police Chase** (100 coins fine per villager hit). If caught, an arrest sequence plays, fines are deducted from your coins, and progression resets to Level 1.
- **Modular Garage Upgrades**: Spend earned coins on **Modular Plow Blade** (wider sweep & berm push), **V8 Torque & Chains** (speed & icy road grip), **Rear Salt Spreader** (melts trailing snow), and **Beacon & Combo Rig** (longer combo window & faster boost recharge).
- **Procedural Web Audio Synth**: Real-time synthesized engine hum, blade scrape, snow crunch, chime combos, police sirens, and dynamic storm wind bed with mute toggle.
- **Full Mobile Support**: Responsive layout across all screen sizes. On touch devices a floating **virtual joystick** replaces the D-pad — full analog steering with diagonal movement — alongside a dedicated Boost button. The Three.js canvas resizes correctly on iOS Safari when the address bar hides or shows.

---

## Controls

### Desktop (Keyboard)

| Action | Input |
| :--- | :--- |
| Drive / Steer | `W` `A` `S` `D` or Arrow Keys |
| Boost / Breach Berms | `Space` |
| Switch Camera | `C` |
| Open Nearby Shop | `E` |
| Finish Shift | `F` (once target % cleared) |
| Pause / Resume | `Esc` |

You can also toggle between **Camera-Relative** and **Truck-Relative** steering in the HUD (automatically locks to Truck-Relative in Cab and Top-Chase views).

### Mobile (Touch)

| Action | Input |
| :--- | :--- |
| Drive / Steer | Virtual joystick (bottom-left) |
| Boost | Boost button next to joystick, or the Boost gauge button |
| Switch Camera | Camera button (top-right HUD) |
| Open Shop | Shop button (top-right HUD) or nearby shop prompt |
| Finish Shift | Finish button (bottom-right, appears when target % cleared) |
| Pause | Pause button (top-right HUD) |

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **3D Engine & Rendering**: Three.js r187 — custom snow heightfield mesh, instanced snow/exhaust/spray particles, PCF shadow maps, dynamic lighting
- **Audio**: Web Audio API procedural synthesizer (zero audio files)
- **Mobile Input**: Pointer Events API virtual joystick with analog X/Y output, dead zone, and blur/visibilitychange cleanup
- **Build & Tooling**: Vite 8, `tsc`
- **Distribution**: Static HTML/CSS/JS bundle — deployable to itch.io or any static host

---

## Getting Started

### Prerequisites

- Node.js 18+

### Installation & Development

```bash
# Install dependencies (use --legacy-peer-deps to resolve esbuild peer conflict with Vite 8)
npm install --legacy-peer-deps

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

### Building for itch.io

After `npm run build`, the `dist/` folder contains the complete static bundle. Zip it with **forward-slash paths** (required for itch.io's Linux servers):

```powershell
# PowerShell — creates hearthplow-itch.zip with correct forward-slash entry paths
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("hearthplow-itch.zip", [IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem -Path dist -Recurse -File | ForEach-Object {
    $entry = $_.FullName.Substring("$PWD\dist\".Length).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()
```

Upload `hearthplow-itch.zip` to itch.io as an **HTML** project, check **"This file will be played in the browser"**, and set the viewport to **1280×720** with the fullscreen button enabled.

---

## Project Structure

```text
src/
├── App.tsx                       # Top-level game phase, save state, shop/garage/modal orchestration
├── index.css                     # Tailwind v4 setup and typography utilities
├── main.tsx                      # React root mount
├── components/
│   ├── TitleScreen.tsx           # Contract selector, difficulty badges, garage entry — responsive mobile layout
│   ├── HudOverlay.tsx            # Clear %, weather & road grip readout, camera/shop/boost controls — fully responsive
│   ├── VirtualJoystick.tsx       # Pointer Events analog joystick for mobile steering (no React re-renders during drag)
│   └── Modals.tsx                # Garage upgrades, city shop storefront, pause, victory & arrest screens — mobile scrollable
└── game/
    ├── engine.ts                 # Core Three.js loop, 2D road friction physics, weather transitions, police chase, visualViewport resize
    ├── snowField.ts              # Dynamic heightfield grid, plowing, berm displacement & priority zone checks
    ├── worldBuilder.ts           # Procedural roads, cottages, open shops, lamps, trees & decorations
    ├── npcManager.ts             # Porch/walking villagers, shop crowds, police cruiser & arrest officer animation
    ├── truckModel.ts             # Modular 3D plow truck with visual blade, spreader & beacon tier upgrades
    ├── particles.ts              # Instanced snowfall, plow spray, tire slip spray, chimney & exhaust smoke
    ├── soundEngine.ts            # Procedural Web Audio engine, snow scrape, siren & weather wind audio
    └── types.ts                  # Contracts, upgrade definitions, weather types & localStorage persistence
```

---

## Known Issues & Fixes Applied

| Issue | Fix |
| :--- | :--- |
| `PCFSoftShadowMap` removed in Three.js r175+ | Switched to `PCFShadowMap` in `engine.ts` |
| `GL_INVALID_VALUE: glGetProgramiv` spam | Wrapped `renderer.compile()` in try/catch |
| itch.io 404 on assets (backslash zip paths) | Repacked zip with forward-slash entry names |
| iOS Safari canvas wrong size on address bar hide/show | Added `visualViewport` resize listener in engine |
| Mobile joystick stuck on app-switch mid-drag | Added `blur` and `visibilitychange` cleanup in `VirtualJoystick.tsx` |
