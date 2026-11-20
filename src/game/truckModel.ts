import * as THREE from 'three';
import { UpgradeLevels } from './types';

export interface TruckVisualRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  wheels: THREE.Group[];
  frontWheelPivots: THREE.Group[];
  beaconPivot: THREE.Group;
  beaconEmissiveMat: THREE.MeshStandardMaterial;
  spreaderSpinner: THREE.Group | null;
  plowAssembly: THREE.Group;
  bladeAnchor: THREE.Vector3;
  rearAnchor: THREE.Vector3;
  exhaustAnchor: THREE.Vector3;
  headlightMeshMat: THREE.MeshStandardMaterial;
  setUpgrades: (upgrades: UpgradeLevels) => void;
  setFirstPersonMode: (enabled: boolean) => void;
  updateAnimation: (
    dt: number,
    speed: number,
    steerAngle: number,
    isBoosting: boolean,
    elapsed: number,
    bladeSnowLoad?: number
  ) => void;
  dispose: () => void;
}

export function createVintagePickupTruck(initialUpgrades: UpgradeLevels): TruckVisualRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  // Materials with clear roughness/metalness contrast
  const paintMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc84b31, // Cozy heritage burnt-red pickup paint
      roughness: 0.32,
      metalness: 0.25,
    })
  );
  const creamTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2e8d5, // Vintage cream cab roof & grille accent
      roughness: 0.42,
      metalness: 0.1,
    })
  );
  const woodRailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7c5338,
      roughness: 0.85,
      metalness: 0.04,
    })
  );
  const chassisMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x242a34,
      roughness: 0.78,
      metalness: 0.4,
    })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9e0e8,
      roughness: 0.18,
      metalness: 0.92,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x203247,
      roughness: 0.12,
      metalness: 0.65,
    })
  );
  const rubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b1f26,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  const headlightMeshMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffc86b,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.1,
    })
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd93838,
      emissive: 0xff3b30,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  const beaconEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffb32c,
      emissive: 0xff9d00,
      emissiveIntensity: 2.4,
      roughness: 0.18,
      metalness: 0.15,
    })
  );

  // 1. Primary Silhouette: Chassis frame (grounded above wheel axles)
  const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.48, 0.22, 3.6)), chassisMat);
  chassis.position.set(0, 0.44, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyPivot.add(chassis);

  // 2. Vintage Cab (beveled ExtrudeGeometry side profile extruded across X)
  const cabShape = new THREE.Shape();
  cabShape.moveTo(-0.35, 0);
  cabShape.lineTo(1.25, 0);
  cabShape.lineTo(1.25, 0.56); // front hood nose
  cabShape.lineTo(0.45, 0.62); // windshield base
  cabShape.lineTo(0.18, 1.24); // windshield top
  cabShape.lineTo(-0.48, 1.24); // cab roof rear
  cabShape.lineTo(-0.56, 0.52); // cab back
  cabShape.lineTo(-0.35, 0);

  const cabGeo = trackGeo(
    new THREE.ExtrudeGeometry(cabShape, {
      depth: 1.46,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 3,
    })
  );
  cabGeo.center();
  // Rotate so X-profile faces +Z forward (shape +X becomes world +Z)
  cabGeo.rotateY(-Math.PI / 2);

  const cabMesh = new THREE.Mesh(cabGeo, paintMat);
  cabMesh.position.set(0, 1.12, 0.48);
  cabMesh.castShadow = true;
  cabMesh.receiveShadow = true;
  bodyPivot.add(cabMesh);

  // Cream vintage roof cap
  const roofCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.1, 0.88)), creamTrimMat);
  roofCap.position.set(0, 1.78, 0.14);
  roofCap.castShadow = true;
  bodyPivot.add(roofCap);

  // Windshield & side glass
  const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.32, 0.5, 0.08)), glassMat);
  windshield.position.set(0, 1.4, 0.72);
  windshield.rotation.x = -0.44;
  bodyPivot.add(windshield);

  const sideWindows = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.59, 0.42, 0.64)), glassMat);
  sideWindows.position.set(0, 1.42, 0.18);
  bodyPivot.add(sideWindows);

  // 2b. First-Person Driver Cab Framing (shown only in 1st-Person Cab view so exterior cab solid doesn't clip lens)
  const firstPersonGroup = new THREE.Group();
  firstPersonGroup.visible = false;
  bodyPivot.add(firstPersonGroup);

  // Visible front hood sloping gently forward toward the grille & plow blade
  const fpHood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.48, 0.46, 1.0)), paintMat);
  fpHood.position.set(0, 0.9, 1.24);
  fpHood.rotation.x = 0.06;
  fpHood.castShadow = true;
  firstPersonGroup.add(fpHood);

  // Hood center chrome ornament rib
  const fpHoodRib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.05, 0.85)), chromeMat);
  fpHoodRib.position.set(0, 1.15, 1.25);
  fpHoodRib.rotation.x = 0.06;
  firstPersonGroup.add(fpHoodRib);

  // Dashboard + warm amber instrument gauges
  const fpDash = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.42, 0.24, 0.36)), chassisMat);
  fpDash.position.set(0, 1.08, 0.64);
  firstPersonGroup.add(fpDash);

  const gaugeGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffd27d,
      emissive: 0xff9f38,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    })
  );
  [-0.14, 0.02, 0.16].forEach((gx) => {
    const dial = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12)), gaugeGlowMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(gx, 1.13, 0.46);
    firstPersonGroup.add(dial);
  });

  // Rotating Vintage Steering Wheel (centered slightly left/center for comfortable arcade framing)
  const steeringWheelPivot = new THREE.Group();
  steeringWheelPivot.position.set(0, 1.14, 0.44);
  steeringWheelPivot.rotation.x = -0.45;
  const wheelRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.16, 0.022, 8, 22)), woodRailMat);
  const wheelHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12)), chromeMat);
  wheelHub.rotation.x = Math.PI / 2;
  const spokeH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.022, 0.02)), chromeMat);
  const spokeV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.15, 0.02)), chromeMat);
  spokeV.position.y = -0.075;
  steeringWheelPivot.add(wheelRim, wheelHub, spokeH, spokeV);
  firstPersonGroup.add(steeringWheelPivot);

  // Slim left & right A-pillars + cream sun-visor header framing the windshield view
  [-0.72, 0.72].forEach((px) => {
    const pillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.72, 0.08)), paintMat);
    pillar.position.set(px, 1.46, 0.68);
    pillar.rotation.x = -0.35;
    firstPersonGroup.add(pillar);
  });
  const visorBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.09, 0.14)), creamTrimMat);
  visorBar.position.set(0, 1.78, 0.56);
  firstPersonGroup.add(visorBar);

  // 3. Pickup Cargo Bed & Wooden Bed Rails
  const bedFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.56, 0.48, 1.45)), paintMat);
  bedFloor.position.set(0, 0.82, -1.06);
  bedFloor.castShadow = true;
  bedFloor.receiveShadow = true;
  bodyPivot.add(bedFloor);

  // Recessed dark cargo bay interior
  const bedInner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.28, 0.12, 1.24)), chassisMat);
  bedInner.position.set(0, 1.04, -1.06);
  bodyPivot.add(bedInner);

  // Wooden stake rails on left & right of bed
  [-0.73, 0.73].forEach((rx) => {
    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.22, 1.38)), woodRailMat);
    rail.position.set(rx, 1.18, -1.06);
    rail.castShadow = true;
    bodyPivot.add(rail);
  });

  // 4. Front Grille, Chrome Bumper & Glowing Headlights
  const grille = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.36, 0.1)), creamTrimMat);
  grille.position.set(0, 0.82, 1.76);
  bodyPivot.add(grille);

  const frontBumper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.66, 0.14, 0.2)), chromeMat);
  frontBumper.position.set(0, 0.48, 1.85);
  frontBumper.castShadow = true;
  bodyPivot.add(frontBumper);

  const rearBumper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.62, 0.14, 0.16)), chromeMat);
  rearBumper.position.set(0, 0.48, -1.84);
  bodyPivot.add(rearBumper);

  [-0.52, 0.52].forEach((hx) => {
    const lamp = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 16)), headlightMeshMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(hx, 0.84, 1.79);
    bodyPivot.add(lamp);

    const tail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.12, 0.06)), taillightMat);
    tail.position.set(hx * 1.15, 0.72, -1.79);
    bodyPivot.add(tail);
  });

  // Exhaust Pipe (rear right)
  const exhaustPipe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 10)), chromeMat);
  exhaustPipe.position.set(0.58, 0.38, -1.85);
  exhaustPipe.rotation.x = Math.PI / 2.6;
  bodyPivot.add(exhaustPipe);

  // 5. Four Wheel Assemblies (bottom touches y = 0!)
  const wheelRadius = 0.38;
  const wheels: THREE.Group[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  const wheelPositions: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: -0.82, z: 1.1, isFront: true },
    { x: 0.82, z: 1.1, isFront: true },
    { x: -0.82, z: -1.08, isFront: false },
    { x: 0.82, z: -1.08, isFront: false },
  ];

  const tireGeo = trackGeo(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.28, 20));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14));
  rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10));
  hubGeo.rotateZ(Math.PI / 2);

  wheelPositions.forEach((wp) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wp.x, wheelRadius, wp.z);

    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, rubberMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, creamTrimMat);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    spinGroup.add(tire, rim, hub);

    steerPivot.add(spinGroup);
    root.add(steerPivot);

    wheels.push(spinGroup);
    if (wp.isFront) {
      frontWheelPivots.push(steerPivot);
    }
  });

  // 6. Dynamic Upgrade Containers
  const beaconPivot = new THREE.Group();
  beaconPivot.position.set(0, 1.84, 0.14);
  bodyPivot.add(beaconPivot);

  const spreaderGroup = new THREE.Group();
  spreaderGroup.position.set(0, 0.92, -1.68);
  bodyPivot.add(spreaderGroup);

  const plowAssembly = new THREE.Group();
  plowAssembly.position.set(0, 0.34, 2.08);
  bodyPivot.add(plowAssembly);

  const bladeSnowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f6fc,
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  const bladeSnowGroup = new THREE.Group();
  bladeSnowGroup.visible = false;
  plowAssembly.add(bladeSnowGroup);

  let spreaderSpinner: THREE.Group | null = null;
  let activeDynamicGeos: THREE.BufferGeometry[] = [];
  let activeDynamicMats: THREE.Material[] = [];

  const clearDynamicChildren = (group: THREE.Group) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  };

  const buildDynamicUpgrades = (upgrades: UpgradeLevels) => {
    activeDynamicGeos.forEach((g) => g.dispose());
    activeDynamicMats.forEach((m) => m.dispose());
    activeDynamicGeos = [];
    activeDynamicMats = [];
    clearDynamicChildren(beaconPivot);
    clearDynamicChildren(spreaderGroup);
    clearDynamicChildren(plowAssembly);
    plowAssembly.add(bladeSnowGroup);
    clearDynamicChildren(bladeSnowGroup);
    spreaderSpinner = null;

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      activeDynamicGeos.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      activeDynamicMats.push(m);
      return m;
    };

    // --- A. Modular Plow Blade (Level 0..3) ---
    const bladeLevel = upgrades.blade;
    const bladeWidth = 2.4 + bladeLevel * 0.62;
    const bladeHeight = 0.68 + bladeLevel * 0.08;

    const bladeYellowMat = regMat(
      new THREE.MeshStandardMaterial({
        color: bladeLevel === 0 ? 0xd9822b : bladeLevel === 1 ? 0xf59e0b : bladeLevel === 2 ? 0xfbbf24 : 0xf97316,
        roughness: 0.34,
        metalness: 0.35,
      })
    );
    const bladeEdgeMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x374151,
        roughness: 0.45,
        metalness: 0.78,
      })
    );

    // Hydraulic mount arms
    [-0.45, 0.45].forEach((ax) => {
      const arm = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.12, 0.14, 0.52)), chassisMat);
      arm.position.set(ax, 0.06, -0.18);
      plowAssembly.add(arm);
    });

    if (bladeLevel < 2) {
      // Curved single-piece angled blade
      const curveShape = new THREE.Shape();
      curveShape.moveTo(0, -bladeHeight * 0.42);
      curveShape.quadraticCurveTo(0.24, 0, 0.05, bladeHeight * 0.58);
      curveShape.lineTo(-0.08, bladeHeight * 0.58);
      curveShape.quadraticCurveTo(0.11, 0, -0.12, -bladeHeight * 0.42);
      curveShape.closePath();

      const bladeGeo = regGeo(
        new THREE.ExtrudeGeometry(curveShape, {
          depth: bladeWidth,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.02,
          bevelSegments: 2,
        })
      );
      bladeGeo.center();
      bladeGeo.rotateY(Math.PI / 2);

      const bladeMesh = new THREE.Mesh(bladeGeo, bladeYellowMat);
      bladeMesh.position.set(0, 0.1, 0.14);
      bladeMesh.rotation.y = 0.16; // Classic snow-throwing angle
      bladeMesh.castShadow = true;
      bladeMesh.receiveShadow = true;
      plowAssembly.add(bladeMesh);

      // Steel scraping edge
      const scrapeEdge = new THREE.Mesh(regGeo(new THREE.BoxGeometry(bladeWidth + 0.04, 0.1, 0.08)), bladeEdgeMat);
      scrapeEdge.position.set(0, -0.22, 0.18);
      scrapeEdge.rotation.y = 0.16;
      plowAssembly.add(scrapeEdge);
    } else {
      // V-Plow (Level 2) or Winged Municipal Blade (Level 3)
      const halfSpan = bladeWidth * 0.52;
      [-1, 1].forEach((side) => {
        const wing = new THREE.Mesh(regGeo(new THREE.BoxGeometry(halfSpan, bladeHeight, 0.14)), bladeYellowMat);
        wing.position.set(side * (halfSpan * 0.46), 0.1, 0.12);
        wing.rotation.y = -side * 0.26;
        wing.castShadow = true;
        wing.receiveShadow = true;
        plowAssembly.add(wing);

        const lip = new THREE.Mesh(regGeo(new THREE.BoxGeometry(halfSpan + 0.02, 0.12, 0.18)), bladeEdgeMat);
        lip.position.set(side * (halfSpan * 0.46), -0.22, 0.14);
        lip.rotation.y = -side * 0.26;
        plowAssembly.add(lip);
      });

      // Center wedge spine
      const spine = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.09, 0.12, bladeHeight + 0.05, 8)), bladeEdgeMat);
      spine.position.set(0, 0.1, 0.28);
      plowAssembly.add(spine);

      // Level 3 side wings + amber guide flags
      if (bladeLevel >= 3) {
        [-1, 1].forEach((side) => {
          const endPlate = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.1, bladeHeight + 0.1, 0.46)), bladeEdgeMat);
          endPlate.position.set(side * (bladeWidth * 0.49), 0.12, 0.06);
          plowAssembly.add(endPlate);

          const pole = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 8)), chromeMat);
          pole.position.set(side * (bladeWidth * 0.49), bladeHeight * 0.72, 0.12);
          plowAssembly.add(pole);

          const flag = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.065, 10, 10)), beaconEmissiveMat);
          flag.position.set(side * (bladeWidth * 0.49), bladeHeight * 0.96, 0.12);
          plowAssembly.add(flag);
        });
      }
    }

    // Dynamic snow mound scooped inside blade face
    const lobeGeo = regGeo(new THREE.SphereGeometry(0.32, 12, 10));
    const centerLobe = new THREE.Mesh(lobeGeo, bladeSnowMat);
    centerLobe.scale.set(bladeWidth * 0.72, 0.65, 0.85);
    centerLobe.position.set(0, 0.02, bladeLevel >= 2 ? 0.36 : 0.28);
    centerLobe.receiveShadow = true;

    const leftLobe = new THREE.Mesh(lobeGeo, bladeSnowMat);
    leftLobe.scale.set(bladeWidth * 0.44, 0.56, 0.72);
    leftLobe.position.set(-bladeWidth * 0.25, -0.02, bladeLevel >= 2 ? 0.22 : 0.25);

    const rightLobe = new THREE.Mesh(lobeGeo, bladeSnowMat);
    rightLobe.scale.set(bladeWidth * 0.44, 0.56, 0.72);
    rightLobe.position.set(bladeWidth * 0.25, -0.02, bladeLevel >= 2 ? 0.22 : 0.31);

    bladeSnowGroup.add(centerLobe, leftLobe, rightLobe);
    bladeSnowGroup.scale.set(1, 0.01, 0.01);

    // --- B. Rear Salt Spreader (Level 1..3) ---
    if (upgrades.spreader > 0) {
      const hopperMat = regMat(
        new THREE.MeshStandardMaterial({
          color: upgrades.spreader >= 3 ? 0x0284c7 : 0x475569,
          roughness: 0.42,
          metalness: 0.55,
        })
      );
      const hopper = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.45, 0.22, 0.62, 8)), hopperMat);
      hopper.position.set(0, 0.22, 0.14);
      hopper.castShadow = true;
      spreaderGroup.add(hopper);

      const chute = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.24, 0.36, 0.24)), chassisMat);
      chute.position.set(0, -0.2, -0.05);
      spreaderGroup.add(chute);

      const spinner = new THREE.Group();
      spinner.position.set(0, -0.4, -0.05);
      const disc = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.28 + upgrades.spreader * 0.06, 0.28, 0.05, 12)), chromeMat);
      const vane1 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.56, 0.07, 0.04)), bladeEdgeMat);
      const vane2 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.04, 0.07, 0.56)), bladeEdgeMat);
      spinner.add(disc, vane1, vane2);
      spreaderGroup.add(spinner);
      spreaderSpinner = spinner;
    }

    // --- C. Roof Beacon & Auxiliary Lights (Level 0..3) ---
    const beaconLvl = upgrades.beacon;
    beaconEmissiveMat.emissiveIntensity = 2.0 + beaconLvl * 0.8;
    headlightMeshMat.emissiveIntensity = 2.0 + beaconLvl * 0.7;

    if (beaconLvl === 0) {
      const dome = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 14)), beaconEmissiveMat);
      dome.position.set(0, 0.07, 0);
      beaconPivot.add(dome);
    } else {
      const barWidth = 0.75 + beaconLvl * 0.22;
      const barBase = new THREE.Mesh(regGeo(new THREE.BoxGeometry(barWidth, 0.07, 0.22)), chassisMat);
      barBase.position.set(0, 0.04, 0);
      beaconPivot.add(barBase);

      const count = beaconLvl + 1;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * (barWidth - 0.22);
        const pod = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12)), beaconEmissiveMat);
        pod.position.set(t, 0.12, 0);
        beaconPivot.add(pod);
      }
    }
  };

  buildDynamicUpgrades(initialUpgrades);

  return {
    root,
    bodyPivot,
    wheels,
    frontWheelPivots,
    beaconPivot,
    beaconEmissiveMat,
    spreaderSpinner,
    plowAssembly,
    bladeAnchor: new THREE.Vector3(0, 0.2, 2.25),
    rearAnchor: new THREE.Vector3(0, 0.2, -1.85),
    exhaustAnchor: new THREE.Vector3(0.58, 0.48, -2.05),
    headlightMeshMat,
    setUpgrades: buildDynamicUpgrades,
    setFirstPersonMode: (enabled: boolean) => {
      cabMesh.visible = !enabled;
      roofCap.visible = !enabled;
      windshield.visible = !enabled;
      sideWindows.visible = !enabled;
      beaconPivot.visible = !enabled;
      firstPersonGroup.visible = enabled;
    },
    updateAnimation: (dt, speed, steerAngle, isBoosting, elapsed, bladeSnowLoad = 0) => {
      // Rotate wheels based on travel speed
      const wheelSpin = (speed * dt) / wheelRadius;
      wheels.forEach((w) => {
        w.rotation.x += wheelSpin;
      });
      frontWheelPivots.forEach((fp) => {
        fp.rotation.y = THREE.MathUtils.lerp(fp.rotation.y, steerAngle * 0.65, 0.28);
      });

      // Rotate interior steering wheel in 1st-person mode
      steeringWheelPivot.rotation.z = THREE.MathUtils.lerp(steeringWheelPivot.rotation.z, -steerAngle * 2.1, 0.28);

      // Dynamic snow mound accumulating in front of blade
      const loadClamped = THREE.MathUtils.clamp(bladeSnowLoad, 0, 1);
      if (loadClamped > 0.02) {
        bladeSnowGroup.visible = true;
        const targetSy = (isBoosting ? 0.48 : 0.25 + loadClamped * 0.95) * (0.95 + Math.sin(elapsed * 22) * 0.05);
        const targetSz = isBoosting ? 0.52 : 0.25 + loadClamped * 1.05;
        bladeSnowGroup.scale.y = THREE.MathUtils.damp(bladeSnowGroup.scale.y, targetSy, 10, dt);
        bladeSnowGroup.scale.z = THREE.MathUtils.damp(bladeSnowGroup.scale.z, targetSz, 10, dt);
        bladeSnowGroup.position.x = THREE.MathUtils.damp(bladeSnowGroup.position.x, -steerAngle * 0.14, 8, dt);
      } else {
        bladeSnowGroup.scale.y = THREE.MathUtils.damp(bladeSnowGroup.scale.y, 0.01, 12, dt);
        bladeSnowGroup.scale.z = THREE.MathUtils.damp(bladeSnowGroup.scale.z, 0.01, 12, dt);
        if (bladeSnowGroup.scale.y < 0.03) {
          bladeSnowGroup.visible = false;
        }
      }

      // Subtle engine idle & drive suspension bounce
      const idleBob = Math.sin(elapsed * 14) * 0.008;
      const speedRoll = -steerAngle * Math.min(1, Math.abs(speed) / 8) * 0.09;
      bodyPivot.position.y = idleBob + (isBoosting ? 0.025 : 0);
      bodyPivot.rotation.z = THREE.MathUtils.lerp(bodyPivot.rotation.z, speedRoll, 0.18);
      bodyPivot.rotation.x = THREE.MathUtils.lerp(bodyPivot.rotation.x, isBoosting ? -0.04 : 0, 0.15);

      // Spin salt spreader if installed
      if (spreaderSpinner) {
        spreaderSpinner.rotation.y += dt * (4.5 + Math.abs(speed) * 1.4);
      }

      // Beacon subtle pulse / rotation
      beaconPivot.rotation.y += dt * 4.2;
      beaconEmissiveMat.emissiveIntensity = (isBoosting ? 3.8 : 2.2) + Math.sin(elapsed * 9) * 0.6;
    },
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      activeDynamicGeos.forEach((g) => g.dispose());
      activeDynamicMats.forEach((m) => m.dispose());
    },
  };
}
