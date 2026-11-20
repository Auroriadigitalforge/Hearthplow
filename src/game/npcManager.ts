import * as THREE from 'three';
import { ContractDefinition } from './types';
import { WORLD_SIZE } from './snowField';

interface VillagerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  headGroup: THREE.Group;
}

export interface NpcHitEvent {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
}

interface NpcEntity {
  kind: 'porch' | 'walker' | 'shop_crowd';
  shopId?: string;
  rig: VillagerRig;
  x: number;
  baseY: number;
  y: number;
  z: number;
  rotY: number;
  homeRotY: number;
  waypoints: Array<{ x: number; z: number }>;
  waypointIndex: number;
  forwardDir: 1 | -1;
  walkSpeed: number;
  walkPhase: number;
  pauseTimer: number;
  cheerTimer: number;
  hitState: 'active' | 'knocked';
  knockVx: number;
  knockVy: number;
  knockVz: number;
  knockSpinX: number;
  knockSpinZ: number;
  knockRotX: number;
  knockRotZ: number;
}

const PARKA_PALETTES = [
  { coat: 0x9e2a2b, scarf: 0xf4d35e, hat: 0x335c67 },
  { coat: 0x2d6a4f, scarf: 0xe07a5f, hat: 0xf4f1de },
  { coat: 0xd97706, scarf: 0x1e3a8a, hat: 0x7c2d12 },
  { coat: 0x3b4d6b, scarf: 0xfbbf24, hat: 0xc84b31 },
  { coat: 0x6d3b5b, scarf: 0xa7f3d0, hat: 0xfde68a },
  { coat: 0x1f6f78, scarf: 0xfca5a5, hat: 0xe2e8f0 },
];

export class NpcManager {
  public readonly group = new THREE.Group();

  private npcs: NpcEntity[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private activeNpcMats: THREE.Material[] = [];

  // Shared villager geometries
  private bootGeo: THREE.BufferGeometry;
  private legGeo: THREE.BufferGeometry;
  private torsoGeo: THREE.BufferGeometry;
  private furTrimGeo: THREE.BufferGeometry;
  private scarfGeo: THREE.BufferGeometry;
  private scarfTailGeo: THREE.BufferGeometry;
  private sleeveGeo: THREE.BufferGeometry;
  private mittenGeo: THREE.BufferGeometry;
  private headGeo: THREE.BufferGeometry;
  private beanieCuffGeo: THREE.BufferGeometry;
  private beanieDomeGeo: THREE.BufferGeometry;
  private pomGeo: THREE.BufferGeometry;

  private skinMat: THREE.MeshStandardMaterial;
  private bootMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private furMat: THREE.MeshStandardMaterial;

  // Police Cruiser & Officer Rig
  private policeCruiser: THREE.Group;
  private cruiserWheels: THREE.Group[] = [];
  private redBeaconMat: THREE.MeshStandardMaterial;
  private blueBeaconMat: THREE.MeshStandardMaterial;
  private redLight: THREE.PointLight;
  private blueLight: THREE.PointLight;

  private officerRig: VillagerRig;
  private officerBaton: THREE.Mesh;

  private chaseMode: 'idle' | 'chasing' | 'arresting' | 'arrested' = 'idle';
  private cruiserX = 0;
  private cruiserZ = 0;
  private cruiserRotY = 0;
  private cruiserTargetX = 0;
  private cruiserTargetZ = 0;
  private cruiserTargetRotY = 0;

  private officerStartX = 0;
  private officerStartZ = 0;
  private officerEndX = 0;
  private officerEndZ = 0;
  private officerFacingRotY = 0;
  private arrestTimer = 0;

  constructor() {
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geos.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      this.mats.push(m);
      return m;
    };

    // Shared Villager Geometries (bottom-center grounded at y = 0)
    this.bootGeo = regGeo(new THREE.BoxGeometry(0.14, 0.16, 0.22));
    this.legGeo = regGeo(new THREE.CylinderGeometry(0.075, 0.068, 0.38, 8));
    this.torsoGeo = regGeo(new THREE.CylinderGeometry(0.21, 0.26, 0.62, 10));
    this.furTrimGeo = regGeo(new THREE.TorusGeometry(0.23, 0.045, 6, 12));
    this.furTrimGeo.rotateX(Math.PI / 2);
    this.scarfGeo = regGeo(new THREE.TorusGeometry(0.15, 0.048, 6, 12));
    this.scarfGeo.rotateX(Math.PI / 2);
    this.scarfTailGeo = regGeo(new THREE.BoxGeometry(0.09, 0.28, 0.05));
    this.sleeveGeo = regGeo(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 8));
    this.mittenGeo = regGeo(new THREE.SphereGeometry(0.068, 8, 8));
    this.headGeo = regGeo(new THREE.SphereGeometry(0.16, 12, 10));
    this.beanieCuffGeo = regGeo(new THREE.TorusGeometry(0.15, 0.04, 6, 12));
    this.beanieCuffGeo.rotateX(Math.PI / 2);
    this.beanieDomeGeo = regGeo(new THREE.SphereGeometry(0.162, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58));
    this.pomGeo = regGeo(new THREE.SphereGeometry(0.055, 8, 8));

    this.skinMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf3c6a5, roughness: 0.78, metalness: 0.02 }));
    this.bootMat = regMat(new THREE.MeshStandardMaterial({ color: 0x2b211c, roughness: 0.9, metalness: 0.05 }));
    this.pantsMat = regMat(new THREE.MeshStandardMaterial({ color: 0x263142, roughness: 0.85, metalness: 0.04 }));
    this.furMat = regMat(new THREE.MeshStandardMaterial({ color: 0xede6da, roughness: 0.94, metalness: 0.02 }));

    // Build Police Cruiser & Officer
    this.redBeaconMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xff2222,
        emissiveIntensity: 0.4,
        roughness: 0.15,
      })
    );
    this.blueBeaconMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x2563eb,
        emissiveIntensity: 0.4,
        roughness: 0.15,
      })
    );
    this.redLight = new THREE.PointLight(0xff2b2b, 0, 14, 1.5);
    this.blueLight = new THREE.PointLight(0x3b82f6, 0, 14, 1.5);

    this.policeCruiser = this.buildPoliceCruiser(regGeo, regMat);
    this.policeCruiser.visible = false;
    this.group.add(this.policeCruiser);

    // Police Officer in winter uniform
    const policeCoatMat = regMat(new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.65, metalness: 0.12 }));
    const policeScarfMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }));
    const policeHatMat = regMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.08 }));
    const goldBadgeMat = regMat(new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 }));

    this.officerRig = this.createVillagerRig(policeCoatMat, policeScarfMat, policeHatMat);
    // Gold badge + citation clipboard on right hand
    const chestBadge = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 6)), goldBadgeMat);
    chestBadge.rotation.x = Math.PI / 2;
    chestBadge.position.set(0.09, 0.96, 0.22);
    this.officerRig.bodyGroup.add(chestBadge);

    const visor = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.24, 0.03, 0.14)), this.bootMat);
    visor.position.set(0, 0.09, 0.14);
    this.officerRig.headGroup.add(visor);

    this.officerBaton = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.16, 0.22, 0.04)),
      regMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }))
    );
    this.officerBaton.position.set(0, -0.44, 0.06);
    this.officerRig.rightArmPivot.add(this.officerBaton);

    this.officerRig.root.visible = false;
    this.group.add(this.officerRig.root);
  }

  private createVillagerRig(
    coatMat: THREE.Material,
    scarfMat: THREE.Material,
    hatMat: THREE.Material
  ): VillagerRig {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const makeLeg = (xOffset: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(xOffset, 0.52, 0);
      const pant = new THREE.Mesh(this.legGeo, this.pantsMat);
      pant.position.y = -0.22;
      pant.castShadow = true;
      const boot = new THREE.Mesh(this.bootGeo, this.bootMat);
      boot.position.set(0, -0.44, 0.03);
      boot.castShadow = true;
      pivot.add(pant, boot);
      bodyGroup.add(pivot);
      return pivot;
    };

    const leftLegPivot = makeLeg(-0.11);
    const rightLegPivot = makeLeg(0.11);

    // Parka torso
    const torso = new THREE.Mesh(this.torsoGeo, coatMat);
    torso.position.y = 0.84;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Cozy fur hem & hood collar trim
    const hemTrim = new THREE.Mesh(this.furTrimGeo, this.furMat);
    hemTrim.position.y = 0.55;
    bodyGroup.add(hemTrim);

    const scarf = new THREE.Mesh(this.scarfGeo, scarfMat);
    scarf.position.y = 1.15;
    bodyGroup.add(scarf);

    const scarfTail = new THREE.Mesh(this.scarfTailGeo, scarfMat);
    scarfTail.position.set(0.08, 1.0, 0.19);
    scarfTail.rotation.x = -0.18;
    scarfTail.rotation.z = -0.15;
    bodyGroup.add(scarfTail);

    const makeArm = (xOffset: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(xOffset, 1.08, 0);
      const sleeve = new THREE.Mesh(this.sleeveGeo, coatMat);
      sleeve.position.y = -0.19;
      sleeve.castShadow = true;
      const mitten = new THREE.Mesh(this.mittenGeo, scarfMat);
      mitten.position.y = -0.41;
      pivot.add(sleeve, mitten);
      bodyGroup.add(pivot);
      return pivot;
    };

    const leftArmPivot = makeArm(-0.27);
    const rightArmPivot = makeArm(0.27);

    // Head + knit beanie + pom-pom
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.32, 0);

    const head = new THREE.Mesh(this.headGeo, this.skinMat);
    head.castShadow = true;
    headGroup.add(head);

    const cuff = new THREE.Mesh(this.beanieCuffGeo, hatMat);
    cuff.position.y = 0.06;
    headGroup.add(cuff);

    const dome = new THREE.Mesh(this.beanieDomeGeo, hatMat);
    dome.position.y = 0.03;
    dome.castShadow = true;
    headGroup.add(dome);

    const pom = new THREE.Mesh(this.pomGeo, this.furMat);
    pom.position.y = 0.21;
    headGroup.add(pom);

    bodyGroup.add(headGroup);

    return {
      root,
      bodyGroup,
      leftLegPivot,
      rightLegPivot,
      leftArmPivot,
      rightArmPivot,
      headGroup,
    };
  }

  private buildPoliceCruiser(
    regGeo: <T extends THREE.BufferGeometry>(g: T) => T,
    regMat: <T extends THREE.Material>(m: T) => T
  ): THREE.Group {
    const cruiser = new THREE.Group();

    const navyBodyMat = regMat(new THREE.MeshStandardMaterial({ color: 0x162238, roughness: 0.28, metalness: 0.35 }));
    const whiteDoorMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.15 }));
    const darkTrimMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.72, metalness: 0.3 }));
    const glassMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.12, metalness: 0.7 }));
    const headlightMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff7d6,
        emissive: 0xffe4a0,
        emissiveIntensity: 2.2,
        roughness: 0.15,
      })
    );

    // Cruiser body silhouette
    const hull = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.66, 0.56, 3.85)), navyBodyMat);
    hull.position.set(0, 0.62, 0);
    hull.castShadow = true;
    hull.receiveShadow = true;
    cruiser.add(hull);

    // Classic white patrol doors & roof
    const doors = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.69, 0.44, 1.55)), whiteDoorMat);
    doors.position.set(0, 0.64, 0.05);
    cruiser.add(doors);

    const cabin = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.42, 0.52, 1.85)), whiteDoorMat);
    cabin.position.set(0, 1.14, -0.1);
    cabin.castShadow = true;
    cruiser.add(cabin);

    const windows = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.45, 0.36, 1.58)), glassMat);
    windows.position.set(0, 1.13, -0.06);
    cruiser.add(windows);

    // Push bumper & headlights
    const pushBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.44, 0.28, 0.18)), darkTrimMat);
    pushBar.position.set(0, 0.54, 1.98);
    cruiser.add(pushBar);

    [-0.56, 0.56].forEach((hx) => {
      const lamp = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.24, 0.14, 0.08)), headlightMat);
      lamp.position.set(hx, 0.66, 1.93);
      cruiser.add(lamp);
    });

    // Flashing Red & Blue Lightbar
    const barMount = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.06, 0.08, 0.24)), darkTrimMat);
    barMount.position.set(0, 1.44, -0.05);
    cruiser.add(barMount);

    const redDome = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.46, 0.14, 0.22)), this.redBeaconMat);
    redDome.position.set(-0.27, 1.52, -0.05);
    cruiser.add(redDome);

    const blueDome = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.46, 0.14, 0.22)), this.blueBeaconMat);
    blueDome.position.set(0.27, 1.52, -0.05);
    cruiser.add(blueDome);

    this.redLight.position.set(-0.4, 2.0, 0);
    this.blueLight.position.set(0.4, 2.0, 0);
    cruiser.add(this.redLight, this.blueLight);

    // 4 Patrol Wheels
    const wheelGeo = regGeo(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 16));
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 12));
    hubGeo.rotateZ(Math.PI / 2);

    this.cruiserWheels = [];
    [
      [-0.82, 0.35, 1.18],
      [0.82, 0.35, 1.18],
      [-0.82, 0.35, -1.18],
      [0.82, 0.35, -1.18],
    ].forEach(([wx, wy, wz]) => {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      const tire = new THREE.Mesh(wheelGeo, darkTrimMat);
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, whiteDoorMat);
      wg.add(tire, hub);
      cruiser.add(wg);
      this.cruiserWheels.push(wg);
    });

    return cruiser;
  }

  public loadContract(contract: ContractDefinition): void {
    // Dispose existing NPC meshes cleanly
    for (const npc of this.npcs) {
      this.group.remove(npc.rig.root);
    }
    this.npcs = [];
    this.activeNpcMats.forEach((m) => m.dispose());
    this.activeNpcMats = [];
    this.resetPolice();

    let colorCounter = contract.index * 3;
    const nextMatSet = () => {
      const pal = PARKA_PALETTES[colorCounter % PARKA_PALETTES.length];
      colorCounter++;
      const coatMat = new THREE.MeshStandardMaterial({ color: pal.coat, roughness: 0.78, metalness: 0.04 });
      const scarfMat = new THREE.MeshStandardMaterial({ color: pal.scarf, roughness: 0.88, metalness: 0.02 });
      const hatMat = new THREE.MeshStandardMaterial({ color: pal.hat, roughness: 0.88, metalness: 0.02 });
      this.activeNpcMats.push(coatMat, scarfMat, hatMat);
      return { coatMat, scarfMat, hatMat };
    };

    // 1. Porch & Yard Residents at every Cottage
    contract.cottages.forEach((cot, cIdx) => {
      const s = cot.scale ?? 1;
      const cos = Math.cos(cot.rotY);
      const sin = Math.sin(cot.rotY);

      const toWorld = (lx: number, lz: number) => ({
        x: cot.x + (lx * cos + lz * sin) * s,
        z: cot.z + (-lx * sin + lz * cos) * s,
      });

      // Resident A: Cozy porch greeter right beside the cottage lantern step
      const pA = toWorld(-0.95, 3.65);
      const matsA = nextMatSet();
      const rigA = this.createVillagerRig(matsA.coatMat, matsA.scarfMat, matsA.hatMat);
      rigA.root.position.set(pA.x, 0, pA.z);
      rigA.root.rotation.y = cot.rotY + 0.15;
      this.group.add(rigA.root);

      this.npcs.push({
        kind: 'porch',
        rig: rigA,
        x: pA.x,
        baseY: 0,
        y: 0,
        z: pA.z,
        rotY: cot.rotY + 0.15,
        homeRotY: cot.rotY + 0.15,
        waypoints: [{ x: pA.x, z: pA.z }],
        waypointIndex: 0,
        forwardDir: 1,
        walkSpeed: 0,
        walkPhase: cIdx * 1.4,
        pauseTimer: 0,
        cheerTimer: 0,
        hitState: 'active',
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
        knockSpinX: 0,
        knockSpinZ: 0,
        knockRotX: 0,
        knockRotZ: 0,
      });

      // Resident B: Standing at the front yard/driveway apron watching the snow plow
      const pB = toWorld(1.25, 4.95);
      const matsB = nextMatSet();
      const rigB = this.createVillagerRig(matsB.coatMat, matsB.scarfMat, matsB.hatMat);
      rigB.root.position.set(pB.x, 0, pB.z);
      rigB.root.rotation.y = cot.rotY - 0.25;
      this.group.add(rigB.root);

      this.npcs.push({
        kind: 'porch',
        rig: rigB,
        x: pB.x,
        baseY: 0,
        y: 0,
        z: pB.z,
        rotY: cot.rotY - 0.25,
        homeRotY: cot.rotY - 0.25,
        waypoints: [{ x: pB.x, z: pB.z }],
        waypointIndex: 0,
        forwardDir: 1,
        walkSpeed: 0,
        walkPhase: cIdx * 1.4 + 2.1,
        pauseTimer: 0,
        cheerTimer: 0,
        hitState: 'active',
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
        knockSpinX: 0,
        knockSpinZ: 0,
        knockRotX: 0,
        knockRotZ: 0,
      });
    });

    // 1B. Open City Shop Crowds (shopkeeper at counter + bustling winter crowd on patio)
    const crowdSlots: Array<{ lx: number; lz: number; face: number }> = [
      { lx: -1.15, lz: 2.35, face: 0.45 },
      { lx: -0.45, lz: 2.65, face: -0.65 },
      { lx: 0.85, lz: 2.3, face: -0.35 },
      { lx: 1.55, lz: 2.7, face: -1.15 },
      { lx: -2.05, lz: 3.15, face: 0.25 },
      { lx: 0.15, lz: 3.25, face: 0.05 },
      { lx: 2.1, lz: 3.2, face: -0.5 },
    ];

    contract.shops.forEach((shop, sIdx) => {
      const cos = Math.cos(shop.rotY);
      const sin = Math.sin(shop.rotY);
      const toWorld = (lx: number, lz: number) => ({
        x: shop.x + (lx * cos + lz * sin),
        z: shop.z + (-lx * sin + lz * cos),
      });

      // Shopkeeper greeting behind open doorway counter
      const keeperPos = toWorld(0, -0.15);
      const keeperMats = nextMatSet();
      const keeperRig = this.createVillagerRig(keeperMats.coatMat, keeperMats.scarfMat, keeperMats.hatMat);
      keeperRig.root.position.set(keeperPos.x, 0.42, keeperPos.z);
      keeperRig.root.rotation.y = shop.rotY;
      this.group.add(keeperRig.root);
      this.npcs.push({
        kind: 'shop_crowd',
        shopId: shop.id,
        rig: keeperRig,
        x: keeperPos.x,
        baseY: 0.42,
        y: 0.42,
        z: keeperPos.z,
        rotY: shop.rotY,
        homeRotY: shop.rotY,
        waypoints: [{ x: keeperPos.x, z: keeperPos.z }],
        waypointIndex: 0,
        forwardDir: 1,
        walkSpeed: 0,
        walkPhase: sIdx * 1.1,
        pauseTimer: 0,
        cheerTimer: 0,
        hitState: 'active',
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
        knockSpinX: 0,
        knockSpinZ: 0,
        knockRotX: 0,
        knockRotZ: 0,
      });

      // Outdoor Crowd gathered on the Open Shop Patio
      const count = Math.min(crowdSlots.length, Math.max(2, shop.crowdSize));
      for (let k = 0; k < count; k++) {
        const slot = crowdSlots[k];
        const pos = toWorld(slot.lx, slot.lz);
        const cMats = nextMatSet();
        const cRig = this.createVillagerRig(cMats.coatMat, cMats.scarfMat, cMats.hatMat);
        const rot = shop.rotY + slot.face;
        cRig.root.position.set(pos.x, 0.22, pos.z);
        cRig.root.rotation.y = rot;
        this.group.add(cRig.root);

        this.npcs.push({
          kind: 'shop_crowd',
          shopId: shop.id,
          rig: cRig,
          x: pos.x,
          baseY: 0.22,
          y: 0.22,
          z: pos.z,
          rotY: rot,
          homeRotY: rot,
          waypoints: [{ x: pos.x, z: pos.z }],
          waypointIndex: 0,
          forwardDir: 1,
          walkSpeed: 0,
          walkPhase: sIdx * 2.3 + k * 1.35,
          pauseTimer: 0,
          cheerTimer: 0,
          hitState: 'active',
          knockVx: 0,
          knockVy: 0,
          knockVz: 0,
          knockSpinX: 0,
          knockSpinZ: 0,
          knockRotX: 0,
          knockRotZ: 0,
        });
      }
    });

    // 2. Walking Sidewalk Villagers along main road shoulders & turnaround circles
    const maxWalkers = contract.difficulty === 'hard' ? 15 : 9;
    let walkerCount = 0;
    contract.roads.forEach((seg, rIdx) => {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 10 || walkerCount >= maxWalkers) return;

      const nx = -dz / len;
      const nz = dx / len;
      const sideSign = rIdx % 2 === 0 ? 1 : -1;
      const offset = (seg.halfWidth * 0.84) * sideSign;

      const p1 = { x: seg.x1 + dx * 0.14 + nx * offset, z: seg.z1 + dz * 0.14 + nz * offset };
      const p2 = { x: seg.x1 + dx * 0.86 + nx * offset, z: seg.z1 + dz * 0.86 + nz * offset };

      // Spawn away from truck starting position
      const tStart = rIdx % 2 === 0 ? 0.65 : 0.35;
      let sx = THREE.MathUtils.lerp(p1.x, p2.x, tStart);
      let sz = THREE.MathUtils.lerp(p1.z, p2.z, tStart);
      if (Math.hypot(sx - contract.spawn.x, sz - contract.spawn.z) < 6.5) {
        sx = p2.x;
        sz = p2.z;
      }

      const matsW = nextMatSet();
      const rigW = this.createVillagerRig(matsW.coatMat, matsW.scarfMat, matsW.hatMat);
      const initRot = Math.atan2(p2.x - p1.x, p2.z - p1.z);
      rigW.root.position.set(sx, 0, sz);
      rigW.root.rotation.y = initRot;
      this.group.add(rigW.root);

      const speedBoost = contract.difficulty === 'hard' ? 0.25 : 0;
      this.npcs.push({
        kind: 'walker',
        rig: rigW,
        x: sx,
        baseY: 0,
        y: 0,
        z: sz,
        rotY: initRot,
        homeRotY: initRot,
        waypoints: [p1, p2],
        waypointIndex: 1,
        forwardDir: 1,
        walkSpeed: 1.55 + speedBoost + (walkerCount % 3) * 0.22,
        walkPhase: walkerCount * 1.7,
        pauseTimer: 0,
        cheerTimer: 0,
        hitState: 'active',
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
        knockSpinX: 0,
        knockSpinZ: 0,
        knockRotX: 0,
        knockRotZ: 0,
      });
      walkerCount++;

      // Add a second sidewalk walker on the opposite side for long avenues
      if (len >= 22 && walkerCount < maxWalkers) {
        const oppOffset = -seg.halfWidth * 0.84 * sideSign;
        const q1 = { x: seg.x1 + dx * 0.22 + nx * oppOffset, z: seg.z1 + dz * 0.22 + nz * oppOffset };
        const q2 = { x: seg.x1 + dx * 0.78 + nx * oppOffset, z: seg.z1 + dz * 0.78 + nz * oppOffset };
        let qx = q2.x;
        let qz = q2.z;
        if (Math.hypot(qx - contract.spawn.x, qz - contract.spawn.z) < 6.5) {
          qx = q1.x;
          qz = q1.z;
        }
        const matsOpp = nextMatSet();
        const rigOpp = this.createVillagerRig(matsOpp.coatMat, matsOpp.scarfMat, matsOpp.hatMat);
        const oppRot = Math.atan2(q1.x - q2.x, q1.z - q2.z);
        rigOpp.root.position.set(qx, 0, qz);
        rigOpp.root.rotation.y = oppRot;
        this.group.add(rigOpp.root);

        this.npcs.push({
          kind: 'walker',
          rig: rigOpp,
          x: qx,
          baseY: 0,
          y: 0,
          z: qz,
          rotY: oppRot,
          homeRotY: oppRot,
          waypoints: [q1, q2],
          waypointIndex: 0,
          forwardDir: -1,
          walkSpeed: 1.45 + speedBoost + (walkerCount % 3) * 0.2,
          walkPhase: walkerCount * 2.1,
          pauseTimer: 0,
          cheerTimer: 0,
          hitState: 'active',
          knockVx: 0,
          knockVy: 0,
          knockVz: 0,
          knockSpinX: 0,
          knockSpinZ: 0,
          knockRotX: 0,
          knockRotZ: 0,
        });
        walkerCount++;
      }
    });

    // Add perimeter circle walkers for plazas/turnarounds
    contract.circles.forEach((c) => {
      if (c.radius < 4.5 || walkerCount >= maxWalkers) return;
      const pts: Array<{ x: number; z: number }> = [];
      const r = c.radius * 0.86;
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        pts.push({ x: c.x + Math.cos(ang) * r, z: c.z + Math.sin(ang) * r });
      }
      if (Math.hypot(pts[0].x - contract.spawn.x, pts[0].z - contract.spawn.z) < 6.0) return;

      const matsC = nextMatSet();
      const rigC = this.createVillagerRig(matsC.coatMat, matsC.scarfMat, matsC.hatMat);
      rigC.root.position.set(pts[0].x, 0, pts[0].z);
      this.group.add(rigC.root);

      this.npcs.push({
        kind: 'walker',
        rig: rigC,
        x: pts[0].x,
        baseY: 0,
        y: 0,
        z: pts[0].z,
        rotY: 0,
        homeRotY: 0,
        waypoints: pts,
        waypointIndex: 1,
        forwardDir: 1,
        walkSpeed: contract.difficulty === 'hard' ? 1.75 : 1.5,
        walkPhase: walkerCount * 1.3,
        pauseTimer: 0,
        cheerTimer: 0,
        hitState: 'active',
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
        knockSpinX: 0,
        knockSpinZ: 0,
        knockRotX: 0,
        knockRotZ: 0,
      });
      walkerCount++;
    });
  }

  public getShopCrowdCount(shopId: string): number {
    let count = 0;
    for (const npc of this.npcs) {
      if (npc.kind === 'shop_crowd' && npc.shopId === shopId && npc.hitState === 'active') {
        count++;
      }
    }
    return count;
  }

  public cheerAtShop(shopId: string): void {
    for (const npc of this.npcs) {
      if (npc.kind === 'shop_crowd' && npc.shopId === shopId && npc.hitState === 'active') {
        npc.cheerTimer = 2.6;
      }
    }
  }

  public resetPolice(): void {
    this.chaseMode = 'idle';
    this.policeCruiser.visible = false;
    this.officerRig.root.visible = false;
    this.redLight.intensity = 0;
    this.blueLight.intensity = 0;
    this.arrestTimer = 0;
  }

  public startChase(truckX: number, truckZ: number, truckRotY: number): void {
    if (this.chaseMode === 'chasing' || this.chaseMode === 'arresting' || this.chaseMode === 'arrested') return;
    this.chaseMode = 'chasing';

    // Spawn patrol cruiser ~26m away along an accessible approach vector
    const fwdX = Math.sin(truckRotY);
    const fwdZ = Math.cos(truckRotY);
    const sideX = -fwdZ;
    const sideZ = fwdX;
    const bound = WORLD_SIZE * 0.44;
    this.cruiserX = THREE.MathUtils.clamp(truckX - fwdX * 22 + sideX * 10, -bound, bound);
    this.cruiserZ = THREE.MathUtils.clamp(truckZ - fwdZ * 22 + sideZ * 10, -bound, bound);
    this.cruiserRotY = Math.atan2(truckX - this.cruiserX, truckZ - this.cruiserZ);

    this.policeCruiser.position.set(this.cruiserX, 0, this.cruiserZ);
    this.policeCruiser.rotation.set(0, this.cruiserRotY, 0);
    this.policeCruiser.visible = true;
    this.officerRig.root.visible = false;
  }

  public beginArrest(truckX: number, truckZ: number, truckRotY: number): { focusX: number; focusZ: number } {
    this.chaseMode = 'arresting';
    this.arrestTimer = 0;

    const fwdX = Math.sin(truckRotY);
    const fwdZ = Math.cos(truckRotY);
    const leftX = fwdZ;
    const leftZ = -fwdX;

    // Cruiser pulls cleanly ahead-left of the plow truck
    const bound = WORLD_SIZE * 0.44;
    this.cruiserTargetX = THREE.MathUtils.clamp(truckX + fwdX * 4.7 + leftX * 2.5, -bound, bound);
    this.cruiserTargetZ = THREE.MathUtils.clamp(truckZ + fwdZ * 4.7 + leftZ * 2.5, -bound, bound);
    this.cruiserTargetRotY = truckRotY + Math.PI * 0.74;

    // Snap cruiser closer if it was still far away on a small map
    const dist = Math.hypot(this.cruiserTargetX - this.cruiserX, this.cruiserTargetZ - this.cruiserZ);
    if (dist > 14) {
      this.cruiserX = THREE.MathUtils.lerp(this.cruiserTargetX, this.cruiserX, 11 / dist);
      this.cruiserZ = THREE.MathUtils.lerp(this.cruiserTargetZ, this.cruiserZ, 11 / dist);
    }

    // Officer steps out of cruiser and walks to the driver's cab door
    this.officerStartX = this.cruiserTargetX - leftX * 0.9;
    this.officerStartZ = this.cruiserTargetZ - leftZ * 0.9;
    this.officerEndX = truckX + leftX * 1.45 + fwdX * 0.25;
    this.officerEndZ = truckZ + leftZ * 1.45 + fwdZ * 0.25;
    this.officerFacingRotY = Math.atan2(truckX - this.officerEndX, truckZ - this.officerEndZ);

    this.officerRig.root.position.set(this.officerStartX, 0, this.officerStartZ);
    this.officerRig.root.visible = false;

    return {
      focusX: (truckX + this.cruiserTargetX) * 0.5,
      focusZ: (truckZ + this.cruiserTargetZ) * 0.5,
    };
  }

  public update(
    dt: number,
    elapsed: number,
    truckX: number,
    truckZ: number,
    truckRotY: number,
    truckSpeed: number,
    isPlaying: boolean
  ): { newHits: NpcHitEvent[]; arrestFinished: boolean } {
    const newHits: NpcHitEvent[] = [];
    const fwdX = Math.sin(truckRotY);
    const fwdZ = Math.cos(truckRotY);
    const bladeX = truckX + fwdX * 2.05;
    const bladeZ = truckZ + fwdZ * 2.05;

    // 1. Update All Villager NPCs & Detect Truck Collisions
    for (const npc of this.npcs) {
      if (npc.hitState === 'knocked') {
        if (npc.y > 0.2 || npc.knockVy > 0) {
          npc.x += npc.knockVx * dt;
          npc.z += npc.knockVz * dt;
          npc.y += npc.knockVy * dt;
          npc.knockVy -= 18 * dt;
          npc.knockRotX += npc.knockSpinX * dt;
          npc.knockRotZ += npc.knockSpinZ * dt;
          if (npc.y <= 0.22) {
            npc.y = 0.22;
            npc.knockVy = 0;
            npc.knockVx *= 0.2;
            npc.knockVz *= 0.2;
          }
        } else {
          npc.knockVx = THREE.MathUtils.damp(npc.knockVx, 0, 8, dt);
          npc.knockVz = THREE.MathUtils.damp(npc.knockVz, 0, 8, dt);
          npc.x += npc.knockVx * dt;
          npc.z += npc.knockVz * dt;
        }
        npc.rig.root.position.set(npc.x, npc.y, npc.z);
        npc.rig.root.rotation.set(npc.knockRotX, npc.rotY, npc.knockRotZ);
        continue;
      }

      // Collision check against truck cab & front plow blade while driving
      if (isPlaying && Math.abs(truckSpeed) > 0.75) {
        const dCab = Math.hypot(npc.x - truckX, npc.z - truckZ);
        const dBlade = Math.hypot(npc.x - bladeX, npc.z - bladeZ);
        if (dCab < 1.55 || dBlade < 1.65) {
          npc.hitState = 'knocked';
          const outX = npc.x - truckX;
          const outZ = npc.z - truckZ;
          const outLen = Math.max(0.01, Math.hypot(outX, outZ));
          const dirX = (outX / outLen) * 0.65 + fwdX * Math.sign(truckSpeed) * 0.6;
          const dirZ = (outZ / outLen) * 0.65 + fwdZ * Math.sign(truckSpeed) * 0.6;
          const dirLen = Math.max(0.01, Math.hypot(dirX, dirZ));
          const nx = dirX / dirLen;
          const nz = dirZ / dirLen;

          npc.knockVx = nx * (5.2 + Math.abs(truckSpeed) * 0.45);
          npc.knockVz = nz * (5.2 + Math.abs(truckSpeed) * 0.45);
          npc.knockVy = 4.6;
          npc.knockSpinX = 6.5;
          npc.knockSpinZ = (Math.random() - 0.5) * 6;
          newHits.push({ x: npc.x, z: npc.z, dirX: nx, dirZ: nz });
          continue;
        }
      }

      if (npc.kind === 'porch' || npc.kind === 'shop_crowd') {
        const distTruck = Math.hypot(npc.x - truckX, npc.z - truckZ);
        if (npc.cheerTimer > 0) {
          npc.cheerTimer = Math.max(0, npc.cheerTimer - dt);
        }

        const isShopCrowd = npc.kind === 'shop_crowd';
        const chatterTurn = isShopCrowd ? Math.sin(elapsed * 1.3 + npc.walkPhase) * 0.25 : 0;
        const targetRot =
          distTruck < 9.5
            ? Math.atan2(truckX - npc.x, truckZ - npc.z)
            : npc.homeRotY + chatterTurn;
        const diff = Math.atan2(Math.sin(targetRot - npc.rotY), Math.cos(targetRot - npc.rotY));
        npc.rotY += diff * Math.min(1, dt * 4);

        const cheerBounce = npc.cheerTimer > 0 ? Math.abs(Math.sin(elapsed * 10 + npc.walkPhase)) * 0.14 : 0;
        const idleBreath = Math.sin(elapsed * 2.6 + npc.walkPhase) * 0.025 + cheerBounce;
        npc.rig.bodyGroup.position.y = idleBreath;
        npc.rig.leftLegPivot.rotation.x = 0;
        npc.rig.rightLegPivot.rotation.x = 0;

        if (npc.cheerTimer > 0) {
          npc.rig.leftArmPivot.rotation.z = 2.3 + Math.sin(elapsed * 10 + npc.walkPhase) * 0.3;
          npc.rig.rightArmPivot.rotation.z = -2.3 - Math.sin(elapsed * 10 + npc.walkPhase) * 0.3;
          npc.rig.rightArmPivot.rotation.x = -0.25;
        } else if (distTruck < 9.5) {
          npc.rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(npc.rig.leftArmPivot.rotation.z, 0, 6, dt);
          npc.rig.leftArmPivot.rotation.x = Math.sin(elapsed * 2 + npc.walkPhase) * 0.08;
          npc.rig.rightArmPivot.rotation.z = -2.4 + Math.sin(elapsed * 9 + npc.walkPhase) * 0.35;
          npc.rig.rightArmPivot.rotation.x = -0.35;
        } else {
          npc.rig.leftArmPivot.rotation.z = THREE.MathUtils.damp(npc.rig.leftArmPivot.rotation.z, 0, 6, dt);
          npc.rig.leftArmPivot.rotation.x = Math.sin(elapsed * 2.8 + npc.walkPhase) * (isShopCrowd ? 0.22 : 0.06);
          npc.rig.rightArmPivot.rotation.z = THREE.MathUtils.damp(npc.rig.rightArmPivot.rotation.z, 0, 6, dt);
          npc.rig.rightArmPivot.rotation.x = Math.cos(elapsed * 3.1 + npc.walkPhase) * (isShopCrowd ? 0.24 : 0.08);
        }

        npc.rig.root.position.set(npc.x, npc.baseY, npc.z);
        npc.rig.root.rotation.set(0, npc.rotY, 0);
      } else {
        // Walking Sidewalk Villager
        const distTruck = Math.hypot(npc.x - truckX, npc.z - truckZ);
        const target = npc.waypoints[npc.waypointIndex];
        const dx = target.x - npc.x;
        const dz = target.z - npc.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.35) {
          if (npc.waypoints.length === 2) {
            npc.forwardDir = npc.waypointIndex === 1 ? -1 : 1;
            npc.waypointIndex = npc.waypointIndex === 1 ? 0 : 1;
          } else {
            npc.waypointIndex = (npc.waypointIndex + 1) % npc.waypoints.length;
          }
          npc.pauseTimer = 0.45;
        } else if (npc.pauseTimer > 0) {
          npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
        } else {
          // Slow briefly and raise caution hand if truck approaches closely
          const cautionSlow = distTruck < 4.0 && Math.abs(truckSpeed) > 1.0 ? 0.45 : 1.0;
          const step = npc.walkSpeed * cautionSlow * dt;
          npc.x += (dx / dist) * Math.min(dist, step);
          npc.z += (dz / dist) * Math.min(dist, step);

          const targetRot = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(targetRot - npc.rotY), Math.cos(targetRot - npc.rotY));
          npc.rotY += diff * Math.min(1, dt * 7);

          npc.walkPhase += dt * npc.walkSpeed * cautionSlow * 4.5;
          const swing = Math.sin(npc.walkPhase);
          npc.rig.leftLegPivot.rotation.x = swing * 0.52;
          npc.rig.rightLegPivot.rotation.x = -swing * 0.52;
          npc.rig.leftArmPivot.rotation.x = -swing * 0.42;
          npc.rig.rightArmPivot.rotation.x = distTruck < 4.0 ? -1.8 : swing * 0.42;
          npc.rig.bodyGroup.position.y = Math.abs(Math.cos(npc.walkPhase)) * 0.045;
        }

        npc.rig.root.position.set(npc.x, 0, npc.z);
        npc.rig.root.rotation.set(0, npc.rotY, 0);
      }
    }

    // 2. Police Cruiser Pursuit & Arrest Sequence
    let arrestFinished = false;
    if (this.chaseMode === 'chasing' || this.chaseMode === 'arresting' || this.chaseMode === 'arrested') {
      // Alternate flashing red/blue emergency beacons
      const strobePhase = Math.floor(elapsed * 8.5) % 2 === 0;
      this.redBeaconMat.emissiveIntensity = strobePhase ? 4.8 : 0.25;
      this.blueBeaconMat.emissiveIntensity = strobePhase ? 0.25 : 4.8;
      this.redLight.intensity = strobePhase ? 4.5 : 0;
      this.blueLight.intensity = strobePhase ? 0 : 4.5;
    }

    if (this.chaseMode === 'chasing') {
      const targetX = truckX + fwdX * 5.0 - fwdZ * 2.2;
      const targetZ = truckZ + fwdZ * 5.0 + fwdX * 2.2;
      const dx = targetX - this.cruiserX;
      const dz = targetZ - this.cruiserZ;
      const dist = Math.hypot(dx, dz);
      const speed = Math.min(15.5, Math.max(8, dist * 1.4));
      if (dist > 0.4) {
        this.cruiserX += (dx / dist) * speed * dt;
        this.cruiserZ += (dz / dist) * speed * dt;
        const targetRot = Math.atan2(dx, dz);
        const diff = Math.atan2(Math.sin(targetRot - this.cruiserRotY), Math.cos(targetRot - this.cruiserRotY));
        this.cruiserRotY += diff * Math.min(1, dt * 6);
      }
      this.cruiserWheels.forEach((w) => {
        w.rotation.x += (speed * dt) / 0.35;
      });
      this.policeCruiser.position.set(this.cruiserX, 0, this.cruiserZ);
      this.policeCruiser.rotation.set(0, this.cruiserRotY, 0);
    } else if (this.chaseMode === 'arresting') {
      this.arrestTimer += dt;

      // Phase A (0..0.55s): Cruiser glides smoothly into blocking angle
      this.cruiserX = THREE.MathUtils.damp(this.cruiserX, this.cruiserTargetX, 7.5, dt);
      this.cruiserZ = THREE.MathUtils.damp(this.cruiserZ, this.cruiserTargetZ, 7.5, dt);
      const rDiff = Math.atan2(
        Math.sin(this.cruiserTargetRotY - this.cruiserRotY),
        Math.cos(this.cruiserTargetRotY - this.cruiserRotY)
      );
      this.cruiserRotY += rDiff * Math.min(1, dt * 8);
      this.policeCruiser.position.set(this.cruiserX, 0, this.cruiserZ);
      this.policeCruiser.rotation.set(0, this.cruiserRotY, 0);

      // Phase B (0.45..1.85s): Officer steps out and walks briskly to cab door
      if (this.arrestTimer >= 0.45) {
        this.officerRig.root.visible = true;
        const walkT = THREE.MathUtils.clamp((this.arrestTimer - 0.45) / 1.35, 0, 1);
        const ox = THREE.MathUtils.lerp(this.officerStartX, this.officerEndX, walkT);
        const oz = THREE.MathUtils.lerp(this.officerStartZ, this.officerEndZ, walkT);
        this.officerRig.root.position.set(ox, 0, oz);

        if (walkT < 1) {
          const walkRot = Math.atan2(this.officerEndX - this.officerStartX, this.officerEndZ - this.officerStartZ);
          this.officerRig.root.rotation.set(0, walkRot, 0);
          const stride = Math.sin(this.arrestTimer * 12);
          this.officerRig.leftLegPivot.rotation.x = stride * 0.56;
          this.officerRig.rightLegPivot.rotation.x = -stride * 0.56;
          this.officerRig.leftArmPivot.rotation.x = -stride * 0.45;
          this.officerRig.rightArmPivot.rotation.x = stride * 0.45;
          this.officerRig.rightArmPivot.rotation.z = 0;
          this.officerRig.bodyGroup.position.y = Math.abs(Math.cos(this.arrestTimer * 12)) * 0.05;
        } else {
          // Phase C (1.80..2.55s): Officer faces cab and raises citation / arrest gesture
          this.officerRig.root.rotation.set(0, this.officerFacingRotY, 0);
          this.officerRig.leftLegPivot.rotation.x = 0;
          this.officerRig.rightLegPivot.rotation.x = 0;
          this.officerRig.leftArmPivot.rotation.x = 0.1;
          this.officerRig.rightArmPivot.rotation.x = THREE.MathUtils.damp(
            this.officerRig.rightArmPivot.rotation.x,
            -1.45,
            10,
            dt
          );
          this.officerRig.bodyGroup.position.y = 0;
        }
      }

      if (this.arrestTimer >= 2.55) {
        this.chaseMode = 'arrested';
        arrestFinished = true;
      }
    }

    return { newHits, arrestFinished };
  }

  public dispose(): void {
    for (const npc of this.npcs) {
      this.group.remove(npc.rig.root);
    }
    this.npcs = [];
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.activeNpcMats.forEach((m) => m.dispose());
    this.activeNpcMats = [];
  }
}
