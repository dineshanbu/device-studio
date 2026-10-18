export type DeviceCategory =
  | 'iphone'
  | 'android'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'browser'
  | 'wearable';

export type ScreenFitMode = 'contain' | 'cover' | 'stretch' | 'crop';

export type EasingType =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier'
  | 'spring';

export type NotchType =
  | 'dynamic-island'
  | 'notch'
  | 'punch-hole'
  | 'macbook-notch'
  | 'browser-bar'
  | 'none';

export type DeviceFinishStyle =
  | 'brushed'
  | 'matte'
  | 'polished'
  | 'glass'
  | 'metallic-gradient';

export type GlowAnimationMode =
  | 'none'
  | 'pulse'
  | 'breathing'
  | 'perimeter-sweep'
  | 'neon-sweep'
  | 'rainbow-cycle'
  | 'rotating-gradient'
  | 'intensity-wave';

export type DrawingToolType =
  | 'select'
  | 'brush'
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'rounded-rect'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'bezier'
  | 'eraser';

export type DrawingAnimationMode =
  | 'none'
  | 'draw-on'
  | 'stroke-reveal'
  | 'moving-light'
  | 'pulsing-outline'
  | 'neon-trace'
  | 'color-shift';

export type WebcamFrameShapeType =
  | 'circle'
  | 'ellipse'
  | 'rounded-rect'
  | 'square'
  | 'vertical-rect'
  | 'horizontal-rect'
  | 'oval'
  | 'capsule'
  | 'organic-blob'
  | 'curved-asymmetric'
  | 'arch'
  | 'rounded-hexagon'
  | 'octagon'
  | 'diamond'
  | 'slanted-rect'
  | 'cut-corner'
  | 'speech-bubble'
  | 'custom-svg'
  | 'custom-bezier';

export type WebcamStylePresetId =
  | 'neon-circular'
  | 'double-border'
  | 'gradient-outline'
  | 'animated-perimeter'
  | 'glassmorphism'
  | 'minimal-white'
  | 'metallic'
  | 'futuristic-hud'
  | 'gaming-streamer'
  | 'soft-shadow'
  | 'curved-editorial'
  | 'creator-colorful';

export type WebcamBorderAnimationMode =
  | 'none'
  | 'perimeter-trace'
  | 'moving-light'
  | 'pulsing-neon'
  | 'breathing'
  | 'rainbow-cycle'
  | 'gradient-rotation'
  | 'draw-on'
  | 'animated-dashed';

export type WebcamGlowType =
  | 'outer'
  | 'inner'
  | 'neon-perimeter'
  | 'ambient'
  | 'double-layer'
  | 'gradient'
  | 'multicolor';

export interface BrowserThemeConfig {
  toolbarColor: string;
  tabColor: string;
  windowBgColor: string;
  websiteBgColor: string;
  websiteAccentColor: string;
  websiteBorderColor: string;
  controlButtonsStyle: 'macos' | 'minimal' | 'windows';
  customUrlText: string;
}

export interface DevicePreset {
  id: string;
  name: string;
  category: DeviceCategory;
  brand: string;
  /** Base logical dimensions in canvas pixels */
  width: number;
  height: number;
  /** Screen inset padding from outer frame */
  bezelTop: number;
  bezelBottom: number;
  bezelLeft: number;
  bezelRight: number;
  /** Outer chassis corner radius */
  outerRadius: number;
  /** Inner screen corner radius */
  screenRadius: number;
  notchType: NotchType;
  frameColor: string;
  frameAccentColor: string;
  metalness: number;
  roughness: number;
  /** 3D physical thickness in world units */
  depth3D: number;
  hasKeyboardBase?: boolean;
  hasMonitorStand?: boolean;
  hasWatchBand?: boolean;
  hasGamepadControls?: boolean;
}

export interface ScreenTransform {
  fitMode: ScreenFitMode;
  zoom: number;
  offsetX: number;
  offsetY: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

export interface ObjectEffects {
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  glowEnabled: boolean;
  glowColor: string;
  glowSecondaryColor?: string;
  glowBlur: number;
  glowSpread?: number;
  glowIntensity: number;
  glowOpacity?: number;
  glowFalloff?: 'smooth' | 'sharp' | 'neon';
  animatedGlow: boolean;
  glowAnimationMode?: GlowAnimationMode;
  glowSpeed?: number;
  innerGlowEnabled?: boolean;
  innerGlowColor?: string;
  innerGlowBlur?: number;
  innerGlowIntensity?: number;
  borderWidth: number;
  borderColor: string;
  blur: number;
  entranceAnimation:
    | 'none'
    | 'fade-up'
    | 'scale-pop'
    | 'slide-left'
    | 'rotate-3d';
  exitAnimation: 'none' | 'fade-out' | 'scale-down';
  effectStackOrder?: 'shadow-glow-frame' | 'glow-shadow-frame';
}

export interface SceneDeviceObject {
  id: string;
  name: string;
  presetId: string;
  /** 2D Canvas coordinates (center-based) */
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  /** 3D orientation in degrees */
  rotation3DX: number;
  rotation3DY: number;
  rotation3DZ: number;
  pos3DX: number;
  pos3DY: number;
  pos3DZ: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
  zIndex: number;
  /** Screen media assignment */
  mediaId: string | null;
  screenTransform: ScreenTransform;
  /** Custom hardware appearance & theme overrides */
  customFrameColor?: string;
  customFrameSecondaryColor?: string;
  customButtonColor?: string;
  customBezelColor?: string;
  customScreenBgColor?: string;
  customOuterRadius?: number;
  finishStyle?: DeviceFinishStyle;
  colorIntensity?: number;
  customRoughness?: number;
  customMetalness?: number;
  browserTheme?: BrowserThemeConfig;
  effects: ObjectEffects;
}

export interface SceneDrawingObject {
  id: string;
  name: string;
  tool: Exclude<DrawingToolType, 'select' | 'eraser'>;
  /** Points relative to (x, y) center or local bounding box */
  points: { x: number; y: number }[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  strokeColor: string;
  strokeColorEnd: string;
  useGradientStroke: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  dashPattern: 'solid' | 'dashed' | 'dotted' | 'long-dash';
  cornerRadius: number;
  polygonSides: number;
  glowEnabled: boolean;
  glowColor: string;
  glowRadius: number;
  glowIntensity: number;
  glowSpread: number;
  glowOpacity?: number;
  lockAspectRatio?: boolean;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  /** Timeline clip start frame (default 0) */
  startFrame?: number;
  /** Timeline clip visible duration in frames */
  durationFrames?: number;
  /** Entrance transition inside the drawing's active timeline clip */
  entranceAnimation?: 'none' | 'fade-in' | 'scale-pop' | 'draw-on';
  /** Exit transition at the end of the drawing's active timeline clip */
  exitAnimation?: 'none' | 'fade-out' | 'scale-down';
  animationMode: DrawingAnimationMode;
  animationDurationFrames: number;
  animationSpeed: number;
  animationEasing: EasingType;
  animationLoop?: boolean;
}

export interface SceneWebcamOverlay {
  id: string;
  name: string;
  sourceType: 'live-camera' | 'media-asset' | 'procedural-presenter';
  mediaId: string | null;
  cameraDeviceId?: string;
  resolutionPreset?: '720p' | '1080p' | '4k';
  targetFps?: 30 | 60;
  /** 2D Canvas center-based transform */
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  lockAspectRatio: boolean;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  /** Frame Shape & Curve Geometry */
  shape: WebcamFrameShapeType;
  stylePreset: WebcamStylePresetId;
  cornerRadius: number;
  curveIntensity: number;
  curveTension: number;
  shapeOffset: number;
  innerPadding: number;
  bezierPoints: { x: number; y: number }[];
  customSvgPath?: string;
  /** Video Masking, Crop & Color Adjustments */
  fitMode: ScreenFitMode;
  zoom: number;
  panX: number;
  panY: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  mirrorHorizontal: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  /** Border Settings */
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
  borderSecondaryColor: string;
  borderGradient: boolean;
  borderOpacity: number;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'double' | 'glass' | 'hud';
  borderAnimationMode: WebcamBorderAnimationMode;
  borderAnimationSpeed: number;
  borderAnimationProgress?: number;
  /** Glow & Shadow Settings */
  glowEnabled: boolean;
  glowType: WebcamGlowType;
  glowColor: string;
  glowSecondaryColor: string;
  glowRadius: number;
  glowSpread: number;
  glowIntensity: number;
  glowOpacity: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  /** Timeline Visibility & Transitions */
  startFrame: number;
  durationFrames: number;
  entranceAnimation: 'none' | 'fade-in' | 'scale-pop' | 'slide-up';
  exitAnimation: 'none' | 'fade-out' | 'scale-down';
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'procedural';
  url: string;
  proceduralKey?:
    | 'fintech-mobile'
    | 'daw-desktop'
    | 'code-terminal'
    | 'ecommerce-app'
    | 'weather-spatial'
    | 'webcam-presenter';
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  sizeBytes: number;
  createdAt: number;
  missing?: boolean;
  waveformPeaks?: number[];
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  name: string;
  mediaType: 'video' | 'image' | 'procedural' | 'audio';
  trackId: string;
  /** Timeline start position in frames */
  startFrame: number;
  /** Visible clip length in frames (outPointFrames - trimStartFrames) */
  durationFrames: number;
  /** Source media in-point in frames */
  trimStartFrames: number;
  /** Source media out-point in frames (trimStartFrames + durationFrames * playbackSpeed) */
  sourceOutFrame?: number;
  /** Total available source duration in frames */
  sourceDurationFrames?: number;
  /** Playback rate multiplier (default 1.0) */
  playbackSpeed?: number;
  /** Optional target device id or null for any device using mediaId */
  targetDeviceId?: string | null;
  muted: boolean;
  locked: boolean;
  visible: boolean;
  waveformPeaks: number[];
}

export type AnimatablePropertyKey =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'opacity'
  | 'cornerRadius'
  | 'strokeWidth'
  | 'strokeColor'
  | 'borderOpacity'
  | 'glowBlur'
  | 'glowIntensity'
  | 'glowColor'
  | 'cropZoom'
  | 'panX'
  | 'panY'
  | 'borderProgress'
  | 'curveIntensity'
  | 'shadowBlur'
  | 'shadowOpacity'
  | 'backgroundColor'
  | 'rotation3DX'
  | 'rotation3DY'
  | 'rotation3DZ'
  | 'pos3DX'
  | 'pos3DY'
  | 'pos3DZ'
  | 'cameraZoom'
  | 'cameraFov'
  | 'materialColor';

export interface Keyframe {
  id: string;
  frame: number;
  easing: EasingType;
  properties: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
    cornerRadius?: number;
    strokeWidth?: number;
    strokeColor?: string;
    borderOpacity?: number;
    glowBlur?: number;
    glowIntensity?: number;
    glowColor?: string;
    cropZoom?: number;
    panX?: number;
    panY?: number;
    borderProgress?: number;
    curveIntensity?: number;
    shadowBlur?: number;
    shadowOpacity?: number;
    backgroundColor?: string;
    rotation3DX?: number;
    rotation3DY?: number;
    rotation3DZ?: number;
    pos3DX?: number;
    pos3DY?: number;
    pos3DZ?: number;
    cameraZoom?: number;
    cameraFov?: number;
    materialColor?: string;
  };
}

export interface TimelineTrack {
  id: string;
  targetId: string; // device id, drawing id, webcam id, 'camera', or media track
  label: string;
  type: 'device' | 'drawing' | 'webcam' | 'camera' | 'media';
  keyframes: Keyframe[];
  muted?: boolean;
  locked?: boolean;
  visible?: boolean;
  expanded?: boolean;
}

export type BackgroundType = 'solid' | 'gradient' | 'preset' | 'media';

export interface SceneBackground {
  type: BackgroundType;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  presetId: string;
  mediaId: string | null;
  ambientParticles: boolean;
  particleDensity: number;
  gridOverlay: boolean;
  vignetteIntensity: number;
}

export type CameraPresetId =
  | 'front'
  | 'three-quarter-left'
  | 'three-quarter-right'
  | 'isometric'
  | 'side-profile'
  | 'top-down';

export interface Studio3DSettings {
  cameraPreset: CameraPresetId;
  fov: number;
  cameraDistance: number;
  autoOrbit: boolean;
  orbitSpeed: number;
  keyLightIntensity: number;
  keyLightWarmth: number;
  rimLightIntensity: number;
  envReflectionIntensity: number;
  contactShadowOpacity: number;
  explodedView: number;
}

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:3' | 'custom';

export interface ExportSettings {
  format: 'png' | 'jpg' | 'webp' | 'svg' | 'gif' | 'webm' | 'mp4';
  resolution: '720p' | '1080p' | '4k';
  aspectRatio: AspectRatioPreset;
  customWidth: number;
  customHeight: number;
  fps: 24 | 30 | 60;
  quality: number;
  transparentBackground: boolean;
  includeAudio: boolean;
}

export interface ThemePalettePreset {
  id: string;
  name: string;
  frameColor: string;
  frameSecondaryColor: string;
  buttonColor: string;
  bezelColor: string;
  borderColor: string;
  glowColor: string;
  glowSecondaryColor: string;
  finishStyle: DeviceFinishStyle;
  browserToolbarColor: string;
  websiteAccentColor: string;
}

export type AnimationPresetId =
  | 'zoom-in'
  | 'zoom-out'
  | 'smooth-scale'
  | 'device-slide-in'
  | 'fade-in-out'
  | 'rotation-reveal'
  | 'floating-motion'
  | 'camera-push-in'
  | 'glow-pulse'
  | 'neon-border-sweep'
  | 'spring-bounce';

export interface CustomWebcamShapePreset {
  id: string;
  name: string;
  shape: WebcamFrameShapeType;
  curveIntensity: number;
  curveTension: number;
  bezierPoints: { x: number; y: number }[];
  customSvgPath?: string;
}

export interface ProjectDocument {
  version: number;
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: AspectRatioPreset;
  fps: 24 | 30 | 60;
  durationInFrames: number;
  devices: SceneDeviceObject[];
  drawings?: SceneDrawingObject[];
  webcams?: SceneWebcamOverlay[];
  customWebcamShapes?: CustomWebcamShapePreset[];
  mediaAssets: MediaAsset[];
  clips?: TimelineClip[];
  tracks: TimelineTrack[];
  background: SceneBackground;
  studio3D: Studio3DSettings;
  customThemes?: ThemePalettePreset[];
}
