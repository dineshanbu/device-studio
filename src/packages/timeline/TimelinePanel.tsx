import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
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
  History,
  Lock,
  Maximize2,
  Pause,
  PenTool,
  Play,
  Plus,
  Redo2,
  Repeat,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Spline,
  Trash2,
  Undo2,
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
    webcams,
    clips,
    tracks,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
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
    selectWebcam,
    updateWebcam,
    duplicateWebcam,
    deleteWebcam,
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
    history,
    historyIndex,
    syncPlayheadOnHistoryScrub,
    setSyncPlayheadOnHistoryScrub,
    scrubToHistoryIndex,
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
  const [historyScrubOpen, setHistoryScrubOpen] = useState<boolean>(false);
  const historyScrubPopoverRef = useRef<HTMLDivElement | null>(null);
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

  // Close History Scrub popover on outside click or Escape
  useEffect(() => {
    if (!historyScrubOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        historyScrubPopoverRef.current &&
        !historyScrubPopoverRef.current.contains(e.target as Node)
      ) {
        setHistoryScrubOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHistoryScrubOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('keydown', handleEsc, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('keydown', handleEsc, true);
    };
  }, [historyScrubOpen]);

  // Compute History Scrub metrics relative to current playhead position
  const historyScrubMetrics = useMemo(() => {
    const safeHistory = history.length > 0 ? history : [];
    const clampedIdx = Math.max(
      0,
      Math.min(Math.max(0, safeHistory.length - 1), historyIndex)
    );
    const activeSnap = safeHistory[clampedIdx] || null;
    const prevUndoSnap = clampedIdx > 0 ? safeHistory[clampedIdx - 1] : null;
    const nextRedoSnap =
      clampedIdx < safeHistory.length - 1 ? safeHistory[clampedIdx + 1] : null;

    const activeHistoryFrame = Math.max(
      0,
      Math.min(durationInFrames - 1, activeSnap?.frame ?? 0)
    );
    const deltaFromActive = currentFrame - activeHistoryFrame;
    const deltaSeconds = (deltaFromActive / Math.max(1, fps)).toFixed(2);
    const activeHistoryPx = frameToPixel(
      activeHistoryFrame,
      timelineZoom,
      0,
      fps
    );

    const nextRedoFrame =
      nextRedoSnap !== null
        ? Math.max(0, Math.min(durationInFrames - 1, nextRedoSnap.frame ?? 0))
        : null;
    const nextRedoPx =
      nextRedoFrame !== null
        ? frameToPixel(nextRedoFrame, timelineZoom, 0, fps)
        : null;
    const deltaToNextRedo =
      nextRedoFrame !== null ? currentFrame - nextRedoFrame : null;

    // Recent window of up to 8 history steps around historyIndex for the mini scrub track
    const windowSize = 8;
    const halfWindow = Math.floor(windowSize / 2);
    let startIdx = Math.max(0, clampedIdx - halfWindow);
    const endIdx = Math.min(safeHistory.length, startIdx + windowSize);
    if (endIdx - startIdx < windowSize) {
      startIdx = Math.max(0, endIdx - windowSize);
    }

    const recentNodes = safeHistory.slice(startIdx, endIdx).map((snap, i) => {
      const globalIdx = startIdx + i;
      const snapFrame = Math.max(
        0,
        Math.min(durationInFrames - 1, snap.frame ?? 0)
      );
      const status: 'undo' | 'active' | 'redo' =
        globalIdx < clampedIdx
          ? 'undo'
          : globalIdx === clampedIdx
            ? 'active'
            : 'redo';
      return {
        globalIdx,
        stepNumber: globalIdx + 1,
        id: snap.id || `hist-${globalIdx}`,
        label: snap.label || `Step ${globalIdx + 1}`,
        frame: snapFrame,
        pixelLeft: frameToPixel(snapFrame, timelineZoom, 0, fps),
        deltaFrames: currentFrame - snapFrame,
        status,
      };
    });

    const playheadRatio = Math.max(
      0,
      Math.min(1, currentFrame / Math.max(1, durationInFrames - 1))
    );
    const activeHistoryRatio = Math.max(
      0,
      Math.min(1, activeHistoryFrame / Math.max(1, durationInFrames - 1))
    );

    return {
      totalSteps: safeHistory.length,
      activeStepNumber: clampedIdx + 1,
      undoCount: clampedIdx,
      redoCount: Math.max(0, safeHistory.length - 1 - clampedIdx),
      activeSnap,
      prevUndoSnap,
      nextRedoSnap,
      activeHistoryFrame,
      activeHistoryPx,
      deltaFromActive,
      deltaSeconds,
      nextRedoFrame,
      nextRedoPx,
      deltaToNextRedo,
      recentNodes,
      playheadRatio,
      activeHistoryRatio,
    };
  }, [history, historyIndex, currentFrame, durationInFrames, fps, timelineZoom]);

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
      className={`bg-white border-t border-slate-200 flex flex-col select-none shrink-0 transition-all ${
        timelineCollapsed ? 'h-10' : 'h-72'
      }`}
    >
      {/* White-Themed Timeline Transport & Editing Bar */}
      <div className="h-10 px-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1.5 shrink-0 overflow-x-auto">
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
            className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => stepFrame(-1)}
            aria-label="Step back one frame"
            title="Previous Frame (Left Arrow)"
            className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs ${
              isPlaying
                ? 'bg-amber-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => stepFrame(1)}
            aria-label="Step forward one frame"
            title="Next Frame (Right Arrow)"
            className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200/70 transition-colors"
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
                ? 'text-blue-600 bg-blue-50 border border-blue-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Prominent HH:MM:SS:FF Timecode & Frame Display */}
          <div
            data-testid="timeline-timecode-display"
            title={`Current Timecode: ${currentTimecode} (${currentSeconds}s) | Total: ${totalTimecode} (${totalSeconds}s) at ${fps} FPS`}
            className="font-mono text-[11px] tabular-nums bg-white border border-slate-200 rounded-md px-2 py-0.5 text-slate-800 ml-1 flex items-center gap-1 shadow-2xs"
          >
            <span className="text-blue-600 font-bold tracking-tight">
              {currentTimecode}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{totalTimecode}</span>
            <span className="text-slate-300">|</span>
            <span className="text-rose-600 font-bold">
              F{String(currentFrame).padStart(3, '0')}
            </span>
            <span className="text-slate-400 text-[10px]">
              /{durationInFrames}f
            </span>
          </div>

          {/* Visual History Scrub Indicator (Playhead Position vs Recent Undo/Redo Actions) */}
          <div
            data-testid="timeline-history-scrub-indicator"
            className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 ml-1 shadow-2xs"
          >
            {/* Quick Undo Button */}
            <button
              type="button"
              data-testid="timeline-history-undo"
              disabled={historyScrubMetrics.undoCount <= 0}
              onClick={undo}
              aria-label="Undo last action on timeline"
              title={
                historyScrubMetrics.prevUndoSnap
                  ? `Undo to Step ${historyScrubMetrics.activeStepNumber - 1}: ${historyScrubMetrics.prevUndoSnap.label} (F${String(historyScrubMetrics.prevUndoSnap.frame).padStart(3, '0')})`
                  : 'No earlier undo steps'
              }
              className="p-0.5 rounded text-slate-600 hover:text-violet-700 hover:bg-violet-50 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
            </button>

            {/* Interactive Mini History Scrub Track (Playhead vs Undo/Redo Frame Positions) */}
            <div
              data-testid="timeline-history-scrub-bar"
              onClick={() => {
                setIsPlaying(false);
                setCurrentFrame(historyScrubMetrics.activeHistoryFrame);
              }}
              title={`History Scrub Radar — Playhead F${String(currentFrame).padStart(3, '0')} vs Active History Step #${historyScrubMetrics.activeStepNumber} "${historyScrubMetrics.activeSnap?.label || 'Scene'}" at F${String(historyScrubMetrics.activeHistoryFrame).padStart(3, '0')} (${
                historyScrubMetrics.deltaFromActive === 0
                  ? 'Playhead aligned with action frame'
                  : historyScrubMetrics.deltaFromActive > 0
                    ? `Playhead is +${historyScrubMetrics.deltaFromActive}f (+${historyScrubMetrics.deltaSeconds}s) ahead of action`
                    : `Playhead is ${historyScrubMetrics.deltaFromActive}f (${historyScrubMetrics.deltaSeconds}s) behind action`
              }). Click to jump playhead to action frame.`}
              className="w-20 h-4 bg-slate-100 border border-slate-200/90 rounded-sm relative flex items-center px-1 cursor-pointer group overflow-hidden"
            >
              {/* Span Connector between Active History Frame & Current Playhead */}
              <div
                data-testid="history-scrub-mini-tether"
                style={{
                  left: `${(Math.min(historyScrubMetrics.activeHistoryRatio, historyScrubMetrics.playheadRatio) * 100).toFixed(1)}%`,
                  width: `${Math.max(2, Math.abs(historyScrubMetrics.playheadRatio - historyScrubMetrics.activeHistoryRatio) * 100).toFixed(1)}%`,
                }}
                className={`absolute h-1 rounded-full transition-all ${
                  historyScrubMetrics.deltaFromActive === 0
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-violet-500 to-rose-500 opacity-75'
                }`}
              />

              {/* Recent Undo / Active / Redo Action Frame Markers on Mini Track */}
              {historyScrubMetrics.recentNodes.map((node) => {
                const nodeRatio = Math.max(
                  0.04,
                  Math.min(0.96, node.frame / Math.max(1, durationInFrames - 1))
                );
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-testid={`history-scrub-node-${node.globalIdx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      scrubToHistoryIndex(node.globalIdx, true);
                    }}
                    title={`Step #${node.stepNumber} (${node.status.toUpperCase()}): ${node.label} at F${String(node.frame).padStart(3, '0')} | Playhead Δ: ${node.deltaFrames >= 0 ? `+${node.deltaFrames}f` : `${node.deltaFrames}f`} (Click to restore & sync playhead)`}
                    style={{ left: `${(nodeRatio * 100).toFixed(1)}%` }}
                    className={`absolute -translate-x-1/2 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                      node.status === 'active'
                        ? 'w-2 h-2 bg-violet-600 ring-2 ring-violet-300 z-20'
                        : node.status === 'redo'
                          ? 'w-1.5 h-1.5 bg-amber-500 ring-1 ring-amber-200 z-10'
                          : 'w-1.5 h-1.5 bg-indigo-500 opacity-85 z-10'
                    }`}
                  />
                );
              })}

              {/* Live Playhead Pip on Mini History Scrub Track */}
              <div
                data-testid="history-scrub-playhead-pip"
                style={{
                  left: `${(historyScrubMetrics.playheadRatio * 100).toFixed(1)}%`,
                }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-600 -translate-x-1/2 z-30 pointer-events-none"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-600 -translate-x-[2px] -translate-y-[1px]" />
              </div>
            </div>

            {/* Quick Redo Button */}
            <button
              type="button"
              data-testid="timeline-history-redo"
              disabled={historyScrubMetrics.redoCount <= 0}
              onClick={redo}
              aria-label="Redo action on timeline"
              title={
                historyScrubMetrics.nextRedoSnap
                  ? `Redo to Step ${historyScrubMetrics.activeStepNumber + 1}: ${historyScrubMetrics.nextRedoSnap.label} (F${String(historyScrubMetrics.nextRedoSnap.frame).padStart(3, '0')})`
                  : 'No undone redo steps'
              }
              className="p-0.5 rounded text-slate-600 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <Redo2 className="w-3 h-3" />
            </button>

            {/* Relative Frame Delta Badge & History Inspector Toggle */}
            <button
              type="button"
              data-testid="timeline-history-delta-badge"
              aria-expanded={historyScrubOpen}
              onClick={() => setHistoryScrubOpen((prev) => !prev)}
              title="Open History Scrub Inspector — Compare playhead position against recent Undo/Redo actions and scrub through edit history"
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums flex items-center gap-1 border transition-colors cursor-pointer ${
                historyScrubOpen
                  ? 'bg-violet-600 text-white border-violet-700 font-semibold'
                  : historyScrubMetrics.deltaFromActive === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                    : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 font-semibold'
              }`}
            >
              <History className="w-2.5 h-2.5 shrink-0" />
              <span>
                H{historyScrubMetrics.activeStepNumber}/
                {historyScrubMetrics.totalSteps}
              </span>
              <span className="opacity-60">·</span>
              <span data-testid="history-scrub-delta-text">
                {historyScrubMetrics.deltaFromActive === 0
                  ? `At F${String(historyScrubMetrics.activeHistoryFrame).padStart(3, '0')}`
                  : `${historyScrubMetrics.deltaFromActive > 0 ? `+${historyScrubMetrics.deltaFromActive}` : historyScrubMetrics.deltaFromActive}f vs F${String(historyScrubMetrics.activeHistoryFrame).padStart(3, '0')}`}
              </span>
              {historyScrubMetrics.redoCount > 0 && (
                <span className="px-1 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                  +{historyScrubMetrics.redoCount}R
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center: Video Split / Trim / Ripple Tools + Multi-Keyframe Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Video & Drawing Clip Trim, Split & Ripple Group */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-md px-1 py-0.5 shadow-2xs">
            <button
              type="button"
              disabled={!canEditClipOrDrawing}
              onClick={() => trimSelectedClipToPlayhead('left')}
              title="Trim Selected Clip Start (In-Point) to Playhead"
              className="px-1.5 py-0.5 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-[11px] font-mono font-semibold transition-colors"
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
              className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-600 hover:text-white disabled:opacity-40 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Scissors className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              disabled={!canEditClipOrDrawing}
              onClick={() => trimSelectedClipToPlayhead('right')}
              title="Trim Selected Clip End (Out-Point) to Playhead"
              className="px-1.5 py-0.5 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-[11px] font-mono font-semibold transition-colors"
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
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
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
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* Keyframe Navigation & Creation Group */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-md px-1 py-0.5 shadow-2xs">
            <button
              type="button"
              disabled={!activeTargetId}
              onClick={() => jumpToAdjacentKeyframe('prev')}
              title="Jump to Previous Keyframe"
              aria-label="Jump to Previous Keyframe"
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600"
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
              className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-600 hover:text-white disabled:opacity-40 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
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
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600"
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
              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700"
            >
              <option value="ease-in-out">Ease In-Out</option>
              <option value="cubic-bezier">Cubic Bezier</option>
              <option value="custom-path">Custom Path</option>
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
                className="p-1 text-slate-600 hover:text-blue-600 rounded bg-white border border-slate-200"
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
                className="p-1 text-rose-600 hover:bg-rose-50 rounded bg-white border border-rose-200"
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
              className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium flex items-center gap-1"
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
              className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700"
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
              className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3 text-blue-600" />
              <span>Preset</span>
            </button>
          </div>
        </div>

        {/* Right: Onion Skin, Auto-KF, Auto-Scroll, Sequence Duration, Zoom & Collapse */}
        <div className="flex items-center gap-1 shrink-0">
          {lastTimelineNotice && (
            <span
              data-testid="timeline-status-notice"
              className="hidden 2xl:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 truncate max-w-[180px]"
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
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
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
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Diamond className="w-2.5 h-2.5" />
            <span>Auto-KF</span>
          </button>

          <select
            aria-label="Sequence Duration"
            value={durationInFrames}
            onChange={(e) => setTimelineSettings(fps, Number(e.target.value))}
            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-slate-700"
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

          {/* Timeline Zoom Controls (Out, Slider, In, %, Fit, Clip) */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5">
            <button
              type="button"
              onClick={() => handleZoomChange(timelineZoom * 0.8)}
              title="Zoom Out Timeline (-)"
              aria-label="Zoom Out Timeline"
              className="p-0.5 text-slate-500 hover:text-slate-900"
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
              className="w-10 accent-blue-600 cursor-pointer h-1"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(timelineZoom * 1.25)}
              title="Zoom In Timeline (+)"
              aria-label="Zoom In Timeline"
              className="p-0.5 text-slate-500 hover:text-slate-900"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <span
              data-testid="timeline-zoom-percentage"
              className="text-[10px] font-mono text-blue-600 font-semibold min-w-[26px] text-center tabular-nums"
            >
              {Math.round(timelineZoom * 100)}%
            </span>
            <button
              type="button"
              data-testid="timeline-zoom-fit"
              onClick={handleFitToTimeline}
              title="Fit Entire Project to Timeline View"
              aria-label="Fit to Timeline"
              className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-[10px] font-mono text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center gap-0.5"
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
              className="px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-[10px] font-mono text-blue-600 hover:text-blue-700 border border-slate-200"
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
            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/70"
          >
            {timelineCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Interactive Floating History Scrub Popover */}
      {historyScrubOpen && (
        <div
          ref={historyScrubPopoverRef}
          data-testid="history-scrub-popover"
          role="dialog"
          aria-label="Timeline History Scrub Inspector"
          className="fixed bottom-74 left-52 w-96 bg-white border border-slate-200 rounded-xl shadow-[0_16px_38px_rgba(15,23,42,0.18)] p-3 z-50 text-xs text-slate-800 space-y-2.5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center">
                <History className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 leading-tight">
                  Timeline History Scrub
                </div>
                <div className="text-[10px] text-slate-500">
                  Playhead F{String(currentFrame).padStart(3, '0')} vs Undo / Redo Action Frames
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setSyncPlayheadOnHistoryScrub(!syncPlayheadOnHistoryScrub)
              }
              aria-pressed={syncPlayheadOnHistoryScrub}
              data-testid="toggle-sync-playhead-history"
              title="When enabled, Undo/Redo or History Scrubbing automatically jumps the playhead to the action's frame"
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                syncPlayheadOnHistoryScrub
                  ? 'bg-violet-50 border-violet-300 text-violet-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              Sync Playhead: {syncPlayheadOnHistoryScrub ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Current Playhead vs Active History Action Comparison Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                Active Action (#{historyScrubMetrics.activeStepNumber}):
              </span>
              <span className="font-semibold text-violet-700 truncate max-w-[180px]">
                {historyScrubMetrics.activeSnap?.label || 'Initial Scene'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
              <span className="text-slate-600">
                Action Frame:{' '}
                <strong className="text-violet-700">
                  F{String(historyScrubMetrics.activeHistoryFrame).padStart(3, '0')}
                </strong>{' '}
                ({formatShortTimecode(historyScrubMetrics.activeHistoryFrame, fps)})
              </span>
              <span className="text-slate-600">
                Playhead:{' '}
                <strong className="text-rose-600">
                  F{String(currentFrame).padStart(3, '0')}
                </strong>{' '}
                ({formatShortTimecode(currentFrame, fps)})
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
              <span
                className={`text-[10px] font-mono font-semibold ${
                  historyScrubMetrics.deltaFromActive === 0
                    ? 'text-emerald-700'
                    : 'text-violet-700'
                }`}
              >
                {historyScrubMetrics.deltaFromActive === 0
                  ? 'Playhead aligned with action frame (Δ 0f)'
                  : historyScrubMetrics.deltaFromActive > 0
                    ? `Playhead is +${historyScrubMetrics.deltaFromActive}f (+${historyScrubMetrics.deltaSeconds}s) after action`
                    : `Playhead is ${historyScrubMetrics.deltaFromActive}f (${historyScrubMetrics.deltaSeconds}s) before action`}
              </span>
              <button
                type="button"
                data-testid="jump-playhead-to-history-frame"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentFrame(historyScrubMetrics.activeHistoryFrame);
                }}
                className="px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-mono font-semibold transition-colors cursor-pointer"
              >
                Jump to F{String(historyScrubMetrics.activeHistoryFrame).padStart(3, '0')}
              </button>
            </div>
          </div>

          {/* Continuous Undo/Redo State Scrubber Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>
                Scrub Undo / Redo States ({historyScrubMetrics.activeStepNumber}/
                {historyScrubMetrics.totalSteps})
              </span>
              <span>
                {historyScrubMetrics.undoCount} Undo ·{' '}
                {historyScrubMetrics.redoCount} Redo
              </span>
            </div>
            <input
              type="range"
              aria-label="History State Scrubber"
              data-testid="history-state-scrubber-slider"
              min={0}
              max={Math.max(0, historyScrubMetrics.totalSteps - 1)}
              step={1}
              value={historyIndex}
              onChange={(e) =>
                scrubToHistoryIndex(
                  Number(e.target.value),
                  syncPlayheadOnHistoryScrub
                )
              }
              className="w-full accent-violet-600 cursor-pointer h-1.5"
            />
          </div>

          {/* Recent Undo / Active / Redo Action Timeline List */}
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {history.map((snap, idx) => {
              const snapFrame = Math.max(
                0,
                Math.min(durationInFrames - 1, snap.frame ?? 0)
              );
              const delta = currentFrame - snapFrame;
              const isCurrent = idx === historyIndex;
              const isRedo = idx > historyIndex;
              return (
                <div
                  key={snap.id || idx}
                  data-testid={`history-scrub-list-item-${idx}`}
                  onClick={() => scrubToHistoryIndex(idx, true)}
                  className={`px-2.5 py-1.5 flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-violet-50 text-violet-950 font-semibold'
                      : isRedo
                        ? 'bg-amber-50/40 text-slate-600 hover:bg-amber-50'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                        isCurrent
                          ? 'bg-violet-600 text-white'
                          : isRedo
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {isCurrent ? `H${idx + 1}` : isRedo ? `R${idx + 1}` : `U${idx + 1}`}
                    </span>
                    <span className="truncate">{snap.label || `Step ${idx + 1}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums shrink-0">
                    <span className="text-slate-500">
                      F{String(snapFrame).padStart(3, '0')}
                    </span>
                    <span
                      className={`px-1 rounded text-[9px] ${
                        delta === 0
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {delta === 0
                        ? 'At Playhead'
                        : delta > 0
                          ? `Playhead +${delta}f`
                          : `Playhead ${delta}f`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Track Headers + Interactive Scrubber Lanes */}
      {!timelineCollapsed && (
        <>
          <div
            onWheel={handleTimelineWheel}
            className="flex-1 flex min-h-0 overflow-hidden"
          >
            {/* Left Column: Fixed Track Headers with Lock, Hide, Mute & Height Controls */}
            <div className="w-44 sm:w-64 border-r border-slate-200 bg-white flex flex-col shrink-0">
              <div className="h-6 px-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                    className="px-1 py-0.2 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[9px] font-mono text-slate-600"
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
                className="flex-1 overflow-y-auto divide-y divide-slate-100"
              >
                {/* 1. Video & Audio Track Headers */}
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
                          ? 'bg-emerald-50 text-emerald-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Film className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{group.label}</span>
                        {group.clips.length > 1 && (
                          <span className="text-[9px] font-mono text-emerald-600 shrink-0">
                            · {group.clips.length} cuts
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono tabular-nums text-emerald-600">
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {group.muted ? (
                            <VolumeX className="w-3 h-3 text-rose-500" />
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {group.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-amber-500" />
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {group.locked ? (
                            <Lock className="w-3 h-3 text-amber-500" />
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
                          className="p-0.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Device Keyframe Track Headers + Expandable Property Sub-Rows */}
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
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
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
                              className="p-0.5 rounded hover:bg-slate-200/70 text-blue-600 shrink-0"
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
                          <span className="text-[10px] font-mono tabular-nums text-blue-600">
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
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            {dev.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-amber-500" />
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
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            {dev.locked ? (
                              <Lock className="w-3 h-3 text-amber-500" />
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
                            className="p-0.5 text-slate-400 hover:text-slate-700"
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
                            className="p-0.5 rounded bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600"
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
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
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
                            className="h-6 pl-7 pr-2.5 flex items-center justify-between text-[11px] bg-slate-50/80 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px] text-blue-700">
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

                {/* 2.5. Webcam Overlay Track Headers */}
                {webcams.map((wc) => {
                  const isSelected = selectedWebcamId === wc.id;
                  const track = tracks.find((t) => t.targetId === wc.id);
                  const kfCount = track ? track.keyframes.length : 0;
                  const isExpanded = Boolean(track?.expanded);
                  return (
                    <React.Fragment key={wc.id}>
                      <div
                        onClick={() => selectWebcam(wc.id)}
                        className={`${rowHeightClass} px-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
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
                              aria-label={`Toggle property tracks for ${wc.name}`}
                              className="p-0.5 rounded hover:bg-slate-200/70 text-blue-600 shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{wc.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-mono tabular-nums text-blue-600">
                            {kfCount} kf
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWebcam(wc.id, { visible: !wc.visible });
                            }}
                            aria-label={
                              wc.visible ? `Hide ${wc.name}` : `Show ${wc.name}`
                            }
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            {wc.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-amber-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWebcam(wc.id, { locked: !wc.locked });
                            }}
                            aria-label={
                              wc.locked ? `Unlock ${wc.name}` : `Lock ${wc.name}`
                            }
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            {wc.locked ? (
                              <Lock className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectWebcam(wc.id);
                              addKeyframeAtCurrentFrame(wc.id, selectedEasing);
                            }}
                            title="Add Webcam Keyframe at Playhead"
                            aria-label={`Add keyframe for ${wc.name}`}
                            className="p-0.5 rounded bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateWebcam(wc.id);
                            }}
                            title="Duplicate Webcam Overlay"
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWebcam(wc.id);
                            }}
                            title="Delete Webcam Overlay"
                            className="p-0.5 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isExpanded &&
                        (
                          [
                            { key: 'pos', label: 'Position (X, Y)' },
                            { key: 'scale', label: 'Size & Scale (W, H)' },
                            { key: 'border', label: 'Border & Glow Intensity' },
                            { key: 'curve', label: 'Curve & Video Zoom' },
                          ] as const
                        ).map((propRow) => (
                          <div
                            key={`${wc.id}-${propRow.key}`}
                            onClick={() => selectWebcam(wc.id)}
                            className="h-6 pl-7 pr-2.5 flex items-center justify-between text-[11px] bg-slate-50/80 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px] text-blue-700">
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

                {/* 3. Drawing & Vector Annotation Clip Track Headers */}
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
                          ? 'bg-indigo-50 text-indigo-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <PenTool className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{dr.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono tabular-nums text-indigo-600">
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {dr.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-amber-500" />
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {dr.locked ? (
                            <Lock className="w-3 h-3 text-amber-500" />
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
                          className="p-0.5 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600"
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
                          className="p-0.5 text-slate-400 hover:text-slate-700"
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
                          className="p-0.5 text-slate-400 hover:text-rose-600"
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
              className="flex-1 flex flex-col relative bg-slate-50/70 overflow-x-auto overflow-y-auto"
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
                {/* Adaptive Time & Frame Ruler with Pixel-Exact Ticks + History Scrub Markers */}
                <div
                  data-testid="timeline-ruler"
                  onMouseDown={handleRulerScrubStart}
                  className="h-6 border-b border-slate-200 bg-slate-100/90 relative cursor-ew-resize flex items-center sticky top-0 z-20"
                >
                  {/* Visual History Scrub Tether connecting Active Undo/Redo Frame to Current Playhead */}
                  <div
                    data-testid="timeline-history-scrub-tether"
                    style={{
                      left: `${Math.min(historyScrubMetrics.activeHistoryPx, playheadPx)}px`,
                      width: `${Math.max(2, Math.abs(playheadPx - historyScrubMetrics.activeHistoryPx))}px`,
                    }}
                    className={`absolute top-0.5 h-1 rounded-full pointer-events-none z-20 transition-all ${
                      historyScrubMetrics.deltaFromActive === 0
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 opacity-85'
                    }`}
                  />

                  {/* Optional Dashed Redo Tether when undone Redo steps exist */}
                  {historyScrubMetrics.nextRedoPx !== null && (
                    <div
                      data-testid="timeline-history-redo-tether"
                      style={{
                        left: `${Math.min(historyScrubMetrics.nextRedoPx, playheadPx)}px`,
                        width: `${Math.max(2, Math.abs(playheadPx - historyScrubMetrics.nextRedoPx))}px`,
                      }}
                      className="absolute top-1.5 h-0.5 border-t border-dashed border-amber-500 pointer-events-none z-20"
                    />
                  )}

                  {/* Interactive Recent Undo / Active / Redo History Pins on the Timeline Ruler */}
                  {historyScrubMetrics.recentNodes.map((node) => (
                    <button
                      key={`ruler-hist-${node.id}`}
                      type="button"
                      data-testid={`timeline-ruler-history-pin-${node.globalIdx}`}
                      style={{ left: `${node.pixelLeft}px` }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPlaying(false);
                        if (e.shiftKey) {
                          scrubToHistoryIndex(node.globalIdx, true);
                        } else {
                          setCurrentFrame(node.frame);
                        }
                      }}
                      title={`${node.status === 'active' ? 'Active History State' : node.status === 'redo' ? 'Redo Action' : 'Undo Action'} #${node.stepNumber}: ${node.label} at F${String(node.frame).padStart(3, '0')} | Playhead Δ: ${node.deltaFrames >= 0 ? `+${node.deltaFrames}f` : `${node.deltaFrames}f`} (Click to jump playhead · Shift+Click to scrub undo/redo state)`}
                      className={`absolute top-0 -translate-x-1/2 px-1 py-0.2 rounded-b text-[8px] font-mono font-bold leading-none z-25 cursor-pointer shadow-2xs transition-transform hover:scale-110 ${
                        node.status === 'active'
                          ? 'bg-violet-600 text-white border border-violet-300'
                          : node.status === 'redo'
                            ? 'bg-amber-500 text-white border border-amber-200'
                            : 'bg-indigo-600/90 text-white'
                      }`}
                    >
                      {node.status === 'redo'
                        ? `R${node.stepNumber}`
                        : `H${node.stepNumber}`}
                    </button>
                  ))}

                  {rulerTicks.map((tick) => (
                    <div
                      key={tick.frame}
                      style={{ left: `${tick.pixelLeft}px` }}
                      className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                    >
                      {tick.isMajor ? (
                        <div className="border-l border-slate-300 pl-1.5 flex items-center h-full text-[10px] font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          <span className="font-semibold">
                            {tick.timecodeLabel}
                          </span>
                          <span className="text-slate-400 ml-1 text-[9px]">
                            ({tick.secondsLabel} · {tick.frameLabel})
                          </span>
                        </div>
                      ) : (
                        <div className="h-2.5 border-l border-slate-200 flex items-end pl-0.5">
                          {tick.showFrameDetail && (
                            <span className="text-[8px] font-mono text-slate-400 leading-none pb-0.5">
                              {tick.frameLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Track Lanes Container */}
                <div className="flex-1 divide-y divide-slate-200/70 relative">
                  {/* 1. Grouped Video & Audio Clip Lanes with Filmstrip Thumbnails & Trim Handles */}
                  {videoTrackGroups.map((group) => (
                    <div
                      key={group.trackId}
                      data-testid={`video-track-lane-${group.trackId}`}
                      onMouseDown={handleRulerScrubStart}
                      className={`${rowHeightClass} relative flex items-center bg-white hover:bg-slate-50/80`}
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
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 z-10'
                                : 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500'
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
                              className="w-2.5 h-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-ew-resize shrink-0 z-20 font-mono text-[9px] font-bold"
                            >
                              [
                            </div>

                            {/* Filmstrip Thumbnail Strip */}
                            <div className="flex-1 h-full relative overflow-hidden flex items-center">
                              <div className="absolute inset-0 flex divide-x divide-emerald-200/70 pointer-events-none">
                                {thumbs.map((th) => (
                                  <div
                                    key={th.index}
                                    style={{
                                      background: `linear-gradient(135deg, hsla(${th.accentHue}, 65%, 94%, 0.9), hsla(${(th.accentHue + 40) % 360}, 70%, 90%, 0.9))`,
                                    }}
                                    className="flex-1 h-full px-1 flex items-end justify-end overflow-hidden pb-0.5"
                                  >
                                    {clipWidthPx >= 90 && (
                                      <span className="text-[7.5px] font-mono text-emerald-700/70 leading-none">
                                        {th.sceneLabel}·{th.sourceSeconds}s
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Clip Label, Start/End/Duration Timing & Source In/Out Readout */}
                              <div className="relative z-10 w-full px-1.5 flex items-center justify-between pointer-events-none">
                                <span className="text-[10px] font-semibold text-emerald-950 truncate bg-white/90 border border-emerald-200 px-1.5 py-0.2 rounded shadow-2xs max-w-[58%]">
                                  {clip.name}
                                </span>
                                {clipWidthPx >= 130 && (
                                  <span className="text-[9px] font-mono tabular-nums text-emerald-800 ml-1 shrink-0 bg-white/90 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    {durSec}s ({clip.durationFrames}f · In:F
                                    {clip.trimStartFrames}→Out:F{outFrame})
                                  </span>
                                )}
                              </div>

                              {/* Audio Sync Waveform Bars along bottom of clip */}
                              {!clip.muted && (
                                <div className="absolute inset-x-1 bottom-0 h-1.5 flex items-end gap-0.5 opacity-45 pointer-events-none">
                                  {(clip.waveformPeaks || [])
                                    .slice(0, 48)
                                    .map((peak, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          height: `${Math.round(peak * 100)}%`,
                                        }}
                                        className="flex-1 bg-emerald-600 rounded-t-sm"
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
                              className="w-2.5 h-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-ew-resize shrink-0 z-20 font-mono text-[9px] font-bold"
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
                            isSelected ? 'bg-blue-50/50' : 'bg-white'
                          } hover:bg-slate-50/80`}
                        >
                          <div className="absolute left-0 right-0 h-0.5 bg-blue-200 pointer-events-none" />

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
                                    className="absolute h-1.5 bg-blue-200/80 rounded-full pointer-events-none"
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
                                      ? 'bg-amber-500 border-white scale-125 shadow-sm'
                                      : 'bg-blue-600 border-white hover:scale-125 shadow-xs'
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
                                className="h-6 relative flex items-center bg-slate-50 border-t border-slate-100"
                              >
                                <div className="absolute left-0 right-0 h-px bg-slate-200 pointer-events-none" />
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
                                      className={`absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 border border-white cursor-ew-resize ${
                                        propKey === 'glow'
                                          ? 'bg-indigo-500 hover:bg-amber-500'
                                          : 'bg-blue-500 hover:bg-amber-500'
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

                  {/* 2.5. Webcam Overlay Keyframe Lanes + Expanded Property Sub-Lanes */}
                  {webcams.map((wc) => {
                    const isSelected = selectedWebcamId === wc.id;
                    const track = tracks.find((t) => t.targetId === wc.id);
                    const keyframes = track ? track.keyframes : [];
                    const isExpanded = Boolean(track?.expanded);

                    return (
                      <React.Fragment key={wc.id}>
                        <div
                          onMouseDown={handleRulerScrubStart}
                          onClick={() => selectWebcam(wc.id)}
                          className={`${rowHeightClass} relative flex items-center ${
                            isSelected ? 'bg-blue-50/50' : 'bg-white'
                          } hover:bg-slate-50/80`}
                        >
                          <div className="absolute left-0 right-0 h-0.5 bg-blue-200 pointer-events-none" />

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
                                    className="absolute h-1.5 bg-blue-200/80 rounded-full pointer-events-none"
                                  />
                                )}
                                <button
                                  type="button"
                                  style={{ left: `${kfLeftPx}px` }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!track || wc.locked) return;
                                    selectWebcam(wc.id);
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
                                    if (!track || wc.locked) return;
                                    duplicateKeyframe(track.id, kf.id);
                                  }}
                                  title={`Webcam Keyframe at F${kf.frame} (${formatTimecode(
                                    kf.frame,
                                    fps
                                  )}) · Easing: ${kf.easing}`}
                                  aria-label={`Webcam keyframe at frame ${kf.frame}`}
                                  className={`absolute -translate-x-1/2 w-3.5 h-3.5 rotate-45 border-2 transition-transform z-10 ${
                                    isKfSelected
                                      ? 'bg-amber-500 border-white scale-125 shadow-sm'
                                      : 'bg-blue-600 border-white hover:scale-125 shadow-xs'
                                  }`}
                                />
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {isExpanded &&
                          (['pos', 'scale', 'border', 'curve'] as const).map(
                            (propKey) => (
                              <div
                                key={`${wc.id}-lane-${propKey}`}
                                onMouseDown={handleRulerScrubStart}
                                className="h-6 relative flex items-center bg-slate-50 border-t border-slate-100"
                              >
                                <div className="absolute left-0 right-0 h-px bg-slate-200 pointer-events-none" />
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
                                        if (!track || wc.locked) return;
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
                                      className="absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 border border-white cursor-ew-resize bg-blue-500 hover:bg-amber-500"
                                    />
                                  );
                                })}
                              </div>
                            )
                          )}
                      </React.Fragment>
                    );
                  })}

                  {/* 3. Drawing & Annotation Clip Lanes with Draggable Trim Handles & Keyframe Diamonds */}
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
                        className={`${rowHeightClass} relative flex items-center bg-white hover:bg-slate-50/80`}
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
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/30 z-10'
                              : 'bg-indigo-50/70 border-indigo-300 hover:border-indigo-500'
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
                            className="w-2.5 h-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-ew-resize shrink-0 z-10 font-mono text-[9px] font-bold"
                          >
                            [
                          </div>

                          {/* Drawing Clip Label & Timing Readout */}
                          <div className="flex-1 h-full px-2 flex items-center justify-between relative overflow-hidden">
                            <span className="text-[10px] font-semibold text-indigo-950 truncate z-10">
                              {dr.name}
                            </span>
                            {widthPx >= 110 && (
                              <span className="text-[9px] font-mono tabular-nums text-indigo-800 z-10 ml-2 shrink-0 bg-white/90 border border-indigo-200 px-1.5 py-0.2 rounded">
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
                            className="w-2.5 h-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-ew-resize shrink-0 z-10 font-mono text-[9px] font-bold"
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
                                  ? 'bg-amber-500 border-white scale-125'
                                  : 'bg-indigo-600 border-white hover:scale-125'
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
                    className="fixed bottom-64 z-50 -translate-x-1/2 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px] font-mono tabular-nums shadow-md pointer-events-none"
                  >
                    {draggingClip?.livePreviewLabel ||
                      draggingDrawingClip?.livePreviewLabel}
                  </div>
                )}

                {/* High-Contrast Playhead Line & Draggable Handle with Relative History Scrub Offset */}
                <div
                  data-testid="timeline-playhead"
                  style={{ left: `${playheadPx}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
                >
                  <div
                    className={`inline-flex items-center gap-1 w-max px-1.5 py-0.5 ${
                      playheadPx < 48
                        ? 'translate-x-0'
                        : playheadPx > metrics.totalWidthPx - 128
                          ? '-translate-x-full'
                          : '-translate-x-1/2'
                    } bg-rose-600 text-white text-[9px] font-mono font-bold rounded-b shadow-sm whitespace-nowrap`}
                  >
                    <span>
                      F{currentFrame} · {formatShortTimecode(currentFrame, fps)}
                    </span>
                    <span
                      data-testid="playhead-history-offset"
                      className="px-1 rounded-xs bg-rose-800/90 text-rose-100 text-[8px] font-mono"
                    >
                      H{historyScrubMetrics.activeStepNumber}{' '}
                      {historyScrubMetrics.deltaFromActive === 0
                        ? '±0f'
                        : historyScrubMetrics.deltaFromActive > 0
                          ? `+${historyScrubMetrics.deltaFromActive}f`
                          : `${historyScrubMetrics.deltaFromActive}f`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Bottom Horizontal Scrollbar & Navigation Bar */}
          <div
            data-testid="timeline-horizontal-scrollbar"
            className="h-6 bg-slate-50 border-t border-slate-200 px-2.5 flex items-center gap-2 shrink-0"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
              <span>
                View: {formatTimecode(visibleStartFrame, fps)} –{' '}
                {formatTimecode(visibleEndFrame, fps)}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-blue-600 font-semibold">
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
              className="flex-1 h-3.5 bg-slate-200/80 border border-slate-300 rounded relative cursor-pointer overflow-hidden"
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
                className="absolute top-0.5 bottom-0.5 rounded-sm bg-white hover:bg-blue-50 active:bg-blue-100 border border-slate-300 cursor-grab active:cursor-grabbing flex items-center justify-center shadow-2xs"
              >
                <div className="w-3 h-1 border-x border-slate-400" />
              </div>
            </div>

            {/* Quick Navigation & Auto-Scroll Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => addLongDemoVideo(60)}
                data-testid="timeline-add-60s-video"
                title="Load a 60-second (1800-frame) multi-scene video onto the timeline"
                className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono text-emerald-700 font-semibold"
              >
                + 60s Video
              </button>
              <button
                type="button"
                onClick={() => setAutoScrollTimeline(!autoScrollTimeline)}
                aria-pressed={autoScrollTimeline}
                data-testid="toggle-auto-scroll"
                data-active={autoScrollTimeline}
                title="Toggle automatic timeline scrolling during playback"
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  autoScrollTimeline
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-500'
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
