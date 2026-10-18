import { create } from 'zustand';
import {
  BACKGROUND_PRESETS,
  DEFAULT_BROWSER_THEME,
  DEFAULT_OBJECT_EFFECTS,
  DEFAULT_SCREEN_TRANSFORM,
  DEFAULT_WEBCAM_BEZIER_POINTS,
  DEVICE_FRAME_SWATCHES,
  GLOBAL_THEME_PALETTES,
  WEBCAM_PIP_PRESETS,
  WEBCAM_SHAPE_LIBRARY,
  WEBCAM_STYLE_PRESETS,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import {
  BUILTIN_PROCEDURAL_MEDIA,
  releaseMediaAssetResources,
  type CameraDeviceInfo,
} from '../media/proceduralMedia.ts';
import type {
  AnimationPresetId,
  AspectRatioPreset,
  BrowserThemeConfig,
  CameraPresetId,
  CustomWebcamShapePreset,
  DrawingToolType,
  EasingType,
  Keyframe,
  MediaAsset,
  ObjectEffects,
  ProjectDocument,
  SceneBackground,
  SceneDeviceObject,
  SceneDrawingObject,
  SceneWebcamOverlay,
  ScreenTransform,
  Studio3DSettings,
  ThemePalettePreset,
  TimelineClip,
  TimelineTrack,
  WebcamFrameShapeType,
  WebcamStylePresetId,
} from '../shared/types.ts';
import { saveProjectToDb } from './db.ts';
import {
  computeTrimmedClip,
  computeTrimmedDrawingClip,
  computeTrimmedWebcamClip,
  generateKeyframesForPreset,
  generateWebcamShowcaseKeyframes,
  resizeDrawingGeometry,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  resolveWebcamAtFrame,
  splitDrawingClipAtFrame,
  splitTimelineClipAtFrame,
  splitWebcamClipAtFrame,
} from './math.ts';

export type LeftSidebarTab =
  | 'devices'
  | 'webcam'
  | 'themes'
  | 'draw'
  | 'media'
  | 'templates'
  | 'backgrounds'
  | 'layers';

export type ActiveModalType = 'none' | 'projects' | 'export' | 'architecture';

interface HistorySnapshot {
  devices: SceneDeviceObject[];
  drawings: SceneDrawingObject[];
  webcams: SceneWebcamOverlay[];
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  background: SceneBackground;
  studio3D: Studio3DSettings;
}

function generateWaveformPeaks(seedStr: string, count = 36): number[] {
  const peaks: number[] = [];
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = 0; i < count; i++) {
    const v =
      0.22 +
      0.68 *
        Math.abs(
          Math.sin(i * 0.65 + (hash % 17)) * Math.cos(i * 0.31 + (hash % 11))
        );
    peaks.push(Number(v.toFixed(2)));
  }
  return peaks;
}

export interface StudioState {
  // Project Document fields
  projectId: string;
  projectName: string;
  projectVersion: number;
  lastSavedAt: number | null;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: AspectRatioPreset;
  fps: 24 | 30 | 60;
  durationInFrames: number;

  // Scene state
  devices: SceneDeviceObject[];
  drawings: SceneDrawingObject[];
  webcams: SceneWebcamOverlay[];
  selectedIds: string[];
  selectedDrawingId: string | null;
  selectedWebcamId: string | null;
  selectedClipId: string | null;
  selectedKeyframe: { trackId: string; keyframeId: string } | null;
  copiedDevices: SceneDeviceObject[];
  copiedKeyframe: Keyframe | null;
  mediaAssets: MediaAsset[];
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  background: SceneBackground;
  studio3D: Studio3DSettings;
  customThemes: ThemePalettePreset[];
  customWebcamShapes: CustomWebcamShapePreset[];
  liveCameraActive: boolean;
  liveCameraError: string | null;
  availableCameraDevices: CameraDeviceInfo[];

  // Drawing Tool state
  activeDrawingTool: DrawingToolType;
  drawingDefaults: {
    strokeColor: string;
    strokeColorEnd: string;
    useGradientStroke: boolean;
    strokeWidth: number;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
    dashPattern: SceneDrawingObject['dashPattern'];
    glowEnabled: boolean;
    glowColor: string;
    glowRadius: number;
    glowIntensity: number;
    glowSpread: number;
    animationMode: SceneDrawingObject['animationMode'];
    animationDurationFrames: number;
    animationSpeed: number;
    animationEasing: EasingType;
  };

  // Timeline playback state
  currentFrame: number;
  isPlaying: boolean;
  loopPlayback: boolean;
  autoKeyframe: boolean;
  showMotionTrail: boolean;
  rippleTrimMode: boolean;
  autoScrollTimeline: boolean;
  trackHeightMode: 'compact' | 'normal' | 'tall';
  timelineCollapsed: boolean;
  lastTimelineNotice: string | null;

  // Editor viewport state
  editorMode: '2d' | '3d';
  leftTab: LeftSidebarTab;
  activeModal: ActiveModalType;
  zoom: number;
  panX: number;
  panY: number;
  snapToGrid: boolean;
  showGuides: boolean;
  showRulers: boolean;

  // Undo/Redo history
  history: HistorySnapshot[];
  historyIndex: number;

  // Basic UI Actions
  setProjectName: (name: string) => void;
  setEditorMode: (mode: '2d' | '3d') => void;
  setLeftTab: (tab: LeftSidebarTab) => void;
  setActiveModal: (modal: ActiveModalType) => void;
  setTimelineCollapsed: (collapsed: boolean) => void;
  setZoomAndPan: (zoom: number, panX?: number, panY?: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  setShowGuides: (show: boolean) => void;
  setShowRulers: (show: boolean) => void;
  setCanvasAspectRatio: (
    ratio: AspectRatioPreset,
    customW?: number,
    customH?: number
  ) => void;
  setTimelineSettings: (fps: 24 | 30 | 60, durationInFrames: number) => void;
  setLoopPlayback: (loop: boolean) => void;
  setAutoKeyframe: (auto: boolean) => void;
  setShowMotionTrail: (show: boolean) => void;
  toggleMotionTrail: () => void;
  setRippleTrimMode: (enabled: boolean) => void;
  setAutoScrollTimeline: (enabled: boolean) => void;
  setTrackHeightMode: (mode: 'compact' | 'normal' | 'tall') => void;

  // Device Manipulation
  addDevice: (presetId: string) => void;
  selectDevice: (id: string | null, multi?: boolean) => void;
  selectAllDevices: () => void;
  updateDevice: (
    id: string,
    patch: Partial<SceneDeviceObject>,
    recordHistory?: boolean
  ) => void;
  updateDeviceScreenTransform: (id: string, patch: Partial<ScreenTransform>) => void;
  updateDeviceEffects: (id: string, patch: Partial<ObjectEffects>) => void;
  updateDeviceBrowserTheme: (id: string, patch: Partial<BrowserThemeConfig>) => void;
  deleteSelectedDevices: () => void;
  duplicateSelectedDevices: () => void;
  copySelectedDevices: () => void;
  pasteDevices: () => void;
  reorderDeviceLayer: (
    id: string,
    direction: 'up' | 'down' | 'top' | 'bottom'
  ) => void;
  groupSelectedDevices: () => void;
  ungroupSelectedDevices: () => void;

  // Theme Colour Studio Actions
  applyDeviceSwatch: (deviceId: string, swatchId: string) => void;
  applyThemePalette: (
    paletteId: string,
    scope: 'selected' | 'group' | 'all'
  ) => void;
  saveCustomThemePalette: (name: string, baseDeviceId?: string) => void;

  // Drawing Tool & Animated Path Actions
  setActiveDrawingTool: (tool: DrawingToolType) => void;
  updateDrawingDefaults: (
    patch: Partial<StudioState['drawingDefaults']>
  ) => void;
  addDrawing: (drawing: SceneDrawingObject) => void;
  selectDrawing: (id: string | null) => void;
  updateDrawing: (
    id: string,
    patch: Partial<SceneDrawingObject>,
    recordHistory?: boolean
  ) => void;
  deleteDrawing: (id: string) => void;
  duplicateDrawing: (id: string) => void;
  trimDrawingClipEdge: (
    drawingId: string,
    edge: 'left' | 'right',
    deltaFrames: number,
    recordHistory?: boolean
  ) => void;
  createGlowingHaloAroundDevice: (
    deviceId: string,
    shape: 'ellipse' | 'rounded-rect' | 'arrow'
  ) => void;

  // Webcam Overlay Studio Actions
  addWebcamOverlay: (
    shape?: WebcamFrameShapeType,
    stylePreset?: WebcamStylePresetId
  ) => void;
  selectWebcam: (id: string | null) => void;
  updateWebcam: (
    id: string,
    patch: Partial<SceneWebcamOverlay>,
    recordHistory?: boolean
  ) => void;
  deleteWebcam: (id: string) => void;
  duplicateWebcam: (id: string) => void;
  trimWebcamClipEdge: (
    webcamId: string,
    edge: 'left' | 'right',
    deltaFrames: number,
    recordHistory?: boolean
  ) => void;
  applyWebcamStylePreset: (
    webcamId: string,
    styleId: WebcamStylePresetId
  ) => void;
  applyWebcamPiPPreset: (pipPresetId: string) => void;
  applyWebcamShowcaseAnimation: (webcamId: string) => void;
  saveCustomWebcamShape: (name: string, webcamId?: string) => void;
  applyCustomWebcamShape: (webcamId: string, customShapeId: string) => void;
  setLiveCameraStatus: (
    active: boolean,
    error?: string | null,
    devices?: CameraDeviceInfo[]
  ) => void;

  // Media & Timeline Clip Management
  addMediaAsset: (asset: MediaAsset, autoCreateClip?: boolean) => void;
  addLongDemoVideo: (durationSeconds?: number) => void;
  removeMediaAsset: (assetId: string) => void;
  assignMediaToDevice: (deviceId: string, mediaId: string | null) => void;
  addClipFromMedia: (mediaId: string, startFrame?: number) => void;
  selectClip: (clipId: string | null) => void;
  updateClip: (
    clipId: string,
    patch: Partial<TimelineClip>,
    recordHistory?: boolean
  ) => void;
  updateClipsBatch: (
    nextClips: TimelineClip[],
    recordHistory?: boolean
  ) => void;
  trimClipEdge: (
    clipId: string,
    edge: 'left' | 'right',
    deltaFrames: number,
    recordHistory?: boolean
  ) => void;
  trimSelectedClipToPlayhead: (edge: 'left' | 'right') => void;
  splitSelectedClipAtPlayhead: () => void;
  duplicateSelectedClip: () => void;
  deleteSelectedClip: () => void;

  // Background & 3D Studio
  updateBackground: (patch: Partial<SceneBackground>) => void;
  applyBackgroundPreset: (presetId: string) => void;
  updateStudio3D: (patch: Partial<Studio3DSettings>) => void;
  setCameraPreset3D: (preset: CameraPresetId) => void;

  // Timeline & Keyframes
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  stepFrame: (delta: number) => void;
  jumpToAdjacentKeyframe: (direction: 'prev' | 'next') => void;
  toggleTrackExpanded: (trackId: string) => void;
  clearTrackKeyframes: (targetId: string) => void;
  setSelectedKeyframe: (
    sel: { trackId: string; keyframeId: string } | null
  ) => void;
  addKeyframeAtCurrentFrame: (targetId: string, easing?: EasingType) => void;
  moveKeyframe: (trackId: string, keyframeId: string, newFrame: number) => void;
  duplicateKeyframe: (trackId: string, keyframeId: string) => void;
  copyKeyframe: (trackId: string, keyframeId: string) => void;
  pasteKeyframeAtPlayhead: (trackId: string) => void;
  deleteKeyframe: (trackId: string, keyframeId: string) => void;
  updateKeyframeEasing: (
    trackId: string,
    keyframeId: string,
    easing: EasingType
  ) => void;
  applyAnimationPresetToDevice: (
    deviceId: string,
    presetId: AnimationPresetId
  ) => void;

  // Templates & Project Lifecycle
  applySceneTemplate: (templateId: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  newProject: () => void;
  saveCurrentProject: () => Promise<ProjectDocument>;
  loadProjectDocument: (doc: ProjectDocument) => void;
  duplicateCurrentProject: () => Promise<ProjectDocument>;
  exportProjectJsonString: () => string;
}

function createInitialSceneData(): {
  devices: SceneDeviceObject[];
  drawings: SceneDrawingObject[];
  clips: TimelineClip[];
  tracks: TimelineTrack[];
} {
  const macPreset = getDevicePresetById('macbook-pro-16');
  const iphonePreset = getDevicePresetById('iphone-16-pro');

  const macDevice: SceneDeviceObject = {
    id: 'dev-macbook-1',
    name: 'MacBook Pro 16"',
    presetId: macPreset.id,
    x: 800,
    y: 525,
    width: macPreset.width,
    height: macPreset.height,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotation3DX: 4,
    rotation3DY: -16,
    rotation3DZ: 0,
    pos3DX: -1.4,
    pos3DY: 0.1,
    pos3DZ: -0.4,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    zIndex: 1,
    mediaId: 'proc-daw-desktop',
    screenTransform: { ...DEFAULT_SCREEN_TRANSFORM, fitMode: 'cover' },
    finishStyle: 'brushed',
    browserTheme: { ...DEFAULT_BROWSER_THEME },
    effects: {
      ...DEFAULT_OBJECT_EFFECTS,
      shadowEnabled: true,
      glowEnabled: true,
      glowColor: '#0EA5E9',
      glowSecondaryColor: '#6366F1',
      glowBlur: 46,
      glowSpread: 14,
      glowIntensity: 0.65,
      glowOpacity: 0.85,
      animatedGlow: true,
      glowAnimationMode: 'pulse',
      glowSpeed: 1.0,
    },
  };

  const iphoneDevice: SceneDeviceObject = {
    id: 'dev-iphone-2',
    name: 'iPhone 16 Pro',
    presetId: iphonePreset.id,
    x: 1330,
    y: 565,
    width: iphonePreset.width,
    height: iphonePreset.height,
    scaleX: 0.88,
    scaleY: 0.88,
    rotation: -4,
    rotation3DX: 6,
    rotation3DY: -26,
    rotation3DZ: -2,
    pos3DX: 2.35,
    pos3DY: -0.2,
    pos3DZ: 0.9,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    zIndex: 2,
    mediaId: 'proc-fintech-mobile',
    screenTransform: { ...DEFAULT_SCREEN_TRANSFORM, fitMode: 'cover' },
    finishStyle: 'polished',
    browserTheme: { ...DEFAULT_BROWSER_THEME },
    effects: {
      ...DEFAULT_OBJECT_EFFECTS,
      shadowEnabled: true,
      glowEnabled: true,
      glowColor: '#22D3EE',
      glowSecondaryColor: '#A855F7',
      glowBlur: 52,
      glowSpread: 16,
      glowIntensity: 0.85,
      glowOpacity: 0.92,
      animatedGlow: true,
      glowAnimationMode: 'perimeter-sweep',
      glowSpeed: 1.0,
      entranceAnimation: 'none',
    },
  };

  const initialClips: TimelineClip[] = [
    {
      id: 'clip-daw-desktop-1',
      mediaId: 'proc-daw-desktop',
      name: 'Chronos NLE — Desktop Timeline Feed',
      mediaType: 'procedural',
      trackId: 'media-track-1',
      startFrame: 0,
      durationFrames: 180,
      trimStartFrames: 0,
      muted: false,
      locked: false,
      visible: true,
      waveformPeaks: generateWaveformPeaks('proc-daw-desktop', 40),
    },
    {
      id: 'clip-fintech-mobile-2',
      mediaId: 'proc-fintech-mobile',
      name: 'Apex Ledger — Live Mobile Feed',
      mediaType: 'procedural',
      trackId: 'media-track-2',
      startFrame: 0,
      durationFrames: 180,
      trimStartFrames: 0,
      muted: false,
      locked: false,
      visible: true,
      waveformPeaks: generateWaveformPeaks('proc-fintech-mobile', 40),
    },
  ];

  const tracks: TimelineTrack[] = [
    {
      id: 'track-dev-macbook-1',
      targetId: macDevice.id,
      label: 'MacBook Pro 16"',
      type: 'device',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: 'kf-mac-0',
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: 800,
            y: 525,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            glowBlur: 46,
            glowIntensity: 0.65,
            glowColor: '#0EA5E9',
            rotation3DX: 4,
            rotation3DY: -16,
            rotation3DZ: 0,
          },
        },
        {
          id: 'kf-mac-90',
          frame: 90,
          easing: 'ease-in-out',
          properties: {
            x: 790,
            y: 515,
            scaleX: 1.03,
            scaleY: 1.03,
            rotation: -1,
            opacity: 1,
            glowBlur: 64,
            glowIntensity: 0.85,
            glowColor: '#38BDF8',
            rotation3DX: 2,
            rotation3DY: -6,
            rotation3DZ: 0,
          },
        },
        {
          id: 'kf-mac-180',
          frame: 180,
          easing: 'ease-in-out',
          properties: {
            x: 800,
            y: 525,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            glowBlur: 46,
            glowIntensity: 0.65,
            glowColor: '#0EA5E9',
            rotation3DX: 4,
            rotation3DY: -16,
            rotation3DZ: 0,
          },
        },
      ],
    },
    {
      id: 'track-dev-iphone-2',
      targetId: iphoneDevice.id,
      label: 'iPhone 16 Pro',
      type: 'device',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: 'kf-ip-0',
          frame: 0,
          easing: 'ease-out',
          properties: {
            x: 1210,
            y: 625,
            scaleX: 0.84,
            scaleY: 0.84,
            rotation: -8,
            opacity: 1,
            glowBlur: 52,
            glowIntensity: 0.85,
            glowColor: '#22D3EE',
            rotation3DX: 6,
            rotation3DY: -26,
            rotation3DZ: -2,
          },
        },
        {
          id: 'kf-ip-60',
          frame: 60,
          easing: 'ease-in-out',
          properties: {
            x: 1320,
            y: 455,
            scaleX: 0.96,
            scaleY: 0.96,
            rotation: 2,
            opacity: 1,
            glowBlur: 72,
            glowIntensity: 1.0,
            glowColor: '#A855F7',
            rotation3DX: 2,
            rotation3DY: -12,
            rotation3DZ: 0,
          },
        },
        {
          id: 'kf-ip-120',
          frame: 120,
          easing: 'ease-in-out',
          properties: {
            x: 1455,
            y: 535,
            scaleX: 1.02,
            scaleY: 1.02,
            rotation: 7,
            opacity: 1,
            glowBlur: 80,
            glowIntensity: 1.05,
            glowColor: '#38BDF8',
            rotation3DX: 0,
            rotation3DY: -4,
            rotation3DZ: 2,
          },
        },
        {
          id: 'kf-ip-180',
          frame: 180,
          easing: 'ease-in-out',
          properties: {
            x: 1330,
            y: 585,
            scaleX: 0.9,
            scaleY: 0.9,
            rotation: -3,
            opacity: 1,
            glowBlur: 52,
            glowIntensity: 0.85,
            glowColor: '#22D3EE',
            rotation3DX: 6,
            rotation3DY: -26,
            rotation3DZ: -2,
          },
        },
      ],
    },
  ];

  return {
    devices: [macDevice, iphoneDevice],
    drawings: [],
    clips: initialClips,
    tracks,
  };
}

const initialScene = createInitialSceneData();
const initialBackground: SceneBackground = {
  ...BACKGROUND_PRESETS[0].background,
};
const initialStudio3D: Studio3DSettings = {
  cameraPreset: 'three-quarter-left',
  fov: 38,
  cameraDistance: 9.6,
  autoOrbit: false,
  orbitSpeed: 0.35,
  keyLightIntensity: 2.2,
  keyLightWarmth: 0.15,
  rimLightIntensity: 1.6,
  envReflectionIntensity: 1.15,
  contactShadowOpacity: 0.5,
  explodedView: 0,
};

function cloneSnapshot(
  devices: SceneDeviceObject[],
  drawings: SceneDrawingObject[],
  webcams: SceneWebcamOverlay[],
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  background: SceneBackground,
  studio3D: Studio3DSettings
): HistorySnapshot {
  return JSON.parse(
    JSON.stringify({
      devices,
      drawings,
      webcams,
      clips,
      tracks,
      background,
      studio3D,
    })
  );
}

export const useStudioStore = create<StudioState>((set, get) => ({
  projectId: 'proj-default-showcase',
  projectName: 'Flagship Ecosystem Launch',
  projectVersion: 2,
  lastSavedAt: Date.now(),
  canvasWidth: 1920,
  canvasHeight: 1080,
  aspectRatio: '16:9',
  fps: 30,
  durationInFrames: 180,

  devices: initialScene.devices,
  drawings: initialScene.drawings,
  webcams: [],
  selectedIds: [initialScene.devices[1].id],
  selectedDrawingId: null,
  selectedWebcamId: null,
  selectedClipId: null,
  selectedKeyframe: null,
  copiedDevices: [],
  copiedKeyframe: null,
  mediaAssets: [...BUILTIN_PROCEDURAL_MEDIA],
  clips: initialScene.clips,
  tracks: initialScene.tracks,
  background: initialBackground,
  studio3D: initialStudio3D,
  customThemes: [],
  customWebcamShapes: [],
  liveCameraActive: false,
  liveCameraError: null,
  availableCameraDevices: [],

  activeDrawingTool: 'select',
  drawingDefaults: {
    strokeColor: '#22D3EE',
    strokeColorEnd: '#A855F7',
    useGradientStroke: true,
    strokeWidth: 4,
    strokeOpacity: 1,
    fillColor: '#22D3EE',
    fillOpacity: 0.06,
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#22D3EE',
    glowRadius: 28,
    glowIntensity: 0.9,
    glowSpread: 8,
    animationMode: 'neon-trace',
    animationDurationFrames: 90,
    animationSpeed: 1.0,
    animationEasing: 'ease-in-out',
  },

  currentFrame: 0,
  isPlaying: false,
  loopPlayback: true,
  autoKeyframe: true,
  showMotionTrail: true,
  rippleTrimMode: false,
  autoScrollTimeline: true,
  trackHeightMode: 'normal',
  timelineCollapsed: false,
  lastTimelineNotice: null,

  editorMode: '2d',
  leftTab: 'devices',
  activeModal: 'none',
  zoom: 0.38,
  panX: 0,
  panY: 0,
  snapToGrid: true,
  showGuides: true,
  showRulers: true,

  history: [
    cloneSnapshot(
      initialScene.devices,
      initialScene.drawings,
      [],
      initialScene.clips,
      initialScene.tracks,
      initialBackground,
      initialStudio3D
    ),
  ],
  historyIndex: 0,

  setProjectName: (name) => set({ projectName: name }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setTimelineCollapsed: (collapsed) => set({ timelineCollapsed: collapsed }),
  setZoomAndPan: (zoom, panX, panY) =>
    set((state) => ({
      zoom: Math.max(0.2, Math.min(2.5, zoom)),
      panX: panX !== undefined ? panX : state.panX,
      panY: panY !== undefined ? panY : state.panY,
    })),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setShowGuides: (show) => set({ showGuides: show }),
  setShowRulers: (show) => set({ showRulers: show }),
  setLoopPlayback: (loop) => set({ loopPlayback: loop }),
  setAutoKeyframe: (auto) => set({ autoKeyframe: auto }),
  setShowMotionTrail: (show) =>
    set({
      showMotionTrail: show,
      lastTimelineNotice: show
        ? 'Onion Skin / Motion Trail enabled'
        : 'Onion Skin / Motion Trail hidden',
    }),
  toggleMotionTrail: () =>
    set((state) => {
      const next = !state.showMotionTrail;
      return {
        showMotionTrail: next,
        lastTimelineNotice: next
          ? 'Onion Skin / Motion Trail enabled'
          : 'Onion Skin / Motion Trail hidden',
      };
    }),
  setRippleTrimMode: (enabled) =>
    set({
      rippleTrimMode: enabled,
      lastTimelineNotice: enabled
        ? 'Ripple Trim enabled: trimming shifts downstream clips on track'
        : 'Normal Trim enabled',
    }),
  setAutoScrollTimeline: (enabled) =>
    set({
      autoScrollTimeline: enabled,
      lastTimelineNotice: enabled
        ? 'Playhead Auto-Scroll enabled'
        : 'Playhead Auto-Scroll disabled',
    }),
  setTrackHeightMode: (mode) => set({ trackHeightMode: mode }),

  setCanvasAspectRatio: (ratio, customW, customH) => {
    let w = 1920;
    let h = 1080;
    if (ratio === '9:16') {
      w = 1080;
      h = 1920;
    } else if (ratio === '1:1') {
      w = 1080;
      h = 1080;
    } else if (ratio === '4:3') {
      w = 1440;
      h = 1080;
    } else if (ratio === 'custom') {
      w = customW ?? 1920;
      h = customH ?? 1080;
    }
    set({ aspectRatio: ratio, canvasWidth: w, canvasHeight: h });
  },

  setTimelineSettings: (fps, durationInFrames) =>
    set((state) => ({
      fps,
      durationInFrames: Math.max(30, Math.min(9000, durationInFrames)),
      currentFrame: Math.min(state.currentFrame, durationInFrames - 1),
    })),

  pushHistory: () => {
    const {
      devices,
      drawings,
      webcams,
      clips,
      tracks,
      background,
      studio3D,
      history,
      historyIndex,
    } = get();
    const snap = cloneSnapshot(
      devices,
      drawings,
      webcams,
      clips,
      tracks,
      background,
      studio3D
    );
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(snap);
    if (trimmed.length > 40) trimmed.shift();
    set({
      history: trimmed,
      historyIndex: trimmed.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const snap = cloneSnapshot(
      history[targetIdx].devices,
      history[targetIdx].drawings,
      history[targetIdx].webcams || [],
      history[targetIdx].clips,
      history[targetIdx].tracks,
      history[targetIdx].background,
      history[targetIdx].studio3D
    );
    set({
      devices: snap.devices,
      drawings: snap.drawings,
      webcams: snap.webcams || [],
      clips: snap.clips,
      tracks: snap.tracks,
      background: snap.background,
      studio3D: snap.studio3D,
      historyIndex: targetIdx,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const targetIdx = historyIndex + 1;
    const snap = cloneSnapshot(
      history[targetIdx].devices,
      history[targetIdx].drawings,
      history[targetIdx].webcams || [],
      history[targetIdx].clips,
      history[targetIdx].tracks,
      history[targetIdx].background,
      history[targetIdx].studio3D
    );
    set({
      devices: snap.devices,
      drawings: snap.drawings,
      webcams: snap.webcams || [],
      clips: snap.clips,
      tracks: snap.tracks,
      background: snap.background,
      studio3D: snap.studio3D,
      historyIndex: targetIdx,
    });
  },

  addDevice: (presetId) => {
    const preset = getDevicePresetById(presetId);
    const state = get();
    const id = `dev-${preset.id}-${Date.now().toString(36).slice(-4)}`;
    const count = state.devices.length;
    const offset = (count % 4) * 45;

    const defaultMedia =
      preset.category === 'laptop' ||
      preset.category === 'desktop' ||
      preset.category === 'browser'
        ? 'proc-daw-desktop'
        : preset.category === 'wearable'
          ? 'proc-weather-spatial'
          : 'proc-fintech-mobile';

    const newDevice: SceneDeviceObject = {
      id,
      name: `${preset.name} #${count + 1}`,
      presetId: preset.id,
      x: state.canvasWidth / 2 + offset,
      y: state.canvasHeight / 2 + offset * 0.5,
      width: preset.width,
      height: preset.height,
      scaleX: preset.width > 700 ? 0.9 : 0.85,
      scaleY: preset.width > 700 ? 0.9 : 0.85,
      rotation: 0,
      rotation3DX: 4,
      rotation3DY: -14 + count * 12,
      rotation3DZ: 0,
      pos3DX: (count - 0.5) * 2.2,
      pos3DY: 0,
      pos3DZ: count * 0.3,
      opacity: 1,
      visible: true,
      locked: false,
      groupId: null,
      zIndex: count + 1,
      mediaId: defaultMedia,
      screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
      finishStyle: 'brushed',
      browserTheme: { ...DEFAULT_BROWSER_THEME },
      effects: { ...DEFAULT_OBJECT_EFFECTS },
    };

    const newTrack: TimelineTrack = {
      id: `track-${id}`,
      targetId: id,
      label: newDevice.name,
      type: 'device',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: newDevice.x,
            y: newDevice.y,
            scaleX: newDevice.scaleX,
            scaleY: newDevice.scaleY,
            rotation: newDevice.rotation,
            opacity: newDevice.opacity,
            glowBlur: newDevice.effects.glowBlur,
            glowIntensity: newDevice.effects.glowIntensity,
            glowColor: newDevice.effects.glowColor,
            rotation3DX: newDevice.rotation3DX,
            rotation3DY: newDevice.rotation3DY,
            rotation3DZ: newDevice.rotation3DZ,
          },
        },
      ],
    };

    set((s) => ({
      devices: [...s.devices, newDevice],
      tracks: [...s.tracks, newTrack],
      selectedIds: [id],
      selectedDrawingId: null,
      selectedClipId: null,
    }));
    get().pushHistory();
  },

  selectDevice: (id, multi = false) => {
    if (!id) {
      set({ selectedIds: [] });
      return;
    }
    set((state) => {
      const target = state.devices.find((d) => d.id === id);
      const groupMembers =
        target && target.groupId
          ? state.devices
              .filter((d) => d.groupId === target.groupId)
              .map((d) => d.id)
          : [id];

      if (!multi) {
        return {
          selectedIds: groupMembers,
          selectedDrawingId: null,
          selectedWebcamId: null,
          selectedClipId: null,
        };
      }
      const exists = state.selectedIds.includes(id);
      if (exists) {
        return {
          selectedIds: state.selectedIds.filter(
            (itemId) => !groupMembers.includes(itemId)
          ),
        };
      }
      return {
        selectedIds: Array.from(
          new Set([...state.selectedIds, ...groupMembers])
        ),
        selectedDrawingId: null,
        selectedWebcamId: null,
        selectedClipId: null,
      };
    });
  },

  selectAllDevices: () =>
    set((state) => ({
      selectedIds: state.devices
        .filter((d) => !d.locked && d.visible)
        .map((d) => d.id),
    })),

  updateDevice: (id, patch, recordHistory = true) => {
    set((state) => {
      const updatedDevices = state.devices.map((dev) =>
        dev.id === id ? { ...dev, ...patch } : dev
      );
      const targetDev = updatedDevices.find((d) => d.id === id);
      const frame = state.currentFrame;

      const updatedTracks = state.tracks.map((track) => {
        if (track.targetId !== id) return track;
        const existingKfIdx = track.keyframes.findIndex(
          (kf) => kf.frame === frame
        );

        const buildKfProps = (base: Keyframe['properties']) => {
          const nextProps = { ...base };
          if (patch.x !== undefined) nextProps.x = patch.x;
          if (patch.y !== undefined) nextProps.y = patch.y;
          if (patch.scaleX !== undefined) nextProps.scaleX = patch.scaleX;
          if (patch.scaleY !== undefined) nextProps.scaleY = patch.scaleY;
          if (patch.rotation !== undefined) nextProps.rotation = patch.rotation;
          if (patch.opacity !== undefined) nextProps.opacity = patch.opacity;
          if (patch.customOuterRadius !== undefined)
            nextProps.cornerRadius = patch.customOuterRadius;
          if (patch.customFrameColor !== undefined)
            nextProps.materialColor = patch.customFrameColor;
          if (patch.rotation3DX !== undefined)
            nextProps.rotation3DX = patch.rotation3DX;
          if (patch.rotation3DY !== undefined)
            nextProps.rotation3DY = patch.rotation3DY;
          if (patch.rotation3DZ !== undefined)
            nextProps.rotation3DZ = patch.rotation3DZ;
          if (patch.pos3DX !== undefined) nextProps.pos3DX = patch.pos3DX;
          if (patch.pos3DY !== undefined) nextProps.pos3DY = patch.pos3DY;
          if (patch.pos3DZ !== undefined) nextProps.pos3DZ = patch.pos3DZ;
          return nextProps;
        };

        if (existingKfIdx !== -1) {
          const kf = track.keyframes[existingKfIdx];
          const nextKfs = [...track.keyframes];
          nextKfs[existingKfIdx] = {
            ...kf,
            properties: buildKfProps(kf.properties),
          };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: nextKfs,
          };
        } else if (state.autoKeyframe && targetDev) {
          // Base the new keyframe on the interpolated state at `frame` so unedited properties remain smooth
          const origDev = state.devices.find((d) => d.id === id) || targetDev;
          const resolvedAtFrame = resolveDeviceAtFrame(
            origDev,
            track.keyframes,
            frame,
            state.durationInFrames
          );
          const newKf: Keyframe = {
            id: `kf-${id}-${frame}`,
            frame,
            easing: 'ease-in-out',
            properties: buildKfProps({
              x: resolvedAtFrame.x,
              y: resolvedAtFrame.y,
              scaleX: resolvedAtFrame.scaleX,
              scaleY: resolvedAtFrame.scaleY,
              rotation: resolvedAtFrame.rotation,
              opacity: resolvedAtFrame.opacity,
              cornerRadius: resolvedAtFrame.customOuterRadius,
              materialColor: resolvedAtFrame.customFrameColor,
              glowBlur: resolvedAtFrame.effects.glowBlur,
              glowIntensity: resolvedAtFrame.effects.glowIntensity,
              glowColor: resolvedAtFrame.effects.glowColor,
              rotation3DX: resolvedAtFrame.rotation3DX,
              rotation3DY: resolvedAtFrame.rotation3DY,
              rotation3DZ: resolvedAtFrame.rotation3DZ,
            }),
          };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: [...track.keyframes, newKf].sort(
              (a, b) => a.frame - b.frame
            ),
          };
        }
        return { ...track, label: patch.name ?? track.label };
      });
      return { devices: updatedDevices, tracks: updatedTracks };
    });
    if (recordHistory) {
      get().pushHistory();
    }
  },

  updateDeviceScreenTransform: (id, patch) => {
    set((state) => ({
      devices: state.devices.map((dev) =>
        dev.id === id
          ? {
              ...dev,
              screenTransform: { ...dev.screenTransform, ...patch },
            }
          : dev
      ),
    }));
    get().pushHistory();
  },

  updateDeviceEffects: (id, patch) => {
    set((state) => {
      const updatedDevices = state.devices.map((dev) =>
        dev.id === id
          ? {
              ...dev,
              effects: { ...dev.effects, ...patch },
            }
          : dev
      );
      const targetDev = updatedDevices.find((d) => d.id === id);
      const frame = state.currentFrame;

      // Sync glow/shadow keyframes if autoKeyframe or keyframe at currentFrame
      const updatedTracks = state.tracks.map((track) => {
        if (track.targetId !== id) return track;
        const idx = track.keyframes.findIndex((kf) => kf.frame === frame);
        if (idx === -1 && !state.autoKeyframe) return track;

        if (idx !== -1) {
          const kf = track.keyframes[idx];
          const nextProps = { ...kf.properties };
          if (patch.glowBlur !== undefined) nextProps.glowBlur = patch.glowBlur;
          if (patch.glowIntensity !== undefined)
            nextProps.glowIntensity = patch.glowIntensity;
          if (patch.glowColor !== undefined)
            nextProps.glowColor = patch.glowColor;
          if (patch.shadowBlur !== undefined)
            nextProps.shadowBlur = patch.shadowBlur;
          if (patch.shadowOpacity !== undefined)
            nextProps.shadowOpacity = patch.shadowOpacity;
          const nextKfs = [...track.keyframes];
          nextKfs[idx] = { ...kf, properties: nextProps };
          return { ...track, keyframes: nextKfs };
        } else if (
          targetDev &&
          (patch.glowBlur !== undefined ||
            patch.glowIntensity !== undefined ||
            patch.glowColor !== undefined ||
            patch.shadowBlur !== undefined ||
            patch.shadowOpacity !== undefined)
        ) {
          const origDev = state.devices.find((d) => d.id === id) || targetDev;
          const resolvedAtFrame = resolveDeviceAtFrame(
            origDev,
            track.keyframes,
            frame,
            state.durationInFrames
          );
          const newKf: Keyframe = {
            id: `kf-${id}-${frame}`,
            frame,
            easing: 'ease-in-out',
            properties: {
              x: resolvedAtFrame.x,
              y: resolvedAtFrame.y,
              scaleX: resolvedAtFrame.scaleX,
              scaleY: resolvedAtFrame.scaleY,
              rotation: resolvedAtFrame.rotation,
              opacity: resolvedAtFrame.opacity,
              glowBlur: patch.glowBlur ?? resolvedAtFrame.effects.glowBlur,
              glowIntensity:
                patch.glowIntensity ?? resolvedAtFrame.effects.glowIntensity,
              glowColor: patch.glowColor ?? resolvedAtFrame.effects.glowColor,
              shadowBlur:
                patch.shadowBlur ?? resolvedAtFrame.effects.shadowBlur,
              shadowOpacity:
                patch.shadowOpacity ?? resolvedAtFrame.effects.shadowOpacity,
              rotation3DX: resolvedAtFrame.rotation3DX,
              rotation3DY: resolvedAtFrame.rotation3DY,
              rotation3DZ: resolvedAtFrame.rotation3DZ,
            },
          };
          return {
            ...track,
            keyframes: [...track.keyframes, newKf].sort(
              (a, b) => a.frame - b.frame
            ),
          };
        }
        return track;
      });

      return { devices: updatedDevices, tracks: updatedTracks };
    });
    get().pushHistory();
  },

  updateDeviceBrowserTheme: (id, patch) => {
    set((state) => ({
      devices: state.devices.map((dev) =>
        dev.id === id
          ? {
              ...dev,
              browserTheme: {
                ...(dev.browserTheme || DEFAULT_BROWSER_THEME),
                ...patch,
              },
            }
          : dev
      ),
    }));
    get().pushHistory();
  },

  applyDeviceSwatch: (deviceId, swatchId) => {
    const swatch = DEVICE_FRAME_SWATCHES.find((s) => s.id === swatchId);
    if (!swatch) return;
    set((state) => ({
      devices: state.devices.map((dev) =>
        dev.id === deviceId
          ? {
              ...dev,
              customFrameColor: swatch.frameColor,
              customFrameSecondaryColor: swatch.secondaryColor,
              customButtonColor: swatch.buttonColor,
              effects: {
                ...dev.effects,
                borderColor: swatch.borderColor,
              },
            }
          : dev
      ),
    }));
    get().pushHistory();
  },

  applyThemePalette: (paletteId, scope) => {
    const state = get();
    const palette =
      GLOBAL_THEME_PALETTES.find((p) => p.id === paletteId) ||
      state.customThemes.find((p) => p.id === paletteId);
    if (!palette) return;

    const targetIds = new Set<string>();
    if (scope === 'all') {
      state.devices.forEach((d) => targetIds.add(d.id));
    } else if (scope === 'group') {
      const selDev = state.devices.find((d) => state.selectedIds.includes(d.id));
      if (selDev?.groupId) {
        state.devices
          .filter((d) => d.groupId === selDev.groupId)
          .forEach((d) => targetIds.add(d.id));
      } else {
        state.selectedIds.forEach((id) => targetIds.add(id));
      }
    } else {
      state.selectedIds.forEach((id) => targetIds.add(id));
      if (targetIds.size === 0 && state.devices[0]) {
        targetIds.add(state.devices[0].id);
      }
    }

    set((s) => ({
      devices: s.devices.map((dev) =>
        targetIds.has(dev.id)
          ? {
              ...dev,
              customFrameColor: palette.frameColor,
              customFrameSecondaryColor: palette.frameSecondaryColor,
              customButtonColor: palette.buttonColor,
              customBezelColor: palette.bezelColor,
              finishStyle: palette.finishStyle,
              browserTheme: {
                ...(dev.browserTheme || DEFAULT_BROWSER_THEME),
                toolbarColor: palette.browserToolbarColor,
                websiteAccentColor: palette.websiteAccentColor,
              },
              effects: {
                ...dev.effects,
                glowEnabled: true,
                glowColor: palette.glowColor,
                glowSecondaryColor: palette.glowSecondaryColor,
                borderColor: palette.borderColor,
              },
            }
          : dev
      ),
    }));
    get().pushHistory();
  },

  saveCustomThemePalette: (name, baseDeviceId) => {
    const state = get();
    const dev =
      state.devices.find((d) => d.id === baseDeviceId) ||
      state.devices.find((d) => state.selectedIds.includes(d.id)) ||
      state.devices[0];
    if (!dev) return;
    const preset = getDevicePresetById(dev.presetId);
    const custom: ThemePalettePreset = {
      id: `theme-custom-${Date.now().toString(36)}`,
      name: name.trim() || 'Custom Studio Theme',
      frameColor: dev.customFrameColor || preset.frameColor,
      frameSecondaryColor:
        dev.customFrameSecondaryColor || preset.frameAccentColor,
      buttonColor: dev.customButtonColor || preset.frameAccentColor,
      bezelColor: dev.customBezelColor || '#070A10',
      borderColor: dev.effects.borderColor || '#38BDF8',
      glowColor: dev.effects.glowColor || '#38BDF8',
      glowSecondaryColor: dev.effects.glowSecondaryColor || '#A855F7',
      finishStyle: dev.finishStyle || 'brushed',
      browserToolbarColor:
        dev.browserTheme?.toolbarColor || DEFAULT_BROWSER_THEME.toolbarColor,
      websiteAccentColor:
        dev.browserTheme?.websiteAccentColor ||
        DEFAULT_BROWSER_THEME.websiteAccentColor,
    };
    set((s) => ({
      customThemes: [custom, ...s.customThemes],
    }));
  },

  deleteSelectedDevices: () => {
    const { selectedIds, selectedDrawingId, selectedWebcamId } = get();
    if (selectedWebcamId) {
      get().deleteWebcam(selectedWebcamId);
      return;
    }
    if (selectedDrawingId) {
      get().deleteDrawing(selectedDrawingId);
      return;
    }
    if (selectedIds.length === 0) return;
    set((state) => ({
      devices: state.devices.filter((d) => !selectedIds.includes(d.id)),
      tracks: state.tracks.filter((t) => !selectedIds.includes(t.targetId)),
      selectedIds: [],
    }));
    get().pushHistory();
  },

  duplicateSelectedDevices: () => {
    const { devices, selectedIds, selectedDrawingId, selectedWebcamId } = get();
    if (selectedWebcamId) {
      get().duplicateWebcam(selectedWebcamId);
      return;
    }
    if (selectedDrawingId) {
      get().duplicateDrawing(selectedDrawingId);
      return;
    }
    if (selectedIds.length === 0) return;
    const toDup = devices.filter((d) => selectedIds.includes(d.id));
    const createdIds: string[] = [];
    const newDevices: SceneDeviceObject[] = [];
    const newTracks: TimelineTrack[] = [];

    toDup.forEach((orig, idx) => {
      const id = `dev-dup-${Date.now().toString(36)}-${idx}`;
      createdIds.push(id);
      const copy: SceneDeviceObject = {
        ...JSON.parse(JSON.stringify(orig)),
        id,
        name: `${orig.name} Copy`,
        x: orig.x + 48,
        y: orig.y + 48,
        pos3DX: orig.pos3DX + 1.4,
        zIndex: devices.length + idx + 1,
      };
      newDevices.push(copy);
      newTracks.push({
        id: `track-${id}`,
        targetId: id,
        label: copy.name,
        type: 'device',
        visible: true,
        locked: false,
        keyframes: [
          {
            id: `kf-${id}-0`,
            frame: 0,
            easing: 'ease-in-out',
            properties: {
              x: copy.x,
              y: copy.y,
              scaleX: copy.scaleX,
              scaleY: copy.scaleY,
              rotation: copy.rotation,
              opacity: copy.opacity,
              glowBlur: copy.effects.glowBlur,
              glowIntensity: copy.effects.glowIntensity,
              glowColor: copy.effects.glowColor,
              rotation3DX: copy.rotation3DX,
              rotation3DY: copy.rotation3DY,
              rotation3DZ: copy.rotation3DZ,
            },
          },
        ],
      });
    });

    set((state) => ({
      devices: [...state.devices, ...newDevices],
      tracks: [...state.tracks, ...newTracks],
      selectedIds: createdIds,
    }));
    get().pushHistory();
  },

  copySelectedDevices: () => {
    const { devices, selectedIds } = get();
    const copies = devices
      .filter((d) => selectedIds.includes(d.id))
      .map((d) => JSON.parse(JSON.stringify(d)));
    set({ copiedDevices: copies });
  },

  pasteDevices: () => {
    const { copiedDevices, devices } = get();
    if (copiedDevices.length === 0) return;
    const createdIds: string[] = [];
    const newDevices: SceneDeviceObject[] = [];
    const newTracks: TimelineTrack[] = [];

    copiedDevices.forEach((orig, idx) => {
      const id = `dev-paste-${Date.now().toString(36)}-${idx}`;
      createdIds.push(id);
      const copy: SceneDeviceObject = {
        ...JSON.parse(JSON.stringify(orig)),
        id,
        name: `${orig.name} Pasted`,
        x: orig.x + 56,
        y: orig.y + 56,
        pos3DX: orig.pos3DX + 1.5,
        zIndex: devices.length + idx + 1,
      };
      newDevices.push(copy);
      newTracks.push({
        id: `track-${id}`,
        targetId: id,
        label: copy.name,
        type: 'device',
        visible: true,
        locked: false,
        keyframes: [
          {
            id: `kf-${id}-0`,
            frame: 0,
            easing: 'ease-in-out',
            properties: {
              x: copy.x,
              y: copy.y,
              scaleX: copy.scaleX,
              scaleY: copy.scaleY,
              rotation: copy.rotation,
              opacity: copy.opacity,
              glowBlur: copy.effects.glowBlur,
              glowIntensity: copy.effects.glowIntensity,
              glowColor: copy.effects.glowColor,
              rotation3DX: copy.rotation3DX,
              rotation3DY: copy.rotation3DY,
              rotation3DZ: copy.rotation3DZ,
            },
          },
        ],
      });
    });

    set((state) => ({
      devices: [...state.devices, ...newDevices],
      tracks: [...state.tracks, ...newTracks],
      selectedIds: createdIds,
    }));
    get().pushHistory();
  },

  reorderDeviceLayer: (id, direction) => {
    set((state) => {
      const sorted = [...state.devices].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((d) => d.id === id);
      if (idx === -1) return state;

      const [item] = sorted.splice(idx, 1);
      if (direction === 'up') {
        sorted.splice(Math.min(sorted.length, idx + 1), 0, item);
      } else if (direction === 'down') {
        sorted.splice(Math.max(0, idx - 1), 0, item);
      } else if (direction === 'top') {
        sorted.push(item);
      } else {
        sorted.unshift(item);
      }

      const reindexed = sorted.map((d, i) => ({ ...d, zIndex: i + 1 }));
      return { devices: reindexed };
    });
    get().pushHistory();
  },

  groupSelectedDevices: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const groupId = `grp-${Date.now().toString(36)}`;
    set((state) => ({
      devices: state.devices.map((d) =>
        selectedIds.includes(d.id) ? { ...d, groupId } : d
      ),
    }));
    get().pushHistory();
  },

  ungroupSelectedDevices: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((state) => ({
      devices: state.devices.map((d) =>
        selectedIds.includes(d.id) ? { ...d, groupId: null } : d
      ),
    }));
    get().pushHistory();
  },

  // Drawing Tool & Animated Path Actions
  setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),

  updateDrawingDefaults: (patch) =>
    set((state) => ({
      drawingDefaults: { ...state.drawingDefaults, ...patch },
    })),

  addDrawing: (drawing) => {
    const state = get();
    const normalizedDrawing: SceneDrawingObject = {
      ...drawing,
      startFrame: drawing.startFrame ?? 0,
      durationFrames:
        drawing.durationFrames ??
        Math.max(30, state.durationInFrames - (drawing.startFrame ?? 0)),
      entranceAnimation: drawing.entranceAnimation ?? 'none',
      exitAnimation: drawing.exitAnimation ?? 'none',
    };
    const newTrack: TimelineTrack = {
      id: `track-${normalizedDrawing.id}`,
      targetId: normalizedDrawing.id,
      label: normalizedDrawing.name,
      type: 'drawing',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${normalizedDrawing.id}-0`,
          frame: normalizedDrawing.startFrame ?? 0,
          easing: 'ease-in-out',
          properties: {
            x: normalizedDrawing.x,
            y: normalizedDrawing.y,
            scaleX: normalizedDrawing.scaleX,
            scaleY: normalizedDrawing.scaleY,
            rotation: normalizedDrawing.rotation,
            opacity: normalizedDrawing.opacity,
            cornerRadius: normalizedDrawing.cornerRadius,
            strokeWidth: normalizedDrawing.strokeWidth,
            strokeColor: normalizedDrawing.strokeColor,
            glowBlur: normalizedDrawing.glowRadius,
            glowIntensity: normalizedDrawing.glowIntensity,
            glowColor: normalizedDrawing.glowColor,
          },
        },
      ],
    };
    set((s) => ({
      drawings: [...s.drawings, normalizedDrawing],
      tracks: [...s.tracks, newTrack],
      selectedDrawingId: normalizedDrawing.id,
      selectedWebcamId: null,
      selectedIds: [],
      selectedClipId: null,
    }));
    get().pushHistory();
  },

  selectDrawing: (id) =>
    set({
      selectedDrawingId: id,
      selectedWebcamId: null,
      selectedIds: [],
      selectedClipId: null,
    }),

  updateDrawing: (id, patch, recordHistory = true) => {
    set((state) => {
      const updatedDrawings = state.drawings.map((dr) => {
        if (dr.id !== id) return dr;
        let normalizedPatch = { ...patch };
        if (
          (patch.width !== undefined || patch.height !== undefined) &&
          patch.points === undefined
        ) {
          const resized = resizeDrawingGeometry(
            dr,
            patch.width,
            patch.height,
            patch.lockAspectRatio
          );
          normalizedPatch = {
            ...normalizedPatch,
            width: resized.width,
            height: resized.height,
            points: resized.points,
            lockAspectRatio: resized.lockAspectRatio,
          };
        }
        return { ...dr, ...normalizedPatch };
      });
      const targetDr = updatedDrawings.find((dr) => dr.id === id);
      const frame = state.currentFrame;

      const updatedTracks = state.tracks.map((track) => {
        if (track.targetId !== id) return track;
        const idx = track.keyframes.findIndex((kf) => kf.frame === frame);
        const hasAnimPatch =
          patch.x !== undefined ||
          patch.y !== undefined ||
          patch.scaleX !== undefined ||
          patch.scaleY !== undefined ||
          patch.rotation !== undefined ||
          patch.opacity !== undefined ||
          patch.cornerRadius !== undefined ||
          patch.strokeWidth !== undefined ||
          patch.strokeColor !== undefined ||
          patch.glowRadius !== undefined ||
          patch.glowIntensity !== undefined ||
          patch.glowColor !== undefined;

        if (!hasAnimPatch) {
          return { ...track, label: patch.name ?? track.label };
        }

        if (idx !== -1) {
          const kf = track.keyframes[idx];
          const nextProps = { ...kf.properties };
          if (patch.x !== undefined) nextProps.x = patch.x;
          if (patch.y !== undefined) nextProps.y = patch.y;
          if (patch.scaleX !== undefined) nextProps.scaleX = patch.scaleX;
          if (patch.scaleY !== undefined) nextProps.scaleY = patch.scaleY;
          if (patch.rotation !== undefined) nextProps.rotation = patch.rotation;
          if (patch.opacity !== undefined) nextProps.opacity = patch.opacity;
          if (patch.cornerRadius !== undefined)
            nextProps.cornerRadius = patch.cornerRadius;
          if (patch.strokeWidth !== undefined)
            nextProps.strokeWidth = patch.strokeWidth;
          if (patch.strokeColor !== undefined)
            nextProps.strokeColor = patch.strokeColor;
          if (patch.glowRadius !== undefined)
            nextProps.glowBlur = patch.glowRadius;
          if (patch.glowIntensity !== undefined)
            nextProps.glowIntensity = patch.glowIntensity;
          if (patch.glowColor !== undefined)
            nextProps.glowColor = patch.glowColor;
          const nextKfs = [...track.keyframes];
          nextKfs[idx] = { ...kf, properties: nextProps };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: nextKfs,
          };
        } else if (state.autoKeyframe && targetDr) {
          const origDr = state.drawings.find((dr) => dr.id === id) || targetDr;
          const resolvedDr = resolveDrawingAtFrame(
            origDr,
            track.keyframes,
            frame
          );
          const newKf: Keyframe = {
            id: `kf-${id}-${frame}`,
            frame,
            easing: 'ease-in-out',
            properties: {
              x: patch.x ?? resolvedDr.x,
              y: patch.y ?? resolvedDr.y,
              scaleX: patch.scaleX ?? resolvedDr.scaleX,
              scaleY: patch.scaleY ?? resolvedDr.scaleY,
              rotation: patch.rotation ?? resolvedDr.rotation,
              opacity: patch.opacity ?? resolvedDr.opacity,
              cornerRadius: patch.cornerRadius ?? resolvedDr.cornerRadius,
              strokeWidth: patch.strokeWidth ?? resolvedDr.strokeWidth,
              strokeColor: patch.strokeColor ?? resolvedDr.strokeColor,
              glowBlur: patch.glowRadius ?? resolvedDr.glowRadius,
              glowIntensity: patch.glowIntensity ?? resolvedDr.glowIntensity,
              glowColor: patch.glowColor ?? resolvedDr.glowColor,
            },
          };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: [...track.keyframes, newKf].sort(
              (a, b) => a.frame - b.frame
            ),
          };
        }
        return { ...track, label: patch.name ?? track.label };
      });

      return { drawings: updatedDrawings, tracks: updatedTracks };
    });
    if (recordHistory) get().pushHistory();
  },

  deleteDrawing: (id) => {
    set((state) => ({
      drawings: state.drawings.filter((dr) => dr.id !== id),
      tracks: state.tracks.filter((tr) => tr.targetId !== id),
      selectedDrawingId:
        state.selectedDrawingId === id ? null : state.selectedDrawingId,
    }));
    get().pushHistory();
  },

  duplicateDrawing: (id) => {
    const state = get();
    const orig = state.drawings.find((d) => d.id === id);
    if (!orig) return;
    const newId = `draw-${Date.now().toString(36)}`;
    const copy: SceneDrawingObject = {
      ...JSON.parse(JSON.stringify(orig)),
      id: newId,
      name: `${orig.name} Copy`,
      x: orig.x + 36,
      y: orig.y + 36,
      zIndex: state.drawings.length + 10,
    };
    const newTrack: TimelineTrack = {
      id: `track-${newId}`,
      targetId: newId,
      label: copy.name,
      type: 'drawing',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${newId}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: copy.x,
            y: copy.y,
            scaleX: copy.scaleX,
            scaleY: copy.scaleY,
            rotation: copy.rotation,
            opacity: copy.opacity,
            glowBlur: copy.glowRadius,
            glowIntensity: copy.glowIntensity,
            glowColor: copy.glowColor,
          },
        },
      ],
    };
    set((s) => ({
      drawings: [...s.drawings, copy],
      tracks: [...s.tracks, newTrack],
      selectedDrawingId: newId,
      lastTimelineNotice: `Duplicated drawing "${orig.name}"`,
    }));
    get().pushHistory();
  },

  trimDrawingClipEdge: (drawingId, edge, deltaFrames, recordHistory = false) => {
    set((state) => ({
      drawings: state.drawings.map((dr) => {
        if (dr.id !== drawingId) return dr;
        return computeTrimmedDrawingClip(
          dr,
          edge,
          deltaFrames,
          Math.max(180, state.durationInFrames * 2)
        );
      }),
    }));
    if (recordHistory) get().pushHistory();
  },

  createGlowingHaloAroundDevice: (deviceId, shape) => {
    const state = get();
    const dev =
      state.devices.find((d) => d.id === deviceId) || state.devices[0];
    if (!dev) return;
    const def = state.drawingDefaults;
    const id = `draw-halo-${Date.now().toString(36).slice(-4)}`;
    const w = dev.width * dev.scaleX + 84;
    const h = dev.height * dev.scaleY + 84;

    if (shape === 'arrow') {
      const startX = dev.x + w * 0.65;
      const startY = dev.y - h * 0.35;
      const endX = dev.x + w * 0.22;
      const endY = dev.y - h * 0.1;
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;
      const arrowObj: SceneDrawingObject = {
        id,
        name: `Neon Callout Arrow (${dev.name})`,
        tool: 'arrow',
        points: [
          { x: startX - cx, y: startY - cy },
          { x: endX - cx, y: endY - cy },
        ],
        x: cx,
        y: cy,
        width: Math.abs(startX - endX) + 40,
        height: Math.abs(startY - endY) + 40,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: state.drawings.length + 10,
        strokeColor: def.strokeColor,
        strokeColorEnd: def.strokeColorEnd,
        useGradientStroke: def.useGradientStroke,
        strokeWidth: Math.max(5, def.strokeWidth),
        strokeOpacity: 1,
        fillColor: def.fillColor,
        fillOpacity: 0,
        lineCap: 'round',
        lineJoin: 'round',
        dashPattern: 'solid',
        cornerRadius: 24,
        polygonSides: 6,
        glowEnabled: true,
        glowColor: def.glowColor,
        glowRadius: def.glowRadius,
        glowIntensity: def.glowIntensity,
        glowSpread: def.glowSpread,
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowBlur: 18,
        animationMode: 'draw-on',
        animationDurationFrames: def.animationDurationFrames,
        animationSpeed: def.animationSpeed,
        animationEasing: def.animationEasing,
      };
      get().addDrawing(arrowObj);
      return;
    }

    const preset = getDevicePresetById(dev.presetId);
    const haloObj: SceneDrawingObject = {
      id,
      name:
        shape === 'ellipse'
          ? `Glowing Halo Ring (${dev.name})`
          : `Neon Perimeter Trace (${dev.name})`,
      tool: shape,
      points: [],
      x: dev.x,
      y: dev.y,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      rotation: dev.rotation,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: state.drawings.length + 10,
      strokeColor: def.strokeColor,
      strokeColorEnd: def.strokeColorEnd,
      useGradientStroke: def.useGradientStroke,
      strokeWidth: def.strokeWidth,
      strokeOpacity: def.strokeOpacity,
      fillColor: def.fillColor,
      fillOpacity: def.fillOpacity,
      lineCap: 'round',
      lineJoin: 'round',
      dashPattern: def.dashPattern,
      cornerRadius: (dev.customOuterRadius ?? preset.outerRadius) + 22,
      polygonSides: 6,
      glowEnabled: true,
      glowColor: def.glowColor,
      glowRadius: def.glowRadius,
      glowIntensity: def.glowIntensity,
      glowSpread: def.glowSpread,
      shadowEnabled: true,
      shadowColor: '#000000',
      shadowBlur: 24,
      animationMode: def.animationMode === 'none' ? 'neon-trace' : def.animationMode,
      animationDurationFrames: def.animationDurationFrames,
      animationSpeed: def.animationSpeed,
      animationEasing: def.animationEasing,
    };
    get().addDrawing(haloObj);
  },

  // Webcam Overlay Studio Actions
  addWebcamOverlay: (
    shape = 'circle',
    stylePreset = 'neon-circular'
  ) => {
    const state = get();
    const shapeItem =
      WEBCAM_SHAPE_LIBRARY.find((s) => s.id === shape) ||
      WEBCAM_SHAPE_LIBRARY[0];
    const styleItem =
      WEBCAM_STYLE_PRESETS.find((s) => s.id === stylePreset) ||
      WEBCAM_STYLE_PRESETS[0];
    const count = state.webcams.length;
    const id = `webcam-${Date.now().toString(36).slice(-4)}-${count + 1}`;
    const offset = count * 34;

    const newWebcam: SceneWebcamOverlay = {
      id,
      name: `Webcam Overlay #${count + 1} (${shapeItem.name})`,
      visible: true,
      locked: false,
      zIndex: 20 + count,
      x: Math.min(1680, 1580 - offset),
      y: Math.min(860, 790 - offset),
      width: shapeItem.defaultWidth,
      height: shapeItem.defaultHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      lockAspectRatio: shape === 'circle' || shape === 'square',
      anchorPoint: 'center',
      layerPosition: 'above-devices',
      mediaId: 'proc-webcam-presenter',
      useLiveCamera: state.liveCameraActive,
      cameraDeviceId: state.availableCameraDevices[0]?.deviceId || '',
      cameraResolution: '1080p',
      cameraFps: 30,
      fitMode: 'cover',
      zoom: 1,
      panX: 0,
      panY: 0,
      mirrorHorizontal: true,
      shape: shapeItem.id,
      stylePreset: styleItem.id,
      cornerRadius: shapeItem.cornerRadius,
      cornerRadiusTL: shapeItem.cornerRadius,
      cornerRadiusTR: shapeItem.cornerRadius,
      cornerRadiusBR: shapeItem.cornerRadius,
      cornerRadiusBL: shapeItem.cornerRadius,
      individualCorners: false,
      curveIntensity: shapeItem.curveIntensity,
      curveTension: 0.65,
      asymmetry: 20,
      innerPadding: styleItem.innerPadding,
      bezierPoints: DEFAULT_WEBCAM_BEZIER_POINTS.map((p) => ({ ...p })),
      borderEnabled: true,
      borderWidth: styleItem.borderWidth,
      borderColor: styleItem.borderColor,
      borderSecondaryColor: styleItem.borderSecondaryColor,
      borderGradient: styleItem.borderGradient,
      borderGradientAngle: 135,
      borderOpacity: 1,
      borderStyle: styleItem.borderStyle,
      borderAnimationMode: styleItem.borderAnimationMode,
      borderAnimationSpeed: 1.0,
      borderAnimationProgress: 1.0,
      glowEnabled: styleItem.glowEnabled,
      glowType: styleItem.glowType,
      glowColor: styleItem.glowColor,
      glowSecondaryColor: styleItem.glowSecondaryColor,
      glowRadius: styleItem.glowRadius,
      glowSpread: 10,
      glowIntensity: styleItem.glowIntensity,
      glowOpacity: 0.9,
      shadowEnabled: true,
      shadowColor: '#020617',
      shadowBlur: 32,
      shadowOpacity: 0.65,
      shadowOffsetX: 0,
      shadowOffsetY: 16,
      startFrame: 0,
      durationFrames: state.durationInFrames,
      entranceAnimation: 'scale-pop',
      exitAnimation: 'fade-out',
    };

    const newTrack: TimelineTrack = {
      id: `track-${id}`,
      targetId: id,
      label: newWebcam.name,
      type: 'webcam',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: newWebcam.x,
            y: newWebcam.y,
            width: newWebcam.width,
            height: newWebcam.height,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            cornerRadius: newWebcam.cornerRadius,
            strokeWidth: newWebcam.borderWidth,
            strokeColor: newWebcam.borderColor,
            borderOpacity: newWebcam.borderOpacity,
            glowBlur: newWebcam.glowRadius,
            glowIntensity: newWebcam.glowIntensity,
            glowColor: newWebcam.glowColor,
            cropZoom: newWebcam.zoom,
            panX: newWebcam.panX,
            panY: newWebcam.panY,
            borderProgress: newWebcam.borderAnimationProgress,
            curveIntensity: newWebcam.curveIntensity,
          },
        },
      ],
    };

    set((s) => ({
      webcams: [...s.webcams, newWebcam],
      tracks: [...s.tracks, newTrack],
      selectedWebcamId: id,
      selectedDrawingId: null,
      selectedIds: [],
      selectedClipId: null,
      lastTimelineNotice: `Added "${newWebcam.name}" onto Canvas & Timeline`,
    }));
    get().pushHistory();
  },

  selectWebcam: (id) =>
    set({
      selectedWebcamId: id,
      selectedDrawingId: null,
      selectedIds: [],
      selectedClipId: null,
    }),

  updateWebcam: (id, patch, recordHistory = true) => {
    set((state) => {
      const updatedWebcams = state.webcams.map((wc) => {
        if (wc.id !== id) return wc;
        const next = { ...wc, ...patch };
        if (
          patch.shape &&
          patch.shape !== wc.shape &&
          patch.width === undefined &&
          patch.height === undefined
        ) {
          const shapeDef = WEBCAM_SHAPE_LIBRARY.find((s) => s.id === patch.shape);
          if (shapeDef) {
            next.width = shapeDef.defaultWidth;
            next.height = shapeDef.defaultHeight;
            next.cornerRadius = shapeDef.cornerRadius;
            next.curveIntensity = shapeDef.curveIntensity;
          }
        }
        return next;
      });

      const targetWc = updatedWebcams.find((wc) => wc.id === id);
      const frame = state.currentFrame;

      const updatedTracks = state.tracks.map((track) => {
        if (track.targetId !== id) return track;
        const idx = track.keyframes.findIndex((kf) => kf.frame === frame);
        const hasAnimPatch =
          patch.x !== undefined ||
          patch.y !== undefined ||
          patch.width !== undefined ||
          patch.height !== undefined ||
          patch.scaleX !== undefined ||
          patch.scaleY !== undefined ||
          patch.rotation !== undefined ||
          patch.opacity !== undefined ||
          patch.cornerRadius !== undefined ||
          patch.borderWidth !== undefined ||
          patch.borderColor !== undefined ||
          patch.borderOpacity !== undefined ||
          patch.glowRadius !== undefined ||
          patch.glowIntensity !== undefined ||
          patch.glowColor !== undefined ||
          patch.zoom !== undefined ||
          patch.panX !== undefined ||
          patch.panY !== undefined ||
          patch.borderAnimationProgress !== undefined ||
          patch.curveIntensity !== undefined;

        if (!hasAnimPatch) {
          return { ...track, label: patch.name ?? track.label };
        }

        const applyPatchToProps = (base: Keyframe['properties']): Keyframe['properties'] => {
          const nextProps = { ...base };
          if (patch.x !== undefined) nextProps.x = patch.x;
          if (patch.y !== undefined) nextProps.y = patch.y;
          if (patch.width !== undefined) nextProps.width = patch.width;
          if (patch.height !== undefined) nextProps.height = patch.height;
          if (patch.scaleX !== undefined) nextProps.scaleX = patch.scaleX;
          if (patch.scaleY !== undefined) nextProps.scaleY = patch.scaleY;
          if (patch.rotation !== undefined) nextProps.rotation = patch.rotation;
          if (patch.opacity !== undefined) nextProps.opacity = patch.opacity;
          if (patch.cornerRadius !== undefined)
            nextProps.cornerRadius = patch.cornerRadius;
          if (patch.borderWidth !== undefined)
            nextProps.strokeWidth = patch.borderWidth;
          if (patch.borderColor !== undefined)
            nextProps.strokeColor = patch.borderColor;
          if (patch.borderOpacity !== undefined)
            nextProps.borderOpacity = patch.borderOpacity;
          if (patch.glowRadius !== undefined)
            nextProps.glowBlur = patch.glowRadius;
          if (patch.glowIntensity !== undefined)
            nextProps.glowIntensity = patch.glowIntensity;
          if (patch.glowColor !== undefined)
            nextProps.glowColor = patch.glowColor;
          if (patch.zoom !== undefined) nextProps.cropZoom = patch.zoom;
          if (patch.panX !== undefined) nextProps.panX = patch.panX;
          if (patch.panY !== undefined) nextProps.panY = patch.panY;
          if (patch.borderAnimationProgress !== undefined)
            nextProps.borderProgress = patch.borderAnimationProgress;
          if (patch.curveIntensity !== undefined)
            nextProps.curveIntensity = patch.curveIntensity;
          return nextProps;
        };

        if (idx !== -1) {
          const kf = track.keyframes[idx];
          const nextKfs = [...track.keyframes];
          nextKfs[idx] = {
            ...kf,
            properties: applyPatchToProps(kf.properties),
          };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: nextKfs,
          };
        } else if (state.autoKeyframe && targetWc) {
          const origWc = state.webcams.find((w) => w.id === id) || targetWc;
          const resolvedWc = resolveWebcamAtFrame(
            origWc,
            track.keyframes,
            frame,
            state.durationInFrames
          );
          const newKf: Keyframe = {
            id: `kf-${id}-${frame}`,
            frame,
            easing: 'ease-in-out',
            properties: applyPatchToProps({
              x: resolvedWc.x,
              y: resolvedWc.y,
              width: resolvedWc.width,
              height: resolvedWc.height,
              scaleX: resolvedWc.scaleX,
              scaleY: resolvedWc.scaleY,
              rotation: resolvedWc.rotation,
              opacity: resolvedWc.opacity,
              cornerRadius: resolvedWc.cornerRadius,
              strokeWidth: resolvedWc.borderWidth,
              strokeColor: resolvedWc.borderColor,
              borderOpacity: resolvedWc.borderOpacity,
              glowBlur: resolvedWc.glowRadius,
              glowIntensity: resolvedWc.glowIntensity,
              glowColor: resolvedWc.glowColor,
              cropZoom: resolvedWc.zoom,
              panX: resolvedWc.panX,
              panY: resolvedWc.panY,
              borderProgress: resolvedWc.borderAnimationProgress,
              curveIntensity: resolvedWc.curveIntensity,
            }),
          };
          return {
            ...track,
            label: patch.name ?? track.label,
            keyframes: [...track.keyframes, newKf].sort(
              (a, b) => a.frame - b.frame
            ),
          };
        }
        return { ...track, label: patch.name ?? track.label };
      });

      return { webcams: updatedWebcams, tracks: updatedTracks };
    });
    if (recordHistory) get().pushHistory();
  },

  deleteWebcam: (id) => {
    set((state) => ({
      webcams: state.webcams.filter((w) => w.id !== id),
      tracks: state.tracks.filter((t) => t.targetId !== id),
      selectedWebcamId:
        state.selectedWebcamId === id ? null : state.selectedWebcamId,
      lastTimelineNotice: 'Removed webcam overlay from scene',
    }));
    get().pushHistory();
  },

  duplicateWebcam: (id) => {
    const state = get();
    const orig = state.webcams.find((w) => w.id === id);
    if (!orig) return;
    const newId = `webcam-dup-${Date.now().toString(36).slice(-4)}`;
    const copy: SceneWebcamOverlay = {
      ...JSON.parse(JSON.stringify(orig)),
      id: newId,
      name: `${orig.name} Copy`,
      x: Math.max(160, orig.x - 48),
      y: Math.max(160, orig.y - 48),
      zIndex: state.webcams.length + 22,
    };
    const newTrack: TimelineTrack = {
      id: `track-${newId}`,
      targetId: newId,
      label: copy.name,
      type: 'webcam',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${newId}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: copy.x,
            y: copy.y,
            width: copy.width,
            height: copy.height,
            scaleX: copy.scaleX,
            scaleY: copy.scaleY,
            rotation: copy.rotation,
            opacity: copy.opacity,
            cornerRadius: copy.cornerRadius,
            strokeWidth: copy.borderWidth,
            strokeColor: copy.borderColor,
            borderOpacity: copy.borderOpacity,
            glowBlur: copy.glowRadius,
            glowIntensity: copy.glowIntensity,
            glowColor: copy.glowColor,
            cropZoom: copy.zoom,
          },
        },
      ],
    };
    set((s) => ({
      webcams: [...s.webcams, copy],
      tracks: [...s.tracks, newTrack],
      selectedWebcamId: newId,
      selectedDrawingId: null,
      selectedIds: [],
      selectedClipId: null,
      lastTimelineNotice: `Duplicated webcam "${orig.name}"`,
    }));
    get().pushHistory();
  },

  trimWebcamClipEdge: (webcamId, edge, deltaFrames, recordHistory = false) => {
    set((state) => ({
      webcams: state.webcams.map((wc) => {
        if (wc.id !== webcamId) return wc;
        return computeTrimmedWebcamClip(
          wc,
          edge,
          deltaFrames,
          Math.max(180, state.durationInFrames * 2)
        );
      }),
    }));
    if (recordHistory) get().pushHistory();
  },

  applyWebcamStylePreset: (webcamId, styleId) => {
    const style = WEBCAM_STYLE_PRESETS.find((s) => s.id === styleId);
    if (!style) return;
    const state = get();
    const target =
      state.webcams.find((w) => w.id === webcamId) || state.webcams[0];
    if (!target) {
      get().addWebcamOverlay('circle', styleId);
      return;
    }
    get().updateWebcam(target.id, {
      stylePreset: style.id,
      borderEnabled: true,
      borderColor: style.borderColor,
      borderSecondaryColor: style.borderSecondaryColor,
      borderWidth: style.borderWidth,
      borderGradient: style.borderGradient,
      borderStyle: style.borderStyle,
      borderAnimationMode: style.borderAnimationMode,
      glowEnabled: style.glowEnabled,
      glowType: style.glowType,
      glowColor: style.glowColor,
      glowSecondaryColor: style.glowSecondaryColor,
      glowRadius: style.glowRadius,
      glowIntensity: style.glowIntensity,
      innerPadding: style.innerPadding,
    });
    set({
      selectedWebcamId: target.id,
      lastTimelineNotice: `Applied "${style.name}" style preset`,
    });
  },

  applyWebcamPiPPreset: (pipPresetId) => {
    const pip = WEBCAM_PIP_PRESETS.find((p) => p.id === pipPresetId);
    if (!pip) return;
    const state = get();
    const style =
      WEBCAM_STYLE_PRESETS.find((s) => s.id === pip.stylePreset) ||
      WEBCAM_STYLE_PRESETS[0];

    const target =
      state.webcams.find((w) => w.id === state.selectedWebcamId) ||
      state.webcams[0];

    if (!target) {
      get().addWebcamOverlay(pip.shape, pip.stylePreset);
      const created = get().webcams[get().webcams.length - 1];
      if (created) {
        get().updateWebcam(created.id, {
          name: pip.name,
          x: pip.x,
          y: pip.y,
          width: pip.width,
          height: pip.height,
          rotation: pip.rotation,
          shape: pip.shape,
          cornerRadius: pip.cornerRadius,
          curveIntensity: pip.curveIntensity,
        });
      }
      return;
    }

    get().updateWebcam(target.id, {
      x: pip.x,
      y: pip.y,
      width: pip.width,
      height: pip.height,
      rotation: pip.rotation,
      shape: pip.shape,
      stylePreset: pip.stylePreset,
      cornerRadius: pip.cornerRadius,
      curveIntensity: pip.curveIntensity,
      borderColor: style.borderColor,
      borderSecondaryColor: style.borderSecondaryColor,
      borderWidth: style.borderWidth,
      borderGradient: style.borderGradient,
      borderStyle: style.borderStyle,
      borderAnimationMode: style.borderAnimationMode,
      glowEnabled: style.glowEnabled,
      glowType: style.glowType,
      glowColor: style.glowColor,
      glowSecondaryColor: style.glowSecondaryColor,
      glowRadius: style.glowRadius,
      glowIntensity: style.glowIntensity,
      innerPadding: style.innerPadding,
    });
    set({
      selectedWebcamId: target.id,
      selectedDrawingId: null,
      selectedIds: [],
      selectedClipId: null,
      lastTimelineNotice: `Applied PiP Layout: "${pip.name}"`,
    });
  },

  applyWebcamShowcaseAnimation: (webcamId) => {
    const state = get();
    const wc =
      state.webcams.find((w) => w.id === webcamId) || state.webcams[0];
    if (!wc) return;
    const kfs = generateWebcamShowcaseKeyframes(wc);
    set((s) => {
      const existingTrack = s.tracks.find((t) => t.targetId === wc.id);
      const nextTracks = existingTrack
        ? s.tracks.map((t) =>
            t.id === existingTrack.id ? { ...t, keyframes: kfs } : t
          )
        : [
            ...s.tracks,
            {
              id: `track-${wc.id}`,
              targetId: wc.id,
              label: wc.name,
              type: 'webcam' as const,
              visible: true,
              locked: false,
              keyframes: kfs,
            },
          ];
      return {
        tracks: nextTracks,
        currentFrame: 0,
        selectedWebcamId: wc.id,
        lastTimelineNotice: `Applied 5-Keyframe Webcam Showcase Animation (F0 → F15 → F30 → F60 → F90)`,
      };
    });
    get().pushHistory();
  },

  saveCustomWebcamShape: (name, webcamId) => {
    const state = get();
    const wc =
      state.webcams.find((w) => w.id === webcamId) ||
      state.webcams.find((w) => w.id === state.selectedWebcamId) ||
      state.webcams[0];
    if (!wc) return;
    const preset: CustomWebcamShapePreset = {
      id: `custom-wc-shape-${Date.now().toString(36)}`,
      name: name.trim() || `Custom ${wc.shape} Frame`,
      shape: wc.shape,
      cornerRadius: wc.cornerRadius,
      curveIntensity: wc.curveIntensity,
      curveTension: wc.curveTension,
      bezierPoints: wc.bezierPoints.map((p) => ({ ...p })),
    };
    set((s) => ({
      customWebcamShapes: [preset, ...s.customWebcamShapes],
      lastTimelineNotice: `Saved custom webcam shape "${preset.name}"`,
    }));
  },

  applyCustomWebcamShape: (webcamId, customShapeId) => {
    const state = get();
    const preset = state.customWebcamShapes.find((c) => c.id === customShapeId);
    if (!preset) return;
    get().updateWebcam(webcamId, {
      shape: preset.shape,
      cornerRadius: preset.cornerRadius,
      curveIntensity: preset.curveIntensity,
      curveTension: preset.curveTension,
      bezierPoints: preset.bezierPoints.map((p) => ({ ...p })),
    });
  },

  setLiveCameraStatus: (active, error = null, devices) => {
    set((s) => ({
      liveCameraActive: active,
      liveCameraError: error,
      availableCameraDevices: devices ?? s.availableCameraDevices,
      webcams: s.webcams.map((wc) => ({
        ...wc,
        useLiveCamera: active,
      })),
    }));
  },

  // Media & Automatic Timeline Clip Integration (Never truncates long videos up to 5 minutes)
  addMediaAsset: (asset, autoCreateClip = true) => {
    const state = get();
    const rawClipFrames = Math.max(
      30,
      Math.round((asset.duration || 6) * state.fps)
    );
    const clipFrames = Math.min(9000, rawClipFrames);
    const peaks =
      asset.waveformPeaks || generateWaveformPeaks(asset.name || asset.id, 60);
    const enrichedAsset: MediaAsset = { ...asset, waveformPeaks: peaks };

    const newClip: TimelineClip | null = autoCreateClip
      ? {
          id: `clip-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 5)}`,
          mediaId: enrichedAsset.id,
          name: enrichedAsset.name,
          mediaType: enrichedAsset.type,
          trackId: `media-track-${state.clips.length + 1}`,
          startFrame: 0,
          durationFrames: clipFrames,
          trimStartFrames: 0,
          sourceOutFrame: clipFrames,
          sourceDurationFrames: clipFrames,
          muted: false,
          locked: false,
          visible: true,
          waveformPeaks: peaks,
        }
      : null;

    set((s) => ({
      mediaAssets: [enrichedAsset, ...s.mediaAssets],
      clips: newClip ? [...s.clips, newClip] : s.clips,
      durationInFrames: newClip
        ? Math.max(s.durationInFrames, newClip.startFrame + newClip.durationFrames)
        : s.durationInFrames,
      selectedClipId: newClip ? newClip.id : s.selectedClipId,
      lastTimelineNotice: newClip
        ? `Added "${enrichedAsset.name}" (${(clipFrames / s.fps).toFixed(1)}s · ${clipFrames}f)`
        : null,
    }));
    get().pushHistory();
  },

  addLongDemoVideo: (durationSeconds = 60) => {
    const state = get();
    const safeSec = Math.max(10, Math.min(300, durationSeconds));
    const clipFrames = Math.round(safeSec * state.fps);
    const id = `video-long-${Date.now().toString(36).slice(-4)}`;
    const name = `Keynote Master Recording (${safeSec}s Multi-Scene)`;
    const peaks = generateWaveformPeaks(name, 80);

    const demoAsset: MediaAsset = {
      id,
      name,
      type: 'procedural',
      url: '',
      proceduralKey: 'daw-desktop',
      duration: safeSec,
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      sizeBytes: safeSec * 420_000,
      createdAt: Date.now(),
      waveformPeaks: peaks,
    };

    const newClip: TimelineClip = {
      id: `clip-long-${Date.now().toString(36).slice(-4)}`,
      mediaId: id,
      name,
      mediaType: 'video',
      trackId: `media-track-${state.clips.length + 1}`,
      startFrame: 0,
      durationFrames: clipFrames,
      trimStartFrames: 0,
      sourceOutFrame: clipFrames,
      sourceDurationFrames: clipFrames,
      muted: false,
      locked: false,
      visible: true,
      waveformPeaks: peaks,
    };

    set((s) => ({
      mediaAssets: [demoAsset, ...s.mediaAssets],
      clips: [...s.clips, newClip],
      durationInFrames: Math.max(s.durationInFrames, clipFrames),
      selectedClipId: newClip.id,
      selectedIds: [],
      selectedDrawingId: null,
      lastTimelineNotice: `Loaded ${safeSec}s (${clipFrames}f) Master Video onto Timeline`,
    }));
    get().pushHistory();
  },

  removeMediaAsset: (assetId) => {
    const state = get();
    const target = state.mediaAssets.find((m) => m.id === assetId);
    if (target && target.type !== 'procedural') {
      releaseMediaAssetResources(target);
    }
    set((s) => ({
      mediaAssets: s.mediaAssets.filter((m) => m.id !== assetId),
      clips: s.clips.filter((c) => c.mediaId !== assetId),
      devices: s.devices.map((d) =>
        d.mediaId === assetId ? { ...d, mediaId: 'proc-fintech-mobile' } : d
      ),
    }));
    get().pushHistory();
  },

  assignMediaToDevice: (deviceId, mediaId) => {
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, mediaId } : d
      ),
    }));
    get().pushHistory();
  },

  addClipFromMedia: (mediaId, startFrame = 0) => {
    const state = get();
    const asset = state.mediaAssets.find((m) => m.id === mediaId);
    if (!asset) return;
    const durFrames = Math.max(
      30,
      Math.min(9000, Math.round((asset.duration || 6) * state.fps))
    );
    const safeStart = Math.max(0, startFrame);
    const newClip: TimelineClip = {
      id: `clip-${Date.now().toString(36)}`,
      mediaId: asset.id,
      name: asset.name,
      mediaType: asset.type,
      trackId: `media-track-${state.clips.length + 1}`,
      startFrame: safeStart,
      durationFrames: durFrames,
      trimStartFrames: 0,
      sourceOutFrame: durFrames,
      sourceDurationFrames: durFrames,
      muted: false,
      locked: false,
      visible: true,
      waveformPeaks:
        asset.waveformPeaks || generateWaveformPeaks(asset.name, 60),
    };
    set((s) => ({
      clips: [...s.clips, newClip],
      durationInFrames: Math.max(s.durationInFrames, safeStart + durFrames),
      selectedClipId: newClip.id,
      selectedIds: [],
      selectedDrawingId: null,
      selectedWebcamId: null,
    }));
    get().pushHistory();
  },

  selectClip: (clipId) =>
    set({
      selectedClipId: clipId,
      selectedIds: clipId ? [] : get().selectedIds,
      selectedDrawingId: null,
      selectedWebcamId: null,
    }),

  updateClip: (clipId, patch, recordHistory = true) => {
    set((state) => {
      const updatedClips = state.clips.map((c) =>
        c.id === clipId ? { ...c, ...patch } : c
      );
      const maxEnd = updatedClips.reduce(
        (acc, c) => Math.max(acc, c.startFrame + c.durationFrames),
        state.durationInFrames
      );
      return {
        clips: updatedClips,
        durationInFrames: Math.min(9000, maxEnd),
      };
    });
    if (recordHistory) get().pushHistory();
  },

  updateClipsBatch: (nextClips, recordHistory = false) => {
    set((state) => {
      const maxEnd = nextClips.reduce(
        (acc, c) => Math.max(acc, c.startFrame + c.durationFrames),
        state.durationInFrames
      );
      return {
        clips: nextClips,
        durationInFrames: Math.min(9000, maxEnd),
      };
    });
    if (recordHistory) get().pushHistory();
  },

  trimClipEdge: (clipId, edge, deltaFrames, recordHistory = false) => {
    set((state) => ({
      clips: state.clips.map((c) => {
        if (c.id !== clipId) return c;
        const asset = state.mediaAssets.find((m) => m.id === c.mediaId);
        const maxSourceFrames = asset
          ? Math.max(30, Math.round((asset.duration || 10) * state.fps))
          : Math.max(180, state.durationInFrames * 2);
        return computeTrimmedClip(c, edge, deltaFrames, maxSourceFrames);
      }),
    }));
    if (recordHistory) get().pushHistory();
  },

  trimSelectedClipToPlayhead: (edge) => {
    const state = get();
    const f = state.currentFrame;

    // 0. If a Webcam Overlay clip is selected, trim its startFrame / durationFrames
    if (state.selectedWebcamId) {
      const wc = state.webcams.find((w) => w.id === state.selectedWebcamId);
      if (wc) {
        const wcStart = wc.startFrame ?? 0;
        const wcDur = wc.durationFrames ?? state.durationInFrames;
        const wcEnd = wcStart + wcDur;
        const delta = edge === 'left' ? f - wcStart : f - wcEnd;
        const trimmedWc = computeTrimmedWebcamClip(
          { ...wc, startFrame: wcStart, durationFrames: wcDur },
          edge,
          delta,
          state.durationInFrames
        );
        set((s) => ({
          webcams: s.webcams.map((item) =>
            item.id === wc.id ? trimmedWc : item
          ),
          lastTimelineNotice: `Trimmed ${edge === 'left' ? 'start' : 'end'} of webcam "${wc.name}" to F${f}`,
        }));
        get().pushHistory();
        return;
      }
    }

    // 1. If a Neon Drawing clip is selected, trim the drawing's startFrame / durationFrames
    if (state.selectedDrawingId) {
      const dr = state.drawings.find((d) => d.id === state.selectedDrawingId);
      if (dr) {
        const drStart = dr.startFrame ?? 0;
        const drDur = dr.durationFrames ?? state.durationInFrames;
        const drEnd = drStart + drDur;
        if (edge === 'left') {
          const delta = f - drStart;
          if (delta <= 0 || delta >= drDur - 5) {
            set({
              lastTimelineNotice: `Move playhead inside "${dr.name}" (F${drStart}–F${drEnd}) to trim its start.`,
            });
            return;
          }
          const trimmedDr = computeTrimmedDrawingClip(
            { ...dr, startFrame: drStart, durationFrames: drDur },
            'left',
            delta,
            state.durationInFrames
          );
          set((s) => ({
            drawings: s.drawings.map((item) =>
              item.id === dr.id ? trimmedDr : item
            ),
            lastTimelineNotice: `Trimmed start of drawing "${dr.name}" to F${f}`,
          }));
          get().pushHistory();
          return;
        } else {
          const delta = f - drEnd;
          if (f <= drStart + 5) {
            set({
              lastTimelineNotice: `Playhead F${f} is before drawing start (F${drStart}).`,
            });
            return;
          }
          const trimmedDr = computeTrimmedDrawingClip(
            { ...dr, startFrame: drStart, durationFrames: drDur },
            'right',
            delta,
            state.durationInFrames
          );
          set((s) => ({
            drawings: s.drawings.map((item) =>
              item.id === dr.id ? trimmedDr : item
            ),
            lastTimelineNotice: `Trimmed end of drawing "${dr.name}" to F${f}`,
          }));
          get().pushHistory();
          return;
        }
      }
    }

    // 2. Otherwise trim the selected Video/Media clip
    const clip =
      state.clips.find((c) => c.id === state.selectedClipId) ||
      state.clips.find(
        (c) =>
          state.currentFrame >= c.startFrame &&
          state.currentFrame <= c.startFrame + c.durationFrames
      ) ||
      state.clips[0];
    if (!clip) return;

    if (edge === 'left') {
      const delta = f - clip.startFrame;
      if (delta <= 0 || delta >= clip.durationFrames - 5) {
        set({
          lastTimelineNotice: `Move playhead inside "${clip.name}" to trim its start.`,
        });
        return;
      }
      const trimmed = computeTrimmedClip(clip, 'left', delta);
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clip.id ? trimmed : c)),
        selectedClipId: clip.id,
        lastTimelineNotice: `Trimmed start of "${clip.name}" to F${f}`,
      }));
      get().pushHistory();
    } else {
      const currentEnd = clip.startFrame + clip.durationFrames;
      const delta = f - currentEnd;
      if (f <= clip.startFrame + 5) {
        set({
          lastTimelineNotice: `Playhead F${f} is before clip start (F${clip.startFrame}).`,
        });
        return;
      }
      const trimmed = computeTrimmedClip(clip, 'right', delta);
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clip.id ? trimmed : c)),
        selectedClipId: clip.id,
        lastTimelineNotice: `Trimmed end of "${clip.name}" to F${f}`,
      }));
      get().pushHistory();
    }
  },

  splitSelectedClipAtPlayhead: () => {
    const state = get();
    const f = state.currentFrame;

    // 0. If a Webcam Overlay clip is selected, split it at the playhead
    if (state.selectedWebcamId) {
      const wc = state.webcams.find((w) => w.id === state.selectedWebcamId);
      if (wc) {
        const splitRes = splitWebcamClipAtFrame(
          wc,
          f,
          `${Date.now().toString(36)}`,
          state.durationInFrames
        );
        if (!splitRes.ok || !splitRes.firstWebcam || !splitRes.secondWebcam) {
          set({
            lastTimelineNotice:
              splitRes.reason || 'Move playhead inside webcam clip to split.',
          });
          return;
        }
        const { firstWebcam, secondWebcam } = splitRes;
        set((s) => {
          const idx = s.webcams.findIndex((item) => item.id === wc.id);
          if (idx === -1) return s;
          const nextWebcams = [...s.webcams];
          nextWebcams.splice(idx, 1, firstWebcam, secondWebcam);

          const origTrack = s.tracks.find((t) => t.targetId === wc.id);
          const secondTrack: TimelineTrack = {
            id: `track-${secondWebcam.id}`,
            targetId: secondWebcam.id,
            label: secondWebcam.name,
            type: 'webcam',
            visible: true,
            locked: false,
            keyframes: origTrack
              ? origTrack.keyframes.map((kf, kfIdx) => ({
                  ...JSON.parse(JSON.stringify(kf)),
                  id: `kf-${secondWebcam.id}-${kfIdx}`,
                }))
              : [],
          };
          const updatedTracks = s.tracks.map((t) =>
            t.targetId === wc.id ? { ...t, label: firstWebcam.name } : t
          );

          return {
            webcams: nextWebcams,
            tracks: [...updatedTracks, secondTrack],
            selectedWebcamId: secondWebcam.id,
            lastTimelineNotice: `Split webcam "${wc.name}" at F${f}`,
          };
        });
        get().pushHistory();
        return;
      }
    }

    // 1. If a Neon Drawing clip is selected, split the drawing clip at the playhead
    if (state.selectedDrawingId) {
      const dr = state.drawings.find((d) => d.id === state.selectedDrawingId);
      if (dr) {
        const splitRes = splitDrawingClipAtFrame(
          {
            ...dr,
            startFrame: dr.startFrame ?? 0,
            durationFrames: dr.durationFrames ?? state.durationInFrames,
          },
          f,
          `${Date.now().toString(36)}`,
          state.durationInFrames
        );
        if (!splitRes.ok || !splitRes.firstDrawing || !splitRes.secondDrawing) {
          set({
            lastTimelineNotice:
              splitRes.reason || 'Move playhead inside drawing clip to split.',
          });
          return;
        }
        const { firstDrawing, secondDrawing } = splitRes;
        set((s) => {
          const idx = s.drawings.findIndex((item) => item.id === dr.id);
          if (idx === -1) return s;
          const nextDrawings = [...s.drawings];
          nextDrawings.splice(idx, 1, firstDrawing, secondDrawing);

          const origTrack = s.tracks.find((t) => t.targetId === dr.id);
          const secondTrack: TimelineTrack = {
            id: `track-${secondDrawing.id}`,
            targetId: secondDrawing.id,
            label: secondDrawing.name,
            type: 'drawing',
            visible: true,
            locked: false,
            keyframes: origTrack
              ? origTrack.keyframes.map((kf, kfIdx) => ({
                  ...JSON.parse(JSON.stringify(kf)),
                  id: `kf-${secondDrawing.id}-${kfIdx}`,
                }))
              : [],
          };
          const updatedTracks = s.tracks.map((t) =>
            t.targetId === dr.id ? { ...t, label: firstDrawing.name } : t
          );

          return {
            drawings: nextDrawings,
            tracks: [...updatedTracks, secondTrack],
            selectedDrawingId: secondDrawing.id,
            lastTimelineNotice: `Split drawing "${dr.name}" at F${f}`,
          };
        });
        get().pushHistory();
        return;
      }
    }

    // 2. Otherwise split the selected Video/Media clip
    const selected = state.clips.find((c) => c.id === state.selectedClipId);
    const clip =
      selected &&
      f >= selected.startFrame + 2 &&
      f <= selected.startFrame + selected.durationFrames - 2
        ? selected
        : state.clips.find(
            (c) => f >= c.startFrame + 2 && f <= c.startFrame + c.durationFrames - 2
          ) ||
          selected ||
          state.clips[0];

    if (!clip) return;
    const splitRes = splitTimelineClipAtFrame(
      clip,
      f,
      `${Date.now().toString(36)}`
    );
    if (!splitRes.ok || !splitRes.firstClip || !splitRes.secondClip) {
      set({
        lastTimelineNotice:
          splitRes.reason || 'Move playhead inside clip to split.',
      });
      return;
    }

    const { firstClip, secondClip } = splitRes;
    set((s) => {
      const idx = s.clips.findIndex((c) => c.id === clip.id);
      if (idx === -1) return s;
      const nextClips = [...s.clips];
      nextClips.splice(idx, 1, firstClip, secondClip);
      return {
        clips: nextClips,
        selectedClipId: secondClip.id,
        lastTimelineNotice: `Split "${clip.name}" at F${f}`,
      };
    });
    get().pushHistory();
  },

  duplicateSelectedClip: () => {
    const state = get();
    if (state.selectedWebcamId) {
      get().duplicateWebcam(state.selectedWebcamId);
      return;
    }
    if (state.selectedDrawingId) {
      get().duplicateDrawing(state.selectedDrawingId);
      return;
    }
    const clip = state.clips.find((c) => c.id === state.selectedClipId);
    if (!clip) return;
    const copy: TimelineClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip-dup-${Date.now().toString(36)}`,
      name: `${clip.name} Copy`,
      startFrame: Math.min(
        state.durationInFrames - 20,
        clip.startFrame + Math.round(clip.durationFrames * 0.25)
      ),
    };
    set((s) => ({
      clips: [...s.clips, copy],
      selectedClipId: copy.id,
      lastTimelineNotice: `Duplicated clip "${clip.name}"`,
    }));
    get().pushHistory();
  },

  deleteSelectedClip: () => {
    const { selectedClipId, selectedDrawingId, selectedWebcamId } = get();
    if (selectedWebcamId) {
      get().deleteWebcam(selectedWebcamId);
      return;
    }
    if (selectedDrawingId) {
      get().deleteDrawing(selectedDrawingId);
      return;
    }
    if (!selectedClipId) return;
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== selectedClipId),
      selectedClipId: null,
      lastTimelineNotice: 'Deleted clip from timeline',
    }));
    get().pushHistory();
  },

  updateBackground: (patch) => {
    set((state) => ({
      background: { ...state.background, ...patch },
    }));
    get().pushHistory();
  },

  applyBackgroundPreset: (presetId) => {
    const found = BACKGROUND_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    set({
      background: { ...found.background },
    });
    get().pushHistory();
  },

  updateStudio3D: (patch) => {
    set((state) => ({
      studio3D: { ...state.studio3D, ...patch },
    }));
  },

  setCameraPreset3D: (preset) => {
    set((state) => ({
      studio3D: { ...state.studio3D, cameraPreset: preset },
    }));
  },

  setCurrentFrame: (frame) => {
    const { durationInFrames } = get();
    const clamped = Math.max(
      0,
      Math.min(durationInFrames - 1, Math.round(frame))
    );
    set({ currentFrame: clamped });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  stepFrame: (delta) => {
    const { currentFrame, durationInFrames } = get();
    const next = (currentFrame + delta + durationInFrames) % durationInFrames;
    set({ currentFrame: next, isPlaying: false });
  },

  jumpToAdjacentKeyframe: (direction) => {
    const state = get();
    const activeTargetId =
      state.selectedWebcamId ||
      state.selectedDrawingId ||
      state.selectedIds[0] ||
      state.devices[0]?.id ||
      null;
    if (!activeTargetId) return;
    const track = state.tracks.find((t) => t.targetId === activeTargetId);
    if (!track || track.keyframes.length === 0) return;

    const sorted = [...track.keyframes].sort((a, b) => a.frame - b.frame);
    let targetKf: Keyframe | undefined;
    if (direction === 'prev') {
      const earlier = sorted.filter((k) => k.frame < state.currentFrame);
      targetKf =
        earlier.length > 0 ? earlier[earlier.length - 1] : sorted[sorted.length - 1];
    } else {
      const later = sorted.filter((k) => k.frame > state.currentFrame);
      targetKf = later.length > 0 ? later[0] : sorted[0];
    }

    if (targetKf) {
      set({
        isPlaying: false,
        currentFrame: targetKf.frame,
        selectedKeyframe: { trackId: track.id, keyframeId: targetKf.id },
      });
    }
  },

  toggleTrackExpanded: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, expanded: !t.expanded } : t
      ),
    }));
  },

  clearTrackKeyframes: (targetId) => {
    const state = get();
    const dev = state.devices.find((d) => d.id === targetId);
    const dr = state.drawings.find((d) => d.id === targetId);
    const wc = state.webcams.find((w) => w.id === targetId);
    if (!dev && !dr && !wc) return;

    const baseKf: Keyframe = dev
      ? {
          id: `kf-${targetId}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: dev.x,
            y: dev.y,
            scaleX: dev.scaleX,
            scaleY: dev.scaleY,
            rotation: dev.rotation,
            opacity: dev.opacity,
            glowBlur: dev.effects.glowBlur,
            glowIntensity: dev.effects.glowIntensity,
            glowColor: dev.effects.glowColor,
            rotation3DX: dev.rotation3DX,
            rotation3DY: dev.rotation3DY,
            rotation3DZ: dev.rotation3DZ,
          },
        }
      : wc
        ? {
            id: `kf-${targetId}-0`,
            frame: 0,
            easing: 'ease-in-out',
            properties: {
              x: wc.x,
              y: wc.y,
              width: wc.width,
              height: wc.height,
              scaleX: wc.scaleX,
              scaleY: wc.scaleY,
              rotation: wc.rotation,
              opacity: wc.opacity,
              cornerRadius: wc.cornerRadius,
              strokeWidth: wc.borderWidth,
              strokeColor: wc.borderColor,
              borderOpacity: wc.borderOpacity,
              glowBlur: wc.glowRadius,
              glowIntensity: wc.glowIntensity,
              glowColor: wc.glowColor,
              cropZoom: wc.zoom,
            },
          }
        : {
            id: `kf-${targetId}-0`,
            frame: 0,
            easing: 'ease-in-out',
            properties: {
              x: dr!.x,
              y: dr!.y,
              scaleX: dr!.scaleX,
              scaleY: dr!.scaleY,
              rotation: dr!.rotation,
              opacity: dr!.opacity,
              glowBlur: dr!.glowRadius,
              glowIntensity: dr!.glowIntensity,
              glowColor: dr!.glowColor,
            },
          };

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.targetId === targetId ? { ...t, keyframes: [baseKf] } : t
      ),
      selectedKeyframe: null,
      lastTimelineNotice: 'Reset track to 1 base keyframe at F000',
    }));
    get().pushHistory();
  },

  setSelectedKeyframe: (sel) => set({ selectedKeyframe: sel }),

  addKeyframeAtCurrentFrame: (targetId, easing = 'ease-in-out') => {
    const state = get();
    const { devices, drawings, webcams, currentFrame, durationInFrames } = state;
    const existingTrack = state.tracks.find((t) => t.targetId === targetId);
    const dev = devices.find((d) => d.id === targetId);
    const dr = drawings.find((d) => d.id === targetId);
    const wc = webcams.find((w) => w.id === targetId);

    if (!dev && !dr && !wc) return;

    let newKf: Keyframe;
    if (dev) {
      const resolved = resolveDeviceAtFrame(
        dev,
        existingTrack ? existingTrack.keyframes : [],
        currentFrame,
        durationInFrames
      );
      newKf = {
        id: `kf-${targetId}-${currentFrame}`,
        frame: currentFrame,
        easing,
        properties: {
          x: Math.round(resolved.x),
          y: Math.round(resolved.y),
          scaleX: Number(resolved.scaleX.toFixed(3)),
          scaleY: Number(resolved.scaleY.toFixed(3)),
          rotation: Math.round(resolved.rotation),
          opacity: Number(resolved.opacity.toFixed(2)),
          cornerRadius: resolved.customOuterRadius,
          glowBlur: Math.round(resolved.effects.glowBlur),
          glowIntensity: Number(resolved.effects.glowIntensity.toFixed(2)),
          glowColor: resolved.effects.glowColor,
          shadowBlur: Math.round(resolved.effects.shadowBlur),
          shadowOpacity: Number(resolved.effects.shadowOpacity.toFixed(2)),
          materialColor: resolved.customFrameColor,
          rotation3DX: Math.round(resolved.rotation3DX),
          rotation3DY: Math.round(resolved.rotation3DY),
          rotation3DZ: Math.round(resolved.rotation3DZ),
        },
      };
    } else if (wc) {
      const resolvedWc = resolveWebcamAtFrame(
        wc,
        existingTrack ? existingTrack.keyframes : [],
        currentFrame,
        durationInFrames
      );
      newKf = {
        id: `kf-${targetId}-${currentFrame}`,
        frame: currentFrame,
        easing,
        properties: {
          x: Math.round(resolvedWc.x),
          y: Math.round(resolvedWc.y),
          width: Math.round(resolvedWc.width),
          height: Math.round(resolvedWc.height),
          scaleX: Number(resolvedWc.scaleX.toFixed(3)),
          scaleY: Number(resolvedWc.scaleY.toFixed(3)),
          rotation: Math.round(resolvedWc.rotation),
          opacity: Number(resolvedWc.opacity.toFixed(2)),
          cornerRadius: Math.round(resolvedWc.cornerRadius),
          strokeWidth: resolvedWc.borderWidth,
          strokeColor: resolvedWc.borderColor,
          borderOpacity: Number(resolvedWc.borderOpacity.toFixed(2)),
          glowBlur: Math.round(resolvedWc.glowRadius),
          glowIntensity: Number(resolvedWc.glowIntensity.toFixed(2)),
          glowColor: resolvedWc.glowColor,
          cropZoom: Number(resolvedWc.zoom.toFixed(2)),
          panX: Math.round(resolvedWc.panX),
          panY: Math.round(resolvedWc.panY),
          borderProgress: Number(resolvedWc.borderAnimationProgress.toFixed(2)),
          curveIntensity: Math.round(resolvedWc.curveIntensity),
        },
      };
    } else {
      const resolvedDr = resolveDrawingAtFrame(
        dr!,
        existingTrack ? existingTrack.keyframes : [],
        currentFrame
      );
      newKf = {
        id: `kf-${targetId}-${currentFrame}`,
        frame: currentFrame,
        easing,
        properties: {
          x: Math.round(resolvedDr.x),
          y: Math.round(resolvedDr.y),
          scaleX: Number(resolvedDr.scaleX.toFixed(3)),
          scaleY: Number(resolvedDr.scaleY.toFixed(3)),
          rotation: Math.round(resolvedDr.rotation),
          opacity: Number(resolvedDr.opacity.toFixed(2)),
          cornerRadius: resolvedDr.cornerRadius,
          strokeWidth: resolvedDr.strokeWidth,
          strokeColor: resolvedDr.strokeColor,
          glowBlur: Math.round(resolvedDr.glowRadius),
          glowIntensity: Number(resolvedDr.glowIntensity.toFixed(2)),
          glowColor: resolvedDr.glowColor,
        },
      };
    }

    set((s) => {
      const track = s.tracks.find((t) => t.targetId === targetId);
      if (!track) {
        const trackId = `track-${targetId}`;
        return {
          tracks: [
            ...s.tracks,
            {
              id: trackId,
              targetId,
              label: dev ? dev.name : wc ? wc.name : dr!.name,
              type: dev ? 'device' : wc ? 'webcam' : 'drawing',
              visible: true,
              locked: false,
              keyframes: [newKf],
            },
          ],
          selectedKeyframe: { trackId, keyframeId: newKf.id },
          lastTimelineNotice: `Added keyframe at F${currentFrame}`,
        };
      }
      // Prevent duplicate keyframes at the exact same frame
      const filtered = track.keyframes.filter((k) => k.frame !== currentFrame);
      const nextKfs = [...filtered, newKf].sort((a, b) => a.frame - b.frame);
      return {
        tracks: s.tracks.map((t) =>
          t.id === track.id ? { ...t, keyframes: nextKfs } : t
        ),
        selectedKeyframe: {
          trackId: track.id,
          keyframeId: newKf.id,
        },
        lastTimelineNotice: `Saved keyframe at F${currentFrame} (${easing})`,
      };
    });
    get().pushHistory();
  },

  moveKeyframe: (trackId, keyframeId, newFrame) => {
    const { durationInFrames } = get();
    const clamped = Math.max(
      0,
      Math.min(durationInFrames - 1, Math.round(newFrame))
    );
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        // Prevent colliding with another keyframe on the same frame
        const withoutCollisions = t.keyframes.filter(
          (k) => k.id === keyframeId || k.frame !== clamped
        );
        return {
          ...t,
          keyframes: withoutCollisions
            .map((k) => (k.id === keyframeId ? { ...k, frame: clamped } : k))
            .sort((a, b) => a.frame - b.frame),
        };
      }),
    }));
  },

  duplicateKeyframe: (trackId, keyframeId) => {
    const state = get();
    const tr = state.tracks.find((t) => t.id === trackId);
    const kf = tr?.keyframes.find((k) => k.id === keyframeId);
    if (!tr || !kf) return;
    const nextFrame = Math.min(state.durationInFrames - 1, kf.frame + 15);
    const copy: Keyframe = {
      ...JSON.parse(JSON.stringify(kf)),
      id: `kf-dup-${Date.now().toString(36)}`,
      frame: nextFrame,
    };
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              keyframes: [
                ...t.keyframes.filter((k) => k.frame !== nextFrame),
                copy,
              ].sort((a, b) => a.frame - b.frame),
            }
          : t
      ),
      selectedKeyframe: { trackId, keyframeId: copy.id },
      lastTimelineNotice: `Duplicated keyframe to F${nextFrame}`,
    }));
    get().pushHistory();
  },

  copyKeyframe: (trackId, keyframeId) => {
    const tr = get().tracks.find((t) => t.id === trackId);
    const kf = tr?.keyframes.find((k) => k.id === keyframeId);
    if (kf) {
      set({
        copiedKeyframe: JSON.parse(JSON.stringify(kf)),
        lastTimelineNotice: `Copied keyframe from F${kf.frame}`,
      });
    }
  },

  pasteKeyframeAtPlayhead: (trackId) => {
    const { copiedKeyframe, currentFrame } = get();
    if (!copiedKeyframe) return;
    const pasted: Keyframe = {
      ...JSON.parse(JSON.stringify(copiedKeyframe)),
      id: `kf-paste-${Date.now().toString(36)}`,
      frame: currentFrame,
    };
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              keyframes: [
                ...t.keyframes.filter((k) => k.frame !== currentFrame),
                pasted,
              ].sort((a, b) => a.frame - b.frame),
            }
          : t
      ),
      selectedKeyframe: { trackId, keyframeId: pasted.id },
      lastTimelineNotice: `Pasted keyframe at F${currentFrame}`,
    }));
    get().pushHistory();
  },

  deleteKeyframe: (trackId, keyframeId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== keyframeId) }
          : t
      ),
      selectedKeyframe: null,
      lastTimelineNotice: 'Deleted keyframe',
    }));
    get().pushHistory();
  },

  updateKeyframeEasing: (trackId, keyframeId, easing) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              keyframes: t.keyframes.map((k) =>
                k.id === keyframeId ? { ...k, easing } : k
              ),
            }
          : t
      ),
      lastTimelineNotice: `Updated keyframe easing to ${easing}`,
    }));
    get().pushHistory();
  },

  applyAnimationPresetToDevice: (deviceId, presetId) => {
    const state = get();
    const dev = state.devices.find((d) => d.id === deviceId);
    if (!dev) return;

    const kfs = generateKeyframesForPreset(
      presetId,
      dev,
      state.durationInFrames
    );

    set((s) => {
      const updatedDevices = s.devices.map((d) => {
        if (d.id !== deviceId) return d;
        if (presetId === 'neon-border-sweep') {
          return {
            ...d,
            effects: {
              ...d.effects,
              glowEnabled: true,
              animatedGlow: true,
              glowAnimationMode: 'perimeter-sweep' as const,
            },
          };
        }
        if (presetId === 'glow-pulse') {
          return {
            ...d,
            effects: {
              ...d.effects,
              glowEnabled: true,
              animatedGlow: true,
              glowAnimationMode: 'pulse' as const,
            },
          };
        }
        return d;
      });

      const existingTrack = s.tracks.find((t) => t.targetId === deviceId);
      const updatedTracks = existingTrack
        ? s.tracks.map((t) =>
            t.id === existingTrack.id ? { ...t, keyframes: kfs } : t
          )
        : [
            ...s.tracks,
            {
              id: `track-${deviceId}`,
              targetId: deviceId,
              label: dev.name,
              type: 'device' as const,
              visible: true,
              locked: false,
              keyframes: kfs,
            },
          ];

      return {
        devices: updatedDevices,
        tracks: updatedTracks,
        currentFrame: 0,
      };
    });
    get().pushHistory();
  },

  applySceneTemplate: (templateId) => {
    if (templateId === 'flagship-duo') {
      const duo = createInitialSceneData();
      set({
        projectName: 'Flagship Ecosystem Launch',
        devices: duo.devices,
        drawings: [],
        clips: duo.clips,
        tracks: duo.tracks,
        selectedIds: [duo.devices[0].id],
        background: { ...BACKGROUND_PRESETS[0].background },
        currentFrame: 0,
      });
    } else if (templateId === 'triple-phones') {
      const p1 = getDevicePresetById('iphone-16-pro');
      const p2 = getDevicePresetById('pixel-9-pro');
      const p3 = getDevicePresetById('galaxy-s24-ultra');
      const devs: SceneDeviceObject[] = [
        {
          id: 'dev-tri-1',
          name: 'Pixel 9 Pro Left',
          presetId: p2.id,
          x: 560,
          y: 560,
          width: p2.width,
          height: p2.height,
          scaleX: 0.86,
          scaleY: 0.86,
          rotation: -8,
          rotation3DX: 4,
          rotation3DY: 24,
          rotation3DZ: 4,
          pos3DX: -2.8,
          pos3DY: 0,
          pos3DZ: -0.4,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 1,
          mediaId: 'proc-ecommerce-app',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          finishStyle: 'brushed',
          effects: {
            ...DEFAULT_OBJECT_EFFECTS,
            glowEnabled: true,
            glowColor: '#A855F7',
          },
        },
        {
          id: 'dev-tri-2',
          name: 'iPhone 16 Pro Center',
          presetId: p1.id,
          x: 960,
          y: 520,
          width: p1.width,
          height: p1.height,
          scaleX: 0.98,
          scaleY: 0.98,
          rotation: 0,
          rotation3DX: 0,
          rotation3DY: 0,
          rotation3DZ: 0,
          pos3DX: 0,
          pos3DY: 0.15,
          pos3DZ: 0.6,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 3,
          mediaId: 'proc-fintech-mobile',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          finishStyle: 'polished',
          effects: {
            ...DEFAULT_OBJECT_EFFECTS,
            glowEnabled: true,
            glowColor: '#22D3EE',
            glowBlur: 54,
            glowIntensity: 0.9,
            animatedGlow: true,
            glowAnimationMode: 'perimeter-sweep',
          },
        },
        {
          id: 'dev-tri-3',
          name: 'Galaxy S24 Ultra Right',
          presetId: p3.id,
          x: 1360,
          y: 560,
          width: p3.width,
          height: p3.height,
          scaleX: 0.86,
          scaleY: 0.86,
          rotation: 8,
          rotation3DX: 4,
          rotation3DY: -24,
          rotation3DZ: -4,
          pos3DX: 2.8,
          pos3DY: 0,
          pos3DZ: -0.4,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 2,
          mediaId: 'proc-fintech-mobile',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          finishStyle: 'brushed',
          effects: {
            ...DEFAULT_OBJECT_EFFECTS,
            glowEnabled: true,
            glowColor: '#3B82F6',
          },
        },
      ];
      set({
        projectName: 'Triple Flagship Smartphone Lineup',
        devices: devs,
        drawings: [],
        tracks: devs.map((d) => ({
          id: `track-${d.id}`,
          targetId: d.id,
          label: d.name,
          type: 'device',
          visible: true,
          locked: false,
          keyframes: [
            {
              id: `kf-${d.id}-0`,
              frame: 0,
              easing: 'ease-in-out',
              properties: {
                x: d.x,
                y: d.y,
                scaleX: d.scaleX,
                scaleY: d.scaleY,
                rotation: d.rotation,
                opacity: 1,
                glowBlur: d.effects.glowBlur,
                glowIntensity: d.effects.glowIntensity,
                glowColor: d.effects.glowColor,
                rotation3DX: d.rotation3DX,
                rotation3DY: d.rotation3DY,
                rotation3DZ: d.rotation3DZ,
              },
            },
          ],
        })),
        selectedIds: ['dev-tri-2'],
        background: { ...BACKGROUND_PRESETS[1].background },
        currentFrame: 0,
      });
    } else if (templateId === 'web-saas-launch') {
      const arc = getDevicePresetById('arc-minimal-browser');
      const ipad = getDevicePresetById('ipad-pro-13-m4');
      const devs: SceneDeviceObject[] = [
        {
          id: 'dev-web-1',
          name: 'Arc Studio Browser',
          presetId: arc.id,
          x: 820,
          y: 500,
          width: arc.width,
          height: arc.height,
          scaleX: 1.05,
          scaleY: 1.05,
          rotation: 0,
          rotation3DX: 5,
          rotation3DY: -12,
          rotation3DZ: 0,
          pos3DX: -1.1,
          pos3DY: 0.1,
          pos3DZ: -0.3,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 1,
          mediaId: 'proc-code-terminal',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          browserTheme: { ...DEFAULT_BROWSER_THEME },
          effects: {
            ...DEFAULT_OBJECT_EFFECTS,
            glowEnabled: true,
            glowColor: '#38BDF8',
            glowBlur: 48,
            glowIntensity: 0.75,
          },
        },
        {
          id: 'dev-web-2',
          name: 'iPad Pro 13" M4',
          presetId: ipad.id,
          x: 1320,
          y: 620,
          width: ipad.width,
          height: ipad.height,
          scaleX: 0.78,
          scaleY: 0.78,
          rotation: -3,
          rotation3DX: 8,
          rotation3DY: -24,
          rotation3DZ: -2,
          pos3DX: 2.2,
          pos3DY: -0.35,
          pos3DZ: 0.8,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 2,
          mediaId: 'proc-daw-desktop',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          effects: { ...DEFAULT_OBJECT_EFFECTS },
        },
      ];
      set({
        projectName: 'Developer Cloud & Tablet Suite',
        devices: devs,
        drawings: [],
        tracks: devs.map((d) => ({
          id: `track-${d.id}`,
          targetId: d.id,
          label: d.name,
          type: 'device',
          visible: true,
          locked: false,
          keyframes: [
            {
              id: `kf-${d.id}-0`,
              frame: 0,
              easing: 'ease-in-out',
              properties: {
                x: d.x,
                y: d.y,
                scaleX: d.scaleX,
                scaleY: d.scaleY,
                rotation: d.rotation,
                opacity: 1,
                rotation3DX: d.rotation3DX,
                rotation3DY: d.rotation3DY,
                rotation3DZ: d.rotation3DZ,
              },
            },
          ],
        })),
        selectedIds: ['dev-web-1'],
        background: { ...BACKGROUND_PRESETS[3].background },
        currentFrame: 0,
      });
    } else if (templateId === 'wearable-gaming') {
      const deck = getDevicePresetById('steam-deck-oled');
      const watch = getDevicePresetById('apple-watch-ultra-2');
      const devs: SceneDeviceObject[] = [
        {
          id: 'dev-wg-1',
          name: 'Steam Deck OLED',
          presetId: deck.id,
          x: 840,
          y: 540,
          width: deck.width,
          height: deck.height,
          scaleX: 1.05,
          scaleY: 1.05,
          rotation: -2,
          rotation3DX: 6,
          rotation3DY: -15,
          rotation3DZ: 0,
          pos3DX: -1.0,
          pos3DY: 0,
          pos3DZ: 0,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 1,
          mediaId: 'proc-daw-desktop',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          effects: {
            ...DEFAULT_OBJECT_EFFECTS,
            glowEnabled: true,
            glowColor: '#F97316',
            glowBlur: 48,
            glowIntensity: 0.75,
          },
        },
        {
          id: 'dev-wg-2',
          name: 'Apple Watch Ultra 2',
          presetId: watch.id,
          x: 1380,
          y: 560,
          width: watch.width,
          height: watch.height,
          scaleX: 1.05,
          scaleY: 1.05,
          rotation: 4,
          rotation3DX: 4,
          rotation3DY: -25,
          rotation3DZ: 2,
          pos3DX: 2.5,
          pos3DY: 0.1,
          pos3DZ: 0.9,
          opacity: 1,
          visible: true,
          locked: false,
          groupId: null,
          zIndex: 2,
          mediaId: 'proc-weather-spatial',
          screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
          effects: { ...DEFAULT_OBJECT_EFFECTS },
        },
      ];
      set({
        projectName: 'Handheld & Telemetry Hardware',
        devices: devs,
        drawings: [],
        tracks: devs.map((d) => ({
          id: `track-${d.id}`,
          targetId: d.id,
          label: d.name,
          type: 'device',
          visible: true,
          locked: false,
          keyframes: [
            {
              id: `kf-${d.id}-0`,
              frame: 0,
              easing: 'ease-in-out',
              properties: {
                x: d.x,
                y: d.y,
                scaleX: d.scaleX,
                scaleY: d.scaleY,
                rotation: d.rotation,
                opacity: 1,
                rotation3DX: d.rotation3DX,
                rotation3DY: d.rotation3DY,
                rotation3DZ: d.rotation3DZ,
              },
            },
          ],
        })),
        selectedIds: ['dev-wg-1'],
        background: { ...BACKGROUND_PRESETS[4].background },
        currentFrame: 0,
      });
    }
    get().pushHistory();
  },

  newProject: () => {
    const iphone = getDevicePresetById('iphone-16-pro');
    const id = `proj-${Date.now().toString(36)}`;
    const devId = `dev-${Date.now().toString(36)}`;
    const dev: SceneDeviceObject = {
      id: devId,
      name: 'iPhone 16 Pro',
      presetId: iphone.id,
      x: 960,
      y: 540,
      width: iphone.width,
      height: iphone.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      rotation3DX: 0,
      rotation3DY: -15,
      rotation3DZ: 0,
      pos3DX: 0,
      pos3DY: 0,
      pos3DZ: 0,
      opacity: 1,
      visible: true,
      locked: false,
      groupId: null,
      zIndex: 1,
      mediaId: 'proc-fintech-mobile',
      screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
      finishStyle: 'polished',
      browserTheme: { ...DEFAULT_BROWSER_THEME },
      effects: { ...DEFAULT_OBJECT_EFFECTS },
    };
    const track: TimelineTrack = {
      id: `track-${devId}`,
      targetId: devId,
      label: dev.name,
      type: 'device',
      visible: true,
      locked: false,
      keyframes: [
        {
          id: `kf-${devId}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            x: dev.x,
            y: dev.y,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            glowBlur: dev.effects.glowBlur,
            glowIntensity: dev.effects.glowIntensity,
            glowColor: dev.effects.glowColor,
            rotation3DX: 0,
            rotation3DY: -15,
            rotation3DZ: 0,
          },
        },
      ],
    };

    set({
      projectId: id,
      projectName: 'Untitled Studio Project',
      projectVersion: 2,
      devices: [dev],
      drawings: [],
      clips: [
        {
          id: `clip-${Date.now().toString(36)}`,
          mediaId: 'proc-fintech-mobile',
          name: 'Apex Ledger — Live Mobile Feed',
          mediaType: 'procedural',
          trackId: 'media-track-1',
          startFrame: 0,
          durationFrames: 180,
          trimStartFrames: 0,
          muted: false,
          locked: false,
          visible: true,
          waveformPeaks: generateWaveformPeaks('proc-fintech-mobile', 40),
        },
      ],
      tracks: [track],
      selectedIds: [devId],
      selectedDrawingId: null,
      selectedClipId: null,
      currentFrame: 0,
      isPlaying: false,
    });
    get().pushHistory();
  },

  saveCurrentProject: async () => {
    const state = get();
    const doc: ProjectDocument = {
      version: state.projectVersion,
      id: state.projectId,
      name: state.projectName,
      updatedAt: Date.now(),
      createdAt: state.lastSavedAt ?? Date.now(),
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      aspectRatio: state.aspectRatio,
      fps: state.fps,
      durationInFrames: state.durationInFrames,
      devices: state.devices,
      drawings: state.drawings,
      webcams: state.webcams,
      mediaAssets: state.mediaAssets,
      clips: state.clips,
      tracks: state.tracks,
      background: state.background,
      studio3D: state.studio3D,
      customThemes: state.customThemes,
      customWebcamShapes: state.customWebcamShapes,
    };
    await saveProjectToDb(doc);
    set({
      lastSavedAt: doc.updatedAt,
      projectVersion: state.projectVersion + 1,
    });
    return doc;
  },

  loadProjectDocument: (doc) => {
    const currentMediaIds = new Set(get().mediaAssets.map((m) => m.id));
    const validatedAssets: MediaAsset[] = (doc.mediaAssets || []).map(
      (asset) => {
        if (asset.type === 'procedural') return { ...asset, missing: false };
        if (asset.url.startsWith('blob:') && !currentMediaIds.has(asset.id)) {
          return { ...asset, missing: true };
        }
        return asset;
      }
    );

    for (const proc of BUILTIN_PROCEDURAL_MEDIA) {
      if (!validatedAssets.some((a) => a.id === proc.id)) {
        validatedAssets.push(proc);
      }
    }

    // Migrate v1 projects safely so new fields have defaults
    const migratedDevices = (doc.devices || []).map((d) => ({
      ...d,
      finishStyle: d.finishStyle || 'brushed',
      browserTheme: { ...DEFAULT_BROWSER_THEME, ...(d.browserTheme || {}) },
      effects: { ...DEFAULT_OBJECT_EFFECTS, ...(d.effects || {}) },
    }));

    set({
      projectId: doc.id,
      projectName: doc.name,
      projectVersion: (doc.version || 1) + 1,
      lastSavedAt: doc.updatedAt,
      canvasWidth: doc.canvasWidth || 1920,
      canvasHeight: doc.canvasHeight || 1080,
      aspectRatio: doc.aspectRatio || '16:9',
      fps: doc.fps || 30,
      durationInFrames: doc.durationInFrames || 180,
      devices: migratedDevices,
      drawings: doc.drawings || [],
      webcams: doc.webcams || [],
      mediaAssets: validatedAssets,
      clips: doc.clips || initialScene.clips,
      tracks: doc.tracks || [],
      background: doc.background || initialBackground,
      studio3D: doc.studio3D || initialStudio3D,
      customThemes: doc.customThemes || [],
      customWebcamShapes: doc.customWebcamShapes || [],
      selectedIds: migratedDevices[0] ? [migratedDevices[0].id] : [],
      selectedDrawingId: null,
      selectedWebcamId: null,
      selectedClipId: null,
      currentFrame: 0,
      isPlaying: false,
    });
    get().pushHistory();
  },

  duplicateCurrentProject: async () => {
    const state = get();
    const newId = `proj-${Date.now().toString(36)}`;
    const newName = `${state.projectName} (Copy)`;
    set({
      projectId: newId,
      projectName: newName,
      projectVersion: 2,
    });
    return await get().saveCurrentProject();
  },

  exportProjectJsonString: () => {
    const state = get();
    const doc: ProjectDocument = {
      version: state.projectVersion,
      id: state.projectId,
      name: state.projectName,
      updatedAt: Date.now(),
      createdAt: state.lastSavedAt ?? Date.now(),
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      aspectRatio: state.aspectRatio,
      fps: state.fps,
      durationInFrames: state.durationInFrames,
      devices: state.devices,
      drawings: state.drawings,
      webcams: state.webcams,
      mediaAssets: state.mediaAssets,
      clips: state.clips,
      tracks: state.tracks,
      background: state.background,
      studio3D: state.studio3D,
      customThemes: state.customThemes,
      customWebcamShapes: state.customWebcamShapes,
    };
    return JSON.stringify(doc, null, 2);
  },
}));
