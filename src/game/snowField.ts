import * as THREE from 'three';
import { ContractDefinition, RoadCircle, RoadSegment } from './types';

export const WORLD_SIZE = 72;
export const GRID_RES = 192;
export const MAX_SNOW_DEPTH = 2.5;

export interface SnowClearResult {
  clearedAmount: number;
  flingCount: number;
  avgFlingX: number;
  avgFlingZ: number;
  heavyBermImpact: number;
  maxBankDepth: number;
  breachedHeavyBank: boolean;
  breachX: number;
  breachZ: number;
  bladeLoadSignal: number;
}

function distToSegment(px: number, pz: number, seg: RoadSegment): number {
  const vx = seg.x2 - seg.x1;
  const vz = seg.z2 - seg.z1;
  const wx = px - seg.x1;
  const wz = pz - seg.z1;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq)) : 0;
  const projX = seg.x1 + t * vx;
  const projZ = seg.z1 + t * vz;
  return Math.hypot(px - projX, pz - projZ);
}

function distToCircle(px: number, pz: number, c: RoadCircle): number {
  return Math.hypot(px - c.x, pz - c.z);
}

export class SnowField {
  public readonly group = new THREE.Group();
  private readonly snowDepth = new Float32Array(GRID_RES * GRID_RES);
  private readonly initialPlowableDepth = new Float32Array(GRID_RES * GRID_RES);
  private readonly bermFactor = new Float32Array(GRID_RES * GRID_RES);
  private readonly saltGlow = new Float32Array(GRID_RES * GRID_RES);
  private readonly plowableMask = new Uint8Array(GRID_RES * GRID_RES);
  private readonly curbMask = new Uint8Array(GRID_RES * GRID_RES);
  private readonly noBermMask = new Uint8Array(GRID_RES * GRID_RES);
  private readonly surfaceKind = new Uint8Array(GRID_RES * GRID_RES);
  private readonly texData = new Uint8Array(GRID_RES * GRID_RES * 4);
  private readonly snowDataTex: THREE.DataTexture;

  private groundTex: THREE.CanvasTexture;
  private groundMesh: THREE.Mesh;
  private snowMesh: THREE.Mesh;
  private snowMaterial: THREE.MeshStandardMaterial;
  private groundMaterial: THREE.MeshStandardMaterial;

  private snowUniforms: {
    uTime: { value: number };
    uAssistHighlight: { value: number };
  } = {
    uTime: { value: 0 },
    uAssistHighlight: { value: 0 },
  };

  private totalInitialPlowableSnow = 1;
  private currentPlowableSnow = 1;
  private textureDirty = true;

  constructor(maxAnisotropy: number) {
    this.snowDataTex = new THREE.DataTexture(this.texData, GRID_RES, GRID_RES, THREE.RGBAFormat);
    this.snowDataTex.minFilter = THREE.LinearFilter;
    this.snowDataTex.magFilter = THREE.LinearFilter;
    this.snowDataTex.wrapS = THREE.ClampToEdgeWrapping;
    this.snowDataTex.wrapT = THREE.ClampToEdgeWrapping;
    this.snowDataTex.needsUpdate = true;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    this.groundTex = new THREE.CanvasTexture(canvas);
    this.groundTex.colorSpace = THREE.SRGBColorSpace;
    this.groundTex.anisotropy = maxAnisotropy;

    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: this.groundTex,
      roughness: 0.72,
      metalness: 0.08,
    });

    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMaterial);
    this.groundMesh.position.y = 0.0;
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xeaf1f8,
      roughness: 0.84,
      metalness: 0.02,
      transparent: false,
    });

    const cellWorldSize = WORLD_SIZE / (GRID_RES - 1);

    this.snowMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uSnowMap = { value: this.snowDataTex };
      shader.uniforms.uTexelSize = { value: 1 / GRID_RES };
      shader.uniforms.uCellWorldSize = { value: cellWorldSize };
      shader.uniforms.uTime = this.snowUniforms.uTime;
      shader.uniforms.uAssistHighlight = this.snowUniforms.uAssistHighlight;

      const vertexHelpers = `
        uniform sampler2D uSnowMap;
        uniform float uTexelSize;
        uniform float uCellWorldSize;
        varying float vSnowDepth;
        varying float vBermFactor;
        varying float vSaltGlow;
        varying float vIsPlowable;
        varying vec2 vSnowUv;

        float computeSnowHeight(float depthNorm, float berm) {
          float d = depthNorm * ${MAX_SNOW_DEPTH.toFixed(1)};
          float lowH = mix(-0.09, 0.035, clamp(d / 0.04, 0.0, 1.0));
          float highH = 0.035 + pow(max(d, 0.0), 0.88) * 0.44 + berm * smoothstep(0.55, 1.55, d) * 0.18;
          return mix(lowH, highH, step(0.04, d));
        }
      `;

      shader.vertexShader = vertexHelpers + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
          #include <beginnormal_vertex>
          vec2 nUv = vec2(uv.x, 1.0 - uv.y);
          vec4 sL = texture2D(uSnowMap, nUv - vec2(uTexelSize, 0.0));
          vec4 sR = texture2D(uSnowMap, nUv + vec2(uTexelSize, 0.0));
          vec4 sD = texture2D(uSnowMap, nUv - vec2(0.0, uTexelSize));
          vec4 sU = texture2D(uSnowMap, nUv + vec2(0.0, uTexelSize));
          float hL = computeSnowHeight(sL.r, sL.g);
          float hR = computeSnowHeight(sR.r, sR.g);
          float hD = computeSnowHeight(sD.r, sD.g);
          float hU = computeSnowHeight(sU.r, sU.g);
          objectNormal = normalize(vec3(hL - hR, 2.0 * uCellWorldSize, hD - hU));
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          vec2 sUv = vec2(uv.x, 1.0 - uv.y);
          vSnowUv = sUv;
          vec4 snowSample = texture2D(uSnowMap, sUv);
          vSnowDepth = snowSample.r * ${MAX_SNOW_DEPTH.toFixed(1)};
          vBermFactor = snowSample.g;
          vIsPlowable = step(0.55, snowSample.b);
          vSaltGlow = clamp((snowSample.b - 0.62) / 0.38, 0.0, 1.0);
          transformed.y += computeSnowHeight(snowSample.r, snowSample.g);
        `
      );

      shader.fragmentShader =
        `
        uniform sampler2D uSnowMap;
        uniform float uTexelSize;
        uniform float uTime;
        uniform float uAssistHighlight;
        varying float vSnowDepth;
        varying float vBermFactor;
        varying float vSaltGlow;
        varying float vIsPlowable;
        varying vec2 vSnowUv;
      ` +
        shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            float dC = vSnowDepth / ${MAX_SNOW_DEPTH.toFixed(1)};
            float dL = texture2D(uSnowMap, vSnowUv - vec2(uTexelSize, 0.0)).r;
            float dR = texture2D(uSnowMap, vSnowUv + vec2(uTexelSize, 0.0)).r;
            float dD = texture2D(uSnowMap, vSnowUv - vec2(0.0, uTexelSize)).r;
            float dU = texture2D(uSnowMap, vSnowUv + vec2(0.0, uTexelSize)).r;
            float slope = clamp((abs(dR - dL) + abs(dU - dD)) * 3.4, 0.0, 1.0);
            float crest = clamp(dC * 4.0 - (dL + dR + dD + dU), -0.35, 0.45);

            vec3 crispSnow = vec3(0.95, 0.97, 1.0);
            vec3 deepTint = vec3(0.80, 0.87, 0.97);
            vec3 bermCoreTint = vec3(0.66, 0.78, 0.94);
            vec3 sunCrestTint = vec3(1.0, 0.98, 0.93);

            // Base depth & piled berm shading
            diffuseColor.rgb = mix(crispSnow, deepTint, clamp((vSnowDepth - 0.55) * 0.75, 0.0, 0.85));
            diffuseColor.rgb = mix(diffuseColor.rgb, bermCoreTint, vBermFactor * 0.46 + slope * 0.28);

            // Sunlit ridge crest highlights & carved berm base AO
            float crestGlow = smoothstep(0.02, 0.22, crest) * (0.35 + vBermFactor * 0.65);
            diffuseColor.rgb = mix(diffuseColor.rgb, sunCrestTint, crestGlow * 0.48);
            float troughAO = smoothstep(0.02, 0.22, -crest);
            diffuseColor.rgb *= (1.0 - troughAO * 0.16);

            // Subtle crystalline powder grain
            float grain = fract(sin(dot(floor(vSnowUv * 380.0), vec2(12.9898, 78.233))) * 43758.5453);
            diffuseColor.rgb *= (0.975 + grain * 0.045);

            if (vSaltGlow > 0.04) {
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64, 0.81, 0.95), vSaltGlow * 0.4);
            }

            // Last-15% Mastery Assist: highlight remaining unplowed road patches clearly
            if (uAssistHighlight > 0.01 && vIsPlowable > 0.6 && vSnowDepth > 0.025) {
              float shimmer = 0.5 + 0.5 * sin(uTime * 5.2 + vSnowUv.x * 32.0 + vSnowUv.y * 32.0);
              vec3 highlightCol = mix(vec3(0.22, 0.78, 0.98), vec3(0.98, 0.74, 0.22), shimmer * 0.45);
              diffuseColor.rgb = mix(diffuseColor.rgb, highlightCol, uAssistHighlight * (0.34 + shimmer * 0.32));
            }
            `
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `
            #include <roughnessmap_fragment>
            roughnessFactor = clamp(roughnessFactor - vBermFactor * 0.24 - vSaltGlow * 0.18, 0.40, 0.92);
            `
          );
    };

    const snowGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_RES, GRID_RES);
    snowGeo.rotateX(-Math.PI / 2);
    this.snowMesh = new THREE.Mesh(snowGeo, this.snowMaterial);
    this.snowMesh.position.y = 0.02;
    this.snowMesh.receiveShadow = true;
    this.snowMesh.castShadow = false;
    this.group.add(this.snowMesh);
  }

  public loadContract(contract: ContractDefinition): void {
    this.plowableMask.fill(0);
    this.curbMask.fill(0);
    this.noBermMask.fill(0);
    this.surfaceKind.fill(0);
    this.snowDepth.fill(0);
    this.initialPlowableDepth.fill(0);
    this.bermFactor.fill(0);
    this.saltGlow.fill(0);
    this.snowUniforms.uAssistHighlight.value = 0;

    let totalSnow = 0;

    for (let gz = 0; gz < GRID_RES; gz++) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = 0; gx < GRID_RES; gx++) {
        const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
        const idx = gz * GRID_RES + gx;

        // Protect cottage and open shop interiors/porches from high berm spikes
        for (const cot of contract.cottages) {
          const dx = wx - cot.x;
          const dz = wz - cot.z;
          const cos = Math.cos(-cot.rotY);
          const sin = Math.sin(-cot.rotY);
          const lx = dx * cos - dz * sin;
          const lz = dx * sin + dz * cos;
          const s = cot.scale ?? 1;
          if (Math.abs(lx) <= 3.5 * s && Math.abs(lz) <= 2.9 * s) {
            this.noBermMask[idx] = 1;
            break;
          }
        }
        if (this.noBermMask[idx] === 0) {
          for (const shop of contract.shops) {
            const dx = wx - shop.x;
            const dz = wz - shop.z;
            const cos = Math.cos(-shop.rotY);
            const sin = Math.sin(-shop.rotY);
            const lx = dx * cos - dz * sin;
            const lz = dx * sin + dz * cos;
            if (Math.abs(lx) <= 3.7 && lz >= -2.5 && lz <= 4.1) {
              this.noBermMask[idx] = 1;
              break;
            }
          }
        }

        let kind = 0;
        let minOutsideEdgeDist = Infinity;
        let minInsideEdgeDist = Infinity;

        for (const seg of contract.roads) {
          const d = distToSegment(wx, wz, seg);
          if (d <= seg.halfWidth) {
            kind = seg.surface === 'cobble' ? 2 : 1;
            minInsideEdgeDist = Math.min(minInsideEdgeDist, seg.halfWidth - d);
          } else {
            minOutsideEdgeDist = Math.min(minOutsideEdgeDist, d - seg.halfWidth);
          }
        }
        for (const c of contract.circles) {
          const d = distToCircle(wx, wz, c);
          if (d <= c.radius) {
            kind = c.surface === 'cobble' ? 2 : 1;
            minInsideEdgeDist = Math.min(minInsideEdgeDist, c.radius - d);
          } else {
            minOutsideEdgeDist = Math.min(minOutsideEdgeDist, d - c.radius);
          }
        }

        this.surfaceKind[idx] = kind;

        const isHard = contract.difficulty === 'hard';
        const driftWave =
          Math.sin(wx * 0.22 + contract.index) * Math.cos(wz * 0.19 - contract.index) * (isHard ? 0.28 : 0.18) +
          Math.sin((wx + wz) * 0.43) * (isHard ? 0.14 : 0.08);
        const hardRidge =
          isHard ? Math.max(0, Math.sin((wx * 0.16 - wz * 0.14) + contract.index * 1.1) - 0.35) * 0.85 : 0;

        if (kind > 0) {
          this.plowableMask[idx] = 1;
          // Subtle natural curb-edge drift along outer 0.85m of roads and driveway aprons
          const edgeDrift =
            minInsideEdgeDist < 0.85
              ? (1 - minInsideEdgeDist / 0.85) * (isHard ? 0.34 : 0.22) * contract.snowDepthScale
              : 0;
          const depth = THREE.MathUtils.clamp(
            (0.68 + driftWave) * contract.snowDepthScale + edgeDrift + hardRidge,
            0.38,
            isHard ? 1.72 : 1.28
          );
          this.snowDepth[idx] = depth;
          this.initialPlowableDepth[idx] = depth;
          if (hardRidge > 0.28) {
            this.bermFactor[idx] = Math.min(0.65, hardRidge * 0.9);
          }
          totalSnow += depth;
        } else {
          if (minOutsideEdgeDist <= 2.8 && this.noBermMask[idx] === 0) {
            const curbWeight = 1 - minOutsideEdgeDist / 2.8;
            this.curbMask[idx] = Math.round(curbWeight * 255);
          }
          const curbLift = (this.curbMask[idx] / 255) * (isHard ? 0.26 : 0.18) * contract.snowDepthScale;
          const yardDepth =
            this.noBermMask[idx] === 1 && Math.abs(wx) < 35 && Math.abs(wz) < 35
              ? 0.05
              : THREE.MathUtils.clamp(0.55 + driftWave * 0.9 + curbLift + hardRidge * 0.45, 0.34, isHard ? 1.5 : 1.15);
          this.snowDepth[idx] = yardDepth;
          this.initialPlowableDepth[idx] = yardDepth;
          if (curbLift > 0.08) {
            this.bermFactor[idx] = isHard ? 0.32 : 0.2;
          }
        }
      }
    }

    this.totalInitialPlowableSnow = Math.max(1, totalSnow);
    this.currentPlowableSnow = totalSnow;
    this.paintGroundCanvas(contract);
    this.textureDirty = true;
    this.syncDataTexture();
  }

  private paintGroundCanvas(contract: ContractDefinition): void {
    const canvas = this.groundTex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const toPx = (w: number) => ((w / WORLD_SIZE) + 0.5) * size;
    const scalePx = size / WORLD_SIZE;

    ctx.fillStyle = '#24302d';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2400; i++) {
      const rx = (i * 73856093) % size;
      const ry = (i * 19349663) % size;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(42, 58, 52, 0.45)' : 'rgba(26, 35, 38, 0.45)';
      ctx.fillRect(rx, ry, 4, 4);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of contract.roads) {
      ctx.strokeStyle = seg.surface === 'cobble' ? '#56504b' : '#3d4554';
      ctx.lineWidth = (seg.halfWidth * 2 + 0.55) * scalePx;
      ctx.beginPath();
      ctx.moveTo(toPx(seg.x1), toPx(seg.z1));
      ctx.lineTo(toPx(seg.x2), toPx(seg.z2));
      ctx.stroke();
    }
    for (const c of contract.circles) {
      ctx.fillStyle = c.surface === 'cobble' ? '#56504b' : '#3d4554';
      ctx.beginPath();
      ctx.arc(toPx(c.x), toPx(c.z), (c.radius + 0.3) * scalePx, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const seg of contract.roads) {
      ctx.strokeStyle = seg.surface === 'cobble' ? '#3b3c46' : '#252c38';
      ctx.lineWidth = seg.halfWidth * 2 * scalePx;
      ctx.beginPath();
      ctx.moveTo(toPx(seg.x1), toPx(seg.z1));
      ctx.lineTo(toPx(seg.x2), toPx(seg.z2));
      ctx.stroke();
    }
    for (const c of contract.circles) {
      ctx.fillStyle = c.surface === 'cobble' ? '#3e3d47' : '#252c38';
      ctx.beginPath();
      ctx.arc(toPx(c.x), toPx(c.z), c.radius * scalePx, 0, Math.PI * 2);
      ctx.fill();

      if (c.surface === 'cobble') {
        ctx.strokeStyle = 'rgba(245, 194, 110, 0.16)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(toPx(c.x), toPx(c.z), c.radius * 0.72 * scalePx, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(235, 185, 84, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 12]);
    for (const seg of contract.roads) {
      if (seg.surface === 'asphalt') {
        ctx.beginPath();
        ctx.moveTo(toPx(seg.x1), toPx(seg.z1));
        ctx.lineTo(toPx(seg.x2), toPx(seg.z2));
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 240, 215, 0.06)';
    for (const seg of contract.roads) {
      if (seg.surface !== 'cobble') continue;
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = THREE.MathUtils.lerp(seg.x1, seg.x2, t);
        const cz = THREE.MathUtils.lerp(seg.z1, seg.z2, t);
        ctx.fillRect(toPx(cx) - 4, toPx(cz) - 4, 8, 8);
      }
    }

    this.groundTex.needsUpdate = true;
  }

  private depositSnowKernel(
    wx: number,
    wz: number,
    amount: number,
    isBoosting: boolean,
    isForwardWave: boolean
  ): void {
    if (amount <= 0.0005) return;
    const cgx = Math.round(((wx / WORLD_SIZE) + 0.5) * (GRID_RES - 1));
    const cgz = Math.round(((wz / WORLD_SIZE) + 0.5) * (GRID_RES - 1));

    const offsets: Array<[number, number, number]> = [
      [0, 0, 0.44],
      [-1, 0, 0.14],
      [1, 0, 0.14],
      [0, -1, 0.14],
      [0, 1, 0.14],
    ];

    for (let k = 0; k < offsets.length; k++) {
      const gx = cgx + offsets[k][0];
      const gz = cgz + offsets[k][1];
      if (gx < 1 || gx >= GRID_RES - 1 || gz < 1 || gz >= GRID_RES - 1) continue;

      const tIdx = gz * GRID_RES + gx;
      if (this.noBermMask[tIdx] === 1) continue;

      const isRoad = this.plowableMask[tIdx] === 1;
      const isCurb = this.curbMask[tIdx] > 0;
      const maxCap = isRoad
        ? isForwardWave
          ? 1.55
          : 1.45
        : isCurb
        ? 2.45
        : 1.4;

      const room = Math.max(0, maxCap - this.snowDepth[tIdx]);
      if (room <= 0.0001) continue;

      const addAmt = Math.min(room, amount * offsets[k][2]);
      this.snowDepth[tIdx] += addAmt;
      this.bermFactor[tIdx] = Math.min(1, this.bermFactor[tIdx] + addAmt * (isBoosting ? 0.65 : 1.25));
      if (isRoad) {
        this.currentPlowableSnow += addAmt;
      }
      this.textureDirty = true;
    }
  }

  public plowBlade(
    bladeX: number,
    bladeZ: number,
    forwardX: number,
    forwardZ: number,
    halfWidth: number,
    power: number,
    isBoosting: boolean,
    bladeLevel = 0
  ): SnowClearResult {
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const cellSize = WORLD_SIZE / (GRID_RES - 1);
    const fwdReach = isBoosting ? 1.12 : 0.88;
    const searchRadius = halfWidth + 1.35;

    const minGx = Math.max(1, Math.floor(((bladeX - searchRadius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGx = Math.min(GRID_RES - 2, Math.ceil(((bladeX + searchRadius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const minGz = Math.max(1, Math.floor(((bladeZ - searchRadius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGz = Math.min(GRID_RES - 2, Math.ceil(((bladeZ + searchRadius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));

    let clearedTotal = 0;
    let flingCount = 0;
    let sumFlingX = 0;
    let sumFlingZ = 0;
    let heavyBermCells = 0;
    let maxBankDepth = 0;
    let breachSumX = 0;
    let breachSumZ = 0;
    let bladeLoadSignal = 0;

    for (let gz = minGz; gz <= maxGz; gz++) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;

        const dx = wx - bladeX;
        const dz = wz - bladeZ;
        const localRight = dx * rightX + dz * rightZ;
        const localFwd = dx * forwardX + dz * forwardZ;

        if (Math.abs(localRight) <= halfWidth && Math.abs(localFwd) <= fwdReach) {
          const idx = gz * GRID_RES + gx;
          const cur = this.snowDepth[idx];
          if (cur > 0.015) {
            const curBerm = this.bermFactor[idx];
            const isHeavyBank = cur >= 0.96 || (curBerm >= 0.42 && cur >= 0.78);
            if (isHeavyBank) {
              heavyBermCells++;
              if (cur > maxBankDepth) maxBankDepth = cur;
              breachSumX += wx;
              breachSumZ += wz;
            }

            // Without boost, thick piled snowbanks slow the blade and require multiple passes or boost;
            // With Boost active, the blade blasts straight through massive banks cleanly!
            const effectivePower = isBoosting
              ? 1.0
              : cur >= 1.35
              ? Math.min(power, 0.28 + bladeLevel * 0.06)
              : isHeavyBank
              ? Math.min(power, 0.48 + bladeLevel * 0.06)
              : power;

            const removed = Math.min(cur, cur * effectivePower);
            const nextDepth = cur - removed < 0.036 ? 0 : cur - removed;
            const actualRemoved = cur - nextDepth;
            this.snowDepth[idx] = nextDepth;
            this.bermFactor[idx] = nextDepth === 0 ? 0 : curBerm * (nextDepth / cur);

            if (this.plowableMask[idx] === 1) {
              this.currentPlowableSnow = Math.max(0, this.currentPlowableSnow - actualRemoved);
              clearedTotal += actualRemoved;
            } else {
              clearedTotal += actualRemoved * 0.28;
            }
            bladeLoadSignal += actualRemoved;

            if (actualRemoved > 0.045) {
              flingCount++;
              sumFlingX += wx;
              sumFlingZ += wz;
            }

            // 1. Lateral Berm Windrow: deposit snow along the blade discharge edges (curbs & driveways)
            const sideSign =
              bladeLevel >= 2
                ? localRight >= 0
                  ? 1
                  : -1
                : localRight >= -halfWidth * 0.4
                ? 1
                : -1;

            const lateralSpan = halfWidth + cellSize * (isBoosting ? 3.2 : 1.35);
            const bermWx = bladeX + rightX * sideSign * lateralSpan + forwardX * (localFwd * 0.4 + 0.45);
            const bermWz = bladeZ + rightZ * sideSign * lateralSpan + forwardZ * (localFwd * 0.4 + 0.45);
            this.depositSnowKernel(
              bermWx,
              bermWz,
              actualRemoved * (isBoosting ? 0.16 : 0.48),
              isBoosting,
              false
            );

            // 2. Forward Bow-Wave Pile-Up: pushes snow ahead into driveway dead-ends & curbs
            if (!isBoosting && actualRemoved > 0.025) {
              const fwdWx = wx + forwardX * (cellSize * 2.5);
              const fwdWz = wz + forwardZ * (cellSize * 2.5);
              this.depositSnowKernel(fwdWx, fwdWz, actualRemoved * 0.16, false, true);
            }

            this.textureDirty = true;
          }
        }
      }
    }

    const breachedHeavyBank = isBoosting && heavyBermCells >= 3;

    return {
      clearedAmount: clearedTotal,
      flingCount,
      avgFlingX: flingCount > 0 ? sumFlingX / flingCount : bladeX,
      avgFlingZ: flingCount > 0 ? sumFlingZ / flingCount : bladeZ,
      heavyBermImpact: isBoosting ? 0 : Math.min(1, heavyBermCells / 12 + Math.max(0, maxBankDepth - 1.0) * 0.35),
      maxBankDepth,
      breachedHeavyBank,
      breachX: heavyBermCells > 0 ? breachSumX / heavyBermCells : bladeX,
      breachZ: heavyBermCells > 0 ? breachSumZ / heavyBermCells : bladeZ,
      bladeLoadSignal,
    };
  }

  public applySaltTrail(rearX: number, rearZ: number, radius: number, meltRate: number): number {
    const minGx = Math.max(0, Math.floor(((rearX - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGx = Math.min(GRID_RES - 1, Math.ceil(((rearX + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const minGz = Math.max(0, Math.floor(((rearZ - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGz = Math.min(GRID_RES - 1, Math.ceil(((rearZ + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const rSq = radius * radius;
    let cleared = 0;

    for (let gz = minGz; gz <= maxGz; gz++) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
        const dSq = (wx - rearX) * (wx - rearX) + (wz - rearZ) * (wz - rearZ);
        if (dSq <= rSq) {
          const idx = gz * GRID_RES + gx;
          if (this.plowableMask[idx] === 1 && this.snowDepth[idx] > 0) {
            const falloff = 1 - Math.sqrt(dSq) / radius;
            const cur = this.snowDepth[idx];
            const amt = Math.min(cur, meltRate * falloff);
            const next = cur - amt < 0.04 ? 0 : cur - amt;
            const actual = cur - next;
            this.snowDepth[idx] = next;
            if (next === 0) {
              this.bermFactor[idx] = 0;
            } else {
              this.bermFactor[idx] *= next / cur;
            }
            this.currentPlowableSnow = Math.max(0, this.currentPlowableSnow - actual);
            cleared += actual;
            this.saltGlow[idx] = Math.max(this.saltGlow[idx], falloff * 0.9);
            this.textureDirty = true;
          }
        }
      }
    }
    return cleared;
  }

  /**
   * Last-12% Magnet / Curb Auto-Clean Assist:
   * Gently sweeps thin residual curb specks within radius so 3-star mastery feels rewarding, not tedious.
   */
  public applyEdgeMagnetCleanup(cx: number, cz: number, radius: number, maxThickness: number, meltStrength: number): number {
    const minGx = Math.max(0, Math.floor(((cx - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGx = Math.min(GRID_RES - 1, Math.ceil(((cx + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const minGz = Math.max(0, Math.floor(((cz - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGz = Math.min(GRID_RES - 1, Math.ceil(((cz + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const rSq = radius * radius;
    let cleared = 0;

    for (let gz = minGz; gz <= maxGz; gz++) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
        const dSq = (wx - cx) * (wx - cx) + (wz - cz) * (wz - cz);
        if (dSq <= rSq) {
          const idx = gz * GRID_RES + gx;
          const depth = this.snowDepth[idx];
          if (this.plowableMask[idx] === 1 && depth > 0 && depth <= maxThickness) {
            const amt = Math.min(depth, meltStrength);
            this.snowDepth[idx] = depth - amt < 0.045 ? 0 : depth - amt;
            const actual = depth - this.snowDepth[idx];
            if (this.snowDepth[idx] === 0) this.bermFactor[idx] = 0;
            this.currentPlowableSnow = Math.max(0, this.currentPlowableSnow - actual);
            cleared += actual;
            this.textureDirty = true;
          }
        }
      }
    }
    return cleared;
  }

  public findNearestUnplowedPatch(fromX: number, fromZ: number): { x: number; z: number } | null {
    let bestDistSq = Infinity;
    let bestX = 0;
    let bestZ = 0;
    let found = false;

    for (let gz = 0; gz < GRID_RES; gz += 2) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = 0; gx < GRID_RES; gx += 2) {
        const idx = gz * GRID_RES + gx;
        if (this.plowableMask[idx] === 1 && this.snowDepth[idx] > 0.06) {
          const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
          const dSq = (wx - fromX) * (wx - fromX) + (wz - fromZ) * (wz - fromZ);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestX = wx;
            bestZ = wz;
            found = true;
          }
        }
      }
    }
    return found ? { x: bestX, z: bestZ } : null;
  }

  public sampleSnowAt(wx: number, wz: number): number {
    const gx = Math.max(0, Math.min(GRID_RES - 1, Math.round(((wx / WORLD_SIZE) + 0.5) * (GRID_RES - 1))));
    const gz = Math.max(0, Math.min(GRID_RES - 1, Math.round(((wz / WORLD_SIZE) + 0.5) * (GRID_RES - 1))));
    return this.snowDepth[gz * GRID_RES + gx];
  }

  public sampleCircleClearedRatio(cx: number, cz: number, radius: number): number {
    const minGx = Math.max(0, Math.floor(((cx - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGx = Math.min(GRID_RES - 1, Math.ceil(((cx + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const minGz = Math.max(0, Math.floor(((cz - radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const maxGz = Math.min(GRID_RES - 1, Math.ceil(((cz + radius) / WORLD_SIZE + 0.5) * (GRID_RES - 1)));
    const rSq = radius * radius;
    let initSum = 0;
    let remSum = 0;

    for (let gz = minGz; gz <= maxGz; gz++) {
      const wz = (gz / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = (gx / (GRID_RES - 1) - 0.5) * WORLD_SIZE;
        if ((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz) <= rSq) {
          const idx = gz * GRID_RES + gx;
          if (this.plowableMask[idx] === 1) {
            initSum += this.initialPlowableDepth[idx];
            remSum += this.snowDepth[idx];
          }
        }
      }
    }
    if (initSum <= 0.001) return 1;
    return THREE.MathUtils.clamp(1 - remSum / initSum, 0, 1);
  }

  public getClearPercentage(): number {
    const pct = (1 - this.currentPlowableSnow / this.totalInitialPlowableSnow) * 100;
    return THREE.MathUtils.clamp(pct, 0, 100);
  }

  public updateVisualUniforms(elapsed: number, dt: number, clearPercent: number): void {
    this.snowUniforms.uTime.value = elapsed;
    const targetAssist = clearPercent >= 85 ? 1.0 : 0.0;
    this.snowUniforms.uAssistHighlight.value = THREE.MathUtils.damp(
      this.snowUniforms.uAssistHighlight.value,
      targetAssist,
      4.5,
      dt
    );
  }

  public syncDataTexture(): void {
    if (!this.textureDirty) return;
    let anySaltActive = false;
    for (let i = 0; i < GRID_RES * GRID_RES; i++) {
      const d = THREE.MathUtils.clamp(this.snowDepth[i] / MAX_SNOW_DEPTH, 0, 1);
      this.texData[i * 4] = Math.round(d * 255);
      this.texData[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(this.bermFactor[i], 0, 1) * 255);

      if (this.saltGlow[i] > 0.01) {
        this.saltGlow[i] = Math.max(0, this.saltGlow[i] - 0.015);
        anySaltActive = true;
      }

      // Blue channel: >=160 means plowable road/driveway (with salt glow encoded in 160..255);
      // <=115 means non-plowable curb/yard (with curb proximity in 0..115)
      if (this.plowableMask[i] === 1) {
        this.texData[i * 4 + 2] = 160 + Math.round(THREE.MathUtils.clamp(this.saltGlow[i], 0, 1) * 95);
      } else {
        this.texData[i * 4 + 2] = Math.round((this.curbMask[i] / 255) * 115);
      }
      this.texData[i * 4 + 3] = 255;
    }
    this.snowDataTex.needsUpdate = true;
    this.textureDirty = anySaltActive;
  }

  public markDirty(): void {
    this.textureDirty = true;
  }

  public dispose(): void {
    this.snowDataTex.dispose();
    this.groundTex.dispose();
    this.groundMesh.geometry.dispose();
    this.groundMaterial.dispose();
    this.snowMesh.geometry.dispose();
    this.snowMaterial.dispose();
  }
}
