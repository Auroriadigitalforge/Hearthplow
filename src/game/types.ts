export type GamePhase =
  | 'title'
  | 'playing'
  | 'paused'
  | 'garage'
  | 'shop'
  | 'victory'
  | 'arresting'
  | 'arrested';

export const FINE_PER_NPC = 100;

export type DifficultyMode = 'normal' | 'hard';

export interface ShopSpec {
  id: string;
  name: string;
  category: 'bakery' | 'hardware' | 'market' | 'cafe';
  x: number;
  z: number;
  rotY: number;
  awningColor: number;
  wallColor: number;
  crowdSize: number;
}

export type UpgradeKey = 'blade' | 'engine' | 'spreader' | 'beacon';

export interface UpgradeLevels {
  blade: number; // 0..3
  engine: number; // 0..3
  spreader: number; // 0..3
  beacon: number; // 0..3
}

export interface UpgradeConfig {
  key: UpgradeKey;
  name: string;
  shortTag: string;
  description: string;
  maxLevel: number;
  costs: number[];
  tierNames: string[];
  statLabel: (level: number) => string;
}

export const UPGRADE_CONFIGS: UpgradeConfig[] = [
  {
    key: 'blade',
    name: 'Modular Plow Blade',
    shortTag: 'Width & Sweep',
    description: 'Widens front plow span and pushes deeper berms in one pass.',
    maxLevel: 3,
    costs: [120, 260, 480],
    tierNames: ['Stock Steel', 'Wide Timberline', 'Angled V-Plow', 'Winged Municipal'],
    statLabel: (lvl) => `${(2.6 + lvl * 0.65).toFixed(1)}m Span`,
  },
  {
    key: 'engine',
    name: 'V8 Torque & Chains',
    shortTag: 'Speed & Grip',
    description: 'Boosts top speed, snow-drift power, and tight corner handling.',
    maxLevel: 3,
    costs: [110, 240, 440],
    tierNames: ['Vintage Inline-6', 'Chained All-Wheel', 'Twin-Carb V8', 'Alpine Turbo Rig'],
    statLabel: (lvl) => `${Math.round(100 + lvl * 22)}% Torque`,
  },
  {
    key: 'spreader',
    name: 'Rear Salt Spreader',
    shortTag: 'Melt Trail',
    description: 'Mounts a rear spinner that melts residual edge snow behind the truck.',
    maxLevel: 3,
    costs: [140, 290, 520],
    tierNames: ['None Fitted', 'Compact Hopper', 'Dual-Spinner', 'Heated Brine Jet'],
    statLabel: (lvl) => (lvl === 0 ? 'Inactive' : `${(1.3 + lvl * 0.55).toFixed(1)}m Melt`),
  },
  {
    key: 'beacon',
    name: 'Beacon & Combo Rig',
    shortTag: 'Combo & Boost',
    description: 'Extends combo grace timer, recharges boost faster, and brightens beacons.',
    maxLevel: 3,
    costs: [100, 220, 410],
    tierNames: ['Amber Dome', 'Halogen Bar', 'Dual Strobe Rack', 'Aurora Flood Rig'],
    statLabel: (lvl) => `${(2.8 + lvl * 0.65).toFixed(1)}s Hold`,
  },
];

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  halfWidth: number;
  surface: 'asphalt' | 'cobble';
}

export interface RoadCircle {
  x: number;
  z: number;
  radius: number;
  surface: 'asphalt' | 'cobble';
}

export interface CottageSpec {
  x: number;
  z: number;
  rotY: number;
  roofColor: number;
  wallColor: number;
  scale?: number;
}

export interface PriorityZoneSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  kind: 'mailbox' | 'hydrant' | 'lantern';
  bonusCoins: number;
}

export interface ContractDefinition {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  difficulty: DifficultyMode;
  targetPercent: number;
  masteryPercent: number;
  parTimeSeconds: number;
  baseReward: number;
  snowDepthScale: number;
  spawn: { x: number; z: number; rotY: number };
  roads: RoadSegment[];
  circles: RoadCircle[];
  cottages: CottageSpec[];
  shops: ShopSpec[];
  priorityZones: PriorityZoneSpec[];
  lampCoords: Array<{ x: number; z: number }>;
}

export const CONTRACTS: ContractDefinition[] = [
  {
    id: 'maple-lane',
    index: 0,
    name: 'Maple Hollow Lane',
    subtitle: 'Quiet evening lane with cozy cottages, two open village shops, and gentle powder.',
    difficulty: 'normal',
    targetPercent: 85,
    masteryPercent: 95,
    parTimeSeconds: 95,
    baseReward: 160,
    snowDepthScale: 0.85,
    spawn: { x: -21, z: 0, rotY: Math.PI / 2 },
    roads: [
      { x1: -24, z1: 0, x2: 22, z2: 0, halfWidth: 3.4, surface: 'asphalt' },
      { x1: -12, z1: 0, x2: -12, z2: -13, halfWidth: 2.3, surface: 'cobble' },
      { x1: 6, z1: 0, x2: 6, z2: -13, halfWidth: 2.3, surface: 'cobble' },
      { x1: -4, z1: 0, x2: -4, z2: 13, halfWidth: 2.3, surface: 'cobble' },
      { x1: 14, z1: 0, x2: 14, z2: 13, halfWidth: 2.3, surface: 'cobble' },
    ],
    circles: [{ x: 22, z: 0, radius: 5.5, surface: 'asphalt' }],
    cottages: [
      { x: -12, z: -18.5, rotY: 0, roofColor: 0x4f352d, wallColor: 0xd9cbb8 },
      { x: 6, z: -18.5, rotY: 0, roofColor: 0x2e4052, wallColor: 0xc9b49a },
      { x: -4, z: 18.5, rotY: Math.PI, roofColor: 0x5d3328, wallColor: 0xe0d2be },
      { x: 14, z: 18.5, rotY: Math.PI, roofColor: 0x354739, wallColor: 0xd4c2aa },
    ],
    shops: [
      {
        id: 'shop-maple-bakery',
        name: 'Hearthside Bakery',
        category: 'bakery',
        x: 5,
        z: 7.4,
        rotY: Math.PI,
        awningColor: 0xc2410c,
        wallColor: 0xe7d6c1,
        crowdSize: 4,
      },
      {
        id: 'shop-maple-cafe',
        name: 'Maple Cocoa Stand',
        category: 'cafe',
        x: -15,
        z: 7.4,
        rotY: Math.PI,
        awningColor: 0x0f766e,
        wallColor: 0xd9cbb8,
        crowdSize: 3,
      },
    ],
    priorityZones: [
      { id: 'm1', label: 'Oak Hearth Driveway', x: -12, z: -11, radius: 3.0, kind: 'mailbox', bonusCoins: 28 },
      { id: 'm2', label: 'North Pine Hydrant', x: 6, z: -11, radius: 3.0, kind: 'hydrant', bonusCoins: 28 },
      { id: 'm3', label: 'South Porch Walk', x: -4, z: 11, radius: 3.0, kind: 'mailbox', bonusCoins: 28 },
      { id: 'm4', label: 'East Turnaround', x: 22, z: 0, radius: 3.8, kind: 'lantern', bonusCoins: 35 },
    ],
    lampCoords: [
      { x: -18, z: -4.6 },
      { x: -2, z: -4.6 },
      { x: 12, z: -4.6 },
      { x: 22, z: 6.4 },
    ],
  },
  {
    id: 'pinecrest-loop',
    index: 1,
    name: 'Pinecrest Cul-de-Sac',
    subtitle: 'Scenic twin-loop street circling bustling winter shops and lantern green.',
    difficulty: 'normal',
    targetPercent: 85,
    masteryPercent: 95,
    parTimeSeconds: 120,
    baseReward: 220,
    snowDepthScale: 1.0,
    spawn: { x: -24, z: 0, rotY: Math.PI / 2 },
    roads: [
      { x1: -26, z1: 0, x2: -10, z2: 0, halfWidth: 3.2, surface: 'asphalt' },
      { x1: -10, z1: 0, x2: 0, z2: -12, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 0, z1: -12, x2: 14, z2: -12, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 14, z1: -12, x2: 20, z2: 0, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 20, z1: 0, x2: 14, z2: 12, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 14, z1: 12, x2: 0, z2: 12, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 0, z1: 12, x2: -10, z2: 0, halfWidth: 3.0, surface: 'asphalt' },
      { x1: 7, z1: -12, x2: 7, z2: -21, halfWidth: 2.2, surface: 'cobble' },
      { x1: 7, z1: 12, x2: 7, z2: 21, halfWidth: 2.2, surface: 'cobble' },
    ],
    circles: [
      { x: 20, z: 0, radius: 5.0, surface: 'cobble' },
      { x: -10, z: 0, radius: 4.0, surface: 'asphalt' },
    ],
    cottages: [
      { x: 7, z: -26.5, rotY: 0, roofColor: 0x3b4858, wallColor: 0xdccbb5 },
      { x: 7, z: 26.5, rotY: Math.PI, roofColor: 0x5c362c, wallColor: 0xd1bea4 },
      { x: -16, z: -15, rotY: 0.45, roofColor: 0x384d3c, wallColor: 0xe3d5c1 },
      { x: 26.5, z: -8, rotY: -Math.PI / 2, roofColor: 0x533930, wallColor: 0xcab69d },
      { x: 26.5, z: 8, rotY: -Math.PI / 2, roofColor: 0x2e4052, wallColor: 0xd9cbb8 },
    ],
    shops: [
      {
        id: 'shop-pine-market',
        name: 'Pinecrest Market',
        category: 'market',
        x: 5,
        z: 0,
        rotY: Math.PI / 2,
        awningColor: 0xb45309,
        wallColor: 0xe2d3bd,
        crowdSize: 5,
      },
      {
        id: 'shop-pine-gear',
        name: 'Trailhead Gear',
        category: 'hardware',
        x: -19,
        z: 7.5,
        rotY: Math.PI,
        awningColor: 0x1d4ed8,
        wallColor: 0xcfc2ae,
        crowdSize: 4,
      },
    ],
    priorityZones: [
      { id: 'p1', label: 'North Ridge Drive', x: 7, z: -19, radius: 3.0, kind: 'mailbox', bonusCoins: 35 },
      { id: 'p2', label: 'South Hearth Drive', x: 7, z: 19, radius: 3.0, kind: 'mailbox', bonusCoins: 35 },
      { id: 'p3', label: 'East Lantern Plaza', x: 20, z: 0, radius: 3.8, kind: 'lantern', bonusCoins: 45 },
      { id: 'p4', label: 'West Fork Hydrant', x: -10, z: 0, radius: 3.2, kind: 'hydrant', bonusCoins: 35 },
    ],
    lampCoords: [
      { x: -17, z: -4.2 },
      { x: 7, z: -7.5 },
      { x: 7, z: 7.5 },
      { x: 24.5, z: 0 },
    ],
  },
  {
    id: 'timberline-ridge',
    index: 2,
    name: 'Timberline Ridge',
    subtitle: 'HARD: Blizzard drifts, icy corners, and busy downtown shops with heavy crowds.',
    difficulty: 'hard',
    targetPercent: 90,
    masteryPercent: 97,
    parTimeSeconds: 130,
    baseReward: 340,
    snowDepthScale: 1.48,
    spawn: { x: -24, z: -12, rotY: Math.PI / 2 },
    roads: [
      { x1: -26, z1: -12, x2: 24, z2: -12, halfWidth: 3.1, surface: 'asphalt' },
      { x1: -26, z1: 12, x2: 24, z2: 12, halfWidth: 3.1, surface: 'asphalt' },
      { x1: -14, z1: -12, x2: -14, z2: 12, halfWidth: 2.8, surface: 'asphalt' },
      { x1: 4, z1: -12, x2: 4, z2: 12, halfWidth: 2.8, surface: 'cobble' },
      { x1: 22, z1: -12, x2: 22, z2: 12, halfWidth: 2.8, surface: 'asphalt' },
      { x1: -4, z1: -12, x2: -4, z2: -22, halfWidth: 2.3, surface: 'cobble' },
      { x1: 14, z1: 12, x2: 14, z2: 22, halfWidth: 2.3, surface: 'cobble' },
    ],
    circles: [
      { x: 4, z: 0, radius: 5.2, surface: 'cobble' },
      { x: -24, z: 12, radius: 4.2, surface: 'asphalt' },
    ],
    cottages: [
      { x: -4, z: -27.5, rotY: 0, roofColor: 0x5c362c, wallColor: 0xe0d2be },
      { x: 14, z: -20, rotY: 0, roofColor: 0x354739, wallColor: 0xcab69d },
      { x: -20, z: 0, rotY: Math.PI / 2, roofColor: 0x2e4052, wallColor: 0xd9cbb8 },
      { x: 14, z: 27.5, rotY: Math.PI, roofColor: 0x4f352d, wallColor: 0xd4c2aa },
      { x: -6, z: 20, rotY: Math.PI, roofColor: 0x3b4858, wallColor: 0xdfd1bc },
    ],
    shops: [
      {
        id: 'shop-timber-hardware',
        name: 'Timberline Outfitters',
        category: 'hardware',
        x: 13.5,
        z: -4.4,
        rotY: Math.PI,
        awningColor: 0x1e40af,
        wallColor: 0xd7c7b2,
        crowdSize: 6,
      },
      {
        id: 'shop-timber-bakery',
        name: 'Alpine Cider Bakery',
        category: 'bakery',
        x: 13.5,
        z: 4.4,
        rotY: 0,
        awningColor: 0xb91c1c,
        wallColor: 0xe6d6c3,
        crowdSize: 6,
      },
      {
        id: 'shop-timber-cafe',
        name: 'Ridge Espresso Bar',
        category: 'cafe',
        x: -5.5,
        z: -4.4,
        rotY: Math.PI,
        awningColor: 0x0f766e,
        wallColor: 0xcab9a4,
        crowdSize: 5,
      },
    ],
    priorityZones: [
      { id: 't1', label: 'Summit Lodge Entry', x: -4, z: -20, radius: 3.0, kind: 'mailbox', bonusCoins: 42 },
      { id: 't2', label: 'Midtown Clock Square', x: 4, z: 0, radius: 4.0, kind: 'lantern', bonusCoins: 55 },
      { id: 't3', label: 'South Timber Drive', x: 14, z: 20, radius: 3.0, kind: 'mailbox', bonusCoins: 42 },
      { id: 't4', label: 'West Ridge Hydrant', x: -14, z: 0, radius: 3.0, kind: 'hydrant', bonusCoins: 42 },
      { id: 't5', label: 'East Pass Corner', x: 22, z: -12, radius: 3.2, kind: 'hydrant', bonusCoins: 42 },
    ],
    lampCoords: [
      { x: -18, z: -16 },
      { x: 14, z: -16 },
      { x: -18, z: 16 },
      { x: 26, z: 0 },
    ],
  },
  {
    id: 'summit-square',
    index: 3,
    name: 'Summit Village Square',
    subtitle: 'HARD: Severe snowstorm across the crowded city market ring and four open shops.',
    difficulty: 'hard',
    targetPercent: 92,
    masteryPercent: 98,
    parTimeSeconds: 150,
    baseReward: 460,
    snowDepthScale: 1.65,
    spawn: { x: 0, z: 24, rotY: 0 },
    roads: [
      { x1: 0, z1: -24, x2: 0, z2: 25, halfWidth: 3.0, surface: 'asphalt' },
      { x1: -24, z1: 0, x2: 24, z2: 0, halfWidth: 3.0, surface: 'asphalt' },
      { x1: -16, z1: -16, x2: 16, z2: -16, halfWidth: 2.7, surface: 'asphalt' },
      { x1: -16, z1: 16, x2: 16, z2: 16, halfWidth: 2.7, surface: 'asphalt' },
      { x1: -16, z1: -16, x2: -16, z2: 16, halfWidth: 2.7, surface: 'asphalt' },
      { x1: 16, z1: -16, x2: 16, z2: 16, halfWidth: 2.7, surface: 'asphalt' },
    ],
    circles: [
      { x: 0, z: 0, radius: 8.2, surface: 'cobble' },
      { x: -24, z: 0, radius: 4.5, surface: 'cobble' },
      { x: 24, z: 0, radius: 4.5, surface: 'cobble' },
      { x: 0, z: -24, radius: 4.5, surface: 'cobble' },
    ],
    cottages: [
      { x: -23, z: -22, rotY: 0.78, roofColor: 0x5c362c, wallColor: 0xe0d2be, scale: 1.08 },
      { x: 23, z: -22, rotY: -0.78, roofColor: 0x2e4052, wallColor: 0xd9cbb8, scale: 1.08 },
      { x: -23, z: 22, rotY: 2.35, roofColor: 0x354739, wallColor: 0xcab69d, scale: 1.08 },
      { x: 23, z: 22, rotY: -2.35, roofColor: 0x4f352d, wallColor: 0xd4c2aa, scale: 1.08 },
    ],
    shops: [
      {
        id: 'shop-summit-bakery',
        name: 'Summit Grand Bakery',
        category: 'bakery',
        x: -8.2,
        z: -22.8,
        rotY: 0,
        awningColor: 0xc2410c,
        wallColor: 0xeadac5,
        crowdSize: 7,
      },
      {
        id: 'shop-summit-cafe',
        name: 'Frostbite Roasters',
        category: 'cafe',
        x: 8.2,
        z: -22.8,
        rotY: 0,
        awningColor: 0x047857,
        wallColor: 0xd9cab6,
        crowdSize: 6,
      },
      {
        id: 'shop-summit-market',
        name: 'Snowpeak City Market',
        category: 'market',
        x: 22.8,
        z: -8.2,
        rotY: -Math.PI / 2,
        awningColor: 0xa16207,
        wallColor: 0xe0d0ba,
        crowdSize: 7,
      },
      {
        id: 'shop-summit-hardware',
        name: 'Apex Plow & Supply',
        category: 'hardware',
        x: -22.8,
        z: 8.2,
        rotY: Math.PI / 2,
        awningColor: 0x1d4ed8,
        wallColor: 0xd0c2ae,
        crowdSize: 6,
      },
    ],
    priorityZones: [
      { id: 's1', label: 'Grand Market Ring', x: 0, z: 0, radius: 5.5, kind: 'lantern', bonusCoins: 75 },
      { id: 's2', label: 'North Chalet Gate', x: 0, z: -22, radius: 3.4, kind: 'mailbox', bonusCoins: 48 },
      { id: 's3', label: 'West Depot Hydrant', x: -22, z: 0, radius: 3.4, kind: 'hydrant', bonusCoins: 48 },
      { id: 's4', label: 'East Depot Hydrant', x: 22, z: 0, radius: 3.4, kind: 'hydrant', bonusCoins: 48 },
      { id: 's5', label: 'Southwest Corner', x: -16, z: 16, radius: 3.2, kind: 'mailbox', bonusCoins: 48 },
    ],
    lampCoords: [
      { x: -10, z: -10 },
      { x: 10, z: -10 },
      { x: -10, z: 10 },
      { x: 10, z: 10 },
    ],
  },
];

export type SteeringMode = 'camera' | 'car';
export type CameraMode = 'isometric' | 'chase' | 'cab';

export interface PlayerSaveState {
  version: number;
  coins: number;
  upgrades: UpgradeLevels;
  contractStars: Record<string, number>;
  unlockedContractIndex: number;
  muted: boolean;
  steeringMode: SteeringMode;
  cameraMode: CameraMode;
}

export type WeatherIntensity = 'clear' | 'flurries' | 'snowfall' | 'blizzard';

export interface LiveShopStatus {
  id: string;
  name: string;
  category: ShopSpec['category'];
  crowdCount: number;
  apronCleared: boolean;
  tipClaimed: boolean;
}

export interface LiveRunStats {
  contractIndex: number;
  difficulty: DifficultyMode;
  clearPercent: number;
  targetPercent: number;
  masteryPercent: number;
  comboMultiplier: number;
  comboTimerRatio: number; // 0..1
  comboScoreStreak: number;
  peakCombo: number;
  coinsEarnedThisRun: number;
  boostEnergy: number; // 0..1
  isBoosting: boolean;
  elapsedSeconds: number;
  priorityCleared: number;
  priorityTotal: number;
  contractReadyToFinish: boolean;
  lastCallout: { id: number; text: string; accent: 'amber' | 'cyan' } | null;
  policeChaseActive: boolean;
  policeChaseRemaining: number;
  npcHitsCount: number;
  pendingFine: number;
  nearbyShop: LiveShopStatus | null;
  allShops: LiveShopStatus[];
  weatherIntensity: WeatherIntensity;
  weatherLabel: string;
  roadGripPercent: number;
}

export interface ArrestSummary {
  npcHitCount: number;
  finePerNpc: number;
  totalFine: number;
  coinsBefore: number;
  coinsAfter: number;
}

export interface VictorySummary {
  contract: ContractDefinition;
  clearPercent: number;
  starsEarned: number;
  elapsedSeconds: number;
  peakCombo: number;
  basePayout: number;
  comboAndPriorityCoins: number;
  masteryBonus: number;
  timeBonus: number;
  totalEarned: number;
  newlyUnlockedNext: boolean;
}

const SAVE_STORAGE_KEY = 'hearthplow_save_v1';

export function createDefaultSaveState(): PlayerSaveState {
  return {
    version: 1,
    coins: 0,
    upgrades: {
      blade: 0,
      engine: 0,
      spreader: 0,
      beacon: 0,
    },
    contractStars: {},
    unlockedContractIndex: 0,
    muted: false,
    steeringMode: 'camera',
    cameraMode: 'isometric',
  };
}

export function loadSaveState(): PlayerSaveState {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createDefaultSaveState();
    const parsed = JSON.parse(raw) as Partial<PlayerSaveState>;
    const def = createDefaultSaveState();
    const cam: CameraMode =
      parsed.cameraMode === 'chase' || parsed.cameraMode === 'cab' ? parsed.cameraMode : 'isometric';
    return {
      version: 1,
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : def.coins,
      upgrades: {
        blade: clampUpgrade(parsed.upgrades?.blade),
        engine: clampUpgrade(parsed.upgrades?.engine),
        spreader: clampUpgrade(parsed.upgrades?.spreader),
        beacon: clampUpgrade(parsed.upgrades?.beacon),
      },
      contractStars: parsed.contractStars && typeof parsed.contractStars === 'object' ? parsed.contractStars : {},
      unlockedContractIndex:
        typeof parsed.unlockedContractIndex === 'number'
          ? Math.max(0, Math.min(CONTRACTS.length - 1, Math.floor(parsed.unlockedContractIndex)))
          : 0,
      muted: Boolean(parsed.muted),
      steeringMode: parsed.steeringMode === 'car' ? 'car' : 'camera',
      cameraMode: cam,
    };
  } catch {
    return createDefaultSaveState();
  }
}

function clampUpgrade(v: unknown): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(3, Math.floor(v)));
}

export function persistSaveState(state: PlayerSaveState): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}
