import React, { useEffect, useMemo, useState } from 'react';
import { getDevicePresetById } from '../device-catalog/catalog.ts';
import {
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  resolveWebcamAtFrame,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';

interface ViewportRulersProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cursorCoords?: { x: number; y: number } | null;
  mode?: '2d' | '3d';
}

export interface SelectionBounds {
  label: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export const ViewportRulers: React.FC<ViewportRulersProps> = ({
  containerRef,
  cursorCoords,
  mode = '2d',
}) => {
  const {
    canvasWidth,
    canvasHeight,
    zoom,
    panX,
    panY,
    showRulers,
    isPreviewMode,
    devices,
    drawings,
    webcams,
    tracks,
    selectedIds,
    selectedDrawingId,
    selectedDrawingIds,
    selectedWebcamId,
    selectedWebcamIds,
    currentFrame,
    durationInFrames,
  } = useStudioStore();

  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 1100,
    height: 680,
  });

  const [unitMode, setUnitMode] = useState<'px' | '%'>('px');
  const [customGuides, setCustomGuides] = useState<{
    x: number[];
    y: number[];
  }>({
    x: [],
    y: [],
  });

  // Track viewport container dimensions accurately
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setViewportSize({
        width: Math.max(240, el.clientWidth),
        height: Math.max(180, el.clientHeight),
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [containerRef]);

  // Compute active selection bounds in stage coordinates (px) for single or marquee multi-selection
  const selectionBounds = useMemo<SelectionBounds | null>(() => {
    const activeDrIds = Array.from(
      new Set([
        ...selectedDrawingIds,
        ...(selectedDrawingId ? [selectedDrawingId] : []),
      ])
    );
    const activeWcIds = Array.from(
      new Set([
        ...selectedWebcamIds,
        ...(selectedWebcamId ? [selectedWebcamId] : []),
      ])
    );

    const selectedDevices = devices.filter(
      (d) => selectedIds.includes(d.id) && d.visible
    );
    const selectedDrawings = drawings.filter(
      (d) => activeDrIds.includes(d.id) && d.visible
    );
    const selectedWebcams = webcams.filter(
      (w) => activeWcIds.includes(w.id) && w.visible
    );

    const totalCount =
      selectedDevices.length + selectedDrawings.length + selectedWebcams.length;
    if (totalCount === 0) return null;

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    selectedDevices.forEach((dev) => {
      const devTrack = tracks.find((t) => t.targetId === dev.id);
      const r = resolveDeviceAtFrame(
        dev,
        devTrack ? devTrack.keyframes : [],
        currentFrame,
        durationInFrames
      );
      const preset = getDevicePresetById(dev.presetId);
      const w = preset.width * r.scaleX;
      const h = preset.height * r.scaleY;
      minLeft = Math.min(minLeft, r.x - w / 2);
      maxRight = Math.max(maxRight, r.x + w / 2);
      minTop = Math.min(minTop, r.y - h / 2);
      maxBottom = Math.max(maxBottom, r.y + h / 2);
    });

    selectedDrawings.forEach((dr) => {
      const drTrack = tracks.find((t) => t.targetId === dr.id);
      const r = resolveDrawingAtFrame(
        dr,
        drTrack ? drTrack.keyframes : [],
        currentFrame
      );
      const w = Math.max(1, r.width * r.scaleX);
      const h = Math.max(1, r.height * r.scaleY);
      minLeft = Math.min(minLeft, r.x - w / 2);
      maxRight = Math.max(maxRight, r.x + w / 2);
      minTop = Math.min(minTop, r.y - h / 2);
      maxBottom = Math.max(maxBottom, r.y + h / 2);
    });

    selectedWebcams.forEach((wc) => {
      const wcTrack = tracks.find((t) => t.targetId === wc.id);
      const r = resolveWebcamAtFrame(
        wc,
        wcTrack ? wcTrack.keyframes : [],
        currentFrame
      );
      const w = Math.max(1, r.width * r.scaleX);
      const h = Math.max(1, r.height * r.scaleY);
      minLeft = Math.min(minLeft, r.x - w / 2);
      maxRight = Math.max(maxRight, r.x + w / 2);
      minTop = Math.min(minTop, r.y - h / 2);
      maxBottom = Math.max(maxBottom, r.y + h / 2);
    });

    if (!Number.isFinite(minLeft) || !Number.isFinite(maxRight)) return null;

    const width = Math.max(1, Math.round(maxRight - minLeft));
    const height = Math.max(1, Math.round(maxBottom - minTop));
    const singleLabel =
      selectedDevices[0]?.name ||
      selectedDrawings[0]?.name ||
      selectedWebcams[0]?.name ||
      'Selected';

    return {
      label: totalCount === 1 ? singleLabel : `${totalCount} Elements`,
      left: Math.round(minLeft),
      right: Math.round(maxRight),
      top: Math.round(minTop),
      bottom: Math.round(maxBottom),
      centerX: Math.round((minLeft + maxRight) / 2),
      centerY: Math.round((minTop + maxBottom) / 2),
      width,
      height,
    };
  }, [
    selectedWebcamId,
    selectedWebcamIds,
    selectedDrawingId,
    selectedDrawingIds,
    selectedIds,
    webcams,
    drawings,
    devices,
    tracks,
    currentFrame,
    durationInFrames,
  ]);

  if (!showRulers || isPreviewMode) return null;

  // In 2D mode, use zoom & panX/panY. In 3D mode, map stage [0..canvasWidth] proportionally to the centered viewport area.
  const effectiveZoom =
    mode === '2d'
      ? Math.max(0.08, zoom)
      : Math.max(
          0.15,
          Math.min(
            (viewportSize.width - 120) / Math.max(1, canvasWidth),
            (viewportSize.height - 120) / Math.max(1, canvasHeight)
          )
        );
  const effectivePanX = mode === '2d' ? panX : 0;
  const effectivePanY = mode === '2d' ? panY : 0;

  // Stage origin (0, 0) in viewport pixel coordinates
  const stageOriginX =
    viewportSize.width / 2 + effectivePanX - (canvasWidth * effectiveZoom) / 2;
  const stageOriginY =
    viewportSize.height / 2 +
    effectivePanY -
    (canvasHeight * effectiveZoom) / 2;

  const stageEndX = stageOriginX + canvasWidth * effectiveZoom;
  const stageEndY = stageOriginY + canvasHeight * effectiveZoom;

  // Choose major tick interval in stage pixels so screen spacing is ~65px - 140px
  const rawMajorStep = 90 / effectiveZoom;
  const niceSteps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const majorStep =
    niceSteps.find((s) => s >= rawMajorStep) ||
    niceSteps[niceSteps.length - 1];
  const minorStep = majorStep / 5;

  // Generate Horizontal Ticks across visible viewport width (from left=24 to width)
  const hTicks: {
    screenX: number;
    stageX: number;
    isMajor: boolean;
    isMedium: boolean;
  }[] = [];
  const minVisibleStageX =
    Math.floor((24 - stageOriginX) / effectiveZoom / minorStep) * minorStep;
  const maxVisibleStageX =
    Math.ceil(
      (viewportSize.width - stageOriginX) / effectiveZoom / minorStep
    ) * minorStep;

  for (
    let sx = minVisibleStageX;
    sx <= maxVisibleStageX;
    sx = Math.round((sx + minorStep) * 100) / 100
  ) {
    const screenX = stageOriginX + sx * effectiveZoom;
    if (screenX < 24 || screenX > viewportSize.width) continue;
    const modMajor = Math.abs(sx % majorStep);
    const isMajor = modMajor < 0.01 || Math.abs(modMajor - majorStep) < 0.01;
    const halfStep = majorStep / 2;
    const modHalf = Math.abs(sx % halfStep);
    const isMedium =
      !isMajor && (modHalf < 0.01 || Math.abs(modHalf - halfStep) < 0.01);
    hTicks.push({
      screenX,
      stageX: Math.round(sx),
      isMajor,
      isMedium,
    });
  }

  // Generate Vertical Ticks across visible viewport height (from top=24 to height)
  const vTicks: {
    screenY: number;
    stageY: number;
    isMajor: boolean;
    isMedium: boolean;
  }[] = [];
  const minVisibleStageY =
    Math.floor((24 - stageOriginY) / effectiveZoom / minorStep) * minorStep;
  const maxVisibleStageY =
    Math.ceil(
      (viewportSize.height - stageOriginY) / effectiveZoom / minorStep
    ) * minorStep;

  for (
    let sy = minVisibleStageY;
    sy <= maxVisibleStageY;
    sy = Math.round((sy + minorStep) * 100) / 100
  ) {
    const screenY = stageOriginY + sy * effectiveZoom;
    if (screenY < 24 || screenY > viewportSize.height) continue;
    const modMajor = Math.abs(sy % majorStep);
    const isMajor = modMajor < 0.01 || Math.abs(modMajor - majorStep) < 0.01;
    const halfStep = majorStep / 2;
    const modHalf = Math.abs(sy % halfStep);
    const isMedium =
      !isMajor && (modHalf < 0.01 || Math.abs(modHalf - halfStep) < 0.01);
    vTicks.push({
      screenY,
      stageY: Math.round(sy),
      isMajor,
      isMedium,
    });
  }

  const formatCoord = (val: number, total: number) => {
    if (unitMode === '%') {
      return `${Math.round((val / Math.max(1, total)) * 100)}%`;
    }
    return `${val}`;
  };

  // Selection projection in viewport coordinates
  const selScreenLeft = selectionBounds
    ? Math.max(24, stageOriginX + selectionBounds.left * effectiveZoom)
    : null;
  const selScreenRight = selectionBounds
    ? Math.min(
        viewportSize.width,
        stageOriginX + selectionBounds.right * effectiveZoom
      )
    : null;
  const selScreenTop = selectionBounds
    ? Math.max(24, stageOriginY + selectionBounds.top * effectiveZoom)
    : null;
  const selScreenBottom = selectionBounds
    ? Math.min(
        viewportSize.height,
        stageOriginY + selectionBounds.bottom * effectiveZoom
      )
    : null;

  // Cursor screen coordinates
  const cursorScreenX =
    cursorCoords != null
      ? stageOriginX + cursorCoords.x * effectiveZoom
      : null;
  const cursorScreenY =
    cursorCoords != null
      ? stageOriginY + cursorCoords.y * effectiveZoom
      : null;

  const handleHorizontalRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickViewportX = e.clientX - rect.left + 24;
    const stageX = Math.round((clickViewportX - stageOriginX) / effectiveZoom);
    setCustomGuides((prev) => {
      const existingIdx = prev.x.findIndex((gx) => Math.abs(gx - stageX) < 12);
      if (existingIdx !== -1) {
        return { ...prev, x: prev.x.filter((_, i) => i !== existingIdx) };
      }
      return { ...prev, x: [...prev.x, stageX] };
    });
  };

  const handleVerticalRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickViewportY = e.clientY - rect.top + 24;
    const stageY = Math.round((clickViewportY - stageOriginY) / effectiveZoom);
    setCustomGuides((prev) => {
      const existingIdx = prev.y.findIndex((gy) => Math.abs(gy - stageY) < 12);
      if (existingIdx !== -1) {
        return { ...prev, y: prev.y.filter((_, i) => i !== existingIdx) };
      }
      return { ...prev, y: [...prev.y, stageY] };
    });
  };

  return (
    <>
      {/* Top-Left Ruler Origin Corner Cell */}
      <button
        type="button"
        data-hud-overlay="true"
        data-testid="viewport-ruler-corner"
        onClick={(e) => {
          e.stopPropagation();
          setUnitMode((prev) => (prev === 'px' ? '%' : 'px'));
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setCustomGuides({ x: [], y: [] });
        }}
        title="Click to switch ruler units (px / %) · Double-click to clear custom ruler guides"
        className="absolute top-0 left-0 w-6 h-6 bg-white hover:bg-slate-50 border-b border-r border-slate-200 z-20 flex items-center justify-center text-[9px] font-mono font-semibold text-slate-500 hover:text-blue-600 cursor-pointer select-none"
      >
        {unitMode}
      </button>

      {/* Top Horizontal Ruler */}
      <div
        data-hud-overlay="true"
        data-testid="viewport-ruler-horizontal"
        onClick={handleHorizontalRulerClick}
        title="Horizontal Viewport Ruler — Click to place or remove a vertical reference guide"
        className="absolute top-0 left-6 right-0 h-6 bg-white/95 backdrop-blur-xs border-b border-slate-200 z-15 overflow-hidden select-none cursor-crosshair"
      >
        {/* Active Stage Span Tint [0 .. canvasWidth] */}
        <div
          style={{
            left: `${Math.max(0, stageOriginX - 24)}px`,
            width: `${Math.max(0, Math.min(viewportSize.width, stageEndX) - Math.max(24, stageOriginX))}px`,
          }}
          className="absolute inset-y-0 bg-slate-50/90 pointer-events-none"
        />

        {/* Selected Element Horizontal Projection Band & Dimension Readout */}
        {selectionBounds &&
          selScreenLeft != null &&
          selScreenRight != null &&
          selScreenRight > selScreenLeft && (
            <div
              data-testid="ruler-horizontal-selection-band"
              style={{
                left: `${selScreenLeft - 24}px`,
                width: `${Math.max(2, selScreenRight - selScreenLeft)}px`,
              }}
              className="absolute inset-y-0 bg-blue-500/15 border-x border-blue-600 pointer-events-none flex items-center justify-center"
            >
              {selScreenRight - selScreenLeft >= 48 && (
                <span className="px-1 py-0.2 rounded bg-blue-600 text-white text-[9px] font-mono font-semibold leading-none shadow-2xs whitespace-nowrap">
                  {unitMode === '%'
                    ? `${Math.round((selectionBounds.width / canvasWidth) * 100)}%`
                    : `${selectionBounds.width}px`}
                </span>
              )}
            </div>
          )}

        {/* Horizontal Tick Marks & Labels */}
        {hTicks.map((t) => {
          const leftPx = t.screenX - 24;
          const inStage = t.stageX >= 0 && t.stageX <= canvasWidth;
          return (
            <div
              key={t.stageX}
              style={{ left: `${leftPx}px` }}
              className="absolute top-0 bottom-0 pointer-events-none"
            >
              <div
                className={`absolute bottom-0 w-px ${
                  t.isMajor
                    ? inStage
                      ? 'h-2.5 bg-slate-400'
                      : 'h-2 bg-slate-300'
                    : t.isMedium
                      ? 'h-1.5 bg-slate-300'
                      : 'h-1 bg-slate-200'
                }`}
              />
              {t.isMajor && (
                <span
                  className={`absolute top-0.5 left-1 text-[9px] font-mono tabular-nums leading-none whitespace-nowrap ${
                    t.stageX === 0 || t.stageX === canvasWidth
                      ? 'text-blue-600 font-semibold'
                      : inStage
                        ? 'text-slate-600'
                        : 'text-slate-400'
                  }`}
                >
                  {formatCoord(t.stageX, canvasWidth)}
                </span>
              )}
            </div>
          );
        })}

        {/* Custom Vertical Guide Markers on Horizontal Ruler */}
        {customGuides.x.map((gx) => {
          const leftPx = stageOriginX + gx * effectiveZoom - 24;
          if (leftPx < 0 || leftPx > viewportSize.width) return null;
          return (
            <div
              key={`h-guide-${gx}`}
              style={{ left: `${leftPx}px` }}
              className="absolute inset-y-0 w-px bg-cyan-500 pointer-events-none"
            >
              <span className="absolute top-0.5 left-1 px-1 rounded bg-cyan-500 text-white text-[8px] font-mono font-semibold leading-tight">
                {gx}
              </span>
            </div>
          );
        })}

        {/* Live Cursor X Hairline Indicator */}
        {cursorScreenX != null &&
          cursorScreenX >= 24 &&
          cursorScreenX <= viewportSize.width && (
            <div
              style={{ left: `${cursorScreenX - 24}px` }}
              className="absolute inset-y-0 w-px bg-blue-600 pointer-events-none z-10"
            >
              <div className="w-1.5 h-1.5 -ml-[2.5px] bg-blue-600 rotate-45" />
            </div>
          )}

        {/* Right-Aligned Live Coordinates & Selection Dimension Badge */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white/95 px-2 py-0.5 rounded border border-slate-200/90 text-[10px] font-mono tabular-nums text-slate-600 pointer-events-none shadow-2xs">
          {selectionBounds && (
            <>
              <span
                data-testid="ruler-selection-dimensions"
                className="text-blue-600 font-semibold"
              >
                {selectionBounds.label}: {selectionBounds.width}×
                {selectionBounds.height}px (@{selectionBounds.left},
                {selectionBounds.top})
              </span>
              <span className="text-slate-300">|</span>
            </>
          )}
          {cursorCoords && (
            <span data-testid="ruler-cursor-readout">
              X: {cursorCoords.x}px · Y: {cursorCoords.y}px
            </span>
          )}
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">
            {canvasWidth}×{canvasHeight}px
          </span>
        </div>
      </div>

      {/* Left Vertical Ruler */}
      <div
        data-hud-overlay="true"
        data-testid="viewport-ruler-vertical"
        onClick={handleVerticalRulerClick}
        title="Vertical Viewport Ruler — Click to place or remove a horizontal reference guide"
        className="absolute top-6 bottom-0 left-0 w-6 bg-white/95 backdrop-blur-xs border-r border-slate-200 z-15 overflow-hidden select-none cursor-crosshair"
      >
        {/* Active Stage Span Tint [0 .. canvasHeight] */}
        <div
          style={{
            top: `${Math.max(0, stageOriginY - 24)}px`,
            height: `${Math.max(0, Math.min(viewportSize.height, stageEndY) - Math.max(24, stageOriginY))}px`,
          }}
          className="absolute inset-x-0 bg-slate-50/90 pointer-events-none"
        />

        {/* Selected Element Vertical Projection Band & Dimension Readout */}
        {selectionBounds &&
          selScreenTop != null &&
          selScreenBottom != null &&
          selScreenBottom > selScreenTop && (
            <div
              data-testid="ruler-vertical-selection-band"
              style={{
                top: `${selScreenTop - 24}px`,
                height: `${Math.max(2, selScreenBottom - selScreenTop)}px`,
              }}
              className="absolute inset-x-0 bg-blue-500/15 border-y border-blue-600 pointer-events-none flex items-center justify-center"
            >
              {selScreenBottom - selScreenTop >= 48 && (
                <span className="-rotate-90 px-1 py-0.2 rounded bg-blue-600 text-white text-[9px] font-mono font-semibold leading-none shadow-2xs whitespace-nowrap">
                  {unitMode === '%'
                    ? `${Math.round((selectionBounds.height / canvasHeight) * 100)}%`
                    : `${selectionBounds.height}px`}
                </span>
              )}
            </div>
          )}

        {/* Vertical Tick Marks & Labels */}
        {vTicks.map((t) => {
          const topPx = t.screenY - 24;
          const inStage = t.stageY >= 0 && t.stageY <= canvasHeight;
          return (
            <div
              key={t.stageY}
              style={{ top: `${topPx}px` }}
              className="absolute left-0 right-0 pointer-events-none"
            >
              <div
                className={`absolute right-0 h-px ${
                  t.isMajor
                    ? inStage
                      ? 'w-2.5 bg-slate-400'
                      : 'w-2 bg-slate-300'
                    : t.isMedium
                      ? 'w-1.5 bg-slate-300'
                      : 'w-1 bg-slate-200'
                }`}
              />
              {t.isMajor && (
                <span
                  className={`absolute left-0.5 top-2.5 -rotate-90 origin-top-left text-[9px] font-mono tabular-nums leading-none whitespace-nowrap ${
                    t.stageY === 0 || t.stageY === canvasHeight
                      ? 'text-blue-600 font-semibold'
                      : inStage
                        ? 'text-slate-600'
                        : 'text-slate-400'
                  }`}
                >
                  {formatCoord(t.stageY, canvasHeight)}
                </span>
              )}
            </div>
          );
        })}

        {/* Custom Horizontal Guide Markers on Vertical Ruler */}
        {customGuides.y.map((gy) => {
          const topPx = stageOriginY + gy * effectiveZoom - 24;
          if (topPx < 0 || topPx > viewportSize.height) return null;
          return (
            <div
              key={`v-guide-${gy}`}
              style={{ top: `${topPx}px` }}
              className="absolute inset-x-0 h-px bg-cyan-500 pointer-events-none"
            />
          );
        })}

        {/* Live Cursor Y Hairline Indicator */}
        {cursorScreenY != null &&
          cursorScreenY >= 24 &&
          cursorScreenY <= viewportSize.height && (
            <div
              style={{ top: `${cursorScreenY - 24}px` }}
              className="absolute inset-x-0 h-px bg-blue-600 pointer-events-none z-10"
            >
              <div className="w-1.5 h-1.5 -mt-[2.5px] bg-blue-600 rotate-45" />
            </div>
          )}
      </div>

      {/* Viewport Custom Reference Guide Lines (Placed by clicking on Rulers) */}
      {customGuides.x.map((gx) => {
        const screenX = stageOriginX + gx * effectiveZoom;
        if (screenX < 24 || screenX > viewportSize.width) return null;
        return (
          <div
            key={`stage-vguide-${gx}`}
            style={{ left: `${screenX}px` }}
            className="absolute top-6 bottom-0 w-px border-l border-dashed border-cyan-500/80 pointer-events-none z-10"
          />
        );
      })}
      {customGuides.y.map((gy) => {
        const screenY = stageOriginY + gy * effectiveZoom;
        if (screenY < 24 || screenY > viewportSize.height) return null;
        return (
          <div
            key={`stage-hguide-${gy}`}
            style={{ top: `${screenY}px` }}
            className="absolute left-6 right-0 h-px border-t border-dashed border-cyan-500/80 pointer-events-none z-10"
          />
        );
      })}
    </>
  );
};
