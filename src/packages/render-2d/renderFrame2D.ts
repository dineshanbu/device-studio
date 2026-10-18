import {
  DEFAULT_BROWSER_THEME,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import { getMediaDrawableForAsset } from '../media/proceduralMedia.ts';
import {
  computeDrawingPathLength,
  computeScreenMediaRect,
  evaluateAnimatedGlowState,
  evaluateEasing,
  hexToHsl,
  hslToHex,
  resolveActiveClipForMediaAtFrame,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
} from '../scene-engine/math.ts';
import type {
  MediaAsset,
  SceneBackground,
  SceneDeviceObject,
  SceneDrawingObject,
  TimelineClip,
  TimelineTrack,
} from '../shared/types.ts';

export interface RenderFrame2DOptions {
  width: number;
  height: number;
  frame: number;
  fps: number;
  durationInFrames: number;
  devices: SceneDeviceObject[];
  drawings?: SceneDrawingObject[];
  clips?: TimelineClip[];
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  background: SceneBackground;
  transparentBackground?: boolean;
  isPlaying?: boolean;
}

/**
 * Traces the outer silhouette path of a device onto the current canvas context.
 */
function traceDeviceSilhouettePath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  outerR: number,
  spread = 0
): void {
  const halfW = w / 2 + spread;
  const halfH = h / 2 + spread;
  const fullW = w + spread * 2;
  const fullH = h + spread * 2;
  const r = Math.max(0, Math.min(outerR + spread, Math.min(fullW, fullH) / 2));
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfH, fullW, fullH, r);
}

/**
 * Renders a realistic, full-perimeter silhouette outer glow around all 4 sides and rounded corners
 * of a device using layered falloff passes and optional travelling perimeter neon sweep.
 */
function renderFullPerimeterDeviceGlow(
  ctx: CanvasRenderingContext2D,
  dev: SceneDeviceObject,
  w: number,
  h: number,
  outerR: number,
  frame: number,
  fps: number
): void {
  if (!dev.effects.glowEnabled) return;

  const glow = evaluateAnimatedGlowState(dev.effects, frame, fps);
  const falloff = dev.effects.glowFalloff || 'smooth';

  ctx.save();

  // Compute angled gradient across the entire device perimeter
  const diag = Math.hypot(w, h) * 0.65;
  const gx0 = Math.cos(glow.angleRad) * -diag;
  const gy0 = Math.sin(glow.angleRad) * -diag;
  const gx1 = Math.cos(glow.angleRad) * diag;
  const gy1 = Math.sin(glow.angleRad) * diag;

  const perimGrad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  perimGrad.addColorStop(0, glow.primaryColor);
  perimGrad.addColorStop(0.5, glow.secondaryColor);
  perimGrad.addColorStop(1, glow.primaryColor);

  // Multi-layer full-perimeter distance falloff passes (ambient wide halo -> mid bloom -> tight core rim)
  const layerConfigs =
    falloff === 'sharp'
      ? [
          { blurMul: 0.85, spreadMul: 0.7, alphaMul: 0.55, strokeW: 10 },
          { blurMul: 0.35, spreadMul: 0.25, alphaMul: 0.9, strokeW: 5 },
        ]
      : falloff === 'neon'
        ? [
            { blurMul: 1.45, spreadMul: 1.0, alphaMul: 0.45, strokeW: 18 },
            { blurMul: 0.75, spreadMul: 0.45, alphaMul: 0.75, strokeW: 10 },
            { blurMul: 0.22, spreadMul: 0.1, alphaMul: 0.98, strokeW: 4 },
          ]
        : [
            { blurMul: 1.35, spreadMul: 0.9, alphaMul: 0.38, strokeW: 16 },
            { blurMul: 0.75, spreadMul: 0.45, alphaMul: 0.62, strokeW: 10 },
            { blurMul: 0.35, spreadMul: 0.15, alphaMul: 0.85, strokeW: 5 },
          ];

  for (let i = 0; i < layerConfigs.length; i++) {
    const layer = layerConfigs[i];
    const passColor = i % 2 === 0 ? glow.primaryColor : glow.secondaryColor;
    const passBlur = Math.max(2, glow.blurRadius * layer.blurMul);
    const passSpread = glow.spread * layer.spreadMul;
    const passAlpha = Math.min(
      1,
      dev.opacity * glow.opacity * glow.intensity * layer.alphaMul
    );

    if (passAlpha <= 0.01) continue;

    ctx.save();
    ctx.globalAlpha = passAlpha;
    ctx.shadowColor = passColor;
    ctx.shadowBlur = passBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = perimGrad;
    ctx.lineWidth = layer.strokeW + passSpread * 0.5;
    traceDeviceSilhouettePath(ctx, w, h, outerR, passSpread * 0.35);
    ctx.stroke();

    // Fill silhouette softly on outer pass so all 4 sides radiate evenly
    if (i === 0) {
      ctx.fillStyle = passColor;
      ctx.fill();
    }
    ctx.restore();
  }

  // Travelling perimeter highlight / neon border sweep
  const mode = dev.effects.glowAnimationMode || 'none';
  if (mode === 'perimeter-sweep' || mode === 'neon-sweep') {
    const approxPerim = 2 * (w + h);
    const segLen = approxPerim * 0.28;
    const gapLen = approxPerim - segLen;
    ctx.save();
    ctx.globalAlpha = Math.min(1, dev.opacity * glow.opacity * 0.98);
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = glow.secondaryColor;
    ctx.shadowBlur = Math.max(14, glow.blurRadius * 0.55);
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([segLen, gapLen]);
    ctx.lineDashOffset = -glow.highlightProgress * approxPerim;
    traceDeviceSilhouettePath(ctx, w, h, outerR, 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders a single vector/freehand SceneDrawingObject with multi-layer neon glow and path animation.
 */
function renderDrawingObject2D(
  ctx: CanvasRenderingContext2D,
  drawing: SceneDrawingObject,
  frame: number,
  fps: number
): void {
  if (!drawing.visible || drawing.opacity <= 0.01) return;

  const clipStart = Math.max(0, drawing.startFrame ?? 0);
  const localFrame = Math.max(0, frame - clipStart);
  const speed = Math.max(0.1, drawing.animationSpeed || 1);
  const t = (localFrame / Math.max(1, fps)) * speed;
  const animDur = Math.max(
    12,
    Math.round((drawing.animationDurationFrames || 60) / speed)
  );

  // For 'draw-on', default to one-shot draw-on unless animationLoop is explicitly true
  const shouldLoopReveal =
    drawing.animationMode === 'stroke-reveal' || Boolean(drawing.animationLoop);
  const rawProgress = shouldLoopReveal
    ? (localFrame % animDur) / animDur
    : Math.min(1, localFrame / animDur);
  const easedProgress = evaluateEasing(
    rawProgress,
    drawing.animationEasing || 'ease-in-out'
  );

  ctx.save();
  ctx.translate(drawing.x, drawing.y);
  ctx.rotate((drawing.rotation * Math.PI) / 180);
  ctx.scale(drawing.scaleX, drawing.scaleY);

  let effectiveOpacity = drawing.opacity;
  if (drawing.animationMode === 'pulsing-outline') {
    effectiveOpacity *= 0.58 + 0.42 * Math.sin(t * 4.5);
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, effectiveOpacity));

  const halfW = drawing.width / 2;
  const halfH = drawing.height / 2;

  const buildPath = () => {
    ctx.beginPath();
    if (
      (drawing.tool === 'brush' ||
        drawing.tool === 'pen' ||
        drawing.tool === 'bezier') &&
      drawing.points.length >= 2
    ) {
      const pts = drawing.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      if (drawing.tool === 'bezier' && pts.length >= 3) {
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
    } else if (drawing.tool === 'line' || drawing.tool === 'arrow') {
      const p0 = drawing.points[0] || { x: -halfW, y: halfH };
      const p1 = drawing.points[1] || { x: halfW, y: -halfH };
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      if (drawing.tool === 'arrow') {
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const headLen = Math.max(14, drawing.strokeWidth * 3.2);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(
          p1.x - headLen * Math.cos(angle - Math.PI / 6),
          p1.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(
          p1.x - headLen * Math.cos(angle + Math.PI / 6),
          p1.y - headLen * Math.sin(angle + Math.PI / 6)
        );
      }
    } else if (drawing.tool === 'rect') {
      ctx.rect(-halfW, -halfH, drawing.width, drawing.height);
    } else if (drawing.tool === 'rounded-rect') {
      ctx.roundRect(
        -halfW,
        -halfH,
        drawing.width,
        drawing.height,
        Math.max(0, drawing.cornerRadius || 24)
      );
    } else if (drawing.tool === 'ellipse' || drawing.tool === 'circle') {
      ctx.ellipse(0, 0, Math.max(4, halfW), Math.max(4, halfH), 0, 0, Math.PI * 2);
    } else if (drawing.tool === 'polygon') {
      const sides = Math.max(3, Math.min(12, drawing.polygonSides || 6));
      const rx = Math.max(8, halfW);
      const ry = Math.max(8, halfH);
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  };

  // Optional colour-shift animation cycling
  let activeStrokeColor = drawing.strokeColor || '#22D3EE';
  let activeGlowColor = drawing.glowColor || drawing.strokeColor || '#22D3EE';
  if (drawing.animationMode === 'color-shift') {
    const baseHsl = hexToHsl(activeStrokeColor);
    const shiftedHue = Math.round((baseHsl.h + t * 90) % 360);
    activeStrokeColor = hslToHex(
      shiftedHue,
      Math.max(75, baseHsl.s),
      Math.max(55, baseHsl.l)
    );
    activeGlowColor = activeStrokeColor;
  }

  // Gradient or solid stroke style
  let strokeStyle: string | CanvasGradient = activeStrokeColor;
  if (drawing.useGradientStroke) {
    const grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    grad.addColorStop(0, activeStrokeColor);
    grad.addColorStop(1, drawing.strokeColorEnd || '#A855F7');
    strokeStyle = grad;
  }

  ctx.lineCap = drawing.lineCap || 'round';
  ctx.lineJoin = drawing.lineJoin || 'round';

  // Compute exact path length for draw-on / stroke-reveal / neon-trace / moving-light
  const approxLen = computeDrawingPathLength(drawing);
  const isDrawOnReveal =
    drawing.animationMode === 'draw-on' ||
    drawing.animationMode === 'stroke-reveal' ||
    drawing.entranceAnimation === 'draw-on';

  if (isDrawOnReveal) {
    const visibleLen = Math.max(2, approxLen * easedProgress);
    ctx.setLineDash([visibleLen, approxLen * 2]);
    ctx.lineDashOffset = 0;
  } else if (drawing.dashPattern === 'dashed') {
    ctx.setLineDash([drawing.strokeWidth * 3, drawing.strokeWidth * 2]);
  } else if (drawing.dashPattern === 'dotted') {
    ctx.setLineDash([drawing.strokeWidth, drawing.strokeWidth * 2]);
  } else if (drawing.dashPattern === 'long-dash') {
    ctx.setLineDash([drawing.strokeWidth * 6, drawing.strokeWidth * 2.5]);
  } else {
    ctx.setLineDash([]);
  }

  // Optional shape fill
  if (
    drawing.fillOpacity > 0.01 &&
    (drawing.tool === 'rect' ||
      drawing.tool === 'rounded-rect' ||
      drawing.tool === 'circle' ||
      drawing.tool === 'ellipse' ||
      drawing.tool === 'polygon')
  ) {
    ctx.save();
    ctx.globalAlpha = effectiveOpacity * drawing.fillOpacity;
    ctx.fillStyle = drawing.fillColor || activeStrokeColor;
    buildPath();
    ctx.fill();
    ctx.restore();
  }

  // Drop shadow pass
  if (drawing.shadowEnabled) {
    ctx.save();
    ctx.shadowColor = drawing.shadowColor || 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = drawing.shadowBlur ?? 18;
    ctx.shadowOffsetY = 8;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = drawing.strokeWidth;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  // Multi-layer Outer Neon Glow Passes
  if (drawing.glowEnabled) {
    const gColor = activeGlowColor;
    const gRadius = Math.max(4, drawing.glowRadius || 28);
    const gIntensity = Math.max(0.1, drawing.glowIntensity ?? 0.9);
    const gOpacity = Math.max(0.05, Math.min(1, drawing.glowOpacity ?? 1));
    const spread = Math.max(0, drawing.glowSpread ?? 6);

    const passes = [
      { blur: gRadius * 1.35, width: drawing.strokeWidth + spread * 1.4, alpha: 0.42 * gIntensity * gOpacity },
      { blur: gRadius * 0.65, width: drawing.strokeWidth + spread * 0.6, alpha: 0.78 * gIntensity * gOpacity },
    ];
    for (const p of passes) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, effectiveOpacity * p.alpha);
      ctx.shadowColor = gColor;
      ctx.shadowBlur = p.blur;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = p.width;
      buildPath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Crisp core vector stroke
  ctx.save();
  ctx.globalAlpha = effectiveOpacity * (drawing.strokeOpacity ?? 1);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = drawing.strokeWidth;
  buildPath();
  ctx.stroke();
  ctx.restore();

  // Leading neon spark at the drawing tip during active Draw-On / Stroke-Reveal
  if (isDrawOnReveal && easedProgress > 0.02 && easedProgress < 0.98) {
    const visibleLen = Math.max(2, approxLen * easedProgress);
    const tipLen = Math.max(8, Math.min(28, approxLen * 0.08));
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = activeGlowColor;
    ctx.shadowBlur = Math.max(14, (drawing.glowRadius || 24) * 0.75);
    ctx.lineWidth = Math.max(3, drawing.strokeWidth * 1.15);
    ctx.setLineDash([tipLen, approxLen * 2]);
    ctx.lineDashOffset = -Math.max(0, visibleLen - tipLen);
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  // Animated travelling light pulse / neon trace highlight along the path
  if (
    drawing.animationMode === 'moving-light' ||
    drawing.animationMode === 'neon-trace'
  ) {
    const pulseLen = Math.max(24, approxLen * 0.22);
    const gap = Math.max(12, approxLen - pulseLen);
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = activeGlowColor;
    ctx.shadowBlur = Math.max(12, (drawing.glowRadius || 24) * 0.6);
    ctx.lineWidth = Math.max(2.5, drawing.strokeWidth * 0.85);
    ctx.setLineDash([pulseLen, gap]);
    ctx.lineDashOffset = -((t * 0.55) % 1) * approxLen;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders a complete deterministic 2D scene frame onto any CanvasRenderingContext2D.
 * Used by both the live interactive 2D Canvas Editor and the frame-by-frame Export Engine.
 */
export function renderSceneFrame2D(
  ctx: CanvasRenderingContext2D,
  opts: RenderFrame2DOptions
): void {
  const {
    width,
    height,
    frame,
    fps,
    durationInFrames,
    devices,
    drawings = [],
    clips = [],
    tracks,
    mediaAssets,
    background,
    transparentBackground = false,
    isPlaying = false,
  } = opts;

  const t = frame / Math.max(1, fps);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Background Studio Rendering
  if (!transparentBackground) {
    if (background.type === 'solid') {
      ctx.fillStyle = background.solidColor;
      ctx.fillRect(0, 0, width, height);
    } else if (background.type === 'media' && background.mediaId) {
      const bgAsset = mediaAssets.find((m) => m.id === background.mediaId);
      const drawable = getMediaDrawableForAsset(bgAsset, frame, fps, isPlaying);
      if (drawable) {
        ctx.drawImage(drawable, 0, 0, width, height);
      } else {
        ctx.fillStyle = background.solidColor || '#0B0F17';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      const rad = ((background.gradientAngle || 135) * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const len = Math.hypot(width, height) / 2;
      const x0 = cx - Math.cos(rad) * len;
      const y0 = cy - Math.sin(rad) * len;
      const x1 = cx + Math.cos(rad) * len;
      const y1 = cy + Math.sin(rad) * len;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, background.gradientStart || '#0B0F17');
      grad.addColorStop(1, background.gradientEnd || '#1E293B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Optional studio grid overlay
    if (background.gridOverlay) {
      ctx.save();
      ctx.strokeStyle =
        background.solidColor === '#F1F5F9'
          ? 'rgba(15, 23, 42, 0.06)'
          : 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      const step = 60;
      for (let gx = 0; gx <= width; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy <= height; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Optional deterministic ambient particles
    if (background.ambientParticles) {
      ctx.save();
      const count = Math.min(80, Math.max(8, background.particleDensity || 28));
      for (let i = 0; i < count; i++) {
        const seed = i * 97.31;
        const px =
          (((seed * 37.7 + t * (12 + (i % 7) * 3)) % width) + width) % width;
        const py =
          (((seed * 73.1 - t * (16 + (i % 5) * 4)) % height) + height) % height;
        const radius = 1.5 + (i % 4) * 1.1;
        const alpha = 0.14 + 0.18 * Math.sin(t * 2 + i);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // Vignette
    if (background.vignetteIntensity > 0.02) {
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(
        1,
        `rgba(0,0,0,${Math.min(0.85, background.vignetteIntensity)})`
      );
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. Render Devices sorted by zIndex
  const sortedDevices = [...devices]
    .filter((d) => d.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const rawDevice of sortedDevices) {
    const track = tracks.find((tr) => tr.targetId === rawDevice.id);
    if (track && track.visible === false) continue;

    const dev = resolveDeviceAtFrame(
      rawDevice,
      track ? track.keyframes : [],
      frame,
      durationInFrames
    );
    const preset = getDevicePresetById(dev.presetId);
    const mediaAsset = mediaAssets.find((m) => m.id === dev.mediaId);

    ctx.save();
    ctx.translate(dev.x, dev.y);
    ctx.rotate((dev.rotation * Math.PI) / 180);
    const tiltScaleX = Math.max(
      0.55,
      Math.cos(((dev.rotation3DY || 0) * Math.PI) / 180) * 0.15 + 0.85
    );
    ctx.scale(dev.scaleX * tiltScaleX, dev.scaleY);
    ctx.globalAlpha = Math.max(0, Math.min(1, dev.opacity));

    if (dev.effects.blur > 0) {
      ctx.filter = `blur(${dev.effects.blur}px)`;
    }

    const w = dev.width;
    const h = dev.height;
    const halfW = w / 2;
    const halfH = h / 2;
    const outerR = dev.customOuterRadius ?? preset.outerRadius;
    const frameColor = dev.customFrameColor || preset.frameColor;
    const secondaryFrameColor =
      dev.customFrameSecondaryColor || preset.frameAccentColor;
    const buttonColor = dev.customButtonColor || secondaryFrameColor;
    const bezelColor = dev.customBezelColor || '#070A10';
    const finishStyle = dev.finishStyle || 'brushed';
    const browserTheme = {
      ...DEFAULT_BROWSER_THEME,
      ...(dev.browserTheme || {}),
    };

    const renderShadowPass = () => {
      if (!dev.effects.shadowEnabled) return;
      ctx.save();
      ctx.globalAlpha =
        dev.opacity * Math.max(0.05, Math.min(1, dev.effects.shadowOpacity ?? 0.65));
      ctx.shadowColor = dev.effects.shadowColor || '#000000';
      ctx.shadowBlur = dev.effects.shadowBlur ?? 40;
      ctx.shadowOffsetX = dev.effects.shadowOffsetX ?? 0;
      ctx.shadowOffsetY = dev.effects.shadowOffsetY ?? 22;
      ctx.fillStyle = frameColor;
      traceDeviceSilhouettePath(ctx, w, h, outerR, 0);
      ctx.fill();
      ctx.restore();
    };

    // 2A & 2B: Respect configurable Effect Stack Order (Shadow -> Glow -> Frame OR Glow -> Shadow -> Frame)
    if (dev.effects.effectStackOrder === 'glow-shadow-frame') {
      renderFullPerimeterDeviceGlow(ctx, dev, w, h, outerR, frame, fps);
      renderShadowPass();
    } else {
      renderShadowPass();
      renderFullPerimeterDeviceGlow(ctx, dev, w, h, outerR, frame, fps);
    }

    // 2C. Auxiliary Hardware (Watch bands, Monitor stand, Laptop base)
    if (preset.hasWatchBand) {
      ctx.save();
      ctx.fillStyle = buttonColor || '#EA580C';
      ctx.beginPath();
      ctx.roundRect(-w * 0.32, -halfH - 58, w * 0.64, 68, 16);
      ctx.roundRect(-w * 0.32, halfH - 10, w * 0.64, 68, 16);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let rb = -halfH - 46; rb < -halfH - 12; rb += 12) {
        ctx.fillRect(-w * 0.28, rb, w * 0.56, 5);
      }
      for (let rb = halfH + 6; rb < halfH + 46; rb += 12) {
        ctx.fillRect(-w * 0.28, rb, w * 0.56, 5);
      }
      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.roundRect(halfW - 2, -halfH * 0.45, 12, 42, 5);
      ctx.fill();
      ctx.fillStyle = buttonColor || '#EA580C';
      ctx.beginPath();
      ctx.roundRect(-halfW - 8, -halfH * 0.15, 8, 34, 4);
      ctx.fill();
      ctx.restore();
    }

    if (preset.hasMonitorStand) {
      ctx.save();
      const standGrad = ctx.createLinearGradient(-45, halfH, 45, halfH + 90);
      standGrad.addColorStop(0, secondaryFrameColor);
      standGrad.addColorStop(0.5, frameColor);
      standGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = standGrad;
      ctx.beginPath();
      ctx.moveTo(-36, halfH - 4);
      ctx.lineTo(36, halfH - 4);
      ctx.lineTo(52, halfH + 86);
      ctx.lineTo(-52, halfH + 86);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = secondaryFrameColor;
      ctx.beginPath();
      ctx.roundRect(-130, halfH + 82, 260, 14, 6);
      ctx.fill();
      ctx.restore();
    }

    if (preset.hasKeyboardBase) {
      ctx.save();
      const baseW = w * 1.12;
      const baseH = 26;
      const baseGrad = ctx.createLinearGradient(-baseW / 2, halfH, baseW / 2, halfH);
      baseGrad.addColorStop(0, frameColor);
      baseGrad.addColorStop(0.2, secondaryFrameColor);
      baseGrad.addColorStop(0.5, buttonColor);
      baseGrad.addColorStop(0.8, secondaryFrameColor);
      baseGrad.addColorStop(1, frameColor);
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.roundRect(-baseW / 2, halfH - 6, baseW, baseH, [4, 4, 16, 16]);
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-48, halfH - 6, 96, 9, [0, 0, 8, 8]);
      ctx.fill();
      ctx.restore();
    }

    // 2D. Device Outer Frame Chassis with Finish Style (Matte, Brushed, Polished, Glass, Metallic Gradient)
    const chassisGrad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    if (preset.category === 'browser') {
      chassisGrad.addColorStop(0, browserTheme.windowBgColor || frameColor);
      chassisGrad.addColorStop(1, browserTheme.windowBgColor || frameColor);
    } else if (finishStyle === 'matte') {
      chassisGrad.addColorStop(0, frameColor);
      chassisGrad.addColorStop(1, frameColor);
    } else if (finishStyle === 'polished') {
      chassisGrad.addColorStop(0, secondaryFrameColor);
      chassisGrad.addColorStop(0.28, frameColor);
      chassisGrad.addColorStop(0.5, '#FFFFFF');
      chassisGrad.addColorStop(0.72, frameColor);
      chassisGrad.addColorStop(1, '#090D16');
    } else if (finishStyle === 'glass') {
      chassisGrad.addColorStop(0, secondaryFrameColor);
      chassisGrad.addColorStop(0.5, frameColor);
      chassisGrad.addColorStop(1, secondaryFrameColor);
    } else if (finishStyle === 'metallic-gradient') {
      chassisGrad.addColorStop(0, secondaryFrameColor);
      chassisGrad.addColorStop(0.45, frameColor);
      chassisGrad.addColorStop(1, buttonColor);
    } else {
      // Brushed metal default
      chassisGrad.addColorStop(0, secondaryFrameColor);
      chassisGrad.addColorStop(0.5, frameColor);
      chassisGrad.addColorStop(1, '#090D16');
    }

    ctx.fillStyle = chassisGrad;
    traceDeviceSilhouettePath(ctx, w, h, outerR, 0);
    ctx.fill();

    // Inner Bezel Lip (when customized)
    if (preset.category !== 'browser' && bezelColor) {
      ctx.save();
      ctx.fillStyle = bezelColor;
      ctx.beginPath();
      ctx.roundRect(
        -halfW + 4,
        -halfH + 4,
        w - 8,
        h - 8,
        Math.max(4, outerR - 4)
      );
      ctx.fill();
      ctx.restore();
    }

    // Metallic rim border
    if (dev.effects.borderWidth > 0) {
      ctx.strokeStyle =
        preset.category === 'browser'
          ? browserTheme.websiteBorderColor || dev.effects.borderColor
          : dev.effects.borderColor || secondaryFrameColor;
      ctx.lineWidth = dev.effects.borderWidth;
      traceDeviceSilhouettePath(ctx, w, h, outerR, 0);
      ctx.stroke();
    }

    // Physical side buttons for phones & tablets
    if (
      preset.category === 'iphone' ||
      preset.category === 'android' ||
      preset.category === 'tablet'
    ) {
      ctx.fillStyle = buttonColor;
      ctx.fillRect(-halfW - 3.5, -halfH + 120, 3.5, 44);
      ctx.fillRect(-halfW - 3.5, -halfH + 176, 3.5, 44);
      ctx.fillRect(halfW, -halfH + 145, 3.5, 64);
    }

    // Handheld gaming controls (Steam Deck OLED)
    if (preset.hasGamepadControls) {
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-halfW + 68, -halfH + 115, 24, 0, Math.PI * 2);
      ctx.arc(halfW - 68, -halfH + 115, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = buttonColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      const abxy = [
        { dx: 0, dy: -18 },
        { dx: 18, dy: 0 },
        { dx: 0, dy: 18 },
        { dx: -18, dy: 0 },
      ];
      abxy.forEach((btn) => {
        ctx.fillStyle = buttonColor;
        ctx.beginPath();
        ctx.arc(halfW - 68 + btn.dx, -halfH + 190 + btn.dy, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 2E. Inner Screen Area & Clipped Media Content
    const screenX = -halfW + preset.bezelLeft;
    const screenY = -halfH + preset.bezelTop;
    const screenW = w - preset.bezelLeft - preset.bezelRight;
    const screenH = h - preset.bezelTop - preset.bezelBottom;
    const screenR = preset.screenRadius;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, screenR);
    ctx.clip();

    // Base screen backing (uses websiteBgColor for browsers or customScreenBgColor)
    ctx.fillStyle =
      preset.category === 'browser'
        ? browserTheme.websiteBgColor || '#090D16'
        : dev.customScreenBgColor || '#070A10';
    ctx.fillRect(screenX, screenY, screenW, screenH);

    // Evaluate active timeline clip (supports split clips, trimmed in/out points, and cut gaps)
    const clipEval = resolveActiveClipForMediaAtFrame(
      clips,
      dev.mediaId,
      frame
    );
    const clipActive = !clipEval.hasClipsForMedia || Boolean(clipEval.activeClip);
    const mediaFrame = clipEval.hasClipsForMedia
      ? clipEval.sourceFrame
      : frame;

    const drawable = clipActive
      ? getMediaDrawableForAsset(mediaAsset, mediaFrame, fps, isPlaying)
      : null;

    if (drawable && mediaAsset) {
      const fitRect = computeScreenMediaRect(
        screenW,
        screenH,
        mediaAsset.width,
        mediaAsset.height,
        dev.screenTransform
      );
      ctx.drawImage(
        drawable,
        fitRect.sx,
        fitRect.sy,
        fitRect.sw,
        fitRect.sh,
        screenX + fitRect.dx,
        screenY + fitRect.dy,
        fitRect.dw,
        fitRect.dh
      );
    }

    // Browser Website Accent Top Progress Bar inside screen
    if (preset.category === 'browser') {
      ctx.fillStyle = browserTheme.websiteAccentColor || '#38BDF8';
      ctx.fillRect(screenX, screenY, screenW, 3);
    }

    // Optional Inner Glow inside the device screen edge
    if (dev.effects.innerGlowEnabled) {
      ctx.save();
      ctx.strokeStyle = dev.effects.innerGlowColor || dev.effects.glowColor || '#38BDF8';
      ctx.shadowColor = dev.effects.innerGlowColor || dev.effects.glowColor || '#38BDF8';
      ctx.shadowBlur = dev.effects.innerGlowBlur ?? 18;
      ctx.globalAlpha = Math.min(1, dev.effects.innerGlowIntensity ?? 0.5);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(screenX, screenY, screenW, screenH, screenR);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle diagonal glass specular reflection over screen
    const glassSheen = ctx.createLinearGradient(
      screenX,
      screenY,
      screenX + screenW * 0.65,
      screenY + screenH * 0.55
    );
    glassSheen.addColorStop(
      0,
      finishStyle === 'polished' || finishStyle === 'glass'
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(255, 255, 255, 0.06)'
    );
    glassSheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.015)');
    glassSheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    glassSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glassSheen;
    ctx.fillRect(screenX, screenY, screenW, screenH);

    ctx.restore(); // End screen clip

    // 2F. Notch / Dynamic Island / Browser Bar Overlay (Always rendered above screen content)
    if (preset.notchType === 'dynamic-island') {
      const islandW = Math.round(w * 0.28);
      const islandH = 24;
      ctx.fillStyle = '#050507';
      ctx.beginPath();
      ctx.roundRect(
        -islandW / 2,
        screenY + 11,
        islandW,
        islandH,
        islandH / 2
      );
      ctx.fill();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(islandW / 2 - 14, screenY + 11 + islandH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(islandW / 2 - 15, screenY + 10 + islandH / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (preset.notchType === 'notch') {
      const notchW = Math.round(w * 0.38);
      const notchH = 22;
      ctx.fillStyle = '#050507';
      ctx.beginPath();
      ctx.roundRect(-notchW / 2, screenY - 2, notchW, notchH, [0, 0, 12, 12]);
      ctx.fill();
    } else if (preset.notchType === 'punch-hole') {
      ctx.fillStyle = '#050507';
      ctx.beginPath();
      ctx.arc(0, screenY + 18, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (preset.notchType === 'macbook-notch') {
      const mbNotchW = 110;
      const mbNotchH = 18;
      ctx.fillStyle = '#050507';
      ctx.beginPath();
      ctx.roundRect(-mbNotchW / 2, screenY - 1, mbNotchW, mbNotchH, [
        0, 0, 8, 8,
      ]);
      ctx.fill();
    } else if (preset.notchType === 'browser-bar') {
      // Custom Browser Toolbar & Tab Bar
      ctx.save();
      ctx.fillStyle = browserTheme.toolbarColor || '#131722';
      ctx.beginPath();
      ctx.roundRect(-halfW + 1, -halfH + 1, w - 2, preset.bezelTop, [
        outerR,
        outerR,
        0,
        0,
      ]);
      ctx.fill();

      const barY = -halfH + preset.bezelTop / 2;

      // Window control buttons (macOS / Minimal / Windows)
      if (browserTheme.controlButtonsStyle === 'minimal') {
        const minCols = [
          browserTheme.websiteAccentColor,
          'rgba(148,163,184,0.45)',
          'rgba(148,163,184,0.25)',
        ];
        minCols.forEach((c, idx) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.roundRect(-halfW + 20 + idx * 16, barY - 4, 10, 8, 3);
          ctx.fill();
        });
      } else if (browserTheme.controlButtonsStyle === 'windows') {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        // Minimize, Maximize, Close on right
        ctx.beginPath();
        ctx.moveTo(halfW - 76, barY);
        ctx.lineTo(halfW - 66, barY);
        ctx.strokeRect(halfW - 52, barY - 4, 9, 9);
        ctx.moveTo(halfW - 28, barY - 4);
        ctx.lineTo(halfW - 19, barY + 5);
        ctx.moveTo(halfW - 19, barY - 4);
        ctx.lineTo(halfW - 28, barY + 5);
        ctx.stroke();
      } else {
        const colors = ['#EF4444', '#F59E0B', '#10B981'];
        colors.forEach((c, idx) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(-halfW + 24 + idx * 18, barY, 5.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Active Browser Tab + Address Capsule
      ctx.fillStyle = browserTheme.tabColor || '#1E2536';
      ctx.beginPath();
      ctx.roundRect(-165, barY - 12, 330, 24, 7);
      ctx.fill();
      ctx.strokeStyle = browserTheme.websiteBorderColor || 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        browserTheme.customUrlText || 'https://studio.device.app/live',
        0,
        barY + 4
      );
      ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.restore();
  }

  // 3. Render Animated Vector & Freehand Drawings sorted by zIndex (including keyframe interpolation)
  const sortedDrawings = [...drawings]
    .filter((dr) => dr.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const rawDrawing of sortedDrawings) {
    const drawingTrack = tracks.find((tr) => tr.targetId === rawDrawing.id);
    if (drawingTrack && drawingTrack.visible === false) continue;
    const resolvedDrawing = resolveDrawingAtFrame(
      rawDrawing,
      drawingTrack ? drawingTrack.keyframes : [],
      frame,
      durationInFrames
    );
    renderDrawingObject2D(ctx, resolvedDrawing, frame, fps);
  }

  ctx.restore();
}
