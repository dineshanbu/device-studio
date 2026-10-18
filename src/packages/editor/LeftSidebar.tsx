import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Film,
  Group,
  Layers,
  LayoutTemplate,
  Lock,
  Monitor,
  Palette,
  PenTool,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  SwatchBook,
  Trash2,
  Ungroup,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  BACKGROUND_PRESETS,
  DEVICE_CATALOG,
  DEVICE_CATEGORIES,
  DEVICE_FRAME_SWATCHES,
  GLOBAL_THEME_PALETTES,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import { createMediaAssetFromFile } from '../media/proceduralMedia.ts';
import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  rgbToHex,
} from '../scene-engine/math.ts';
import { useStudioStore, type LeftSidebarTab } from '../scene-engine/store.ts';
import type {
  DeviceCategory,
  DeviceFinishStyle,
  DrawingAnimationMode,
  DrawingToolType,
} from '../shared/types.ts';

export const LeftSidebar: React.FC = () => {
  const {
    leftTab,
    setLeftTab,
    devices,
    drawings,
    selectedIds,
    selectedDrawingId,
    mediaAssets,
    background,
    customThemes,
    activeDrawingTool,
    drawingDefaults,
    addDevice,
    selectDevice,
    selectDrawing,
    updateDevice,
    updateDeviceEffects,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    reorderDeviceLayer,
    groupSelectedDevices,
    ungroupSelectedDevices,
    applyDeviceSwatch,
    applyThemePalette,
    saveCustomThemePalette,
    setActiveDrawingTool,
    updateDrawingDefaults,
    createGlowingHaloAroundDevice,
    deleteDrawing,
    duplicateDrawing,
    addMediaAsset,
    addLongDemoVideo,
    removeMediaAsset,
    assignMediaToDevice,
    addClipFromMedia,
    updateBackground,
    applyBackgroundPreset,
    applySceneTemplate,
  } = useStudioStore();

  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    DeviceCategory | 'all'
  >('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Theme Studio local UI state
  const [themeScope, setThemeScope] = useState<'selected' | 'group' | 'all'>(
    'selected'
  );
  const [colorInputMode, setColorInputMode] = useState<'hex' | 'rgb' | 'hsl'>(
    'hex'
  );
  const [customThemeName, setCustomThemeName] = useState('');

  const filteredDevices = useMemo(() => {
    return DEVICE_CATALOG.filter((d) => {
      const matchesCat =
        selectedCategory === 'all' || d.category === selectedCategory;
      const q = deviceSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [selectedCategory, deviceSearch]);

  const activeDevice =
    devices.find((d) => selectedIds.includes(d.id)) || devices[0];
  const activePreset = activeDevice
    ? getDevicePresetById(activeDevice.presetId)
    : DEVICE_CATALOG[0];

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const asset = await createMediaAssetFromFile(file);
        addMediaAsset(asset, true);
        if (activeDevice) {
          assignMediaToDevice(activeDevice.id, asset.id);
        }
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Failed to load media file.'
        );
      }
    }
  };

  const navItems: {
    id: LeftSidebarTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'themes', label: 'Themes', icon: SwatchBook },
    { id: 'draw', label: 'Draw', icon: PenTool },
    { id: 'media', label: 'Media', icon: Film },
    { id: 'templates', label: 'Scenes', icon: LayoutTemplate },
    { id: 'backgrounds', label: 'Stage', icon: Palette },
    { id: 'layers', label: 'Layers', icon: Layers },
  ];

  const userUploadedMedia = mediaAssets.filter((m) => m.type !== 'procedural');
  const proceduralMedia = mediaAssets.filter((m) => m.type === 'procedural');

  const currentFrameHex =
    activeDevice?.customFrameColor || activePreset.frameColor;
  const rgbVal = hexToRgb(currentFrameHex);
  const hslVal = hexToHsl(currentFrameHex);

  return (
    <aside
      aria-label="Studio Library and Layers Sidebar"
      className="w-80 bg-[#0E131D] border-r border-slate-800/90 flex flex-col h-full select-none shrink-0"
    >
      {/* Top Segmented Tab Bar */}
      <div className="p-1.5 border-b border-slate-800/90 bg-[#111724] grid grid-cols-7 gap-0.5">
        {navItems.map((tab) => {
          const Icon = tab.icon;
          const active = leftTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLeftTab(tab.id)}
              aria-label={`${tab.label} tab`}
              className={`py-1.5 px-0.5 rounded-md flex flex-col items-center gap-1 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* 1. DEVICES TAB */}
        {leftTab === 'devices' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search device catalog"
                placeholder="Search iPhone, Pixel, MacBook..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {DEVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-[#090C12] text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredDevices.map((preset) => (
                <div
                  key={preset.id}
                  className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={{ backgroundColor: preset.frameColor }}
                      className="w-8 h-8 rounded-md border border-slate-700 flex items-center justify-center shrink-0"
                    >
                      {preset.category === 'laptop' ||
                      preset.category === 'desktop' ||
                      preset.category === 'browser' ? (
                        <Monitor className="w-4 h-4 text-slate-300" />
                      ) : (
                        <Smartphone className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {preset.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        {preset.brand} · {preset.width}×{preset.height}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addDevice(preset.id)}
                    aria-label={`Add ${preset.name} to scene`}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. PREMIUM THEME COLOUR STUDIO TAB */}
        {leftTab === 'themes' && (
          <div className="space-y-4">
            {/* Apply Scope Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Theme Application Scope
                </span>
                <span className="text-[11px] text-slate-500">
                  Non-destructive
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-[#090C12] p-1 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'selected', label: 'Selected' },
                    { id: 'group', label: 'Group' },
                    { id: 'all', label: 'All Devices' },
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setThemeScope(sc.id)}
                    className={`py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      themeScope === sc.id
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Global Theme Palettes */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                Global Studio Theme Palettes
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {[...customThemes, ...GLOBAL_THEME_PALETTES].map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => applyThemePalette(pal.id, themeScope)}
                    className="p-2 rounded-lg bg-[#090C12] border border-slate-800 hover:border-sky-500/50 flex items-center justify-between gap-2 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          style={{ backgroundColor: pal.frameColor }}
                          className="w-4 h-4 rounded-full border border-slate-600"
                        />
                        <span
                          style={{ backgroundColor: pal.glowColor }}
                          className="w-4 h-4 rounded-full border border-slate-600"
                        />
                        <span
                          style={{ backgroundColor: pal.glowSecondaryColor }}
                          className="w-4 h-4 rounded-full border border-slate-600"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {pal.name}
                        </div>
                        <div className="text-[10px] text-slate-500 capitalize">
                          {pal.finishStyle} finish · {pal.glowColor}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-sky-400 shrink-0">
                      Apply
                    </span>
                  </button>
                ))}
              </div>

              {/* Save Custom Theme */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Save current look as preset..."
                  aria-label="Custom theme name"
                  value={customThemeName}
                  onChange={(e) => setCustomThemeName(e.target.value)}
                  className="flex-1 bg-[#090C12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveCustomThemePalette(
                      customThemeName || 'Custom Neon Studio',
                      activeDevice?.id
                    );
                    setCustomThemeName('');
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Hardware Anodized & Titanium Swatches */}
            {activeDevice && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-slate-200">
                  Hardware Frame Swatches ({activeDevice.name})
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DEVICE_FRAME_SWATCHES.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => applyDeviceSwatch(activeDevice.id, sw.id)}
                      title={sw.name}
                      aria-label={`Apply ${sw.name} hardware finish`}
                      className="p-1.5 rounded-lg bg-[#090C12] border border-slate-800 hover:border-sky-400 flex flex-col items-center gap-1 transition-colors"
                    >
                      <span
                        style={{
                          background: `linear-gradient(135deg, ${sw.frameColor}, ${sw.secondaryColor})`,
                        }}
                        className="w-6 h-6 rounded-full border border-slate-600"
                      />
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">
                        {sw.name.split(' ').pop()}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Material Finish Style */}
                <label className="block space-y-1 text-xs text-slate-400 pt-1">
                  <span>Surface Finish Preset</span>
                  <select
                    aria-label="Surface Finish Preset"
                    value={activeDevice.finishStyle || 'brushed'}
                    onChange={(e) =>
                      updateDevice(activeDevice.id, {
                        finishStyle: e.target.value as DeviceFinishStyle,
                      })
                    }
                    className="w-full bg-[#090C12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="brushed">Brushed Anodized Metal</option>
                    <option value="matte">Matte Satin Bead-Blast</option>
                    <option value="polished">Polished Mirror Stainless</option>
                    <option value="glass">Optical Frosted Glass</option>
                    <option value="metallic-gradient">
                      Metallic Two-Tone Gradient
                    </option>
                  </select>
                </label>

                {/* Precision HEX / RGB / HSL Color Input */}
                <div className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      Precision Frame Colour
                    </span>
                    <div className="flex items-center gap-1">
                      {(['hex', 'rgb', 'hsl'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setColorInputMode(m)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                            colorInputMode === m
                              ? 'bg-sky-500 text-slate-950 font-semibold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {colorInputMode === 'hex' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Frame Hex Color Picker"
                        value={currentFrameHex}
                        onChange={(e) =>
                          updateDevice(activeDevice.id, {
                            customFrameColor: e.target.value,
                          })
                        }
                        className="w-7 h-7 bg-transparent border-0 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        aria-label="Frame HEX value"
                        value={currentFrameHex}
                        onChange={(e) =>
                          updateDevice(activeDevice.id, {
                            customFrameColor: e.target.value,
                          })
                        }
                        className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                  )}

                  {colorInputMode === 'rgb' && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['r', 'g', 'b'] as const).map((ch) => (
                        <label
                          key={ch}
                          className="space-y-0.5 text-[10px] font-mono text-slate-400 uppercase"
                        >
                          <span>{ch}</span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgbVal[ch]}
                            onChange={(e) => {
                              const next = {
                                ...rgbVal,
                                [ch]: Number(e.target.value) || 0,
                              };
                              updateDevice(activeDevice.id, {
                                customFrameColor: rgbToHex(
                                  next.r,
                                  next.g,
                                  next.b
                                ),
                              });
                            }}
                            className="w-full bg-[#0E131D] border border-slate-800 rounded px-1.5 py-1 text-xs font-mono tabular-nums text-slate-200"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {colorInputMode === 'hsl' && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { k: 'h', max: 360, label: 'H°' },
                          { k: 's', max: 100, label: 'S%' },
                          { k: 'l', max: 100, label: 'L%' },
                        ] as const
                      ).map((ch) => (
                        <label
                          key={ch.k}
                          className="space-y-0.5 text-[10px] font-mono text-slate-400"
                        >
                          <span>{ch.label}</span>
                          <input
                            type="number"
                            min={0}
                            max={ch.max}
                            value={hslVal[ch.k]}
                            onChange={(e) => {
                              const next = {
                                ...hslVal,
                                [ch.k]: Number(e.target.value) || 0,
                              };
                              updateDevice(activeDevice.id, {
                                customFrameColor: hslToHex(
                                  next.h,
                                  next.s,
                                  next.l
                                ),
                              });
                            }}
                            className="w-full bg-[#0E131D] border border-slate-800 rounded px-1.5 py-1 text-xs font-mono tabular-nums text-slate-200"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Sub-component colors: Secondary Gradient, Buttons, Bezel, Rim Border */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="space-y-1 text-[11px] text-slate-400">
                      <span>Metallic Accent</span>
                      <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                        <input
                          type="color"
                          value={
                            activeDevice.customFrameSecondaryColor ||
                            activePreset.frameAccentColor
                          }
                          onChange={(e) =>
                            updateDevice(activeDevice.id, {
                              customFrameSecondaryColor: e.target.value,
                            })
                          }
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeDevice.customFrameSecondaryColor ||
                            activePreset.frameAccentColor}
                        </span>
                      </div>
                    </label>

                    <label className="space-y-1 text-[11px] text-slate-400">
                      <span>Button Colour</span>
                      <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                        <input
                          type="color"
                          value={
                            activeDevice.customButtonColor ||
                            activePreset.frameAccentColor
                          }
                          onChange={(e) =>
                            updateDevice(activeDevice.id, {
                              customButtonColor: e.target.value,
                            })
                          }
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeDevice.customButtonColor ||
                            activePreset.frameAccentColor}
                        </span>
                      </div>
                    </label>

                    <label className="space-y-1 text-[11px] text-slate-400">
                      <span>Inner Bezel</span>
                      <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                        <input
                          type="color"
                          value={activeDevice.customBezelColor || '#070A10'}
                          onChange={(e) =>
                            updateDevice(activeDevice.id, {
                              customBezelColor: e.target.value,
                            })
                          }
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeDevice.customBezelColor || '#070A10'}
                        </span>
                      </div>
                    </label>

                    <label className="space-y-1 text-[11px] text-slate-400">
                      <span>Rim Border</span>
                      <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                        <input
                          type="color"
                          value={activeDevice.effects.borderColor || '#475569'}
                          onChange={(e) =>
                            updateDeviceEffects(activeDevice.id, {
                              borderColor: e.target.value,
                            })
                          }
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeDevice.effects.borderColor || '#475569'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. DRAWING & ANIMATED GLOW PATH TOOL TAB */}
        {leftTab === 'draw' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                Canvas Vector & Neon Drawing Tools
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'select', label: 'Select / Move' },
                    { id: 'brush', label: 'Freehand Brush' },
                    { id: 'pen', label: 'Smooth Pen' },
                    { id: 'bezier', label: 'Curved Path' },
                    { id: 'line', label: 'Neon Line' },
                    { id: 'arrow', label: 'Arrow Callout' },
                    { id: 'rect', label: 'Rectangle' },
                    { id: 'rounded-rect', label: 'Rounded Box' },
                    { id: 'ellipse', label: 'Circle / Halo' },
                    { id: 'polygon', label: 'Polygon' },
                  ] as { id: DrawingToolType; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveDrawingTool(t.id)}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium text-left transition-colors whitespace-nowrap shrink-0 ${
                      activeDrawingTool === t.id
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                        : 'bg-[#090C12] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instant Device Halo & Callout Generators */}
            {activeDevice && (
              <div className="p-3 rounded-xl bg-[#090C12] border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>One-Click Device Neon Overlays</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Generate an animated glowing vector path fitted around{' '}
                  <span className="text-slate-200 font-medium">
                    {activeDevice.name}
                  </span>
                  :
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      createGlowingHaloAroundDevice(
                        activeDevice.id,
                        'rounded-rect'
                      )
                    }
                    className="py-1.5 px-3 bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-medium transition-colors"
                  >
                    + Add Neon Perimeter Trace
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      createGlowingHaloAroundDevice(activeDevice.id, 'ellipse')
                    }
                    className="py-1.5 px-3 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    + Add Glowing Halo Ring
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      createGlowingHaloAroundDevice(activeDevice.id, 'arrow')
                    }
                    className="py-1.5 px-3 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    + Add Animated Callout Arrow
                  </button>
                </div>
              </div>
            )}

            {/* Default Stroke & Animated Glow Settings */}
            <div className="p-3 rounded-xl bg-[#090C12] border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Stroke & Neon Glow Defaults
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] text-slate-400">
                  <span>Stroke Start</span>
                  <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                    <input
                      type="color"
                      value={drawingDefaults.strokeColor}
                      onChange={(e) =>
                        updateDrawingDefaults({
                          strokeColor: e.target.value,
                          glowColor: e.target.value,
                        })
                      }
                      className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-slate-300">
                      {drawingDefaults.strokeColor}
                    </span>
                  </div>
                </label>

                <label className="space-y-1 text-[11px] text-slate-400">
                  <span>Gradient End</span>
                  <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                    <input
                      type="color"
                      value={drawingDefaults.strokeColorEnd}
                      onChange={(e) =>
                        updateDrawingDefaults({
                          strokeColorEnd: e.target.value,
                        })
                      }
                      className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-slate-300">
                      {drawingDefaults.strokeColorEnd}
                    </span>
                  </div>
                </label>
              </div>

              <label className="block space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Stroke Width & Glow Radius</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {drawingDefaults.strokeWidth}px / {drawingDefaults.glowRadius}px
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={24}
                  value={drawingDefaults.strokeWidth}
                  onChange={(e) =>
                    updateDrawingDefaults({
                      strokeWidth: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400"
                />
              </label>

              <label className="block space-y-1 text-xs text-slate-400">
                <span>Path Animation Mode</span>
                <select
                  aria-label="Default Drawing Path Animation"
                  value={drawingDefaults.animationMode}
                  onChange={(e) =>
                    updateDrawingDefaults({
                      animationMode: e.target.value as DrawingAnimationMode,
                    })
                  }
                  className="w-full bg-[#0E131D] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="neon-trace">Travelling Neon Trace</option>
                  <option value="draw-on">Animated Draw-On Reveal</option>
                  <option value="moving-light">Moving Light Pulse</option>
                  <option value="pulsing-outline">Pulsing Neon Outline</option>
                  <option value="none">Static Neon Vector</option>
                </select>
              </label>
            </div>

            {/* Active Drawing Layers List */}
            {drawings.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="text-xs font-medium text-slate-400">
                  Drawn Neon Overlays ({drawings.length})
                </div>
                {drawings.map((dr) => (
                  <div
                    key={dr.id}
                    onClick={() => selectDrawing(dr.id)}
                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      selectedDrawingId === dr.id
                        ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                        : 'bg-[#090C12] border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-medium truncate">
                      {dr.name}
                    </span>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => duplicateDrawing(dr.id)}
                        aria-label={`Duplicate ${dr.name}`}
                        className="p-1 text-slate-400 hover:text-white rounded"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDrawing(dr.id)}
                        aria-label={`Delete ${dr.name}`}
                        className="p-1 text-rose-400 hover:bg-rose-500/15 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. MEDIA UPLOAD & LIBRARY TAB */}
        {leftTab === 'media' && (
          <div className="space-y-4">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              className={`block p-4 rounded-xl border border-dashed text-center cursor-pointer transition-colors ${
                isDraggingFile
                  ? 'border-sky-400 bg-sky-500/10'
                  : 'border-slate-700 bg-[#090C12] hover:border-slate-600'
              }`}
            >
              <Upload className="w-5 h-5 text-sky-400 mx-auto mb-1.5" />
              <div className="text-xs font-semibold text-slate-200">
                Upload Video or Screenshot
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Auto-creates Timeline Clip & maps to screen
              </div>
              <input
                type="file"
                multiple
                accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => addLongDemoVideo(60)}
              data-testid="add-60s-demo-video-btn"
              className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Film className="w-3.5 h-3.5" />
              <span>+ Load 60s Multi-Scene Video (1800f)</span>
            </button>

            {uploadError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Uploaded User Media</span>
                <span className="font-mono tabular-nums">
                  {userUploadedMedia.length}
                </span>
              </div>
              {userUploadedMedia.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#090C12] border border-slate-800/80 text-[11px] text-slate-500">
                  No user files uploaded yet. Drop an MP4, WebM, or screenshot
                  above to map onto any device screen and timeline track.
                </div>
              ) : (
                userUploadedMedia.map((asset) => {
                  const isAssigned = activeDevice?.mediaId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={`p-2.5 rounded-lg border space-y-2 ${
                        isAssigned
                          ? 'bg-sky-500/10 border-sky-500/50'
                          : 'bg-[#090C12] border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200 truncate">
                            {asset.name}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500">
                            {asset.width}×{asset.height} · {asset.aspectRatio} ·{' '}
                            {asset.duration}s
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {activeDevice && (
                            <button
                              type="button"
                              onClick={() =>
                                assignMediaToDevice(activeDevice.id, asset.id)
                              }
                              className="px-2 py-1 text-[11px] font-medium bg-sky-500 text-slate-950 rounded hover:bg-sky-400 whitespace-nowrap shrink-0"
                            >
                              {isAssigned ? 'Active' : 'Apply'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addClipFromMedia(asset.id)}
                            title="Add Clip to Timeline"
                            className="px-2 py-1 text-[11px] font-medium bg-slate-800 text-slate-200 rounded hover:bg-slate-700 whitespace-nowrap shrink-0"
                          >
                            + Clip
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMediaAsset(asset.id)}
                            aria-label={`Remove ${asset.name}`}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {asset.type === 'video' && !asset.missing && (
                        <video
                          src={asset.url}
                          controls
                          className="w-full h-24 object-cover rounded bg-black"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Built-In Studio Screen Streams */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-medium text-slate-400">
                Studio Live Screen Streams ({proceduralMedia.length})
              </div>
              {proceduralMedia.map((asset) => {
                const isAssigned = activeDevice?.mediaId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      isAssigned
                        ? 'bg-sky-500/10 border-sky-500/50'
                        : 'bg-[#090C12] border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {asset.name}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        {asset.width}×{asset.height} · {asset.aspectRatio} ·
                        60fps
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {activeDevice && (
                        <button
                          type="button"
                          onClick={() =>
                            assignMediaToDevice(activeDevice.id, asset.id)
                          }
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            isAssigned
                              ? 'bg-sky-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {isAssigned ? 'Assigned' : 'Use'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => addClipFromMedia(asset.id)}
                        title="Add stream clip to timeline"
                        className="px-2 py-1 text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-sky-300 rounded-md whitespace-nowrap shrink-0"
                      >
                        + Clip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. SCENE TEMPLATES TAB */}
        {leftTab === 'templates' && (
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-400">
              Multi-Device Studio Compositions
            </div>
            {[
              {
                id: 'flagship-duo',
                title: 'Flagship Mobile & Desktop Duo',
                meta: 'MacBook Pro 16" · iPhone 16 Pro · Keyframed Motion',
              },
              {
                id: 'triple-phones',
                title: 'Triple Flagship Smartphone Lineup',
                meta: 'iPhone 16 Pro · Pixel 9 Pro · Galaxy S24 Ultra',
              },
              {
                id: 'web-saas-launch',
                title: 'Developer Cloud & Tablet Suite',
                meta: 'Arc Studio Browser · iPad Pro 13" M4',
              },
              {
                id: 'wearable-gaming',
                title: 'Handheld & Telemetry Hardware',
                meta: 'Steam Deck OLED · Apple Watch Ultra 2',
              },
            ].map((tpl) => (
              <div
                key={tpl.id}
                className="p-3 rounded-xl bg-[#090C12] border border-slate-800 hover:border-slate-700 space-y-2 transition-colors"
              >
                <div className="text-xs font-semibold text-slate-100">
                  {tpl.title}
                </div>
                <div className="text-[11px] text-slate-400">{tpl.meta}</div>
                <button
                  type="button"
                  onClick={() => applySceneTemplate(tpl.id)}
                  className="w-full py-1.5 px-3 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                >
                  Load Composition
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 6. BACKGROUND STUDIO TAB */}
        {leftTab === 'backgrounds' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Studio Stage Presets
              </label>
              <div className="space-y-2">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyBackgroundPreset(preset.id)}
                    className={`w-full p-2.5 rounded-lg border flex items-center justify-between text-left transition-colors ${
                      background.presetId === preset.id
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-200'
                        : 'bg-[#090C12] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{
                          background: `linear-gradient(135deg, ${preset.background.gradientStart}, ${preset.background.gradientEnd})`,
                        }}
                        className="w-7 h-7 rounded-md border border-slate-700 shrink-0"
                      />
                      <div>
                        <div className="text-xs font-semibold">
                          {preset.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {preset.category}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="text-xs font-medium text-slate-300">
                Custom Stage Gradient & Atmosphere
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1 text-[11px] text-slate-400">
                  <span>Primary Color</span>
                  <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={background.gradientStart}
                      onChange={(e) =>
                        updateBackground({
                          type: 'gradient',
                          gradientStart: e.target.value,
                          solidColor: e.target.value,
                        })
                      }
                      className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-slate-300">
                      {background.gradientStart}
                    </span>
                  </div>
                </label>

                <label className="space-y-1 text-[11px] text-slate-400">
                  <span>Secondary Color</span>
                  <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={background.gradientEnd}
                      onChange={(e) =>
                        updateBackground({
                          type: 'gradient',
                          gradientEnd: e.target.value,
                        })
                      }
                      className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-slate-300">
                      {background.gradientEnd}
                    </span>
                  </div>
                </label>
              </div>

              <label className="block space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Gradient Angle</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {background.gradientAngle}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={background.gradientAngle}
                  onChange={(e) =>
                    updateBackground({
                      gradientAngle: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400"
                />
              </label>

              <label className="block space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Stage Vignette</span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {Math.round(background.vignetteIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={background.vignetteIntensity}
                  onChange={(e) =>
                    updateBackground({
                      vignetteIntensity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400"
                />
              </label>

              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Precision Studio Grid</span>
                  <input
                    type="checkbox"
                    checked={background.gridOverlay}
                    onChange={(e) =>
                      updateBackground({ gridOverlay: e.target.checked })
                    }
                    className="accent-sky-400"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Ambient Light Particles</span>
                  <input
                    type="checkbox"
                    checked={background.ambientParticles}
                    onChange={(e) =>
                      updateBackground({ ambientParticles: e.target.checked })
                    }
                    className="accent-sky-400"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 7. LAYERS & HIERARCHY TAB */}
        {leftTab === 'layers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Scene Hierarchy ({devices.length + drawings.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={groupSelectedDevices}
                  disabled={selectedIds.length < 2}
                  title="Group selected devices"
                  aria-label="Group selected devices"
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded bg-[#090C12] border border-slate-800"
                >
                  <Group className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={ungroupSelectedDevices}
                  disabled={selectedIds.length === 0}
                  title="Ungroup selected devices"
                  aria-label="Ungroup selected devices"
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded bg-[#090C12] border border-slate-800"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={duplicateSelectedDevices}
                  disabled={selectedIds.length === 0 && !selectedDrawingId}
                  title="Duplicate selected"
                  aria-label="Duplicate selected devices"
                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 rounded bg-[#090C12] border border-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedDevices}
                  disabled={selectedIds.length === 0 && !selectedDrawingId}
                  title="Delete selected"
                  aria-label="Delete selected devices"
                  className="p-1.5 text-rose-400 hover:bg-rose-500/15 disabled:opacity-40 rounded bg-[#090C12] border border-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
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
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                          : 'bg-[#090C12] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">
                          {dev.name}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-500">
                          z:{dev.zIndex}
                          {dev.groupId ? ` · ${dev.groupId}` : ''}
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => reorderDeviceLayer(dev.id, 'up')}
                          aria-label={`Move ${dev.name} layer up`}
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => reorderDeviceLayer(dev.id, 'down')}
                          aria-label={`Move ${dev.name} layer down`}
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDevice(dev.id, { visible: !dev.visible })
                          }
                          aria-label={`Toggle ${dev.name} visibility`}
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          {dev.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDevice(dev.id, { locked: !dev.locked })
                          }
                          aria-label={`Toggle ${dev.name} lock`}
                          className="p-1 text-slate-400 hover:text-white rounded"
                        >
                          {dev.locked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
