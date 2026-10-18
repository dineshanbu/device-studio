import type { MediaAsset } from '../shared/types.ts';

export const BUILTIN_PROCEDURAL_MEDIA: MediaAsset[] = [
  {
    id: 'proc-fintech-mobile',
    name: 'Apex Ledger — Live Mobile Feed',
    type: 'procedural',
    url: 'procedural://fintech-mobile',
    proceduralKey: 'fintech-mobile',
    duration: 6,
    width: 720,
    height: 1560,
    aspectRatio: '9:19.5',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
  {
    id: 'proc-daw-desktop',
    name: 'Chronos NLE — Desktop Timeline Feed',
    type: 'procedural',
    url: 'procedural://daw-desktop',
    proceduralKey: 'daw-desktop',
    duration: 6,
    width: 1600,
    height: 1000,
    aspectRatio: '16:10',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
  {
    id: 'proc-code-terminal',
    name: 'Hyperion Compiler — Live Build Stream',
    type: 'procedural',
    url: 'procedural://code-terminal',
    proceduralKey: 'code-terminal',
    duration: 6,
    width: 1440,
    height: 900,
    aspectRatio: '16:10',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
  {
    id: 'proc-ecommerce-app',
    name: 'Atelier — Luxury Storefront UI',
    type: 'procedural',
    url: 'procedural://ecommerce-app',
    proceduralKey: 'ecommerce-app',
    duration: 6,
    width: 720,
    height: 1560,
    aspectRatio: '9:19.5',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
  {
    id: 'proc-weather-spatial',
    name: 'Helios Telemetry — Watch & Spatial Dial',
    type: 'procedural',
    url: 'procedural://weather-spatial',
    proceduralKey: 'weather-spatial',
    duration: 6,
    width: 600,
    height: 720,
    aspectRatio: '5:6',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
  {
    id: 'proc-webcam-presenter',
    name: 'Studio Presenter Camera — HD Live Feed',
    type: 'procedural',
    url: 'procedural://webcam-presenter',
    proceduralKey: 'webcam-presenter',
    duration: 6,
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    sizeBytes: 0,
    createdAt: 1729150000000,
  },
];

const proceduralCanvasCache = new Map<string, HTMLCanvasElement>();
const uploadedImageCache = new Map<string, HTMLImageElement>();
const uploadedVideoCache = new Map<string, HTMLVideoElement>();

/**
 * Releases cached DOM elements and revokes object URLs when assets are deleted.
 */
export function releaseMediaAssetResources(asset: MediaAsset): void {
  if (asset.url && asset.url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(asset.url);
    } catch {
      // ignore
    }
  }
  uploadedImageCache.delete(asset.id);
  const vid = uploadedVideoCache.get(asset.id);
  if (vid) {
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    uploadedVideoCache.delete(asset.id);
  }
}

/**
 * Renders deterministic frame-accurate procedural screen content into an HTMLCanvasElement.
 */
export function renderProceduralCanvas(
  key: NonNullable<MediaAsset['proceduralKey']>,
  frame: number,
  fps: number,
  width = 720,
  height = 1280
): HTMLCanvasElement {
  let canvas = proceduralCanvasCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    proceduralCanvasCache.set(key, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const t = (frame / Math.max(1, fps)) * 1.8;
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (key === 'fintech-mobile') {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#070B14');
    bg.addColorStop(1, '#0F172A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const pad = width * 0.07;
    const cardGrad = ctx.createLinearGradient(pad, pad * 1.4, width - pad, pad * 4.5);
    cardGrad.addColorStop(0, '#0284C7');
    cardGrad.addColorStop(0.5, '#2563EB');
    cardGrad.addColorStop(1, '#4F46E5');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(pad, pad * 1.5, width - pad * 2, height * 0.22, 24);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `600 ${Math.round(width * 0.032)}px Inter, sans-serif`;
    ctx.fillText('TOTAL PORTFOLIO BALANCE', pad * 1.5, pad * 2.3);

    const balance = 148920 + Math.sin(t) * 2450;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(width * 0.075)}px "JetBrains Mono", monospace`;
    ctx.fillText(
      `$${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}.40`,
      pad * 1.5,
      pad * 3.3
    );

    const chartTop = height * 0.44;
    const chartH = height * 0.2;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const px = pad + ((width - pad * 2) * i) / steps;
      const py =
        chartTop +
        chartH * 0.5 +
        Math.sin(i * 0.35 + t * 2) * (chartH * 0.32) +
        Math.cos(i * 0.2 - t) * (chartH * 0.14);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const rowStart = height * 0.7;
    const rows = [
      { name: 'NVDA · NVIDIA Corp', delta: '+4.82%', col: '#34D399' },
      { name: 'AAPL · Apple Silicon', delta: '+2.19%', col: '#38BDF8' },
      { name: 'ETH · Staking Yield', delta: '+6.40%', col: '#A855F7' },
    ];
    rows.forEach((r, idx) => {
      const ry = rowStart + idx * (height * 0.085);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
      ctx.beginPath();
      ctx.roundRect(pad, ry, width - pad * 2, height * 0.068, 16);
      ctx.fill();

      ctx.fillStyle = '#F1F5F9';
      ctx.font = `600 ${Math.round(width * 0.035)}px Inter, sans-serif`;
      ctx.fillText(r.name, pad * 1.4, ry + height * 0.042);

      ctx.fillStyle = r.col;
      ctx.font = `700 ${Math.round(width * 0.035)}px "JetBrains Mono", monospace`;
      ctx.fillText(r.delta, width - pad * 2.5, ry + height * 0.042);
    });
  } else if (key === 'daw-desktop') {
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    const sideW = width * 0.18;
    ctx.fillStyle = '#0F1523';
    ctx.fillRect(0, 0, sideW, height);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = `700 ${Math.round(height * 0.032)}px Inter, sans-serif`;
    ctx.fillText('CHRONOS NLE · MASTER SEQUENCE', sideW + 36, 56);

    const cardW = (width - sideW - 120) / 3;
    const metrics = [
      { label: 'FRAME RATE', val: '60.0 FPS', color: '#22D3EE' },
      { label: 'COLOR SPACE', val: 'Rec.2020 HDR', color: '#A855F7' },
      { label: 'RENDER ENGINE', val: 'WebGL2 PBR', color: '#34D399' },
    ];
    metrics.forEach((m, idx) => {
      const cx = sideW + 36 + idx * (cardW + 24);
      ctx.fillStyle = '#131C2E';
      ctx.beginPath();
      ctx.roundRect(cx, 84, cardW, height * 0.18, 16);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = `600 ${Math.round(height * 0.018)}px Inter, sans-serif`;
      ctx.fillText(m.label, cx + 22, 122);

      ctx.fillStyle = m.color;
      ctx.font = `700 ${Math.round(height * 0.038)}px "JetBrains Mono", monospace`;
      ctx.fillText(m.val, cx + 22, 178);
    });

    const chartX = sideW + 36;
    const chartY = height * 0.34;
    const chartW = width - sideW - 72;
    const chartH = height * 0.56;
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 18);
    ctx.fill();

    const barCount = 24;
    const barGap = 10;
    const barW = (chartW - 64 - barGap * (barCount - 1)) / barCount;
    for (let i = 0; i < barCount; i++) {
      const ratio =
        0.3 +
        0.55 *
          (0.5 +
            0.5 * Math.sin(i * 0.45 + t * 2.2) * Math.cos(i * 0.2 - t * 1.1));
      const bh = chartH * 0.72 * ratio;
      const bx = chartX + 32 + i * (barW + barGap);
      const by = chartY + chartH - 32 - bh;
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, '#22D3EE');
      g.addColorStop(1, '#6366F1');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, bh, 6);
      ctx.fill();
    }
  } else if (key === 'code-terminal') {
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(0, 0, width, height);
    const lines = [
      'import { createDeviceScene, renderOuterGlow } from "@device-studio/core";',
      'const studio = createDeviceScene({ resolution: [1920, 1080], fps: 60 });',
      'studio.applyTheme({ palette: "neon-cyan", finish: "brushed-metal" });',
      'studio.enablePerimeterGlow({ mode: "neon-sweep", radius: 48, falloff: "smooth" });',
      `// Frame #${frame} · Render pipeline active`,
    ];
    ctx.font = `500 ${Math.round(height * 0.026)}px "JetBrains Mono", monospace`;
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 4 ? '#34D399' : i % 2 === 0 ? '#38BDF8' : '#E2E8F0';
      ctx.fillText(line, 48, 96 + i * 48);
    });
  } else if (key === 'ecommerce-app') {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, '#090614');
    g.addColorStop(0.5, '#1E1B4B');
    g.addColorStop(1, '#0F172A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.42;
    for (let r = 1; r <= 3; r++) {
      const rad = Math.min(width, height) * (0.14 * r) + Math.sin(t * 2 + r) * 12;
      ctx.strokeStyle =
        r % 2 === 0 ? 'rgba(34, 211, 238, 0.65)' : 'rgba(236, 72, 153, 0.65)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(10, rad), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(width * 0.065)}px "Space Grotesk", sans-serif`;
    ctx.fillText('ATELIER STUDIO', cx, height * 0.72);
    ctx.textAlign = 'left';
  } else if (key === 'weather-spatial') {
    // weather-spatial
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const rad = Math.min(width, height) * 0.36;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * (1.2 + 0.3 * Math.sin(t)));
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(rad * 0.42)}px "Space Grotesk", sans-serif`;
    ctx.fillText(`${(21.4 + Math.sin(t) * 0.8).toFixed(1)}°C`, cx, cy - rad * 0.1);
    ctx.fillStyle = '#F97316';
    ctx.font = `600 ${Math.round(rad * 0.16)}px "JetBrains Mono", monospace`;
    ctx.fillText('ALT 1,420M · UV 03', cx, cy + rad * 0.22);
    ctx.textAlign = 'left';
  } else {
    // webcam-presenter
    // Studio Presenter Camera Feed with warm/cool studio bokeh lighting, presenter silhouette & voice meter
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0B1325');
    bgGrad.addColorStop(0.5, '#131D36');
    bgGrad.addColorStop(1, '#1E1433');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Studio background LED practical lights (bokeh circles)
    const bokehA = ctx.createRadialGradient(
      width * 0.22,
      height * 0.28,
      8,
      width * 0.22,
      height * 0.28,
      width * 0.28
    );
    bokehA.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
    bokehA.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = bokehA;
    ctx.fillRect(0, 0, width, height);

    const bokehB = ctx.createRadialGradient(
      width * 0.78,
      height * 0.32,
      8,
      width * 0.78,
      height * 0.32,
      width * 0.26
    );
    bokehB.addColorStop(0, 'rgba(168, 85, 247, 0.38)');
    bokehB.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = bokehB;
    ctx.fillRect(0, 0, width, height);

    // Subtle presenter motion (natural breathing + slight nod)
    const cx = width * 0.5 + Math.sin(t * 0.7) * (width * 0.014);
    const cy = height * 0.44 + Math.cos(t * 1.1) * (height * 0.01);
    const headR = Math.min(width, height) * 0.165;

    // Shoulders / studio hoodie silhouette
    const shoulderW = headR * 3.1;
    const shoulderH = headR * 2.1;
    const torsoGrad = ctx.createLinearGradient(
      cx - shoulderW / 2,
      cy + headR * 0.9,
      cx + shoulderW / 2,
      height
    );
    torsoGrad.addColorStop(0, '#1E293B');
    torsoGrad.addColorStop(0.5, '#334155');
    torsoGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy + headR * 2.15,
      shoulderW * 0.55,
      shoulderH * 0.75,
      0,
      Math.PI,
      Math.PI * 2
    );
    ctx.lineTo(cx + shoulderW * 0.55, height);
    ctx.lineTo(cx - shoulderW * 0.55, height);
    ctx.closePath();
    ctx.fill();

    // Cyan/Purple Studio Rim Light along shoulders
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = Math.max(2, headR * 0.055);
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 2.15, shoulderW * 0.54, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // Presenter Head & Studio Headphones
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(4, headR * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy - headR * 0.04, headR * 1.08, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Ear cups
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.roundRect(cx - headR * 1.16, cy - headR * 0.18, headR * 0.2, headR * 0.48, 8);
    ctx.roundRect(cx + headR * 0.96, cy - headR * 0.18, headR * 0.2, headR * 0.48, 8);
    ctx.fill();

    // Head portrait circle with warm studio key light
    const faceGrad = ctx.createRadialGradient(
      cx - headR * 0.25,
      cy - headR * 0.25,
      headR * 0.1,
      cx,
      cy,
      headR
    );
    faceGrad.addColorStop(0, '#FDBA74');
    faceGrad.addColorStop(0.7, '#EA580C');
    faceGrad.addColorStop(1, '#9A3412');
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle glasses / eyes & speaking mouth wave
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = Math.max(2, headR * 0.06);
    ctx.beginPath();
    ctx.roundRect(cx - headR * 0.52, cy - headR * 0.2, headR * 0.42, headR * 0.28, 6);
    ctx.roundRect(cx + headR * 0.1, cy - headR * 0.2, headR * 0.42, headR * 0.28, 6);
    ctx.moveTo(cx - headR * 0.1, cy - headR * 0.06);
    ctx.lineTo(cx + headR * 0.1, cy - headR * 0.06);
    ctx.stroke();

    // Animated speaking mouth / voice articulation
    const talkOpen = Math.max(2, Math.abs(Math.sin(t * 3.6)) * headR * 0.16);
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.ellipse(cx, cy + headR * 0.36, headR * 0.22, talkOpen, 0, 0, Math.PI * 2);
    ctx.fill();

    // Live CAM badge & Mic VU meter in top-left of camera feed
    const pad = Math.max(12, width * 0.035);
    ctx.fillStyle = 'rgba(7, 10, 16, 0.72)';
    ctx.beginPath();
    ctx.roundRect(pad, pad, width * 0.24, Math.max(22, height * 0.065), 8);
    ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(pad + 14, pad + Math.max(11, height * 0.0325), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `600 ${Math.max(10, Math.round(height * 0.026))}px "JetBrains Mono", monospace`;
    ctx.fillText('CAM 01 · 1080P', pad + 24, pad + Math.max(15, height * 0.042));
  }

  ctx.restore();
  return canvas;
}

/**
 * Retrieves a drawable CanvasImageSource (HTMLCanvasElement, HTMLImageElement, or HTMLVideoElement)
 * for a given MediaAsset at the current timeline frame.
 */
export function getMediaDrawableForAsset(
  asset: MediaAsset | undefined,
  frame: number,
  fps: number,
  isPlaying: boolean
): HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null {
  if (!asset || asset.missing) return null;

  if (asset.type === 'procedural' && asset.proceduralKey) {
    return renderProceduralCanvas(
      asset.proceduralKey,
      frame,
      fps,
      Math.min(800, asset.width),
      Math.min(1000, asset.height)
    );
  }

  if (asset.type === 'image') {
    let img = uploadedImageCache.get(asset.id);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = asset.url;
      uploadedImageCache.set(asset.id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  if (asset.type === 'video') {
    let video = uploadedVideoCache.get(asset.id);
    if (!video) {
      video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = asset.url;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      uploadedVideoCache.set(asset.id, video);
    }
    const targetTime =
      (frame / Math.max(1, fps)) % Math.max(0.1, asset.duration || 5);
    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
      if (
        Math.abs(video.currentTime - targetTime) > 0.08 &&
        video.readyState >= 2
      ) {
        try {
          video.currentTime = targetTime;
        } catch {
          // ignore seek race
        }
      }
    }
    return video.readyState >= 2 ? video : null;
  }

  return null;
}

/**
 * Inspects an uploaded File (video or image) and returns a rich MediaAsset with resolution, duration, and aspect ratio.
 */
export async function createMediaAssetFromFile(file: File): Promise<MediaAsset> {
  const isVideo =
    file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg|gif)$/i.test(file.name);

  if (!isVideo && !isImage) {
    throw new Error(
      `Unsupported file format "${file.name}". Please upload MP4, WebM, PNG, JPG, WebP, or SVG.`
    );
  }

  const objectUrl = URL.createObjectURL(file);

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  if (isVideo) {
    return new Promise<MediaAsset>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = objectUrl;

      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onerror = null;
      };

      video.onloadedmetadata = () => {
        cleanup();
        const w = video.videoWidth || 1920;
        const h = video.videoHeight || 1080;
        const divisor = gcd(w, h);
        const duration =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : 5;
        resolve({
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: 'video',
          url: objectUrl,
          duration: Number(duration.toFixed(2)),
          width: w,
          height: h,
          aspectRatio: `${Math.round(w / divisor)}:${Math.round(h / divisor)}`,
          sizeBytes: file.size,
          createdAt: Date.now(),
        });
      };

      video.onerror = () => {
        cleanup();
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Could not decode video file "${file.name}".`));
      };
    });
  }

  return new Promise<MediaAsset>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || 800;
      const divisor = gcd(w, h);
      resolve({
        id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: 'image',
        url: objectUrl,
        duration: 5,
        width: w,
        height: h,
        aspectRatio: `${Math.round(w / divisor)}:${Math.round(h / divisor)}`,
        sizeBytes: file.size,
        createdAt: Date.now(),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not decode image file "${file.name}".`));
    };
    img.src = objectUrl;
  });
}

// ============================================================================
// WEBRTC LIVE CAMERA STREAM & MEDIARECORDER ENGINE
// ============================================================================

let activeWebcamStream: MediaStream | null = null;
let activeWebcamVideoEl: HTMLVideoElement | null = null;
let activeMediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface LiveCameraStartOptions {
  deviceId?: string;
  resolution?: '720p' | '1080p' | '4k';
  fps?: 30 | 60;
}

/**
 * Lists available videoinput camera devices via navigator.mediaDevices.enumerateDevices().
 */
export async function listAvailableCameraDevices(): Promise<CameraDeviceInfo[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== 'function'
  ) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, idx) => ({
        deviceId: d.deviceId || `cam-${idx}`,
        label: d.label || `Camera ${idx + 1}`,
      }));
  } catch {
    return [];
  }
}

/**
 * Requests live camera access ONLY when explicitly triggered by the user.
 */
export async function startLiveWebcamStream(
  options: LiveCameraStartOptions = {}
): Promise<{
  ok: boolean;
  stream?: MediaStream;
  videoEl?: HTMLVideoElement;
  devices: CameraDeviceInfo[];
  errorMessage?: string;
}> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return {
      ok: false,
      devices: [],
      errorMessage:
        'MediaDevices API is not available in this browser environment. Using Studio Presenter Live Sim.',
    };
  }

  stopLiveWebcamStream();

  const resMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '4k': { width: 3840, height: 2160 },
  };
  const targetRes = resMap[options.resolution || '1080p'];
  const targetFps = options.fps || 30;

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
        width: { ideal: targetRes.width },
        height: { ideal: targetRes.height },
        frameRate: { ideal: targetFps },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeWebcamStream = stream;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    await video.play().catch(() => {});
    activeWebcamVideoEl = video;

    const devices = await listAvailableCameraDevices();
    return {
      ok: true,
      stream,
      videoEl: video,
      devices,
    };
  } catch (err) {
    const e = err as Error;
    const isDenied =
      e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError';
    const isNotFound =
      e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError';
    return {
      ok: false,
      devices: await listAvailableCameraDevices(),
      errorMessage: isDenied
        ? 'Camera permission was denied. Grant browser camera access or use the Studio Presenter feed.'
        : isNotFound
          ? 'No physical webcam device was detected. Using Studio Presenter camera simulation.'
          : `Camera unavailable (${e.message || 'stream error'}). Using Studio Presenter feed.`,
    };
  }
}

/**
 * Releases the active live webcam MediaStream and stops all camera hardware tracks.
 */
export function stopLiveWebcamStream(): void {
  if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
    try {
      activeMediaRecorder.stop();
    } catch {
      // ignore
    }
  }
  activeMediaRecorder = null;
  if (activeWebcamStream) {
    for (const track of activeWebcamStream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    activeWebcamStream = null;
  }
  if (activeWebcamVideoEl) {
    activeWebcamVideoEl.pause();
    activeWebcamVideoEl.srcObject = null;
    activeWebcamVideoEl = null;
  }
}

/**
 * Returns the live HTMLVideoElement if a physical webcam stream is currently active and ready.
 */
export function getLiveWebcamDrawable(): HTMLVideoElement | null {
  if (
    activeWebcamVideoEl &&
    activeWebcamStream &&
    activeWebcamStream.active &&
    activeWebcamVideoEl.readyState >= 2
  ) {
    return activeWebcamVideoEl;
  }
  return null;
}

/**
 * Captures a still PNG snapshot from the active live webcam (or procedural presenter feed fallback)
 * and returns a ready-to-use MediaAsset.
 */
export function captureWebcamStillAsset(
  frame = 0,
  fps = 30
): MediaAsset {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const liveVideo = getLiveWebcamDrawable();
  if (ctx) {
    if (liveVideo) {
      ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);
    } else {
      const proc = renderProceduralCanvas(
        'webcam-presenter',
        frame,
        fps,
        1280,
        720
      );
      ctx.drawImage(proc, 0, 0, canvas.width, canvas.height);
    }
  }
  const dataUrl = canvas.toDataURL('image/png');
  return {
    id: `webcam-snap-${Date.now().toString(36)}`,
    name: `Webcam Snapshot (${new Date().toLocaleTimeString([], { hour12: false })})`,
    type: 'image',
    url: dataUrl,
    duration: 6,
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    sizeBytes: Math.round(dataUrl.length * 0.75),
    createdAt: Date.now(),
  };
}

/**
 * Starts or stops recording a webcam video clip using MediaRecorder (from live camera stream or
 * real-time presenter canvas stream so recording works in both physical camera and studio sim modes).
 */
export function startWebcamClipRecording(
  fps = 30
): { ok: boolean; error?: string } {
  try {
    let streamToRecord: MediaStream | null = activeWebcamStream;
    if (!streamToRecord || !streamToRecord.active) {
      const procCanvas = renderProceduralCanvas(
        'webcam-presenter',
        0,
        fps,
        1280,
        720
      );
      if (typeof procCanvas.captureStream === 'function') {
        streamToRecord = procCanvas.captureStream(fps);
      }
    }
    if (!streamToRecord || typeof MediaRecorder === 'undefined') {
      return {
        ok: false,
        error: 'MediaRecorder is not supported in this browser.',
      };
    }

    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

    activeMediaRecorder = mimeType
      ? new MediaRecorder(streamToRecord, { mimeType })
      : new MediaRecorder(streamToRecord);

    activeMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    activeMediaRecorder.start(100);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message || 'Could not start webcam recording.',
    };
  }
}

export async function stopWebcamClipRecording(
  durationSeconds = 4
): Promise<MediaAsset> {
  return new Promise<MediaAsset>((resolve) => {
    const finalize = () => {
      if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        recordedChunks = [];
        resolve({
          id: `webcam-rec-${Date.now().toString(36)}`,
          name: `Webcam Recording (${durationSeconds.toFixed(1)}s)`,
          type: 'video',
          url,
          duration: Math.max(2, Number(durationSeconds.toFixed(2))),
          width: 1280,
          height: 720,
          aspectRatio: '16:9',
          sizeBytes: blob.size || 240_000,
          createdAt: Date.now(),
        });
      } else {
        // Fallback procedural recording asset if stream produced 0 bytes in headless mode
        resolve({
          id: `webcam-rec-${Date.now().toString(36)}`,
          name: `Webcam Recording (${durationSeconds.toFixed(1)}s)`,
          type: 'procedural',
          url: 'procedural://webcam-presenter',
          proceduralKey: 'webcam-presenter',
          duration: Math.max(2, Number(durationSeconds.toFixed(2))),
          width: 1280,
          height: 720,
          aspectRatio: '16:9',
          sizeBytes: 320_000,
          createdAt: Date.now(),
        });
      }
    };

    if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
      activeMediaRecorder.onstop = finalize;
      try {
        activeMediaRecorder.stop();
      } catch {
        finalize();
      }
    } else {
      finalize();
    }
  });
}

