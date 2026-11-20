import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CONTRACTS,
  CameraMode,
  ContractDefinition,
  FINE_PER_NPC,
  GamePhase,
  LiveRunStats,
  LiveShopStatus,
  SteeringMode,
  UpgradeLevels,
  VictorySummary,
  WeatherIntensity,
} from './types';
import { createVintagePickupTruck, TruckVisualRig } from './truckModel';
import { SnowField, WORLD_SIZE } from './snowField';
import { BuiltNeighborhood, buildNeighborhood } from './worldBuilder';
import { ParticlePool } from './particles';
import { SoundEngine } from './soundEngine';
import { NpcManager } from './npcManager';

const WEATHER_PROFILES: Record<
  WeatherIntensity,
  {
    label: string;
    snowRate: number;
    windSpeed: number;
    roadGrip: number;
    tractionSlip: number;
    fogDensity: number;
    durationMin: number;
    durationMax: number;
  }
> = {
  clear: {
    label: 'Clear Twilight',
    snowRate: 0.16,
    windSpeed: 0.35,
    roadGrip: 1.0,
    tractionSlip: 0.04,
    fogDensity: 0.0068,
    durationMin: 14,
    durationMax: 20,
  },
  flurries: {
    label: 'Light Flurries',
    snowRate: 0.45,
    windSpeed: 1.8,
    roadGrip: 0.86,
    tractionSlip: 0.24,
    fogDensity: 0.0085,
    durationMin: 16,
    durationMax: 22,
  },
  snowfall: {
    label: 'Steady Snowfall',
    snowRate: 0.78,
    windSpeed: 4.2,
    roadGrip: 0.68,
    tractionSlip: 0.54,
    fogDensity: 0.0112,
    durationMin: 16,
    durationMax: 23,
  },
  blizzard: {
    label: 'Heavy Blizzard',
    snowRate: 1.0,
    windSpeed: 8.6,
    roadGrip: 0.46,
    tractionSlip: 0.86,
    fogDensity: 0.0155,
    durationMin: 15,
    durationMax: 21,
  },
};

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface EngineCallbacks {
  onStatsUpdate: (stats: LiveRunStats) => void;
  onPhaseRequestPause: () => void;
  onOpenNearbyShop?: (shopId: string) => void;
  onContractFinished: (summary: VictorySummary) => void;
  onArrestStarted: () => void;
  onArrestFinished: (info: { npcHitCount: number; coinsEarnedThisRun: number }) => void;
  onContextLost: (lost: boolean) => void;
  onCameraModeChange?: (mode: CameraMode) => void;
}

export class SnowPlowEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  public readonly sound: SoundEngine;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly orthoCamera: THREE.OrthographicCamera;
  private readonly perspCamera: THREE.PerspectiveCamera;
  private readonly frustumSize = 23;

  private snowField: SnowField;
  private particles: ParticlePool;
  private truckRig: TruckVisualRig;
  private npcManager: NpcManager;
  private neighborhood: BuiltNeighborhood | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;

  // Last-15% Mastery Guide Beacon Ring
  private assistRingMesh: THREE.Mesh;
  private assistRingMat: THREE.MeshBasicMaterial;
  private assistCheckTimer = 0;

  private phase: GamePhase = 'title';
  private activeContract: ContractDefinition = CONTRACTS[0];
  private upgrades: UpgradeLevels;
  private steeringMode: SteeringMode = 'camera';
  private cameraMode: CameraMode = 'isometric';

  // Truck Physics State
  private truckX = 0;
  private truckZ = 0;
  private truckRotY = 0;
  private truckSpeed = 0;
  private velX = 0;
  private velZ = 0;
  private steerAngle = 0;

  // Dynamic Weather & Road Friction State
  private weatherIntensity: WeatherIntensity = 'flurries';
  private weatherTimer = 18;
  private weatherAngle = 0.45;
  private currentSnowRate = 0.45;
  private currentWindX = 1.2;
  private currentWindZ = 0.8;
  private currentRoadGrip = 0.86;
  private currentTractionSlip = 0.24;
  private currentFogDensity = 0.0085;
  private slipSprayTimer = 0;

  // Run Gameplay State
  private elapsedSeconds = 0;
  private totalTime = 0;
  private boostEnergy = 1;
  private boostActiveTimer = 0;
  private comboCharge = 0;
  private comboMultiplier = 1;
  private comboTimer = 0;
  private peakCombo = 1;
  private coinsEarnedThisRun = 0;
  private coinAccumulator = 0;
  private coinTickCooldown = 0;
  private cocoaBoostTimer = 0;
  private priorityCleared = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private chimneyPuffTimer = 0;
  private exhaustPuffTimer = 0;
  private hudSyncTimer = 0;
  private calloutSeq = 0;
  private lastCallout: LiveRunStats['lastCallout'] = null;
  private bladeSnowLoad = 0;
  private breachCalloutCooldown = 0;
  private bankHintCooldown = 0;
  private policeChaseActive = false;
  private policeChaseRemaining = 0;
  private npcHitsCount = 0;
  private arrestFocusX = 0;
  private arrestFocusZ = 0;

  // Camera State
  private camTargetX = 0;
  private camTargetZ = 0;

  // Input State (separated held vs edge-triggered)
  private readonly heldKeys = new Set<string>();
  private touchSteerX = 0;
  private touchSteerY = 0;
  private boostQueued = false;

  // Loop / Lifecycle
  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialUpgrades: UpgradeLevels,
    initialMuted: boolean,
    initialSteeringMode: SteeringMode,
    initialCameraMode: CameraMode,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.upgrades = { ...initialUpgrades };
    this.steeringMode = initialSteeringMode;
    this.cameraMode = initialCameraMode;
    this.sound = new SoundEngine(initialMuted);

    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x161f30);
    this.scene.fog = new THREE.FogExp2(0x161f30, 0.0085);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.orthoCamera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.5,
      180
    );
    this.orthoCamera.position.set(28, 25, 28);
    this.orthoCamera.lookAt(0, 0, 0);

    this.perspCamera = new THREE.PerspectiveCamera(56, aspect, 0.15, 200);
    this.perspCamera.position.set(0, 7, -8);

    this.setupLighting();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.snowField = new SnowField(maxAniso);
    this.scene.add(this.snowField.group);

    this.particles = new ParticlePool();
    this.scene.add(this.particles.group);

    this.truckRig = createVintagePickupTruck(this.upgrades);
    this.scene.add(this.truckRig.root);

    this.npcManager = new NpcManager();
    this.scene.add(this.npcManager.group);

    // Subtle frost-cyan target ring pointing to nearest unplowed patch at >=85% clear
    const ringGeo = new THREE.RingGeometry(1.15, 1.48, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.assistRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.assistRingMesh = new THREE.Mesh(ringGeo, this.assistRingMat);
    this.assistRingMesh.visible = false;
    this.scene.add(this.assistRingMesh);

    this.loadContract(CONTRACTS[0], false);

    if (!this.isSoftwareGl) {
      try {
        this.renderer.compile(this.scene, this.orthoCamera);
      } catch (_) { /* GL_INVALID_VALUE during shader warm-up — non-fatal, suppress. */ }
    }

    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.startLoop();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x7c9ad6, 0x263248, 0.92);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffb86c, 1.82);
    sun.position.set(-28, 32, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 110;
    const d = 38;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x93c5fd, 0.42);
    rim.position.set(26, 14, -24);
    this.scene.add(rim);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;
    this.orthoCamera.left = (-this.frustumSize * aspect) / 2;
    this.orthoCamera.right = (this.frustumSize * aspect) / 2;
    this.orthoCamera.top = this.frustumSize / 2;
    this.orthoCamera.bottom = -this.frustumSize / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      if (this.phase === 'playing') {
        e.preventDefault();
      }
    }

    if (code === 'Escape') {
      if (this.phase === 'playing') {
        this.callbacks.onPhaseRequestPause();
      }
      return;
    }

    if (code === 'KeyC' && !e.repeat && this.phase === 'playing') {
      this.cycleCameraMode();
      return;
    }

    if (code === 'KeyE' && !e.repeat && this.phase === 'playing') {
      const nearby = this.findNearbyShop();
      if (nearby) {
        this.callbacks.onOpenNearbyShop?.(nearby.id);
      }
      return;
    }

    if (code === 'Space' && !e.repeat && this.phase === 'playing') {
      this.boostQueued = true;
    }

    this.heldKeys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.touchSteerX = 0;
    this.touchSteerY = 0;
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  public setTouchControls(steerX: number, throttleY: number): void {
    this.touchSteerX = steerX;
    this.touchSteerY = throttleY;
  }

  public setSteeringMode(mode: SteeringMode): void {
    this.steeringMode = mode;
  }

  public setCameraMode(mode: CameraMode, showToast = true): void {
    this.cameraMode = mode;
    this.syncFirstPersonRig();
    if (showToast && this.phase === 'playing') {
      const label =
        mode === 'cab' ? 'View: Driver Cab' : mode === 'chase' ? 'View: Top-Side Chase' : 'View: Isometric';
      this.pushCallout(label, 'cyan');
      this.emitHudSnapshot();
    }
    // Snap perspective camera neatly near truck when switching into chase or cab
    const fwdX = Math.sin(this.truckRotY);
    const fwdZ = Math.cos(this.truckRotY);
    if (mode === 'chase') {
      this.perspCamera.position.set(this.truckX - fwdX * 7.8, 7.4, this.truckZ - fwdZ * 7.8);
      this.perspCamera.lookAt(this.truckX + fwdX * 3.0, 0.7, this.truckZ + fwdZ * 3.0);
    } else if (mode === 'cab') {
      this.perspCamera.position.set(this.truckX + fwdX * 0.14, 1.5, this.truckZ + fwdZ * 0.14);
      this.perspCamera.lookAt(this.truckX + fwdX * 14, 0.48, this.truckZ + fwdZ * 14);
    }
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['isometric', 'chase', 'cab'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.setCameraMode(next, true);
    this.callbacks.onCameraModeChange?.(next);
    return next;
  }

  private syncFirstPersonRig(): void {
    const useFp =
      this.phase !== 'title' &&
      this.phase !== 'arresting' &&
      this.phase !== 'arrested' &&
      this.cameraMode === 'cab';
    this.truckRig.setFirstPersonMode(useFp);
  }

  public triggerBoost(): void {
    if (this.phase === 'playing') {
      this.boostQueued = true;
    }
  }

  public setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    this.syncFirstPersonRig();
    if (nextPhase !== 'playing') {
      this.heldKeys.clear();
      this.touchSteerX = 0;
      this.touchSteerY = 0;
      this.sound.updateDriveTelemetry(false, 0, 0, false);
      if (nextPhase !== 'arresting') {
        this.sound.setPoliceSiren(false);
      }
    } else {
      this.sound.unlock();
      if (this.policeChaseActive) {
        this.sound.setPoliceSiren(true);
      }
      // Ensure perspective camera starts smoothly framed behind truck when entering play
      if (this.cameraMode !== 'isometric') {
        this.setCameraMode(this.cameraMode, false);
      }
    }
  }

  public applyUpgrades(nextUpgrades: UpgradeLevels): void {
    this.upgrades = { ...nextUpgrades };
    this.truckRig.setUpgrades(this.upgrades);
  }

  public loadContract(contract: ContractDefinition, resetCameraImmediately = true): void {
    this.activeContract = contract;
    if (this.neighborhood) {
      this.scene.remove(this.neighborhood.group);
      this.neighborhood.dispose();
      this.neighborhood = null;
    }

    this.snowField.loadContract(contract);
    this.neighborhood = buildNeighborhood(contract);
    this.scene.add(this.neighborhood.group);

    this.truckX = contract.spawn.x;
    this.truckZ = contract.spawn.z;
    this.truckRotY = contract.spawn.rotY;
    this.truckSpeed = 0;
    this.velX = 0;
    this.velZ = 0;
    this.steerAngle = 0;

    // Initialize weather profile matching contract difficulty
    const startWeather: WeatherIntensity = contract.difficulty === 'hard' ? 'snowfall' : 'flurries';
    const wp = WEATHER_PROFILES[startWeather];
    this.weatherIntensity = startWeather;
    this.weatherTimer = wp.durationMin + Math.random() * (wp.durationMax - wp.durationMin);
    this.weatherAngle = 0.4 + contract.index * 0.65;
    this.currentSnowRate = wp.snowRate;
    this.currentWindX = Math.cos(this.weatherAngle) * wp.windSpeed;
    this.currentWindZ = Math.sin(this.weatherAngle) * wp.windSpeed;
    this.currentRoadGrip = wp.roadGrip;
    this.currentTractionSlip = wp.tractionSlip;
    this.currentFogDensity = wp.fogDensity;
    this.particles.setWeatherState(this.currentSnowRate, this.currentWindX, this.currentWindZ);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.currentFogDensity;
    }

    this.truckRig.root.position.set(this.truckX, 0, this.truckZ);
    this.truckRig.root.rotation.set(0, this.truckRotY, 0);

    if (resetCameraImmediately) {
      this.camTargetX = this.truckX;
      this.camTargetZ = this.truckZ;
    }

    this.elapsedSeconds = 0;
    this.boostEnergy = 1;
    this.boostActiveTimer = 0;
    this.comboCharge = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.peakCombo = 1;
    this.coinsEarnedThisRun = 0;
    this.coinAccumulator = 0;
    this.coinTickCooldown = 0;
    this.cocoaBoostTimer = 0;
    this.slipSprayTimer = 0;
    this.priorityCleared = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.lastCallout = null;
    this.bladeSnowLoad = 0;
    this.breachCalloutCooldown = 0;
    this.bankHintCooldown = 0;
    this.policeChaseActive = false;
    this.policeChaseRemaining = 0;
    this.npcHitsCount = 0;
    this.sound.setPoliceSiren(false);
    this.npcManager.loadContract(contract);
    this.assistRingMesh.visible = false;

    this.emitHudSnapshot();
  }

  public claimShopTip(shopId: string): number {
    if (!this.neighborhood) return 0;
    const sr = this.neighborhood.shopsRuntime.find((s) => s.spec.id === shopId);
    if (!sr || !sr.apronCleared || sr.tipClaimed) return 0;
    sr.tipClaimed = true;
    const tip = 20;
    this.coinsEarnedThisRun += tip;
    this.npcManager.cheerAtShop(shopId);
    this.sound.playPriorityClear();
    this.pushCallout(`${sr.spec.name} Tip +${tip}`, 'amber');
    this.emitHudSnapshot();
    return tip;
  }

  public activateShopCocoa(shopId: string): void {
    this.boostEnergy = 1;
    this.cocoaBoostTimer = 22;
    this.npcManager.cheerAtShop(shopId);
    this.sound.playUpgradePurchase();
    this.pushCallout('Hot Cocoa: Boost Charged!', 'cyan');
    this.emitHudSnapshot();
  }

  public activateShopSaltBag(shopId: string): void {
    if (!this.neighborhood) return;
    const sr = this.neighborhood.shopsRuntime.find((s) => s.spec.id === shopId);
    if (!sr) return;
    this.snowField.applySaltTrail(sr.sampleX, sr.sampleZ, 6.8, 1.45);
    sr.apronCleared = true;
    this.comboTimer = this.getComboGraceDuration();
    this.npcManager.cheerAtShop(shopId);
    this.sound.playPriorityClear();
    this.pushCallout(`Salted ${sr.spec.name} Curb!`, 'cyan');
    this.emitHudSnapshot();
  }

  private findNearbyShop(): LiveShopStatus | null {
    if (!this.neighborhood) return null;
    let best: LiveShopStatus | null = null;
    let bestDist = 8.4;
    for (const sr of this.neighborhood.shopsRuntime) {
      const d = Math.hypot(this.truckX - sr.sampleX, this.truckZ - sr.sampleZ);
      const dBuilding = Math.hypot(this.truckX - sr.spec.x, this.truckZ - sr.spec.z);
      const minD = Math.min(d, dBuilding);
      if (minD < bestDist) {
        bestDist = minD;
        best = {
          id: sr.spec.id,
          name: sr.spec.name,
          category: sr.spec.category,
          crowdCount: this.npcManager.getShopCrowdCount(sr.spec.id),
          apronCleared: sr.apronCleared,
          tipClaimed: sr.tipClaimed,
        };
      }
    }
    return best;
  }

  public deductRunCoins(amount: number): void {
    this.coinsEarnedThisRun = Math.max(0, this.coinsEarnedThisRun - amount);
    this.emitHudSnapshot();
  }

  public finishShiftEarly(): void {
    const clearPct = this.snowField.getClearPercentage();
    if (clearPct < this.activeContract.targetPercent) return;
    this.completeContract(clearPct);
  }

  private completeContract(clearPct: number): void {
    this.setPhase('victory');
    this.sound.playContractComplete();

    const starsEarned =
      clearPct >= this.activeContract.masteryPercent ? 3 : clearPct >= this.activeContract.targetPercent + 6 ? 2 : 1;

    const basePayout = this.activeContract.baseReward;
    const masteryBonus =
      starsEarned === 3 ? Math.round(basePayout * 0.4) : starsEarned === 2 ? Math.round(basePayout * 0.18) : 0;
    const timeBonus =
      this.elapsedSeconds <= this.activeContract.parTimeSeconds
        ? Math.round((this.activeContract.parTimeSeconds - this.elapsedSeconds) * 1.25)
        : 0;

    const summary: VictorySummary = {
      contract: this.activeContract,
      clearPercent: clearPct,
      starsEarned,
      elapsedSeconds: this.elapsedSeconds,
      peakCombo: this.peakCombo,
      basePayout,
      comboAndPriorityCoins: this.coinsEarnedThisRun,
      masteryBonus,
      timeBonus,
      totalEarned: basePayout + this.coinsEarnedThisRun + masteryBonus + timeBonus,
      newlyUnlockedNext: false,
    };

    this.callbacks.onContractFinished(summary);
  }

  private pushCallout(text: string, accent: 'amber' | 'cyan'): void {
    this.calloutSeq += 1;
    this.lastCallout = { id: this.calloutSeq, text, accent };
  }

  private getComboGraceDuration(): number {
    return 2.8 + this.upgrades.beacon * 0.65;
  }

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;

      const rawDt = Math.max(0.001, (now - this.lastTimestamp) / 1000);
      this.lastTimestamp = now;
      const dt = Math.min(rawDt, 0.05);

      this.stepSimulation(dt);
      const usePersp =
        this.phase === 'arresting' ||
        this.phase === 'arrested' ||
        (this.phase !== 'title' && this.cameraMode !== 'isometric');
      const activeCam = usePersp ? this.perspCamera : this.orthoCamera;
      this.renderer.render(this.scene, activeCam);

      if (this.isSoftwareGl) {
        this.afterDraw(() => tick(performance.now()));
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(() => tick(performance.now()), 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number): void {
    this.totalTime += dt;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.particles.update(dt * 0.2, this.totalTime, this.camTargetX, this.camTargetZ);
      this.updateCamera(dt);
      return;
    }

    const clearPct = this.snowField.getClearPercentage();
    this.snowField.updateVisualUniforms(this.totalTime, dt, clearPct);

    if (this.neighborhood) {
      const newlyLit = this.neighborhood.update(this.totalTime, dt, (x, z, r) =>
        this.snowField.sampleCircleClearedRatio(x, z, r)
      );
      if (newlyLit > 0 && this.phase === 'playing') {
        this.pushCallout('Cottage Hearth Lit', 'amber');
      }

      this.chimneyPuffTimer += dt;
      if (this.chimneyPuffTimer >= 0.42) {
        this.chimneyPuffTimer = 0;
        for (const anchor of this.neighborhood.chimneyAnchors) {
          this.particles.spawnSnowBurst(
            anchor.x + (Math.random() - 0.5) * 0.12,
            anchor.y,
            anchor.z + (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.35,
            1.2 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.35,
            0.95,
            2
          );
        }
      }
    }

    // Dynamic Weather Progression & Smooth Atmospheric Interpolation
    this.stepDynamicWeather(dt);

    const npcRes = this.npcManager.update(
      dt,
      this.totalTime,
      this.truckX,
      this.truckZ,
      this.truckRotY,
      this.truckSpeed,
      this.phase === 'playing'
    );

    if (this.phase === 'playing') {
      this.elapsedSeconds += dt;
      this.stepTruckAndPlow(dt, clearPct);
      this.updateAssistGuide(dt, clearPct);

      if (npcRes.newHits.length > 0) {
        for (const hit of npcRes.newHits) {
          this.npcHitsCount += 1;
          this.sound.playNpcImpact();
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.34);

          for (let b = 0; b < 10; b++) {
            this.particles.spawnSnowBurst(
              hit.x,
              0.55,
              hit.z,
              hit.dirX * (3.2 + Math.random() * 2.5) + (Math.random() - 0.5) * 3,
              3.4 + Math.random() * 2.4,
              hit.dirZ * (3.2 + Math.random() * 2.5) + (Math.random() - 0.5) * 3,
              0.85,
              0
            );
          }

          if (!this.policeChaseActive) {
            this.policeChaseActive = true;
            this.policeChaseRemaining = 3.2;
            this.npcManager.startChase(this.truckX, this.truckZ, this.truckRotY);
            this.sound.setPoliceSiren(true);
            this.pushCallout('Villager Hit! Police Dispatched!', 'amber');
          } else {
            this.pushCallout(`Hit #${this.npcHitsCount}! Fine: ${this.npcHitsCount * FINE_PER_NPC}`, 'amber');
          }
        }
        this.emitHudSnapshot();
      }

      if (this.policeChaseActive) {
        this.policeChaseRemaining = Math.max(0, this.policeChaseRemaining - dt);
        if (this.policeChaseRemaining <= 0) {
          this.policeChaseActive = false;
          this.phase = 'arresting';
          this.heldKeys.clear();
          this.touchSteerX = 0;
          this.touchSteerY = 0;
          this.boostQueued = false;
          this.boostActiveTimer = 0;
          this.syncFirstPersonRig();
          const focus = this.npcManager.beginArrest(this.truckX, this.truckZ, this.truckRotY);
          this.arrestFocusX = focus.focusX;
          this.arrestFocusZ = focus.focusZ;
          this.sound.updateDriveTelemetry(false, 0, 0, false);
          this.callbacks.onArrestStarted();
        }
      }
    } else if (this.phase === 'arresting') {
      this.assistRingMesh.visible = false;
      this.velX = THREE.MathUtils.damp(this.velX, 0, 7, dt);
      this.velZ = THREE.MathUtils.damp(this.velZ, 0, 7, dt);
      this.truckSpeed = THREE.MathUtils.damp(this.truckSpeed, 0, 7, dt);
      this.truckRig.updateAnimation(dt, this.truckSpeed, 0, false, this.totalTime, 0);
      if (npcRes.arrestFinished) {
        this.phase = 'arrested';
        this.sound.setPoliceSiren(false);
        this.sound.playArrestTicket();
        this.callbacks.onArrestFinished({
          npcHitCount: this.npcHitsCount,
          coinsEarnedThisRun: this.coinsEarnedThisRun,
        });
      }
    } else {
      this.assistRingMesh.visible = false;
      this.truckRig.updateAnimation(dt, 0, 0, false, this.totalTime);
    }

    this.snowField.syncDataTexture();
    this.particles.update(dt, this.totalTime, this.camTargetX, this.camTargetZ);
    this.updateCamera(dt);

    if (this.phase === 'playing') {
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.emitHudSnapshot();
      }
    }
  }

  private updateAssistGuide(dt: number, clearPct: number): void {
    if (clearPct < 85) {
      this.assistRingMesh.visible = false;
      return;
    }

    this.assistCheckTimer += dt;
    if (this.assistCheckTimer >= 0.25) {
      this.assistCheckTimer = 0;
      const patch = this.snowField.findNearestUnplowedPatch(this.truckX, this.truckZ);
      if (patch) {
        this.assistRingMesh.position.set(patch.x, 0.36, patch.z);
        this.assistRingMesh.visible = true;
      } else {
        this.assistRingMesh.visible = false;
      }
    }

    if (this.assistRingMesh.visible) {
      const pulse = 0.85 + Math.sin(this.totalTime * 5.2) * 0.18;
      this.assistRingMesh.scale.setScalar(pulse);
      this.assistRingMat.opacity = 0.48 + Math.sin(this.totalTime * 5.2) * 0.26;
    }
  }

  private stepTruckAndPlow(dt: number, clearPct: number): void {
    // 1. Read directional inputs
    let inputX = this.touchSteerX;
    let inputY = this.touchSteerY;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) inputY += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) inputY -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) inputX += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) inputX -= 1;

    inputX = THREE.MathUtils.clamp(inputX, -1, 1);
    inputY = THREE.MathUtils.clamp(inputY, -1, 1);

    // 2. Boost trigger
    if (this.boostQueued) {
      this.boostQueued = false;
      if (this.boostEnergy >= 0.35 && this.boostActiveTimer <= 0) {
        this.boostActiveTimer = 1.35;
        this.boostEnergy = Math.max(0, this.boostEnergy - 0.45);
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.22);
        this.sound.playBoostSurge();
        this.pushCallout('Plow Boost!', 'cyan');
      }
    }

    const isBoosting = this.boostActiveTimer > 0;
    this.cocoaBoostTimer = Math.max(0, this.cocoaBoostTimer - dt);
    if (isBoosting) {
      this.boostActiveTimer = Math.max(0, this.boostActiveTimer - dt);
    } else {
      const cocoaBonus = this.cocoaBoostTimer > 0 ? 1.55 : 1.0;
      const rechargeRate = (0.14 + this.upgrades.beacon * 0.045) * cocoaBonus;
      this.boostEnergy = Math.min(1, this.boostEnergy + rechargeRate * dt);
    }
    this.breachCalloutCooldown = Math.max(0, this.breachCalloutCooldown - dt);
    this.bankHintCooldown = Math.max(0, this.bankHintCooldown - dt);
    this.coinTickCooldown = Math.max(0, this.coinTickCooldown - dt);

    // 3. Dynamic Road Friction, Tire Traction & Lateral Drift Physics
    const isHard = this.activeContract.difficulty === 'hard';
    const engineLvl = this.upgrades.engine;
    const underfootSnow = this.snowField.sampleSnowAt(this.truckX, this.truckZ);
    const roadSurfaceGrip = underfootSnow < 0.08 ? 1.0 : 0.86;
    const effectiveGrip = THREE.MathUtils.clamp(
      this.currentRoadGrip * roadSurfaceGrip + engineLvl * 0.055 + (isBoosting ? 0.14 : 0),
      0.38,
      1.05
    );
    const effectiveSlip = THREE.MathUtils.clamp(
      this.currentTractionSlip * (1 - engineLvl * 0.13) + (underfootSnow >= 0.08 ? 0.08 : 0),
      0.03,
      0.92
    );

    const maxFwdSpeed = (10.8 + engineLvl * 1.8) * (isBoosting ? 1.42 : 1.0);
    const maxRevSpeed = -(5.5 + engineLvl * 0.7);
    const accel = (22 + engineLvl * 5) * (isBoosting ? 1.45 : isHard ? 0.92 : 1.0) * (0.58 + 0.42 * effectiveGrip);
    const turnGripScale = THREE.MathUtils.lerp(0.72, 1.0, effectiveGrip) * (isHard ? 0.92 : 1.0);

    const oldFwdX = Math.sin(this.truckRotY);
    const oldFwdZ = Math.cos(this.truckRotY);
    const oldRightX = -oldFwdZ;
    const oldRightZ = oldFwdX;

    let fwdVel = this.velX * oldFwdX + this.velZ * oldFwdZ;
    const prevLatVel = this.velX * oldRightX + this.velZ * oldRightZ;

    let throttle = 0;
    let visualSteer = 0;

    const effectiveSteerMode: SteeringMode = this.cameraMode === 'isometric' ? this.steeringMode : 'car';

    if (effectiveSteerMode === 'camera') {
      const mag = Math.hypot(inputX, inputY);
      if (mag > 0.05) {
        // Camera sits at (+28, 25, +28), so Screen Up = (-1, -1) and Screen Right = (+1, -1)
        const dirX = (inputX - inputY) * 0.7071;
        const dirZ = (-inputX - inputY) * 0.7071;
        const targetAngle = Math.atan2(dirX, dirZ);
        const angleDiff = Math.atan2(Math.sin(targetAngle - this.truckRotY), Math.cos(targetAngle - this.truckRotY));

        const turnRate = (4.6 + engineLvl * 0.4) * (isBoosting ? 1.15 : 1.0) * turnGripScale;
        const maxStep = turnRate * dt;
        const deltaTurn = THREE.MathUtils.clamp(angleDiff, -maxStep, maxStep);
        this.truckRotY += deltaTurn;

        visualSteer = THREE.MathUtils.clamp(angleDiff * 1.1, -0.65, 0.65);
        // Smooth forward throttle that stays responsive even on sharp U-turns
        throttle = Math.min(1, mag) * Math.max(0.25, Math.cos(angleDiff * 0.45));
      }
    } else {
      throttle = inputY;
      const steerInput = -inputX;
      visualSteer = steerInput * 0.55;
      const turnAuthority = Math.abs(fwdVel) > 0.25 ? (fwdVel >= 0 ? 1 : -1) : 0;
      const speedTurnScale = THREE.MathUtils.clamp(Math.abs(fwdVel) / 3.5, 0.35, 1.05);
      this.truckRotY += steerInput * turnAuthority * speedTurnScale * (2.65 + engineLvl * 0.18) * turnGripScale * dt;
    }

    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, visualSteer, 12, dt);

    const frontSnow = this.snowField.sampleSnowAt(this.truckX + oldFwdX * 2.1, this.truckZ + oldFwdZ * 2.1);
    const dragFactor = isBoosting ? 0.008 : Math.max(0, 0.25 - engineLvl * 0.05) * frontSnow * (isHard ? 1.42 : 1.0);

    if (Math.abs(throttle) > 0.05) {
      fwdVel += throttle * accel * dt;
    } else {
      // Lower road friction extends braking/coasting glide distance
      const coastDamp = THREE.MathUtils.lerp(2.1, 6.8, effectiveGrip);
      fwdVel = THREE.MathUtils.damp(fwdVel, 0, coastDamp, dt);
    }

    fwdVel *= Math.max(0.7, 1 - dragFactor * dt * 4);
    fwdVel = THREE.MathUtils.clamp(fwdVel, maxRevSpeed, maxFwdSpeed);

    // Reconstruct pre-turn world velocity, then project onto new truck heading to preserve genuine cornering inertia
    const preVelX = oldFwdX * fwdVel + oldRightX * prevLatVel;
    const preVelZ = oldFwdZ * fwdVel + oldRightZ * prevLatVel;

    const nextFwdX = Math.sin(this.truckRotY);
    const nextFwdZ = Math.cos(this.truckRotY);
    const nextRightX = -nextFwdZ;
    const nextRightZ = nextFwdX;

    let newFwdVel = preVelX * nextFwdX + preVelZ * nextFwdZ;
    let newLatVel = preVelX * nextRightX + preVelZ * nextRightZ;

    // Tire lateral traction: crisp bite in clear weather, realistic snow slide in blizzards
    const lateralGripDamp = THREE.MathUtils.lerp(14.5, 2.35, effectiveSlip);
    newLatVel = THREE.MathUtils.damp(newLatVel, 0, lateralGripDamp, dt);

    // Heavy blizzard crosswind gust push when moving
    const windMag = Math.hypot(this.currentWindX, this.currentWindZ);
    if (windMag > 4.5 && Math.abs(newFwdVel) > 1.0) {
      const gust = (windMag - 4.5) * 0.11 * dt;
      const windLat = (this.currentWindX * nextRightX + this.currentWindZ * nextRightZ) / windMag;
      newLatVel += windLat * gust;
    }

    this.velX = nextFwdX * newFwdVel + nextRightX * newLatVel;
    this.velZ = nextFwdZ * newFwdVel + nextRightZ * newLatVel;
    this.truckSpeed = newFwdVel;

    // Visual tire snow spray while sliding/drifting on slick roads
    this.slipSprayTimer = Math.max(0, this.slipSprayTimer - dt);
    if (Math.abs(newLatVel) > 1.25 && this.slipSprayTimer <= 0) {
      this.slipSprayTimer = 0.08;
      const rearX = this.truckX - nextFwdX * 1.3;
      const rearZ = this.truckZ - nextFwdZ * 1.3;
      this.particles.spawnSnowBurst(
        rearX + (Math.random() - 0.5) * 0.9,
        0.18,
        rearZ + (Math.random() - 0.5) * 0.9,
        -nextRightX * Math.sign(newLatVel) * 2.2,
        1.5 + Math.random(),
        -nextRightZ * Math.sign(newLatVel) * 2.2,
        0.65,
        0
      );
    }

    this.truckX += this.velX * dt;
    this.truckZ += this.velZ * dt;

    // World Boundary Clamp
    const bound = WORLD_SIZE * 0.46;
    if (this.truckX < -bound) {
      this.truckX = -bound;
      this.velX = Math.max(0, this.velX * -0.2);
      this.velZ *= 0.65;
    } else if (this.truckX > bound) {
      this.truckX = bound;
      this.velX = Math.min(0, this.velX * -0.2);
      this.velZ *= 0.65;
    }
    if (this.truckZ < -bound) {
      this.truckZ = -bound;
      this.velZ = Math.max(0, this.velZ * -0.2);
      this.velX *= 0.65;
    } else if (this.truckZ > bound) {
      this.truckZ = bound;
      this.velZ = Math.min(0, this.velZ * -0.2);
      this.velX *= 0.65;
    }

    // Smooth Circle Colliders against cottages, shops, lamps, and trees
    if (this.neighborhood) {
      const truckRadius = 1.45;
      for (const col of this.neighborhood.colliders) {
        const dx = this.truckX - col.x;
        const dz = this.truckZ - col.z;
        const minDist = col.radius + truckRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minDist - dist;
          this.truckX += nx * overlap;
          this.truckZ += nz * overlap;
          const inward = this.velX * nx + this.velZ * nz;
          if (inward < 0) {
            this.velX -= nx * inward * 1.15;
            this.velZ -= nz * inward * 1.15;
            this.velX *= 0.78;
            this.velZ *= 0.78;
          }
        }
      }
    }
    this.truckSpeed = this.velX * nextFwdX + this.velZ * nextFwdZ;

    this.truckRig.root.position.set(this.truckX, 0, this.truckZ);
    this.truckRig.root.rotation.set(0, this.truckRotY, 0);

    // Exhaust puffs
    this.exhaustPuffTimer += dt * (1 + Math.abs(this.truckSpeed) * 0.25);
    if (this.exhaustPuffTimer >= 0.14) {
      this.exhaustPuffTimer = 0;
      const exX = this.truckX - nextFwdX * 2.0 + nextFwdZ * 0.55;
      const exZ = this.truckZ - nextFwdZ * 2.0 - nextFwdX * 0.55;
      this.particles.spawnSnowBurst(exX, 0.48, exZ, -nextFwdX * 1.1, 0.9, -nextFwdZ * 1.1, 0.52, 2);
    }

    // 4. Plow Blade Snow Clearing + Curb/Driveway Berm Mass Transfer
    const bladeHalfWidth = (1.35 + this.upgrades.blade * 0.34) * (isBoosting ? 1.2 : 1.0);
    const bladeCenterX = this.truckX + nextFwdX * 2.28;
    const bladeCenterZ = this.truckZ + nextFwdZ * 2.28;
    const clearPower = isBoosting ? 1.0 : 0.88;

    const clearRes = this.snowField.plowBlade(
      bladeCenterX,
      bladeCenterZ,
      nextFwdX,
      nextFwdZ,
      bladeHalfWidth,
      clearPower,
      isBoosting,
      this.upgrades.blade
    );

    // Update snow mound accumulated inside the blade scoop
    const targetBladeLoad = isBoosting
      ? 0.18
      : Math.min(1, clearRes.bladeLoadSignal * 0.16 + (Math.abs(this.truckSpeed) > 1.2 ? 0.08 : 0));
    this.bladeSnowLoad = THREE.MathUtils.damp(this.bladeSnowLoad, targetBladeLoad, isBoosting ? 11 : 6.5, dt);
    this.truckRig.updateAnimation(dt, this.truckSpeed, this.steerAngle, isBoosting, this.totalTime, this.bladeSnowLoad);

    // Heavy snowbank tactile resistance without boost (never permanently stalls; Space blasts straight through)
    if (clearRes.heavyBermImpact > 0.08 && !isBoosting && Math.abs(throttle) > 0.1) {
      const minCrawl = 1.9 + this.upgrades.engine * 0.35;
      this.truckSpeed = Math.max(minCrawl, this.truckSpeed * (1 - clearRes.heavyBermImpact * 0.36));
      if (clearRes.maxBankDepth >= 1.28) {
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.075 * clearRes.heavyBermImpact);
      }
      if (clearRes.heavyBermImpact > 0.44 && this.boostEnergy >= 0.35 && this.bankHintCooldown <= 0) {
        this.bankHintCooldown = 8.0;
        this.pushCallout('Massive Bank â€” Press Space to Boost!', 'cyan');
      }
    }

    // Boost Blast-Through: smash massive snowbanks cleanly with particle eruption & bonus reward
    if (clearRes.breachedHeavyBank) {
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.28);
      this.comboCharge += 6;
      this.comboTimer = this.getComboGraceDuration();
      this.coinsEarnedThisRun += 1;
      this.sound.playBankBreach();
      if (this.breachCalloutCooldown <= 0) {
        this.breachCalloutCooldown = 2.4;
        this.pushCallout('Snowbank Breached! +1', 'cyan');
      }
      const rightX = -nextFwdZ;
      const rightZ = nextFwdX;
      for (let k = 0; k < 12; k++) {
        const side = k % 2 === 0 ? 1 : -1;
        const spread = (0.4 + Math.random() * 0.9) * side;
        this.particles.spawnSnowBurst(
          clearRes.breachX + rightX * spread * 0.5,
          0.52,
          clearRes.breachZ + rightZ * spread * 0.5,
          nextFwdX * (4.2 + Math.random() * 3.5) + rightX * spread * 5.2,
          4.4 + Math.random() * 3.2,
          nextFwdZ * (4.2 + Math.random() * 3.5) + rightZ * spread * 5.2,
          0.92 + Math.random() * 0.45,
          k < 3 ? 1 : 0
        );
      }
    }

    let totalClearedThisFrame = clearRes.clearedAmount;

    // 5. Rear Salt Spreader Trail (if upgraded >= 1)
    if (this.upgrades.spreader > 0 && Math.abs(this.truckSpeed) > 0.4) {
      const rearX = this.truckX - nextFwdX * 1.95;
      const rearZ = this.truckZ - nextFwdZ * 1.95;
      const saltRadius = 1.45 + this.upgrades.spreader * 0.6;
      const melted = this.snowField.applySaltTrail(rearX, rearZ, saltRadius, dt * (2.2 + this.upgrades.spreader * 0.9));
      totalClearedThisFrame += melted;

      // Spreader also melts thin curb edges smoothly
      totalClearedThisFrame += this.snowField.applyEdgeMagnetCleanup(
        this.truckX,
        this.truckZ,
        2.3 + this.upgrades.spreader * 0.55,
        0.26 + this.upgrades.spreader * 0.06,
        dt * (1.5 + this.upgrades.spreader * 0.6)
      );
    }

    // 6. Last-12% Magnet / Auto-Clean Curb Assist (prevents tedious pixel-hunting)
    if (clearPct >= 86 && Math.abs(this.truckSpeed) > 0.25) {
      const magnetRadius = bladeHalfWidth + 1.15;
      totalClearedThisFrame += this.snowField.applyEdgeMagnetCleanup(
        bladeCenterX,
        bladeCenterZ,
        magnetRadius,
        0.34,
        dt * 3.8
      );
    }

    // 7. Spawn Fling Snow Clumps & Boost Sparks
    if (clearRes.flingCount > 0 && Math.abs(this.truckSpeed) > 0.8) {
      const rightX = -nextFwdZ;
      const rightZ = nextFwdX;
      const burstCount = Math.min(isBoosting ? 6 : 4, Math.ceil(clearRes.flingCount * 0.38));
      for (let b = 0; b < burstCount; b++) {
        const side = b % 2 === 0 ? 1 : -0.7;
        const speedMult = 3.2 + Math.random() * 2.8 + (isBoosting ? 2.6 : 0);
        this.particles.spawnSnowBurst(
          clearRes.avgFlingX + rightX * side * 0.4,
          0.35,
          clearRes.avgFlingZ + rightZ * side * 0.4,
          rightX * side * speedMult + nextFwdX * 1.5,
          3.2 + Math.random() * 2.4,
          rightZ * side * speedMult + nextFwdZ * 1.5,
          0.75 + Math.random() * 0.55,
          isBoosting && b === 0 ? 1 : 0
        );
      }
    }

    // 8. Combo Multiplier & Paced Coin Economy (calm, steady trickle)
    if (totalClearedThisFrame > 0.05) {
      this.comboCharge += totalClearedThisFrame;
      this.comboTimer = this.getComboGraceDuration();
      this.boostEnergy = Math.min(1, this.boostEnergy + totalClearedThisFrame * 0.008);

      const prevMult = this.comboMultiplier;
      const nextMult =
        this.comboCharge >= 165
          ? 8
          : this.comboCharge >= 105
          ? 5
          : this.comboCharge >= 65
          ? 4
          : this.comboCharge >= 34
          ? 3
          : this.comboCharge >= 13
          ? 2
          : 1;

      if (nextMult > prevMult) {
        this.comboMultiplier = nextMult;
        this.peakCombo = Math.max(this.peakCombo, nextMult);
        this.sound.playComboStep(nextMult);
        this.pushCallout(`${nextMult}x Combo Streak`, 'amber');
      }

      // Slower, gentler coin accumulation while plowing
      const gentleComboScale = 1 + (this.comboMultiplier - 1) * 0.32;
      this.coinAccumulator += totalClearedThisFrame * 0.14 * gentleComboScale;
    } else if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) {
        this.comboCharge = 0;
        this.comboMultiplier = 1;
      }
    }

    // Smoothly pace coin trickle (+1 coin per 0.22s cadence) so counter rises calmly
    if (this.coinAccumulator >= 1 && this.coinTickCooldown <= 0) {
      this.coinsEarnedThisRun += 1;
      this.coinAccumulator = Math.min(25, this.coinAccumulator - 1);
      this.coinTickCooldown = 0.22;
    }

    // 9. Priority Zone Checks
    if (this.neighborhood) {
      for (const pm of this.neighborhood.priorityMarkers) {
        if (pm.cleared) continue;
        const ratio = this.snowField.sampleCircleClearedRatio(pm.spec.x, pm.spec.z, pm.spec.radius);
        if (ratio >= 0.78) {
          pm.cleared = true;
          this.priorityCleared += 1;
          const coinGain = Math.round(pm.spec.bonusCoins * (0.7 + Math.min(5, this.comboMultiplier) * 0.12));
          this.coinsEarnedThisRun += coinGain;
          this.comboTimer = this.getComboGraceDuration();
          this.comboCharge += 18;
          this.boostEnergy = Math.min(1, this.boostEnergy + 0.35);

          this.hitstopTimer = 0.045;
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.34);
          this.sound.playPriorityClear();
          this.pushCallout(`${pm.spec.label} +${coinGain}`, 'amber');

          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            this.particles.spawnSnowBurst(
              pm.spec.x + Math.cos(ang) * 0.8,
              0.4,
              pm.spec.z + Math.sin(ang) * 0.8,
              Math.cos(ang) * (4 + Math.random() * 2),
              4.2 + Math.random() * 2.5,
              Math.sin(ang) * (4 + Math.random() * 2),
              0.9,
              1
            );
          }
        }
      }
    }

    // 10. Procedural Audio Telemetry
    this.sound.updateDriveTelemetry(
      true,
      Math.abs(this.truckSpeed) / 11,
      Math.min(1, totalClearedThisFrame * 0.45),
      isBoosting
    );

    // 11. Auto-complete if 99% cleared
    const updatedClearPct = this.snowField.getClearPercentage();
    if (updatedClearPct >= 99.0) {
      this.completeContract(100);
    }
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'arresting' || this.phase === 'arrested') {
      const fwdX = Math.sin(this.truckRotY);
      const fwdZ = Math.cos(this.truckRotY);
      const rightX = -fwdZ;
      const rightZ = fwdX;
      _vec3A.set(
        this.arrestFocusX - rightX * 8.2 - fwdX * 3.8,
        5.2,
        this.arrestFocusZ - rightZ * 8.2 - fwdZ * 3.8
      );
      this.perspCamera.position.lerp(_vec3A, 1 - Math.exp(-4.5 * dt));
      _vec3B.set(this.arrestFocusX, 0.9, this.arrestFocusZ);
      this.perspCamera.lookAt(_vec3B);
      if (Math.abs(this.perspCamera.fov - 50) > 0.1) {
        this.perspCamera.fov = THREE.MathUtils.damp(this.perspCamera.fov, 50, 6, dt);
        this.perspCamera.updateProjectionMatrix();
      }
      return;
    }

    if (this.phase === 'title') {
      const orbitAngle = this.totalTime * 0.14;
      const dist = 36;
      const targetX = Math.sin(orbitAngle) * 5;
      const targetZ = Math.cos(orbitAngle) * 5;
      this.camTargetX = THREE.MathUtils.damp(this.camTargetX, targetX, 2.5, dt);
      this.camTargetZ = THREE.MathUtils.damp(this.camTargetZ, targetZ, 2.5, dt);

      _vec3A.set(
        this.camTargetX + Math.cos(orbitAngle * 0.5) * dist * 0.72,
        24,
        this.camTargetZ + Math.sin(orbitAngle * 0.5 + 0.75) * dist * 0.72 + 18
      );
      this.orthoCamera.position.lerp(_vec3A, 1 - Math.exp(-3 * dt));
      _vec3B.set(this.camTargetX, 0.5, this.camTargetZ);
      this.orthoCamera.lookAt(_vec3B);
      return;
    }

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0.005) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 14, dt);
    } else {
      this.shakeIntensity = 0;
    }

    const fwdX = Math.sin(this.truckRotY);
    const fwdZ = Math.cos(this.truckRotY);
    const isBoosting = this.boostActiveTimer > 0;

    if (this.cameraMode === 'chase') {
      // Elevated angled top-side chase behind the truck roof
      const desiredX = this.truckX - fwdX * 7.8 + shakeX;
      const desiredY = 7.4 + shakeY;
      const desiredZ = this.truckZ - fwdZ * 7.8;

      _vec3A.set(desiredX, desiredY, desiredZ);
      this.perspCamera.position.lerp(_vec3A, 1 - Math.exp(-7.2 * dt));

      this.camTargetX = THREE.MathUtils.damp(this.camTargetX, this.truckX + fwdX * 3.0, 9.5, dt);
      this.camTargetZ = THREE.MathUtils.damp(this.camTargetZ, this.truckZ + fwdZ * 3.0, 9.5, dt);
      _vec3B.set(this.camTargetX, 0.75, this.camTargetZ);
      this.perspCamera.lookAt(_vec3B);

      const targetFov = isBoosting ? 58 : 52;
      if (Math.abs(this.perspCamera.fov - targetFov) > 0.05) {
        this.perspCamera.fov = THREE.MathUtils.damp(this.perspCamera.fov, targetFov, 7, dt);
        this.perspCamera.updateProjectionMatrix();
      }
      return;
    }

    if (this.cameraMode === 'cab') {
      // 1st-Person Driver Cab view looking over hood & modular plow blade
      const bodyBounce = this.truckRig.bodyPivot.position.y;
      const eyeX = this.truckX + fwdX * 0.16 + shakeX * 0.35;
      const eyeY = 1.5 + bodyBounce + shakeY * 0.35;
      const eyeZ = this.truckZ + fwdZ * 0.16;

      this.perspCamera.position.set(eyeX, eyeY, eyeZ);
      this.camTargetX = this.truckX + fwdX * 14;
      this.camTargetZ = this.truckZ + fwdZ * 14;
      _vec3B.set(this.camTargetX, 0.45 + bodyBounce * 0.5, this.camTargetZ);
      this.perspCamera.lookAt(_vec3B);

      const targetFov = isBoosting ? 74 : 68;
      if (Math.abs(this.perspCamera.fov - targetFov) > 0.05) {
        this.perspCamera.fov = THREE.MathUtils.damp(this.perspCamera.fov, targetFov, 8, dt);
        this.perspCamera.updateProjectionMatrix();
      }
      return;
    }

    // Classic Isometric Orthographic Follow
    const leadX = fwdX * this.truckSpeed * 0.25;
    const leadZ = fwdZ * this.truckSpeed * 0.25;
    this.camTargetX = THREE.MathUtils.damp(this.camTargetX, this.truckX + leadX, 5.8, dt);
    this.camTargetZ = THREE.MathUtils.damp(this.camTargetZ, this.truckZ + leadZ, 5.8, dt);

    _vec3A.set(this.camTargetX + 28 + shakeX, 25 + shakeY, this.camTargetZ + 28);
    this.orthoCamera.position.lerp(_vec3A, 1 - Math.exp(-8 * dt));
    _vec3B.set(this.camTargetX, 0.4, this.camTargetZ);
    this.orthoCamera.lookAt(_vec3B);
  }

  private stepDynamicWeather(dt: number): void {
    const isHard = this.activeContract.difficulty === 'hard';
    if (this.phase === 'playing') {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        const pool: WeatherIntensity[] = isHard
          ? ['flurries', 'snowfall', 'blizzard', 'blizzard']
          : this.activeContract.index >= 1
          ? ['clear', 'flurries', 'snowfall', 'blizzard']
          : ['clear', 'flurries', 'snowfall'];
        const candidates = pool.filter((w) => w !== this.weatherIntensity);
        const next = candidates[Math.floor(Math.random() * candidates.length)] ?? 'flurries';
        this.weatherIntensity = next;
        const profile = WEATHER_PROFILES[next];
        this.weatherTimer = profile.durationMin + Math.random() * (profile.durationMax - profile.durationMin);
        this.weatherAngle += (Math.random() - 0.5) * 1.4;

        if (next === 'blizzard') {
          this.pushCallout('Heavy Blizzard! Low Tire Traction', 'cyan');
        } else if (next === 'snowfall') {
          this.pushCallout('Steady Snowfall Â· Slick Roads', 'cyan');
        } else if (next === 'flurries') {
          this.pushCallout('Light Flurries', 'amber');
        } else {
          this.pushCallout('Skies Clearing Â· Full Traction', 'amber');
        }
      }
    }

    const target = WEATHER_PROFILES[this.weatherIntensity];
    const targetWindX = Math.cos(this.weatherAngle) * target.windSpeed;
    const targetWindZ = Math.sin(this.weatherAngle) * target.windSpeed;

    this.currentSnowRate = THREE.MathUtils.damp(this.currentSnowRate, target.snowRate, 0.85, dt);
    this.currentWindX = THREE.MathUtils.damp(this.currentWindX, targetWindX, 0.85, dt);
    this.currentWindZ = THREE.MathUtils.damp(this.currentWindZ, targetWindZ, 0.85, dt);
    this.currentRoadGrip = THREE.MathUtils.damp(this.currentRoadGrip, target.roadGrip, 0.9, dt);
    this.currentTractionSlip = THREE.MathUtils.damp(this.currentTractionSlip, target.tractionSlip, 0.9, dt);
    this.currentFogDensity = THREE.MathUtils.damp(this.currentFogDensity, target.fogDensity, 0.85, dt);

    this.particles.setWeatherState(this.currentSnowRate, this.currentWindX, this.currentWindZ);
    this.sound.setWeatherWind(this.phase === 'playing' ? (this.currentSnowRate - 0.15) / 0.85 : 0);

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.currentFogDensity;
    }
  }

  private emitHudSnapshot(): void {
    const clearPct = this.snowField.getClearPercentage();
    const grace = this.getComboGraceDuration();
    const allShops: LiveShopStatus[] = (this.neighborhood?.shopsRuntime ?? []).map((sr) => ({
      id: sr.spec.id,
      name: sr.spec.name,
      category: sr.spec.category,
      crowdCount: this.npcManager.getShopCrowdCount(sr.spec.id),
      apronCleared: sr.apronCleared,
      tipClaimed: sr.tipClaimed,
    }));
    const nearbyShop = this.findNearbyShop();

    const underfootSnow = this.snowField.sampleSnowAt(this.truckX, this.truckZ);
    const roadSurfaceGrip = underfootSnow < 0.08 ? 1.0 : 0.86;
    const effectiveGrip = THREE.MathUtils.clamp(
      this.currentRoadGrip * roadSurfaceGrip + this.upgrades.engine * 0.055,
      0.38,
      1.0
    );

    this.callbacks.onStatsUpdate({
      contractIndex: this.activeContract.index,
      difficulty: this.activeContract.difficulty,
      clearPercent: clearPct,
      targetPercent: this.activeContract.targetPercent,
      masteryPercent: this.activeContract.masteryPercent,
      comboMultiplier: this.comboMultiplier,
      comboTimerRatio: this.comboTimer > 0 ? THREE.MathUtils.clamp(this.comboTimer / grace, 0, 1) : 0,
      comboScoreStreak: Math.round(this.comboCharge),
      peakCombo: this.peakCombo,
      coinsEarnedThisRun: this.coinsEarnedThisRun,
      boostEnergy: this.boostEnergy,
      isBoosting: this.boostActiveTimer > 0,
      elapsedSeconds: this.elapsedSeconds,
      priorityCleared: this.priorityCleared,
      priorityTotal: this.activeContract.priorityZones.length,
      contractReadyToFinish: clearPct >= this.activeContract.targetPercent,
      lastCallout: this.lastCallout,
      policeChaseActive: this.policeChaseActive,
      policeChaseRemaining: this.policeChaseRemaining,
      npcHitsCount: this.npcHitsCount,
      pendingFine: this.npcHitsCount * FINE_PER_NPC,
      nearbyShop,
      allShops,
      weatherIntensity: this.weatherIntensity,
      weatherLabel: WEATHER_PROFILES[this.weatherIntensity].label,
      roadGripPercent: Math.round(effectiveGrip * 100),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();

    this.sound.dispose();
    this.truckRig.dispose();
    this.npcManager.dispose();
    this.snowField.dispose();
    this.particles.dispose();
    this.neighborhood?.dispose();
    this.assistRingMesh.geometry.dispose();
    this.assistRingMat.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

