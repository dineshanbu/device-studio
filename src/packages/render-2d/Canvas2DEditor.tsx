import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Copy,
  Eraser,
  Grid3X3,
  Hexagon,
  Maximize2,
  MessageSquare,
  Minus,
  MousePointer,
  Move,
  PenTool,
  Pencil,
  RectangleHorizontal,
  RotateCw,
  Ruler,
  Scan,
  Spline,
  Square,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computeDeviceMotionTrail,
  computeSnapPosition,
  resizeDrawingGeometry,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  resolveWebcamAtFrame,
  updateDrawingLineEndpoints,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type {
  DrawableToolType,
  DrawingToolType,
  SceneDrawingObject,
  SceneWebcamOverlay,
} from '../shared/types.ts';
import { ViewportContextMenu } from '../editor/ViewportContextMenu.tsx';
import { ViewportRulers } from '../editor/ViewportRulers.tsx';
import { ViewportZoomSlider } from '../editor/ViewportZoomSlider.tsx';
import { renderSceneFrame2D } from './renderFrame2D.ts';

type DrawingResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';

type InteractionMode =
  | { type: 'none' }
  | {
      type: 'pan';
      startMouseX: number;
      startMouseY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      type: 'drag';
      deviceId: string;
      startMouseX: number;
      startMouseY: number;
      initialPositions: Record<string, { x: number; y: number }>;
      initialDrawingPositions?: Record<string, { x: number; y: number }>;
      initialWebcamPositions?: Record<string, { x: number; y: number }>;
    }
  | {
      type: 'marquee';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      startClientX: number;
      startClientY: number;
      currentClientX: number;
      currentClientY: number;
      additive: boolean;
      initialDeviceIds: string[];
      initialDrawingIds: string[];
      initialWebcamIds: string[];
    }
  | {
      type: 'drag-webcam';
      webcamId: string;
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
    }
  | {
      type: 'resize-webcam';
      webcamId: string;
      handle: DrawingResizeHandle;
      startMouseX: number;
      startMouseY: number;
      origWebcam: SceneWebcamOverlay;
    }
  | {
      type: 'rotate-webcam';
      webcamId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      initialRotation: number;
    }
  | {
      type: 'drag-webcam-bezier-point';
      webcamId: string;
      pointIndex: number;
    }
  | {
      type: 'drag-drawing';
      drawingId: string;
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
    }
  | {
      type: 'resize-drawing';
      drawingId: string;
      handle: DrawingResizeHandle;
      startMouseX: number;
      startMouseY: number;
      origDrawing: SceneDrawingObject;
    }
  | {
      type: 'rotate-drawing';
      drawingId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      initialRotation: number;
    }
  | {
      type: 'drag-drawing-endpoint';
      drawingId: string;
      endpointIndex: 0 | 1;
      otherX: number;
      otherY: number;
    }
  | { type: 'erasing' }
  | {
      type: 'scale';
      deviceId: string;
      startMouseX: number;
      startMouseY: number;
      startScaleX: number;
      startScaleY: number;
    }
  | {
      type: 'rotate';
      deviceId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      initialRotation: number;
    }
  | {
      type: 'creating-drawing';
      tool: DrawableToolType;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      points: { x: number; y: number }[];
    };

export const Canvas2DEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    canvasWidth,
    canvasHeight,
    devices,
    drawings,
    webcams,
    clips,
    tracks,
    mediaAssets,
    background,
    selectedIds,
    selectedDrawingId,
    selectedDrawingIds,
    selectedWebcamId,
    selectedWebcamIds,
    activeDrawingTool,
    drawingDefaults,
    currentFrame,
    fps,
    durationInFrames,
    isPlaying,
    zoom,
    panX,
    panY,
    snapToGrid,
    gridSize,
    showGuides,
    showRulers,
    setShowRulers,
    isPreviewMode,
    showMotionTrail,
    selectDevice,
    selectDrawing,
    selectWebcam,
    setMarqueeSelection,
    updateDevice,
    updateDrawing,
    updateWebcam,
    addDrawing,
    deleteDrawing,
    duplicateDrawing,
    deleteWebcam,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    groupSelectedDevices,
    setActiveDrawingTool,
    setCurrentFrame,
    setZoomAndPan,
    toggleSnapToGrid,
    setGridSize,
    snapSelectedToGrid,
    pushHistory,
  } = useStudioStore();

  const [interaction, setInteractionState] = useState<InteractionMode>({
    type: 'none',
  });
  const interactionRef = useRef<InteractionMode>({ type: 'none' });
  const setInteraction = (next: InteractionMode) => {
    interactionRef.current = next;
    setInteractionState(next);
  };
  const [activeGuides, setActiveGuides] = useState<{
    x: number[];
    y: number[];
  }>({
    x: [],
    y: [],
  });
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [contextMenu, setContextMenu] = useState<{
    clientX: number;
    clientY: number;
    stageX: number;
    stageY: number;
  } | null>(null);

  // Keyboard shortcuts for Drawing Tool UX: Escape to cancel/deselect, Delete/Backspace to delete, single-key tool switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (interaction.type === 'creating-drawing') {
          setInteraction({ type: 'none' });
          return;
        }
        if (activeDrawingTool !== 'select') {
          setActiveDrawingTool('select');
          return;
        }
        selectDrawing(null);
        selectWebcam(null);
        selectDevice(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          e.preventDefault();
          deleteDrawing(selectedDrawingId);
          return;
        }
        if (selectedWebcamId) {
          e.preventDefault();
          deleteWebcam(selectedWebcamId);
          return;
        }
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelectedDevices();
          return;
        }
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') setActiveDrawingTool('select');
        else if (key === 'm') setActiveDrawingTool('multi-select');
        else if (key === 'b') setActiveDrawingTool('brush');
        else if (key === 'p') setActiveDrawingTool('pen');
        else if (key === 'l') setActiveDrawingTool('line');
        else if (key === 'a') setActiveDrawingTool('arrow');
        else if (key === 'r') setActiveDrawingTool('rect');
        else if (key === 'u') setActiveDrawingTool('rounded-rect');
        else if (key === 'c') setActiveDrawingTool('circle');
        else if (key === 'o') setActiveDrawingTool('ellipse');
        else if (key === 'e') setActiveDrawingTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    interaction.type,
    activeDrawingTool,
    selectedDrawingId,
    selectedWebcamId,
    selectedIds,
    setActiveDrawingTool,
    selectDrawing,
    selectWebcam,
    selectDevice,
    deleteDrawing,
    deleteWebcam,
    deleteSelectedDevices,
  ]);

  // Render loop (throttled in headless Chromium per ultra-mode rules)
  useEffect(() => {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    let animId = 0;
    let lastRender = 0;

    const renderLoop = (now: number) => {
      if (isHeadless && now - lastRender < 66) {
        animId = requestAnimationFrame(renderLoop);
        return;
      }
      lastRender = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Build temporary preview drawing if user is currently dragging a stroke/shape
          let previewDrawings = drawings;
          if (interaction.type === 'creating-drawing') {
            const minX = Math.min(interaction.startX, interaction.currentX);
            const maxX = Math.max(interaction.startX, interaction.currentX);
            const minY = Math.min(interaction.startY, interaction.currentY);
            const maxY = Math.max(interaction.startY, interaction.currentY);
            const rawW = Math.max(16, maxX - minX);
            const rawH = Math.max(16, maxY - minY);
            const isCircle = interaction.tool === 'circle';
            const w = isCircle ? Math.max(rawW, rawH) : rawW;
            const h = isCircle ? Math.max(rawW, rawH) : rawH;
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            const tempObj: SceneDrawingObject = {
              id: 'temp-preview-drawing',
              name: 'Live Drawing Preview',
              tool: interaction.tool,
              points:
                interaction.tool === 'brush' ||
                interaction.tool === 'pen' ||
                interaction.tool === 'bezier'
                  ? interaction.points.map((p) => ({ x: p.x - cx, y: p.y - cy }))
                  : [
                      {
                        x: interaction.startX - cx,
                        y: interaction.startY - cy,
                      },
                      {
                        x: interaction.currentX - cx,
                        y: interaction.currentY - cy,
                      },
                    ],
              x: cx,
              y: cy,
              width: w,
              height: h,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 1,
              visible: true,
              locked: false,
              zIndex: drawings.length + 20,
              strokeColor: drawingDefaults.strokeColor,
              strokeColorEnd: drawingDefaults.strokeColorEnd,
              useGradientStroke: drawingDefaults.useGradientStroke,
              strokeWidth: drawingDefaults.strokeWidth,
              strokeOpacity: drawingDefaults.strokeOpacity,
              fillColor: drawingDefaults.fillColor,
              fillOpacity: drawingDefaults.fillOpacity,
              lineCap: 'round',
              lineJoin: 'round',
              dashPattern: drawingDefaults.dashPattern,
              cornerRadius: 24,
              polygonSides: 6,
              glowEnabled: drawingDefaults.glowEnabled,
              glowColor: drawingDefaults.glowColor,
              glowRadius: drawingDefaults.glowRadius,
              glowIntensity: drawingDefaults.glowIntensity,
              glowSpread: drawingDefaults.glowSpread,
              shadowEnabled: true,
              shadowColor: '#000000',
              shadowBlur: 16,
              animationMode: 'none',
              animationDurationFrames: drawingDefaults.animationDurationFrames,
              animationSpeed: drawingDefaults.animationSpeed,
              animationEasing: drawingDefaults.animationEasing,
            };
            previewDrawings = [...drawings, tempObj];
          }

          renderSceneFrame2D(ctx, {
            width: canvasWidth,
            height: canvasHeight,
            frame: currentFrame,
            fps,
            durationInFrames,
            devices,
            drawings: previewDrawings,
            webcams,
            clips,
            tracks,
            mediaAssets,
            background,
            isPlaying,
          });

          // Skip all editor overlays, stage grids, motion trails, and selection UI handles when Preview Mode is active
          if (!isPreviewMode) {
            // Draw configurable Snap-to-Grid stage overlay when snapToGrid is active
            if (snapToGrid) {
            const safeGrid = Math.max(8, Math.round(gridSize || 40));
            const majorEvery = safeGrid * 4;
            ctx.save();

            // Minor grid lines
            ctx.beginPath();
            for (let gx = safeGrid; gx < canvasWidth; gx += safeGrid) {
              if (gx % majorEvery === 0) continue;
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, canvasHeight);
            }
            for (let gy = safeGrid; gy < canvasHeight; gy += safeGrid) {
              if (gy % majorEvery === 0) continue;
              ctx.moveTo(0, gy);
              ctx.lineTo(canvasWidth, gy);
            }
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
            ctx.lineWidth = Math.max(1, 1 / zoom);
            ctx.stroke();

            // Major grid lines (every 4 cells)
            ctx.beginPath();
            for (let gx = majorEvery; gx < canvasWidth; gx += majorEvery) {
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, canvasHeight);
            }
            for (let gy = majorEvery; gy < canvasHeight; gy += majorEvery) {
              ctx.moveTo(0, gy);
              ctx.lineTo(canvasWidth, gy);
            }
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
            ctx.lineWidth = Math.max(1.2, 1.4 / zoom);
            ctx.stroke();

            ctx.restore();
          }

          // Draw smart alignment guides
          if (
            showGuides &&
            (activeGuides.x.length > 0 || activeGuides.y.length > 0)
          ) {
            ctx.save();
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2 / zoom;
            ctx.setLineDash([6 / zoom, 6 / zoom]);
            for (const gx of activeGuides.x) {
              ctx.beginPath();
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, canvasHeight);
              ctx.stroke();
            }
            for (const gy of activeGuides.y) {
              ctx.beginPath();
              ctx.moveTo(0, gy);
              ctx.lineTo(canvasWidth, gy);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Draw Onion Skin Ghost Silhouettes & Motion Trail Path when enabled
          if (showMotionTrail) {
            const targetDevices = devices.filter(
              (d) =>
                d.visible &&
                (selectedIds.length === 0 || selectedIds.includes(d.id))
            );

            for (const rawDev of targetDevices) {
              const track = tracks.find((t) => t.targetId === rawDev.id);
              if (!track || track.keyframes.length < 2) continue;

              const trail = computeDeviceMotionTrail(
                rawDev,
                track.keyframes,
                currentFrame,
                durationInFrames,
                3
              );
              if (!trail.hasTrail) continue;

              // 1. Onion Skin Ghost Silhouettes (Past = Cyan, Future = Amber)
              for (const ghost of trail.ghosts) {
                const isPast = ghost.relation === 'past';
                const strokeColor = isPast ? '#22D3EE' : '#F59E0B';
                const fillColor = isPast
                  ? 'rgba(34, 211, 238, 0.08)'
                  : 'rgba(245, 158, 11, 0.08)';

                ctx.save();
                ctx.translate(ghost.x, ghost.y);
                ctx.rotate((ghost.rotation * Math.PI) / 180);
                ctx.globalAlpha = ghost.weight;

                const gw = ghost.width * ghost.scaleX;
                const gh = ghost.height * ghost.scaleY;
                const gr = Math.min(
                  gw / 2,
                  gh / 2,
                  ghost.cornerRadius * Math.min(ghost.scaleX, ghost.scaleY)
                );

                // Ghost body fill & perimeter outline
                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = (ghost.isImmediate ? 2.6 : 1.6) / zoom;
                ctx.setLineDash(
                  ghost.isKeyframe
                    ? ghost.isImmediate
                      ? [12 / zoom, 5 / zoom]
                      : [7 / zoom, 5 / zoom]
                    : [3 / zoom, 4 / zoom]
                );

                ctx.beginPath();
                ctx.roundRect(-gw / 2, -gh / 2, gw, gh, gr);
                ctx.fill();
                ctx.stroke();

                // Ghost inner screen bezel frame for immediate prev/next keyframes
                if (ghost.isImmediate) {
                  const inset = Math.min(18, gw * 0.045);
                  ctx.lineWidth = 1.2 / zoom;
                  ctx.setLineDash([4 / zoom, 4 / zoom]);
                  ctx.beginPath();
                  ctx.roundRect(
                    -gw / 2 + inset,
                    -gh / 2 + inset,
                    Math.max(4, gw - inset * 2),
                    Math.max(4, gh - inset * 2),
                    Math.max(4, gr - inset * 0.6)
                  );
                  ctx.stroke();
                }

                ctx.restore();
              }

              // 2. Continuous Motion Path Trajectory & Velocity Dots
              if (trail.samples.length >= 2) {
                ctx.save();
                for (let i = 0; i < trail.samples.length - 1; i++) {
                  const p0 = trail.samples[i];
                  const p1 = trail.samples[i + 1];
                  const isPastSeg = p1.frame <= currentFrame;

                  ctx.beginPath();
                  ctx.moveTo(p0.x, p0.y);
                  ctx.lineTo(p1.x, p1.y);
                  ctx.strokeStyle = isPastSeg ? '#22D3EE' : '#F59E0B';
                  ctx.lineWidth = 3 / zoom;
                  ctx.setLineDash(
                    isPastSeg ? [] : [8 / zoom, 5 / zoom]
                  );
                  ctx.stroke();
                }

                // Easing velocity sample ticks along the motion path
                ctx.setLineDash([]);
                for (const sample of trail.samples) {
                  const isPastPt = sample.frame <= currentFrame;
                  ctx.fillStyle = isPastPt ? '#22D3EE' : '#F59E0B';
                  ctx.beginPath();
                  ctx.arc(sample.x, sample.y, 3.2 / zoom, 0, Math.PI * 2);
                  ctx.fill();
                }

                // Directional tangent arrowheads between consecutive keyframes
                for (let i = 0; i < trail.keyframeNodes.length - 1; i++) {
                  const n0 = trail.keyframeNodes[i];
                  const n1 = trail.keyframeNodes[i + 1];
                  const dist = Math.hypot(n1.x - n0.x, n1.y - n0.y);
                  if (dist < 24) continue;

                  const midX = (n0.x + n1.x) / 2;
                  const midY = (n0.y + n1.y) / 2;
                  const angle = Math.atan2(n1.y - n0.y, n1.x - n0.x);
                  const isPastArrow = n1.frame <= currentFrame;
                  const arrowSize = 9 / zoom;

                  ctx.save();
                  ctx.translate(midX, midY);
                  ctx.rotate(angle);
                  ctx.fillStyle = isPastArrow ? '#22D3EE' : '#F59E0B';
                  ctx.beginPath();
                  ctx.moveTo(arrowSize, 0);
                  ctx.lineTo(-arrowSize * 0.7, -arrowSize * 0.65);
                  ctx.lineTo(-arrowSize * 0.7, arrowSize * 0.65);
                  ctx.closePath();
                  ctx.fill();
                  ctx.restore();
                }
                ctx.restore();
              }

              // 3. Keyframe Waypoint Diamonds & Frame Badges on Canvas
              ctx.save();
              const diamondR = 9 / zoom;
              const fontSize = Math.max(10, Math.round(11 / zoom));
              ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;

              for (const node of trail.keyframeNodes) {
                const isPast = node.relation === 'past';
                const isCurrent = node.relation === 'current';
                const nodeColor = isCurrent
                  ? '#F43F5E'
                  : isPast
                    ? '#22D3EE'
                    : '#F59E0B';

                // Diamond marker
                ctx.save();
                ctx.translate(node.x, node.y);
                ctx.beginPath();
                ctx.moveTo(0, -diamondR);
                ctx.lineTo(diamondR, 0);
                ctx.lineTo(0, diamondR);
                ctx.lineTo(-diamondR, 0);
                ctx.closePath();
                ctx.fillStyle = nodeColor;
                ctx.fill();
                ctx.lineWidth = 2 / zoom;
                ctx.strokeStyle =
                  node.isImmediatePrev || node.isImmediateNext || isCurrent
                    ? '#F8FAFC'
                    : '#090D16';
                ctx.stroke();
                ctx.restore();

                // Frame label pill
                const prefix = isCurrent
                  ? 'NOW'
                  : node.isImmediatePrev
                    ? 'PREV'
                    : node.isImmediateNext
                      ? 'NEXT'
                      : 'KF';
                const badgeText = `${prefix} · F${String(node.frame).padStart(3, '0')}`;
                const textMetrics = ctx.measureText(badgeText);
                const padX = 7 / zoom;
                const pillW = textMetrics.width + padX * 2;
                const pillH = 19 / zoom;
                const pillX = node.x - pillW / 2;
                const pillY = node.y - diamondR - pillH - 6 / zoom;

                ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
                ctx.strokeStyle = nodeColor;
                ctx.lineWidth = 1.4 / zoom;
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 5 / zoom);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#F8FAFC';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, node.x, pillY + pillH / 2);
              }
              ctx.restore();
            }
          }

          // Draw Selection Bounding Boxes & Handles for Selected Devices
          for (const rawDev of devices) {
            if (!rawDev.visible || !selectedIds.includes(rawDev.id)) continue;
            const track = tracks.find((t) => t.targetId === rawDev.id);
            const dev = resolveDeviceAtFrame(
              rawDev,
              track ? track.keyframes : [],
              currentFrame,
              durationInFrames
            );

            ctx.save();
            ctx.translate(dev.x, dev.y);
            ctx.rotate((dev.rotation * Math.PI) / 180);

            const bw = dev.width * dev.scaleX;
            const bh = dev.height * dev.scaleY;
            const halfW = bw / 2;
            const halfH = bh / 2;

            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = Math.max(2, 2 / zoom);
            ctx.strokeRect(-halfW - 4, -halfH - 4, bw + 8, bh + 8);

            // Rotation stem & handle at top center
            const rotHandleY = -halfH - 36;
            ctx.beginPath();
            ctx.moveTo(0, -halfH - 4);
            ctx.lineTo(0, rotHandleY);
            ctx.stroke();

            ctx.fillStyle = '#0F172A';
            ctx.beginPath();
            ctx.arc(0, rotHandleY, 8 / zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 4 Corner resize handles
            const corners = [
              [-halfW - 4, -halfH - 4],
              [halfW + 4, -halfH - 4],
              [halfW + 4, halfH + 4],
              [-halfW - 4, halfH + 4],
            ];
            const hs = 10 / zoom;
            for (const [cx, cy] of corners) {
              ctx.fillStyle = '#F8FAFC';
              ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
              ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
            }

            ctx.restore();
          }

          // Draw Selection Bounding Box, 8 Resize Handles, Rotation Handle & Bezier Curve Handles for Selected Webcam Overlay
          if (selectedWebcamId) {
            const rawSelWc = webcams.find((w) => w.id === selectedWebcamId);
            if (rawSelWc && rawSelWc.visible) {
              const wcTrack = tracks.find((t) => t.targetId === rawSelWc.id);
              const selWc = resolveWebcamAtFrame(
                rawSelWc,
                wcTrack ? wcTrack.keyframes : [],
                currentFrame
              );
              ctx.save();
              ctx.translate(selWc.x, selWc.y);
              ctx.rotate((selWc.rotation * Math.PI) / 180);
              const bw = selWc.width * selWc.scaleX;
              const bh = selWc.height * selWc.scaleY;
              const halfW = bw / 2;
              const halfH = bh / 2;
              const pad = 6;

              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = Math.max(1.8, 2 / zoom);
              ctx.setLineDash([6 / zoom, 4 / zoom]);
              ctx.strokeRect(-halfW - pad, -halfH - pad, bw + pad * 2, bh + pad * 2);
              ctx.setLineDash([]);

              // Rotation stem & handle at top center
              const rotHandleY = -halfH - pad - 28 / zoom;
              ctx.beginPath();
              ctx.moveTo(0, -halfH - pad);
              ctx.lineTo(0, rotHandleY);
              ctx.stroke();

              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.arc(0, rotHandleY, 7.5 / zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // 4 Corner resize handles (NW, NE, SE, SW)
              const cornerHandles: [number, number][] = [
                [-halfW - pad, -halfH - pad],
                [halfW + pad, -halfH - pad],
                [halfW + pad, halfH + pad],
                [-halfW - pad, halfH + pad],
              ];
              const hs = 10 / zoom;
              for (const [cx, cy] of cornerHandles) {
                ctx.fillStyle = '#F8FAFC';
                ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
                ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
              }

              // 4 Side resize handles (N, E, S, W)
              const sideHandles: [number, number, number, number][] = [
                [0, -halfH - pad, 14 / zoom, 7 / zoom],
                [halfW + pad, 0, 7 / zoom, 14 / zoom],
                [0, halfH + pad, 14 / zoom, 7 / zoom],
                [-halfW - pad, 0, 7 / zoom, 14 / zoom],
              ];
              for (const [sx, sy, sw, sh] of sideHandles) {
                ctx.fillStyle = '#38BDF8';
                ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
                ctx.strokeStyle = '#0F172A';
                ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
              }

              // Interactive Bezier curve control handles for curved/custom shapes
              if (
                (selWc.shape === 'custom-bezier' ||
                  selWc.shape === 'curved-asymmetric' ||
                  selWc.shape === 'organic-blob') &&
                selWc.bezierPoints &&
                selWc.bezierPoints.length >= 3
              ) {
                ctx.save();
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
                ctx.lineWidth = 1.5 / zoom;
                ctx.setLineDash([4 / zoom, 3 / zoom]);
                ctx.beginPath();
                selWc.bezierPoints.forEach((bp, idx) => {
                  const px = bp.x * halfW;
                  const py = bp.y * halfH;
                  if (idx === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
                });
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);

                selWc.bezierPoints.forEach((bp, idx) => {
                  const px = bp.x * halfW;
                  const py = bp.y * halfH;
                  ctx.beginPath();
                  ctx.arc(px, py, 7 / zoom, 0, Math.PI * 2);
                  ctx.fillStyle = '#F59E0B';
                  ctx.fill();
                  ctx.lineWidth = 2 / zoom;
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.stroke();

                  // Control point index label
                  ctx.fillStyle = '#090D16';
                  ctx.font = `700 ${Math.max(8, Math.round(9 / zoom))}px "JetBrains Mono", monospace`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(String(idx + 1), px, py);
                });
                ctx.restore();
              }

              // Dimension & Shape readout badge below selected webcam
              const dimText = `${selWc.shape.toUpperCase()} · ${Math.round(bw)} × ${Math.round(bh)} px · ${Math.round(selWc.rotation)}°`;
              const fontSize = Math.max(10, Math.round(11 / zoom));
              ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
              const textW = ctx.measureText(dimText).width;
              const pillW = textW + 14 / zoom;
              const pillH = 20 / zoom;
              const pillX = -pillW / 2;
              const pillY = halfH + pad + 10 / zoom;
              ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = 1.2 / zoom;
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 5 / zoom);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = '#E2E8F0';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(dimText, 0, pillY + pillH / 2);

              ctx.restore();
            }
          }

          // Draw Selection Bounding Box for Selected Drawings (single or multi-selected via marquee)
          const activeSelectedDrawingIds = Array.from(
            new Set([
              ...selectedDrawingIds,
              ...(selectedDrawingId ? [selectedDrawingId] : []),
            ])
          );
          for (const drId of activeSelectedDrawingIds) {
            const rawSelDr = drawings.find((d) => d.id === drId);
            if (rawSelDr && rawSelDr.visible) {
              const drTrack = tracks.find((t) => t.targetId === rawSelDr.id);
              const selDr = resolveDrawingAtFrame(
                rawSelDr,
                drTrack ? drTrack.keyframes : [],
                currentFrame
              );
              ctx.save();
              ctx.translate(selDr.x, selDr.y);
              ctx.rotate((selDr.rotation * Math.PI) / 180);
              const bw = selDr.width * selDr.scaleX;
              const bh = selDr.height * selDr.scaleY;
              const halfW = bw / 2;
              const halfH = bh / 2;
              const pad = 6;

              ctx.strokeStyle = '#22D3EE';
              ctx.lineWidth = Math.max(1.8, 2 / zoom);
              ctx.setLineDash([6 / zoom, 4 / zoom]);
              ctx.strokeRect(-halfW - pad, -halfH - pad, bw + pad * 2, bh + pad * 2);
              ctx.setLineDash([]);

              // Rotation stem & handle at top center
              const rotHandleY = -halfH - pad - 28 / zoom;
              ctx.beginPath();
              ctx.moveTo(0, -halfH - pad);
              ctx.lineTo(0, rotHandleY);
              ctx.stroke();

              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.arc(0, rotHandleY, 7.5 / zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // 4 Corner resize handles (NW, NE, SE, SW)
              const cornerHandles: [number, number][] = [
                [-halfW - pad, -halfH - pad],
                [halfW + pad, -halfH - pad],
                [halfW + pad, halfH + pad],
                [-halfW - pad, halfH + pad],
              ];
              const hs = 10 / zoom;
              for (const [cx, cy] of cornerHandles) {
                ctx.fillStyle = '#F8FAFC';
                ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
                ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
              }

              // 4 Side resize handles (N, E, S, W)
              const sideHandles: [number, number, number, number][] = [
                [0, -halfH - pad, 14 / zoom, 7 / zoom], // N
                [halfW + pad, 0, 7 / zoom, 14 / zoom], // E
                [0, halfH + pad, 14 / zoom, 7 / zoom], // S
                [-halfW - pad, 0, 7 / zoom, 14 / zoom], // W
              ];
              for (const [sx, sy, sw, sh] of sideHandles) {
                ctx.fillStyle = '#22D3EE';
                ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);
                ctx.strokeStyle = '#0F172A';
                ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
              }

              // Endpoint handles for Line and Arrow tools
              if (
                (selDr.tool === 'line' || selDr.tool === 'arrow') &&
                selDr.points.length >= 2
              ) {
                const p0 = selDr.points[0];
                const p1 = selDr.points[1];
                for (const ptEnd of [p0, p1]) {
                  ctx.beginPath();
                  ctx.arc(
                    ptEnd.x * selDr.scaleX,
                    ptEnd.y * selDr.scaleY,
                    8 / zoom,
                    0,
                    Math.PI * 2
                  );
                  ctx.fillStyle = '#F59E0B';
                  ctx.fill();
                  ctx.lineWidth = 2 / zoom;
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.stroke();
                }
              }

              // Dimension & Rotation readout badge below selected drawing
              const dimText = `${Math.round(bw)} × ${Math.round(bh)} px · ${Math.round(
                selDr.rotation
              )}°`;
              const fontSize = Math.max(10, Math.round(11 / zoom));
              ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
              const textW = ctx.measureText(dimText).width;
              const pillW = textW + 14 / zoom;
              const pillH = 20 / zoom;
              const pillX = -pillW / 2;
              const pillY = halfH + pad + 10 / zoom;
              ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
              ctx.strokeStyle = '#22D3EE';
              ctx.lineWidth = 1.2 / zoom;
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 5 / zoom);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = '#E2E8F0';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(dimText, 0, pillY + pillH / 2);

              ctx.restore();
            }
          }

          // Draw Combined Multi-Selection Group Bounding Box when 2+ elements are selected
          const activeSelectedWebcamIds = Array.from(
            new Set([
              ...selectedWebcamIds,
              ...(selectedWebcamId ? [selectedWebcamId] : []),
            ])
          );
          const totalSelectedCount =
            selectedIds.length +
            activeSelectedDrawingIds.length +
            activeSelectedWebcamIds.length;

          if (totalSelectedCount >= 2) {
            let gMinX = Infinity;
            let gMaxX = -Infinity;
            let gMinY = Infinity;
            let gMaxY = -Infinity;

            for (const devId of selectedIds) {
              const rawDev = devices.find((d) => d.id === devId);
              if (!rawDev || !rawDev.visible) continue;
              const track = tracks.find((t) => t.targetId === rawDev.id);
              const dev = resolveDeviceAtFrame(
                rawDev,
                track ? track.keyframes : [],
                currentFrame,
                durationInFrames
              );
              const bw = dev.width * dev.scaleX;
              const bh = dev.height * dev.scaleY;
              const rad = (dev.rotation * Math.PI) / 180;
              const cos = Math.abs(Math.cos(rad));
              const sin = Math.abs(Math.sin(rad));
              const halfW = (bw * cos + bh * sin) / 2;
              const halfH = (bw * sin + bh * cos) / 2;
              gMinX = Math.min(gMinX, dev.x - halfW);
              gMaxX = Math.max(gMaxX, dev.x + halfW);
              gMinY = Math.min(gMinY, dev.y - halfH);
              gMaxY = Math.max(gMaxY, dev.y + halfH);
            }

            for (const drId of activeSelectedDrawingIds) {
              const rawDr = drawings.find((d) => d.id === drId);
              if (!rawDr || !rawDr.visible) continue;
              const drTrack = tracks.find((t) => t.targetId === rawDr.id);
              const dr = resolveDrawingAtFrame(
                rawDr,
                drTrack ? drTrack.keyframes : [],
                currentFrame
              );
              const bw = dr.width * dr.scaleX;
              const bh = dr.height * dr.scaleY;
              const halfW = bw / 2;
              const halfH = bh / 2;
              gMinX = Math.min(gMinX, dr.x - halfW);
              gMaxX = Math.max(gMaxX, dr.x + halfW);
              gMinY = Math.min(gMinY, dr.y - halfH);
              gMaxY = Math.max(gMaxY, dr.y + halfH);
            }

            for (const wcId of activeSelectedWebcamIds) {
              const rawWc = webcams.find((w) => w.id === wcId);
              if (!rawWc || !rawWc.visible) continue;
              const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
              const wc = resolveWebcamAtFrame(
                rawWc,
                wcTrack ? wcTrack.keyframes : [],
                currentFrame
              );
              const bw = wc.width * wc.scaleX;
              const bh = wc.height * wc.scaleY;
              const halfW = bw / 2;
              const halfH = bh / 2;
              gMinX = Math.min(gMinX, wc.x - halfW);
              gMaxX = Math.max(gMaxX, wc.x + halfW);
              gMinY = Math.min(gMinY, wc.y - halfH);
              gMaxY = Math.max(gMaxY, wc.y + halfH);
            }

            if (Number.isFinite(gMinX) && Number.isFinite(gMaxX)) {
              const pad = 16 / zoom;
              const boxX = gMinX - pad;
              const boxY = gMinY - pad;
              const boxW = gMaxX - gMinX + pad * 2;
              const boxH = gMaxY - gMinY + pad * 2;

              ctx.save();
              ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
              ctx.lineWidth = Math.max(1.8, 2 / zoom);
              ctx.setLineDash([8 / zoom, 5 / zoom]);
              ctx.strokeRect(boxX, boxY, boxW, boxH);
              ctx.setLineDash([]);

              // Multi-Selection Group Header Pill
              const groupLabel = `${totalSelectedCount} SELECTED · ${Math.round(
                gMaxX - gMinX
              )} × ${Math.round(gMaxY - gMinY)} px`;
              const fontSize = Math.max(10, Math.round(11 / zoom));
              ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
              const textW = ctx.measureText(groupLabel).width;
              const pillW = textW + 16 / zoom;
              const pillH = 21 / zoom;
              const pillX = boxX;
              const pillY = Math.max(8 / zoom, boxY - pillH - 6 / zoom);

              ctx.fillStyle = 'rgba(30, 27, 75, 0.94)';
              ctx.strokeStyle = '#818CF8';
              ctx.lineWidth = 1.4 / zoom;
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 5 / zoom);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#E0E7FF';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(groupLabel, pillX + 8 / zoom, pillY + pillH / 2);
              ctx.restore();
            }
          }

          // Draw Active Marquee Selection Box when user is drag-selecting in empty space
          if (interaction.type === 'marquee') {
            const mMinX = Math.min(interaction.startX, interaction.currentX);
            const mMaxX = Math.max(interaction.startX, interaction.currentX);
            const mMinY = Math.min(interaction.startY, interaction.currentY);
            const mMaxY = Math.max(interaction.startY, interaction.currentY);
            const mW = mMaxX - mMinX;
            const mH = mMaxY - mMinY;

            if (mW >= 2 || mH >= 2) {
              ctx.save();
              ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
              ctx.fillRect(mMinX, mMinY, mW, mH);

              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = Math.max(1.6, 2 / zoom);
              ctx.strokeRect(mMinX, mMinY, mW, mH);

              ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
              ctx.lineWidth = Math.max(1, 1.2 / zoom);
              ctx.setLineDash([6 / zoom, 5 / zoom]);
              ctx.strokeRect(mMinX, mMinY, mW, mH);
              ctx.setLineDash([]);

              // Corner anchor squares on marquee box
              const cs = 7 / zoom;
              ctx.fillStyle = '#38BDF8';
              for (const [cx, cy] of [
                [mMinX, mMinY],
                [mMaxX, mMinY],
                [mMaxX, mMaxY],
                [mMinX, mMaxY],
              ]) {
                ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
              }

              // Live Marquee Dimension & Hit Readout Pill
              const marqueeLabel = `MARQUEE · ${totalSelectedCount} HIT · ${Math.round(
                mW
              )} × ${Math.round(mH)} px`;
              const fontSize = Math.max(10, Math.round(11 / zoom));
              ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
              const textW = ctx.measureText(marqueeLabel).width;
              const pillW = textW + 14 / zoom;
              const pillH = 20 / zoom;
              const pillX = Math.min(
                canvasWidth - pillW - 6 / zoom,
                Math.max(6 / zoom, mMaxX - pillW)
              );
              const pillY = Math.min(
                canvasHeight - pillH - 6 / zoom,
                mMaxY + 8 / zoom
              );

              ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = 1.2 / zoom;
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, pillH, 5 / zoom);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#F8FAFC';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(marqueeLabel, pillX + 7 / zoom, pillY + pillH / 2);

              ctx.restore();
            }
          }
          }
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    canvasWidth,
    canvasHeight,
    devices,
    drawings,
    webcams,
    clips,
    tracks,
    mediaAssets,
    background,
    selectedIds,
    selectedDrawingId,
    selectedDrawingIds,
    selectedWebcamId,
    selectedWebcamIds,
    drawingDefaults,
    interaction,
    currentFrame,
    fps,
    durationInFrames,
    isPlaying,
    zoom,
    snapToGrid,
    gridSize,
    showGuides,
    isPreviewMode,
    showMotionTrail,
    activeGuides,
  ]);

  // Convert viewport clientX/Y into logical canvas coordinates
  const clientToCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / Math.max(1, rect.width);
    const scaleY = canvasHeight / Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Compute all unlocked visible scene elements intersecting a canvas-space marquee box
  const computeMarqueeSelectionAtRect = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    additive: boolean,
    initialDeviceIds: string[],
    initialDrawingIds: string[],
    initialWebcamIds: string[]
  ) => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const hitDeviceIds: string[] = [];
    for (const rawDev of devices) {
      if (!rawDev.visible || rawDev.locked) continue;
      const track = tracks.find((t) => t.targetId === rawDev.id);
      const dev = resolveDeviceAtFrame(
        rawDev,
        track ? track.keyframes : [],
        currentFrame,
        durationInFrames
      );
      const bw = dev.width * dev.scaleX;
      const bh = dev.height * dev.scaleY;
      const rad = (dev.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const halfW = (bw * cos + bh * sin) / 2;
      const halfH = (bw * sin + bh * cos) / 2;
      if (
        dev.x + halfW >= minX &&
        dev.x - halfW <= maxX &&
        dev.y + halfH >= minY &&
        dev.y - halfH <= maxY
      ) {
        hitDeviceIds.push(rawDev.id);
      }
    }

    const hitDrawingIds: string[] = [];
    for (const rawDr of drawings) {
      if (!rawDr.visible || rawDr.locked) continue;
      const drTrack = tracks.find((t) => t.targetId === rawDr.id);
      const dr = resolveDrawingAtFrame(
        rawDr,
        drTrack ? drTrack.keyframes : [],
        currentFrame
      );
      const bw = dr.width * dr.scaleX;
      const bh = dr.height * dr.scaleY;
      const rad = (dr.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const halfW = (bw * cos + bh * sin) / 2;
      const halfH = (bw * sin + bh * cos) / 2;
      if (
        dr.x + halfW >= minX &&
        dr.x - halfW <= maxX &&
        dr.y + halfH >= minY &&
        dr.y - halfH <= maxY
      ) {
        hitDrawingIds.push(rawDr.id);
      }
    }

    const hitWebcamIds: string[] = [];
    for (const rawWc of webcams) {
      if (!rawWc.visible || rawWc.locked) continue;
      const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
      const wc = resolveWebcamAtFrame(
        rawWc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const bw = wc.width * wc.scaleX;
      const bh = wc.height * wc.scaleY;
      const rad = (wc.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const halfW = (bw * cos + bh * sin) / 2;
      const halfH = (bw * sin + bh * cos) / 2;
      if (
        wc.x + halfW >= minX &&
        wc.x - halfW <= maxX &&
        wc.y + halfH >= minY &&
        wc.y - halfH <= maxY
      ) {
        hitWebcamIds.push(rawWc.id);
      }
    }

    return {
      deviceIds: additive
        ? Array.from(new Set([...initialDeviceIds, ...hitDeviceIds]))
        : hitDeviceIds,
      drawingIds: additive
        ? Array.from(new Set([...initialDrawingIds, ...hitDrawingIds]))
        : hitDrawingIds,
      webcamIds: additive
        ? Array.from(new Set([...initialWebcamIds, ...hitWebcamIds]))
        : hitWebcamIds,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on floating HUD buttons
    if ((e.target as HTMLElement).closest('[data-hud-overlay="true"]')) {
      return;
    }

    // Ignore right-clicks here so handleContextMenu manages selection & context menu
    if (e.button === 2) {
      return;
    }

    if (contextMenu) {
      setContextMenu(null);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if synthetic event lacks pointerId registration
    }

    if (
      isPreviewMode ||
      e.button === 1 ||
      e.altKey ||
      activeDrawingTool === 'pan'
    ) {
      setInteraction({
        type: 'pan',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPanX: panX,
        startPanY: panY,
      });
      return;
    }

    const pt = clientToCanvasCoords(e.clientX, e.clientY);

    // 1. Eraser tool: click or drag across a drawing to delete it
    if (activeDrawingTool === 'eraser') {
      const hitDrawing = [...drawings]
        .filter((d) => d.visible && !d.locked)
        .reverse()
        .find((d) => {
          const halfW = (d.width * d.scaleX) / 2 + 24;
          const halfH = (d.height * d.scaleY) / 2 + 24;
          return (
            Math.abs(pt.x - d.x) <= halfW && Math.abs(pt.y - d.y) <= halfH
          );
        });
      if (hitDrawing) {
        deleteDrawing(hitDrawing.id);
      }
      setInteraction({ type: 'erasing' });
      return;
    }

    // 2. Active Drawing Creation Tool
    if (
      activeDrawingTool !== 'select' &&
      activeDrawingTool !== 'multi-select' &&
      activeDrawingTool !== 'transform'
    ) {
      setInteraction({
        type: 'creating-drawing',
        tool: activeDrawingTool,
        startX: pt.x,
        startY: pt.y,
        currentX: pt.x,
        currentY: pt.y,
        points: [{ x: pt.x, y: pt.y }],
      });
      return;
    }

    // 2.2. When Marquee Selection tool ('multi-select') is explicitly active, starting a drag anywhere begins a marquee selection unless clicking an already-selected item in a multi-selection
    const currentSelectedDrawingIds = Array.from(
      new Set([
        ...selectedDrawingIds,
        ...(selectedDrawingId ? [selectedDrawingId] : []),
      ])
    );
    const currentSelectedWebcamIds = Array.from(
      new Set([
        ...selectedWebcamIds,
        ...(selectedWebcamId ? [selectedWebcamId] : []),
      ])
    );
    const currentTotalSelectedCount =
      selectedIds.length +
      currentSelectedDrawingIds.length +
      currentSelectedWebcamIds.length;

    // 2.5. If Onion Skin / Motion Trail is active, clicking a keyframe waypoint diamond on the canvas jumps the playhead to that frame
    if (showMotionTrail && activeDrawingTool === 'select') {
      const targetDevices = devices.filter(
        (d) =>
          d.visible &&
          (selectedIds.length === 0 || selectedIds.includes(d.id))
      );
      for (const rawDev of targetDevices) {
        const track = tracks.find((t) => t.targetId === rawDev.id);
        if (!track || track.keyframes.length < 2) continue;
        const trail = computeDeviceMotionTrail(
          rawDev,
          track.keyframes,
          currentFrame,
          durationInFrames
        );
        for (const node of trail.keyframeNodes) {
          if (Math.hypot(pt.x - node.x, pt.y - node.y) <= 20 / zoom) {
            setCurrentFrame(node.frame);
            return;
          }
        }
      }
    }

    // 2.8. Check if clicking on a selected drawing's rotation handle, 8 corner/side resize handles, or line/arrow endpoints
    if (selectedDrawingId) {
      const rawSelDr = drawings.find((d) => d.id === selectedDrawingId);
      if (rawSelDr && !rawSelDr.locked && rawSelDr.visible) {
        const drTrack = tracks.find((t) => t.targetId === rawSelDr.id);
        const selDr = resolveDrawingAtFrame(
          rawSelDr,
          drTrack ? drTrack.keyframes : [],
          currentFrame
        );
        const dx = pt.x - selDr.x;
        const dy = pt.y - selDr.y;
        const rad = (-selDr.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const halfW = (selDr.width * selDr.scaleX) / 2;
        const halfH = (selDr.height * selDr.scaleY) / 2;
        const pad = 6;
        const hitRadius = Math.max(14, 22 / zoom);

        // Endpoint handles for line & arrow
        if (
          (selDr.tool === 'line' || selDr.tool === 'arrow') &&
          selDr.points.length >= 2 &&
          Math.abs(selDr.rotation) < 1
        ) {
          const p0World = {
            x: selDr.x + selDr.points[0].x * selDr.scaleX,
            y: selDr.y + selDr.points[0].y * selDr.scaleY,
          };
          const p1World = {
            x: selDr.x + selDr.points[1].x * selDr.scaleX,
            y: selDr.y + selDr.points[1].y * selDr.scaleY,
          };
          if (Math.hypot(pt.x - p0World.x, pt.y - p0World.y) <= hitRadius) {
            setInteraction({
              type: 'drag-drawing-endpoint',
              drawingId: selDr.id,
              endpointIndex: 0,
              otherX: p1World.x,
              otherY: p1World.y,
            });
            return;
          }
          if (Math.hypot(pt.x - p1World.x, pt.y - p1World.y) <= hitRadius) {
            setInteraction({
              type: 'drag-drawing-endpoint',
              drawingId: selDr.id,
              endpointIndex: 1,
              otherX: p0World.x,
              otherY: p0World.y,
            });
            return;
          }
        }

        // Rotation handle at top center
        const rotHandleY = -halfH - pad - 28 / zoom;
        if (Math.hypot(localX, localY - rotHandleY) <= hitRadius) {
          const angle = Math.atan2(pt.y - selDr.y, pt.x - selDr.x);
          setInteraction({
            type: 'rotate-drawing',
            drawingId: selDr.id,
            centerX: selDr.x,
            centerY: selDr.y,
            startAngle: angle,
            initialRotation: selDr.rotation,
          });
          return;
        }

        // 8 Resize Handles (4 corners + 4 sides)
        const handles: { id: DrawingResizeHandle; x: number; y: number }[] = [
          { id: 'nw', x: -halfW - pad, y: -halfH - pad },
          { id: 'ne', x: halfW + pad, y: -halfH - pad },
          { id: 'se', x: halfW + pad, y: halfH + pad },
          { id: 'sw', x: -halfW - pad, y: halfH + pad },
          { id: 'n', x: 0, y: -halfH - pad },
          { id: 'e', x: halfW + pad, y: 0 },
          { id: 's', x: 0, y: halfH + pad },
          { id: 'w', x: -halfW - pad, y: 0 },
        ];
        for (const h of handles) {
          if (Math.hypot(localX - h.x, localY - h.y) <= hitRadius) {
            setInteraction({
              type: 'resize-drawing',
              drawingId: selDr.id,
              handle: h.id,
              startMouseX: pt.x,
              startMouseY: pt.y,
              origDrawing: JSON.parse(JSON.stringify(rawSelDr)),
            });
            return;
          }
        }
      }
    }

    // 2.9. Check if clicking on a selected webcam overlay's Bezier control points, rotation handle, or 8 resize handles
    if (selectedWebcamId) {
      const rawSelWc = webcams.find((w) => w.id === selectedWebcamId);
      if (rawSelWc && !rawSelWc.locked && rawSelWc.visible) {
        const wcTrack = tracks.find((t) => t.targetId === rawSelWc.id);
        const selWc = resolveWebcamAtFrame(
          rawSelWc,
          wcTrack ? wcTrack.keyframes : [],
          currentFrame
        );
        const dx = pt.x - selWc.x;
        const dy = pt.y - selWc.y;
        const rad = (-selWc.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const halfW = (selWc.width * selWc.scaleX) / 2;
        const halfH = (selWc.height * selWc.scaleY) / 2;
        const pad = 6;
        const hitRadius = Math.max(14, 22 / zoom);

        // Bezier curve control points hit test
        if (
          (selWc.shape === 'custom-bezier' ||
            selWc.shape === 'curved-asymmetric' ||
            selWc.shape === 'organic-blob') &&
          selWc.bezierPoints &&
          selWc.bezierPoints.length >= 3
        ) {
          for (let i = 0; i < selWc.bezierPoints.length; i++) {
            const bp = selWc.bezierPoints[i];
            const px = bp.x * halfW;
            const py = bp.y * halfH;
            if (Math.hypot(localX - px, localY - py) <= hitRadius) {
              setInteraction({
                type: 'drag-webcam-bezier-point',
                webcamId: selWc.id,
                pointIndex: i,
              });
              return;
            }
          }
        }

        // Rotation handle at top center
        const rotHandleY = -halfH - pad - 28 / zoom;
        if (Math.hypot(localX, localY - rotHandleY) <= hitRadius) {
          const angle = Math.atan2(pt.y - selWc.y, pt.x - selWc.x);
          setInteraction({
            type: 'rotate-webcam',
            webcamId: selWc.id,
            centerX: selWc.x,
            centerY: selWc.y,
            startAngle: angle,
            initialRotation: selWc.rotation,
          });
          return;
        }

        // 8 Resize Handles (4 corners + 4 sides)
        const handles: { id: DrawingResizeHandle; x: number; y: number }[] = [
          { id: 'nw', x: -halfW - pad, y: -halfH - pad },
          { id: 'ne', x: halfW + pad, y: -halfH - pad },
          { id: 'se', x: halfW + pad, y: halfH + pad },
          { id: 'sw', x: -halfW - pad, y: halfH + pad },
          { id: 'n', x: 0, y: -halfH - pad },
          { id: 'e', x: halfW + pad, y: 0 },
          { id: 's', x: 0, y: halfH + pad },
          { id: 'w', x: -halfW - pad, y: 0 },
        ];
        for (const h of handles) {
          if (Math.hypot(localX - h.x, localY - h.y) <= hitRadius) {
            setInteraction({
              type: 'resize-webcam',
              webcamId: selWc.id,
              handle: h.id,
              startMouseX: pt.x,
              startMouseY: pt.y,
              origWebcam: JSON.parse(JSON.stringify(rawSelWc)),
            });
            return;
          }
        }
      }
    }

    // 3. Check if clicking on a selected device's rotation or corner scale handle
    const primarySelectedId = selectedIds[0];
    if (primarySelectedId) {
      const rawDev = devices.find((d) => d.id === primarySelectedId);
      if (rawDev && !rawDev.locked && rawDev.visible) {
        const track = tracks.find((t) => t.targetId === rawDev.id);
        const dev = resolveDeviceAtFrame(
          rawDev,
          track ? track.keyframes : [],
          currentFrame,
          durationInFrames
        );
        const dx = pt.x - dev.x;
        const dy = pt.y - dev.y;
        const rad = (-dev.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const halfW = (dev.width * dev.scaleX) / 2 + 4;
        const halfH = (dev.height * dev.scaleY) / 2 + 4;

        if (Math.hypot(localX, localY - (-halfH - 32)) <= 22 / zoom) {
          const angle = Math.atan2(pt.y - dev.y, pt.x - dev.x);
          setInteraction({
            type: 'rotate',
            deviceId: dev.id,
            centerX: dev.x,
            centerY: dev.y,
            startAngle: angle,
            initialRotation: dev.rotation,
          });
          return;
        }

        const corners = [
          [-halfW, -halfH],
          [halfW, -halfH],
          [halfW, halfH],
          [-halfW, halfH],
        ];
        for (const [cx, cy] of corners) {
          if (Math.hypot(localX - cx, localY - cy) <= 22 / zoom) {
            setInteraction({
              type: 'scale',
              deviceId: dev.id,
              startMouseX: pt.x,
              startMouseY: pt.y,
              startScaleX: dev.scaleX,
              startScaleY: dev.scaleY,
            });
            return;
          }
        }
      }
    }

    // Helper to build multi-selection drag state when dragging a group of marquee-selected elements
    const startMultiElementDrag = (primaryAnchorId: string) => {
      const initialPositions: Record<string, { x: number; y: number }> = {};
      for (const id of selectedIds) {
        const item = devices.find((d) => d.id === id);
        if (item) initialPositions[id] = { x: item.x, y: item.y };
      }
      const initialDrawingPositions: Record<string, { x: number; y: number }> =
        {};
      for (const id of currentSelectedDrawingIds) {
        const item = drawings.find((d) => d.id === id);
        if (item) initialDrawingPositions[id] = { x: item.x, y: item.y };
      }
      const initialWebcamPositions: Record<string, { x: number; y: number }> =
        {};
      for (const id of currentSelectedWebcamIds) {
        const item = webcams.find((w) => w.id === id);
        if (item) initialWebcamPositions[id] = { x: item.x, y: item.y };
      }

      setInteraction({
        type: 'drag',
        deviceId: primaryAnchorId,
        startMouseX: pt.x,
        startMouseY: pt.y,
        initialPositions,
        initialDrawingPositions,
        initialWebcamPositions,
      });
    };

    // 4. Hit-test Drawings first (since drawings render on top of devices)
    const sortedDrawings = [...drawings]
      .filter((d) => d.visible && !d.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawDr of sortedDrawings) {
      const drTrack = tracks.find((t) => t.targetId === rawDr.id);
      const dr = resolveDrawingAtFrame(
        rawDr,
        drTrack ? drTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - dr.x;
      const dy = pt.y - dr.y;
      const rad = (-dr.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (dr.width * dr.scaleX) / 2 + 14;
      const halfH = (dr.height * dr.scaleY) / 2 + 14;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        if (
          activeDrawingTool === 'multi-select' &&
          !currentSelectedDrawingIds.includes(dr.id)
        ) {
          break;
        }
        if (
          currentTotalSelectedCount > 1 &&
          currentSelectedDrawingIds.includes(dr.id) &&
          !e.shiftKey &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          startMultiElementDrag(dr.id);
          return;
        }
        selectDrawing(dr.id);
        setInteraction({
          type: 'drag-drawing',
          drawingId: dr.id,
          startMouseX: pt.x,
          startMouseY: pt.y,
          startX: dr.x,
          startY: dr.y,
        });
        return;
      }
    }

    // 4.5. Hit-test Webcam Overlays (above-devices first, then devices, then below-devices)
    const sortedWebcams = [...webcams]
      .filter((w) => w.visible && !w.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawWc of sortedWebcams) {
      if (rawWc.layerPosition === 'below-devices') continue;
      const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
      const wc = resolveWebcamAtFrame(
        rawWc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - wc.x;
      const dy = pt.y - wc.y;
      const rad = (-wc.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (wc.width * wc.scaleX) / 2;
      const halfH = (wc.height * wc.scaleY) / 2;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        if (
          activeDrawingTool === 'multi-select' &&
          !currentSelectedWebcamIds.includes(wc.id)
        ) {
          break;
        }
        if (
          currentTotalSelectedCount > 1 &&
          currentSelectedWebcamIds.includes(wc.id) &&
          !e.shiftKey &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          startMultiElementDrag(wc.id);
          return;
        }
        selectWebcam(wc.id);
        setInteraction({
          type: 'drag-webcam',
          webcamId: wc.id,
          startMouseX: pt.x,
          startMouseY: pt.y,
          startX: wc.x,
          startY: wc.y,
        });
        return;
      }
    }

    // 5. Hit-test devices from top zIndex to bottom
    const sorted = [...devices]
      .filter((d) => d.visible && !d.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawDev of sorted) {
      const track = tracks.find((t) => t.targetId === rawDev.id);
      const dev = resolveDeviceAtFrame(
        rawDev,
        track ? track.keyframes : [],
        currentFrame,
        durationInFrames
      );
      const dx = pt.x - dev.x;
      const dy = pt.y - dev.y;
      const rad = (-dev.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (dev.width * dev.scaleX) / 2;
      const halfH = (dev.height * dev.scaleY) / 2;

      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
        if (
          activeDrawingTool === 'multi-select' &&
          !selectedIds.includes(dev.id) &&
          !isMulti
        ) {
          break;
        }

        // Preserve existing multi-selection when clicking inside an already-selected device to drag the group
        if (!isMulti && selectedIds.includes(dev.id) && currentTotalSelectedCount > 1) {
          startMultiElementDrag(dev.id);
          return;
        }

        selectDevice(dev.id, isMulti);

        const activeIds = isMulti
          ? Array.from(new Set([...selectedIds, dev.id]))
          : selectedIds.includes(dev.id)
            ? selectedIds
            : [dev.id];

        const initialPositions: Record<string, { x: number; y: number }> = {};
        for (const id of activeIds) {
          const item = devices.find((d) => d.id === id);
          if (item) initialPositions[id] = { x: item.x, y: item.y };
        }

        setInteraction({
          type: 'drag',
          deviceId: dev.id,
          startMouseX: pt.x,
          startMouseY: pt.y,
          initialPositions,
        });
        return;
      }
    }

    // 5.5. Hit-test Webcam Overlays configured to sit below devices
    for (const rawWc of sortedWebcams) {
      if (rawWc.layerPosition !== 'below-devices') continue;
      const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
      const wc = resolveWebcamAtFrame(
        rawWc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - wc.x;
      const dy = pt.y - wc.y;
      const rad = (-wc.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (wc.width * wc.scaleX) / 2;
      const halfH = (wc.height * wc.scaleY) / 2;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        if (
          activeDrawingTool === 'multi-select' &&
          !currentSelectedWebcamIds.includes(wc.id)
        ) {
          break;
        }
        selectWebcam(wc.id);
        setInteraction({
          type: 'drag-webcam',
          webcamId: wc.id,
          startMouseX: pt.x,
          startMouseY: pt.y,
          startX: wc.x,
          startY: wc.y,
        });
        return;
      }
    }

    // 6. Clicked empty canvas space (or started Marquee Box Select) -> initiate Marquee Selection
    const isAdditive = e.shiftKey || e.metaKey || e.ctrlKey;
    const initDeviceIds = isAdditive ? [...selectedIds] : [];
    const initDrawingIds = isAdditive ? [...currentSelectedDrawingIds] : [];
    const initWebcamIds = isAdditive ? [...currentSelectedWebcamIds] : [];

    if (!isAdditive) {
      setMarqueeSelection({
        deviceIds: [],
        drawingIds: [],
        webcamIds: [],
      });
    }

    setInteraction({
      type: 'marquee',
      startX: pt.x,
      startY: pt.y,
      currentX: pt.x,
      currentY: pt.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
      additive: isAdditive,
      initialDeviceIds: initDeviceIds,
      initialDrawingIds: initDrawingIds,
      initialWebcamIds: initWebcamIds,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = clientToCanvasCoords(e.clientX, e.clientY);
    setCursorCoords({ x: Math.round(pt.x), y: Math.round(pt.y) });

    const activeInteraction = interactionRef.current;
    if (activeInteraction.type === 'none') return;

    if (activeInteraction.type === 'marquee') {
      const nextMarquee: InteractionMode = {
        ...activeInteraction,
        currentX: pt.x,
        currentY: pt.y,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
      };
      setInteraction(nextMarquee);

      const canvasDist = Math.hypot(
        pt.x - activeInteraction.startX,
        pt.y - activeInteraction.startY
      );
      const clientDist = Math.hypot(
        e.clientX - activeInteraction.startClientX,
        e.clientY - activeInteraction.startClientY
      );
      if (canvasDist >= 3 || clientDist >= 2) {
        const hits = computeMarqueeSelectionAtRect(
          activeInteraction.startX,
          activeInteraction.startY,
          pt.x,
          pt.y,
          activeInteraction.additive,
          activeInteraction.initialDeviceIds,
          activeInteraction.initialDrawingIds,
          activeInteraction.initialWebcamIds
        );
        setMarqueeSelection(hits);
      }
      return;
    }

    if (activeInteraction.type === 'erasing') {
      const hitDrawing = [...drawings]
        .filter((d) => d.visible && !d.locked)
        .reverse()
        .find((d) => {
          const halfW = (d.width * d.scaleX) / 2 + 20;
          const halfH = (d.height * d.scaleY) / 2 + 20;
          return (
            Math.abs(pt.x - d.x) <= halfW && Math.abs(pt.y - d.y) <= halfH
          );
        });
      if (hitDrawing) {
        deleteDrawing(hitDrawing.id);
      }
      return;
    }

    if (activeInteraction.type === 'creating-drawing') {
      const lastPt =
        activeInteraction.points[activeInteraction.points.length - 1];
      const shouldAppendPoint =
        !lastPt || Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) >= 4;
      setInteraction({
        ...activeInteraction,
        currentX: pt.x,
        currentY: pt.y,
        points: shouldAppendPoint
          ? [...activeInteraction.points, { x: pt.x, y: pt.y }]
          : activeInteraction.points,
      });
      return;
    }

    if (activeInteraction.type === 'pan') {
      const dx = e.clientX - activeInteraction.startMouseX;
      const dy = e.clientY - activeInteraction.startMouseY;
      setZoomAndPan(
        zoom,
        activeInteraction.startPanX + dx,
        activeInteraction.startPanY + dy
      );
      return;
    }

    if (activeInteraction.type === 'drag-webcam') {
      const dx = pt.x - activeInteraction.startMouseX;
      const dy = pt.y - activeInteraction.startMouseY;
      const otherCenters = devices
        .filter((d) => d.visible)
        .map((d) => ({ x: d.x, y: d.y }));
      const snapped = computeSnapPosition(
        activeInteraction.startX + dx,
        activeInteraction.startY + dy,
        canvasWidth,
        canvasHeight,
        otherCenters,
        snapToGrid,
        gridSize,
        10
      );
      setActiveGuides({ x: snapped.guidesX, y: snapped.guidesY });
      updateWebcam(
        activeInteraction.webcamId,
        {
          x: Math.round(snapped.x),
          y: Math.round(snapped.y),
        },
        false
      );
      return;
    }

    if (activeInteraction.type === 'resize-webcam') {
      const orig = activeInteraction.origWebcam;
      const rad = (-orig.rotation * Math.PI) / 180;
      const rawDx = pt.x - activeInteraction.startMouseX;
      const rawDy = pt.y - activeInteraction.startMouseY;
      const localDx = rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      const localDy = rawDx * Math.sin(rad) + rawDy * Math.cos(rad);
      const h = activeInteraction.handle;

      let nextW = orig.width;
      let nextH = orig.height;

      if (h === 'e' || h === 'ne' || h === 'se') {
        nextW = Math.max(80, Math.round(orig.width + localDx * 2));
      } else if (h === 'w' || h === 'nw' || h === 'sw') {
        nextW = Math.max(80, Math.round(orig.width - localDx * 2));
      }

      if (h === 's' || h === 'se' || h === 'sw') {
        nextH = Math.max(80, Math.round(orig.height + localDy * 2));
      } else if (h === 'n' || h === 'ne' || h === 'nw') {
        nextH = Math.max(80, Math.round(orig.height - localDy * 2));
      }

      if (snapToGrid) {
        const step = Math.max(8, gridSize || 40);
        nextW = Math.max(80, Math.round(nextW / step) * step);
        nextH = Math.max(80, Math.round(nextH / step) * step);
      }

      const lockAspect =
        Boolean(orig.lockAspectRatio) ||
        orig.shape === 'circle' ||
        orig.shape === 'square' ||
        e.shiftKey;

      if (lockAspect) {
        const aspect = Math.max(0.25, orig.width / Math.max(1, orig.height));
        if (h === 'n' || h === 's') {
          nextW = Math.max(80, Math.round(nextH * aspect));
        } else {
          nextH = Math.max(80, Math.round(nextW / aspect));
        }
      }

      updateWebcam(
        activeInteraction.webcamId,
        {
          width: nextW,
          height: nextH,
        },
        false
      );
      return;
    }

    if (activeInteraction.type === 'rotate-webcam') {
      const angle = Math.atan2(
        pt.y - activeInteraction.centerY,
        pt.x - activeInteraction.centerX
      );
      const degDelta = ((angle - activeInteraction.startAngle) * 180) / Math.PI;
      let nextRot = Math.round(activeInteraction.initialRotation + degDelta);
      if ((snapToGrid || e.shiftKey) && Math.abs(nextRot % 15) <= 4) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      updateWebcam(activeInteraction.webcamId, { rotation: nextRot }, false);
      return;
    }

    if (activeInteraction.type === 'drag-webcam-bezier-point') {
      const rawWc = webcams.find((w) => w.id === activeInteraction.webcamId);
      if (!rawWc || !rawWc.bezierPoints) return;
      const dx = pt.x - rawWc.x;
      const dy = pt.y - rawWc.y;
      const rad = (-rawWc.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = Math.max(20, (rawWc.width * rawWc.scaleX) / 2);
      const halfH = Math.max(20, (rawWc.height * rawWc.scaleY) / 2);
      const normX = Math.max(
        -1.4,
        Math.min(1.4, Number((localX / halfW).toFixed(3)))
      );
      const normY = Math.max(
        -1.4,
        Math.min(1.4, Number((localY / halfH).toFixed(3)))
      );
      const nextPoints = rawWc.bezierPoints.map((bp, idx) =>
        idx === activeInteraction.pointIndex ? { x: normX, y: normY } : bp
      );
      updateWebcam(
        activeInteraction.webcamId,
        { bezierPoints: nextPoints },
        false
      );
      return;
    }

    if (activeInteraction.type === 'drag-drawing') {
      const dx = pt.x - activeInteraction.startMouseX;
      const dy = pt.y - activeInteraction.startMouseY;
      const otherCenters = devices
        .filter((d) => d.visible)
        .map((d) => ({ x: d.x, y: d.y }));
      const snapped = computeSnapPosition(
        activeInteraction.startX + dx,
        activeInteraction.startY + dy,
        canvasWidth,
        canvasHeight,
        otherCenters,
        snapToGrid,
        gridSize,
        10
      );
      setActiveGuides({ x: snapped.guidesX, y: snapped.guidesY });
      updateDrawing(
        activeInteraction.drawingId,
        {
          x: Math.round(snapped.x),
          y: Math.round(snapped.y),
        },
        false
      );
      return;
    }

    if (activeInteraction.type === 'resize-drawing') {
      const orig = activeInteraction.origDrawing;
      const rad = (-orig.rotation * Math.PI) / 180;
      const rawDx = pt.x - activeInteraction.startMouseX;
      const rawDy = pt.y - activeInteraction.startMouseY;
      const localDx = rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      const localDy = rawDx * Math.sin(rad) + rawDy * Math.cos(rad);
      const h = activeInteraction.handle;

      let reqW: number | undefined;
      let reqH: number | undefined;

      if (h === 'e' || h === 'ne' || h === 'se') {
        reqW = Math.max(16, orig.width + localDx * 2);
      } else if (h === 'w' || h === 'nw' || h === 'sw') {
        reqW = Math.max(16, orig.width - localDx * 2);
      }

      if (h === 's' || h === 'se' || h === 'sw') {
        reqH = Math.max(16, orig.height + localDy * 2);
      } else if (h === 'n' || h === 'ne' || h === 'nw') {
        reqH = Math.max(16, orig.height - localDy * 2);
      }

      if (snapToGrid) {
        const step = Math.max(8, gridSize || 40);
        if (reqW !== undefined)
          reqW = Math.max(16, Math.round(reqW / step) * step);
        if (reqH !== undefined)
          reqH = Math.max(16, Math.round(reqH / step) * step);
      }

      const lockAspect =
        Boolean(orig.lockAspectRatio) ||
        orig.tool === 'circle' ||
        e.shiftKey;

      const resized = resizeDrawingGeometry(orig, reqW, reqH, lockAspect);
      updateDrawing(
        activeInteraction.drawingId,
        {
          width: resized.width,
          height: resized.height,
          points: resized.points,
        },
        false
      );
      return;
    }

    if (activeInteraction.type === 'rotate-drawing') {
      const angle = Math.atan2(
        pt.y - activeInteraction.centerY,
        pt.x - activeInteraction.centerX
      );
      const degDelta = ((angle - activeInteraction.startAngle) * 180) / Math.PI;
      let nextRot = Math.round(activeInteraction.initialRotation + degDelta);
      if ((snapToGrid || e.shiftKey) && Math.abs(nextRot % 15) <= 4) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      updateDrawing(activeInteraction.drawingId, { rotation: nextRot }, false);
      return;
    }

    if (activeInteraction.type === 'drag-drawing-endpoint') {
      const rawDr = drawings.find((d) => d.id === activeInteraction.drawingId);
      if (!rawDr) return;
      const step = Math.max(8, gridSize || 40);
      const targetPtX = snapToGrid ? Math.round(pt.x / step) * step : pt.x;
      const targetPtY = snapToGrid ? Math.round(pt.y / step) * step : pt.y;
      const startX =
        activeInteraction.endpointIndex === 0
          ? targetPtX
          : activeInteraction.otherX;
      const startY =
        activeInteraction.endpointIndex === 0
          ? targetPtY
          : activeInteraction.otherY;
      const endX =
        activeInteraction.endpointIndex === 1
          ? targetPtX
          : activeInteraction.otherX;
      const endY =
        activeInteraction.endpointIndex === 1
          ? targetPtY
          : activeInteraction.otherY;
      const updated = updateDrawingLineEndpoints(
        rawDr,
        startX,
        startY,
        endX,
        endY
      );
      updateDrawing(activeInteraction.drawingId, updated, false);
      return;
    }

    if (activeInteraction.type === 'drag') {
      const dx = pt.x - activeInteraction.startMouseX;
      const dy = pt.y - activeInteraction.startMouseY;
      const primaryStart =
        activeInteraction.initialPositions[activeInteraction.deviceId] ||
        activeInteraction.initialDrawingPositions?.[
          activeInteraction.deviceId
        ] ||
        activeInteraction.initialWebcamPositions?.[activeInteraction.deviceId];
      if (!primaryStart) return;

      const otherCenters = devices
        .filter((d) => !activeInteraction.initialPositions[d.id] && d.visible)
        .map((d) => ({ x: d.x, y: d.y }));

      const snapped = computeSnapPosition(
        primaryStart.x + dx,
        primaryStart.y + dy,
        canvasWidth,
        canvasHeight,
        otherCenters,
        snapToGrid,
        gridSize,
        10
      );

      const appliedDx = snapped.x - primaryStart.x;
      const appliedDy = snapped.y - primaryStart.y;

      setActiveGuides({ x: snapped.guidesX, y: snapped.guidesY });

      Object.entries(activeInteraction.initialPositions).forEach(
        ([id, startPos]) => {
          updateDevice(
            id,
            {
              x: Math.round(startPos.x + appliedDx),
              y: Math.round(startPos.y + appliedDy),
            },
            false
          );
        }
      );

      if (activeInteraction.initialDrawingPositions) {
        Object.entries(activeInteraction.initialDrawingPositions).forEach(
          ([id, startPos]) => {
            updateDrawing(
              id,
              {
                x: Math.round(startPos.x + appliedDx),
                y: Math.round(startPos.y + appliedDy),
              },
              false
            );
          }
        );
      }

      if (activeInteraction.initialWebcamPositions) {
        Object.entries(activeInteraction.initialWebcamPositions).forEach(
          ([id, startPos]) => {
            updateWebcam(
              id,
              {
                x: Math.round(startPos.x + appliedDx),
                y: Math.round(startPos.y + appliedDy),
              },
              false
            );
          }
        );
      }
      return;
    }

    if (activeInteraction.type === 'scale') {
      const distDelta =
        (pt.x -
          activeInteraction.startMouseX +
          (pt.y - activeInteraction.startMouseY)) /
        320;
      const nextScale = Math.max(
        0.2,
        Math.min(
          3.0,
          Number((activeInteraction.startScaleX + distDelta).toFixed(2))
        )
      );
      updateDevice(
        activeInteraction.deviceId,
        { scaleX: nextScale, scaleY: nextScale },
        false
      );
      return;
    }

    if (activeInteraction.type === 'rotate') {
      const angle = Math.atan2(
        pt.y - activeInteraction.centerY,
        pt.x - activeInteraction.centerX
      );
      const degDelta = ((angle - activeInteraction.startAngle) * 180) / Math.PI;
      let nextRot = Math.round(activeInteraction.initialRotation + degDelta);
      if (snapToGrid && Math.abs(nextRot % 15) <= 3) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      updateDevice(activeInteraction.deviceId, { rotation: nextRot }, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const activeInteraction = interactionRef.current;

    if (activeInteraction.type === 'marquee') {
      const pt = clientToCanvasCoords(e.clientX, e.clientY);
      const hasValidPt =
        Number.isFinite(pt.x) && (e.clientX !== 0 || e.clientY !== 0);
      const endX = hasValidPt ? pt.x : activeInteraction.currentX;
      const endY = hasValidPt ? pt.y : activeInteraction.currentY;
      const canvasDist = Math.hypot(
        endX - activeInteraction.startX,
        endY - activeInteraction.startY
      );
      const prevDist = Math.hypot(
        activeInteraction.currentX - activeInteraction.startX,
        activeInteraction.currentY - activeInteraction.startY
      );

      if (canvasDist >= 3 || prevDist >= 3) {
        const finalX =
          canvasDist >= prevDist ? endX : activeInteraction.currentX;
        const finalY =
          canvasDist >= prevDist ? endY : activeInteraction.currentY;
        const hits = computeMarqueeSelectionAtRect(
          activeInteraction.startX,
          activeInteraction.startY,
          finalX,
          finalY,
          activeInteraction.additive,
          activeInteraction.initialDeviceIds,
          activeInteraction.initialDrawingIds,
          activeInteraction.initialWebcamIds
        );
        setMarqueeSelection(hits);
      }
      setInteraction({ type: 'none' });
      return;
    }

    if (activeInteraction.type === 'creating-drawing') {
      const isFreehandTool =
        activeInteraction.tool === 'brush' ||
        activeInteraction.tool === 'pen' ||
        activeInteraction.tool === 'bezier' ||
        activeInteraction.tool === 'freehand' ||
        activeInteraction.tool === 'highlight-stroke' ||
        activeInteraction.tool === 'neon-path' ||
        activeInteraction.tool === 'animated-stroke';

      const xs = isFreehandTool
        ? activeInteraction.points.map((p) => p.x)
        : [activeInteraction.startX, activeInteraction.currentX];
      const ys = isFreehandTool
        ? activeInteraction.points.map((p) => p.y)
        : [activeInteraction.startY, activeInteraction.currentY];

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const rawW = maxX - minX;
      const rawH = maxY - minY;
      const isCircle =
        activeInteraction.tool === 'circle' ||
        activeInteraction.tool === 'pulse-ring';
      const baseW = Math.max(120, rawW);
      const baseH = Math.max(120, rawH);
      const w = isCircle ? Math.max(baseW, baseH) : baseW;
      const h = isCircle ? Math.max(baseW, baseH) : baseH;
      const cx = rawW < 15 ? activeInteraction.startX : (minX + maxX) / 2;
      const cy = rawH < 15 ? activeInteraction.startY : (minY + maxY) / 2;

      const id = `draw-${Date.now().toString(36).slice(-4)}`;
      const toolLabel =
        activeInteraction.tool.charAt(0).toUpperCase() +
        activeInteraction.tool.slice(1);

      const newDrawing: SceneDrawingObject = {
        id,
        name: `${toolLabel} #${drawings.length + 1}`,
        tool: activeInteraction.tool,
        text:
          activeInteraction.tool === 'text' ||
          activeInteraction.tool === 'callout-box'
            ? 'Feature Callout'
            : undefined,
        fontSize: 28,
        points: isFreehandTool
          ? activeInteraction.points.length >= 2 && (rawW >= 15 || rawH >= 15)
            ? activeInteraction.points.map((p) => ({
                x: Math.round(p.x - cx),
                y: Math.round(p.y - cy),
              }))
            : [
                { x: -80, y: 40 },
                { x: 0, y: -40 },
                { x: 80, y: 40 },
              ]
          : [
              {
                x:
                  rawW < 15
                    ? -80
                    : Math.round(activeInteraction.startX - cx),
                y:
                  rawH < 15
                    ? 50
                    : Math.round(activeInteraction.startY - cy),
              },
              {
                x:
                  rawW < 15
                    ? 80
                    : Math.round(activeInteraction.currentX - cx),
                y:
                  rawH < 15
                    ? -50
                    : Math.round(activeInteraction.currentY - cy),
              },
            ],
        x: Math.round(cx),
        y: Math.round(cy),
        width: Math.round(w),
        height: Math.round(h),
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: drawings.length + 10,
        strokeColor: drawingDefaults.strokeColor,
        strokeColorEnd: drawingDefaults.strokeColorEnd,
        useGradientStroke: drawingDefaults.useGradientStroke,
        strokeWidth:
          activeInteraction.tool === 'highlight-stroke'
            ? 12
            : drawingDefaults.strokeWidth,
        strokeOpacity:
          activeInteraction.tool === 'highlight-stroke'
            ? 0.42
            : drawingDefaults.strokeOpacity,
        fillColor: drawingDefaults.fillColor,
        fillOpacity:
          activeInteraction.tool === 'callout-box' ||
          activeInteraction.tool === 'text'
            ? Math.max(0.18, drawingDefaults.fillOpacity)
            : drawingDefaults.fillOpacity,
        lineCap: 'round',
        lineJoin: 'round',
        dashPattern: drawingDefaults.dashPattern,
        cornerRadius: activeInteraction.tool === 'rect' ? 0 : 24,
        polygonSides: 6,
        glowEnabled: drawingDefaults.glowEnabled,
        glowColor: drawingDefaults.glowColor,
        glowRadius: drawingDefaults.glowRadius,
        glowIntensity: drawingDefaults.glowIntensity,
        glowSpread: drawingDefaults.glowSpread,
        glowOpacity: 1,
        lockAspectRatio: isCircle,
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowBlur: 18,
        animationMode: drawingDefaults.animationMode,
        animationDurationFrames: drawingDefaults.animationDurationFrames,
        animationSpeed: drawingDefaults.animationSpeed,
        animationEasing: drawingDefaults.animationEasing,
      };

      addDrawing(newDrawing);
      setActiveDrawingTool('select');
      setInteraction({ type: 'none' });
      return;
    }

    if (activeInteraction.type !== 'none') {
      if (
        activeInteraction.type !== 'pan' &&
        activeInteraction.type !== 'erasing'
      ) {
        pushHistory();
      }
      setInteraction({ type: 'none' });
      setActiveGuides({ x: [], y: [] });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.06 : -0.06;
      setZoomAndPan(Number((zoom + factor).toFixed(2)));
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-hud-overlay="true"]')) {
      return;
    }
    e.preventDefault();
    const pt = clientToCanvasCoords(e.clientX, e.clientY);

    // 1. Hit-test Drawings from top zIndex to bottom
    const sortedDrawings = [...drawings]
      .filter((d) => d.visible && !d.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawDr of sortedDrawings) {
      const drTrack = tracks.find((t) => t.targetId === rawDr.id);
      const dr = resolveDrawingAtFrame(
        rawDr,
        drTrack ? drTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - dr.x;
      const dy = pt.y - dr.y;
      const rad = (-dr.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (dr.width * dr.scaleX) / 2 + 14;
      const halfH = (dr.height * dr.scaleY) / 2 + 14;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        selectDrawing(dr.id);
        setContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          stageX: pt.x,
          stageY: pt.y,
        });
        return;
      }
    }

    // 2. Hit-test Webcam Overlays above devices
    const sortedWebcams = [...webcams]
      .filter((w) => w.visible && !w.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawWc of sortedWebcams) {
      if (rawWc.layerPosition === 'below-devices') continue;
      const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
      const wc = resolveWebcamAtFrame(
        rawWc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - wc.x;
      const dy = pt.y - wc.y;
      const rad = (-wc.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (wc.width * wc.scaleX) / 2;
      const halfH = (wc.height * wc.scaleY) / 2;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        selectWebcam(wc.id);
        setContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          stageX: pt.x,
          stageY: pt.y,
        });
        return;
      }
    }

    // 3. Hit-test Devices from top zIndex to bottom
    const sortedDevices = [...devices]
      .filter((d) => d.visible && !d.locked)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const rawDev of sortedDevices) {
      const track = tracks.find((t) => t.targetId === rawDev.id);
      const dev = resolveDeviceAtFrame(
        rawDev,
        track ? track.keyframes : [],
        currentFrame,
        durationInFrames
      );
      const dx = pt.x - dev.x;
      const dy = pt.y - dev.y;
      const rad = (-dev.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (dev.width * dev.scaleX) / 2;
      const halfH = (dev.height * dev.scaleY) / 2;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        if (!selectedIds.includes(dev.id)) {
          selectDevice(dev.id, false);
        }
        setContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          stageX: pt.x,
          stageY: pt.y,
        });
        return;
      }
    }

    // 4. Hit-test Webcam Overlays below devices
    for (const rawWc of sortedWebcams) {
      if (rawWc.layerPosition !== 'below-devices') continue;
      const wcTrack = tracks.find((t) => t.targetId === rawWc.id);
      const wc = resolveWebcamAtFrame(
        rawWc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const dx = pt.x - wc.x;
      const dy = pt.y - wc.y;
      const rad = (-wc.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
      const halfW = (wc.width * wc.scaleX) / 2;
      const halfH = (wc.height * wc.scaleY) / 2;
      if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
        selectWebcam(wc.id);
        setContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          stageX: pt.x,
          stageY: pt.y,
        });
        return;
      }
    }

    // Right-clicked empty canvas stage — open context menu preserving current selection
    setContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      stageX: pt.x,
      stageY: pt.y,
    });
  };

  // Compact grouped canvas tool strip (organised by Select/Marquee/Pan, Shapes, Freehand, Annotations, Eraser)
  const toolGroups: {
    group: string;
    items: {
      id: DrawingToolType;
      label: string;
      shortLabel: string;
      icon: React.ComponentType<{ className?: string }>;
    }[];
  }[] = [
    {
      group: 'select',
      items: [
        {
          id: 'select',
          label: 'Select & Transform (V)',
          shortLabel: 'Select',
          icon: MousePointer,
        },
        {
          id: 'multi-select',
          label: 'Marquee Box Select (M / Drag Empty Space)',
          shortLabel: 'Marquee',
          icon: Scan,
        },
        {
          id: 'pan',
          label: 'Pan Stage (Space / Alt)',
          shortLabel: 'Pan',
          icon: Move,
        },
      ],
    },
    {
      group: 'shapes',
      items: [
        {
          id: 'rounded-rect',
          label: 'Rounded Rectangle',
          shortLabel: 'Rect',
          icon: Square,
        },
        {
          id: 'circle',
          label: 'Circle / Halo',
          shortLabel: 'Circle',
          icon: Circle,
        },
        {
          id: 'arrow',
          label: 'Callout Arrow',
          shortLabel: 'Arrow',
          icon: ArrowUpRight,
        },
      ],
    },
    {
      group: 'freehand',
      items: [
        {
          id: 'brush',
          label: 'Freehand Brush',
          shortLabel: 'Brush',
          icon: Pencil,
        },
        {
          id: 'bezier',
          label: 'Smooth Bezier Curve',
          shortLabel: 'Curve',
          icon: Spline,
        },
      ],
    },
    {
      group: 'annotate',
      items: [
        {
          id: 'text',
          label: 'Text Label',
          shortLabel: 'Text',
          icon: Type,
        },
        {
          id: 'callout-box',
          label: 'Callout Box',
          shortLabel: 'Callout',
          icon: MessageSquare,
        },
        {
          id: 'eraser',
          label: 'Eraser Tool',
          shortLabel: 'Eraser',
          icon: Eraser,
        },
      ],
    },
  ];

  const activeSelectedDrawingObj = drawings.find(
    (d) => d.id === selectedDrawingId
  );

  const totalSelectedElementsCount =
    selectedIds.length +
    Array.from(
      new Set([
        ...selectedDrawingIds,
        ...(selectedDrawingId ? [selectedDrawingId] : []),
      ])
    ).length +
    Array.from(
      new Set([
        ...selectedWebcamIds,
        ...(selectedWebcamId ? [selectedWebcamId] : []),
      ])
    ).length;

  const stageCursorClass =
    interaction.type === 'pan' || activeDrawingTool === 'pan'
      ? 'cursor-grabbing'
      : activeDrawingTool === 'multi-select' || interaction.type === 'marquee'
        ? 'cursor-crosshair'
        : activeDrawingTool === 'select' || activeDrawingTool === 'transform'
          ? 'cursor-default'
          : activeDrawingTool === 'eraser'
            ? 'cursor-cell'
            : 'cursor-crosshair';

  // Calculate viewport-relative marquee overlay box when dragging in empty space
  const marqueeOverlayRect = (() => {
    if (interaction.type !== 'marquee') return null;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container && canvas) {
      const cRect = container.getBoundingClientRect();
      const sRect = canvas.getBoundingClientRect();
      const scaleX = sRect.width / Math.max(1, canvasWidth);
      const scaleY = sRect.height / Math.max(1, canvasHeight);
      const minX = Math.min(interaction.startX, interaction.currentX);
      const maxX = Math.max(interaction.startX, interaction.currentX);
      const minY = Math.min(interaction.startY, interaction.currentY);
      const maxY = Math.max(interaction.startY, interaction.currentY);
      const stageW = maxX - minX;
      const stageH = maxY - minY;
      if (stageW < 2 && stageH < 2) return null;

      return {
        left: sRect.left - cRect.left + minX * scaleX,
        top: sRect.top - cRect.top + minY * scaleY,
        width: Math.max(2, stageW * scaleX),
        height: Math.max(2, stageH * scaleY),
        stageWidth: Math.round(stageW),
        stageHeight: Math.round(stageH),
      };
    }
    return null;
  })();

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      data-testid="canvas-2d-viewport"
      className={`relative flex-1 h-full bg-[#F1F5F9] overflow-hidden select-none touch-none flex items-center justify-center ${stageCursorClass}`}
    >
      {/* Coordinate-Mapped Horizontal & Vertical Viewport Rulers */}
      {!isPreviewMode && (
        <ViewportRulers
          containerRef={containerRef}
          cursorCoords={cursorCoords}
          mode="2d"
        />
      )}

      {/* Live Viewport Marquee Selection Overlay Box */}
      {!isPreviewMode && marqueeOverlayRect && (
        <div
          data-testid="canvas-marquee-selection-box"
          style={{
            left: `${marqueeOverlayRect.left}px`,
            top: `${marqueeOverlayRect.top}px`,
            width: `${marqueeOverlayRect.width}px`,
            height: `${marqueeOverlayRect.height}px`,
          }}
          className="absolute z-15 pointer-events-none border-2 border-blue-500 bg-blue-500/12 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
        >
          <span className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-slate-900/95 text-white font-mono text-[10px] font-semibold whitespace-nowrap border border-blue-400/60 shadow-xs">
            {totalSelectedElementsCount} selected ·{' '}
            {marqueeOverlayRect.stageWidth} × {marqueeOverlayRect.stageHeight}px
          </span>
        </div>
      )}

      {/* Compact White Top-Center Grouped Drawing & Selection Tool Strip */}
      {!isPreviewMode && (
      <div
        data-hud-overlay="true"
        data-testid="canvas-drawing-toolbar"
        className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-2 py-1 shadow-xs max-w-[calc(100%-6rem)]"
      >
        {toolGroups.map((grp, gIdx) => (
          <React.Fragment key={grp.group}>
            {gIdx > 0 && <div className="w-px h-4 bg-slate-200 mx-0.5" />}
            <div className="flex items-center gap-0.5">
              {grp.items.map((tb) => {
                const Icon = tb.icon;
                const isActive = activeDrawingTool === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setActiveDrawingTool(tb.id)}
                    title={tb.label}
                    aria-label={tb.label}
                    aria-pressed={isActive}
                    data-testid={`drawing-tool-${tb.id}`}
                    className={`px-2 py-1 rounded-md flex items-center gap-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">{tb.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {totalSelectedElementsCount > 1 && (
          <>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
            <span
              data-testid="marquee-multi-select-count"
              className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-semibold whitespace-nowrap shrink-0"
            >
              {totalSelectedElementsCount} Selected
            </span>
            {selectedIds.length >= 2 && (
              <button
                type="button"
                onClick={groupSelectedDevices}
                title="Group Selected Devices (Ctrl+G)"
                data-testid="marquee-group-selected-btn"
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              >
                Group
              </button>
            )}
            <button
              type="button"
              onClick={duplicateSelectedDevices}
              title="Duplicate Selected Elements (Ctrl+D)"
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={deleteSelectedDevices}
              title="Delete Selected Elements (Del)"
              className="p-1 rounded-md text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {totalSelectedElementsCount <= 1 && activeSelectedDrawingObj && (
          <>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
            <button
              type="button"
              onClick={() => duplicateDrawing(activeSelectedDrawingObj.id)}
              title="Duplicate Selected Drawing"
              className="p-1 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteDrawing(activeSelectedDrawingObj.id)}
              title="Delete Selected Drawing (Del)"
              className="p-1 rounded-md text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      )}

      {/* Interactive Scaled Stage Container */}
      <div
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        className="relative shadow-[0_12px_36px_rgba(15,23,42,0.14)] ring-1 ring-slate-300 transition-transform duration-75"
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          data-testid="studio-2d-canvas"
          className={`block bg-[#0B0F17] ${stageCursorClass}`}
        />
      </div>

      {/* Bottom-Right Floating Viewport Rulers, Snap-to-Grid & Zoom Controls */}
      {!isPreviewMode && (
      <div
        data-hud-overlay="true"
        className="absolute bottom-3.5 right-3.5 z-20 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-lg px-2 py-1 shadow-xs"
      >
        {/* Rulers Toggle */}
        <button
          type="button"
          onClick={() => setShowRulers(!showRulers)}
          aria-pressed={showRulers}
          title="Toggle Viewport Rulers"
          data-testid="toggle-rulers-2d"
          className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            showRulers
              ? 'bg-blue-50 text-blue-600 border border-blue-200 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Rulers</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Snap-to-Grid Toggle */}
        <button
          type="button"
          onClick={toggleSnapToGrid}
          aria-pressed={snapToGrid}
          title="Toggle Snap to Grid (G)"
          data-testid="toggle-snap-to-grid-2d"
          className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            snapToGrid
              ? 'bg-blue-50 text-blue-600 border border-blue-200 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>Snap</span>
        </button>

        {/* Configurable Grid Size Selector */}
        <select
          aria-label="Grid Size"
          data-testid="select-grid-size-2d"
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          title="Grid Snap Interval Size (px)"
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value={10}>10px</option>
          <option value={20}>20px</option>
          <option value={32}>32px</option>
          <option value={40}>40px</option>
          <option value={60}>60px</option>
          <option value={80}>80px</option>
          <option value={100}>100px</option>
        </select>

        {(selectedIds.length > 0 || selectedDrawingId || selectedWebcamId) && (
          <button
            type="button"
            onClick={snapSelectedToGrid}
            title={`Align selected element to ${gridSize}px grid`}
            data-testid="align-selection-to-grid-2d"
            className="px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Align
          </button>
        )}

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        <ViewportZoomSlider
          cursorCoords={cursorCoords}
          onFitStage={() => {
            const container = containerRef.current;
            if (container) {
              const fitW = (container.clientWidth - 96) / canvasWidth;
              const fitH = (container.clientHeight - 96) / canvasHeight;
              const best = Math.max(
                0.2,
                Math.min(1.2, Number(Math.min(fitW, fitH).toFixed(2)))
              );
              setZoomAndPan(best, 0, 0);
            } else {
              setZoomAndPan(0.38, 0, 0);
            }
          }}
        />
      </div>
      )}

      {/* Bottom-Left Quick Gesture & Onion Skin Legend */}
      {!isPreviewMode && (
      <div
        data-hud-overlay="true"
        className="absolute bottom-3.5 left-9 z-20 hidden lg:flex items-center gap-2.5 text-[11px] text-slate-600 bg-white/95 border border-slate-200 rounded-lg px-3 py-1 shadow-xs"
      >
        {showMotionTrail ? (
          <div
            data-testid="onion-skin-hud-badge"
            className="flex items-center gap-2 text-slate-700"
          >
            <span className="font-semibold text-blue-600 flex items-center gap-1">
              <Spline className="w-3.5 h-3.5" />
              Motion Path
            </span>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span className="flex items-center gap-1 text-slate-600 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
              Past KF
            </span>
            <span className="flex items-center gap-1 text-slate-700 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              F{String(currentFrame).padStart(3, '0')}
            </span>
            <span className="flex items-center gap-1 text-slate-600 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Next KF
            </span>
          </div>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <Move className="w-3 h-3 text-blue-600" /> Drag to Move
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-blue-600" /> Handles to Resize
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-blue-600" /> Stem to Rotate
            </span>
          </>
        )}
        <span aria-hidden="true" className="text-slate-300">
          |
        </span>
        <button
          type="button"
          onClick={() =>
            useStudioStore.getState().setActiveModal('shortcuts')
          }
          className="text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer whitespace-nowrap"
        >
          Shortcuts (?)
        </button>
      </div>
      )}

      {/* Right-Click Viewport Context Menu */}
      {!isPreviewMode && contextMenu && (
        <ViewportContextMenu
          clientX={contextMenu.clientX}
          clientY={contextMenu.clientY}
          stageX={contextMenu.stageX}
          stageY={contextMenu.stageY}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
