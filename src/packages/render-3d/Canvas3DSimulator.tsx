import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { getDevicePresetById } from '../device-catalog/catalog.ts';
import { getMediaDrawableForAsset } from '../media/proceduralMedia.ts';
import {
  computeScreenMediaRect,
  resolveActiveClipForMediaAtFrame,
  resolveDeviceAtFrame,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type {
  CameraPresetId,
  DevicePreset,
  SceneDeviceObject,
} from '../shared/types.ts';

// Pre-allocated math helpers at module scope (zero GC in render loop)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3(0, 0, 0);
const _currentLookAt = new THREE.Vector3(0, 0, 0);

interface Device3DAdapterRecord {
  group: THREE.Group;
  chassisMesh: THREE.Mesh;
  bezelMesh: THREE.Mesh;
  screenMesh: THREE.Mesh;
  glassCoverMesh: THREE.Mesh;
  accentGroup: THREE.Group;
  contactShadowMesh: THREE.Mesh;
  screenCanvas: HTMLCanvasElement;
  screenTexture: THREE.CanvasTexture;
  presetId: string;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);

  shape.moveTo(x + rad, y);
  shape.lineTo(x + w - rad, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rad);
  shape.lineTo(x + w, y + h - rad);
  shape.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  shape.lineTo(x + rad, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rad);
  shape.lineTo(x, y + rad);
  shape.quadraticCurveTo(x, y, x + rad, y);
  return shape;
}

/**
 * Builds a composite 5-9 part 3D device model from a DevicePreset.
 */
function buildComposite3DDeviceMesh(
  preset: DevicePreset,
  maxAnisotropy: number
): Omit<Device3DAdapterRecord, 'presetId'> {
  const group = new THREE.Group();

  // Scale logical canvas pixels to Three.js world units (approx 180px = 1 world unit)
  const scaleFactor = 1 / 170;
  const worldW = preset.width * scaleFactor;
  const worldH = preset.height * scaleFactor;
  const worldR = preset.outerRadius * scaleFactor;
  const depth = preset.depth3D || 0.25;

  // Part 1: Primary Silhouette — Beveled Metallic Chassis
  const chassisShape = createRoundedRectShape(worldW, worldH, worldR);
  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
    depth: depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  chassisGeo.center();

  const chassisMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(preset.frameColor),
    metalness: preset.metalness,
    roughness: preset.roughness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  group.add(chassisMesh);

  // Part 2: Secondary Read — Recessed Dark Glass Bezel
  const bezelGeo = new THREE.PlaneGeometry(worldW * 0.96, worldH * 0.96);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#070A10'),
    roughness: 0.14,
    metalness: 0.15,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.z = depth / 2 + 0.028;
  group.add(bezelMesh);

  // Part 3: Dynamic Live Video/Procedural Screen Surface
  const screenW =
    (preset.width - preset.bezelLeft - preset.bezelRight) * scaleFactor;
  const screenH =
    (preset.height - preset.bezelTop - preset.bezelBottom) * scaleFactor;

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = Math.max(
    256,
    Math.round(512 * (screenH / Math.max(0.1, screenW)))
  );
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = maxAnisotropy;

  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: screenTexture,
    roughness: 0.18,
    metalness: 0.05,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: screenTexture,
    emissiveIntensity: 0.28,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.z = depth / 2 + 0.032;
  group.add(screenMesh);

  // Part 4: Optical Clearcoat Display Cover (separates in Exploded View)
  const glassGeo = new THREE.PlaneGeometry(worldW * 0.95, worldH * 0.95);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const glassCoverMesh = new THREE.Mesh(glassGeo, glassMat);
  glassCoverMesh.position.z = depth / 2 + 0.04;
  glassCoverMesh.renderOrder = 5;
  group.add(glassCoverMesh);

  // Part 5..9: Accent Hardware Details (Notch, Camera Module, Side Buttons, Base/Stand/Strap)
  const accentGroup = new THREE.Group();
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(preset.frameAccentColor),
    metalness: 0.9,
    roughness: 0.22,
  });
  const darkLensMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#05070B'),
    metalness: 0.4,
    roughness: 0.1,
  });

  // Dynamic Island or Notch on front
  if (preset.notchType === 'dynamic-island' || preset.notchType === 'notch') {
    const pillGeo = new THREE.BoxGeometry(worldW * 0.26, 0.11, 0.015);
    const pillMesh = new THREE.Mesh(pillGeo, darkLensMat);
    pillMesh.position.set(0, screenH / 2 - 0.14, depth / 2 + 0.036);
    accentGroup.add(pillMesh);
  }

  // Rear Camera Bump & Optical Lenses for phones/tablets
  if (
    preset.category === 'iphone' ||
    preset.category === 'android' ||
    preset.category === 'tablet'
  ) {
    const bumpW = worldW * 0.38;
    const bumpH = worldW * 0.38;
    const bumpGeo = new THREE.BoxGeometry(bumpW, bumpH, 0.05);
    const bumpMesh = new THREE.Mesh(bumpGeo, accentMat);
    bumpMesh.position.set(
      -worldW * 0.22,
      worldH * 0.32,
      -depth / 2 - 0.03
    );
    accentGroup.add(bumpMesh);

    const lensGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20);
    lensGeo.rotateX(Math.PI / 2);
    const lensOffsets = [
      [-0.12, 0.12],
      [-0.12, -0.12],
      [0.12, 0],
    ];
    for (const [lx, ly] of lensOffsets) {
      const lens = new THREE.Mesh(lensGeo, darkLensMat);
      lens.position.set(
        -worldW * 0.22 + lx,
        worldH * 0.32 + ly,
        -depth / 2 - 0.055
      );
      accentGroup.add(lens);
    }

    // Side physical buttons
    const btnGeo = new THREE.BoxGeometry(0.03, 0.28, 0.08);
    const volUp = new THREE.Mesh(btnGeo, accentMat);
    volUp.position.set(-worldW / 2 - 0.025, worldH * 0.18, 0);
    const volDown = new THREE.Mesh(btnGeo, accentMat);
    volDown.position.set(-worldW / 2 - 0.025, worldH * 0.02, 0);
    const powerBtn = new THREE.Mesh(btnGeo, accentMat);
    powerBtn.position.set(worldW / 2 + 0.025, worldH * 0.12, 0);
    accentGroup.add(volUp, volDown, powerBtn);
  }

  // Laptop Hinged Keyboard Base + Trackpad
  if (preset.hasKeyboardBase) {
    const baseDepth = worldH * 0.72;
    const baseGeo = new THREE.BoxGeometry(worldW * 1.02, 0.11, baseDepth);
    const baseMesh = new THREE.Mesh(baseGeo, chassisMat);
    baseMesh.position.set(0, -worldH / 2 - 0.05, baseDepth / 2 - 0.08);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    accentGroup.add(baseMesh);

    // Dark recessed keyboard well
    const kbGeo = new THREE.BoxGeometry(worldW * 0.84, 0.02, baseDepth * 0.48);
    const kbMesh = new THREE.Mesh(kbGeo, darkLensMat);
    kbMesh.position.set(0, -worldH / 2 + 0.008, baseDepth * 0.28);
    accentGroup.add(kbMesh);
  }

  // Desktop Monitor Stand + Base Foot
  if (preset.hasMonitorStand) {
    const neckGeo = new THREE.BoxGeometry(0.45, 1.1, 0.12);
    const neckMesh = new THREE.Mesh(neckGeo, accentMat);
    neckMesh.position.set(0, -worldH / 2 - 0.45, -0.18);
    const footGeo = new THREE.BoxGeometry(1.6, 0.08, 1.1);
    const footMesh = new THREE.Mesh(footGeo, accentMat);
    footMesh.position.set(0, -worldH / 2 - 0.98, 0.1);
    accentGroup.add(neckMesh, footMesh);
  }

  // Smartwatch Straps + Orange Action Crown
  if (preset.hasWatchBand) {
    const strapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#EA580C'),
      roughness: 0.65,
      metalness: 0.1,
    });
    const topStrap = new THREE.Mesh(
      new THREE.BoxGeometry(worldW * 0.62, 0.65, 0.14),
      strapMat
    );
    topStrap.position.set(0, worldH / 2 + 0.28, 0);
    const botStrap = new THREE.Mesh(
      new THREE.BoxGeometry(worldW * 0.62, 0.65, 0.14),
      strapMat
    );
    botStrap.position.set(0, -worldH / 2 - 0.28, 0);
    accentGroup.add(topStrap, botStrap);
  }

  group.add(accentGroup);

  // Soft Radial Contact Shadow Disc directly underneath
  const shadowGeo = new THREE.CircleGeometry(Math.max(worldW, worldH) * 0.65, 32);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d');
  if (sctx) {
    const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadowMesh.position.set(0, -worldH / 2 - (preset.hasMonitorStand ? 1.02 : 0.42), 0);
  group.add(contactShadowMesh);

  return {
    group,
    chassisMesh,
    bezelMesh,
    screenMesh,
    glassCoverMesh,
    accentGroup,
    contactShadowMesh,
    screenCanvas,
    screenTexture,
  };
}

function getCameraTargetForPreset(
  preset: CameraPresetId,
  dist: number
): { pos: [number, number, number]; lookAt: [number, number, number] } {
  switch (preset) {
    case 'front':
      return { pos: [0, 0.25, dist], lookAt: [0, -0.35, 0] };
    case 'three-quarter-left':
      return {
        pos: [-dist * 0.42, dist * 0.18, dist * 0.9],
        lookAt: [0, -0.35, 0],
      };
    case 'three-quarter-right':
      return {
        pos: [dist * 0.42, dist * 0.18, dist * 0.9],
        lookAt: [0, -0.35, 0],
      };
    case 'isometric':
      return {
        pos: [dist * 0.56, dist * 0.48, dist * 0.74],
        lookAt: [0, -0.35, 0],
      };
    case 'side-profile':
      return {
        pos: [-dist * 0.85, 0.15, dist * 0.38],
        lookAt: [0, -0.35, 0],
      };
    case 'top-down':
      return {
        pos: [0, dist * 0.92, dist * 0.28],
        lookAt: [0, -0.2, 0],
      };
    default:
      return { pos: [0, 0.25, dist], lookAt: [0, -0.35, 0] };
  }
}

export const Canvas3DSimulator: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const storeState = useStudioStore();
  const stateRef = useRef(storeState);
  stateRef.current = storeState;

  // Orbit drag state stored in ref so pointer drags smoothly rotate camera
  const orbitAnglesRef = useRef<{ yaw: number; pitch: number; isDragging: boolean; lastX: number; lastY: number }>({
    yaw: 0,
    pitch: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Reset manual orbit offset when cameraPreset changes
  useEffect(() => {
    orbitAnglesRef.current.yaw = 0;
    orbitAnglesRef.current.pitch = 0;
  }, [storeState.studio3D.cameraPreset]);

  // Keyboard shortcut 'H' to toggle Cinema / Zen mode dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize Three.js WebGLRenderer and Scene ONCE per ultra-mode & threejs skill rules
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090D16');
    scene.fog = new THREE.FogExp2('#090D16', 0.035);

    const width = Math.max(320, mountEl.clientWidth || 1000);
    const height = Math.max(240, mountEl.clientHeight || 640);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(-3.2, 1.2, 7.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    // Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.2);
    keyLight.position.set(5, 7, 6);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    const d = 6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    // Subtle Studio Stage Floor Grid
    const gridHelper = new THREE.GridHelper(24, 24, 0x1e293b, 0x111827);
    gridHelper.position.y = -2.45;
    scene.add(gridHelper);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const deviceRecords = new Map<string, Device3DAdapterRecord>();

    // Pre-warm shaders
    renderer.compile(scene, camera);

    const clock = new THREE.Clock();
    let animId = 0;
    let lastHeadlessTick = 0;

    const animate = (now: number) => {
      if (isHeadless && now - lastHeadlessTick < 66) {
        animId = requestAnimationFrame(animate);
        return;
      }
      lastHeadlessTick = now;

      const dt = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const s = stateRef.current;

      // Sync background color & fog
      const bgHex =
        s.background.type === 'solid'
          ? s.background.solidColor
          : s.background.gradientStart || '#090D16';
      (scene.background as THREE.Color).set(bgHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(bgHex);
      }
      gridHelper.visible = s.background.gridOverlay;

      // Sync studio lights
      keyLight.intensity = s.studio3D.keyLightIntensity;
      rimLight.intensity = s.studio3D.rimLightIntensity;
      scene.environmentIntensity = s.studio3D.envReflectionIntensity;

      // Smoothly damp camera position and lookAt
      const presetTarget = getCameraTargetForPreset(
        s.studio3D.cameraPreset,
        s.studio3D.cameraDistance
      );
      const orbitOffset = s.studio3D.autoOrbit
        ? elapsed * s.studio3D.orbitSpeed
        : 0;
      const totalYaw = orbitAnglesRef.current.yaw + orbitOffset;
      const totalPitch = orbitAnglesRef.current.pitch;

      const baseVec = new THREE.Vector3(...presetTarget.pos);
      baseVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), totalYaw);
      baseVec.y = Math.max(-1.8, Math.min(6.5, baseVec.y + totalPitch * 2.5));

      _targetCamPos.copy(baseVec);
      _targetLookAt.set(...presetTarget.lookAt);

      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        _targetCamPos.x,
        6,
        dt
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        _targetCamPos.y,
        6,
        dt
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        _targetCamPos.z,
        6,
        dt
      );

      _currentLookAt.x = THREE.MathUtils.damp(
        _currentLookAt.x,
        _targetLookAt.x,
        6,
        dt
      );
      _currentLookAt.y = THREE.MathUtils.damp(
        _currentLookAt.y,
        _targetLookAt.y,
        6,
        dt
      );
      _currentLookAt.z = THREE.MathUtils.damp(
        _currentLookAt.z,
        _targetLookAt.z,
        6,
        dt
      );
      camera.lookAt(_currentLookAt);

      // Reconcile 3D device meshes with store devices
      const activeIds = new Set(s.devices.map((d) => d.id));
      for (const [id, rec] of deviceRecords.entries()) {
        if (!activeIds.has(id)) {
          scene.remove(rec.group);
          rec.screenTexture.dispose();
          deviceRecords.delete(id);
        }
      }

      for (const rawDev of s.devices) {
        const preset = getDevicePresetById(rawDev.presetId);
        let rec = deviceRecords.get(rawDev.id);

        if (!rec || rec.presetId !== rawDev.presetId) {
          if (rec) {
            scene.remove(rec.group);
            rec.screenTexture.dispose();
          }
          const built = buildComposite3DDeviceMesh(preset, maxAnisotropy);
          rec = { ...built, presetId: rawDev.presetId };
          scene.add(rec.group);
          deviceRecords.set(rawDev.id, rec);
        }

        rec.group.visible = rawDev.visible;
        if (!rawDev.visible) continue;

        const track = s.tracks.find((tr) => tr.targetId === rawDev.id);
        const resolved = resolveDeviceAtFrame(
          rawDev,
          track ? track.keyframes : [],
          s.currentFrame,
          s.durationInFrames
        );

        // Map 2D canvas X/Y offset relative to center into 3D stage coordinates
        const worldX = ((resolved.x - s.canvasWidth / 2) / s.canvasWidth) * 6.5;
        const worldY = (-(resolved.y - s.canvasHeight / 2) / s.canvasHeight) * 3.6;
        const worldZ = resolved.pos3DZ || 0;

        rec.group.position.x = THREE.MathUtils.damp(
          rec.group.position.x,
          worldX,
          8,
          dt
        );
        rec.group.position.y = THREE.MathUtils.damp(
          rec.group.position.y,
          worldY,
          8,
          dt
        );
        rec.group.position.z = THREE.MathUtils.damp(
          rec.group.position.z,
          worldZ,
          8,
          dt
        );

        const targetRotX = THREE.MathUtils.degToRad(resolved.rotation3DX || 0);
        const targetRotY = THREE.MathUtils.degToRad(resolved.rotation3DY || 0);
        const targetRotZ = THREE.MathUtils.degToRad(
          (resolved.rotation3DZ || 0) - resolved.rotation * 0.35
        );

        rec.group.rotation.x = THREE.MathUtils.damp(
          rec.group.rotation.x,
          targetRotX,
          8,
          dt
        );
        rec.group.rotation.y = THREE.MathUtils.damp(
          rec.group.rotation.y,
          targetRotY,
          8,
          dt
        );
        rec.group.rotation.z = THREE.MathUtils.damp(
          rec.group.rotation.z,
          targetRotZ,
          8,
          dt
        );

        rec.group.scale.setScalar(
          THREE.MathUtils.damp(rec.group.scale.x, resolved.scaleX, 8, dt)
        );

        // Exploded view layer separation
        const depth = preset.depth3D || 0.25;
        const explode = s.studio3D.explodedView || 0;
        rec.bezelMesh.position.z = THREE.MathUtils.damp(
          rec.bezelMesh.position.z,
          depth / 2 + 0.028 + explode * 0.35,
          8,
          dt
        );
        rec.screenMesh.position.z = THREE.MathUtils.damp(
          rec.screenMesh.position.z,
          depth / 2 + 0.032 + explode * 0.75,
          8,
          dt
        );
        rec.glassCoverMesh.position.z = THREE.MathUtils.damp(
          rec.glassCoverMesh.position.z,
          depth / 2 + 0.04 + explode * 1.15,
          8,
          dt
        );

        // Update frame color, finish style, roughness, metalness, and emissive glow
        const frameCol = resolved.customFrameColor || preset.frameColor;
        const chassisMat = rec.chassisMesh
          .material as THREE.MeshPhysicalMaterial;
        chassisMat.color.set(frameCol);

        const finish = resolved.finishStyle || 'brushed';
        chassisMat.roughness =
          resolved.customRoughness ??
          (finish === 'matte'
            ? 0.62
            : finish === 'polished' || finish === 'glass'
              ? 0.08
              : preset.roughness);
        chassisMat.metalness =
          resolved.customMetalness ??
          (finish === 'glass'
            ? 0.25
            : finish === 'matte'
              ? 0.45
              : preset.metalness);
        chassisMat.clearcoat =
          finish === 'polished' || finish === 'glass' ? 0.95 : 0.35;

        if (resolved.effects.glowEnabled) {
          chassisMat.emissive.set(resolved.effects.glowColor || '#38BDF8');
          const pulse = resolved.effects.animatedGlow
            ? 0.65 + 0.35 * Math.sin(elapsed * 3.8)
            : 1.0;
          chassisMat.emissiveIntensity =
            0.18 * (resolved.effects.glowIntensity ?? 0.6) * pulse;
        } else {
          chassisMat.emissiveIntensity = 0;
        }

        if (resolved.customBezelColor) {
          (rec.bezelMesh.material as THREE.MeshStandardMaterial).color.set(
            resolved.customBezelColor
          );
        }

        // Update contact shadow opacity
        (rec.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity =
          s.studio3D.contactShadowOpacity;

        // Update live screen texture from assigned media (respecting timeline clip trim/split)
        const mediaAsset = s.mediaAssets.find((m) => m.id === resolved.mediaId);
        const clipEval = resolveActiveClipForMediaAtFrame(
          s.clips,
          resolved.mediaId,
          s.currentFrame
        );
        const clipActive =
          !clipEval.hasClipsForMedia || Boolean(clipEval.activeClip);
        const mediaFrame = clipEval.hasClipsForMedia
          ? clipEval.sourceFrame
          : s.currentFrame;
        const drawable = clipActive
          ? getMediaDrawableForAsset(
              mediaAsset,
              mediaFrame,
              s.fps,
              s.isPlaying
            )
          : null;
        const sctx = rec.screenCanvas.getContext('2d');
        if (sctx && drawable && mediaAsset) {
          sctx.fillStyle = '#070A10';
          sctx.fillRect(0, 0, rec.screenCanvas.width, rec.screenCanvas.height);
          const fit = computeScreenMediaRect(
            rec.screenCanvas.width,
            rec.screenCanvas.height,
            mediaAsset.width,
            mediaAsset.height,
            resolved.screenTransform
          );
          sctx.drawImage(
            drawable,
            fit.sx,
            fit.sy,
            fit.sw,
            fit.sh,
            fit.dx,
            fit.dy,
            fit.dw,
            fit.dh
          );
          rec.screenTexture.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!mountEl) return;
      const w = Math.max(320, mountEl.clientWidth);
      const h = Math.max(240, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      envTexture.dispose();
      deviceRecords.forEach((rec) => rec.screenTexture.dispose());
      renderer.dispose();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitAnglesRef.current.isDragging = true;
    orbitAnglesRef.current.lastX = e.clientX;
    orbitAnglesRef.current.lastY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!orbitAnglesRef.current.isDragging) return;
    const dx = e.clientX - orbitAnglesRef.current.lastX;
    const dy = e.clientY - orbitAnglesRef.current.lastY;
    orbitAnglesRef.current.lastX = e.clientX;
    orbitAnglesRef.current.lastY = e.clientY;
    orbitAnglesRef.current.yaw -= dx * 0.007;
    orbitAnglesRef.current.pitch = Math.max(
      -0.8,
      Math.min(0.8, orbitAnglesRef.current.pitch + dy * 0.005)
    );
  };

  const handlePointerUp = () => {
    orbitAnglesRef.current.isDragging = false;
  };

  const { studio3D, updateStudio3D, setCameraPreset3D } = storeState;

  const cameraPresets: { id: CameraPresetId; label: string }[] = [
    { id: 'front', label: 'Front' },
    { id: 'three-quarter-left', label: '3/4 Left' },
    { id: 'three-quarter-right', label: '3/4 Right' },
    { id: 'isometric', label: 'Isometric' },
    { id: 'side-profile', label: 'Side' },
    { id: 'top-down', label: 'Top' },
  ];

  return (
    <div
      data-testid="canvas-3d-viewport"
      className="relative flex-1 h-full bg-[#090D16] overflow-hidden select-none"
    >
      {/* Dedicated Isolated WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left Minimal Spec Header */}
      <div className="absolute top-3 left-4 z-10 pointer-events-none flex items-center gap-2 text-xs text-slate-600 bg-white/95 border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
        <span className="font-semibold text-slate-900">3D PBR Simulator</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          FOV {studio3D.fov}° · {storeState.devices.filter((d) => d.visible).length} Active Meshes
        </span>
      </div>

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        style={{
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'min(920px, 94vw)',
        }}
        className="absolute z-20 flex flex-col items-center"
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          aria-label={dockCollapsed ? 'Show 3D Studio Controls' : 'Hide 3D Studio Controls'}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-slate-700 bg-white border border-b-0 border-slate-200 rounded-t-lg hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 shadow-xs"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
              Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-lg">
            {/* Camera Presets */}
            <div className="flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {cameraPresets.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => setCameraPreset3D(cp.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    studio3D.cameraPreset === cp.id
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {cp.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-200" />

            {/* Exploded View Slider */}
            <label className="flex items-center gap-2 text-xs text-slate-700 whitespace-nowrap shrink-0">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Exploded View</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={studio3D.explodedView}
                onChange={(e) =>
                  updateStudio3D({ explodedView: parseFloat(e.target.value) })
                }
                aria-label="Exploded View Separation"
                className="w-20 accent-blue-600 cursor-pointer"
              />
            </label>

            <div className="w-px h-5 bg-slate-200" />

            {/* Studio Key Light & Auto Orbit */}
            <label className="flex items-center gap-2 text-xs text-slate-700 whitespace-nowrap shrink-0">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Key Light</span>
              <input
                type="range"
                min={0.4}
                max={4}
                step={0.1}
                value={studio3D.keyLightIntensity}
                onChange={(e) =>
                  updateStudio3D({ keyLightIntensity: parseFloat(e.target.value) })
                }
                aria-label="Key Light Intensity"
                className="w-16 accent-blue-600 cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={() => updateStudio3D({ autoOrbit: !studio3D.autoOrbit })}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                studio3D.autoOrbit
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {studio3D.autoOrbit ? 'Turntable On' : 'Turntable Off'}
            </button>

            <button
              type="button"
              onClick={() => {
                orbitAnglesRef.current.yaw = 0;
                orbitAnglesRef.current.pitch = 0;
                updateStudio3D({
                  cameraPreset: 'three-quarter-left',
                  explodedView: 0,
                  cameraDistance: 8.5,
                });
              }}
              aria-label="Reset 3D Camera"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
