import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Diamond,
  Film,
  Globe,
  Layers,
  Lock,
  Maximize2,
  PenTool,
  Plus,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Unlock,
  Wand2,
} from 'lucide-react';
import {
  ANIMATION_PRESETS,
  DEFAULT_BROWSER_THEME,
  DEVICE_CATALOG,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import {
  formatTimecode,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  updateDrawingControlPoint,
  updateDrawingLineEndpoints,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type {
  AnimationPresetId,
  DeviceFinishStyle,
  DrawingAnimationMode,
  EasingType,
  GlowAnimationMode,
  ScreenFitMode,
} from '../shared/types.ts';

export const RightInspector: React.FC = () => {
  const {
    devices,
    drawings,
    clips,
    tracks,
    currentFrame,
    durationInFrames,
    fps,
    selectedIds,
    selectedDrawingId,
    selectedClipId,
    mediaAssets,
    updateDevice,
    updateDeviceScreenTransform,
    updateDeviceEffects,
    updateDeviceBrowserTheme,
    assignMediaToDevice,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    updateDrawing,
    deleteDrawing,
    duplicateDrawing,
    selectDrawing,
    updateClip,
    trimSelectedClipToPlayhead,
    splitSelectedClipAtPlayhead,
    duplicateSelectedClip,
    deleteSelectedClip,
    selectClip,
    addKeyframeAtCurrentFrame,
    jumpToAdjacentKeyframe,
    clearTrackKeyframes,
    applyAnimationPresetToDevice,
  } = useStudioStore();

  const [selectedAnimPreset, setSelectedAnimPreset] =
    useState<AnimationPresetId>('smooth-scale');

  const rawSelectedDrawing = drawings.find((dr) => dr.id === selectedDrawingId);
  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const rawSelectedDevice = devices.find((d) => selectedIds.includes(d.id));

  const drawingTrack = rawSelectedDrawing
    ? tracks.find((t) => t.targetId === rawSelectedDrawing.id)
    : undefined;
  const selectedDrawing = rawSelectedDrawing
    ? resolveDrawingAtFrame(
        rawSelectedDrawing,
        drawingTrack ? drawingTrack.keyframes : [],
        currentFrame
      )
    : undefined;

  // 1. DEDICATED DRAWING PROPERTIES INSPECTOR
  if (selectedDrawing && rawSelectedDrawing) {
    const drKeyframes = drawingTrack ? drawingTrack.keyframes : [];
    const drKeyframeAtPlayhead = drKeyframes.find(
      (k) => k.frame === currentFrame
    );
    const isLockedAspect = Boolean(
      rawSelectedDrawing.lockAspectRatio || rawSelectedDrawing.tool === 'circle'
    );
    const isLineOrArrow =
      selectedDrawing.tool === 'line' || selectedDrawing.tool === 'arrow';
    const startPt =
      isLineOrArrow && selectedDrawing.points.length >= 2
        ? {
            x: Math.round(selectedDrawing.x + selectedDrawing.points[0].x),
            y: Math.round(selectedDrawing.y + selectedDrawing.points[0].y),
          }
        : {
            x: Math.round(selectedDrawing.x - selectedDrawing.width / 2),
            y: Math.round(selectedDrawing.y + selectedDrawing.height / 2),
          };
    const endPt =
      isLineOrArrow && selectedDrawing.points.length >= 2
        ? {
            x: Math.round(selectedDrawing.x + selectedDrawing.points[1].x),
            y: Math.round(selectedDrawing.y + selectedDrawing.points[1].y),
          }
        : {
            x: Math.round(selectedDrawing.x + selectedDrawing.width / 2),
            y: Math.round(selectedDrawing.y - selectedDrawing.height / 2),
          };

    return (
      <aside
        aria-label="Object Properties Inspector"
        data-testid="drawing-properties-inspector"
        className="w-80 bg-[#0E131D] border-l border-slate-800/90 flex flex-col h-full select-none shrink-0"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800/90 bg-[#111724] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <input
              type="text"
              aria-label="Selected drawing name"
              value={rawSelectedDrawing.name}
              onChange={(e) =>
                updateDrawing(selectedDrawing.id, { name: e.target.value })
              }
              className="bg-transparent text-xs font-semibold text-slate-100 border-b border-transparent focus:border-sky-400 outline-none truncate w-full"
            />
            <div className="text-[11px] font-mono tabular-nums text-sky-400 mt-0.5 capitalize">
              Drawing Properties · {selectedDrawing.tool} (
              {Math.round(selectedDrawing.width)}×
              {Math.round(selectedDrawing.height)}px)
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => duplicateDrawing(selectedDrawing.id)}
              className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => deleteDrawing(selectedDrawing.id)}
              aria-label="Delete selected drawing"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Keyframe Bar for Selected Drawing */}
        <div className="px-3.5 py-2 bg-[#0B0F19] border-b border-slate-800/90 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Diamond
              className={`w-3.5 h-3.5 shrink-0 ${
                drKeyframeAtPlayhead
                  ? 'text-amber-400 fill-amber-400'
                  : drKeyframes.length > 1
                    ? 'text-purple-400'
                    : 'text-slate-500'
              }`}
            />
            <div className="text-[11px] font-mono tabular-nums truncate">
              <span className="text-slate-200 font-semibold">
                F{String(currentFrame).padStart(3, '0')}
              </span>
              <span className="ml-1.5 text-[10px] text-purple-300">
                · {drKeyframes.length} KF{drKeyframes.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => jumpToAdjacentKeyframe('prev')}
              title="Jump to Previous Keyframe"
              aria-label="Previous Drawing Keyframe"
              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => addKeyframeAtCurrentFrame(selectedDrawing.id)}
              title="Add or Update Drawing Keyframe at Playhead"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 transition-colors ${
                drKeyframeAtPlayhead
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-purple-500/20 hover:bg-purple-400 hover:text-slate-950 text-purple-200 border border-purple-400/50'
              }`}
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{drKeyframeAtPlayhead ? 'On KF' : 'Add KF'}</span>
            </button>
            <button
              type="button"
              onClick={() => jumpToAdjacentKeyframe('next')}
              title="Jump to Next Keyframe"
              aria-label="Next Drawing Keyframe"
              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-slate-800/80">
          {/* 1A. Size, Aspect Ratio & Transform */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Dimensions & Transform</span>
              </div>
              <button
                type="button"
                onClick={() => selectDrawing(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Done
              </button>
            </div>

            {/* Width, Lock Aspect Ratio, Height */}
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1 text-[11px] text-slate-400">
                <span>Width (px)</span>
                <input
                  type="number"
                  aria-label="Drawing Width"
                  data-testid="drawing-width-input"
                  min={16}
                  max={3840}
                  value={Math.round(selectedDrawing.width)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      width: Math.max(16, Number(e.target.value) || 16),
                      lockAspectRatio: isLockedAspect,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-100 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  updateDrawing(selectedDrawing.id, {
                    lockAspectRatio: !isLockedAspect,
                  })
                }
                aria-label="Lock Aspect Ratio"
                aria-pressed={isLockedAspect}
                data-testid="drawing-lock-aspect-toggle"
                title={
                  isLockedAspect
                    ? 'Aspect Ratio Locked (Proportional Scaling)'
                    : 'Lock Aspect Ratio for Proportional Scaling'
                }
                className={`p-1.5 rounded border transition-colors mb-0.5 ${
                  isLockedAspect
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-[#090C12] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isLockedAspect ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>

              <label className="flex-1 space-y-1 text-[11px] text-slate-400">
                <span>Height (px)</span>
                <input
                  type="number"
                  aria-label="Drawing Height"
                  data-testid="drawing-height-input"
                  min={16}
                  max={3840}
                  value={Math.round(selectedDrawing.height)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      height: Math.max(16, Number(e.target.value) || 16),
                      lockAspectRatio: isLockedAspect,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-100 outline-none"
                />
              </label>
            </div>

            {/* Position X & Y */}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Position X (px)</span>
                <input
                  type="number"
                  aria-label="Drawing Position X"
                  data-testid="drawing-pos-x-input"
                  value={Math.round(selectedDrawing.x)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      x: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 outline-none"
                />
              </label>
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Position Y (px)</span>
                <input
                  type="number"
                  aria-label="Drawing Position Y"
                  data-testid="drawing-pos-y-input"
                  value={Math.round(selectedDrawing.y)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      y: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 outline-none"
                />
              </label>
            </div>

            {/* Rotation Angle & Opacity */}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Rotation (°)</span>
                <input
                  type="number"
                  aria-label="Drawing Rotation"
                  data-testid="drawing-rotation-input"
                  min={-360}
                  max={360}
                  value={Math.round(selectedDrawing.rotation)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      rotation: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 outline-none"
                />
              </label>
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Opacity (%)</span>
                <input
                  type="number"
                  aria-label="Drawing Opacity"
                  min={5}
                  max={100}
                  value={Math.round(selectedDrawing.opacity * 100)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      opacity: Math.max(
                        0.05,
                        Math.min(1, (Number(e.target.value) || 100) / 100)
                      ),
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 focus:border-sky-400 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200 outline-none"
                />
              </label>
            </div>

            {/* Line / Arrow Start & End Coordinates */}
            {isLineOrArrow && (
              <div className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Line / Arrow Endpoints (Canvas px)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-0.5 text-[10px] text-slate-400">
                    <span>Start X</span>
                    <input
                      type="number"
                      aria-label="Line Start X"
                      value={startPt.x}
                      onChange={(e) => {
                        const next = updateDrawingLineEndpoints(
                          rawSelectedDrawing,
                          Number(e.target.value) || 0,
                          startPt.y,
                          endPt.x,
                          endPt.y
                        );
                        updateDrawing(selectedDrawing.id, next);
                      }}
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                    />
                  </label>
                  <label className="space-y-0.5 text-[10px] text-slate-400">
                    <span>Start Y</span>
                    <input
                      type="number"
                      aria-label="Line Start Y"
                      value={startPt.y}
                      onChange={(e) => {
                        const next = updateDrawingLineEndpoints(
                          rawSelectedDrawing,
                          startPt.x,
                          Number(e.target.value) || 0,
                          endPt.x,
                          endPt.y
                        );
                        updateDrawing(selectedDrawing.id, next);
                      }}
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                    />
                  </label>
                  <label className="space-y-0.5 text-[10px] text-slate-400">
                    <span>End X</span>
                    <input
                      type="number"
                      aria-label="Line End X"
                      value={endPt.x}
                      onChange={(e) => {
                        const next = updateDrawingLineEndpoints(
                          rawSelectedDrawing,
                          startPt.x,
                          startPt.y,
                          Number(e.target.value) || 0,
                          endPt.y
                        );
                        updateDrawing(selectedDrawing.id, next);
                      }}
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                    />
                  </label>
                  <label className="space-y-0.5 text-[10px] text-slate-400">
                    <span>End Y</span>
                    <input
                      type="number"
                      aria-label="Line End Y"
                      value={endPt.y}
                      onChange={(e) => {
                        const next = updateDrawingLineEndpoints(
                          rawSelectedDrawing,
                          startPt.x,
                          startPt.y,
                          endPt.x,
                          Number(e.target.value) || 0
                        );
                        updateDrawing(selectedDrawing.id, next);
                      }}
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Editable Pen / Bezier Control Points */}
            {(selectedDrawing.tool === 'pen' ||
              selectedDrawing.tool === 'bezier') &&
              rawSelectedDrawing.points.length >= 2 && (
                <div className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                      Path Control Points ({rawSelectedDrawing.points.length})
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      Canvas px
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {rawSelectedDrawing.points.slice(0, 6).map((pt, idx) => {
                      const wx = Math.round(rawSelectedDrawing.x + pt.x);
                      const wy = Math.round(rawSelectedDrawing.y + pt.y);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-5 items-center gap-1.5 text-[10px]"
                        >
                          <span className="font-mono text-slate-400">
                            P{idx + 1}
                          </span>
                          <input
                            type="number"
                            aria-label={`Point ${idx + 1} X`}
                            value={wx}
                            onChange={(e) => {
                              const next = updateDrawingControlPoint(
                                rawSelectedDrawing,
                                idx,
                                Number(e.target.value) || 0,
                                wy
                              );
                              updateDrawing(selectedDrawing.id, next);
                            }}
                            className="col-span-2 bg-[#0E131D] border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-slate-200"
                          />
                          <input
                            type="number"
                            aria-label={`Point ${idx + 1} Y`}
                            value={wy}
                            onChange={(e) => {
                              const next = updateDrawingControlPoint(
                                rawSelectedDrawing,
                                idx,
                                wx,
                                Number(e.target.value) || 0
                              );
                              updateDrawing(selectedDrawing.id, next);
                            }}
                            className="col-span-2 bg-[#0E131D] border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-slate-200"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>

          {/* 1B. Timeline Clip Timing & Trim/Split (Immediately Accessible) */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Film className="w-3.5 h-3.5 text-purple-400" />
                <span>Timeline Clip Timing & Trim</span>
              </div>
              <span className="text-[10px] font-mono text-purple-300">
                {formatTimecode(rawSelectedDrawing.startFrame ?? 0, fps)} –{' '}
                {formatTimecode(
                  (rawSelectedDrawing.startFrame ?? 0) +
                    (rawSelectedDrawing.durationFrames ?? durationInFrames),
                  fps
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Start (F)</span>
                <input
                  type="number"
                  aria-label="Drawing Start Frame"
                  data-testid="drawing-start-frame-input"
                  min={0}
                  max={Math.max(0, durationInFrames - 5)}
                  value={rawSelectedDrawing.startFrame ?? 0}
                  onChange={(e) => {
                    const nextStart = Math.max(
                      0,
                      Math.min(
                        durationInFrames - 5,
                        Number(e.target.value) || 0
                      )
                    );
                    updateDrawing(selectedDrawing.id, {
                      startFrame: nextStart,
                      durationFrames:
                        rawSelectedDrawing.durationFrames ??
                        Math.max(5, durationInFrames - nextStart),
                    });
                  }}
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>End (F)</span>
                <input
                  type="number"
                  aria-label="Drawing End Frame"
                  data-testid="drawing-end-frame-input"
                  min={(rawSelectedDrawing.startFrame ?? 0) + 5}
                  max={durationInFrames * 2}
                  value={
                    (rawSelectedDrawing.startFrame ?? 0) +
                    (rawSelectedDrawing.durationFrames ?? durationInFrames)
                  }
                  onChange={(e) => {
                    const st = rawSelectedDrawing.startFrame ?? 0;
                    const nextEnd = Math.max(
                      st + 5,
                      Number(e.target.value) || st + 30
                    );
                    updateDrawing(selectedDrawing.id, {
                      startFrame: st,
                      durationFrames: nextEnd - st,
                    });
                  }}
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Duration (F)</span>
                <input
                  type="number"
                  aria-label="Drawing Duration Frames"
                  data-testid="drawing-duration-frames-input"
                  min={5}
                  max={durationInFrames * 2}
                  value={rawSelectedDrawing.durationFrames ?? durationInFrames}
                  onChange={(e) => {
                    const nextDur = Math.max(5, Number(e.target.value) || 30);
                    updateDrawing(selectedDrawing.id, {
                      startFrame: rawSelectedDrawing.startFrame ?? 0,
                      durationFrames: nextDur,
                    });
                  }}
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => trimSelectedClipToPlayhead('left')}
                className="py-1 px-2 rounded bg-[#090C12] hover:bg-purple-500/20 border border-slate-800 hover:border-purple-400 text-[11px] font-mono text-purple-300 transition-colors"
              >
                [ Trim In
              </button>
              <button
                type="button"
                onClick={splitSelectedClipAtPlayhead}
                className="py-1 px-2 rounded bg-purple-500/20 hover:bg-purple-400 hover:text-slate-950 border border-purple-500/40 text-[11px] font-semibold text-purple-200 flex items-center justify-center gap-1 transition-colors"
              >
                <Scissors className="w-3 h-3" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => trimSelectedClipToPlayhead('right')}
                className="py-1 px-2 rounded bg-[#090C12] hover:bg-purple-500/20 border border-slate-800 hover:border-purple-400 text-[11px] font-mono text-purple-300 transition-colors"
              >
                Trim Out ]
              </button>
            </div>
          </div>

          {/* 1C. Animated Path, Entrance/Exit & Glow Controls */}
          <div className="pt-4 space-y-3">
            <div className="text-xs font-semibold text-slate-200">
              Path & Glow Animation
            </div>

            <label className="block space-y-1 text-[11px] text-slate-400">
              <span>Animation Mode</span>
              <select
                aria-label="Drawing Animation Mode"
                value={selectedDrawing.animationMode}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    animationMode: e.target.value as DrawingAnimationMode,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="neon-trace">Travelling Neon Trace</option>
                <option value="draw-on">Draw-On Path Reveal</option>
                <option value="stroke-reveal">Animated Stroke Reveal (Loop)</option>
                <option value="moving-light">Moving Light Along Path</option>
                <option value="pulsing-outline">Pulsing Glow Outline</option>
                <option value="color-shift">Neon Colour Cycle</option>
                <option value="none">Static Glow (None)</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Entrance</span>
                <select
                  aria-label="Drawing Entrance Animation"
                  value={rawSelectedDrawing.entranceAnimation || 'none'}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      entranceAnimation: e.target
                        .value as typeof rawSelectedDrawing.entranceAnimation,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="none">None</option>
                  <option value="draw-on">Draw-On</option>
                  <option value="fade-in">Fade In</option>
                  <option value="scale-pop">Scale Pop</option>
                </select>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Exit</span>
                <select
                  aria-label="Drawing Exit Animation"
                  value={rawSelectedDrawing.exitAnimation || 'none'}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      exitAnimation: e.target
                        .value as typeof rawSelectedDrawing.exitAnimation,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="none">None</option>
                  <option value="fade-out">Fade Out</option>
                  <option value="scale-down">Scale Down</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Speed (x)</span>
                <input
                  type="number"
                  step={0.2}
                  min={0.2}
                  max={5}
                  value={selectedDrawing.animationSpeed}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      animationSpeed: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Easing</span>
                <select
                  value={selectedDrawing.animationEasing}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      animationEasing: e.target.value as EasingType,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="linear">Linear</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="ease-in-out">Ease In-Out</option>
                  <option value="cubic-bezier">Cubic Bezier</option>
                  <option value="spring">Spring</option>
                </select>
              </label>
            </div>
          </div>

          {/* 1D. Stroke, Fill & Vector Geometry */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span>Stroke, Fill & Vector Style</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Stroke Colour</span>
                <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    aria-label="Drawing Stroke Colour"
                    value={selectedDrawing.strokeColor}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        strokeColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-slate-300">
                    {selectedDrawing.strokeColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Gradient End</span>
                <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    aria-label="Drawing Gradient End Colour"
                    value={selectedDrawing.strokeColorEnd}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        strokeColorEnd: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-slate-300">
                    {selectedDrawing.strokeColorEnd}
                  </span>
                </div>
              </label>
            </div>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span>Use Two-Tone Gradient Stroke</span>
              <input
                type="checkbox"
                checked={selectedDrawing.useGradientStroke}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    useGradientStroke: e.target.checked,
                  })
                }
                className="accent-sky-400"
              />
            </label>

            <label className="block space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Stroke Width</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {Math.round(selectedDrawing.strokeWidth)}px
                </span>
              </div>
              <input
                type="range"
                aria-label="Drawing Stroke Width"
                min={1}
                max={48}
                value={selectedDrawing.strokeWidth}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    strokeWidth: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400"
              />
            </label>

            {/* Fill Colour & Fill Opacity */}
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Fill Colour</span>
                <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    aria-label="Drawing Fill Colour"
                    value={selectedDrawing.fillColor || '#22D3EE'}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        fillColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-slate-300">
                    {selectedDrawing.fillColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Fill Opacity (%)</span>
                <input
                  type="number"
                  aria-label="Drawing Fill Opacity"
                  min={0}
                  max={100}
                  value={Math.round((selectedDrawing.fillOpacity ?? 0) * 100)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      fillOpacity: Math.max(
                        0,
                        Math.min(1, (Number(e.target.value) || 0) / 100)
                      ),
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>
            </div>

            {/* Line Cap & Line Join */}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Line Cap</span>
                <select
                  aria-label="Drawing Line Cap"
                  value={selectedDrawing.lineCap}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      lineCap: e.target.value as typeof selectedDrawing.lineCap,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="round">Round</option>
                  <option value="butt">Butt</option>
                  <option value="square">Square</option>
                </select>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Line Join</span>
                <select
                  aria-label="Drawing Line Join"
                  value={selectedDrawing.lineJoin}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      lineJoin:
                        e.target.value as typeof selectedDrawing.lineJoin,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="round">Round</option>
                  <option value="bevel">Bevel</option>
                  <option value="miter">Miter</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Dash Style</span>
                <select
                  aria-label="Drawing Dash Style"
                  value={selectedDrawing.dashPattern}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      dashPattern:
                        e.target.value as typeof selectedDrawing.dashPattern,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="long-dash">Long Dash</option>
                </select>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Corner Radius</span>
                <input
                  type="number"
                  aria-label="Drawing Corner Radius"
                  min={0}
                  max={160}
                  value={Math.round(selectedDrawing.cornerRadius)}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      cornerRadius: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                />
              </label>
            </div>
          </div>

          {/* 1E. Neon Outer Glow */}
          <div className="pt-4 space-y-3">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-200 cursor-pointer">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Outer Neon Path Glow
              </span>
              <input
                type="checkbox"
                checked={selectedDrawing.glowEnabled}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    glowEnabled: e.target.checked,
                  })
                }
                className="accent-sky-400"
              />
            </label>

            {selectedDrawing.glowEnabled && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">Glow Colour</span>
                  <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                    <input
                      type="color"
                      aria-label="Drawing Glow Colour"
                      value={selectedDrawing.glowColor}
                      onChange={(e) =>
                        updateDrawing(selectedDrawing.id, {
                          glowColor: e.target.value,
                        })
                      }
                      className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-slate-300">
                      {selectedDrawing.glowColor}
                    </span>
                  </div>
                </div>

                <label className="block space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Glow Radius</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {Math.round(selectedDrawing.glowRadius)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Drawing Glow Radius"
                    min={4}
                    max={90}
                    value={selectedDrawing.glowRadius}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        glowRadius: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                </label>

                <label className="block space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Glow Intensity</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {Math.round(selectedDrawing.glowIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Drawing Glow Intensity"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={selectedDrawing.glowIntensity}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        glowIntensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                </label>

                <label className="block space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Glow Opacity</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {Math.round((selectedDrawing.glowOpacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Drawing Glow Opacity"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedDrawing.glowOpacity ?? 1}
                    onChange={(e) =>
                      updateDrawing(selectedDrawing.id, {
                        glowOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // 2. TIMELINE CLIP INSPECTOR
  if (selectedClip) {
    const outFrame =
      selectedClip.sourceOutFrame ??
      selectedClip.trimStartFrames +
        Math.round(
          selectedClip.durationFrames * (selectedClip.playbackSpeed || 1)
        );
    const clipEndFrame = selectedClip.startFrame + selectedClip.durationFrames;
    const startTc = formatTimecode(selectedClip.startFrame, fps);
    const endTc = formatTimecode(clipEndFrame, fps);
    const durSec = (selectedClip.durationFrames / Math.max(1, fps)).toFixed(2);
    return (
      <aside
        aria-label="Object Properties Inspector"
        className="w-80 bg-[#0E131D] border-l border-slate-800/90 flex flex-col h-full select-none shrink-0"
      >
        <div className="px-4 py-3 border-b border-slate-800/90 bg-[#111724] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {selectedClip.name}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
              {startTc} – {endTc} ({selectedClip.durationFrames}f · {durSec}s)
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectClip(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Done
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Film className="w-3.5 h-3.5 text-emerald-400" />
              <span>Non-Destructive Clip Trim</span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-slate-400">
              Playhead: F{currentFrame} ({formatTimecode(currentFrame, fps)})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Timeline Start (F)</span>
              <input
                type="number"
                min={0}
                value={selectedClip.startFrame}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    startFrame: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Visible Duration (F)</span>
              <input
                type="number"
                min={5}
                value={selectedClip.durationFrames}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    durationFrames: Math.max(5, Number(e.target.value) || 30),
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Source In-Point (F)</span>
              <input
                type="number"
                min={0}
                value={selectedClip.trimStartFrames}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    trimStartFrames: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>

            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Source Out-Point (F)</span>
              <input
                type="number"
                disabled
                value={outFrame}
                className="w-full bg-[#090C12]/60 border border-slate-800/80 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-400"
              />
            </label>
          </div>

          <label className="block space-y-1 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Playback Speed</span>
              <span className="font-mono text-slate-300">
                {(selectedClip.playbackSpeed || 1).toFixed(2)}x
              </span>
            </div>
            <select
              aria-label="Clip Playback Speed"
              value={selectedClip.playbackSpeed || 1}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  playbackSpeed: Number(e.target.value) || 1,
                })
              }
              className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value={0.5}>0.50x (Slow Motion)</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1.00x (Normal)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.50x (Fast)</option>
              <option value={2}>2.00x (Double Speed)</option>
            </select>
          </label>

          {/* Trim & Split Actions at Playhead */}
          <div className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Playhead Cut & Trim Actions (F{currentFrame})
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => trimSelectedClipToPlayhead('left')}
                className="py-1.5 px-2 bg-slate-800/90 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 rounded text-[11px] font-medium transition-colors"
              >
                [ Trim In Here
              </button>
              <button
                type="button"
                onClick={() => trimSelectedClipToPlayhead('right')}
                className="py-1.5 px-2 bg-slate-800/90 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 rounded text-[11px] font-medium transition-colors"
              >
                Trim Out Here ]
              </button>
            </div>
            <button
              type="button"
              onClick={splitSelectedClipAtPlayhead}
              className="w-full py-1.5 px-2.5 bg-sky-500/20 hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-sky-500/40 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Scissors className="w-3.5 h-3.5" />
              Split Clip at Playhead (F{currentFrame})
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={duplicateSelectedClip}
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Duplicate Clip
            </button>
            <button
              type="button"
              onClick={deleteSelectedClip}
              className="py-1.5 px-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
            >
              Delete Clip
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // 3. EMPTY SELECTION STATE
  if (!rawSelectedDevice) {
    return (
      <aside
        aria-label="Object Properties Inspector"
        className="w-80 bg-[#0E131D] border-l border-slate-800/90 p-5 flex flex-col justify-center items-center text-center select-none shrink-0"
      >
        <Sliders className="w-7 h-7 text-slate-600 mb-2" />
        <div className="text-xs font-semibold text-slate-300">
          No Object Selected
        </div>
        <p className="text-[11px] text-slate-500 mt-1 max-w-[210px]">
          Click any device, neon drawing, or timeline clip to inspect colours,
          full-perimeter glow, and keyframe animations.
        </p>
      </aside>
    );
  }

  const deviceTrack = tracks.find((t) => t.targetId === rawSelectedDevice.id);
  const trackKeyframes = deviceTrack ? deviceTrack.keyframes : [];
  const selectedDevice = resolveDeviceAtFrame(
    rawSelectedDevice,
    trackKeyframes,
    currentFrame,
    durationInFrames
  );
  const keyframeAtPlayhead = trackKeyframes.find(
    (k) => k.frame === currentFrame
  );
  const isAnimatedTrack = trackKeyframes.length > 1;

  const preset = getDevicePresetById(selectedDevice.presetId);
  const st = selectedDevice.screenTransform;
  const fx = selectedDevice.effects;
  const bt = { ...DEFAULT_BROWSER_THEME, ...(selectedDevice.browserTheme || {}) };

  return (
    <aside
      aria-label="Object Properties Inspector"
      className="w-80 bg-[#0E131D] border-l border-slate-800/90 flex flex-col h-full select-none shrink-0"
    >
      {/* Inspector Header */}
      <div className="px-4 py-3 border-b border-slate-800/90 bg-[#111724] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <input
            type="text"
            aria-label="Selected device name"
            value={rawSelectedDevice.name}
            onChange={(e) =>
              updateDevice(rawSelectedDevice.id, { name: e.target.value })
            }
            className="bg-transparent text-xs font-semibold text-slate-100 border-b border-transparent focus:border-sky-400 outline-none truncate w-full"
          />
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
            {preset.brand} · {preset.width}×{preset.height}px
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={duplicateSelectedDevices}
            className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={deleteSelectedDevices}
            aria-label="Delete selected device"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Keyframe Playhead Readout & Quick Controls */}
      <div className="px-3.5 py-2 bg-[#0B0F19] border-b border-slate-800/90 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Diamond
            className={`w-3.5 h-3.5 shrink-0 ${
              keyframeAtPlayhead
                ? 'text-amber-400 fill-amber-400'
                : isAnimatedTrack
                  ? 'text-cyan-400'
                  : 'text-slate-500'
            }`}
          />
          <div className="text-[11px] font-mono truncate">
            <span className="text-slate-200 font-semibold">
              F{String(currentFrame).padStart(3, '0')}
            </span>{' '}
            <span className="text-slate-400">
              ({(currentFrame / fps).toFixed(2)}s)
            </span>
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan-300">
              {trackKeyframes.length} KF{trackKeyframes.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => jumpToAdjacentKeyframe('prev')}
            title="Jump to Previous Keyframe"
            aria-label="Previous Keyframe"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => addKeyframeAtCurrentFrame(rawSelectedDevice.id)}
            title="Add or Update Keyframe at Current Playhead Frame"
            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-0.5 transition-colors ${
              keyframeAtPlayhead
                ? 'bg-amber-400 text-slate-950'
                : 'bg-cyan-500/20 hover:bg-cyan-400 hover:text-slate-950 text-cyan-300 border border-cyan-500/40'
            }`}
          >
            <Plus className="w-2.5 h-2.5" />
            <span>{keyframeAtPlayhead ? 'On KF' : 'Add KF'}</span>
          </button>
          <button
            type="button"
            onClick={() => jumpToAdjacentKeyframe('next')}
            title="Jump to Next Keyframe"
            aria-label="Next Keyframe"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          {trackKeyframes.length > 1 && (
            <button
              type="button"
              onClick={() => clearTrackKeyframes(rawSelectedDevice.id)}
              title="Reset Track Keyframes"
              aria-label="Reset Track Keyframes"
              className="p-1 rounded bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Inspector Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-5 divide-y divide-slate-800/80">
        {/* 1. Hardware Model & Screen Media Assignment */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Hardware Frame & Screen Source</span>
          </div>

          <label className="block space-y-1 text-xs text-slate-400">
            <span>Device Hardware Preset</span>
            <select
              aria-label="Device Hardware Preset"
              value={selectedDevice.presetId}
              onChange={(e) => {
                const nextPreset = getDevicePresetById(e.target.value);
                updateDevice(selectedDevice.id, {
                  presetId: nextPreset.id,
                  width: nextPreset.width,
                  height: nextPreset.height,
                });
              }}
              className="w-full bg-[#090C12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              {DEVICE_CATALOG.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.brand})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs text-slate-400">
            <span>Screen Media Source</span>
            <select
              aria-label="Screen Media Source"
              value={selectedDevice.mediaId || ''}
              onChange={(e) =>
                assignMediaToDevice(selectedDevice.id, e.target.value || null)
              }
              className="w-full bg-[#090C12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              {mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.aspectRatio})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 2. Context-Specific Browser & Website Theme Controls (when category === 'browser') */}
        {preset.category === 'browser' && (
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
              <Globe className="w-3.5 h-3.5" />
              <span>Browser & Website Theme</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Toolbar Colour</span>
                <div className="flex items-center gap-1.5 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    value={bt.toolbarColor}
                    onChange={(e) =>
                      updateDeviceBrowserTheme(selectedDevice.id, {
                        toolbarColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-300">
                    {bt.toolbarColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Active Tab Colour</span>
                <div className="flex items-center gap-1.5 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    value={bt.tabColor}
                    onChange={(e) =>
                      updateDeviceBrowserTheme(selectedDevice.id, {
                        tabColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-300">
                    {bt.tabColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Website Page BG</span>
                <div className="flex items-center gap-1.5 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    value={bt.websiteBgColor}
                    onChange={(e) =>
                      updateDeviceBrowserTheme(selectedDevice.id, {
                        websiteBgColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-300">
                    {bt.websiteBgColor}
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Website Accent</span>
                <div className="flex items-center gap-1.5 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                  <input
                    type="color"
                    value={bt.websiteAccentColor}
                    onChange={(e) =>
                      updateDeviceBrowserTheme(selectedDevice.id, {
                        websiteAccentColor: e.target.value,
                      })
                    }
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-300">
                    {bt.websiteAccentColor}
                  </span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Window Controls</span>
                <select
                  value={bt.controlButtonsStyle}
                  onChange={(e) =>
                    updateDeviceBrowserTheme(selectedDevice.id, {
                      controlButtonsStyle:
                        e.target.value as typeof bt.controlButtonsStyle,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="macos">macOS Traffic Lights</option>
                  <option value="minimal">Arc Minimal Pills</option>
                  <option value="windows">Windows Caption</option>
                </select>
              </label>

              <label className="space-y-1 text-[11px] text-slate-400">
                <span>Address Bar URL</span>
                <input
                  type="text"
                  value={bt.customUrlText}
                  onChange={(e) =>
                    updateDeviceBrowserTheme(selectedDevice.id, {
                      customUrlText: e.target.value,
                    })
                  }
                  className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                />
              </label>
            </div>
          </div>
        )}

        {/* 3. Full-Perimeter Outer Glow & Inner Glow Studio */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Full-Perimeter Glow & Effects</span>
          </div>

          {/* Chassis Finish & Corner Radius */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Chassis Colour</span>
              <div className="flex items-center gap-2 bg-[#090C12] border border-slate-800 rounded px-2 py-1">
                <input
                  type="color"
                  value={selectedDevice.customFrameColor || preset.frameColor}
                  onChange={(e) =>
                    updateDevice(selectedDevice.id, {
                      customFrameColor: e.target.value,
                    })
                  }
                  className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                />
                <span className="font-mono text-slate-300">
                  {selectedDevice.customFrameColor || preset.frameColor}
                </span>
              </div>
            </label>

            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Finish Style</span>
              <select
                value={selectedDevice.finishStyle || 'brushed'}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    finishStyle: e.target.value as DeviceFinishStyle,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="brushed">Brushed Metal</option>
                <option value="matte">Matte Satin</option>
                <option value="polished">Polished Gloss</option>
                <option value="glass">Optical Glass</option>
                <option value="metallic-gradient">Metallic Gradient</option>
              </select>
            </label>
          </div>

          {/* Full-Perimeter Outer Glow Card */}
          <div className="p-3 rounded-xl bg-[#090C12] border border-slate-800 space-y-2.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-200 cursor-pointer">
              <span>Full-Perimeter Silhouette Glow</span>
              <input
                type="checkbox"
                checked={fx.glowEnabled}
                onChange={(e) =>
                  updateDeviceEffects(selectedDevice.id, {
                    glowEnabled: e.target.checked,
                  })
                }
                className="accent-sky-400"
              />
            </label>

            {fx.glowEnabled && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[11px] text-slate-400">
                    <span>Primary Glow</span>
                    <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                      <input
                        type="color"
                        aria-label="Glow Color"
                        value={fx.glowColor}
                        onChange={(e) =>
                          updateDeviceEffects(selectedDevice.id, {
                            glowColor: e.target.value,
                          })
                        }
                        className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-slate-300">
                        {fx.glowColor}
                      </span>
                    </div>
                  </label>

                  <label className="space-y-1 text-[11px] text-slate-400">
                    <span>Secondary Glow</span>
                    <div className="flex items-center gap-1.5 bg-[#0E131D] border border-slate-800 rounded px-2 py-1">
                      <input
                        type="color"
                        aria-label="Secondary Glow Color"
                        value={fx.glowSecondaryColor || '#A855F7'}
                        onChange={(e) =>
                          updateDeviceEffects(selectedDevice.id, {
                            glowSecondaryColor: e.target.value,
                          })
                        }
                        className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-slate-300">
                        {fx.glowSecondaryColor || '#A855F7'}
                      </span>
                    </div>
                  </label>
                </div>

                <label className="block space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Glow Radius & Spread</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {Math.round(fx.glowBlur)}px · +{fx.glowSpread ?? 12}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={110}
                    value={fx.glowBlur}
                    onChange={(e) =>
                      updateDeviceEffects(selectedDevice.id, {
                        glowBlur: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Intensity</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {Math.round(fx.glowIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.4}
                      step={0.05}
                      aria-label="Glow Intensity"
                      value={fx.glowIntensity}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          glowIntensity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>

                  <label className="block space-y-1 text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Spread</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {fx.glowSpread ?? 12}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={fx.glowSpread ?? 12}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          glowSpread: Number(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                </div>

                {/* Animated Glow Mode & Speed */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <label className="col-span-2 space-y-1 text-[11px] text-slate-400">
                    <span>Animated Glow Mode</span>
                    <select
                      aria-label="Animated Glow Mode"
                      value={
                        fx.glowAnimationMode ||
                        (fx.animatedGlow ? 'pulse' : 'none')
                      }
                      onChange={(e) => {
                        const mode = e.target.value as GlowAnimationMode;
                        updateDeviceEffects(selectedDevice.id, {
                          glowAnimationMode: mode,
                          animatedGlow: mode !== 'none',
                        });
                      }}
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="none">Static Silhouette</option>
                      <option value="perimeter-sweep">
                        Perimeter Highlight Sweep
                      </option>
                      <option value="neon-sweep">Neon Border Sweep</option>
                      <option value="pulse">Pulse Glow</option>
                      <option value="breathing">Breathing Halo</option>
                      <option value="rainbow-cycle">Rainbow Spectrum</option>
                      <option value="rotating-gradient">
                        Rotating Gradient
                      </option>
                      <option value="intensity-wave">Intensity Wave</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-[11px] text-slate-400">
                    <span>Speed (x)</span>
                    <input
                      type="number"
                      min={0.2}
                      max={4}
                      step={0.2}
                      value={fx.glowSpeed ?? 1.0}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          glowSpeed: Number(e.target.value) || 1.0,
                        })
                      }
                      className="w-full bg-[#0E131D] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
                    />
                  </label>
                </div>

                {/* Inner Screen Edge Glow */}
                <label className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80 cursor-pointer">
                  <span>Inner Screen Edge Glow</span>
                  <input
                    type="checkbox"
                    checked={Boolean(fx.innerGlowEnabled)}
                    onChange={(e) =>
                      updateDeviceEffects(selectedDevice.id, {
                        innerGlowEnabled: e.target.checked,
                      })
                    }
                    className="accent-sky-400"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Drop Shadow & Effect Stack Order */}
          <div className="p-2.5 rounded-lg bg-[#090C12] border border-slate-800 space-y-2">
            <label className="flex items-center justify-between text-xs font-medium text-slate-200 cursor-pointer">
              <span>Studio Drop Shadow</span>
              <input
                type="checkbox"
                checked={fx.shadowEnabled}
                onChange={(e) =>
                  updateDeviceEffects(selectedDevice.id, {
                    shadowEnabled: e.target.checked,
                  })
                }
                className="accent-sky-400"
              />
            </label>
            {fx.shadowEnabled && (
              <label className="block space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Shadow Softness</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(fx.shadowBlur)}px
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={90}
                  value={fx.shadowBlur}
                  onChange={(e) =>
                    updateDeviceEffects(selectedDevice.id, {
                      shadowBlur: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400"
                />
              </label>
            )}
          </div>
        </div>

        {/* 4. Ready-Made Multi-Keyframe Animation Presets */}
        <div className="pt-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Wand2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Multi-Keyframe Animation Presets</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <select
              aria-label="Animation Preset"
              value={selectedAnimPreset}
              onChange={(e) =>
                setSelectedAnimPreset(e.target.value as AnimationPresetId)
              }
              className="flex-1 min-w-0 truncate bg-[#090C12] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
            >
              {ANIMATION_PRESETS.map((ap) => (
                <option key={ap.id} value={ap.id}>
                  {ap.name} ({ap.category})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                applyAnimationPresetToDevice(
                  selectedDevice.id,
                  selectedAnimPreset
                )
              }
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Apply Preset
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {
              ANIMATION_PRESETS.find((a) => a.id === selectedAnimPreset)
                ?.description
            }
          </p>
        </div>

        {/* 5. Screen Fitting, Zoom & Crop */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Crop className="w-3.5 h-3.5 text-sky-400" />
              <span>Screen Fit & Crop</span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateDeviceScreenTransform(selectedDevice.id, {
                  fitMode: 'cover',
                  zoom: 1,
                  offsetX: 0,
                  offsetY: 0,
                  cropX: 0,
                  cropY: 0,
                  cropWidth: 1,
                  cropHeight: 1,
                })
              }
              className="text-[11px] text-sky-400 hover:underline"
            >
              Reset Fit
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-[#090C12] p-1 rounded-lg border border-slate-800">
            {(['cover', 'contain', 'stretch', 'crop'] as ScreenFitMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    updateDeviceScreenTransform(selectedDevice.id, {
                      fitMode: mode,
                    })
                  }
                  className={`py-1 rounded text-[11px] font-medium capitalize transition-colors ${
                    st.fitMode === mode
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              )
            )}
          </div>

          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Screen Content Zoom</span>
              <span className="font-mono tabular-nums text-slate-300">
                {Math.round(st.zoom * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              aria-label="Screen Content Zoom"
              value={st.zoom}
              onChange={(e) =>
                updateDeviceScreenTransform(selectedDevice.id, {
                  zoom: parseFloat(e.target.value),
                })
              }
              className="w-full accent-sky-400"
            />
          </label>
        </div>

        {/* 6. 2D Transform & 3D Orientation */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>2D & 3D Transform</span>
            </div>
            {isAnimatedTrack && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                ◆ Animated @ F{currentFrame}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Position X (px)</span>
              <input
                type="number"
                aria-label="Position X"
                value={Math.round(selectedDevice.x)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    x: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Position Y (px)</span>
              <input
                type="number"
                aria-label="Position Y"
                value={Math.round(selectedDevice.y)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    y: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Scale (%)</span>
              <input
                type="number"
                aria-label="Device Scale Percent"
                min={20}
                max={300}
                step={5}
                value={Math.round(selectedDevice.scaleX * 100)}
                onChange={(e) => {
                  const s = Math.max(
                    0.2,
                    (Number(e.target.value) || 100) / 100
                  );
                  updateDevice(selectedDevice.id, { scaleX: s, scaleY: s });
                }}
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>2D Angle (°)</span>
              <input
                type="number"
                aria-label="2D Rotation Angle"
                step={5}
                value={Math.round(selectedDevice.rotation)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    rotation: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Pitch X (°)</span>
              <input
                type="number"
                step={5}
                value={Math.round(selectedDevice.rotation3DX)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    rotation3DX: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Yaw Y (°)</span>
              <input
                type="number"
                step={5}
                value={Math.round(selectedDevice.rotation3DY)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    rotation3DY: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
            <label className="space-y-1 text-[11px] text-slate-400">
              <span>Roll Z (°)</span>
              <input
                type="number"
                step={5}
                value={Math.round(selectedDevice.rotation3DZ)}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, {
                    rotation3DZ: Number(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#090C12] border border-slate-800 rounded px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
              />
            </label>
          </div>
        </div>
      </div>
    </aside>
  );
};
