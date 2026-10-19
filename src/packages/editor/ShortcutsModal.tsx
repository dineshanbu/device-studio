import React, { useMemo, useState } from 'react';
import {
  Box,
  Film,
  Keyboard,
  MousePointer,
  Play,
  Search,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { useStudioStore } from '../scene-engine/store.ts';

type ShortcutCategory =
  | 'all'
  | 'playback'
  | 'canvas'
  | 'editing'
  | 'viewport';

interface ShortcutItem {
  id: string;
  category: Exclude<ShortcutCategory, 'all'>;
  categoryLabel: string;
  action: string;
  description: string;
  keys: string[];
  onTrigger?: () => void;
  triggerLabel?: string;
}

interface GestureItem {
  id: string;
  mode: '2D Stage' | '3D Studio' | 'Timeline';
  gesture: string;
  operation: string;
  details: string;
}

export const ShortcutsModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    isPlaying,
    setIsPlaying,
    stepFrame,
    jumpToAdjacentKeyframe,
    addKeyframeAtCurrentFrame,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    splitSelectedClipAtPlayhead,
    trimSelectedClipToPlayhead,
    undo,
    redo,
    duplicateSelectedDevices,
    copySelectedDevices,
    pasteDevices,
    groupSelectedDevices,
    ungroupSelectedDevices,
    deleteSelectedDevices,
    deleteDrawing,
    deleteWebcam,
    saveCurrentProject,
    setActiveDrawingTool,
    editorMode,
    setEditorMode,
    showMotionTrail,
    toggleMotionTrail,
    zoom,
    setZoomAndPan,
    snapToGrid,
    toggleSnapToGrid,
    gridSize,
    isPreviewMode,
    togglePreviewMode,
  } = useStudioStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ShortcutCategory>('all');
  const [lastTriggeredId, setLastTriggeredId] = useState<string | null>(null);

  const shortcuts: ShortcutItem[] = useMemo(
    () => [
      // Playback & Timeline
      {
        id: 'play-pause',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Play / Pause Timeline',
        description: 'Start or pause deterministic frame playback at active FPS',
        keys: ['Space'],
        triggerLabel: isPlaying ? 'Pause' : 'Play',
        onTrigger: () => setIsPlaying(!isPlaying),
      },
      {
        id: 'step-frame',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Step 1 Frame Backward / Forward',
        description: 'Nudge the timeline playhead by a single frame',
        keys: ['←', '→'],
        triggerLabel: '+1 Frame',
        onTrigger: () => stepFrame(1),
      },
      {
        id: 'step-10-frames',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Jump 10 Frames Backward / Forward',
        description: 'Fast-scrub the playhead by 10 frames in either direction',
        keys: ['Shift', '← / →'],
        triggerLabel: '+10 Frames',
        onTrigger: () => stepFrame(10),
      },
      {
        id: 'jump-keyframe',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Jump to Previous / Next Keyframe',
        description: 'Snap playhead directly to adjacent keyframe on selected track',
        keys: ['[ / ,', '] / .'],
        triggerLabel: 'Next Keyframe',
        onTrigger: () => jumpToAdjacentKeyframe('next'),
      },
      {
        id: 'insert-keyframe',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Insert Keyframe at Playhead',
        description: 'Capture current transform for active device, drawing, or webcam',
        keys: ['K'],
        triggerLabel: 'Add Keyframe',
        onTrigger: () => {
          const target =
            selectedWebcamId || selectedDrawingId || selectedIds[0];
          if (target) addKeyframeAtCurrentFrame(target);
        },
      },
      {
        id: 'split-clip',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Split Clip at Playhead',
        description: 'Razor-split the selected media, drawing, or webcam clip at playhead',
        keys: ['S'],
        triggerLabel: 'Split Clip',
        onTrigger: () => splitSelectedClipAtPlayhead(),
      },
      {
        id: 'trim-clip-in',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Ripple Trim Clip Start / End to Playhead',
        description: 'Trim the in-point or out-point of the selected timeline clip',
        keys: ['[', ']'],
        triggerLabel: 'Trim In',
        onTrigger: () => trimSelectedClipToPlayhead('left'),
      },
      {
        id: 'motion-trail',
        category: 'playback',
        categoryLabel: 'Playback & Timeline',
        action: 'Toggle Onion Skin Motion Path',
        description: 'Show ghosted keyframe silhouettes and velocity trajectory vectors',
        keys: ['M'],
        triggerLabel: showMotionTrail ? 'Hide Trail' : 'Show Trail',
        onTrigger: () => toggleMotionTrail(),
      },

      // Canvas & Drawing Tools
      {
        id: 'tool-select',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Select & Transform Tool',
        description: 'Select, move, scale, or rotate devices, drawings, and webcams',
        keys: ['V'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('select'),
      },
      {
        id: 'tool-marquee-select',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Marquee Multi-Select Tool',
        description: 'Click and drag in empty space to marquee-select multiple elements',
        keys: ['Drag Empty Space'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('multi-select'),
      },
      {
        id: 'tool-pan',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Pan Stage Tool',
        description: 'Click and drag to pan across the 2D stage viewport',
        keys: ['H', 'Alt + Drag'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('pan'),
      },
      {
        id: 'tool-rect',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Rounded Rectangle Annotation',
        description: 'Draw vector highlight rectangles with optional neon glow',
        keys: ['R'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('rounded-rect'),
      },
      {
        id: 'tool-circle',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Circle / Halo Annotation',
        description: 'Draw circular callout rings and spotlight halos',
        keys: ['O'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('circle'),
      },
      {
        id: 'tool-arrow',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Directional Callout Arrow',
        description: 'Draw pointer arrows with draggable start and end anchors',
        keys: ['A'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('arrow'),
      },
      {
        id: 'tool-brush',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Freehand Vector Brush',
        description: 'Sketch custom animated stroke paths on top of the scene',
        keys: ['B'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('brush'),
      },
      {
        id: 'tool-text',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Text Label / Callout Tool',
        description: 'Place crisp typographic annotations onto the canvas stage',
        keys: ['T'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('text'),
      },
      {
        id: 'tool-eraser',
        category: 'canvas',
        categoryLabel: 'Canvas & Tools',
        action: 'Vector Eraser Tool',
        description: 'Click or scrub across canvas drawings to remove them',
        keys: ['E'],
        triggerLabel: 'Activate',
        onTrigger: () => setActiveDrawingTool('eraser'),
      },

      // Scene & Editing
      {
        id: 'undo',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Undo Last Action',
        description: 'Revert the most recent scene, track, or property modification',
        keys: ['Ctrl / ⌘', 'Z'],
        triggerLabel: 'Undo',
        onTrigger: () => undo(),
      },
      {
        id: 'redo',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Redo Action',
        description: 'Step forward in the undo/redo state history stack',
        keys: ['Ctrl / ⌘', 'Y'],
        triggerLabel: 'Redo',
        onTrigger: () => redo(),
      },
      {
        id: 'duplicate',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Duplicate Selected Objects',
        description: 'Clone selected devices with their screen media and properties',
        keys: ['Ctrl / ⌘', 'D'],
        triggerLabel: 'Duplicate',
        onTrigger: () => duplicateSelectedDevices(),
      },
      {
        id: 'copy-paste',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Copy & Paste Devices',
        description: 'Copy selected devices to clipboard and paste into scene',
        keys: ['Ctrl / ⌘', 'C / V'],
        triggerLabel: 'Copy',
        onTrigger: () => copySelectedDevices(),
      },
      {
        id: 'group-devices',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Group / Ungroup Selected Devices',
        description: 'Link multiple devices together or release an existing group',
        keys: ['Ctrl / ⌘', 'G'],
        triggerLabel: 'Group',
        onTrigger: () => groupSelectedDevices(),
      },
      {
        id: 'delete-selection',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Delete Selected Object',
        description: 'Remove selected webcam, vector drawing, or device mockup',
        keys: ['Delete', 'Backspace'],
        triggerLabel: 'Delete',
        onTrigger: () => {
          if (selectedWebcamId) deleteWebcam(selectedWebcamId);
          else if (selectedDrawingId) deleteDrawing(selectedDrawingId);
          else deleteSelectedDevices();
        },
      },
      {
        id: 'save-project',
        category: 'editing',
        categoryLabel: 'Scene & Editing',
        action: 'Quick Save Project to IndexedDB',
        description: 'Persist current project state locally in browser database',
        keys: ['Ctrl / ⌘', 'S'],
        triggerLabel: 'Save Now',
        onTrigger: () => saveCurrentProject(),
      },

      // 3D & Viewport
      {
        id: 'toggle-2d-3d',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Switch Between 2D Editor & 3D Studio',
        description: 'Toggle between 2D vector canvas and Three.js PBR simulator',
        keys: ['Tab'],
        triggerLabel: editorMode === '2d' ? 'Open 3D Studio' : 'Open 2D Editor',
        onTrigger: () => setEditorMode(editorMode === '2d' ? '3d' : '2d'),
      },
      {
        id: 'toggle-preview-mode',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Toggle Export Preview Mode',
        description:
          'Hide all editor overlays, rulers, grids, and UI handles to inspect the exact final rendered export',
        keys: ['Shift + P', '\\'],
        triggerLabel: isPreviewMode ? 'Exit Preview' : 'Enter Preview',
        onTrigger: () => togglePreviewMode(),
      },
      {
        id: 'toggle-snap-grid',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: `Toggle Snap to Grid (${gridSize}px)`,
        description:
          'Align devices, drawings, and webcams to a configurable grid in 2D and 3D',
        keys: ['G'],
        triggerLabel: snapToGrid ? 'Disable Snap' : 'Enable Snap',
        onTrigger: () => toggleSnapToGrid(),
      },
      {
        id: 'zoom-in-out',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Zoom 2D Stage In / Out',
        description: 'Adjust 2D stage magnification or hold Ctrl/⌘ + Mouse Wheel',
        keys: ['+', '-'],
        triggerLabel: 'Zoom +10%',
        onTrigger: () => setZoomAndPan(Number((zoom + 0.1).toFixed(2))),
      },
      {
        id: 'zoom-reset',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Reset Stage Zoom & Center Pan',
        description: 'Recenter the 2D stage and restore default viewport zoom',
        keys: ['0'],
        triggerLabel: 'Reset View',
        onTrigger: () => setZoomAndPan(0.45, 0, 0),
      },
      {
        id: 'open-shortcuts',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Toggle Keyboard Shortcuts & Controls',
        description: 'Open or close this interactive reference modal from anywhere',
        keys: ['?', 'F1'],
      },
      {
        id: 'close-modal',
        category: 'viewport',
        categoryLabel: '3D & Viewport',
        action: 'Close Active Modal / Reset Tool to Select',
        description: 'Dismiss open dialogs or return active drawing tool to Select',
        keys: ['Esc'],
      },
    ],
    [
      isPlaying,
      setIsPlaying,
      stepFrame,
      jumpToAdjacentKeyframe,
      addKeyframeAtCurrentFrame,
      selectedIds,
      selectedDrawingId,
      selectedWebcamId,
      splitSelectedClipAtPlayhead,
      trimSelectedClipToPlayhead,
      showMotionTrail,
      toggleMotionTrail,
      setActiveDrawingTool,
      undo,
      redo,
      duplicateSelectedDevices,
      copySelectedDevices,
      groupSelectedDevices,
      deleteWebcam,
      deleteDrawing,
      deleteSelectedDevices,
      saveCurrentProject,
      editorMode,
      setEditorMode,
      zoom,
      setZoomAndPan,
      snapToGrid,
      toggleSnapToGrid,
      gridSize,
      isPreviewMode,
      togglePreviewMode,
    ]
  );

  const gestures: GestureItem[] = useMemo(
    () => [
      {
        id: 'gesture-move-resize',
        mode: '2D Stage',
        gesture: 'Click & Drag Handles',
        operation: 'Transform Devices, Drawings & Webcams',
        details:
          'Drag object body to position with smart center/edge snapping. Drag corner squares to scale or top stem handle to rotate.',
      },
      {
        id: 'gesture-marquee-select',
        mode: '2D Stage',
        gesture: 'Drag Empty Space',
        operation: 'Marquee Multi-Selection',
        details:
          'Click and drag in empty canvas space (or use the Marquee tool) to draw a selection box around multiple devices, drawings, and webcams. Hold Shift while dragging for additive selection.',
      },
      {
        id: 'gesture-multi-select',
        mode: '2D Stage',
        gesture: 'Shift / ⌘ + Click',
        operation: 'Multi-Device Selection',
        details:
          'Select multiple devices simultaneously to move them in unison or group them with Ctrl/⌘ + G.',
      },
      {
        id: 'gesture-pan-zoom',
        mode: '2D Stage',
        gesture: 'Alt + Drag / Ctrl + Wheel',
        operation: 'Stage Panning & Smooth Zoom',
        details:
          'Hold Alt (or middle-click) to pan the canvas stage. Hold Ctrl or ⌘ while scrolling to zoom in and out.',
      },
      {
        id: 'gesture-motion-waypoints',
        mode: '2D Stage',
        gesture: 'Click Diamond Waypoint',
        operation: 'Direct Motion Path Scrubbing',
        details:
          'When Motion Path (M) is active, click any cyan/amber keyframe diamond directly on the 2D canvas to jump the playhead to that frame.',
      },
      {
        id: 'gesture-3d-orbit',
        mode: '3D Studio',
        gesture: 'Left-Click + Drag',
        operation: '3D Camera Orbit (Yaw & Pitch)',
        details:
          'Drag horizontally or vertically in the 3D PBR viewport to smoothly orbit around composite device meshes.',
      },
      {
        id: 'gesture-timeline-scrub',
        mode: 'Timeline',
        gesture: 'Drag Ruler / Clip Edges',
        operation: 'Playhead Scrubbing & Ripple Trim',
        details:
          'Drag along the frame ruler to scrub time, drag keyframe diamonds to retime animations, or drag clip left/right edges to trim.',
      },
    ],
    []
  );

  if (activeModal !== 'shortcuts') return null;

  const filteredShortcuts = shortcuts.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.action.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q) ||
      item.keys.some((k) => k.toLowerCase().includes(q))
    );
  });

  const categories: { id: ShortcutCategory; label: string; count: number }[] = [
    { id: 'all', label: 'All Shortcuts', count: shortcuts.length },
    {
      id: 'playback',
      label: 'Playback & Timeline',
      count: shortcuts.filter((s) => s.category === 'playback').length,
    },
    {
      id: 'canvas',
      label: 'Canvas & Tools',
      count: shortcuts.filter((s) => s.category === 'canvas').length,
    },
    {
      id: 'editing',
      label: 'Scene & Editing',
      count: shortcuts.filter((s) => s.category === 'editing').length,
    },
    {
      id: 'viewport',
      label: '3D & Viewport',
      count: shortcuts.filter((s) => s.category === 'viewport').length,
    },
  ];

  const handleRunAction = (item: ShortcutItem) => {
    if (!item.onTrigger) return;
    item.onTrigger();
    setLastTriggeredId(item.id);
    setTimeout(() => {
      setLastTriggeredId((prev) => (prev === item.id ? null : prev));
    }, 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      data-testid="shortcuts-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setActiveModal('none');
      }}
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Keyboard className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                Keyboard Shortcuts & Interactive Studio Controls
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Press <span className="font-mono font-semibold text-slate-700">?</span> or{' '}
                <span className="font-mono font-semibold text-slate-700">F1</span> anytime to toggle this reference · Click any action to trigger it live
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('none')}
            aria-label="Close keyboard shortcuts modal"
            data-testid="close-shortcuts-modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Interactive Category Filter Buttons */}
          <div
            role="tablist"
            aria-label="Shortcut Categories"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80"
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-blue-600 font-semibold shadow-2xs border border-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="ml-1.5 font-mono tabular-nums text-[11px] text-slate-400">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search key or action (e.g. Split, Space, K)..."
              aria-label="Search keyboard shortcuts"
              data-testid="shortcuts-search-input"
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear shortcut search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Keyboard Shortcuts Grid */}
          <section aria-label="Keyboard Shortcuts List" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Keyboard Bindings ({filteredShortcuts.length})
              </h3>
              <span className="text-xs text-slate-500">
                Shortcuts automatically pause when typing in text inputs
              </span>
            </div>

            {filteredShortcuts.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  No shortcuts match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-slate-500">
                  Try searching by key name (e.g., Space, K, V) or clearing the category filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="mt-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredShortcuts.map((item) => {
                  const wasTriggered = lastTriggeredId === item.id;
                  return (
                    <div
                      key={item.id}
                      data-testid={`shortcut-row-${item.id}`}
                      className="p-3 rounded-lg bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {item.action}
                          </span>
                          <span className="text-[11px] text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">
                            {item.categoryLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Keycaps */}
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, idx) => (
                            <React.Fragment key={k}>
                              {idx > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  +
                                </span>
                              )}
                              <kbd className="px-2 py-1 text-[11px] font-mono font-semibold tabular-nums text-slate-800 bg-white border border-slate-300 rounded-md shadow-[0_1px_0_rgba(15,23,42,0.08)] whitespace-nowrap">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Interactive Try Button */}
                        {item.onTrigger && (
                          <button
                            type="button"
                            onClick={() => handleRunAction(item)}
                            title={`Run "${item.action}" now`}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              wasTriggered
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
                                : 'bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            {wasTriggered ? 'Executed' : item.triggerLabel || 'Run'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Direct Mouse, Canvas & 3D Simulator Gestures */}
          <section
            aria-label="Mouse and Viewport Gestures"
            className="pt-4 border-t border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-blue-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Direct Canvas, 3D Orbit & Timeline Gestures
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                2D Stage · Three.js 3D Simulator · Multi-Track Timeline
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {gestures.map((g) => (
                <div
                  key={g.id}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-blue-600">
                      {g.mode}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-700 bg-white border border-slate-200 rounded">
                      {g.gesture}
                    </kbd>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {g.operation}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {g.details}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-blue-600" />
              <span>Space to Play/Pause</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-600" />
              <span>K to Keyframe</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-blue-600" />
              <span>Tab for 2D / 3D Studio</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>S to Split Clip</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('none')}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
