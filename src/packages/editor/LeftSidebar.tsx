import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  Film,
  FlipHorizontal,
  Group,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  Monitor,
  MousePointer,
  Move,
  Palette,
  PenTool,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  SwatchBook,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import {
  BACKGROUND_PRESETS,
  DEFAULT_WEBCAM_BEZIER_POINTS,
  DEVICE_CATALOG,
  DEVICE_CATEGORIES,
  DEVICE_FRAME_SWATCHES,
  GLOBAL_THEME_PALETTES,
  WEBCAM_PIP_PRESETS,
  WEBCAM_SHAPE_LIBRARY,
  WEBCAM_STYLE_PRESETS,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import {
  captureWebcamStillAsset,
  createMediaAssetFromFile,
  startLiveWebcamStream,
  startWebcamClipRecording,
  stopLiveWebcamStream,
  stopWebcamClipRecording,
} from '../media/proceduralMedia.ts';
import {
  computeWebcamShapeGeometry,
  hexToHsl,
  hexToRgb,
  hslToHex,
  rgbToHex,
} from '../scene-engine/math.ts';
import { useStudioStore, type LeftSidebarTab } from '../scene-engine/store.ts';
import type {
  BackgroundBlendMode,
  BackgroundLayerKind,
  DeviceCategory,
  DeviceFinishStyle,
  DrawableToolType,
  DrawingAnimationMode,
  DrawingToolType,
  SceneDrawingObject,
  WebcamFrameShapeType,
} from '../shared/types.ts';

const CUSTOM_SVG_PRESETS: { name: string; path: string }[] = [
  {
    name: 'Crest Shield',
    path: 'M 0 -100 L 85 -65 L 85 15 L 0 100 L -85 15 L -85 -65 Z',
  },
  {
    name: 'Octa Badge',
    path: 'M -45 -100 L 45 -100 L 100 -45 L 100 45 L 45 100 L -45 100 L -100 45 L -100 -45 Z',
  },
  {
    name: 'Cinema Ticket',
    path: 'M -100 -75 L 100 -75 L 100 -20 L 82 0 L 100 20 L 100 75 L -100 75 L -100 20 L -82 0 L -100 -20 Z',
  },
  {
    name: 'Hex Gem',
    path: 'M 0 -100 L 92 -50 L 92 50 L 0 100 L -92 50 L -92 -50 Z',
  },
];

/**
 * Generates an SVG polygon/path string for previewing a webcam shape in the thumbnail grid.
 */
function getShapePreviewPoints(shapeId: WebcamFrameShapeType): string {
  const dummyWebcam: any = {
    id: 'preview',
    width: 64,
    height: 48,
    shape: shapeId,
    cornerRadius: 12,
    curveIntensity: 55,
    curveTension: 0.65,
    asymmetry: 25,
    bezierPoints: DEFAULT_WEBCAM_BEZIER_POINTS,
  };
  const geom = computeWebcamShapeGeometry(dummyWebcam, 0);
  if (!geom.contourPoints.length) return '';
  return geom.contourPoints
    .map((pt) => `${(pt.x + 36).toFixed(1)},${(pt.y + 28).toFixed(1)}`)
    .join(' ');
}

export const LeftSidebar: React.FC = () => {
  const {
    leftTab,
    setLeftTab,
    addDevice,
    devices,
    drawings,
    webcams,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    selectedBackgroundLayerId,
    selectDevice,
    selectDrawing,
    selectWebcam,
    selectBackgroundLayer,
    updateDevice,
    updateDeviceEffects,
    updateDeviceBrowserTheme,
    reorderDeviceLayer,
    reorderSceneLayer,
    groupSelectedDevices,
    ungroupSelectedDevices,
    applyDeviceSwatch,
    applyThemePalette,
    saveCustomThemePalette,
    customThemes,
    activeDrawingTool,
    setActiveDrawingTool,
    drawingDefaults,
    updateDrawingDefaults,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    duplicateDrawing,
    createGlowingHaloAroundDevice,
    addWebcamOverlay,
    updateWebcam,
    deleteWebcam,
    duplicateWebcam,
    applyWebcamStylePreset,
    applyWebcamPiPPreset,
    applyWebcamShowcaseAnimation,
    saveCustomWebcamShape,
    applyCustomWebcamShape,
    customWebcamShapes,
    liveCameraActive,
    liveCameraError,
    availableCameraDevices,
    setLiveCameraStatus,
    mediaAssets,
    addMediaAsset,
    addLongDemoVideo,
    removeMediaAsset,
    assignMediaToDevice,
    addClipFromMedia,
    background,
    updateBackground,
    applyBackgroundPreset,
    addBackgroundLayer,
    updateBackgroundLayer,
    removeBackgroundLayer,
    duplicateBackgroundLayer,
    reorderBackgroundLayer,
    applySceneTemplate,
    setEditorMode,
    canvasWidth,
    canvasHeight,
    durationInFrames,
  } = useStudioStore();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<DeviceCategory | 'all'>(
    'all'
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [themeScope, setThemeScope] = useState<'selected' | 'group' | 'all'>(
    'selected'
  );
  const [customThemeName, setCustomThemeName] = useState('');
  const [swatchCategoryFilter, setSwatchCategoryFilter] = useState<
    'all' | 'Apple' | 'Material' | 'Neon' | 'Pastel' | 'Dark' | 'Metallic'
  >('all');

  // Webcam Studio local state
  const [webcamShapeSearch, setWebcamShapeSearch] = useState('');
  const [webcamShapeCat, setWebcamShapeCat] = useState<
    'all' | 'basic' | 'creative' | 'decorative'
  >('all');
  const [isStartingCam, setIsStartingCam] = useState(false);
  const [isRecordingWebcam, setIsRecordingWebcam] = useState(false);
  const [customShapeName, setCustomShapeName] = useState('');

  // Draw Studio local state
  const [annotationText, setAnnotationText] = useState('New Feature Highlight');
  const [openDrawSection, setOpenDrawSection] = useState<string>('all');

  // Layers panel scene templates toggle
  const [showSceneTemplatesInLayers, setShowSceneTemplatesInLayers] =
    useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  const selectedDevice =
    devices.find((d) => selectedIds.includes(d.id)) || devices[0] || null;
  const selectedDrawing =
    drawings.find((dr) => dr.id === selectedDrawingId) || null;
  const selectedWebcam =
    webcams.find((wc) => wc.id === selectedWebcamId) || webcams[0] || null;

  const activeHexColor = selectedDevice?.customFrameColor || '#2563EB';
  const activeRgb = useMemo(() => hexToRgb(activeHexColor), [activeHexColor]);
  const activeHsl = useMemo(() => hexToHsl(activeHexColor), [activeHexColor]);

  const applyCustomHexToTarget = (hex: string) => {
    if (!selectedDevice) return;
    if (themeScope === 'all') {
      devices.forEach((d) => updateDevice(d.id, { customFrameColor: hex }));
    } else if (themeScope === 'group' && selectedDevice.groupId) {
      devices
        .filter((d) => d.groupId === selectedDevice.groupId)
        .forEach((d) => updateDevice(d.id, { customFrameColor: hex }));
    } else {
      updateDevice(selectedDevice.id, { customFrameColor: hex });
    }
  };

  // Webcam handlers
  const handleToggleLiveWebcam = async () => {
    if (liveCameraActive) {
      stopLiveWebcamStream();
      setLiveCameraStatus(false, null);
      return;
    }
    setIsStartingCam(true);
    const res = await startLiveWebcamStream({
      deviceId: selectedWebcam?.cameraDeviceId || undefined,
      resolution: selectedWebcam?.cameraResolution || '1080p',
      fps: selectedWebcam?.cameraFps || 30,
    });
    setIsStartingCam(false);
    setLiveCameraStatus(res.ok, res.errorMessage || null, res.devices);
    if (res.ok && webcams.length === 0) {
      addWebcamOverlay('circle', 'neon-circular');
    }
  };

  const handleSwitchCameraDevice = async (deviceId: string) => {
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, { cameraDeviceId: deviceId });
    }
    if (liveCameraActive) {
      const res = await startLiveWebcamStream({
        deviceId,
        resolution: selectedWebcam?.cameraResolution || '1080p',
        fps: selectedWebcam?.cameraFps || 30,
      });
      setLiveCameraStatus(res.ok, res.errorMessage || null, res.devices);
    }
  };

  const handleCaptureStill = () => {
    const stillAsset = captureWebcamStillAsset();
    if (!stillAsset) return;
    addMediaAsset(stillAsset, true);
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, {
        mediaId: stillAsset.id,
        useLiveCamera: false,
      });
    }
  };

  const handleToggleRecordWebcam = async () => {
    if (isRecordingWebcam) {
      setIsRecordingWebcam(false);
      const recordedAsset = await stopWebcamClipRecording();
      if (recordedAsset) {
        addMediaAsset(recordedAsset, true);
        if (selectedWebcam) {
          updateWebcam(selectedWebcam.id, {
            mediaId: recordedAsset.id,
            useLiveCamera: false,
          });
        }
      }
      return;
    }
    const res = startWebcamClipRecording();
    if (res.ok) {
      setIsRecordingWebcam(true);
    } else {
      setLiveCameraStatus(liveCameraActive, res.error || null);
    }
  };

  const handleSelectWebcamShape = (shapeId: WebcamFrameShapeType) => {
    setEditorMode('2d');
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, { shape: shapeId });
      selectWebcam(selectedWebcam.id);
    } else {
      addWebcamOverlay(shapeId, 'neon-circular');
    }
  };

  const filteredDevices = useMemo(() => {
    return DEVICE_CATALOG.filter((item) => {
      const matchesCat =
        activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [search, activeCategory]);

  // Quick-place helper for Draw Panel shapes/annotations so users can either drag on canvas OR click to place
  const handleQuickCreateDrawing = (tool: DrawableToolType, labelOverride?: string) => {
    setEditorMode('2d');
    setActiveDrawingTool(tool);
    const def = drawingDefaults;
    const id = `draw-${tool}-${Date.now().toString(36).slice(-4)}`;
    const isLineLike =
      tool === 'line' || tool === 'arrow' || tool === 'curved-arrow';
    const isFreehandLike =
      tool === 'brush' ||
      tool === 'pen' ||
      tool === 'bezier' ||
      tool === 'freehand' ||
      tool === 'highlight-stroke' ||
      tool === 'neon-path' ||
      tool === 'animated-stroke';

    const w =
      tool === 'text' || tool === 'callout-box'
        ? 340
        : tool === 'circle' || tool === 'pulse-ring' || tool === 'star' || tool === 'diamond'
          ? 220
          : 300;
    const h =
      tool === 'text'
        ? 90
        : tool === 'callout-box'
          ? 140
          : tool === 'circle' || tool === 'pulse-ring' || tool === 'star' || tool === 'diamond'
            ? 220
            : 190;

    const points = isLineLike
      ? [
          { x: -w / 2, y: h / 2 },
          { x: w / 2, y: -h / 2 },
        ]
      : isFreehandLike
        ? [
            { x: -130, y: 40 },
            { x: -45, y: -55 },
            { x: 45, y: 45 },
            { x: 130, y: -40 },
          ]
        : [];

    const newDrawing: SceneDrawingObject = {
      id,
      name: labelOverride || `${tool.replace('-', ' ').toUpperCase()} #${drawings.length + 1}`,
      tool,
      text:
        tool === 'text' || tool === 'callout-box'
          ? annotationText || 'Feature Callout'
          : undefined,
      fontSize: 28,
      points,
      x: canvasWidth / 2 + ((drawings.length % 4) - 1.5) * 40,
      y: canvasHeight / 2 + ((drawings.length % 3) - 1) * 35,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: drawings.length + 15,
      strokeColor: def.strokeColor,
      strokeColorEnd: def.strokeColorEnd,
      useGradientStroke: def.useGradientStroke,
      strokeWidth: tool === 'highlight-stroke' ? 12 : def.strokeWidth,
      strokeOpacity: tool === 'highlight-stroke' ? 0.42 : def.strokeOpacity,
      fillColor: def.fillColor,
      fillOpacity:
        tool === 'callout-box' || tool === 'text'
          ? Math.max(0.18, def.fillOpacity)
          : def.fillOpacity,
      lineCap: 'round',
      lineJoin: 'round',
      dashPattern: def.dashPattern,
      cornerRadius: 22,
      polygonSides: 6,
      glowEnabled: def.glowEnabled,
      glowColor: def.glowColor,
      glowRadius: def.glowRadius,
      glowIntensity: def.glowIntensity,
      glowSpread: def.glowSpread,
      shadowEnabled: true,
      shadowColor: '#0F172A',
      shadowBlur: 18,
      animationMode:
        tool === 'pulse-ring'
          ? 'pulsing-outline'
          : tool === 'neon-path' || tool === 'animated-stroke'
            ? 'neon-trace'
            : def.animationMode,
      animationDurationFrames: def.animationDurationFrames,
      animationSpeed: def.animationSpeed,
      animationEasing: def.animationEasing,
      startFrame: 0,
      durationFrames: durationInFrames,
    };
    addDrawing(newDrawing);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const asset = await createMediaAssetFromFile(files[i]);
        addMediaAsset(asset, true);
        if (selectedDevice && i === 0) {
          assignMediaToDevice(selectedDevice.id, asset.id);
        }
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to load media file'
      );
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Section 3: Clean Vertical Icon Rail with 7 Organized Categories (No Redundant Scenes Tab)
  const tabs: {
    id: LeftSidebarTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'webcam', label: 'Webcam', icon: Camera },
    { id: 'draw', label: 'Draw', icon: PenTool },
    { id: 'media', label: 'Media', icon: Film },
    { id: 'backgrounds', label: 'Background', icon: Palette },
    { id: 'themes', label: 'Themes', icon: SwatchBook },
    { id: 'layers', label: 'Layers', icon: Layers },
  ];

  // Ensure if leftTab was ever set to 'templates', it gracefully shows 'layers'
  const effectiveTab: LeftSidebarTab =
    leftTab === 'templates' ? 'layers' : leftTab;

  const bgLayers = background.layers || [];
  const selectedBgLayer =
    bgLayers.find((l) => l.id === selectedBackgroundLayerId) ||
    bgLayers[0] ||
    null;

  return (
    <aside className="w-[336px] bg-white border-r border-slate-200 flex shrink-0 select-none z-20">
      {/* Left Vertical Icon Rail */}
      <div className="w-16 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-3 gap-1.5 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = effectiveTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setLeftTab(t.id)}
              className={`w-12 py-2 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
                active
                  ? 'bg-blue-50 text-blue-600 border border-blue-200 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] tracking-tight leading-none">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Focused Content Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {/* 1. DEVICES TAB */}
        {effectiveTab === 'devices' && (
          <>
            <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Device Library
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">
                  {filteredDevices.length} models
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search iPhone, MacBook, Pixel..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeCategory === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  All
                </button>
                {DEVICE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeCategory === c.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredDevices.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addDevice(item.id)}
                  className="group p-2.5 rounded-lg bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex items-center gap-3 shadow-2xs"
                >
                  <div className="w-11 h-12 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 relative overflow-hidden">
                    <div
                      style={{
                        width:
                          item.width > item.height
                            ? '32px'
                            : `${Math.max(14, Math.round((item.width / item.height) * 32))}px`,
                        height:
                          item.height >= item.width
                            ? '32px'
                            : `${Math.max(14, Math.round((item.height / item.width) * 32))}px`,
                        borderColor: item.frameAccentColor,
                        backgroundColor: item.frameColor,
                        borderRadius: `${Math.max(2, Math.round(item.outerRadius / 10))}px`,
                      }}
                      className="border-2 shadow-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded bg-blue-50 text-blue-600 border border-blue-200">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{item.brand}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px]">
                        {item.width}×{item.height}
                      </span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-md bg-slate-100 group-hover:bg-blue-600 text-slate-500 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 2. WEBCAM OVERLAY STUDIO TAB (Section 5: Fixed Webcam Shape Selection) */}
        {effectiveTab === 'webcam' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Webcam Studio
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Camera overlays, vector shape masks & frames
                </p>
              </div>
              <button
                onClick={() => {
                  setEditorMode('2d');
                  addWebcamOverlay('circle', 'neon-circular');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Overlay</span>
              </button>
            </div>

            {/* Active Webcam Overlays Switcher */}
            {webcams.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  <span>Active Webcam Overlays ({webcams.length})</span>
                  {selectedWebcam && (
                    <span className="text-blue-600 font-mono text-[10px]">
                      {selectedWebcam.shape}
                    </span>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {webcams.map((wc) => {
                    const isSel = selectedWebcam?.id === wc.id;
                    return (
                      <div
                        key={wc.id}
                        onClick={() => {
                          setEditorMode('2d');
                          selectWebcam(wc.id);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-all ${
                          isSel
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{wc.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateWebcam(wc.id);
                            }}
                            title="Duplicate Webcam"
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWebcam(wc.id);
                            }}
                            title="Remove Webcam"
                            className="p-1 rounded hover:bg-rose-100 text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1. Live Camera Feed & Capture Controls */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-blue-600" />
                  Live Camera Input
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    liveCameraActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  {liveCameraActive ? 'LIVE' : 'STANDBY'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleToggleLiveWebcam}
                  disabled={isStartingCam}
                  className={`py-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    liveCameraActive
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-2xs'
                  }`}
                >
                  {liveCameraActive ? (
                    <>
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Disable Camera</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>
                        {isStartingCam ? 'Starting...' : 'Enable Camera'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (selectedWebcam) {
                      updateWebcam(selectedWebcam.id, {
                        mirrorHorizontal: !selectedWebcam.mirrorHorizontal,
                      });
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    selectedWebcam?.mirrorHorizontal
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Mirror Feed</span>
                </button>
              </div>

              {availableCameraDevices.length > 0 && (
                <select
                  value={selectedWebcam?.cameraDeviceId || ''}
                  onChange={(e) => handleSwitchCameraDevice(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {availableCameraDevices.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              )}

              {liveCameraActive && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={handleCaptureStill}
                    className="py-1.5 px-2 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3 text-blue-600" />
                    <span>Snapshot</span>
                  </button>
                  <button
                    onClick={handleToggleRecordWebcam}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 border ${
                      isRecordingWebcam
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <CircleDot className="w-3 h-3 text-rose-500" />
                    <span>
                      {isRecordingWebcam ? 'Stop Recording' : 'Record Clip'}
                    </span>
                  </button>
                </div>
              )}

              {liveCameraError && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                  {liveCameraError} — Using studio presenter feed fallback.
                </div>
              )}
            </div>

            {/* 2. Webcam Frame Shape Library with Vector Previews */}
            <div className="space-y-2.5 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800">
                  Webcam Frame Shapes
                </label>
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Click to Apply
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search circle, arch, hexagon, blob..."
                  value={webcamShapeSearch}
                  onChange={(e) => setWebcamShapeSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                {(['all', 'basic', 'creative', 'decorative'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => setWebcamShapeCat(cat)}
                      className={`py-1 rounded text-[10px] font-semibold capitalize transition-all ${
                        webcamShapeCat === cat
                          ? 'bg-white text-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-0.5">
                {WEBCAM_SHAPE_LIBRARY.filter((sh) => {
                  const matchCat =
                    webcamShapeCat === 'all' ||
                    sh.category.toLowerCase() === webcamShapeCat;
                  const matchSearch =
                    sh.name
                      .toLowerCase()
                      .includes(webcamShapeSearch.toLowerCase()) ||
                    sh.id
                      .toLowerCase()
                      .includes(webcamShapeSearch.toLowerCase());
                  return matchCat && matchSearch;
                }).map((sh) => {
                  const isSelected = selectedWebcam?.shape === sh.id;
                  const polyPoints = getShapePreviewPoints(sh.id);
                  return (
                    <button
                      key={sh.id}
                      onClick={() => handleSelectWebcamShape(sh.id)}
                      className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/15 font-semibold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <svg
                        viewBox="0 0 72 56"
                        className="w-12 h-9 overflow-visible"
                      >
                        <polygon
                          points={polyPoints}
                          fill={isSelected ? '#DBEAFE' : '#F1F5F9'}
                          stroke={isSelected ? '#2563EB' : '#475569'}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-[10px] leading-tight line-clamp-1">
                        {sh.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Shape Geometry Fine-Tuning (Radius, Curve Intensity, Custom SVG Path) */}
              {selectedWebcam && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>Shape Geometry Controls</span>
                    <span className="text-[10px] font-mono text-blue-600">
                      {selectedWebcam.shape}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                      <span>Corner Softness / Fillet</span>
                      <span className="font-mono">
                        {selectedWebcam.cornerRadius}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={selectedWebcam.cornerRadius}
                      onChange={(e) =>
                        updateWebcam(selectedWebcam.id, {
                          cornerRadius: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                      <span>Curve / Morph Intensity</span>
                      <span className="font-mono">
                        {selectedWebcam.curveIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedWebcam.curveIntensity}
                      onChange={(e) =>
                        updateWebcam(selectedWebcam.id, {
                          curveIntensity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {selectedWebcam.shape === 'custom-svg' && (
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block">
                        Custom SVG Path (M / L / Q / C / Z)
                      </label>
                      <input
                        type="text"
                        value={
                          selectedWebcam.customSvgPath ||
                          CUSTOM_SVG_PRESETS[0].path
                        }
                        onChange={(e) =>
                          updateWebcam(selectedWebcam.id, {
                            customSvgPath: e.target.value,
                          })
                        }
                        placeholder="M 0 -100 L 90 0 L 0 100 L -90 0 Z"
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex flex-wrap gap-1">
                        {CUSTOM_SVG_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() =>
                              updateWebcam(selectedWebcam.id, {
                                customSvgPath: preset.path,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[10px] font-medium text-slate-700"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save Custom Shape Preset */}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Save custom shape preset..."
                      value={customShapeName}
                      onChange={(e) => setCustomShapeName(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        saveCustomWebcamShape(
                          customShapeName || `Custom ${selectedWebcam.shape}`,
                          selectedWebcam.id
                        );
                        setCustomShapeName('');
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-medium shrink-0"
                    >
                      Save
                    </button>
                  </div>

                  {customWebcamShapes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {customWebcamShapes.map((cs) => (
                        <button
                          key={cs.id}
                          onClick={() =>
                            applyCustomWebcamShape(selectedWebcam.id, cs.id)
                          }
                          className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-medium"
                        >
                          {cs.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Decorative Frame Style Presets */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <label className="text-xs font-semibold text-slate-800 block">
                Decorative Frame Styles
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {WEBCAM_STYLE_PRESETS.map((st) => {
                  const isSel = selectedWebcam?.stylePreset === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() =>
                        applyWebcamStylePreset(
                          selectedWebcam?.id || '',
                          st.id
                        )
                      }
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-slate-300"
                          style={{
                            background: `linear-gradient(135deg, ${st.borderColor}, ${st.borderSecondaryColor})`,
                          }}
                        />
                        <span className="text-[11px] truncate">{st.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {st.badge}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Picture-in-Picture (PiP) Layout Presets */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800">
                  Screen + Webcam PiP Layouts
                </label>
                {selectedWebcam && (
                  <button
                    onClick={() =>
                      applyWebcamShowcaseAnimation(selectedWebcam.id)
                    }
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    + Animate 5 Keyframes
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {WEBCAM_PIP_PRESETS.map((pip) => (
                  <button
                    key={pip.id}
                    onClick={() => {
                      setEditorMode('2d');
                      applyWebcamPiPPreset(pip.id);
                    }}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer"
                  >
                    <div className="text-[11px] font-semibold text-slate-800 truncate">
                      {pip.name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {pip.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. DRAW & ANNOTATE STUDIO TAB (Section 4: Reorganised into 5 Clean Groups) */}
        {effectiveTab === 'draw' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Draw & Annotate
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Organised vector shapes, curves, callouts & neon paths
                </p>
              </div>
              {activeDrawingTool !== 'select' && (
                <button
                  onClick={() => setActiveDrawingTool('select')}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200"
                >
                  Done Drawing
                </button>
              )}
            </div>

            {/* Group 1: Selection & Transform */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <MousePointer className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Selection & Transform</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'select', label: 'Select' },
                    { id: 'multi-select', label: 'Multi-Select' },
                    { id: 'pan', label: 'Pan' },
                    { id: 'transform', label: 'Transform' },
                  ] as { id: DrawingToolType; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setEditorMode('2d');
                      setActiveDrawingTool(t.id);
                    }}
                    className={`py-1.5 px-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                      activeDrawingTool === t.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group 2: Shapes */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">
                  2. Geometric Shapes
                </span>
                <span className="text-[10px] text-slate-400">
                  Drag on canvas or +Place
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'rect', label: 'Rectangle' },
                    { id: 'rounded-rect', label: 'Rounded Rect' },
                    { id: 'circle', label: 'Circle' },
                    { id: 'ellipse', label: 'Ellipse' },
                    { id: 'line', label: 'Line' },
                    { id: 'arrow', label: 'Arrow' },
                    { id: 'polygon', label: 'Polygon' },
                    { id: 'star', label: 'Star' },
                    { id: 'triangle', label: 'Triangle' },
                    { id: 'diamond', label: 'Diamond' },
                  ] as { id: DrawableToolType; label: string }[]
                ).map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between rounded-md border px-2 py-1 text-[11px] transition-all ${
                      activeDrawingTool === t.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setEditorMode('2d');
                        setActiveDrawingTool(t.id);
                      }}
                      className="flex-1 text-left truncate cursor-pointer"
                    >
                      {t.label}
                    </button>
                    <button
                      onClick={() => handleQuickCreateDrawing(t.id)}
                      title={`Place ${t.label} onto Canvas`}
                      className="ml-1 p-0.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Group 3: Freehand & Curves */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 block">
                3. Freehand & Curves
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'brush', label: 'Brush' },
                    { id: 'pen', label: 'Pen' },
                    { id: 'bezier', label: 'Bezier Curve' },
                    { id: 'freehand', label: 'Freehand Path' },
                    { id: 'eraser', label: 'Eraser' },
                  ] as { id: DrawingToolType; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setEditorMode('2d');
                      setActiveDrawingTool(t.id);
                    }}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                      activeDrawingTool === t.id
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group 4: Annotations */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-blue-600" />
                <span>4. Annotations & Callouts</span>
              </span>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={annotationText}
                  onChange={(e) => {
                    setAnnotationText(e.target.value);
                    if (selectedDrawing) {
                      updateDrawing(selectedDrawing.id, {
                        text: e.target.value,
                      });
                    }
                  }}
                  placeholder="Label text for Text / Callout..."
                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'arrow', label: 'Callout Arrow' },
                    { id: 'curved-arrow', label: 'Curved Arrow' },
                    { id: 'text', label: 'Text Label' },
                    { id: 'callout-box', label: 'Callout Box' },
                    { id: 'highlight-stroke', label: 'Highlight Stroke' },
                  ] as { id: DrawableToolType; label: string }[]
                ).map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px] ${
                      activeDrawingTool === t.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setEditorMode('2d');
                        setActiveDrawingTool(t.id);
                      }}
                      className="flex-1 text-left truncate cursor-pointer"
                    >
                      {t.label}
                    </button>
                    <button
                      onClick={() =>
                        handleQuickCreateDrawing(t.id, annotationText)
                      }
                      title={`Insert ${t.label}`}
                      className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-semibold"
                    >
                      +Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Group 5: Animated Path & Glow Effects */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>5. Animated Path & Glow Effects</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'neon-path', label: 'Neon Path' },
                    { id: 'glow-outline', label: 'Glow Outline' },
                    { id: 'animated-stroke', label: 'Animated Stroke' },
                    { id: 'pulse-ring', label: 'Pulse Ring' },
                  ] as { id: DrawableToolType; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleQuickCreateDrawing(t.id)}
                    className="py-1.5 px-2.5 rounded-md bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left text-[11px] font-medium text-slate-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>{t.label}</span>
                    <Plus className="w-3 h-3 text-blue-600" />
                  </button>
                ))}
              </div>

              {selectedDevice && (
                <div className="pt-1 border-t border-slate-200 grid grid-cols-3 gap-1">
                  <button
                    onClick={() =>
                      createGlowingHaloAroundDevice(
                        selectedDevice.id,
                        'ellipse'
                      )
                    }
                    className="py-1 px-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700"
                  >
                    + Halo Ring
                  </button>
                  <button
                    onClick={() =>
                      createGlowingHaloAroundDevice(
                        selectedDevice.id,
                        'rounded-rect'
                      )
                    }
                    className="py-1 px-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700"
                  >
                    + Device Trace
                  </button>
                  <button
                    onClick={() =>
                      createGlowingHaloAroundDevice(selectedDevice.id, 'arrow')
                    }
                    className="py-1 px-1.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700"
                  >
                    + Device Arrow
                  </button>
                </div>
              )}
            </div>

            {/* Stroke, Glow & Motion Defaults */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-800">
                Stroke & Neon Glow Style
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                  <span>Stroke</span>
                  <input
                    type="color"
                    value={
                      selectedDrawing?.strokeColor ||
                      drawingDefaults.strokeColor
                    }
                    onChange={(e) => {
                      updateDrawingDefaults({
                        strokeColor: e.target.value,
                        glowColor: e.target.value,
                      });
                      if (selectedDrawing) {
                        updateDrawing(selectedDrawing.id, {
                          strokeColor: e.target.value,
                          glowColor: e.target.value,
                        });
                      }
                    }}
                    className="w-5 h-5 rounded cursor-pointer border-0"
                  />
                </label>
                <label className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                  <span>Glow</span>
                  <input
                    type="color"
                    value={
                      selectedDrawing?.glowColor || drawingDefaults.glowColor
                    }
                    onChange={(e) => {
                      updateDrawingDefaults({ glowColor: e.target.value });
                      if (selectedDrawing) {
                        updateDrawing(selectedDrawing.id, {
                          glowColor: e.target.value,
                        });
                      }
                    }}
                    className="w-5 h-5 rounded cursor-pointer border-0"
                  />
                </label>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>Stroke Thickness</span>
                  <span className="font-mono">
                    {selectedDrawing?.strokeWidth ??
                      drawingDefaults.strokeWidth}
                    px
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={28}
                  value={
                    selectedDrawing?.strokeWidth ?? drawingDefaults.strokeWidth
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateDrawingDefaults({ strokeWidth: v });
                    if (selectedDrawing) {
                      updateDrawing(selectedDrawing.id, { strokeWidth: v });
                    }
                  }}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>Path Animation Mode</span>
                </div>
                <select
                  value={
                    selectedDrawing?.animationMode ??
                    drawingDefaults.animationMode
                  }
                  onChange={(e) => {
                    const mode = e.target.value as DrawingAnimationMode;
                    updateDrawingDefaults({ animationMode: mode });
                    if (selectedDrawing) {
                      updateDrawing(selectedDrawing.id, {
                        animationMode: mode,
                      });
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800"
                >
                  <option value="neon-trace">Travelling Neon Trace</option>
                  <option value="draw-on">Draw-On Path Reveal</option>
                  <option value="stroke-reveal">Looping Stroke Reveal</option>
                  <option value="pulsing-outline">Pulsing Neon Outline</option>
                  <option value="moving-light">Moving Light Beam</option>
                  <option value="color-shift">Rainbow Colour Shift</option>
                  <option value="none">Static Vector Path</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 4. MEDIA ASSETS TAB */}
        {effectiveTab === 'media' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3.5 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Screen & Video Media
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">
                  {mediaAssets.length} items
                </span>
              </div>

              <label className="w-full py-2.5 px-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-semibold">
                <Upload className="w-4 h-4" />
                <span>
                  {isUploading
                    ? 'Processing Media...'
                    : 'Upload Video / Image (MP4, WebM, PNG)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => addLongDemoVideo(60)}
                className="w-full py-1.5 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Load 60s Multi-Scene Demo Recording</span>
              </button>

              {uploadError && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mediaAssets.map((asset) => {
                const isAssigned = selectedDevice?.mediaId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isAssigned
                        ? 'bg-blue-50/60 border-blue-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {asset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {asset.type.toUpperCase()} · {asset.width}×
                          {asset.height} · {(asset.duration || 6).toFixed(1)}s
                        </div>
                      </div>
                      {asset.type !== 'procedural' && (
                        <button
                          onClick={() => removeMediaAsset(asset.id)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      <button
                        onClick={() => {
                          if (selectedDevice) {
                            assignMediaToDevice(selectedDevice.id, asset.id);
                          }
                        }}
                        className={`py-1 px-2 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                          isAssigned
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isAssigned ? 'Active on Device' : 'Apply to Device'}
                      </button>
                      <button
                        onClick={() => addClipFromMedia(asset.id, 0)}
                        className="py-1 px-2 rounded text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                      >
                        + Timeline Clip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. MULTI-LAYER BACKGROUND STUDIO TAB (Section 6) */}
        {effectiveTab === 'backgrounds' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Background Studio
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Multi-layer atmosphere, patterns & backdrops
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer bg-slate-100 px-2 py-1 rounded border border-slate-200">
                <input
                  type="checkbox"
                  checked={background.type === 'transparent'}
                  onChange={(e) =>
                    updateBackground({
                      type: e.target.checked ? 'transparent' : 'gradient',
                    })
                  }
                  className="accent-blue-600"
                />
                <span>Transparent</span>
              </label>
            </div>

            {/* Add Background Layer Buttons */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 block">
                + Add Background Layer
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { kind: 'solid', label: 'Solid' },
                    { kind: 'gradient', label: 'Gradient' },
                    { kind: 'pattern', label: 'Pattern' },
                    { kind: 'texture', label: 'Texture' },
                    { kind: 'decorative-shape', label: 'Accent' },
                    { kind: 'image', label: 'Image' },
                    { kind: 'video', label: 'Video' },
                    { kind: 'vignette', label: 'Vignette' },
                  ] as { kind: BackgroundLayerKind; label: string }[]
                ).map((item) => (
                  <button
                    key={item.kind}
                    onClick={() => addBackgroundLayer({ kind: item.kind })}
                    className="py-1 px-1.5 rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[10px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Layer Stack (Top to Bottom) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Background Layer Stack ({bgLayers.length})</span>
                <span className="text-[10px] text-slate-400">Top → Bottom</span>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...bgLayers].reverse().map((layer) => {
                  const isSel = selectedBgLayer?.id === layer.id;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => selectBackgroundLayer(layer.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-all ${
                        isSel
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm border border-slate-300 shrink-0"
                          style={{
                            background:
                              layer.kind === 'gradient'
                                ? `linear-gradient(135deg, ${layer.gradientStart || '#090D16'}, ${layer.gradientEnd || '#1E293B'})`
                                : layer.color || '#2563EB',
                          }}
                        />
                        <span className="truncate">{layer.name}</span>
                      </div>

                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            updateBackgroundLayer(layer.id, {
                              visible: !layer.visible,
                            })
                          }
                          title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                          className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                        >
                          {layer.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-slate-300" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            reorderBackgroundLayer(layer.id, 'up')
                          }
                          title="Move Layer Up"
                          className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            reorderBackgroundLayer(layer.id, 'down')
                          }
                          title="Move Layer Down"
                          className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => duplicateBackgroundLayer(layer.id)}
                          title="Duplicate Layer"
                          className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {bgLayers.length > 1 && (
                          <button
                            onClick={() => removeBackgroundLayer(layer.id)}
                            title="Delete Layer"
                            className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Background Layer Inspector */}
            {selectedBgLayer && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={selectedBgLayer.name}
                    onChange={(e) =>
                      updateBackgroundLayer(selectedBgLayer.id, {
                        name: e.target.value,
                      })
                    }
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 w-44"
                  />
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                    {selectedBgLayer.kind}
                  </span>
                </div>

                {/* Opacity & Blend Mode */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                      <span>Opacity</span>
                      <span className="font-mono">
                        {Math.round(selectedBgLayer.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={selectedBgLayer.opacity}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          opacity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-600 mb-0.5">
                      Blend Mode
                    </div>
                    <select
                      value={selectedBgLayer.blendMode}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          blendMode: e.target.value as BackgroundBlendMode,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-800"
                    >
                      <option value="normal">Normal</option>
                      <option value="screen">Screen</option>
                      <option value="multiply">Multiply</option>
                      <option value="overlay">Overlay</option>
                      <option value="soft-light">Soft Light</option>
                      <option value="color-dodge">Color Dodge</option>
                    </select>
                  </div>
                </div>

                {/* Kind-specific controls */}
                {selectedBgLayer.kind === 'solid' && (
                  <label className="flex items-center justify-between text-xs text-slate-700 bg-white p-2 rounded border border-slate-200">
                    <span>Layer Colour</span>
                    <input
                      type="color"
                      value={selectedBgLayer.color || '#090D16'}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          color: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded cursor-pointer border-0"
                    />
                  </label>
                )}

                {selectedBgLayer.kind === 'gradient' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      {(['linear', 'radial', 'conic'] as const).map((gt) => (
                        <button
                          key={gt}
                          onClick={() =>
                            updateBackgroundLayer(selectedBgLayer.id, {
                              gradientType: gt,
                            })
                          }
                          className={`py-1 rounded text-[10px] font-semibold capitalize border ${
                            (selectedBgLayer.gradientType || 'linear') === gt
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {gt}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                        <span>Start</span>
                        <input
                          type="color"
                          value={selectedBgLayer.gradientStart || '#090D16'}
                          onChange={(e) =>
                            updateBackgroundLayer(selectedBgLayer.id, {
                              gradientStart: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border-0"
                        />
                      </label>
                      <label className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                        <span>End</span>
                        <input
                          type="color"
                          value={selectedBgLayer.gradientEnd || '#1E293B'}
                          onChange={(e) =>
                            updateBackgroundLayer(selectedBgLayer.id, {
                              gradientEnd: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border-0"
                        />
                      </label>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Gradient Angle</span>
                        <span className="font-mono">
                          {selectedBgLayer.gradientAngle ?? 135}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={selectedBgLayer.gradientAngle ?? 135}
                        onChange={(e) =>
                          updateBackgroundLayer(selectedBgLayer.id, {
                            gradientAngle: Number(e.target.value),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                )}

                {(selectedBgLayer.kind === 'pattern' ||
                  selectedBgLayer.kind === 'texture') && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-1">
                      {(['grid', 'dots', 'diagonal', 'noise'] as const).map(
                        (pt) => (
                          <button
                            key={pt}
                            onClick={() =>
                              updateBackgroundLayer(selectedBgLayer.id, {
                                patternType: pt,
                              })
                            }
                            className={`py-1 rounded text-[10px] font-semibold capitalize border ${
                              (selectedBgLayer.patternType || 'grid') === pt
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {pt}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600">
                        Pattern Colour
                      </span>
                      <input
                        type="color"
                        value={selectedBgLayer.color || '#38BDF8'}
                        onChange={(e) =>
                          updateBackgroundLayer(selectedBgLayer.id, {
                            color: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Pattern Spacing</span>
                        <span className="font-mono">
                          {selectedBgLayer.patternScale || 32}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={14}
                        max={96}
                        value={selectedBgLayer.patternScale || 32}
                        onChange={(e) =>
                          updateBackgroundLayer(selectedBgLayer.id, {
                            patternScale: Number(e.target.value),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                )}

                {selectedBgLayer.kind === 'decorative-shape' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          { id: 'glow-orb', label: 'Glow Orb' },
                          { id: 'geometric-ring', label: 'Geo Ring' },
                          { id: 'diagonal-beam', label: 'Light Beam' },
                          { id: 'soft-wave', label: 'Soft Wave' },
                        ] as const
                      ).map((sh) => (
                        <button
                          key={sh.id}
                          onClick={() =>
                            updateBackgroundLayer(selectedBgLayer.id, {
                              decorativeShape: sh.id,
                            })
                          }
                          className={`py-1 rounded text-[10px] font-semibold border ${
                            (selectedBgLayer.decorativeShape || 'glow-orb') ===
                            sh.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {sh.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                      <span>Accent Colour</span>
                      <input
                        type="color"
                        value={selectedBgLayer.color || '#38BDF8'}
                        onChange={(e) =>
                          updateBackgroundLayer(selectedBgLayer.id, {
                            color: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </label>
                  </div>
                )}

                {(selectedBgLayer.kind === 'image' ||
                  selectedBgLayer.kind === 'video') && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-600 block">
                      Media Source
                    </span>
                    <select
                      value={selectedBgLayer.mediaId || ''}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          mediaId: e.target.value || null,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800"
                    >
                      <option value="">Select media asset...</option>
                      {mediaAssets.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Blur, Scale & Offset */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>Blur</span>
                      <span className="font-mono">{selectedBgLayer.blur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={selectedBgLayer.blur}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          blur: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>Scale</span>
                      <span className="font-mono">
                        {Math.round(selectedBgLayer.scale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.5}
                      step={0.05}
                      value={selectedBgLayer.scale}
                      onChange={(e) =>
                        updateBackgroundLayer(selectedBgLayer.id, {
                          scale: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Curated Atmosphere Presets */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <label className="text-xs font-semibold text-slate-800 block">
                Curated Atmosphere Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_PRESETS.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => applyBackgroundPreset(bp.id)}
                    className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 bg-white text-left transition-all cursor-pointer group"
                  >
                    <div
                      className="h-8 rounded-md mb-1.5 border border-slate-200/80"
                      style={{
                        background:
                          bp.background.type === 'solid'
                            ? bp.background.solidColor
                            : `linear-gradient(${bp.background.gradientAngle}deg, ${bp.background.gradientStart}, ${bp.background.gradientEnd})`,
                      }}
                    />
                    <div className="text-[11px] font-semibold text-slate-700 group-hover:text-blue-600 truncate">
                      {bp.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. THEMES & MATERIAL STUDIO TAB */}
        {effectiveTab === 'themes' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                Themes & Finishes
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Coordinated device hardware finishes & scene palettes
              </p>
            </div>

            {/* Scope Selector */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
              {(
                [
                  { id: 'selected', label: 'Selected' },
                  { id: 'group', label: 'Group' },
                  { id: 'all', label: 'All Devices' },
                ] as const
              ).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setThemeScope(sc.id)}
                  className={`py-1 rounded text-[11px] font-semibold transition-all ${
                    themeScope === sc.id
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Coordinated Scene Palettes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800 block">
                1-Click Studio Palettes
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GLOBAL_THEME_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    onClick={() => applyThemePalette(pal.id, themeScope)}
                    className="p-2 rounded-lg bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1 mb-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: pal.frameColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: pal.glowColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: pal.backgroundStart }}
                      />
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 truncate">
                      {pal.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {pal.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Swatches */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <label className="text-xs font-semibold text-slate-800 block">
                Hardware Chassis Finishes
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {DEVICE_FRAME_SWATCHES.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => {
                      if (selectedDevice) {
                        applyDeviceSwatch(selectedDevice.id, sw.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-slate-300 shadow-2xs"
                      style={{
                        background: `linear-gradient(135deg, ${sw.frameColor}, ${sw.secondaryColor})`,
                      }}
                    />
                    <span className="text-[9px] font-medium text-slate-700 text-center line-clamp-1">
                      {sw.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. UNIFIED LAYERS PANEL TAB (Section 7: Webcams, Drawings, Devices, Backgrounds + Scene Templates) */}
        {effectiveTab === 'layers' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3.5 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Scene Layers
                </h2>
                <button
                  onClick={() =>
                    setShowSceneTemplatesInLayers(!showSceneTemplatesInLayers)
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 text-[10px] font-semibold transition-colors"
                >
                  <LayoutTemplate className="w-3 h-3" />
                  <span>Scene Presets</span>
                </button>
              </div>

              {/* Optional Collapsible Scene Templates Drawer (preserving scene template capability) */}
              {showSceneTemplatesInLayers && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Load Multi-Device Scene Layout
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'flagship-duo', label: 'Flagship Duo' },
                      { id: 'triple-phones', label: 'Triple Phones' },
                      { id: 'desktop-command', label: 'Desktop + Tablet' },
                      { id: 'wearable-trio', label: 'Spatial Ecosystem' },
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => applySceneTemplate(tpl.id)}
                        className="py-1.5 px-2 rounded bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-medium text-slate-700 text-left truncate"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Group / Ungroup Selected Devices */}
              <div className="flex gap-1.5">
                <button
                  onClick={groupSelectedDevices}
                  disabled={selectedIds.length < 2}
                  className="flex-1 py-1.5 px-2 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center justify-center gap-1"
                >
                  <Group className="w-3.5 h-3.5" />
                  <span>Group</span>
                </button>
                <button
                  onClick={ungroupSelectedDevices}
                  className="flex-1 py-1.5 px-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center justify-center gap-1"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  <span>Ungroup</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* A. Webcam Overlays */}
              {webcams.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    Webcam Overlays ({webcams.length})
                  </div>
                  {[...webcams]
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map((wc) => {
                      const isSel = selectedWebcamId === wc.id;
                      return (
                        <div
                          key={wc.id}
                          onClick={() => selectWebcam(wc.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSel
                              ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{wc.name}</span>
                          </div>
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                updateWebcam(wc.id, { visible: !wc.visible })
                              }
                              className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                            >
                              {wc.visible ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                updateWebcam(wc.id, { locked: !wc.locked })
                              }
                              className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                            >
                              {wc.locked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteWebcam(wc.id)}
                              className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* B. Drawings & Annotations */}
              {drawings.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    Drawings & Annotations ({drawings.length})
                  </div>
                  {[...drawings]
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map((dr) => {
                      const isSel = selectedDrawingId === dr.id;
                      return (
                        <div
                          key={dr.id}
                          onClick={() => selectDrawing(dr.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSel
                              ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PenTool className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                            <span className="truncate">{dr.name}</span>
                          </div>
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                updateDrawing(dr.id, { visible: !dr.visible })
                              }
                              className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                            >
                              {dr.visible ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                updateDrawing(dr.id, { locked: !dr.locked })
                              }
                              className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                            >
                              {dr.locked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteDrawing(dr.id)}
                              className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* C. Device Mockups */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Device Mockups ({devices.length})
                </div>
                {[...devices]
                  .sort((a, b) => b.zIndex - a.zIndex)
                  .map((dev) => {
                    const isSel = selectedIds.includes(dev.id);
                    return (
                      <div
                        key={dev.id}
                        onClick={(e) =>
                          selectDevice(dev.id, e.shiftKey || e.metaKey)
                        }
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSel
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {editingLayerId === dev.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={dev.name}
                              onChange={(e) =>
                                updateDevice(dev.id, { name: e.target.value })
                              }
                              onBlur={() => setEditingLayerId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingLayerId(null);
                              }}
                              className="bg-white border border-blue-400 rounded px-1 py-0.5 text-xs w-32"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => setEditingLayerId(dev.id)}
                              className="truncate"
                              title="Double-click to rename"
                            >
                              {dev.name}
                            </span>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => reorderDeviceLayer(dev.id, 'up')}
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => reorderDeviceLayer(dev.id, 'down')}
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              updateDevice(dev.id, { visible: !dev.visible })
                            }
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                          >
                            {dev.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              updateDevice(dev.id, { locked: !dev.locked })
                            }
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                          >
                            {dev.locked ? (
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* D. Background Stack */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Background Stack ({bgLayers.length})
                </div>
                {[...bgLayers].reverse().map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => {
                      selectBackgroundLayer(layer.id);
                      setLeftTab('backgrounds');
                    }}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-xs text-slate-700 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Palette className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{layer.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBackgroundLayer(layer.id, {
                          visible: !layer.visible,
                        });
                      }}
                      className="p-1 rounded hover:bg-slate-200/70 text-slate-500"
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
