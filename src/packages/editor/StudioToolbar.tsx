import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  Box,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Grid3X3,
  Group,
  Keyboard,
  Layers,
  MonitorPlay,
  Pause,
  Play,
  Redo2,
  Ruler,
  Save,
  Undo2,
  Ungroup,
} from 'lucide-react';
import {
  type ArrangeTargetScope,
  useStudioStore,
} from '../scene-engine/store.ts';
import type { AspectRatioPreset } from '../shared/types.ts';

export const StudioToolbar: React.FC = () => {
  const {
    projectName,
    setProjectName,
    lastSavedAt,
    saveCurrentProject,
    editorMode,
    setEditorMode,
    activeModal,
    setActiveModal,
    aspectRatio,
    setCanvasAspectRatio,
    canvasWidth,
    canvasHeight,
    isPlaying,
    setIsPlaying,
    undo,
    redo,
    historyIndex,
    history,
    snapToGrid,
    toggleSnapToGrid,
    gridSize,
    setGridSize,
    snapSelectedToGrid,
    showRulers,
    setShowRulers,
    isPreviewMode,
    togglePreviewMode,
    devices,
    drawings,
    webcams,
    selectedIds,
    selectedDrawingId,
    selectedDrawingIds,
    selectedWebcamId,
    selectedWebcamIds,
    alignSelectedElements,
    distributeSelectedElements,
    reorderSceneLayer,
    groupSelectedDevices,
    ungroupSelectedDevices,
  } = useStudioStore();

  const [savePulse, setSavePulse] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [arrangeScope, setArrangeScope] = useState<ArrangeTargetScope>('auto');
  const arrangeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!arrangeOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        arrangeRef.current &&
        !arrangeRef.current.contains(e.target as Node)
      ) {
        setArrangeOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArrangeOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [arrangeOpen]);

  const handleQuickSave = async () => {
    await saveCurrentProject();
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 1400);
  };

  const ratios: { id: AspectRatioPreset; label: string }[] = [
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '1:1', label: '1:1' },
    { id: '4:3', label: '4:3' },
  ];

  const isEditorActive = editorMode === '2d' && activeModal === 'none';
  const is3DActive = editorMode === '3d' && activeModal === 'none';
  const isProjectsActive = activeModal === 'projects';
  const isExportActive = activeModal === 'export';

  const selectedWebcam = selectedWebcamId
    ? webcams.find((w) => w.id === selectedWebcamId) || null
    : null;
  const selectedDrawing = selectedDrawingId
    ? drawings.find((d) => d.id === selectedDrawingId) || null
    : null;
  const selectedDevices = devices.filter((d) => selectedIds.includes(d.id));
  const hasGroupedDevice = selectedDevices.some((d) => Boolean(d.groupId));
  const totalSelectedElements =
    selectedDevices.length +
    selectedDrawingIds.length +
    selectedWebcamIds.length;

  const activeTargetSummary =
    totalSelectedElements > 1
      ? selectedDevices.length === totalSelectedElements
        ? `${selectedDevices.length} Devices Selected`
        : `${totalSelectedElements} Elements Selected`
      : selectedWebcam
        ? selectedWebcam.name
        : selectedDrawing
          ? selectedDrawing.name
          : selectedDevices.length === 1
            ? selectedDevices[0].name
            : `All Stage Devices (${devices.length})`;

  const activeLayerTarget: {
    kind: 'webcam' | 'drawing' | 'device';
    id: string;
  } | null = selectedWebcam
    ? { kind: 'webcam', id: selectedWebcam.id }
    : selectedDrawing
      ? { kind: 'drawing', id: selectedDrawing.id }
      : selectedDevices[0]
        ? { kind: 'device', id: selectedDevices[0].id }
        : devices[0]
          ? { kind: 'device', id: devices[0].id }
          : null;

  return (
    <header className="h-13 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none z-30 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {/* Left: Brand, Project Name & Save Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
              Device Studio
            </span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-slate-50 rounded px-1 -ml-1 w-48 truncate transition-colors"
              aria-label="Project Name"
            />
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Save status button */}
        <button
          onClick={handleQuickSave}
          title="Save project to browser database"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            savePulse
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {savePulse ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save</span>
              {lastSavedAt && (
                <span className="text-[10px] text-slate-400 font-normal hidden xl:inline">
                  · Auto
                </span>
              )}
            </>
          )}
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Arrange Dropdown Menu (Align & Distribute Selected Elements) */}
        <div ref={arrangeRef} className="relative">
          <button
            type="button"
            onClick={() => setArrangeOpen((prev) => !prev)}
            aria-expanded={arrangeOpen}
            aria-haspopup="menu"
            data-testid="toolbar-arrange-button"
            title="Arrange, Align & Distribute Elements"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
              arrangeOpen
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-semibold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <AlignCenterVertical className="w-3.5 h-3.5 text-blue-600" />
            <span>Arrange</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                arrangeOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {arrangeOpen && (
            <div
              role="menu"
              aria-label="Arrange Menu"
              data-testid="toolbar-arrange-menu"
              className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-[0_14px_34px_rgba(15,23,42,0.14)] p-2.5 z-50 space-y-2.5 text-xs text-slate-800"
            >
              {/* Target & Align-To Scope Selector */}
              <div className="pb-2 border-b border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Target
                  </span>
                  <span
                    data-testid="arrange-menu-target-label"
                    className="text-[11px] font-semibold text-slate-800 truncate"
                  >
                    {activeTargetSummary}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Align To</span>
                  <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-md border border-slate-200/80 gap-0.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'stage', label: 'Stage' },
                        { id: 'selection', label: 'Selection' },
                      ] as { id: ArrangeTargetScope; label: string }[]
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        data-testid={`arrange-scope-${sc.id}`}
                        onClick={() => setArrangeScope(sc.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          arrangeScope === sc.id
                            ? 'bg-white text-blue-600 font-semibold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alignment Options: Horizontal & Vertical */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-0.5">
                  Align Elements
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-left"
                    onClick={() => alignSelectedElements('left', arrangeScope)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignStartVertical className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Left</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-center"
                    onClick={() =>
                      alignSelectedElements('center', arrangeScope)
                    }
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignCenterVertical className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Center</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-right"
                    onClick={() => alignSelectedElements('right', arrangeScope)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignEndVertical className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Right</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-top"
                    onClick={() => alignSelectedElements('top', arrangeScope)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignStartHorizontal className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Top</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-middle"
                    onClick={() =>
                      alignSelectedElements('middle', arrangeScope)
                    }
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignCenterHorizontal className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Middle</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-align-bottom"
                    onClick={() =>
                      alignSelectedElements('bottom', arrangeScope)
                    }
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignEndHorizontal className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">Align Bottom</span>
                  </button>
                </div>
              </div>

              {/* Distribute Options: Horizontally & Vertically */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-0.5">
                  Distribute Spacing
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-distribute-horizontal"
                    onClick={() =>
                      distributeSelectedElements('horizontal', arrangeScope)
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignHorizontalDistributeCenter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">
                      Distribute Horizontally
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="arrange-distribute-vertical"
                    onClick={() =>
                      distributeSelectedElements('vertical', arrangeScope)
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 transition-colors cursor-pointer"
                  >
                    <AlignVerticalDistributeCenter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-medium truncate">
                      Distribute Vertically
                    </span>
                  </button>
                </div>
              </div>

              {/* Layer Order, Grouping & Grid Snap Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-0.5">
                  Order & Grid
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!activeLayerTarget}
                    data-testid="arrange-bring-front"
                    onClick={() => {
                      if (activeLayerTarget) {
                        reorderSceneLayer(
                          activeLayerTarget.kind,
                          activeLayerTarget.id,
                          'top'
                        );
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5 text-slate-500" />
                    <span>Bring to Front</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!activeLayerTarget}
                    data-testid="arrange-send-back"
                    onClick={() => {
                      if (activeLayerTarget) {
                        reorderSceneLayer(
                          activeLayerTarget.kind,
                          activeLayerTarget.id,
                          'bottom'
                        );
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 text-slate-500" />
                    <span>Send to Back</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedDevices.length < 2}
                    data-testid="arrange-group"
                    onClick={groupSelectedDevices}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Group className="w-3.5 h-3.5 text-blue-600" />
                    <span>Group Devices</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasGroupedDevice}
                    data-testid="arrange-ungroup"
                    onClick={ungroupSelectedDevices}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Ungroup className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ungroup</span>
                  </button>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  data-testid="arrange-snap-to-grid"
                  onClick={snapSelectedToGrid}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Grid3X3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Snap Selection to Grid</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {gridSize}px
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Primary Top-Level Workspace Navigation (1. Editor, 2. 3D Studio, 3. Projects, 4. Export) */}
      <nav
        aria-label="Primary Workspace Areas"
        className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 gap-1"
      >
        <button
          onClick={() => {
            setEditorMode('2d');
            if (activeModal !== 'none') setActiveModal('none');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isEditorActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => {
            setEditorMode('3d');
            if (activeModal !== 'none') setActiveModal('none');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            is3DActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Studio</span>
        </button>

        <button
          onClick={() =>
            setActiveModal(isProjectsActive ? 'none' : 'projects')
          }
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isProjectsActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Projects</span>
        </button>

        <button
          onClick={() => setActiveModal(isExportActive ? 'none' : 'export')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isExportActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </nav>

      {/* Right: Aspect Ratio, Preview Play/Pause & Primary Export Action */}
      <div className="flex items-center gap-2.5">
        {/* Aspect Ratio Selector */}
        <div className="hidden lg:flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200">
          {ratios.map((r) => (
            <button
              key={r.id}
              onClick={() => setCanvasAspectRatio(r.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                aspectRatio === r.id
                  ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="px-2 text-[10px] font-mono text-slate-400 border-l border-slate-200 ml-1">
            {canvasWidth}×{canvasHeight}
          </span>
        </div>

        {/* Rulers & Snap-to-Grid Controls */}
        <div
          data-testid="toolbar-grid-snap-group"
          className="hidden md:flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200 gap-0.5"
        >
          <button
            type="button"
            onClick={() => setShowRulers(!showRulers)}
            aria-pressed={showRulers}
            title="Toggle Horizontal & Vertical Viewport Rulers"
            data-testid="toolbar-rulers-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              showRulers
                ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/70 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Rulers</span>
          </button>
          <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={toggleSnapToGrid}
            aria-pressed={snapToGrid}
            title="Toggle Snap to Grid (G)"
            data-testid="toolbar-snap-toggle"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              snapToGrid
                ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/70 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>
          <select
            aria-label="Toolbar Grid Size"
            data-testid="toolbar-grid-size-select"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            title="Configurable Grid Size (px)"
            className="bg-transparent hover:bg-white rounded px-1.5 py-1 text-[11px] font-mono tabular-nums text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value={10}>10px</option>
            <option value={20}>20px</option>
            <option value={32}>32px</option>
            <option value={40}>40px</option>
            <option value={60}>60px</option>
            <option value={80}>80px</option>
            <option value={100}>100px</option>
          </select>
        </div>

        {/* Export Preview Mode Toggle (hides all editor overlays, grids, rulers & UI handles) */}
        <button
          type="button"
          onClick={togglePreviewMode}
          aria-pressed={isPreviewMode}
          aria-label="Toggle Export Preview Mode"
          data-testid="toolbar-preview-mode-toggle"
          title="Toggle Export Preview Mode (Shift+P / \) — Hide all editor overlays, grids, rulers, and UI handles to inspect the final rendered export"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            isPreviewMode
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200'
          }`}
        >
          {isPreviewMode ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Preview</span>
              <span
                data-testid="toolbar-preview-mode-badge"
                className="px-1.5 py-0.2 rounded bg-white/20 text-[9px] font-mono uppercase tracking-wider text-white"
              >
                ON
              </span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>Preview</span>
            </>
          )}
        </button>

        {/* Timeline Play / Pause button */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          data-testid="toolbar-play-pause-button"
          title="Play / Pause Timeline Playback (Space)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            isPlaying
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Keyboard Shortcuts & Controls Modal Toggle */}
        <button
          type="button"
          onClick={() =>
            setActiveModal(activeModal === 'shortcuts' ? 'none' : 'shortcuts')
          }
          title="Keyboard Shortcuts & Controls (?)"
          aria-label="Keyboard Shortcuts and Controls"
          data-testid="toolbar-shortcuts-button"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeModal === 'shortcuts'
              ? 'bg-blue-50 border-blue-200 text-blue-600 font-semibold'
              : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border-slate-200'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Shortcuts</span>
          <kbd className="px-1 py-0.2 text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded">
            ?
          </kbd>
        </button>

        {/* Primary Export CTA */}
        <button
          onClick={() => setActiveModal('export')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};

