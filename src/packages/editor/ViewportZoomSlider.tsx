import React from 'react';
import { Maximize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useStudioStore } from '../scene-engine/store.ts';

interface ViewportZoomSliderProps {
  onFitStage?: () => void;
  cursorCoords?: { x: number; y: number } | null;
}

const ZOOM_PRESETS = [0.25, 0.38, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const ViewportZoomSlider: React.FC<ViewportZoomSliderProps> = ({
  onFitStage,
  cursorCoords,
}) => {
  const { zoom, setZoomAndPan, showRulers } = useStudioStore();

  const clampedZoom = Math.max(0.2, Math.min(2.0, Number(zoom.toFixed(2))));
  const zoomPercent = Math.round(zoom * 100);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextZoom = Number(e.target.value);
    if (Number.isFinite(nextZoom)) {
      setZoomAndPan(Number(nextZoom.toFixed(2)));
    }
  };

  const handleStepZoom = (delta: number) => {
    const next = Math.max(
      0.2,
      Math.min(2.5, Number((zoom + delta).toFixed(2)))
    );
    setZoomAndPan(next);
  };

  return (
    <div
      data-testid="viewport-zoom-slider-control"
      className="flex items-center gap-1.5"
    >
      {/* Compact Ruler Coordinate Indicator Pill next to the Zoom Slider */}
      {showRulers && cursorCoords && (
        <div
          data-testid="viewport-ruler-coord-indicator"
          title="Live Stage Cursor Coordinates (px)"
          className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/80 text-[10px] font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0"
        >
          <span>X:{cursorCoords.x}</span>
          <span className="text-slate-300">·</span>
          <span>Y:{cursorCoords.y}</span>
        </div>
      )}

      {/* Zoom Out (-5%) */}
      <button
        type="button"
        onClick={() => handleStepZoom(-0.05)}
        aria-label="Zoom out canvas"
        title="Zoom Out (-5%)"
        data-testid="viewport-zoom-out-btn"
        className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      {/* Granular Range Slider (20% - 200%, 1% steps) */}
      <div className="flex items-center px-1">
        <input
          type="range"
          min={0.2}
          max={2.0}
          step={0.01}
          value={clampedZoom}
          onChange={handleSliderChange}
          aria-label="Canvas Zoom Scale"
          data-testid="viewport-zoom-slider"
          title={`Canvas Scale: ${zoomPercent}% (Drag for 1% granular zoom)`}
          className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
        />
      </div>

      {/* Zoom In (+5%) */}
      <button
        type="button"
        onClick={() => handleStepZoom(0.05)}
        aria-label="Zoom in canvas"
        title="Zoom In (+5%)"
        data-testid="viewport-zoom-in-btn"
        className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      {/* Granular Zoom Percentage Readout & Quick Preset Selector */}
      <div className="relative flex items-center">
        <select
          aria-label="Zoom Percentage Preset"
          data-testid="viewport-zoom-preset-select"
          value={
            ZOOM_PRESETS.find((p) => Math.abs(p - zoom) < 0.015) ?? 'custom'
          }
          onChange={(e) => {
            if (e.target.value === 'fit') {
              onFitStage?.();
              return;
            }
            const val = Number(e.target.value);
            if (Number.isFinite(val)) {
              setZoomAndPan(val);
            }
          }}
          title="Select Zoom Preset or Click 1:1 to Reset"
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-slate-700 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer min-w-[54px] text-center"
        >
          {!ZOOM_PRESETS.some((p) => Math.abs(p - zoom) < 0.015) && (
            <option value="custom">{zoomPercent}%</option>
          )}
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {Math.round(preset * 100)}%
            </option>
          ))}
        </select>
      </div>

      {/* 1:1 (100%) Reset Button */}
      <button
        type="button"
        onClick={() => setZoomAndPan(1.0, 0, 0)}
        title="Reset Zoom to 100% (1:1)"
        data-testid="viewport-zoom-100-btn"
        className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          Math.abs(zoom - 1.0) < 0.015
            ? 'bg-blue-50 text-blue-600 border border-blue-200'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        1:1
      </button>

      {/* Fit Stage Button */}
      {onFitStage && (
        <>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={onFitStage}
            aria-label="Reset canvas zoom and pan"
            title="Fit Stage to Viewport (0)"
            data-testid="viewport-zoom-fit-btn"
            className="px-2 py-0.5 text-xs font-medium text-slate-700 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Maximize className="w-3 h-3" />
            <span>Fit Stage</span>
          </button>
        </>
      )}
    </div>
  );
};
