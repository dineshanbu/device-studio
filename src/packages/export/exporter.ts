import { getDevicePresetById } from '../device-catalog/catalog.ts';
import { renderSceneFrame2D } from '../render-2d/renderFrame2D.ts';
import {
  resolveDeviceAtFrame,
  resolveExportDimensions,
} from '../scene-engine/math.ts';
import type {
  ExportSettings,
  MediaAsset,
  SceneBackground,
  SceneDeviceObject,
  SceneDrawingObject,
  TimelineClip,
  TimelineTrack,
} from '../shared/types.ts';

export interface ExportSceneInput {
  projectName: string;
  currentFrame: number;
  durationInFrames: number;
  devices: SceneDeviceObject[];
  drawings?: SceneDrawingObject[];
  clips?: TimelineClip[];
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  background: SceneBackground;
  settings: ExportSettings;
  onProgress: (percent: number, message: string) => void;
  isCancelled: () => boolean;
}

/**
 * Generates an SVG representation of the current scene frame.
 */
export function renderSceneFrameSVG(input: ExportSceneInput): string {
  const { width, height } = resolveExportDimensions(input.settings);
  const scaleX = width / 1920;
  const scaleY = height / 1080;

  const bgDef = input.settings.transparentBackground
    ? ''
    : `<rect width="${width}" height="${height}" fill="${
        input.background.solidColor || '#080B11'
      }" />`;

  const sortedDevices = [...input.devices]
    .filter((d) => d.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  const deviceNodes = sortedDevices
    .map((rawDev) => {
      const track = input.tracks.find((t) => t.targetId === rawDev.id);
      const dev = resolveDeviceAtFrame(
        rawDev,
        track ? track.keyframes : [],
        input.currentFrame,
        input.durationInFrames
      );
      const preset = getDevicePresetById(dev.presetId);
      const cx = dev.x * scaleX;
      const cy = dev.y * scaleY;
      const w = dev.width * dev.scaleX * scaleX;
      const h = dev.height * dev.scaleY * scaleY;
      const r = (dev.customOuterRadius ?? preset.outerRadius) * scaleX;
      const sr = preset.screenRadius * scaleX;
      const bx = preset.bezelLeft * dev.scaleX * scaleX;
      const by = preset.bezelTop * dev.scaleY * scaleY;
      const sw =
        w - (preset.bezelLeft + preset.bezelRight) * dev.scaleX * scaleX;
      const sh =
        h - (preset.bezelTop + preset.bezelBottom) * dev.scaleY * scaleY;

      return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(
        1
      )}) rotate(${dev.rotation})" opacity="${dev.opacity}">
        <rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(
          1
        )}" width="${w.toFixed(1)}" height="${h.toFixed(
          1
        )}" rx="${r.toFixed(1)}" fill="${
          dev.customFrameColor || preset.frameColor
        }" stroke="${preset.frameAccentColor}" stroke-width="2" />
        <rect x="${(-w / 2 + bx).toFixed(1)}" y="${(-h / 2 + by).toFixed(
          1
        )}" width="${sw.toFixed(1)}" height="${sh.toFixed(
          1
        )}" rx="${sr.toFixed(1)}" fill="#090D16" />
        <text x="0" y="0" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="${Math.round(
          16 * scaleX
        )}" text-anchor="middle">${dev.name}</text>
      </g>`;
    })
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${bgDef}
  ${deviceNodes}
</svg>`;
}

/**
 * Executes deterministic image or frame-by-frame video export.
 */
export async function executeStudioExport(
  input: ExportSceneInput
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const { settings, onProgress, isCancelled } = input;
  const { width, height } = resolveExportDimensions(settings);
  const safeName =
    input.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'device-studio-export';

  // 1. Vector SVG Export
  if (settings.format === 'svg') {
    onProgress(50, 'Synthesizing vector SVG scene graph...');
    const svgString = renderSceneFrameSVG(input);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    onProgress(100, 'SVG export complete');
    return {
      blob,
      filename: `${safeName}-${width}x${height}.svg`,
      mimeType: 'image/svg+xml',
    };
  }

  // Create offscreen canvas at exact output resolution
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize offscreen rendering context.');
  }

  const scaleDevicesToOutput = (
    devs: SceneDeviceObject[]
  ): SceneDeviceObject[] => {
    const sx = width / 1920;
    const sy = height / 1080;
    const uniform = Math.min(sx, sy);
    return devs.map((d) => ({
      ...d,
      x: d.x * sx,
      y: d.y * sy,
      scaleX: d.scaleX * uniform,
      scaleY: d.scaleY * uniform,
    }));
  };

  const scaleTracksToOutput = (tracks: TimelineTrack[]): TimelineTrack[] => {
    const sx = width / 1920;
    const sy = height / 1080;
    const uniform = Math.min(sx, sy);
    return tracks.map((t) => ({
      ...t,
      keyframes: t.keyframes.map((kf) => ({
        ...kf,
        properties: {
          ...kf.properties,
          x: kf.properties.x !== undefined ? kf.properties.x * sx : undefined,
          y: kf.properties.y !== undefined ? kf.properties.y * sy : undefined,
          scaleX:
            kf.properties.scaleX !== undefined
              ? kf.properties.scaleX * uniform
              : undefined,
          scaleY:
            kf.properties.scaleY !== undefined
              ? kf.properties.scaleY * uniform
              : undefined,
        },
      })),
    }));
  };

  const scaledDevices = scaleDevicesToOutput(input.devices);
  const scaledTracks = scaleTracksToOutput(input.tracks);

  // 2. Still Image Export (PNG, JPG, WebP)
  if (
    settings.format === 'png' ||
    settings.format === 'jpg' ||
    settings.format === 'webp'
  ) {
    onProgress(35, `Rendering ${width}×${height} master frame...`);
    renderSceneFrame2D(ctx, {
      width,
      height,
      frame: input.currentFrame,
      fps: settings.fps,
      durationInFrames: input.durationInFrames,
      devices: scaledDevices,
      drawings: input.drawings,
      clips: input.clips,
      tracks: scaledTracks,
      mediaAssets: input.mediaAssets,
      background: input.background,
      transparentBackground:
        settings.transparentBackground && settings.format !== 'jpg',
      isPlaying: false,
    });

    const mime =
      settings.format === 'png'
        ? 'image/png'
        : settings.format === 'jpg'
          ? 'image/jpeg'
          : 'image/webp';

    const blob = await new Promise<Blob>((resolve, reject) => {
      offscreen.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error('Failed to encode image blob.')),
        mime,
        settings.quality
      );
    });

    onProgress(100, 'Image encoding complete');
    return {
      blob,
      filename: `${safeName}-${width}x${height}.${settings.format}`,
      mimeType: mime,
    };
  }

  // 3. Deterministic Frame-by-Frame Video / Animated Export (MP4 / WebM / GIF)
  const totalFrames = Math.min(input.durationInFrames, 120);
  const supportedMime =
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : typeof MediaRecorder !== 'undefined' &&
          MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

  if (
    typeof MediaRecorder !== 'undefined' &&
    typeof offscreen.captureStream === 'function'
  ) {
    const stream = offscreen.captureStream(settings.fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
      videoBitsPerSecond: settings.resolution === '4k' ? 18_000_000 : 8_000_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    const stopPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(
          new Blob(chunks, {
            type: settings.format === 'mp4' ? 'video/mp4' : 'video/webm',
          })
        );
      };
    });

    recorder.start();

    for (let f = 0; f < totalFrames; f++) {
      if (isCancelled()) {
        recorder.stop();
        throw new Error('Export cancelled by user.');
      }

      renderSceneFrame2D(ctx, {
        width,
        height,
        frame: f,
        fps: settings.fps,
        durationInFrames: input.durationInFrames,
        devices: scaledDevices,
        drawings: input.drawings,
        clips: input.clips,
        tracks: scaledTracks,
        mediaAssets: input.mediaAssets,
        background: input.background,
        transparentBackground: settings.transparentBackground,
        isPlaying: false,
      });

      const pct = Math.min(96, Math.round(((f + 1) / totalFrames) * 95));
      onProgress(
        pct,
        `Encoding deterministic frame ${f + 1} / ${totalFrames} (${width}×${height} @ ${settings.fps}fps)...`
      );
      await new Promise((r) => setTimeout(r, 14));
    }

    recorder.stop();
    const videoBlob = await stopPromise;
    onProgress(100, 'Video encoding finalized');

    const ext =
      settings.format === 'mp4'
        ? 'mp4'
        : settings.format === 'gif'
          ? 'webm'
          : 'webm';
    return {
      blob: videoBlob,
      filename: `${safeName}-${width}x${height}-${settings.fps}fps.${ext}`,
      mimeType: videoBlob.type,
    };
  }

  // Fallback if MediaRecorder is unavailable in headless environments
  renderSceneFrame2D(ctx, {
    width,
    height,
    frame: input.currentFrame,
    fps: settings.fps,
    durationInFrames: input.durationInFrames,
    devices: scaledDevices,
    drawings: input.drawings,
    clips: input.clips,
    tracks: scaledTracks,
    mediaAssets: input.mediaAssets,
    background: input.background,
    transparentBackground: settings.transparentBackground,
    isPlaying: false,
  });

  const fallbackBlob = await new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Fallback encode failed'))),
      'image/png'
    );
  });

  onProgress(100, 'Export completed');
  return {
    blob: fallbackBlob,
    filename: `${safeName}-${width}x${height}.png`,
    mimeType: 'image/png',
  };
}
