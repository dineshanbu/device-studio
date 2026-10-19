import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Image as ImageIcon,
  Terminal,
  X,
} from 'lucide-react';
import { resolveExportDimensions } from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type { AspectRatioPreset, ExportSettings } from '../shared/types.ts';
import { executeStudioExport } from './exporter.ts';

export const ExportModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    projectName,
    currentFrame,
    durationInFrames,
    fps,
    aspectRatio,
    devices,
    drawings,
    webcams,
    clips,
    tracks,
    mediaAssets,
    background,
  } = useStudioStore();

  const [settings, setSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: aspectRatio || '16:9',
    customWidth: 1920,
    customHeight: 1080,
    fps: fps || 30,
    quality: 0.92,
    transparentBackground: false,
    includeAudio: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resultDownload, setResultDownload] = useState<{
    url: string;
    filename: string;
    sizeKb: number;
  } | null>(null);

  const cancelledRef = useRef(false);

  if (activeModal !== 'export') return null;

  const { width, height } = resolveExportDimensions(settings);

  const handleStartExport = async () => {
    setErrorText(null);
    if (resultDownload) {
      URL.revokeObjectURL(resultDownload.url);
      setResultDownload(null);
    }
    cancelledRef.current = false;
    setIsExporting(true);
    setProgress(5);
    setStatusText('Initializing deterministic render pipeline...');

    try {
      const res = await executeStudioExport({
        projectName,
        currentFrame,
        durationInFrames,
        devices,
        drawings,
        webcams,
        clips,
        tracks,
        mediaAssets,
        background,
        settings,
        onProgress: (pct, msg) => {
          setProgress(pct);
          setStatusText(msg);
        },
        isCancelled: () => cancelledRef.current,
      });

      const downloadUrl = URL.createObjectURL(res.blob);
      setResultDownload({
        url: downloadUrl,
        filename: res.filename,
        sizeKb: Math.max(1, Math.round(res.blob.size / 1024)),
      });

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Export failed unexpectedly.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    if (isExporting) {
      cancelledRef.current = true;
      setIsExporting(false);
      setStatusText('Export cancelled.');
    } else {
      setActiveModal('none');
    }
  };

  const ffmpegCommand = `npx remotion render packages/export/Composition.tsx "${projectName}" out/${
    projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'scene'
  }.${settings.format} --width=${width} --height=${height} --fps=${
    settings.fps
  } --codec=${settings.format === 'mp4' ? 'h264' : 'vp9'}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2
              id="export-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Export Studio Composition
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic frame-by-frame compositor · MP4, WebM, GIF, PNG,
              JPG, WebP & SVG
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close export modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Format Grid */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Output Format
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {(
                [
                  { id: 'mp4', label: 'MP4', type: 'video' },
                  { id: 'webm', label: 'WebM', type: 'video' },
                  { id: 'gif', label: 'GIF', type: 'video' },
                  { id: 'png', label: 'PNG', type: 'image' },
                  { id: 'jpg', label: 'JPG', type: 'image' },
                  { id: 'webp', label: 'WebP', type: 'image' },
                  { id: 'svg', label: 'SVG', type: 'vector' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      format: fmt.id,
                    }))
                  }
                  className={`py-2 px-2.5 rounded-lg border text-xs font-mono font-semibold flex flex-col items-center gap-1 transition-colors ${
                    settings.format === fmt.id
                      ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {fmt.type === 'video' ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution, Aspect Ratio & FPS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Resolution Preset
              </label>
              <select
                aria-label="Export Resolution"
                value={settings.resolution}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    resolution: e.target.value as ExportSettings['resolution'],
                  }))
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800"
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
                <option value="4k">4K Ultra HD (2160p)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Aspect Ratio
              </label>
              <select
                aria-label="Export Aspect Ratio"
                value={settings.aspectRatio}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    aspectRatio: e.target.value as AspectRatioPreset,
                  }))
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800"
              >
                <option value="16:9">16:9 Widescreen</option>
                <option value="9:16">9:16 Vertical</option>
                <option value="1:1">1:1 Square</option>
                <option value="4:3">4:3 Presentation</option>
                <option value="custom">Custom Dimensions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Frame Rate
              </label>
              <select
                aria-label="Export Frame Rate"
                value={settings.fps}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fps: Number(e.target.value) as 24 | 30 | 60,
                  }))
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-800"
              >
                <option value={24}>24 FPS (Cinema)</option>
                <option value={30}>30 FPS (Broadcast)</option>
                <option value={60}>60 FPS (Smooth Motion)</option>
              </select>
            </div>
          </div>

          {/* Transparency & Quality */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.transparentBackground}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    transparentBackground: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500"
              />
              <span>Transparent Background (PNG / WebP / WebM Alpha)</span>
            </label>

            <div className="text-xs font-mono tabular-nums text-blue-600 font-semibold">
              Output: {width} × {height} px
            </div>
          </div>

          {/* Remotion / FFmpeg CLI Command Preview */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span>Desktop FFmpeg / Remotion Pipeline Command</span>
            </div>
            <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
              {ffmpegCommand}
            </pre>
          </div>

          {/* Progress Bar */}
          {(isExporting || statusText) && (
            <div className="space-y-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 font-medium">{statusText}</span>
                <span className="font-mono tabular-nums text-blue-600 font-semibold">
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errorText && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorText}
            </div>
          )}

          {resultDownload && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-semibold">{resultDownload.filename}</div>
                  <div className="text-[11px] text-emerald-700 font-mono">
                    {resultDownload.sizeKb} KB · Ready for download
                  </div>
                </div>
              </div>
              <a
                href={resultDownload.url}
                download={resultDownload.filename}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Save File
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          >
            {isExporting ? 'Cancel Render' : 'Close'}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleStartExport}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering...' : 'Render & Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
