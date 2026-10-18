import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Copy,
  Eraser,
  Hexagon,
  Maximize2,
  Minus,
  MousePointer,
  Move,
  PenTool,
  Pencil,
  RectangleHorizontal,
  RotateCw,
  Spline,
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computeDeviceMotionTrail,
  computeSnapPosition,
  resizeDrawingGeometry,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  updateDrawingLineEndpoints,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type { DrawingToolType, SceneDrawingObject } from '../shared/types.ts';
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
      tool: Exclude<DrawingToolType, 'select' | 'eraser'>;
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
    clips,
    tracks,
    mediaAssets,
    background,
    selectedIds,
    selectedDrawingId,
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
    showGuides,
    showRulers,
    showMotionTrail,
    selectDevice,
    selectDrawing,
    updateDevice,
    updateDrawing,
    addDrawing,
    deleteDrawing,
    duplicateDrawing,
    deleteSelectedDevices,
    setActiveDrawingTool,
    setCurrentFrame,
    setZoomAndPan,
    pushHistory,
  } = useStudioStore();

  const [interaction, setInteraction] = useState<InteractionMode>({
    type: 'none',
  });
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
        selectDevice(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          e.preventDefault();
          deleteDrawing(selectedDrawingId);
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
    selectedIds,
    setActiveDrawingTool,
    selectDrawing,
    selectDevice,
    deleteDrawing,
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
            clips,
            tracks,
            mediaAssets,
            background,
            isPlaying,
          });

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

          // Draw Selection Bounding Box, 8 Resize Handles (Corners + Sides), Rotation Handle & Endpoint Handles for Selected Drawing Object
          if (selectedDrawingId) {
            const rawSelDr = drawings.find((d) => d.id === selectedDrawingId);
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
    clips,
    tracks,
    mediaAssets,
    background,
    selectedIds,
    selectedDrawingId,
    drawingDefaults,
    interaction,
    currentFrame,
    fps,
    durationInFrames,
    isPlaying,
    zoom,
    showGuides,
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on floating HUD buttons
    if ((e.target as HTMLElement).closest('[data-hud-overlay="true"]')) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if synthetic event lacks pointerId registration
    }

    if (e.button === 1 || e.altKey) {
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

    // 2. Active Drawing Creation Tool (Brush, Pen, Line, Arrow, Rect, Rounded-Rect, Circle, Ellipse, Polygon, Bezier)
    if (activeDrawingTool !== 'select') {
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

    // Clicked empty canvas space
    selectDevice(null);
    selectDrawing(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = clientToCanvasCoords(e.clientX, e.clientY);
    setCursorCoords({ x: Math.round(pt.x), y: Math.round(pt.y) });

    if (interaction.type === 'none') return;

    if (interaction.type === 'erasing') {
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

    if (interaction.type === 'creating-drawing') {
      const lastPt = interaction.points[interaction.points.length - 1];
      const shouldAppendPoint =
        !lastPt || Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) >= 4;
      setInteraction({
        ...interaction,
        currentX: pt.x,
        currentY: pt.y,
        points: shouldAppendPoint
          ? [...interaction.points, { x: pt.x, y: pt.y }]
          : interaction.points,
      });
      return;
    }

    if (interaction.type === 'pan') {
      const dx = e.clientX - interaction.startMouseX;
      const dy = e.clientY - interaction.startMouseY;
      setZoomAndPan(
        zoom,
        interaction.startPanX + dx,
        interaction.startPanY + dy
      );
      return;
    }

    if (interaction.type === 'drag-drawing') {
      const dx = pt.x - interaction.startMouseX;
      const dy = pt.y - interaction.startMouseY;
      updateDrawing(
        interaction.drawingId,
        {
          x: Math.round(interaction.startX + dx),
          y: Math.round(interaction.startY + dy),
        },
        false
      );
      return;
    }

    if (interaction.type === 'resize-drawing') {
      const orig = interaction.origDrawing;
      const rad = (-orig.rotation * Math.PI) / 180;
      const rawDx = pt.x - interaction.startMouseX;
      const rawDy = pt.y - interaction.startMouseY;
      const localDx = rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      const localDy = rawDx * Math.sin(rad) + rawDy * Math.cos(rad);
      const h = interaction.handle;

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

      const lockAspect =
        Boolean(orig.lockAspectRatio) ||
        orig.tool === 'circle' ||
        e.shiftKey;

      const resized = resizeDrawingGeometry(orig, reqW, reqH, lockAspect);
      updateDrawing(
        interaction.drawingId,
        {
          width: resized.width,
          height: resized.height,
          points: resized.points,
        },
        false
      );
      return;
    }

    if (interaction.type === 'rotate-drawing') {
      const angle = Math.atan2(
        pt.y - interaction.centerY,
        pt.x - interaction.centerX
      );
      const degDelta = ((angle - interaction.startAngle) * 180) / Math.PI;
      let nextRot = Math.round(interaction.initialRotation + degDelta);
      if ((snapToGrid || e.shiftKey) && Math.abs(nextRot % 15) <= 4) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      updateDrawing(interaction.drawingId, { rotation: nextRot }, false);
      return;
    }

    if (interaction.type === 'drag-drawing-endpoint') {
      const rawDr = drawings.find((d) => d.id === interaction.drawingId);
      if (!rawDr) return;
      const startX = interaction.endpointIndex === 0 ? pt.x : interaction.otherX;
      const startY = interaction.endpointIndex === 0 ? pt.y : interaction.otherY;
      const endX = interaction.endpointIndex === 1 ? pt.x : interaction.otherX;
      const endY = interaction.endpointIndex === 1 ? pt.y : interaction.otherY;
      const updated = updateDrawingLineEndpoints(
        rawDr,
        startX,
        startY,
        endX,
        endY
      );
      updateDrawing(interaction.drawingId, updated, false);
      return;
    }

    if (interaction.type === 'drag') {
      const dx = pt.x - interaction.startMouseX;
      const dy = pt.y - interaction.startMouseY;
      const primaryStart = interaction.initialPositions[interaction.deviceId];
      if (!primaryStart) return;

      const otherCenters = devices
        .filter((d) => !interaction.initialPositions[d.id] && d.visible)
        .map((d) => ({ x: d.x, y: d.y }));

      const snapped = computeSnapPosition(
        primaryStart.x + dx,
        primaryStart.y + dy,
        canvasWidth,
        canvasHeight,
        otherCenters,
        snapToGrid,
        20,
        10
      );

      const appliedDx = snapped.x - primaryStart.x;
      const appliedDy = snapped.y - primaryStart.y;

      setActiveGuides({ x: snapped.guidesX, y: snapped.guidesY });

      Object.entries(interaction.initialPositions).forEach(([id, startPos]) => {
        updateDevice(
          id,
          {
            x: Math.round(startPos.x + appliedDx),
            y: Math.round(startPos.y + appliedDy),
          },
          false
        );
      });
      return;
    }

    if (interaction.type === 'scale') {
      const distDelta =
        (pt.x - interaction.startMouseX + (pt.y - interaction.startMouseY)) /
        320;
      const nextScale = Math.max(
        0.2,
        Math.min(3.0, Number((interaction.startScaleX + distDelta).toFixed(2)))
      );
      updateDevice(
        interaction.deviceId,
        { scaleX: nextScale, scaleY: nextScale },
        false
      );
      return;
    }

    if (interaction.type === 'rotate') {
      const angle = Math.atan2(
        pt.y - interaction.centerY,
        pt.x - interaction.centerX
      );
      const degDelta = ((angle - interaction.startAngle) * 180) / Math.PI;
      let nextRot = Math.round(interaction.initialRotation + degDelta);
      if (snapToGrid && Math.abs(nextRot % 15) <= 3) {
        nextRot = Math.round(nextRot / 15) * 15;
      }
      updateDevice(interaction.deviceId, { rotation: nextRot }, false);
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

    if (interaction.type === 'creating-drawing') {
      const xs =
        interaction.tool === 'brush' ||
        interaction.tool === 'pen' ||
        interaction.tool === 'bezier'
          ? interaction.points.map((p) => p.x)
          : [interaction.startX, interaction.currentX];
      const ys =
        interaction.tool === 'brush' ||
        interaction.tool === 'pen' ||
        interaction.tool === 'bezier'
          ? interaction.points.map((p) => p.y)
          : [interaction.startY, interaction.currentY];

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Default comfortable size (160x160) if user just clicked once on the canvas
      const rawW = maxX - minX;
      const rawH = maxY - minY;
      const isCircle = interaction.tool === 'circle';
      const baseW = Math.max(120, rawW);
      const baseH = Math.max(120, rawH);
      const w = isCircle ? Math.max(baseW, baseH) : baseW;
      const h = isCircle ? Math.max(baseW, baseH) : baseH;
      const cx = rawW < 15 ? interaction.startX : (minX + maxX) / 2;
      const cy = rawH < 15 ? interaction.startY : (minY + maxY) / 2;

      const id = `draw-${Date.now().toString(36).slice(-4)}`;
      const toolLabel =
        interaction.tool.charAt(0).toUpperCase() + interaction.tool.slice(1);

      const newDrawing: SceneDrawingObject = {
        id,
        name: `Neon ${toolLabel} #${drawings.length + 1}`,
        tool: interaction.tool,
        points:
          interaction.tool === 'brush' ||
          interaction.tool === 'pen' ||
          interaction.tool === 'bezier'
            ? interaction.points.length >= 2 && (rawW >= 15 || rawH >= 15)
              ? interaction.points.map((p) => ({
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
                  x: rawW < 15 ? -80 : Math.round(interaction.startX - cx),
                  y: rawH < 15 ? 50 : Math.round(interaction.startY - cy),
                },
                {
                  x: rawW < 15 ? 80 : Math.round(interaction.currentX - cx),
                  y: rawH < 15 ? -50 : Math.round(interaction.currentY - cy),
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
        strokeWidth: drawingDefaults.strokeWidth,
        strokeOpacity: drawingDefaults.strokeOpacity,
        fillColor: drawingDefaults.fillColor,
        fillOpacity: drawingDefaults.fillOpacity,
        lineCap: 'round',
        lineJoin: 'round',
        dashPattern: drawingDefaults.dashPattern,
        cornerRadius: interaction.tool === 'rect' ? 0 : 24,
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

    if (interaction.type !== 'none') {
      if (interaction.type !== 'pan' && interaction.type !== 'erasing') {
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

  const toolButtons: {
    id: DrawingToolType;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'select', label: 'Select & Transform (V)', shortLabel: 'Select', icon: MousePointer },
    { id: 'brush', label: 'Freehand Brush (B)', shortLabel: 'Brush', icon: Pencil },
    { id: 'pen', label: 'Vector Pen (P)', shortLabel: 'Pen', icon: PenTool },
    { id: 'line', label: 'Straight Line (L)', shortLabel: 'Line', icon: Minus },
    { id: 'arrow', label: 'Arrow Callout (A)', shortLabel: 'Arrow', icon: ArrowUpRight },
    { id: 'rect', label: 'Rectangle (R)', shortLabel: 'Rect', icon: RectangleHorizontal },
    { id: 'rounded-rect', label: 'Rounded Rectangle (U)', shortLabel: 'Rounded', icon: Square },
    { id: 'circle', label: 'Circle (C)', shortLabel: 'Circle', icon: Circle },
    { id: 'ellipse', label: 'Ellipse / Halo (O)', shortLabel: 'Ellipse', icon: Circle },
    { id: 'bezier', label: 'Smooth Curve', shortLabel: 'Curve', icon: Spline },
    { id: 'polygon', label: 'Polygon', shortLabel: 'Poly', icon: Hexagon },
    { id: 'eraser', label: 'Eraser (E)', shortLabel: 'Eraser', icon: Eraser },
  ];

  const activeSelectedDrawingObj = drawings.find(
    (d) => d.id === selectedDrawingId
  );

  const stageCursorClass =
    interaction.type === 'pan'
      ? 'cursor-grabbing'
      : activeDrawingTool === 'select'
        ? 'cursor-default'
        : activeDrawingTool === 'eraser'
          ? 'cursor-cell'
          : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      data-testid="canvas-2d-viewport"
      className={`relative flex-1 h-full bg-[#090C12] overflow-hidden select-none touch-none flex items-center justify-center ${stageCursorClass}`}
    >
      {/* Top Horizontal Pixel Ruler */}
      {showRulers && (
        <div
          aria-hidden="true"
          className="absolute top-0 left-6 right-0 h-6 bg-[#0E131D] border-b border-slate-800/80 z-20 flex items-center px-3 text-[10px] font-mono tabular-nums text-slate-500 pointer-events-none"
        >
          <span>0px</span>
          <span className="ml-auto">X: {cursorCoords.x}px</span>
          <span className="ml-4">Y: {cursorCoords.y}px</span>
          <span className="ml-auto">{canvasWidth}px</span>
        </div>
      )}

      {/* Left Vertical Pixel Ruler */}
      {showRulers && (
        <div
          aria-hidden="true"
          className="absolute top-6 bottom-0 left-0 w-6 bg-[#0E131D] border-r border-slate-800/80 z-20 flex flex-col justify-between py-2 items-center text-[10px] font-mono tabular-nums text-slate-500 pointer-events-none"
        >
          <span>0</span>
          <span className="-rotate-90">{Math.round(canvasHeight / 2)}</span>
          <span>{canvasHeight}</span>
        </div>
      )}

      {/* Floating Top-Center Vector & Neon Glow Drawing Toolbar */}
      <div
        data-hud-overlay="true"
        data-testid="canvas-drawing-toolbar"
        className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center items-center gap-0.5 bg-[#111724]/95 border border-slate-700/90 rounded-xl px-1.5 py-1 shadow-xl max-w-[calc(100%-2.5rem)]"
      >
        {toolButtons.map((tb) => {
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
              className={`px-1.5 py-1 rounded-lg flex items-center gap-1 text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden xl:inline">{tb.shortLabel}</span>
            </button>
          );
        })}

        {activeSelectedDrawingObj && (
          <>
            <div className="w-px h-4 bg-slate-700 mx-1 shrink-0" />
            <span className="hidden 2xl:inline text-[10px] font-mono tabular-nums text-cyan-300 px-1.5 shrink-0">
              {Math.round(activeSelectedDrawingObj.width)}×
              {Math.round(activeSelectedDrawingObj.height)}px
            </span>
            <button
              type="button"
              onClick={() => duplicateDrawing(activeSelectedDrawingObj.id)}
              title="Duplicate Selected Drawing"
              aria-label="Duplicate selected drawing from toolbar"
              className="p-1 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteDrawing(activeSelectedDrawingObj.id)}
              title="Delete Selected Drawing (Del)"
              aria-label="Delete selected drawing from toolbar"
              className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Interactive Scaled Stage Container */}
      <div
        style={{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        className="relative shadow-2xl ring-1 ring-slate-700/70 transition-transform duration-75"
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          data-testid="studio-2d-canvas"
          className={`block bg-[#0B0F17] ${stageCursorClass}`}
        />
      </div>

      {/* Bottom-Right Floating Viewport HUD Controls */}
      <div
        data-hud-overlay="true"
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-[#111724]/95 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg"
      >
        <button
          type="button"
          onClick={() => setZoomAndPan(Number((zoom - 0.1).toFixed(2)))}
          aria-label="Zoom out canvas"
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-mono tabular-nums text-slate-200 px-1.5 min-w-[48px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoomAndPan(Number((zoom + 0.1).toFixed(2)))}
          aria-label="Zoom in canvas"
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-1" />
        <button
          type="button"
          onClick={() => {
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
          aria-label="Reset canvas zoom and pan"
          className="px-2 py-0.5 text-xs font-medium text-slate-300 hover:text-white rounded hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          Fit Stage
        </button>
      </div>

      {/* Bottom-Left Quick Gesture & Onion Skin Legend */}
      <div className="absolute bottom-4 left-10 z-20 hidden lg:flex items-center gap-3 text-[11px] text-slate-400 bg-[#111724]/95 border border-slate-800/80 rounded-lg px-3 py-1.5 pointer-events-none">
        {showMotionTrail ? (
          <div
            data-testid="onion-skin-hud-badge"
            className="flex items-center gap-2.5 text-slate-200"
          >
            <span className="font-semibold text-cyan-300 flex items-center gap-1">
              <Spline className="w-3.5 h-3.5" />
              Onion Skin Active
            </span>
            <span aria-hidden="true" className="text-slate-600">
              |
            </span>
            <span className="flex items-center gap-1 text-cyan-300 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              Past KF
            </span>
            <span className="flex items-center gap-1 text-rose-300 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Playhead F{String(currentFrame).padStart(3, '0')}
            </span>
            <span className="flex items-center gap-1 text-amber-300 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Next KF
            </span>
          </div>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <Move className="w-3 h-3 text-sky-400" /> Drag to Move & Snap
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Maximize2 className="w-3 h-3 text-sky-400" /> Corner Handles to
              Resize
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <RotateCw className="w-3 h-3 text-sky-400" /> Top Stem to Rotate
            </span>
          </>
        )}
      </div>
    </div>
  );
};
