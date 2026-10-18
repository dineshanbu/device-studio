import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clipboard,
  Copy,
  Diamond,
  Eye,
  EyeOff,
  Film,
  Lock,
  Maximize2,
  Pause,
  PenTool,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Spline,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ANIMATION_PRESETS } from '../device-catalog/catalog.ts';
import {
  applyClipTrimWithRipple,
  canSplitAtPlayhead,
  computeAdaptiveRulerTicks,
  computeClipFilmstripThumbs,
  computeFitTimelineZoom,
  computeTimelineMetrics,
  computeTrimmedDrawingClip,
  formatShortTimecode,
  formatTimecode,
  frameToPixel,
  pixelToFrame,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type {
  AnimationPresetId,
  EasingType,
  SceneDrawingObject,
  TimelineClip,
} from '../shared/types.ts';

export const TimelinePanel: React.FC = () => {
  const {
    currentFrame,
    durationInFrames,
    fps,
    isPlaying,
    loopPlayback,
    autoKeyframe,
    showMotionTrail,
    rippleTrimMode,
    autoScrollTimeline,
    trackHeightMode,
    timelineCollapsed,
    lastTimelineNotice,
    devices,
    drawings,
    clips,
    tracks,
    selectedIds,
    selectedDrawingId,
    selectedClipId,
    selectedKeyframe,
    copiedKeyframe,
    setCurrentFrame,
    setIsPlaying,
    stepFrame,
    jumpToAdjacentKeyframe,
    toggleTrackExpanded,
    clearTrackKeyframes,
    setLoopPlayback,
    setAutoKeyframe,
    toggleMotionTrail,
    setRippleTrimMode,
    setAutoScrollTimeline,
    setTrackHeightMode,
    setTimelineCollapsed,
    setTimelineSettings,
    selectDevice,
    updateDevice,
    reorderDeviceLayer,
    selectDrawing,
    updateDrawing,
    duplicateDrawing,
    deleteDrawing,
    selectClip,
    updateClip,
    updateClipsBatch,
    addLongDemoVideo,
    trimSelectedClipToPlayhead,
    splitSelectedClipAtPlayhead,
    duplicateSelectedClip,
    deleteSelectedClip,
    setSelectedKeyframe,
    addKeyframeAtCurrentFrame,
    moveKeyframe,
    duplicateKeyframe,
    copyKeyframe,
    pasteKeyframeAtPlayhead,
    deleteKeyframe,
    updateKeyframeEasing,
    applyAnimationPresetToDevice,
    pushHistory,
    undo,
    redo,
  } = useStudioStore();

  const [selectedEasing, setSelectedEasing] =
    useState<EasingType>('ease-in-out');
  const [quickPreset, setQuickPreset] =
    useState<AnimationPresetId>('smooth-scale');
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [viewportWidth, setViewportWidth] = useState<number>(1000);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState<boolean>(false);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState<{
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const [draggingKf, setDraggingKf] = useState<{
    trackId: string;
    keyframeId: string;
  } | null>(null);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    startX: number;
    origClip: TimelineClip;
    origClipsSnapshot: TimelineClip[];
    livePreviewLabel?: string;
  } | null>(null);
  const [draggingDrawingClip, setDraggingDrawingClip] = useState<{
    drawingId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    startX: number;
    origDrawing: SceneDrawingObject;
    livePreviewLabel?: string;
  } | null>(null);
  const [isPanningTimeline, setIsPanningTimeline] = useState<{
    startX: number;
    startScrollLeft: number;
  } | null>(null);

  const trackLaneContainerRef = useRef<HTMLDivElement | null>(null);
  const leftHeadersScrollRef = useRef<HTMLDivElement | null>(null);
  const rightLanesScrollRef = useRef<HTMLDivElement | null>(null);
  const customScrollbarTrackRef = useRef<HTMLDivElement | null>(null);

  // Measure timeline viewport width with ResizeObserver
  useEffect(() => {
    const el = rightLanesScrollRef.current;
    if (!el) return;
    const updateSize = () => {
      setViewportWidth(Math.max(320, el.clientWidth || 1000));
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineCollapsed]);

  // Shared Coordinate Metrics (frameToPixel / pixelToFrame / pixelsPerSecond)
  const metrics = useMemo(
    () =>
      computeTimelineMetrics(
        durationInFrames,
        fps,
        timelineZoom,
        viewportWidth
      ),
    [durationInFrames, fps, timelineZoom, viewportWidth]
  );

  const rowHeightClass =
    trackHeightMode === 'compact'
      ? 'h-7'
      : trackHeightMode === 'tall'
        ? 'h-12'
        : 'h-9';
  const clipBarHeightClass =
    trackHeightMode === 'compact'
      ? 'h-5'
      : trackHeightMode === 'tall'
        ? 'h-9'
        : 'h-7';

  // Playback requestAnimationFrame loop + Playhead Auto-Scroll
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTime = performance.now();
    const frameInterval = 1000 / fps;

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      if (elapsed >= frameInterval) {
        lastTime = now - (elapsed % frameInterval);
        const state = useStudioStore.getState();
        const next = state.currentFrame + 1;
        if (next >= state.durationInFrames) {
          if (state.loopPlayback) {
            state.setCurrentFrame(0);
            if (state.autoScrollTimeline && rightLanesScrollRef.current) {
              rightLanesScrollRef.current.scrollLeft = 0;
            }
          } else {
            state.setCurrentFrame(state.durationInFrames - 1);
            state.setIsPlaying(false);
            return;
          }
        } else {
          state.setCurrentFrame(next);
          if (state.autoScrollTimeline && rightLanesScrollRef.current) {
            const scrollEl = rightLanesScrollRef.current;
            const playheadPx = frameToPixel(
              next,
              timelineZoom,
              0,
              state.fps
            );
            const rightEdge = scrollEl.scrollLeft + scrollEl.clientWidth * 0.88;
            if (playheadPx > rightEdge) {
              scrollEl.scrollLeft = Math.max(
                0,
                playheadPx - scrollEl.clientWidth * 0.25
              );
            } else if (playheadPx < scrollEl.scrollLeft) {
              scrollEl.scrollLeft = Math.max(0, playheadPx - 24);
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, fps, timelineZoom]);

  // Continuous playhead ruler scrubbing using shared pixelToFrame coordinate transform
  useEffect(() => {
    if (!isScrubbingRuler) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = trackLaneContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const localPx = e.clientX - rect.left;
      const targetFrame = pixelToFrame(
        localPx,
        timelineZoom,
        0,
        fps,
        durationInFrames - 1
      );
      setCurrentFrame(targetFrame);
    };
    const handleMouseUp = () => setIsScrubbingRuler(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbingRuler, timelineZoom, fps, durationInFrames, setCurrentFrame]);

  // Dragging keyframe diamond horizontally using shared pixelToFrame transform
  useEffect(() => {
    if (!draggingKf) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = trackLaneContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const localPx = e.clientX - rect.left;
      const newFrame = pixelToFrame(
        localPx,
        timelineZoom,
        0,
        fps,
        durationInFrames - 1
      );
      moveKeyframe(draggingKf.trackId, draggingKf.keyframeId, newFrame);
    };
    const handleMouseUp = () => {
      setDraggingKf(null);
      pushHistory();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingKf,
    timelineZoom,
    fps,
    durationInFrames,
    moveKeyframe,
    pushHistory,
  ]);

  // Dragging video clip body or left/right trim handles (Supports Normal Trim & Ripple Trim)
  useEffect(() => {
    if (!draggingClip) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - draggingClip.startX;
      const deltaFrames = Math.round(dx / Math.max(0.05, metrics.pixelsPerFrame));
      const orig = draggingClip.origClip;
      if (orig.locked) return;

      if (draggingClip.mode === 'move') {
        const nextStart = Math.max(0, orig.startFrame + deltaFrames);
        const nextEnd = nextStart + orig.durationFrames;
        updateClip(draggingClip.clipId, { startFrame: nextStart }, false);
        setDraggingClip((prev) =>
          prev
            ? {
                ...prev,
                livePreviewLabel: `Pos: ${formatTimecode(
                  nextStart,
                  fps
                )} → ${formatTimecode(nextEnd, fps)} (F${nextStart}–F${nextEnd})`,
              }
            : null
        );
      } else if (draggingClip.mode === 'trim-start') {
        const maxSrc =
          orig.sourceDurationFrames ?? Math.max(1800, durationInFrames * 2);
        const nextClips = applyClipTrimWithRipple(
          draggingClip.origClipsSnapshot,
          draggingClip.clipId,
          'left',
          deltaFrames,
          maxSrc,
          rippleTrimMode
        );
        updateClipsBatch(nextClips, false);
        const updated = nextClips.find((c) => c.id === draggingClip.clipId);
        if (updated) {
          setCurrentFrame(updated.startFrame);
          setDraggingClip((prev) =>
            prev
              ? {
                  ...prev,
                  livePreviewLabel: `Trim In: ${formatTimecode(
                    updated.trimStartFrames,
                    fps
                  )} (F${updated.trimStartFrames}) · Dur: ${(
                    updated.durationFrames / fps
                  ).toFixed(2)}s (${updated.durationFrames}f)`,
                }
              : null
          );
        }
      } else if (draggingClip.mode === 'trim-end') {
        const maxSrc =
          orig.sourceDurationFrames ?? Math.max(1800, durationInFrames * 2);
        const nextClips = applyClipTrimWithRipple(
          draggingClip.origClipsSnapshot,
          draggingClip.clipId,
          'right',
          deltaFrames,
          maxSrc,
          rippleTrimMode
        );
        updateClipsBatch(nextClips, false);
        const updated = nextClips.find((c) => c.id === draggingClip.clipId);
        if (updated) {
          const outF =
            updated.sourceOutFrame ??
            updated.trimStartFrames + updated.durationFrames;
          setCurrentFrame(
            Math.min(
              durationInFrames - 1,
              updated.startFrame + updated.durationFrames
            )
          );
          setDraggingClip((prev) =>
            prev
              ? {
                  ...prev,
                  livePreviewLabel: `Trim Out: ${formatTimecode(
                    outF,
                    fps
                  )} (F${outF}) · Dur: ${(
                    updated.durationFrames / fps
                  ).toFixed(2)}s (${updated.durationFrames}f)`,
                }
              : null
          );
        }
      }
    };
    const handleMouseUp = () => {
      setDraggingClip(null);
      pushHistory();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingClip,
    metrics.pixelsPerFrame,
    durationInFrames,
    fps,
    rippleTrimMode,
    updateClip,
    updateClipsBatch,
    setCurrentFrame,
    pushHistory,
  ]);

  // Dragging Neon Drawing clip body or left/right trim handles
  useEffect(() => {
    if (!draggingDrawingClip) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - draggingDrawingClip.startX;
      const deltaFrames = Math.round(dx / Math.max(0.05, metrics.pixelsPerFrame));
      const orig = draggingDrawingClip.origDrawing;
      if (orig.locked) return;
      const origStart = orig.startFrame ?? 0;
      const origDur = orig.durationFrames ?? durationInFrames;

      if (draggingDrawingClip.mode === 'move') {
        const maxStart = Math.max(0, durationInFrames * 2 - origDur);
        const nextStart = Math.max(
          0,
          Math.min(maxStart, origStart + deltaFrames)
        );
        updateDrawing(
          draggingDrawingClip.drawingId,
          {
            startFrame: nextStart,
            durationFrames: origDur,
          },
          false
        );
        setDraggingDrawingClip((prev) =>
          prev
            ? {
                ...prev,
                livePreviewLabel: `Start: F${nextStart} → End: F${
                  nextStart + origDur
                } (${origDur}f)`,
              }
            : null
        );
      } else if (draggingDrawingClip.mode === 'trim-start') {
        const trimmed = computeTrimmedDrawingClip(
          { ...orig, startFrame: origStart, durationFrames: origDur },
          'left',
          deltaFrames,
          durationInFrames * 2
        );
        updateDrawing(
          draggingDrawingClip.drawingId,
          {
            startFrame: trimmed.startFrame,
            durationFrames: trimmed.durationFrames,
          },
          false
        );
        setCurrentFrame(trimmed.startFrame ?? 0);
        setDraggingDrawingClip((prev) =>
          prev
            ? {
                ...prev,
                livePreviewLabel: `Trim Start: F${trimmed.startFrame} · Dur: ${trimmed.durationFrames}f`,
              }
            : null
        );
      } else if (draggingDrawingClip.mode === 'trim-end') {
        const trimmed = computeTrimmedDrawingClip(
          { ...orig, startFrame: origStart, durationFrames: origDur },
          'right',
          deltaFrames,
          durationInFrames * 2
        );
        updateDrawing(
          draggingDrawingClip.drawingId,
          {
            startFrame: trimmed.startFrame,
            durationFrames: trimmed.durationFrames,
          },
          false
        );
        setCurrentFrame(
          (trimmed.startFrame ?? 0) + (trimmed.durationFrames ?? origDur)
        );
        setDraggingDrawingClip((prev) =>
          prev
            ? {
                ...prev,
                livePreviewLabel: `Trim End: F${
                  (trimmed.startFrame ?? 0) +
                  (trimmed.durationFrames ?? origDur)
                } · Dur: ${trimmed.durationFrames}f`,
              }
            : null
        );
      }
    };
    const handleMouseUp = () => {
      setDraggingDrawingClip(null);
      pushHistory();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingDrawingClip,
    metrics.pixelsPerFrame,
    durationInFrames,
    updateDrawing,
    setCurrentFrame,
    pushHistory,
  ]);

  // Middle-mouse, Space+drag, or Alt-drag horizontal timeline panning
  useEffect(() => {
    if (!isPanningTimeline) return;
    const handleMouseMove = (e: MouseEvent) => {
      const scrollEl = rightLanesScrollRef.current;
      if (!scrollEl) return;
      const dx = e.clientX - isPanningTimeline.startX;
      const nextScroll = Math.max(0, isPanningTimeline.startScrollLeft - dx);
      scrollEl.scrollLeft = nextScroll;
      setScrollOffset(nextScroll);
    };
    const handleMouseUp = () => setIsPanningTimeline(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanningTimeline]);

  // Dedicated Bottom Horizontal Scrollbar Thumb Dragging
  useEffect(() => {
    if (!isDraggingScrollbar) return;
    const handleMouseMove = (e: MouseEvent) => {
      const scrollEl = rightLanesScrollRef.current;
      const barEl = customScrollbarTrackRef.current;
      if (!scrollEl || !barEl) return;
      const barWidth = Math.max(1, barEl.clientWidth);
      const maxScroll = Math.max(0, metrics.totalWidthPx - scrollEl.clientWidth);
      const dx = e.clientX - isDraggingScrollbar.startX;
      const scrollDelta = (dx / barWidth) * metrics.totalWidthPx;
      const nextScroll = Math.max(
        0,
        Math.min(maxScroll, isDraggingScrollbar.startScrollLeft + scrollDelta)
      );
      scrollEl.scrollLeft = nextScroll;
      setScrollOffset(nextScroll);
    };
    const handleMouseUp = () => setIsDraggingScrollbar(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScrollbar, metrics.totalWidthPx]);

  // Active target for keyframe & split operations
  const activeTargetId =
    selectedDrawingId || selectedIds[0] || devices[0]?.id || null;
  const activeDeviceId = selectedIds[0] || devices[0]?.id || null;
  const activeClip = useMemo(
    () =>
      clips.find((c) => c.id === selectedClipId) ||
      clips.find(
        (c) =>
          currentFrame >= c.startFrame &&
          currentFrame < c.startFrame + c.durationFrames
      ) ||
      clips[0] ||
      null,
    [clips, selectedClipId, currentFrame]
  );
  const activeDrawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) || null,
    [drawings, selectedDrawingId]
  );

  // Split eligibility check (Section 6)
  const splitStatus = useMemo(
    () =>
      canSplitAtPlayhead(
        activeClip,
        activeDrawing,
        currentFrame,
        durationInFrames
      ),
    [activeClip, activeDrawing, currentFrame, durationInFrames]
  );

  const canEditClipOrDrawing = Boolean(activeClip || activeDrawing);

  // Zoom around the playhead or mouse anchor so current frame position remains anchored
  const handleZoomChange = (nextZoom: number, anchorFrame = currentFrame) => {
    const clamped = Math.max(0.08, Math.min(6, Number(nextZoom.toFixed(2))));
    const scrollEl = rightLanesScrollRef.current;
    setTimelineZoom(clamped);
    if (scrollEl) {
      window.requestAnimationFrame(() => {
        const anchorPx = frameToPixel(anchorFrame, clamped, 0, fps);
        const nextScroll = Math.max(0, anchorPx - scrollEl.clientWidth * 0.45);
        scrollEl.scrollLeft = nextScroll;
        setScrollOffset(nextScroll);
      });
    }
  };

  const handleFitToTimeline = () => {
    const scrollEl = rightLanesScrollRef.current;
    const vw = scrollEl ? scrollEl.clientWidth : viewportWidth;
    const fitZoom = computeFitTimelineZoom(durationInFrames, fps, vw);
    setTimelineZoom(fitZoom);
    if (scrollEl) {
      scrollEl.scrollLeft = 0;
      setScrollOffset(0);
    }
  };

  const handleZoomToSelectedClip = () => {
    const scrollEl = rightLanesScrollRef.current;
    const vw = scrollEl ? scrollEl.clientWidth : viewportWidth;
    const startF = activeDrawing
      ? (activeDrawing.startFrame ?? 0)
      : activeClip
        ? activeClip.startFrame
        : 0;
    const durF = activeDrawing
      ? (activeDrawing.durationFrames ?? durationInFrames)
      : activeClip
        ? activeClip.durationFrames
        : durationInFrames;
    const targetZoom = computeFitTimelineZoom(
      Math.max(15, Math.round(durF * 1.25)),
      fps,
      vw
    );
    setTimelineZoom(targetZoom);
    if (scrollEl) {
      window.requestAnimationFrame(() => {
        const startPx = frameToPixel(startF, targetZoom, 0, fps);
        const nextScroll = Math.max(0, startPx - 24);
        scrollEl.scrollLeft = nextScroll;
        setScrollOffset(nextScroll);
      });
    }
  };

  // Global keyboard shortcuts for CapCut-style timeline editing (Section 9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        setIsSpacePressed(true);
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (
        (e.key === 's' || e.key === 'S') &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        splitSelectedClipAtPlayhead();
      } else if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        stepFrame(e.shiftKey ? -10 : -1);
      } else if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        stepFrame(e.shiftKey ? 10 : 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentFrame(0);
        if (rightLanesScrollRef.current) {
          rightLanesScrollRef.current.scrollLeft = 0;
          setScrollOffset(0);
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        const endF = Math.max(0, durationInFrames - 1);
        setCurrentFrame(endF);
        if (rightLanesScrollRef.current) {
          const maxScroll = Math.max(
            0,
            metrics.totalWidthPx - rightLanesScrollRef.current.clientWidth
          );
          rightLanesScrollRef.current.scrollLeft = maxScroll;
          setScrollOffset(maxScroll);
        }
      } else if ((e.key === '=' || e.key === '+') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleZoomChange(timelineZoom * 1.25);
      } else if (e.key === '-' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleZoomChange(timelineZoom * 0.8);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        (selectedClipId || selectedDrawingId)
      ) {
        e.preventDefault();
        deleteSelectedClip();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    durationInFrames,
    isPlaying,
    timelineZoom,
    metrics.totalWidthPx,
    selectedClipId,
    selectedDrawingId,
    setCurrentFrame,
    setIsPlaying,
    stepFrame,
    splitSelectedClipAtPlayhead,
    deleteSelectedClip,
    undo,
    redo,
  ]);

  const handleRulerScrubStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.altKey || isSpacePressed) {
      e.preventDefault();
      const scrollEl = rightLanesScrollRef.current;
      if (scrollEl) {
        setIsPanningTimeline({
          startX: e.clientX,
          startScrollLeft: scrollEl.scrollLeft,
        });
      }
      return;
    }
    const container = trackLaneContainerRef.current || e.currentTarget;
    const rect = container.getBoundingClientRect();
    const localPx = e.clientX - rect.left;
    const targetFrame = pixelToFrame(
      localPx,
      timelineZoom,
      0,
      fps,
      durationInFrames - 1
    );
    setIsPlaying(false);
    setCurrentFrame(targetFrame);
    setIsScrubbingRuler(true);
  };

  const currentSeconds = (currentFrame / fps).toFixed(2);
  const totalSeconds = (durationInFrames / fps).toFixed(2);
  const currentTimecode = formatTimecode(currentFrame, fps);
  const totalTimecode = formatTimecode(durationInFrames, fps);
  const playheadPx = frameToPixel(currentFrame, timelineZoom, 0, fps);

  const rulerTicks = useMemo(
    () => computeAdaptiveRulerTicks(durationInFrames, fps, timelineZoom),
    [durationInFrames, fps, timelineZoom]
  );

  // Group video clips by trackId so split segments stay side-by-side on the same Video Track row!
  const videoTrackGroups = useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const clip of clips) {
      const tid = clip.trackId || `track-${clip.id}`;
      const list = map.get(tid) || [];
      list.push(clip);
      map.set(tid, list);
    }
    return Array.from(map.entries()).map(([trackId, trackClips]) => {
      const sorted = [...trackClips].sort(
        (a, b) => a.startFrame - b.startFrame
      );
      const primary = sorted[0];
      const totalTrackFrames = sorted.reduce(
        (acc, c) => acc + c.durationFrames,
        0
      );
      return {
        trackId,
        label: primary.name.replace(/\s*\(Part\s+\d+\)$/i, ''),
        clips: sorted,
        totalTrackFrames,
        muted: sorted.every((c) => c.muted),
        locked: sorted.some((c) => c.locked),
        visible: sorted.some((c) => c.visible !== false),
      };
    });
  }, [clips]);

  // Wheel handler: Ctrl/Cmd + Wheel zooms around cursor/playhead; Shift + Wheel or horizontal wheel scrolls horizontally
  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 0.82;
      handleZoomChange(timelineZoom * factor);
    } else if (rightLanesScrollRef.current) {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.shiftKey || Math.abs(e.deltaX) > 2 || metrics.totalWidthPx > viewportWidth) {
        rightLanesScrollRef.current.scrollLeft += delta;
        setScrollOffset(rightLanesScrollRef.current.scrollLeft);
      }
    }
  };

  // Dedicated Bottom Horizontal Scrollbar geometry
  const maxScrollLeft = Math.max(0, metrics.totalWidthPx - viewportWidth);
  const thumbWidthRatio = Math.max(
    0.06,
    Math.min(1, viewportWidth / Math.max(1, metrics.totalWidthPx))
  );
  const thumbLeftRatio =
    maxScrollLeft > 0
      ? (scrollOffset / maxScrollLeft) * (1 - thumbWidthRatio)
      : 0;
  const visibleStartFrame = pixelToFrame(
    0,
    timelineZoom,
    scrollOffset,
    fps,
    durationInFrames
  );
  const visibleEndFrame = pixelToFrame(
    viewportWidth,
    timelineZoom,
    scrollOffset,
    fps,
    durationInFrames
  );

  return (
    <section
      aria-label="Animation & Video Sequence Timeline"
      className={`bg-[#0B0F19] border-t border-slate-700/80 flex flex-col select-none shrink-0 transition-all ${
        timelineCollapsed ? 'h-10' : 'h-72'
      }`}
    >
      {/* High-Contrast CapCut-Style Timeline Transport & Editing Bar */}
      <div className="h-10 px-2 bg-[#111827] border-b border-slate-700/80 flex items-center justify-between gap-1 shrink-0 overflow-x-auto">
        {/* Left: Playback Transport & SMPTE HH:MM:SS:FF Timecode */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentFrame(0);
              if (rightLanesScrollRef.current) {
                rightLanesScrollRef.current.scrollLeft = 0;
                setScrollOffset(0);
              }
            }}
            aria-label="Jump to start frame"
            title="Jump to Start Frame 0 (Home)"
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-800"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => stepFrame(-1)}
            aria-label="Step back one frame"
            title="Previous Frame (Left Arrow)"
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-800"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm ${
              isPlaying
                ? 'bg-amber-400 text-slate-950'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-slate-950" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => stepFrame(1)}
            aria-label="Step forward one frame"
            title="Next Frame (Right Arrow)"
            className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-800"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setLoopPlayback(!loopPlayback)}
            aria-label="Toggle loop playback"
            title="Loop Playback"
            className={`p-1 rounded transition-colors ${
              loopPlayback
                ? 'text-cyan-300 bg-cyan-500/20 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Prominent HH:MM:SS:FF Timecode & Frame Display */}
          <div
            data-testid="timeline-timecode-display"
            title={`Current Timecode: ${currentTimecode} (${currentSeconds}s) | Total: ${totalTimecode} (${totalSeconds}s) at ${fps} FPS`}
            className="font-mono text-[11px] tabular-nums bg-[#070A10] border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 ml-0.5 flex items-center gap-1"
          >
            <span className="text-cyan-400 font-bold tracking-tight">
              {currentTimecode}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{totalTimecode}</span>
            <span className="text-slate-700">|</span>
            <span className="text-rose-400 font-bold">
              F{String(currentFrame).padStart(3, '0')}
            </span>
            <span className="text-slate-500 text-[10px]">
              /{durationInFrames}f
            </span>
          </div>
        </div>

        {/* Center: CapCut Video Split / Trim / Ripple Tools + Multi-Keyframe Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Video & Drawing Clip Trim, Split & Ripple Group */}
          <div className="flex items-center gap-0.5 bg-[#070A10] border border-slate-700/80 rounded-md px-1 py-0.5">
            <button
              type="button"
              disabled={!canEditClipOrDrawing}
              onClick={() => trimSelectedClipToPlayhead('left')}
              title="Trim Selected Clip Start (In-Point) to Playhead"
              className="px-1.5 py-0.5 rounded hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-300 text-[11px] font-mono font-semibold transition-colors"
            >
              [ In
            </button>
            <button
              type="button"
              data-testid="timeline-split-button"
              disabled={!splitStatus.canSplit}
              onClick={splitSelectedClipAtPlayhead}
              aria-label="Split Clip"
              title={`Split selected clip at playhead (S) — ${splitStatus.reason}`}
              className="px-2 py-0.5 rounded bg-emerald-500/25 hover:bg-emerald-400 hover:text-slate-950 disabled:opacity-40 text-emerald-200 border border-emerald-400/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Scissors className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              disabled={!canEditClipOrDrawing}
              onClick={() => trimSelectedClipToPlayhead('right')}
              title="Trim Selected Clip End (Out-Point) to Playhead"
              className="px-1.5 py-0.5 rounded hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-300 text-[11px] font-mono font-semibold transition-colors"
            >
              Out ]
            </button>
            <button
              type="button"
              onClick={() => setRippleTrimMode(!rippleTrimMode)}
              aria-pressed={rippleTrimMode}
              data-testid="toggle-ripple-trim"
              title="Ripple Trim Mode: Trimming a clip shifts subsequent clips on the same track"
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                rippleTrimMode
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Ripple
            </button>
            <button
              type="button"
              disabled={!selectedClipId && !selectedDrawingId}
              onClick={duplicateSelectedClip}
              title="Duplicate Selected Clip or Drawing"
              aria-label="Duplicate Selected Clip"
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 text-slate-300"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* Keyframe Navigation & Creation Group */}
          <div className="flex items-center gap-0.5 bg-[#070A10] border border-slate-700/80 rounded-md px-1 py-0.5">
            <button
              type="button"
              disabled={!activeTargetId}
              onClick={() => jumpToAdjacentKeyframe('prev')}
              title="Jump to Previous Keyframe"
              aria-label="Jump to Previous Keyframe"
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 text-cyan-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={!activeTargetId}
              aria-label="Add Keyframe"
              onClick={() => {
                if (activeTargetId) {
                  addKeyframeAtCurrentFrame(activeTargetId, selectedEasing);
                }
              }}
              className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-400 hover:text-slate-950 disabled:opacity-40 text-cyan-200 border border-cyan-400/50 text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Keyframe</span>
            </button>

            <button
              type="button"
              disabled={!activeTargetId}
              onClick={() => jumpToAdjacentKeyframe('next')}
              title="Jump to Next Keyframe"
              aria-label="Jump to Next Keyframe"
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40 text-cyan-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <select
              aria-label="Keyframe Easing Curve"
              value={selectedEasing}
              onChange={(e) => {
                const nextEasing = e.target.value as EasingType;
                setSelectedEasing(nextEasing);
                if (selectedKeyframe) {
                  updateKeyframeEasing(
                    selectedKeyframe.trackId,
                    selectedKeyframe.keyframeId,
                    nextEasing
                  );
                }
              }}
              className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-200"
            >
              <option value="ease-in-out">Ease In-Out</option>
              <option value="cubic-bezier">Cubic Bezier</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in">Ease In</option>
              <option value="spring">Spring Physics</option>
              <option value="linear">Linear</option>
            </select>
          </div>

          {selectedKeyframe && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  copyKeyframe(
                    selectedKeyframe.trackId,
                    selectedKeyframe.keyframeId
                  )
                }
                title="Copy Selected Keyframe"
                aria-label="Copy selected keyframe"
                className="p-1 text-slate-200 hover:text-cyan-300 rounded bg-[#070A10] border border-slate-700"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteKeyframe(
                    selectedKeyframe.trackId,
                    selectedKeyframe.keyframeId
                  )
                }
                aria-label="Delete selected keyframe"
                title="Delete Selected Keyframe"
                className="p-1 text-rose-300 hover:text-white rounded bg-rose-500/20 border border-rose-500/40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {copiedKeyframe && activeTargetId && (
            <button
              type="button"
              onClick={() => {
                const tr = tracks.find((t) => t.targetId === activeTargetId);
                if (tr) pasteKeyframeAtPlayhead(tr.id);
              }}
              title="Paste Keyframe at Playhead"
              className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/50 text-[11px] font-medium flex items-center gap-1"
            >
              <Clipboard className="w-3 h-3" />
              <span>Paste KF</span>
            </button>
          )}

          {/* Quick Multi-Keyframe Preset Generator */}
          <div className="hidden 2xl:flex items-center gap-1">
            <select
              aria-label="Quick Animation Preset"
              value={quickPreset}
              onChange={(e) =>
                setQuickPreset(e.target.value as AnimationPresetId)
              }
              className="bg-[#070A10] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
            >
              {ANIMATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!activeDeviceId}
              onClick={() => {
                if (activeDeviceId) {
                  applyAnimationPresetToDevice(activeDeviceId, quickPreset);
                }
              }}
              className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 text-[11px] font-semibold flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3" />
              <span>Preset</span>
            </button>
          </div>
        </div>

        {/* Right: Onion Skin, Auto-KF, Auto-Scroll, Sequence Duration, Zoom & Collapse */}
        <div className="flex items-center gap-1 shrink-0">
          {lastTimelineNotice && (
            <span
              data-testid="timeline-status-notice"
              className="hidden 2xl:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 truncate max-w-[180px]"
            >
              {lastTimelineNotice}
            </span>
          )}

          <button
            type="button"
            onClick={toggleMotionTrail}
            aria-pressed={showMotionTrail}
            aria-label="Toggle Onion Skin Motion Trail"
            data-testid="toggle-motion-trail"
            title="Onion Skin / Motion Trail: Display device path and ghost silhouettes across previous and next keyframes"
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 transition-colors ${
              showMotionTrail
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                : 'bg-[#070A10] border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Spline className="w-3 h-3" />
            <span>Onion</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoKeyframe(!autoKeyframe)}
            aria-pressed={autoKeyframe}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 transition-colors ${
              autoKeyframe
                ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                : 'bg-[#070A10] border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Diamond className="w-2.5 h-2.5" />
            <span>Auto-KF</span>
          </button>

          <select
            aria-label="Sequence Duration"
            value={durationInFrames}
            onChange={(e) => setTimelineSettings(fps, Number(e.target.value))}
            className="bg-[#070A10] border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono tabular-nums text-slate-200"
          >
            <option value={90}>3s (90f)</option>
            <option value={150}>5s (150f)</option>
            <option value={180}>6s (180f)</option>
            <option value={300}>10s (300f)</option>
            <option value={600}>20s (600f)</option>
            <option value={900}>30s (900f)</option>
            <option value={1800}>60s (1800f)</option>
            <option value={3600}>120s (3600f)</option>
          </select>

          {/* CapCut-Style Timeline Zoom Controls (Out, Slider, In, %, Fit, Clip) */}
          <div className="flex items-center gap-0.5 bg-[#070A10] border border-slate-700 rounded px-1 py-0.5">
            <button
              type="button"
              onClick={() => handleZoomChange(timelineZoom * 0.8)}
              title="Zoom Out Timeline (-)"
              aria-label="Zoom Out Timeline"
              className="p-0.5 text-slate-400 hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <input
              type="range"
              aria-label="Timeline Horizontal Zoom"
              min={0.08}
              max={4}
              step={0.02}
              value={timelineZoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="w-9 accent-cyan-400 cursor-pointer h-1"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(timelineZoom * 1.25)}
              title="Zoom In Timeline (+)"
              aria-label="Zoom In Timeline"
              className="p-0.5 text-slate-400 hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <span
              data-testid="timeline-zoom-percentage"
              className="text-[10px] font-mono text-cyan-300 min-w-[26px] text-center tabular-nums"
            >
              {Math.round(timelineZoom * 100)}%
            </span>
            <button
              type="button"
              data-testid="timeline-zoom-fit"
              onClick={handleFitToTimeline}
              title="Fit Entire Project to Timeline View"
              aria-label="Fit to Timeline"
              className="px-1 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white border border-slate-700 flex items-center gap-0.5"
            >
              <Maximize2 className="w-2.5 h-2.5" />
              Fit
            </button>
            <button
              type="button"
              data-testid="timeline-zoom-clip"
              onClick={handleZoomToSelectedClip}
              title="Zoom to Selected Clip or Drawing"
              aria-label="Zoom to Selected Clip"
              className="px-1 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-300 hover:text-white border border-slate-700"
            >
              Clip
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
            aria-label={
              timelineCollapsed ? 'Expand timeline' : 'Collapse timeline'
            }
            className="p-0.5 text-slate-300 hover:text-white rounded hover:bg-slate-800"
          >
            {timelineCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Track Headers + Interactive Scrubber Lanes */}
      {!timelineCollapsed && (
        <>
          <div
            onWheel={handleTimelineWheel}
            className="flex-1 flex min-h-0 overflow-hidden"
          >
            {/* Left Column: Fixed Track Headers with Lock, Hide, Mute & Height Controls */}
            <div className="w-44 sm:w-64 border-r border-slate-700/80 bg-[#0D1320] flex flex-col shrink-0">
              <div className="h-6 px-2.5 border-b border-slate-700/80 bg-[#111827] flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                <span>Track / Layer</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setTrackHeightMode(
                        trackHeightMode === 'normal'
                          ? 'tall'
                          : trackHeightMode === 'tall'
                            ? 'compact'
                            : 'normal'
                      )
                    }
                    title={`Track Height: ${trackHeightMode} (Click to cycle)`}
                    className="px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-mono text-slate-300"
                  >
                    H:{trackHeightMode[0].toUpperCase()}
                  </button>
                  <span>Type · KFs</span>
                </div>
              </div>
              <div
                ref={leftHeadersScrollRef}
                onScroll={(e) => {
                  if (rightLanesScrollRef.current) {
                    rightLanesScrollRef.current.scrollTop =
                      e.currentTarget.scrollTop;
                  }
                }}
                className="flex-1 overflow-y-auto divide-y divide-slate-800/80"
              >
                {/* 1. Video & Audio Track Headers (Grouped by trackId so split segments share 1 track row) */}
                {videoTrackGroups.map((group) => {
                  const isSelected = group.clips.some(
                    (c) => c.id === selectedClipId
                  );
                  const primaryClip = group.clips[0];
                  return (
                    <div
                      key={group.trackId}
                      onClick={() => selectClip(primaryClip.id)}
                      className={`${rowHeightClass} px-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-200 font-semibold'
                          : 'text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{group.label}</span>
                        {group.clips.length > 1 && (
                          <span className="text-[9px] font-mono text-emerald-300 shrink-0">
                            · {group.clips.length} cuts
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono tabular-nums text-emerald-300/90">
                          {group.totalTrackFrames}f
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            for (const c of group.clips) {
                              updateClip(c.id, { muted: !group.muted }, false);
                            }
                            pushHistory();
                          }}
                          aria-label={group.muted ? 'Unmute track' : 'Mute track'}
                          title={group.muted ? 'Unmute Audio' : 'Mute Audio'}
                          className="p-0.5 text-slate-300 hover:text-white"
                        >
                          {group.muted ? (
                            <VolumeX className="w-3 h-3 text-rose-400" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            for (const c of group.clips) {
                              updateClip(c.id, { visible: !group.visible }, false);
                            }
                            pushHistory();
                          }}
                          aria-label={
                            group.visible ? 'Hide video track' : 'Show video track'
                          }
                          title={group.visible ? 'Hide Track' : 'Show Track'}
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {group.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-amber-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            for (const c of group.clips) {
                              updateClip(c.id, { locked: !group.locked }, false);
                            }
                            pushHistory();
                          }}
                          aria-label={
                            group.locked ? 'Unlock video track' : 'Lock video track'
                          }
                          title={group.locked ? 'Unlock Track' : 'Lock Track'}
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {group.locked ? (
                            <Lock className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectClip(primaryClip.id);
                            deleteSelectedClip();
                          }}
                          aria-label="Delete clip"
                          className="p-0.5 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Device Keyframe Track Headers + Expandable Property Sub-Rows (Cyan Accent) */}
                {devices.map((dev) => {
                  const isSelected = selectedIds.includes(dev.id);
                  const track = tracks.find((t) => t.targetId === dev.id);
                  const kfCount = track ? track.keyframes.length : 0;
                  const isExpanded = Boolean(track?.expanded);
                  return (
                    <React.Fragment key={dev.id}>
                      <div
                        onClick={() => selectDevice(dev.id)}
                        className={`${rowHeightClass} px-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-200 font-semibold'
                            : 'text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-1 truncate">
                          {track && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrackExpanded(track.id);
                              }}
                              aria-label={`Toggle property tracks for ${dev.name}`}
                              className="p-0.5 rounded hover:bg-slate-700 text-cyan-400 shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          <span className="truncate">{dev.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-mono tabular-nums text-cyan-300">
                            {kfCount} kf
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDevice(dev.id, { visible: !dev.visible });
                            }}
                            aria-label={
                              dev.visible
                                ? `Hide ${dev.name}`
                                : `Show ${dev.name}`
                            }
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {dev.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-amber-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDevice(dev.id, { locked: !dev.locked });
                            }}
                            aria-label={
                              dev.locked
                                ? `Unlock ${dev.name}`
                                : `Lock ${dev.name}`
                            }
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {dev.locked ? (
                              <Lock className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              reorderDeviceLayer(dev.id, 'up');
                            }}
                            title="Move Track Up"
                            aria-label={`Move ${dev.name} track up`}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectDevice(dev.id);
                              addKeyframeAtCurrentFrame(dev.id, selectedEasing);
                            }}
                            title="Add Keyframe at Playhead"
                            aria-label={`Add keyframe for ${dev.name}`}
                            className="p-0.5 rounded bg-cyan-500/20 hover:bg-cyan-400 hover:text-slate-950 text-cyan-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearTrackKeyframes(dev.id);
                            }}
                            title="Reset Track to Single Keyframe"
                            aria-label={`Reset keyframes for ${dev.name}`}
                            className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isExpanded &&
                        (
                          [
                            { key: 'pos', label: 'Position (X, Y)' },
                            { key: 'scale', label: 'Scale (W, H)' },
                            { key: 'rot', label: 'Rotation (2D / 3D)' },
                            { key: 'glow', label: 'Glow & FX Intensity' },
                          ] as const
                        ).map((propRow) => (
                          <div
                            key={`${dev.id}-${propRow.key}`}
                            onClick={() => selectDevice(dev.id)}
                            className="h-6 pl-7 pr-2.5 flex items-center justify-between text-[11px] bg-[#090E1A] text-slate-300 hover:bg-slate-800/40 cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px] text-cyan-300/90">
                              ↳ {propRow.label}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {kfCount} pts
                            </span>
                          </div>
                        ))}
                    </React.Fragment>
                  );
                })}

                {/* 3. Neon Drawing & Vector Annotation Clip Track Headers (Purple Accent) */}
                {drawings.map((dr) => {
                  const isSelected = selectedDrawingId === dr.id;
                  const track = tracks.find((t) => t.targetId === dr.id);
                  const kfCount = track ? track.keyframes.length : 0;
                  const drDur = dr.durationFrames ?? durationInFrames;
                  return (
                    <div
                      key={dr.id}
                      onClick={() => selectDrawing(dr.id)}
                      className={`${rowHeightClass} px-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-500/20 text-purple-200 font-semibold'
                          : 'text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <PenTool className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">{dr.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono tabular-nums text-purple-300/90">
                          {drDur}f · {kfCount}kf
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDrawing(dr.id, { visible: !dr.visible });
                          }}
                          aria-label={
                            dr.visible ? `Hide ${dr.name}` : `Show ${dr.name}`
                          }
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {dr.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-amber-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDrawing(dr.id, { locked: !dr.locked });
                          }}
                          aria-label={
                            dr.locked
                              ? `Unlock ${dr.name}`
                              : `Lock ${dr.name}`
                          }
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {dr.locked ? (
                            <Lock className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectDrawing(dr.id);
                            addKeyframeAtCurrentFrame(dr.id, selectedEasing);
                          }}
                          aria-label={`Add keyframe for ${dr.name}`}
                          title="Add Drawing Keyframe at Playhead"
                          className="p-0.5 rounded bg-purple-500/20 hover:bg-purple-400 hover:text-slate-950 text-purple-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateDrawing(dr.id);
                          }}
                          aria-label={`Duplicate drawing ${dr.name}`}
                          title="Duplicate Drawing Clip"
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDrawing(dr.id);
                          }}
                          aria-label={`Delete drawing ${dr.name}`}
                          title="Delete Drawing Clip"
                          className="p-0.5 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Shared-Coordinate Time Ruler & Interactive Filmstrip / Keyframe Lanes */}
            <div
              ref={rightLanesScrollRef}
              data-testid="timeline-scroll-viewport"
              onScroll={(e) => {
                const nextLeft = e.currentTarget.scrollLeft;
                setScrollOffset(nextLeft);
                if (leftHeadersScrollRef.current) {
                  leftHeadersScrollRef.current.scrollTop =
                    e.currentTarget.scrollTop;
                }
              }}
              className="flex-1 flex flex-col relative bg-[#070A10] overflow-x-auto overflow-y-auto"
            >
              <div
                ref={trackLaneContainerRef}
                data-testid="timeline-content-canvas"
                style={{
                  width: `${metrics.totalWidthPx}px`,
                  minWidth: `${metrics.totalWidthPx}px`,
                }}
                className="flex-1 flex flex-col relative"
              >
                {/* CapCut-Style Adaptive Time & Frame Ruler with Pixel-Exact Ticks */}
                <div
                  data-testid="timeline-ruler"
                  onMouseDown={handleRulerScrubStart}
                  className="h-6 border-b border-slate-700/80 bg-[#111827] relative cursor-ew-resize flex items-center sticky top-0 z-20"
                >
                  {rulerTicks.map((tick) => (
                    <div
                      key={tick.frame}
                      style={{ left: `${tick.pixelLeft}px` }}
                      className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                    >
                      {tick.isMajor ? (
                        <div className="border-l border-slate-400/90 pl-1.5 flex items-center h-full text-[10px] font-mono tabular-nums text-slate-100 whitespace-nowrap">
                          <span className="font-semibold">
                            {tick.timecodeLabel}
                          </span>
                          <span className="text-slate-400 ml-1 text-[9px]">
                            ({tick.secondsLabel} · {tick.frameLabel})
                          </span>
                        </div>
                      ) : (
                        <div className="h-2.5 border-l border-slate-700/90 flex items-end pl-0.5">
                          {tick.showFrameDetail && (
                            <span className="text-[8px] font-mono text-slate-500 leading-none pb-0.5">
                              {tick.frameLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Track Lanes Container */}
                <div className="flex-1 divide-y divide-slate-800/80 relative">
                  {/* 1. Grouped Video & Audio Clip Lanes with Filmstrip Thumbnails & Trim Handles */}
                  {videoTrackGroups.map((group) => (
                    <div
                      key={group.trackId}
                      data-testid={`video-track-lane-${group.trackId}`}
                      onMouseDown={handleRulerScrubStart}
                      className={`${rowHeightClass} relative flex items-center bg-[#090E18]/90 hover:bg-[#0D1524]`}
                    >
                      {group.clips.map((clip) => {
                        const clipLeftPx = frameToPixel(
                          clip.startFrame,
                          timelineZoom,
                          0,
                          fps
                        );
                        const clipWidthPx = Math.max(
                          14,
                          frameToPixel(clip.durationFrames, timelineZoom, 0, fps)
                        );
                        const isSelected = selectedClipId === clip.id;
                        const clipEndFrame =
                          clip.startFrame + clip.durationFrames;
                        const outFrame =
                          clip.sourceOutFrame ??
                          clip.trimStartFrames + clip.durationFrames;
                        const startTc = formatTimecode(clip.startFrame, fps);
                        const endTc = formatTimecode(clipEndFrame, fps);
                        const inTc = formatShortTimecode(
                          clip.trimStartFrames,
                          fps
                        );
                        const outTc = formatShortTimecode(outFrame, fps);
                        const durSec = (clip.durationFrames / fps).toFixed(2);
                        const thumbs = computeClipFilmstripThumbs(
                          clip,
                          fps,
                          clipWidthPx
                        );

                        return (
                          <div
                            key={clip.id}
                            data-testid={`timeline-video-clip-${clip.id}`}
                            style={{
                              left: `${clipLeftPx}px`,
                              width: `${clipWidthPx}px`,
                            }}
                            title={`${clip.name} — Timeline: ${startTc} → ${endTc} (F${clip.startFrame}–F${clipEndFrame}) | Duration: ${durSec}s (${clip.durationFrames}f) | Source In: ${inTc} (F${clip.trimStartFrames}) → Out: ${outTc} (F${outFrame})`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (isSpacePressed || e.button === 1 || e.altKey) {
                                handleRulerScrubStart(e);
                                return;
                              }
                              selectClip(clip.id);
                              if (clip.locked) return;
                              setDraggingClip({
                                clipId: clip.id,
                                mode: 'move',
                                startX: e.clientX,
                                origClip: { ...clip },
                                origClipsSnapshot: clips.map((c) => ({ ...c })),
                              });
                            }}
                            className={`absolute ${clipBarHeightClass} rounded-md border flex items-center overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
                              isSelected
                                ? 'bg-emerald-950/90 border-emerald-300 ring-2 ring-emerald-400/70 z-10'
                                : 'bg-emerald-950/75 border-emerald-500/60 hover:border-emerald-300'
                            } ${!clip.visible ? 'opacity-40' : ''}`}
                          >
                            {/* Left Draggable In-Point Trim Handle */}
                            <div
                              data-testid={`clip-trim-left-${clip.id}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                selectClip(clip.id);
                                if (clip.locked) return;
                                setDraggingClip({
                                  clipId: clip.id,
                                  mode: 'trim-start',
                                  startX: e.clientX,
                                  origClip: { ...clip },
                                  origClipsSnapshot: clips.map((c) => ({
                                    ...c,
                                  })),
                                });
                              }}
                              title="Drag to trim clip Source In-Point (Start)"
                              className="w-2.5 h-full bg-emerald-400 hover:bg-white text-slate-950 flex items-center justify-center cursor-ew-resize shrink-0 z-20 font-mono text-[9px] font-bold"
                            >
                              [
                            </div>

                            {/* CapCut-Style Asynchronous / Procedural Filmstrip Thumbnail Strip */}
                            <div className="flex-1 h-full relative overflow-hidden flex items-center">
                              <div className="absolute inset-0 flex divide-x divide-emerald-500/20 pointer-events-none">
                                {thumbs.map((th) => (
                                  <div
                                    key={th.index}
                                    style={{
                                      background: `linear-gradient(135deg, hsla(${th.accentHue}, 65%, 16%, 0.85), hsla(${(th.accentHue + 40) % 360}, 70%, 10%, 0.92))`,
                                    }}
                                    className="flex-1 h-full px-1 flex items-end justify-end overflow-hidden pb-0.5"
                                  >
                                    {clipWidthPx >= 90 && (
                                      <span className="text-[7.5px] font-mono text-emerald-300/60 leading-none">
                                        {th.sceneLabel}·{th.sourceSeconds}s
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Clip Label, Start/End/Duration Timing & Source In/Out Readout */}
                              <div className="relative z-10 w-full px-1.5 flex items-center justify-between pointer-events-none">
                                <span className="text-[10px] font-semibold text-white truncate bg-slate-950/85 border border-emerald-500/30 px-1.5 py-0.2 rounded shadow-sm max-w-[58%]">
                                  {clip.name}
                                </span>
                                {clipWidthPx >= 130 && (
                                  <span className="text-[9px] font-mono tabular-nums text-emerald-200 ml-1 shrink-0 bg-slate-950/90 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                    {durSec}s ({clip.durationFrames}f · In:F
                                    {clip.trimStartFrames}→Out:F{outFrame})
                                  </span>
                                )}
                              </div>

                              {/* Audio Sync Waveform Bars along bottom of clip */}
                              {!clip.muted && (
                                <div className="absolute inset-x-1 bottom-0 h-1.5 flex items-end gap-0.5 opacity-35 pointer-events-none">
                                  {(clip.waveformPeaks || [])
                                    .slice(0, 48)
                                    .map((peak, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          height: `${Math.round(peak * 100)}%`,
                                        }}
                                        className="flex-1 bg-emerald-300 rounded-t-sm"
                                      />
                                    ))}
                                </div>
                              )}
                            </div>

                            {/* Right Draggable Out-Point Trim Handle */}
                            <div
                              data-testid={`clip-trim-right-${clip.id}`}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                selectClip(clip.id);
                                if (clip.locked) return;
                                setDraggingClip({
                                  clipId: clip.id,
                                  mode: 'trim-end',
                                  startX: e.clientX,
                                  origClip: { ...clip },
                                  origClipsSnapshot: clips.map((c) => ({
                                    ...c,
                                  })),
                                });
                              }}
                              title="Drag to trim clip Source Out-Point (End)"
                              className="w-2.5 h-full bg-emerald-400 hover:bg-white text-slate-950 flex items-center justify-center cursor-ew-resize shrink-0 z-20 font-mono text-[9px] font-bold"
                            >
                              ]
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* 2. Device Keyframe Lanes + Expanded Property Sub-Lanes */}
                  {devices.map((dev) => {
                    const isSelected = selectedIds.includes(dev.id);
                    const track = tracks.find((t) => t.targetId === dev.id);
                    const keyframes = track ? track.keyframes : [];
                    const isExpanded = Boolean(track?.expanded);

                    return (
                      <React.Fragment key={dev.id}>
                        <div
                          onMouseDown={handleRulerScrubStart}
                          onClick={() => selectDevice(dev.id)}
                          className={`${rowHeightClass} relative flex items-center ${
                            isSelected ? 'bg-cyan-950/25' : 'bg-[#070A10]'
                          } hover:bg-[#0E1525]`}
                        >
                          <div className="absolute left-0 right-0 h-0.5 bg-cyan-500/30 pointer-events-none" />

                          {keyframes.map((kf, idx) => {
                            const kfLeftPx = frameToPixel(
                              kf.frame,
                              timelineZoom,
                              0,
                              fps
                            );
                            const nextKf = keyframes[idx + 1];
                            const nextLeftPx = nextKf
                              ? frameToPixel(nextKf.frame, timelineZoom, 0, fps)
                              : null;
                            const isKfSelected =
                              selectedKeyframe?.trackId === track?.id &&
                              selectedKeyframe?.keyframeId === kf.id;

                            return (
                              <React.Fragment key={kf.id}>
                                {nextLeftPx !== null && (
                                  <div
                                    style={{
                                      left: `${kfLeftPx}px`,
                                      width: `${Math.max(
                                        0,
                                        nextLeftPx - kfLeftPx
                                      )}px`,
                                    }}
                                    className="absolute h-1.5 bg-gradient-to-r from-cyan-400/45 to-sky-500/45 rounded-full pointer-events-none"
                                  />
                                )}
                                <button
                                  type="button"
                                  style={{ left: `${kfLeftPx}px` }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!track || dev.locked) return;
                                    selectDevice(dev.id);
                                    setSelectedKeyframe({
                                      trackId: track.id,
                                      keyframeId: kf.id,
                                    });
                                    setCurrentFrame(kf.frame);
                                    setDraggingKf({
                                      trackId: track.id,
                                      keyframeId: kf.id,
                                    });
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (!track || dev.locked) return;
                                    duplicateKeyframe(track.id, kf.id);
                                  }}
                                  title={`Keyframe at F${kf.frame} (${formatTimecode(
                                    kf.frame,
                                    fps
                                  )}) · Easing: ${kf.easing}`}
                                  aria-label={`Keyframe at frame ${kf.frame}`}
                                  className={`absolute -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-2 transition-transform z-10 ${
                                    isKfSelected
                                      ? 'bg-amber-400 border-white scale-125 shadow-[0_0_10px_#FBBF24]'
                                      : 'bg-cyan-400 border-slate-950 hover:scale-125 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
                                  }`}
                                />
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {isExpanded &&
                          (['pos', 'scale', 'rot', 'glow'] as const).map(
                            (propKey) => (
                              <div
                                key={`${dev.id}-lane-${propKey}`}
                                onMouseDown={handleRulerScrubStart}
                                className="h-6 relative flex items-center bg-[#060911] border-t border-slate-900"
                              >
                                <div className="absolute left-0 right-0 h-px bg-slate-800 pointer-events-none" />
                                {keyframes.map((kf) => {
                                  const kfLeftPx = frameToPixel(
                                    kf.frame,
                                    timelineZoom,
                                    0,
                                    fps
                                  );
                                  return (
                                    <div
                                      key={`${kf.id}-${propKey}`}
                                      style={{ left: `${kfLeftPx}px` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        if (!track || dev.locked) return;
                                        setSelectedKeyframe({
                                          trackId: track.id,
                                          keyframeId: kf.id,
                                        });
                                        setCurrentFrame(kf.frame);
                                        setDraggingKf({
                                          trackId: track.id,
                                          keyframeId: kf.id,
                                        });
                                      }}
                                      className={`absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 border border-slate-950 cursor-ew-resize ${
                                        propKey === 'glow'
                                          ? 'bg-purple-400/90 hover:bg-amber-300'
                                          : 'bg-cyan-300/80 hover:bg-amber-300'
                                      }`}
                                    />
                                  );
                                })}
                              </div>
                            )
                          )}
                      </React.Fragment>
                    );
                  })}

                  {/* 3. Neon Drawing & Annotation Clip Lanes with Draggable Trim Handles & Keyframe Diamonds */}
                  {drawings.map((dr) => {
                    const drStart = dr.startFrame ?? 0;
                    const drDur = dr.durationFrames ?? durationInFrames;
                    const drEnd = drStart + drDur;
                    const leftPx = frameToPixel(drStart, timelineZoom, 0, fps);
                    const widthPx = Math.max(
                      14,
                      frameToPixel(drDur, timelineZoom, 0, fps)
                    );
                    const isSelected = selectedDrawingId === dr.id;
                    const startTc = formatShortTimecode(drStart, fps);
                    const endTc = formatShortTimecode(drEnd, fps);
                    const durSec = (drDur / Math.max(1, fps)).toFixed(2);
                    const drTrack = tracks.find((t) => t.targetId === dr.id);
                    const drKeyframes = drTrack ? drTrack.keyframes : [];

                    return (
                      <div
                        key={dr.id}
                        data-testid={`drawing-timeline-lane-${dr.id}`}
                        onMouseDown={handleRulerScrubStart}
                        onClick={() => selectDrawing(dr.id)}
                        className={`${rowHeightClass} relative flex items-center bg-[#090C15] hover:bg-[#0D1120]`}
                      >
                        <div
                          data-testid={`drawing-timeline-clip-${dr.id}`}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          title={`${dr.name} (${dr.tool}) — Start: F${drStart} (${startTc}) | End: F${drEnd} (${endTc}) | Duration: ${drDur}f (${durSec}s) | Mode: ${dr.animationMode}`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (isSpacePressed || e.button === 1 || e.altKey) {
                              handleRulerScrubStart(e);
                              return;
                            }
                            selectDrawing(dr.id);
                            if (dr.locked) return;
                            setDraggingDrawingClip({
                              drawingId: dr.id,
                              mode: 'move',
                              startX: e.clientX,
                              origDrawing: {
                                ...dr,
                                startFrame: drStart,
                                durationFrames: drDur,
                              },
                            });
                          }}
                          className={`absolute ${clipBarHeightClass} rounded-md border flex items-center overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${
                            isSelected
                              ? 'bg-purple-500/35 border-purple-300 ring-2 ring-purple-400/60 z-10'
                              : 'bg-purple-950/75 border-purple-500/60 hover:border-purple-400'
                          } ${!dr.visible ? 'opacity-40' : ''}`}
                        >
                          {/* Left Draggable In-Point Trim Handle for Drawing Clip */}
                          <div
                            data-testid={`drawing-trim-left-${dr.id}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              selectDrawing(dr.id);
                              if (dr.locked) return;
                              setDraggingDrawingClip({
                                drawingId: dr.id,
                                mode: 'trim-start',
                                startX: e.clientX,
                                origDrawing: {
                                  ...dr,
                                  startFrame: drStart,
                                  durationFrames: drDur,
                                },
                              });
                            }}
                            title="Drag to trim drawing start frame (In-Point)"
                            className="w-2.5 h-full bg-purple-400 hover:bg-white text-slate-950 flex items-center justify-center cursor-ew-resize shrink-0 z-10 font-mono text-[9px] font-bold"
                          >
                            [
                          </div>

                          {/* Drawing Clip Label & Timing Readout */}
                          <div className="flex-1 h-full px-2 flex items-center justify-between relative overflow-hidden">
                            <span className="text-[10px] font-semibold text-white truncate z-10 drop-shadow">
                              {dr.name}
                            </span>
                            {widthPx >= 110 && (
                              <span className="text-[9px] font-mono tabular-nums text-purple-200 z-10 ml-2 shrink-0 bg-slate-950/75 px-1.5 py-0.2 rounded">
                                F{drStart}–F{drEnd} ({drDur}f ·{' '}
                                {dr.animationMode})
                              </span>
                            )}
                          </div>

                          {/* Right Draggable Out-Point Trim Handle for Drawing Clip */}
                          <div
                            data-testid={`drawing-trim-right-${dr.id}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              selectDrawing(dr.id);
                              if (dr.locked) return;
                              setDraggingDrawingClip({
                                drawingId: dr.id,
                                mode: 'trim-end',
                                startX: e.clientX,
                                origDrawing: {
                                  ...dr,
                                  startFrame: drStart,
                                  durationFrames: drDur,
                                },
                              });
                            }}
                            title="Drag to trim drawing end frame (Out-Point)"
                            className="w-2.5 h-full bg-purple-400 hover:bg-white text-slate-950 flex items-center justify-center cursor-ew-resize shrink-0 z-10 font-mono text-[9px] font-bold"
                          >
                            ]
                          </div>
                        </div>

                        {/* Overlaid Keyframe Diamonds on Drawing Track */}
                        {drKeyframes.map((kf) => {
                          const kfLeftPx = frameToPixel(
                            kf.frame,
                            timelineZoom,
                            0,
                            fps
                          );
                          const isKfSelected =
                            selectedKeyframe?.trackId === drTrack?.id &&
                            selectedKeyframe?.keyframeId === kf.id;
                          return (
                            <button
                              key={kf.id}
                              type="button"
                              style={{ left: `${kfLeftPx}px` }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                if (!drTrack || dr.locked) return;
                                selectDrawing(dr.id);
                                setSelectedKeyframe({
                                  trackId: drTrack.id,
                                  keyframeId: kf.id,
                                });
                                setCurrentFrame(kf.frame);
                                setDraggingKf({
                                  trackId: drTrack.id,
                                  keyframeId: kf.id,
                                });
                              }}
                              title={`Drawing Keyframe at F${kf.frame}`}
                              aria-label={`Drawing keyframe at frame ${kf.frame}`}
                              className={`absolute -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-2 z-20 ${
                                isKfSelected
                                  ? 'bg-amber-400 border-white scale-125'
                                  : 'bg-purple-300 border-slate-950 hover:scale-125'
                              }`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Live Trim / Move Preview Floating Tooltip */}
                {(draggingClip?.livePreviewLabel ||
                  draggingDrawingClip?.livePreviewLabel) && (
                  <div
                    style={{ left: `${Math.max(16, playheadPx)}px` }}
                    className="fixed bottom-64 z-50 -translate-x-1/2 px-2.5 py-1 rounded bg-slate-950/95 border border-emerald-400 text-emerald-200 text-[11px] font-mono tabular-nums shadow-lg pointer-events-none"
                  >
                    {draggingClip?.livePreviewLabel ||
                      draggingDrawingClip?.livePreviewLabel}
                  </div>
                )}

                {/* High-Contrast Playhead Line & Draggable Handle (Aligned via shared frameToPixel) */}
                <div
                  data-testid="timeline-playhead"
                  style={{ left: `${playheadPx}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30 shadow-[0_0_8px_#F43F5E]"
                >
                  <div
                    className={`inline-block w-max px-1.5 py-0.5 ${
                      playheadPx < 48
                        ? 'translate-x-0'
                        : playheadPx > metrics.totalWidthPx - 96
                          ? '-translate-x-full'
                          : '-translate-x-1/2'
                    } bg-rose-600 text-white text-[9px] font-mono font-bold rounded-b shadow-md whitespace-nowrap`}
                  >
                    F{currentFrame} · {formatShortTimecode(currentFrame, fps)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Bottom CapCut-Style Horizontal Scrollbar & Navigation Bar */}
          <div
            data-testid="timeline-horizontal-scrollbar"
            className="h-6 bg-[#0D1320] border-t border-slate-800 px-2.5 flex items-center gap-2 shrink-0"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
              <span>
                View: {formatTimecode(visibleStartFrame, fps)} –{' '}
                {formatTimecode(visibleEndFrame, fps)}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-300">
                {Math.round(metrics.pixelsPerSecond)}px/s
              </span>
            </div>

            {/* Interactive Draggable Scrollbar Track & Thumb */}
            <div
              ref={customScrollbarTrackRef}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                const barEl = customScrollbarTrackRef.current;
                const scrollEl = rightLanesScrollRef.current;
                if (!barEl || !scrollEl) return;
                const rect = barEl.getBoundingClientRect();
                const clickRatio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
                );
                const maxScroll = Math.max(
                  0,
                  metrics.totalWidthPx - scrollEl.clientWidth
                );
                const nextScroll = Math.round(clickRatio * maxScroll);
                scrollEl.scrollLeft = nextScroll;
                setScrollOffset(nextScroll);
              }}
              className="flex-1 h-3.5 bg-[#070A10] border border-slate-700/90 rounded relative cursor-pointer overflow-hidden"
            >
              <div
                data-testid="timeline-scrollbar-thumb"
                style={{
                  left: `${(thumbLeftRatio * 100).toFixed(2)}%`,
                  width: `${(thumbWidthRatio * 100).toFixed(2)}%`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const scrollEl = rightLanesScrollRef.current;
                  if (!scrollEl) return;
                  setIsDraggingScrollbar({
                    startX: e.clientX,
                    startScrollLeft: scrollEl.scrollLeft,
                  });
                }}
                title="Drag horizontal scrollbar thumb to navigate across the entire project"
                className="absolute top-0.5 bottom-0.5 rounded-sm bg-cyan-500/40 hover:bg-cyan-400/60 active:bg-cyan-300/80 border border-cyan-400/60 cursor-grab active:cursor-grabbing flex items-center justify-center"
              >
                <div className="w-3 h-1 border-x border-cyan-200/70" />
              </div>
            </div>

            {/* Quick Navigation & Auto-Scroll Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => addLongDemoVideo(60)}
                data-testid="timeline-add-60s-video"
                title="Load a 60-second (1800-frame) multi-scene video onto the timeline"
                className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-mono text-emerald-300"
              >
                + 60s Video
              </button>
              <button
                type="button"
                onClick={() => setAutoScrollTimeline(!autoScrollTimeline)}
                aria-pressed={autoScrollTimeline}
                data-testid="toggle-auto-scroll"
                title="Toggle automatic timeline scrolling during playback"
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  autoScrollTimeline
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                Auto-Scroll
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
