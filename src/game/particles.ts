import * as THREE from 'three';

interface ClumpParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  kind: number; // 0 = snow clump, 1 = amber/cyan boost spark, 2 = chimney/exhaust puff
}

const MAX_CLUMPS = 240;
const SNOWFLAKE_COUNT = 900;

export class ParticlePool {
  public readonly group = new THREE.Group();
  private readonly clumps: ClumpParticle[] = [];
  private readonly clumpMesh: THREE.InstancedMesh;
  private readonly clumpGeo: THREE.BufferGeometry;
  private readonly clumpMat: THREE.MeshStandardMaterial;

  private readonly snowflakeMesh: THREE.InstancedMesh;
  private readonly snowflakeGeo: THREE.BufferGeometry;
  private readonly snowflakeMat: THREE.MeshBasicMaterial;
  private readonly flakePos = new Float32Array(SNOWFLAKE_COUNT * 3);
  private readonly flakeSpeed = new Float32Array(SNOWFLAKE_COUNT);

  private snowIntensity = 0.45;
  private windX = 0.6;
  private windZ = 0.4;

  private readonly dummy = new THREE.Object3D();
  private readonly tempColor = new THREE.Color();
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX_CLUMPS; i++) {
      this.clumps.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        kind: 0,
      });
    }

    this.clumpGeo = new THREE.DodecahedronGeometry(0.16, 0);
    this.clumpMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.04,
    });
    this.clumpMesh = new THREE.InstancedMesh(this.clumpGeo, this.clumpMat, MAX_CLUMPS);
    this.clumpMesh.frustumCulled = false;

    for (let i = 0; i < MAX_CLUMPS; i++) {
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.clumpMesh.setMatrixAt(i, this.dummy.matrix);
      this.clumpMesh.setColorAt(i, new THREE.Color(0xf4f8ff));
    }
    this.clumpMesh.instanceMatrix.needsUpdate = true;
    if (this.clumpMesh.instanceColor) this.clumpMesh.instanceColor.needsUpdate = true;
    this.group.add(this.clumpMesh);

    // Ambient falling twilight snowflakes
    this.snowflakeGeo = new THREE.OctahedronGeometry(0.075, 0);
    this.snowflakeMat = new THREE.MeshBasicMaterial({
      color: 0xe6f0ff,
      transparent: true,
      opacity: 0.72,
    });
    this.snowflakeMesh = new THREE.InstancedMesh(this.snowflakeGeo, this.snowflakeMat, SNOWFLAKE_COUNT);
    this.snowflakeMesh.frustumCulled = false;
    this.snowflakeMesh.count = 360;

    for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
      this.flakePos[i * 3] = (Math.random() - 0.5) * 76;
      this.flakePos[i * 3 + 1] = Math.random() * 20;
      this.flakePos[i * 3 + 2] = (Math.random() - 0.5) * 76;
      this.flakeSpeed[i] = 1.4 + Math.random() * 1.5;
    }
    this.group.add(this.snowflakeMesh);
  }

  public setWeatherState(snowIntensity: number, windX: number, windZ: number): void {
    this.snowIntensity = THREE.MathUtils.clamp(snowIntensity, 0, 1);
    this.windX = windX;
    this.windZ = windZ;
    this.snowflakeMesh.count = Math.round(110 + this.snowIntensity * (SNOWFLAKE_COUNT - 110));
    this.snowflakeMat.opacity = 0.36 + this.snowIntensity * 0.5;
  }

  public spawnSnowBurst(x: number, y: number, z: number, vx: number, vy: number, vz: number, scale = 1, kind = 0): void {
    const p = this.clumps[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_CLUMPS;

    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = kind === 2 ? 1.5 + Math.random() * 0.7 : 0.48 + Math.random() * 0.32;
    p.scale = scale;
    p.kind = kind;

    if (kind === 0) {
      this.tempColor.setHex(0xf3f7fc);
    } else if (kind === 1) {
      this.tempColor.setHex(Math.random() > 0.45 ? 0xfbbf24 : 0x38bdf8);
    } else {
      this.tempColor.setHex(0xcbd5e1);
    }
    this.clumpMesh.setColorAt(this.cursor === 0 ? MAX_CLUMPS - 1 : this.cursor - 1, this.tempColor);
    if (this.clumpMesh.instanceColor) this.clumpMesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number, elapsed: number, focusX: number, focusZ: number): void {
    let anyActive = false;
    for (let i = 0; i < MAX_CLUMPS; i++) {
      const p = this.clumps[i];
      if (!p.active) continue;
      anyActive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.clumpMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      if (p.kind === 2) {
        // Soft rising smoke puff
        p.x += p.vx * dt + Math.sin(elapsed * 2 + i) * 0.25 * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      } else {
        // Gravity arc snow clumps
        p.vy -= 14.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.08) {
          p.y = 0.08;
          p.vy *= -0.25;
          p.vx *= 0.65;
          p.vz *= 0.65;
        }
      }

      const t = p.life / p.maxLife;
      const s = p.kind === 2 ? p.scale * (0.65 + t * 1.2) * (1 - t * 0.7) : p.scale * (1 - t * 0.75);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.life * 4, p.life * 3, 0);
      this.dummy.scale.setScalar(Math.max(0.01, s));
      this.dummy.updateMatrix();
      this.clumpMesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (anyActive) {
      this.clumpMesh.instanceMatrix.needsUpdate = true;
    }

    // Update falling snowflakes around active camera focus with dynamic storm wind & speed
    const activeCount = this.snowflakeMesh.count;
    const fallMult = 0.72 + this.snowIntensity * 1.65;
    const scaleBoost = 0.78 + this.snowIntensity * 0.45;
    for (let i = 0; i < activeCount; i++) {
      const ix = i * 3;
      let sx = this.flakePos[ix];
      let sy = this.flakePos[ix + 1];
      let sz = this.flakePos[ix + 2];

      sy -= this.flakeSpeed[i] * fallMult * dt;
      sx += (this.windX + Math.sin(elapsed * 1.1 + i * 0.7) * 0.55) * dt;
      sz += (this.windZ + Math.cos(elapsed * 0.9 + i * 0.5) * 0.45) * dt;

      if (sy < 0.1 || Math.abs(sx - focusX) > 36 || Math.abs(sz - focusZ) > 36) {
        sy = sy < 0.1 ? 18 + Math.random() * 4 : sy;
        sx = focusX + (Math.random() - 0.5) * 64 - this.windX * 1.5;
        sz = focusZ + (Math.random() - 0.5) * 64 - this.windZ * 1.5;
      }

      this.flakePos[ix] = sx;
      this.flakePos[ix + 1] = sy;
      this.flakePos[ix + 2] = sz;

      this.dummy.position.set(sx, sy, sz);
      this.dummy.rotation.set(0, elapsed + i, 0);
      this.dummy.scale.setScalar((0.75 + (i % 4) * 0.22) * scaleBoost);
      this.dummy.updateMatrix();
      this.snowflakeMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.snowflakeMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.clumpGeo.dispose();
    this.clumpMat.dispose();
    this.snowflakeGeo.dispose();
    this.snowflakeMat.dispose();
  }
}
