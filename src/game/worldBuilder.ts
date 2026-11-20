import * as THREE from 'three';
import { ContractDefinition, PriorityZoneSpec, ShopSpec } from './types';
import { WORLD_SIZE } from './snowField';

export interface WorldCollider {
  x: number;
  z: number;
  radius: number;
}

export interface PriorityMarkerRuntime {
  spec: PriorityZoneSpec;
  cleared: boolean;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  propGroup: THREE.Group;
}

export interface CottageWindowRuntime {
  sampleX: number;
  sampleZ: number;
  windowMat: THREE.MeshStandardMaterial;
  lanternMat: THREE.MeshStandardMaterial;
  hearthLight: THREE.PointLight | null;
  warmFactor: number;
  warmAnnounced: boolean;
  phase: number;
}

export interface ShopRuntime {
  spec: ShopSpec;
  sampleX: number;
  sampleZ: number;
  signMat: THREE.MeshStandardMaterial;
  interiorMat: THREE.MeshStandardMaterial;
  apronRingMesh: THREE.Mesh;
  apronRingMat: THREE.MeshBasicMaterial;
  apronCleared: boolean;
  tipClaimed: boolean;
  phase: number;
}

export interface BuiltNeighborhood {
  group: THREE.Group;
  colliders: WorldCollider[];
  chimneyAnchors: THREE.Vector3[];
  priorityMarkers: PriorityMarkerRuntime[];
  cottagesRuntime: CottageWindowRuntime[];
  shopsRuntime: ShopRuntime[];
  update: (
    elapsed: number,
    dt: number,
    sampleClearedRatio?: (x: number, z: number, radius: number) => number
  ) => number;
  dispose: () => void;
}

function createShopSignTexture(shop: ShopSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 144);

    // Glowing green OPEN badge on the left
    ctx.fillStyle = '#059669';
    ctx.fillRect(22, 26, 118, 108);
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 26, 118, 108);

    ctx.fillStyle = '#ecfdf5';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', 81, 82);

    // Shop Name & Category on the right
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(shop.name.slice(0, 22), 158, 62);

    const catLabel =
      shop.category === 'bakery'
        ? 'HOT PASTRIES & COCOA'
        : shop.category === 'hardware'
        ? 'WINTER GEAR & SALT'
        : shop.category === 'market'
        ? 'CITY WINTER MARKET'
        : 'HOT COFFEE & CIDER';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(catLabel, 158, 108);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAwningTexture(baseHex: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const col = new THREE.Color(baseHex);
  const cssCol = `rgb(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)})`;
  if (ctx) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? cssCol : '#f8f1e5';
      ctx.fillRect(i * 32, 0, 32, 64);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function isNearRoad(x: number, z: number, contract: ContractDefinition, clearance: number): boolean {
  for (const s of contract.roads) {
    const vx = s.x2 - s.x1;
    const vz = s.z2 - s.z1;
    const wx = x - s.x1;
    const wz = z - s.z1;
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq)) : 0;
    const dist = Math.hypot(x - (s.x1 + t * vx), z - (s.z1 + t * vz));
    if (dist <= s.halfWidth + clearance) return true;
  }
  for (const c of contract.circles) {
    if (Math.hypot(x - c.x, z - c.z) <= c.radius + clearance) return true;
  }
  for (const h of contract.cottages) {
    if (Math.hypot(x - h.x, z - h.z) <= 5.8 + clearance) return true;
  }
  for (const sp of contract.shops) {
    if (Math.hypot(x - sp.x, z - sp.z) <= 6.2 + clearance) return true;
  }
  return false;
}

const _dimColor = new THREE.Color(0xffcf87);
const _litColor = new THREE.Color(0xfff1c4);
const _dimEmissive = new THREE.Color(0xff8424);
const _litEmissive = new THREE.Color(0xffc352);

export function buildNeighborhood(contract: ContractDefinition): BuiltNeighborhood {
  const group = new THREE.Group();
  const colliders: WorldCollider[] = [];
  const chimneyAnchors: THREE.Vector3[] = [];
  const priorityMarkers: PriorityMarkerRuntime[] = [];
  const cottagesRuntime: CottageWindowRuntime[] = [];
  const shopsRuntime: ShopRuntime[] = [];

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geos.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };
  const regTex = <T extends THREE.Texture>(t: T): T => {
    texs.push(t);
    return t;
  };

  // 1. Natural Outer Alpine Perimeter Skirt (rolling snow hills extending to horizon fog)
  const outerGeo = regGeo(new THREE.PlaneGeometry(240, 240, 48, 48));
  outerGeo.rotateX(-Math.PI / 2);
  const posAttr = outerGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const edgeDist = Math.max(Math.abs(vx) - WORLD_SIZE * 0.48, Math.abs(vz) - WORLD_SIZE * 0.48);
    if (edgeDist > 0) {
      const hill =
        Math.min(1, edgeDist / 16) *
        (1.6 + Math.sin(vx * 0.09) * 1.4 + Math.cos(vz * 0.08) * 1.3 + Math.sin((vx + vz) * 0.05) * 1.1);
      posAttr.setY(i, Math.max(-0.2, hill));
    } else {
      posAttr.setY(i, -0.25);
    }
  }
  outerGeo.computeVertexNormals();

  const outerSnowMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbe6f2,
      roughness: 0.9,
      metalness: 0.02,
    })
  );
  const outerTerrain = new THREE.Mesh(outerGeo, outerSnowMat);
  outerTerrain.receiveShadow = true;
  group.add(outerTerrain);

  // 2. Shared Materials for Cottages, Lamps & Props
  const stoneFoundationMat = regMat(new THREE.MeshStandardMaterial({ color: 0x525866, roughness: 0.9, metalness: 0.05 }));
  const chimneyBrickMat = regMat(new THREE.MeshStandardMaterial({ color: 0x7d453b, roughness: 0.88, metalness: 0.04 }));
  const snowCapMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf2f7fc, roughness: 0.85, metalness: 0.02 }));
  const timberDarkMat = regMat(new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.86, metalness: 0.05 }));
  const ironMat = regMat(new THREE.MeshStandardMaterial({ color: 0x252b34, roughness: 0.55, metalness: 0.72 }));
  const sharedLanternGlowMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4a8,
      emissive: 0xffae42,
      emissiveIntensity: 2.6,
      roughness: 0.15,
    })
  );

  // 3. Multi-Part Cozy Cottages with Individual Ambient Flickering & Cleared-Road Hearth Warmth
  contract.cottages.forEach((spec, idx) => {
    const cottage = new THREE.Group();
    const s = spec.scale ?? 1;
    cottage.position.set(spec.x, 0, spec.z);
    cottage.rotation.y = spec.rotY;
    cottage.scale.setScalar(s);

    const wallMat = regMat(new THREE.MeshStandardMaterial({ color: spec.wallColor, roughness: 0.84, metalness: 0.04 }));
    const roofMat = regMat(new THREE.MeshStandardMaterial({ color: spec.roofColor, roughness: 0.75, metalness: 0.08 }));
    const windowGlowMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffcf87,
        emissive: 0xff8424,
        emissiveIntensity: 1.55,
        roughness: 0.2,
        metalness: 0.05,
      })
    );
    const porchLanternMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffe09c,
        emissive: 0xffa638,
        emissiveIntensity: 2.0,
        roughness: 0.15,
      })
    );

    // Stone base
    const base = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.8, 0.55, 4.6)), stoneFoundationMat);
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;
    cottage.add(base);

    // Main timber cabin body
    const body = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.4, 2.5, 4.2)), wallMat);
    body.position.y = 1.8;
    body.castShadow = true;
    body.receiveShadow = true;
    cottage.add(body);

    // Pitched Roof (Extrude triangle)
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-3.2, 0);
    roofShape.lineTo(0, 2.15);
    roofShape.lineTo(3.2, 0);
    roofShape.closePath();

    const roofGeo = regGeo(
      new THREE.ExtrudeGeometry(roofShape, {
        depth: 4.85,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.06,
        bevelSegments: 2,
      })
    );
    roofGeo.center();
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 3.85, 0);
    roof.castShadow = true;
    cottage.add(roof);

    // Thick roof snow cap
    const snowRoofGeo = regGeo(
      new THREE.ExtrudeGeometry(roofShape, {
        depth: 4.95,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.1,
        bevelSegments: 2,
      })
    );
    snowRoofGeo.center();
    const snowRoof = new THREE.Mesh(snowRoofGeo, snowCapMat);
    snowRoof.position.set(0, 4.02, 0);
    snowRoof.scale.set(1.01, 0.96, 1.0);
    snowRoof.receiveShadow = true;
    cottage.add(snowRoof);

    // Brick chimney
    const chimney = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.75, 2.2, 0.75)), chimneyBrickMat);
    chimney.position.set(1.55, 4.5, -0.8);
    chimney.castShadow = true;
    cottage.add(chimney);

    const chimneyTopLocal = new THREE.Vector3(1.55, 5.7, -0.8);
    chimneyTopLocal
      .multiplyScalar(s)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotY)
      .add(new THREE.Vector3(spec.x, 0, spec.z));
    chimneyAnchors.push(chimneyTopLocal);

    // Warm Glowing Windows (Front & Sides)
    [-1.4, 1.4].forEach((wx) => {
      const winFrame = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.05, 1.05, 0.14)), timberDarkMat);
      winFrame.position.set(wx, 1.9, 2.12);
      cottage.add(winFrame);

      const winPane = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.84, 0.84, 0.18)), windowGlowMat);
      winPane.position.set(wx, 1.9, 2.13);
      cottage.add(winPane);

      const sill = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.18, 0.14, 0.25)), snowCapMat);
      sill.position.set(wx, 1.38, 2.18);
      cottage.add(sill);
    });

    [-2.72, 2.72].forEach((sx) => {
      const sidePane = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.14, 0.85, 0.9)), windowGlowMat);
      sidePane.position.set(sx, 1.95, 0);
      cottage.add(sidePane);
    });

    // Front Porch Door & Warm Lantern
    const door = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.95, 1.75, 0.14)), timberDarkMat);
    door.position.set(0, 1.42, 2.12);
    cottage.add(door);

    const porchAwning = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.6, 0.18, 0.9)), snowCapMat);
    porchAwning.position.set(0, 2.48, 2.52);
    cottage.add(porchAwning);

    const porchLantern = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.14, 10, 10)), porchLanternMat);
    porchLantern.position.set(0.66, 2.15, 2.3);
    cottage.add(porchLantern);

    let hearthLight: THREE.PointLight | null = null;
    if (idx < 2) {
      hearthLight = new THREE.PointLight(0xffa94d, 2.8, 12, 1.6);
      hearthLight.position.set(0, 2.2, 3.4);
      cottage.add(hearthLight);
    }

    // Sample point on the driveway/road directly in front of the cottage door
    const sampleX = spec.x + Math.sin(spec.rotY) * 7.2 * s;
    const sampleZ = spec.z + Math.cos(spec.rotY) * 7.2 * s;

    cottagesRuntime.push({
      sampleX,
      sampleZ,
      windowMat: windowGlowMat,
      lanternMat: porchLanternMat,
      hearthLight,
      warmFactor: 0,
      warmAnnounced: false,
      phase: idx * 1.9 + 0.4,
    });

    group.add(cottage);
    colliders.push({ x: spec.x, z: spec.z, radius: 3.6 * s });
  });

  // 3B. Open City Shops with Striped Awnings, Open Double Doors, Illuminated Interiors & Glowing OPEN Signs
  const brassMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.7 }));
  const counterWoodMat = regMat(new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.78 }));
  const patioStoneMat = regMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 }));

  contract.shops.forEach((shopSpec, idx) => {
    const shopGroup = new THREE.Group();
    shopGroup.position.set(shopSpec.x, 0, shopSpec.z);
    shopGroup.rotation.y = shopSpec.rotY;

    const wallMat = regMat(new THREE.MeshStandardMaterial({ color: shopSpec.wallColor, roughness: 0.82 }));
    const interiorGlowMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff3d1,
        emissive: 0xffb347,
        emissiveIntensity: 1.65,
        roughness: 0.35,
      })
    );
    const awningTex = regTex(createAwningTexture(shopSpec.awningColor));
    const awningMat = regMat(new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.75 }));
    const signTex = regTex(createShopSignTexture(shopSpec));
    const signMat = regMat(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 1.15,
        roughness: 0.25,
      })
    );

    // Raised Sidewalk Patio Apron (where crowd stands outside the open door)
    const patio = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.8, 0.22, 2.3)), patioStoneMat);
    patio.position.set(0, 0.11, 2.75);
    patio.receiveShadow = true;
    shopGroup.add(patio);

    // Building Base
    const base = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.4, 0.4, 4.0)), stoneFoundationMat);
    base.position.set(0, 0.2, -0.35);
    base.castShadow = true;
    base.receiveShadow = true;
    shopGroup.add(base);

    // Back & Side Storefront Walls (leaving front center open!)
    const backWall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.0, 2.9, 0.35)), wallMat);
    backWall.position.set(0, 1.85, -2.05);
    backWall.castShadow = true;
    shopGroup.add(backWall);

    [-2.85, 2.85].forEach((sx) => {
      const sideWall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.35, 2.9, 3.7)), wallMat);
      sideWall.position.set(sx, 1.85, -0.35);
      sideWall.castShadow = true;
      shopGroup.add(sideWall);
    });

    // Front Corner Pillars + Upper Fascia Header (open center bay)
    [-2.1, 2.1].forEach((px) => {
      const pier = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.75, 2.9, 0.35)), wallMat);
      pier.position.set(px, 1.85, 1.45);
      pier.castShadow = true;
      shopGroup.add(pier);
    });

    const headerWall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.1, 0.9, 0.42)), wallMat);
    headerWall.position.set(0, 2.95, 1.45);
    headerWall.castShadow = true;
    shopGroup.add(headerWall);

    // Illuminated Warm Interior + Service Counter (visible through open double doorway)
    const interiorBack = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(5.2, 2.4)), interiorGlowMat);
    interiorBack.position.set(0, 1.75, -1.84);
    shopGroup.add(interiorBack);

    const interiorFloor = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.5, 0.12, 3.2)), counterWoodMat);
    interiorFloor.position.set(0, 0.38, -0.2);
    shopGroup.add(interiorFloor);

    const shopCounter = new THREE.Mesh(regGeo(new THREE.BoxGeometry(2.6, 0.92, 0.72)), counterWoodMat);
    shopCounter.position.set(0, 0.88, -0.75);
    shopGroup.add(shopCounter);

    // Open Double Storefront Doors swung outward-inward at ±70°
    [-0.78, 0.78].forEach((dx, dIdx) => {
      const doorLeaf = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.68, 2.05, 0.08)), timberDarkMat);
      doorLeaf.position.set(dx, 1.42, 1.12);
      doorLeaf.rotation.y = dIdx === 0 ? -1.2 : 1.2;
      shopGroup.add(doorLeaf);
    });

    // Large Glowing Storefront Display Windows
    [-2.05, 2.05].forEach((wx) => {
      const frame = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.38, 1.48, 0.16)), timberDarkMat);
      frame.position.set(wx, 1.65, 1.6);
      shopGroup.add(frame);
      const pane = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.18, 1.28, 0.2)), interiorGlowMat);
      pane.position.set(wx, 1.65, 1.61);
      shopGroup.add(pane);
    });

    // Flat Roof + Snow Cornice
    const roofCap = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.5, 0.35, 4.35)), stoneFoundationMat);
    roofCap.position.set(0, 3.5, -0.3);
    roofCap.castShadow = true;
    shopGroup.add(roofCap);

    const roofSnow = new THREE.Mesh(regGeo(new THREE.BoxGeometry(6.65, 0.28, 4.45)), snowCapMat);
    roofSnow.position.set(0, 3.78, -0.3);
    roofSnow.receiveShadow = true;
    shopGroup.add(roofSnow);

    // Striped Fabric Awning over Entrance
    const awning = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.6, 0.16, 1.55)), awningMat);
    awning.position.set(0, 2.52, 2.22);
    awning.rotation.x = 0.28;
    awning.castShadow = true;
    shopGroup.add(awning);

    // Glowing "OPEN" Storefront Signboard
    const signBoard = new THREE.Mesh(regGeo(new THREE.BoxGeometry(4.3, 1.15, 0.18)), signMat);
    signBoard.position.set(0, 3.45, 1.72);
    shopGroup.add(signBoard);

    // Outdoor Bistro Table / Cocoa Barrels on Patio
    [-2.45, 2.45].forEach((tx) => {
      const leg = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8)), ironMat);
      leg.position.set(tx, 0.56, 2.45);
      const top = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12)), counterWoodMat);
      top.position.set(tx, 0.94, 2.45);
      const mug = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.09, 0.08, 0.14, 8)), brassMat);
      mug.position.set(tx + 0.08, 1.04, 2.45);
      shopGroup.add(leg, top, mug);
    });

    if (idx < 2) {
      const shopLight = new THREE.PointLight(0xffb85c, 3.2, 13, 1.5);
      shopLight.position.set(0, 2.4, 3.2);
      shopGroup.add(shopLight);
    }

    group.add(shopGroup);

    // Collider covers only the shop structure behind the sidewalk patio
    const backCenterX = shopSpec.x - Math.sin(shopSpec.rotY) * 0.4;
    const backCenterZ = shopSpec.z - Math.cos(shopSpec.rotY) * 0.4;
    colliders.push({ x: backCenterX, z: backCenterZ, radius: 3.1 });

    // Street apron sampling point directly in front of the open shop
    const sampleX = shopSpec.x + Math.sin(shopSpec.rotY) * 5.8;
    const sampleZ = shopSpec.z + Math.cos(shopSpec.rotY) * 5.8;

    const apronRingGeo = regGeo(new THREE.RingGeometry(1.85, 2.15, 32));
    apronRingGeo.rotateX(-Math.PI / 2);
    const apronRingMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const apronRingMesh = new THREE.Mesh(apronRingGeo, apronRingMat);
    apronRingMesh.position.set(sampleX, 0.42, sampleZ);
    group.add(apronRingMesh);

    shopsRuntime.push({
      spec: shopSpec,
      sampleX,
      sampleZ,
      signMat,
      interiorMat: interiorGlowMat,
      apronRingMesh,
      apronRingMat,
      apronCleared: false,
      tipClaimed: false,
      phase: idx * 1.4,
    });
  });

  // 4. Streetlamps along twilight lanes
  contract.lampCoords.forEach((lc, idx) => {
    const lamp = new THREE.Group();
    lamp.position.set(lc.x, 0, lc.z);

    const post = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.08, 0.13, 3.8, 10)), ironMat);
    post.position.y = 1.9;
    post.castShadow = true;
    lamp.add(post);

    const arm = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.75, 0.08, 0.08)), ironMat);
    arm.position.set(0.32, 3.76, 0);
    lamp.add(arm);

    const cap = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.28, 0.24, 8)), ironMat);
    cap.position.set(0.65, 3.65, 0);
    lamp.add(cap);

    const bulb = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.14, 0.1, 0.28, 10)), sharedLanternGlowMat);
    bulb.position.set(0.65, 3.42, 0);
    lamp.add(bulb);

    if (idx < 2) {
      const pool = new THREE.PointLight(0xffb454, 4.0, 14, 1.5);
      pool.position.set(0.65, 3.3, 0);
      lamp.add(pool);
    }

    group.add(lamp);
    colliders.push({ x: lc.x, z: lc.z, radius: 0.45 });
  });

  // 5. Instanced Snow-Dusted Pine Groves (per-instance scale ±15% & tint variation)
  const treePositions: Array<{ x: number; z: number; scale: number; rotY: number }> = [];
  for (let i = 0; i < 165; i++) {
    const angle = i * 2.3999632;
    const rad = 11 + Math.sqrt(i / 165) * 44;
    const tx = Math.cos(angle) * rad + Math.sin(i * 1.7 + contract.index) * 3.2;
    const tz = Math.sin(angle) * rad + Math.cos(i * 1.3 - contract.index) * 3.2;
    if (Math.abs(tx) > 52 || Math.abs(tz) > 52) continue;
    if (isNearRoad(tx, tz, contract, 2.3)) continue;

    let tooClose = false;
    for (const tp of treePositions) {
      if ((tp.x - tx) * (tp.x - tx) + (tp.z - tz) * (tp.z - tz) < 9.5) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const scale = 0.85 + (((i * 37) % 100) / 100) * 0.34;
    treePositions.push({ x: tx, z: tz, scale, rotY: (i * 1.1) % (Math.PI * 2) });

    if (Math.abs(tx) < 35 && Math.abs(tz) < 35) {
      colliders.push({ x: tx, z: tz, radius: 0.9 * scale });
    }
  }

  if (treePositions.length > 0) {
    const count = treePositions.length;
    const trunkGeo = regGeo(new THREE.CylinderGeometry(0.22, 0.34, 1.35, 8));
    const trunkMat = regMat(new THREE.MeshStandardMaterial({ color: 0x4d3528, roughness: 0.92, metalness: 0.02 }));
    const foliageMat = regMat(new THREE.MeshStandardMaterial({ color: 0x264b3f, roughness: 0.85, metalness: 0.02 }));

    const tier1Geo = regGeo(new THREE.ConeGeometry(1.45, 2.1, 8));
    const tier2Geo = regGeo(new THREE.ConeGeometry(1.12, 1.85, 8));
    const tier3Geo = regGeo(new THREE.ConeGeometry(0.75, 1.5, 8));
    const snowTipGeo = regGeo(new THREE.ConeGeometry(0.58, 1.05, 8));

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const tier1Inst = new THREE.InstancedMesh(tier1Geo, foliageMat, count);
    const tier2Inst = new THREE.InstancedMesh(tier2Geo, foliageMat, count);
    const tier3Inst = new THREE.InstancedMesh(tier3Geo, foliageMat, count);
    const snowTipInst = new THREE.InstancedMesh(snowTipGeo, snowCapMat, count);

    trunkInst.castShadow = true;
    tier1Inst.castShadow = true;
    tier2Inst.castShadow = true;
    tier3Inst.castShadow = true;
    snowTipInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    treePositions.forEach((tp, idx) => {
      dummy.position.set(tp.x, 0.675 * tp.scale, tp.z);
      dummy.rotation.set(0, tp.rotY, 0);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 2.05 * tp.scale, tp.z);
      dummy.updateMatrix();
      tier1Inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 3.15 * tp.scale, tp.z);
      dummy.updateMatrix();
      tier2Inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 4.15 * tp.scale, tp.z);
      dummy.updateMatrix();
      tier3Inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 4.42 * tp.scale, tp.z);
      dummy.updateMatrix();
      snowTipInst.setMatrixAt(idx, dummy.matrix);

      const shade = 0.82 + ((idx * 19) % 10) * 0.036;
      tint.setRGB(0.14 * shade, 0.3 * shade, 0.25 * shade);
      tier1Inst.setColorAt(idx, tint);
      tier2Inst.setColorAt(idx, tint);
      tier3Inst.setColorAt(idx, tint);
    });

    [trunkInst, tier1Inst, tier2Inst, tier3Inst, snowTipInst].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }

  // 6. Priority Zone Beacons (Mailboxes, Hydrants, Lantern Posts)
  const mailboxRedMat = regMat(new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.4, metalness: 0.25 }));
  const hydrantMat = regMat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.35 }));

  contract.priorityZones.forEach((pz) => {
    const propGroup = new THREE.Group();
    propGroup.position.set(pz.x, 0, pz.z);

    const propOffset = pz.kind === 'lantern' ? 0 : pz.radius * 0.68;
    const propHolder = new THREE.Group();
    propHolder.position.set(propOffset, 0, 0);

    if (pz.kind === 'mailbox') {
      const post = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 8)), timberDarkMat);
      post.position.y = 0.5;
      const box = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.32, 0.24, 0.5)), mailboxRedMat);
      box.position.y = 1.05;
      const cap = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.34, 0.07, 0.52)), snowCapMat);
      cap.position.y = 1.19;
      propHolder.add(post, box, cap);
    } else if (pz.kind === 'hydrant') {
      const body = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.16, 0.2, 0.72, 10)), hydrantMat);
      body.position.y = 0.36;
      const dome = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.17, 10, 8)), hydrantMat);
      dome.position.y = 0.74;
      const nozzle = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8)), ironMat);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.y = 0.52;
      propHolder.add(body, dome, nozzle);
    } else {
      const plinth = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.32, 0.4, 0.55, 8)), stoneFoundationMat);
      plinth.position.y = 0.275;
      const lantern = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.38, 8)), sharedLanternGlowMat);
      lantern.position.y = 0.74;
      const hat = new THREE.Mesh(regGeo(new THREE.ConeGeometry(0.28, 0.2, 8)), ironMat);
      hat.position.y = 1.02;
      propHolder.add(plinth, lantern, hat);
    }

    propGroup.add(propHolder);

    const ringGeo = regGeo(new THREE.RingGeometry(pz.radius - 0.24, pz.radius, 40));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(pz.x, 0.45, pz.z);
    group.add(ringMesh);
    group.add(propGroup);

    priorityMarkers.push({
      spec: pz,
      cleared: false,
      ringMesh,
      ringMat,
      propGroup,
    });
  });

  return {
    group,
    colliders,
    chimneyAnchors,
    priorityMarkers,
    cottagesRuntime,
    shopsRuntime,
    update: (elapsed: number, dt: number, sampleClearedRatio?: (x: number, z: number, radius: number) => number) => {
      priorityMarkers.forEach((pm, i) => {
        if (!pm.cleared) {
          pm.ringMesh.position.y = 0.45 + Math.sin(elapsed * 3.2 + i) * 0.04;
          pm.ringMat.opacity = 0.62 + Math.sin(elapsed * 4.0 + i) * 0.2;
        } else if (pm.ringMat.opacity > 0.01) {
          pm.ringMat.opacity = Math.max(0, pm.ringMat.opacity - 0.03);
          pm.ringMesh.scale.multiplyScalar(1.015);
        } else {
          pm.ringMesh.visible = false;
        }
      });

      let newlyLitCount = 0;
      cottagesRuntime.forEach((cr) => {
        const nearCleared = sampleClearedRatio ? sampleClearedRatio(cr.sampleX, cr.sampleZ, 4.8) : 0;
        const targetWarm = nearCleared >= 0.7 ? 1 : nearCleared * 0.4;
        cr.warmFactor = THREE.MathUtils.damp(cr.warmFactor, targetWarm, 3.2, dt);

        if (nearCleared >= 0.7 && !cr.warmAnnounced) {
          cr.warmAnnounced = true;
          newlyLitCount += 1;
        }

        // Subtle organic fireplace/hearth flicker
        const flicker =
          Math.sin(elapsed * 4.7 + cr.phase) * 0.09 +
          Math.sin(elapsed * 11.3 + cr.phase * 1.7) * 0.05 +
          Math.cos(elapsed * 19.1 + cr.phase * 0.6) * 0.025;

        cr.windowMat.color.lerpColors(_dimColor, _litColor, cr.warmFactor);
        cr.windowMat.emissive.lerpColors(_dimEmissive, _litEmissive, cr.warmFactor);
        cr.windowMat.emissiveIntensity = 1.48 + cr.warmFactor * 1.35 + flicker;

        cr.lanternMat.emissiveIntensity = 1.9 + cr.warmFactor * 1.1 + flicker * 0.6;
        if (cr.hearthLight) {
          cr.hearthLight.intensity = 2.6 + cr.warmFactor * 2.2 + flicker * 0.7;
        }
      });

      shopsRuntime.forEach((sr) => {
        const ratio = sampleClearedRatio ? sampleClearedRatio(sr.sampleX, sr.sampleZ, 3.8) : 0;
        if (ratio >= 0.74) {
          sr.apronCleared = true;
        }
        const pulse = Math.sin(elapsed * 3.4 + sr.phase) * 0.12;
        sr.signMat.emissiveIntensity = (sr.apronCleared ? 1.4 : 1.1) + pulse;
        sr.interiorMat.emissiveIntensity = 1.55 + Math.sin(elapsed * 2.5 + sr.phase) * 0.15;

        if (!sr.apronCleared) {
          sr.apronRingMesh.visible = true;
          sr.apronRingMat.opacity = 0.48 + Math.sin(elapsed * 3.5 + sr.phase) * 0.18;
        } else if (!sr.tipClaimed) {
          sr.apronRingMat.color.setHex(0xfbbf24);
          sr.apronRingMat.opacity = 0.68 + Math.sin(elapsed * 5 + sr.phase) * 0.2;
        } else {
          sr.apronRingMesh.visible = false;
        }
      });

      return newlyLitCount;
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
