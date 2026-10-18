import type {
  AnimatablePropertyKey,
  AnimationPresetId,
  EasingType,
  ExportSettings,
  Keyframe,
  ObjectEffects,
  SceneDeviceObject,
  SceneDrawingObject,
  SceneWebcamOverlay,
  ScreenTransform,
  TimelineClip,
} from '../shared/types.ts';

/**
 * Evaluates normalized progress t in [0, 1] using the chosen easing curve.
 */
export function evaluateEasing(t: number, easing: EasingType): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return clamped;
    case 'ease-in':
      return clamped * clamped * clamped;
    case 'ease-out': {
      const inv = 1 - clamped;
      return 1 - inv * inv * inv;
    }
    case 'ease-in-out':
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    case 'cubic-bezier': {
      const inv = 1 - clamped;
      return 1 - Math.pow(inv, 4);
    }
    case 'spring': {
      if (clamped === 0 || clamped === 1) return clamped;
      return (
        Math.pow(2, -9 * clamped) *
          Math.sin(((clamped * 9 - 0.75) * (2 * Math.PI)) / 3) +
        1
      );
    }
    default:
      return clamped;
  }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#000000').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 56, g: 189, b: 248 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const val = Math.round(ln * 255);
    return rgbToHex(val, val, val);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const r = hue2rgb(p, q, hn + 1 / 3) * 255;
  const g = hue2rgb(p, q, hn) * 255;
  const b = hue2rgb(p, q, hn - 1 / 3) * 255;
  return rgbToHex(r, g, b);
}

export function interpolateHexColor(c1: string, c2: string, t: number): string {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(
    rgb1.r + (rgb2.r - rgb1.r) * clamped,
    rgb1.g + (rgb2.g - rgb1.g) * clamped,
    rgb1.b + (rgb2.b - rgb1.b) * clamped
  );
}

export const NUMERIC_ANIMATABLE_KEYS = [
  'x',
  'y',
  'width',
  'height',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
  'cornerRadius',
  'strokeWidth',
  'borderOpacity',
  'glowBlur',
  'glowIntensity',
  'shadowBlur',
  'shadowOpacity',
  'cropZoom',
  'panX',
  'panY',
  'borderProgress',
  'curveIntensity',
  'rotation3DX',
  'rotation3DY',
  'rotation3DZ',
  'pos3DX',
  'pos3DY',
  'pos3DZ',
  'cameraZoom',
  'cameraFov',
] as const;

export const COLOR_ANIMATABLE_KEYS = [
  'strokeColor',
  'glowColor',
  'backgroundColor',
  'materialColor',
] as const;

/**
 * Returns true if the given property has at least 2 keyframes with distinct frames (or any keyframe).
 */
export function getKeyframesForProperty(
  keyframes: Keyframe[],
  prop: AnimatablePropertyKey
): Keyframe[] {
  return [...(keyframes || [])]
    .filter((kf) => kf.properties[prop] !== undefined)
    .sort((a, b) => a.frame - b.frame);
}

export function isPropertyAnimated(
  keyframes: Keyframe[],
  prop: AnimatablePropertyKey
): boolean {
  const kfs = getKeyframesForProperty(keyframes, prop);
  if (kfs.length < 2) return false;
  const firstVal = kfs[0].properties[prop];
  return kfs.some((k) => k.properties[prop] !== firstVal);
}

/**
 * Deterministically interpolates numeric and colour keyframe properties at `frame`.
 * Evaluates each property independently across all keyframes that define that property,
 * supporting both sparse per-property keyframes and full-pose keyframes.
 */
export function interpolateTrackAtFrame(
  keyframes: Keyframe[],
  frame: number
): Keyframe['properties'] {
  if (!keyframes || keyframes.length === 0) {
    return {};
  }
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const result: Keyframe['properties'] = {};

  for (const key of NUMERIC_ANIMATABLE_KEYS) {
    let prevKf: Keyframe | null = null;
    let nextKf: Keyframe | null = null;

    for (const kf of sorted) {
      if (kf.properties[key] !== undefined) {
        if (kf.frame <= frame) {
          prevKf = kf;
        } else if (kf.frame > frame && !nextKf) {
          nextKf = kf;
        }
      }
    }

    if (prevKf && nextKf) {
      const span = nextKf.frame - prevKf.frame;
      const rawT = span > 0 ? (frame - prevKf.frame) / span : 0;
      const easedT = evaluateEasing(rawT, nextKf.easing);
      const startVal = prevKf.properties[key] as number;
      const endVal = nextKf.properties[key] as number;
      result[key] = startVal + (endVal - startVal) * easedT;
    } else if (prevKf) {
      result[key] = prevKf.properties[key];
    } else if (nextKf) {
      result[key] = nextKf.properties[key];
    }
  }

  for (const cKey of COLOR_ANIMATABLE_KEYS) {
    let prevKf: Keyframe | null = null;
    let nextKf: Keyframe | null = null;

    for (const kf of sorted) {
      if (kf.properties[cKey] !== undefined) {
        if (kf.frame <= frame) {
          prevKf = kf;
        } else if (kf.frame > frame && !nextKf) {
          nextKf = kf;
        }
      }
    }

    if (prevKf && nextKf) {
      const span = nextKf.frame - prevKf.frame;
      const rawT = span > 0 ? (frame - prevKf.frame) / span : 0;
      const easedT = evaluateEasing(rawT, nextKf.easing);
      result[cKey] = interpolateHexColor(
        prevKf.properties[cKey] as string,
        nextKf.properties[cKey] as string,
        easedT
      );
    } else if (prevKf) {
      result[cKey] = prevKf.properties[cKey];
    } else if (nextKf) {
      result[cKey] = nextKf.properties[cKey];
    }
  }

  return result;
}

/**
 * Evaluates the deterministic animated outer glow parameters at a given timeline frame.
 */
export interface EvaluatedGlowState {
  primaryColor: string;
  secondaryColor: string;
  blurRadius: number;
  spread: number;
  intensity: number;
  opacity: number;
  angleRad: number;
  highlightProgress: number; // [0..1] around perimeter
}

export function evaluateAnimatedGlowState(
  effects: ObjectEffects,
  frame: number,
  fps: number
): EvaluatedGlowState {
  const speed = effects.glowSpeed ?? 1.0;
  const t = (frame / Math.max(1, fps)) * speed;
  const mode =
    effects.glowAnimationMode && effects.glowAnimationMode !== 'none'
      ? effects.glowAnimationMode
      : effects.animatedGlow
        ? 'pulse'
        : 'none';

  let primaryColor = effects.glowColor || '#38BDF8';
  let secondaryColor =
    effects.glowSecondaryColor ||
    interpolateHexColor(primaryColor, '#A855F7', 0.6);
  let blurRadius = Math.max(4, effects.glowBlur ?? 42);
  let spread = Math.max(2, effects.glowSpread ?? 12);
  let intensity = Math.max(0.05, Math.min(1.5, effects.glowIntensity ?? 0.65));
  const opacity = Math.max(0.1, Math.min(1, effects.glowOpacity ?? 0.85));
  let angleRad = (t * Math.PI * 0.85) % (Math.PI * 2);
  const highlightProgress = (((t * 0.45) % 1) + 1) % 1;

  if (mode === 'pulse') {
    const wave = 0.72 + 0.28 * Math.sin(t * 4.2);
    blurRadius *= wave;
    intensity *= wave;
  } else if (mode === 'breathing') {
    const breath = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.1));
    blurRadius *= 0.8 + 0.45 * breath;
    spread *= 0.75 + 0.5 * breath;
    intensity *= breath;
  } else if (mode === 'rainbow-cycle') {
    const hue1 = (t * 75) % 360;
    const hue2 = (hue1 + 70) % 360;
    primaryColor = hslToHex(hue1, 92, 58);
    secondaryColor = hslToHex(hue2, 92, 62);
  } else if (mode === 'rotating-gradient') {
    angleRad = (t * Math.PI * 1.6) % (Math.PI * 2);
  } else if (mode === 'intensity-wave') {
    const wave = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.4));
    intensity *= wave;
    spread *= 0.8 + 0.4 * wave;
  } else if (mode === 'neon-sweep' || mode === 'perimeter-sweep') {
    angleRad = highlightProgress * Math.PI * 2;
  }

  return {
    primaryColor,
    secondaryColor,
    blurRadius,
    spread,
    intensity,
    opacity,
    angleRad,
    highlightProgress,
  };
}

/**
 * Applies deterministic entrance, exit, and multi-property keyframe animations to a device at `frame`.
 */
export function resolveDeviceAtFrame(
  device: SceneDeviceObject,
  keyframes: Keyframe[],
  frame: number,
  durationInFrames: number
): SceneDeviceObject {
  const interpolated = interpolateTrackAtFrame(keyframes, frame);
  const resolvedEffects: ObjectEffects = {
    ...device.effects,
    glowBlur: interpolated.glowBlur ?? device.effects.glowBlur,
    glowIntensity: interpolated.glowIntensity ?? device.effects.glowIntensity,
    glowColor: interpolated.glowColor ?? device.effects.glowColor,
    shadowBlur: interpolated.shadowBlur ?? device.effects.shadowBlur,
    shadowOpacity: interpolated.shadowOpacity ?? device.effects.shadowOpacity,
  };

  const resolved: SceneDeviceObject = {
    ...device,
    x: interpolated.x ?? device.x,
    y: interpolated.y ?? device.y,
    scaleX: interpolated.scaleX ?? device.scaleX,
    scaleY: interpolated.scaleY ?? device.scaleY,
    rotation: interpolated.rotation ?? device.rotation,
    opacity: interpolated.opacity ?? device.opacity,
    customOuterRadius: interpolated.cornerRadius ?? device.customOuterRadius,
    customFrameColor: interpolated.materialColor ?? device.customFrameColor,
    rotation3DX: interpolated.rotation3DX ?? device.rotation3DX,
    rotation3DY: interpolated.rotation3DY ?? device.rotation3DY,
    rotation3DZ: interpolated.rotation3DZ ?? device.rotation3DZ,
    pos3DX: interpolated.pos3DX ?? device.pos3DX,
    pos3DY: interpolated.pos3DY ?? device.pos3DY,
    pos3DZ: interpolated.pos3DZ ?? device.pos3DZ,
    effects: resolvedEffects,
  };

  const entranceSpan = Math.min(24, Math.floor(durationInFrames * 0.25));
  if (
    device.effects.entranceAnimation !== 'none' &&
    frame < entranceSpan &&
    entranceSpan > 0
  ) {
    const t = evaluateEasing(frame / entranceSpan, 'ease-out');
    const visOpacity = 0.25 + 0.75 * t;
    if (device.effects.entranceAnimation === 'fade-up') {
      resolved.opacity *= visOpacity;
      resolved.y += (1 - t) * 60;
    } else if (device.effects.entranceAnimation === 'scale-pop') {
      resolved.opacity *= visOpacity;
      resolved.scaleX *= 0.75 + 0.25 * t;
      resolved.scaleY *= 0.75 + 0.25 * t;
    } else if (device.effects.entranceAnimation === 'slide-left') {
      resolved.opacity *= visOpacity;
      resolved.x += (1 - t) * 120;
    } else if (device.effects.entranceAnimation === 'rotate-3d') {
      resolved.opacity *= visOpacity;
      resolved.rotation3DY += (1 - t) * 35;
    }
  }

  const exitSpan = Math.min(20, Math.floor(durationInFrames * 0.2));
  const exitStart = durationInFrames - exitSpan;
  if (
    device.effects.exitAnimation !== 'none' &&
    frame > exitStart &&
    exitSpan > 0
  ) {
    const t = evaluateEasing((frame - exitStart) / exitSpan, 'ease-in');
    if (device.effects.exitAnimation === 'fade-out') {
      resolved.opacity *= 1 - t;
    } else if (device.effects.exitAnimation === 'scale-down') {
      resolved.opacity *= 1 - t;
      resolved.scaleX *= 1 - 0.35 * t;
      resolved.scaleY *= 1 - 0.35 * t;
    }
  }

  return resolved;
}

/**
 * Resolves a drawing object's interpolated properties at `frame` if a keyframe track exists for it,
 * and enforces its active timeline clip range `[startFrame, startFrame + durationFrames]`
 * as well as optional entrance and exit animations.
 */
export function resolveDrawingAtFrame(
  drawing: SceneDrawingObject,
  keyframes: Keyframe[],
  frame: number,
  totalDurationFrames?: number
): SceneDrawingObject {
  let resolved: SceneDrawingObject = { ...drawing };

  if (keyframes && keyframes.length > 0) {
    const interpolated = interpolateTrackAtFrame(keyframes, frame);
    resolved = {
      ...resolved,
      x: interpolated.x ?? drawing.x,
      y: interpolated.y ?? drawing.y,
      scaleX: interpolated.scaleX ?? drawing.scaleX,
      scaleY: interpolated.scaleY ?? drawing.scaleY,
      rotation: interpolated.rotation ?? drawing.rotation,
      opacity: interpolated.opacity ?? drawing.opacity,
      cornerRadius: interpolated.cornerRadius ?? drawing.cornerRadius,
      strokeWidth: interpolated.strokeWidth ?? drawing.strokeWidth,
      strokeColor: interpolated.strokeColor ?? drawing.strokeColor,
      glowRadius: interpolated.glowBlur ?? drawing.glowRadius,
      glowIntensity: interpolated.glowIntensity ?? drawing.glowIntensity,
      glowColor: interpolated.glowColor ?? drawing.glowColor,
    };
  }

  // Enforce active timeline clip range if startFrame or durationFrames is specified
  const hasTimelineRange =
    drawing.startFrame !== undefined || drawing.durationFrames !== undefined;
  if (hasTimelineRange) {
    const startF = Math.max(0, drawing.startFrame ?? 0);
    const durF = Math.max(
      1,
      drawing.durationFrames ?? totalDurationFrames ?? drawing.animationDurationFrames ?? 180
    );
    const endF = startF + durF;

    if (frame < startF || frame > endF) {
      return {
        ...resolved,
        visible: false,
        opacity: 0,
      };
    }

    // Apply entrance animation within the drawing's active timeline clip range
    const entranceMode = drawing.entranceAnimation || 'none';
    const entranceSpan = Math.min(18, Math.floor(durF * 0.35));
    if (entranceMode !== 'none' && entranceSpan > 0 && frame < startF + entranceSpan) {
      const t = evaluateEasing((frame - startF) / entranceSpan, 'ease-out');
      if (entranceMode === 'fade-in') {
        resolved.opacity *= t;
      } else if (entranceMode === 'scale-pop') {
        resolved.opacity *= t;
        const s = 0.72 + 0.28 * t;
        resolved.scaleX *= s;
        resolved.scaleY *= s;
      }
    }

    // Apply exit animation at the end of the drawing's active timeline clip range
    const exitMode = drawing.exitAnimation || 'none';
    const exitSpan = Math.min(18, Math.floor(durF * 0.35));
    const exitStart = endF - exitSpan;
    if (exitMode !== 'none' && exitSpan > 0 && frame > exitStart) {
      const t = evaluateEasing((frame - exitStart) / exitSpan, 'ease-in');
      if (exitMode === 'fade-out') {
        resolved.opacity *= 1 - t;
      } else if (exitMode === 'scale-down') {
        resolved.opacity *= 1 - t;
        const s = 1 - 0.3 * t;
        resolved.scaleX *= s;
        resolved.scaleY *= s;
      }
    }
  }

  return resolved;
}

/**
 * Non-destructively trims a TimelineClip's left (in-point) or right (out-point) edge
 * while enforcing all timing invariants:
 * - 0 <= trimStartFrames < sourceOutFrame <= sourceDurationFrames
 * - durationFrames = round((sourceOutFrame - trimStartFrames) / playbackSpeed) >= 1
 * - startFrame >= 0
 */
export function computeTrimmedClip(
  clip: TimelineClip,
  edge: 'left' | 'right',
  deltaTimelineFrames: number,
  maxSourceDurationFrames?: number
): TimelineClip {
  const speed = Math.max(0.1, clip.playbackSpeed || 1);
  const sourceMax = Math.max(
    10,
    maxSourceDurationFrames ??
      clip.sourceDurationFrames ??
      Math.max(
        clip.trimStartFrames + Math.round(clip.durationFrames * speed),
        1800
      )
  );
  const origStart = clip.startFrame;
  const origDur = Math.max(1, clip.durationFrames);
  const origIn = Math.max(0, clip.trimStartFrames);
  const origOut = Math.min(
    sourceMax,
    clip.sourceOutFrame ?? origIn + Math.round(origDur * speed)
  );
  const minVisibleFrames = 5;

  if (edge === 'left') {
    // Timeline end position and sourceOutFrame stay fixed
    const maxDeltaRight = origDur - minVisibleFrames;
    const minDeltaLeft = -Math.min(origStart, Math.floor(origIn / speed));
    const clampedDelta = Math.max(
      minDeltaLeft,
      Math.min(maxDeltaRight, Math.round(deltaTimelineFrames))
    );

    const newStartFrame = origStart + clampedDelta;
    const newDurationFrames = origDur - clampedDelta;
    const newInFrame = Math.max(
      0,
      Math.min(
        origOut - minVisibleFrames,
        origIn + Math.round(clampedDelta * speed)
      )
    );

    return {
      ...clip,
      startFrame: newStartFrame,
      durationFrames: newDurationFrames,
      trimStartFrames: newInFrame,
      sourceOutFrame: origOut,
      sourceDurationFrames: sourceMax,
    };
  } else {
    // Left startFrame and trimStartFrames stay fixed; out-point changes
    const maxPossibleDur = Math.max(
      minVisibleFrames,
      Math.floor((sourceMax - origIn) / speed)
    );
    const newDurationFrames = Math.max(
      minVisibleFrames,
      Math.min(maxPossibleDur, origDur + Math.round(deltaTimelineFrames))
    );
    const newOutFrame = Math.min(
      sourceMax,
      origIn + Math.round(newDurationFrames * speed)
    );

    return {
      ...clip,
      durationFrames: newDurationFrames,
      sourceOutFrame: newOutFrame,
      sourceDurationFrames: sourceMax,
    };
  }
}

export interface SplitClipResult {
  ok: boolean;
  reason?: string;
  firstClip?: TimelineClip;
  secondClip?: TimelineClip;
}

/**
 * Splits a TimelineClip at `playheadFrame` into two contiguous clips on the same track,
 * mapping `playheadFrame` to the exact source media frame and preserving waveform segments.
 */
export function splitTimelineClipAtFrame(
  clip: TimelineClip,
  playheadFrame: number,
  newIdSuffix = `${Date.now().toString(36)}`
): SplitClipResult {
  const clipStart = clip.startFrame;
  const clipEnd = clip.startFrame + clip.durationFrames;
  const minSegmentFrames = 2;

  if (
    playheadFrame < clipStart + minSegmentFrames ||
    playheadFrame > clipEnd - minSegmentFrames
  ) {
    return {
      ok: false,
      reason: `Move the playhead (currently F${playheadFrame}) inside "${clip.name}" (F${clipStart}–F${clipEnd}) to split.`,
    };
  }

  const speed = Math.max(0.1, clip.playbackSpeed || 1);
  const firstDur = playheadFrame - clipStart;
  const secondDur = clip.durationFrames - firstDur;
  const origIn = clip.trimStartFrames;
  const origOut =
    clip.sourceOutFrame ?? origIn + Math.round(clip.durationFrames * speed);
  const splitSourceFrame = origIn + Math.round(firstDur * speed);

  const peaks = clip.waveformPeaks || [];
  const splitPeakIdx = Math.max(
    1,
    Math.min(
      peaks.length - 1,
      Math.round((firstDur / clip.durationFrames) * peaks.length)
    )
  );
  const firstPeaks =
    peaks.length >= 4 ? peaks.slice(0, splitPeakIdx) : [...peaks];
  const secondPeaks =
    peaks.length >= 4 ? peaks.slice(splitPeakIdx) : [...peaks];

  const baseName = clip.name.replace(/\s*\(Part\s+\d+\)$/i, '');

  const firstClip: TimelineClip = {
    ...JSON.parse(JSON.stringify(clip)),
    name: `${baseName} (Part 1)`,
    startFrame: clipStart,
    durationFrames: firstDur,
    trimStartFrames: origIn,
    sourceOutFrame: splitSourceFrame,
    waveformPeaks: firstPeaks,
  };

  const secondClip: TimelineClip = {
    ...JSON.parse(JSON.stringify(clip)),
    id: `clip-split-${newIdSuffix}`,
    name: `${baseName} (Part 2)`,
    trackId: clip.trackId, // Keep on the same track!
    startFrame: playheadFrame,
    durationFrames: secondDur,
    trimStartFrames: splitSourceFrame,
    sourceOutFrame: origOut,
    waveformPeaks: secondPeaks,
  };

  return {
    ok: true,
    firstClip,
    secondClip,
  };
}

export interface ActiveClipEvaluation {
  hasClipsForMedia: boolean;
  activeClip: TimelineClip | null;
  sourceFrame: number;
  isMuted: boolean;
}

/**
 * Evaluates which timeline clip (if any) is active for a given `mediaId` at `frame`,
 * and converts the timeline `frame` into the clip's trimmed source media frame.
 */
export function resolveActiveClipForMediaAtFrame(
  clips: TimelineClip[],
  mediaId: string | null | undefined,
  frame: number
): ActiveClipEvaluation {
  if (!mediaId) {
    return {
      hasClipsForMedia: false,
      activeClip: null,
      sourceFrame: frame,
      isMuted: false,
    };
  }

  const mediaClips = (clips || []).filter(
    (c) => c.mediaId === mediaId && c.visible !== false
  );

  if (mediaClips.length === 0) {
    return {
      hasClipsForMedia: false,
      activeClip: null,
      sourceFrame: frame,
      isMuted: false,
    };
  }

  // Find a clip whose [startFrame, startFrame + durationFrames) covers `frame`
  // Prioritize strict half-open [startFrame, endFrame) so split boundaries transition cleanly to Part 2
  const coveringClip =
    mediaClips.find(
      (c) => frame >= c.startFrame && frame < c.startFrame + c.durationFrames
    ) ||
    mediaClips.find(
      (c) => frame >= c.startFrame && frame === c.startFrame + c.durationFrames
    );

  if (!coveringClip) {
    return {
      hasClipsForMedia: true,
      activeClip: null,
      sourceFrame: 0,
      isMuted: true,
    };
  }

  const speed = Math.max(0.1, coveringClip.playbackSpeed || 1);
  const offsetInClip = Math.max(0, frame - coveringClip.startFrame);
  const rawSourceFrame =
    coveringClip.trimStartFrames + Math.round(offsetInClip * speed);
  const maxOut =
    coveringClip.sourceOutFrame ??
    coveringClip.trimStartFrames +
      Math.round(coveringClip.durationFrames * speed);
  const clampedSourceFrame = Math.max(
    coveringClip.trimStartFrames,
    Math.min(maxOut, rawSourceFrame)
  );

  return {
    hasClipsForMedia: true,
    activeClip: coveringClip,
    sourceFrame: clampedSourceFrame,
    isMuted: Boolean(coveringClip.muted),
  };
}

/**
 * Generates real editable keyframes on a device track for a ready-made animation preset.
 */
export function generateKeyframesForPreset(
  presetId: AnimationPresetId,
  device: SceneDeviceObject,
  durationInFrames: number
): Keyframe[] {
  const end = Math.max(30, durationInFrames - 1);
  const mid = Math.round(end / 2);
  const q1 = Math.round(end * 0.25);
  const q3 = Math.round(end * 0.75);

  const baseProps = {
    x: device.x,
    y: device.y,
    scaleX: device.scaleX,
    scaleY: device.scaleY,
    rotation: device.rotation,
    opacity: device.opacity,
    glowBlur: device.effects.glowBlur,
    glowIntensity: device.effects.glowIntensity,
    glowColor: device.effects.glowColor,
    rotation3DX: device.rotation3DX,
    rotation3DY: device.rotation3DY,
    rotation3DZ: device.rotation3DZ,
  };

  switch (presetId) {
    case 'zoom-in':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'cubic-bezier',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 0.7).toFixed(2)),
            scaleY: Number((device.scaleY * 0.7).toFixed(2)),
            opacity: 0.65,
          },
        },
        {
          id: `kf-${device.id}-${q1}`,
          frame: q1,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: Number(device.scaleX.toFixed(2)),
            scaleY: Number(device.scaleY.toFixed(2)),
            opacity: 1,
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 1.25).toFixed(2)),
            scaleY: Number((device.scaleY * 1.25).toFixed(2)),
            opacity: 1,
          },
        },
        {
          id: `kf-${device.id}-${q3}`,
          frame: q3,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: Number(device.scaleX.toFixed(2)),
            scaleY: Number(device.scaleY.toFixed(2)),
            opacity: 1,
          },
        },
      ];
    case 'zoom-out':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'cubic-bezier',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 1.32).toFixed(2)),
            scaleY: Number((device.scaleY * 1.32).toFixed(2)),
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-out',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 0.88).toFixed(2)),
            scaleY: Number((device.scaleY * 0.88).toFixed(2)),
          },
        },
      ];
    case 'smooth-scale':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: 0.7,
            scaleY: 0.7,
          },
        },
        {
          id: `kf-${device.id}-${q1}`,
          frame: q1,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: 1.0,
            scaleY: 1.0,
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: 1.25,
            scaleY: 1.25,
          },
        },
        {
          id: `kf-${device.id}-${q3}`,
          frame: q3,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: 1.0,
            scaleY: 1.0,
          },
        },
      ];
    case 'device-slide-in':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'cubic-bezier',
          properties: {
            ...baseProps,
            x: device.x + 260,
            y: device.y + 140,
            opacity: 0.3,
          },
        },
        {
          id: `kf-${device.id}-${q1}`,
          frame: q1,
          easing: 'cubic-bezier',
          properties: { ...baseProps, opacity: 1 },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'linear',
          properties: { ...baseProps, opacity: 1 },
        },
      ];
    case 'fade-in-out':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'ease-out',
          properties: { ...baseProps, opacity: 0.2 },
        },
        {
          id: `kf-${device.id}-${q1}`,
          frame: q1,
          easing: 'linear',
          properties: { ...baseProps, opacity: 1 },
        },
        {
          id: `kf-${device.id}-${q3}`,
          frame: q3,
          easing: 'ease-in',
          properties: { ...baseProps, opacity: 1 },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-in',
          properties: { ...baseProps, opacity: 0.2 },
        },
      ];
    case 'rotation-reveal':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'cubic-bezier',
          properties: {
            ...baseProps,
            rotation: -14,
            rotation3DX: 22,
            rotation3DY: -48,
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            rotation: 0,
            rotation3DX: 4,
            rotation3DY: 12,
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-in-out',
          properties: { ...baseProps },
        },
      ];
    case 'floating-motion':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: { ...baseProps, y: device.y },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            y: device.y - 42,
            rotation: device.rotation + 2,
            rotation3DX: device.rotation3DX - 6,
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-in-out',
          properties: { ...baseProps, y: device.y },
        },
      ];
    case 'camera-push-in':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 0.85).toFixed(2)),
            scaleY: Number((device.scaleY * 0.85).toFixed(2)),
            rotation3DX: 14,
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'cubic-bezier',
          properties: {
            ...baseProps,
            scaleX: Number((device.scaleX * 1.18).toFixed(2)),
            scaleY: Number((device.scaleY * 1.18).toFixed(2)),
            rotation3DX: 0,
          },
        },
      ];
    case 'glow-pulse':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            glowBlur: 24,
            glowIntensity: 0.35,
            glowColor: '#06B6D4',
          },
        },
        {
          id: `kf-${device.id}-${q1}`,
          frame: q1,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            glowBlur: 68,
            glowIntensity: 1.1,
            glowColor: '#A855F7',
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            glowBlur: 32,
            glowIntensity: 0.45,
            glowColor: '#EC4899',
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-in-out',
          properties: {
            ...baseProps,
            glowBlur: 64,
            glowIntensity: 0.95,
            glowColor: '#06B6D4',
          },
        },
      ];
    case 'neon-border-sweep':
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'linear',
          properties: {
            ...baseProps,
            glowBlur: 48,
            glowIntensity: 0.85,
            glowColor: '#22D3EE',
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'linear',
          properties: {
            ...baseProps,
            glowBlur: 64,
            glowIntensity: 1.0,
            glowColor: '#EC4899',
          },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'linear',
          properties: {
            ...baseProps,
            glowBlur: 48,
            glowIntensity: 0.85,
            glowColor: '#22D3EE',
          },
        },
      ];
    case 'spring-bounce':
    default:
      return [
        {
          id: `kf-${device.id}-0`,
          frame: 0,
          easing: 'spring',
          properties: {
            ...baseProps,
            y: device.y - 120,
            scaleX: Number((device.scaleX * 0.55).toFixed(2)),
            scaleY: Number((device.scaleY * 0.55).toFixed(2)),
          },
        },
        {
          id: `kf-${device.id}-${mid}`,
          frame: mid,
          easing: 'spring',
          properties: { ...baseProps },
        },
        {
          id: `kf-${device.id}-${end}`,
          frame: end,
          easing: 'ease-out',
          properties: { ...baseProps },
        },
      ];
  }
}

export interface ScreenDrawGeometry {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function computeScreenMediaRect(
  screenW: number,
  screenH: number,
  mediaW: number,
  mediaH: number,
  transform: ScreenTransform
): ScreenDrawGeometry {
  const safeMediaW = Math.max(1, mediaW);
  const safeMediaH = Math.max(1, mediaH);
  const safeScreenW = Math.max(1, screenW);
  const safeScreenH = Math.max(1, screenH);
  const zoom = Math.max(0.1, transform.zoom);

  const sx = Math.max(0, Math.min(1, transform.cropX)) * safeMediaW;
  const sy = Math.max(0, Math.min(1, transform.cropY)) * safeMediaH;
  const sw = Math.max(
    1,
    Math.min(1 - transform.cropX, transform.cropWidth) * safeMediaW
  );
  const sh = Math.max(
    1,
    Math.min(1 - transform.cropY, transform.cropHeight) * safeMediaH
  );

  let baseW = safeScreenW;
  let baseH = safeScreenH;

  const mediaAspect = sw / sh;
  const screenAspect = safeScreenW / safeScreenH;

  if (transform.fitMode === 'stretch') {
    baseW = safeScreenW;
    baseH = safeScreenH;
  } else if (transform.fitMode === 'contain') {
    if (mediaAspect > screenAspect) {
      baseW = safeScreenW;
      baseH = safeScreenW / mediaAspect;
    } else {
      baseH = safeScreenH;
      baseW = safeScreenH * mediaAspect;
    }
  } else {
    if (mediaAspect > screenAspect) {
      baseH = safeScreenH;
      baseW = safeScreenH * mediaAspect;
    } else {
      baseW = safeScreenW;
      baseH = safeScreenW / mediaAspect;
    }
  }

  const dw = baseW * zoom;
  const dh = baseH * zoom;
  const dx = (safeScreenW - dw) / 2 + transform.offsetX;
  const dy = (safeScreenH - dh) / 2 + transform.offsetY;

  return { sx, sy, sw, sh, dx, dy, dw, dh };
}

export interface SnapResult {
  x: number;
  y: number;
  guidesX: number[];
  guidesY: number[];
}

export function computeSnapPosition(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  otherCenters: { x: number; y: number }[],
  snapToGrid: boolean,
  gridSize = 20,
  threshold = 8
): SnapResult {
  let snappedX = x;
  let snappedY = y;
  const guidesX: number[] = [];
  const guidesY: number[] = [];

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  if (Math.abs(x - centerX) <= threshold) {
    snappedX = centerX;
    guidesX.push(centerX);
  }
  if (Math.abs(y - centerY) <= threshold) {
    snappedY = centerY;
    guidesY.push(centerY);
  }

  for (const other of otherCenters) {
    if (Math.abs(x - other.x) <= threshold && guidesX.length === 0) {
      snappedX = other.x;
      guidesX.push(other.x);
    }
    if (Math.abs(y - other.y) <= threshold && guidesY.length === 0) {
      snappedY = other.y;
      guidesY.push(other.y);
    }
  }

  if (snapToGrid && guidesX.length === 0) {
    snappedX = Math.round(snappedX / gridSize) * gridSize;
  }
  if (snapToGrid && guidesY.length === 0) {
    snappedY = Math.round(snappedY / gridSize) * gridSize;
  }

  return { x: snappedX, y: snappedY, guidesX, guidesY };
}

/**
 * Snaps a timeline frame to nearby targets (playhead, clip start/end edges, or grid interval).
 */
export function snapTimelineFrame(
  rawFrame: number,
  snapTargets: number[],
  snapEnabled: boolean,
  thresholdFrames = 3
): { frame: number; snappedTo: number | null } {
  const rounded = Math.max(0, Math.round(rawFrame));
  if (!snapEnabled) return { frame: rounded, snappedTo: null };

  for (const target of snapTargets) {
    if (Math.abs(rounded - target) <= thresholdFrames) {
      return { frame: target, snappedTo: target };
    }
  }
  return { frame: rounded, snappedTo: null };
}

export function resolveExportDimensions(settings: ExportSettings): {
  width: number;
  height: number;
} {
  if (settings.aspectRatio === 'custom') {
    return {
      width: Math.max(120, Math.min(3840, Math.round(settings.customWidth))),
      height: Math.max(120, Math.min(3840, Math.round(settings.customHeight))),
    };
  }

  const baseShortEdge =
    settings.resolution === '4k'
      ? 2160
      : settings.resolution === '1080p'
        ? 1080
        : 720;

  switch (settings.aspectRatio) {
    case '16:9':
      return {
        width: Math.round((baseShortEdge * 16) / 9),
        height: baseShortEdge,
      };
    case '9:16':
      return {
        width: baseShortEdge,
        height: Math.round((baseShortEdge * 16) / 9),
      };
    case '1:1':
      return {
        width: baseShortEdge,
        height: baseShortEdge,
      };
    case '4:3':
      return {
        width: Math.round((baseShortEdge * 4) / 3),
        height: baseShortEdge,
      };
    default:
      return { width: 1920, height: 1080 };
  }
}

export interface MotionTrailNode {
  id: string;
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  cornerRadius: number;
  relation: 'past' | 'current' | 'future';
  isImmediatePrev: boolean;
  isImmediateNext: boolean;
}

export interface MotionTrailSample {
  frame: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  relation: 'past' | 'future';
}

export interface MotionTrailGhost {
  frame: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  cornerRadius: number;
  relation: 'past' | 'future';
  isKeyframe: boolean;
  isImmediate: boolean;
  weight: number;
}

export interface DeviceMotionTrail {
  deviceId: string;
  deviceName: string;
  hasTrail: boolean;
  currentPoint: {
    frame: number;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    cornerRadius: number;
  };
  previousKeyframe: MotionTrailNode | null;
  nextKeyframe: MotionTrailNode | null;
  keyframeNodes: MotionTrailNode[];
  samples: MotionTrailSample[];
  ghosts: MotionTrailGhost[];
}

/**
 * Computes the complete 2D/3D Onion Skin & Motion Trail path for a device
 * across its previous, current, and next keyframes.
 */
export function computeDeviceMotionTrail(
  device: SceneDeviceObject,
  keyframes: Keyframe[],
  currentFrame: number,
  totalFrames: number,
  sampleStep = 3
): DeviceMotionTrail {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const currentResolved = resolveDeviceAtFrame(
    device,
    sorted,
    currentFrame,
    totalFrames
  );

  const currentPoint = {
    frame: currentFrame,
    x: currentResolved.x,
    y: currentResolved.y,
    width: currentResolved.width,
    height: currentResolved.height,
    scaleX: currentResolved.scaleX,
    scaleY: currentResolved.scaleY,
    rotation: currentResolved.rotation,
    cornerRadius: currentResolved.customOuterRadius ?? 44,
  };

  if (sorted.length < 2) {
    return {
      deviceId: device.id,
      deviceName: device.name,
      hasTrail: false,
      currentPoint,
      previousKeyframe: null,
      nextKeyframe: null,
      keyframeNodes: [],
      samples: [],
      ghosts: [],
    };
  }

  // Find immediate previous (< currentFrame) and immediate next (> currentFrame) keyframes
  let prevKfId: string | null = null;
  let nextKfId: string | null = null;

  for (const kf of sorted) {
    if (kf.frame < currentFrame) {
      prevKfId = kf.id;
    } else if (kf.frame > currentFrame && nextKfId === null) {
      nextKfId = kf.id;
    }
  }

  // If playhead is exactly on the first keyframe, still highlight the second keyframe as immediate next
  // and if on the last keyframe, highlight the second-to-last as immediate prev
  const keyframeNodes: MotionTrailNode[] = sorted.map((kf) => {
    const resolved = resolveDeviceAtFrame(
      device,
      sorted,
      kf.frame,
      totalFrames
    );
    const relation: 'past' | 'current' | 'future' =
      kf.frame < currentFrame
        ? 'past'
        : kf.frame > currentFrame
          ? 'future'
          : 'current';
    return {
      id: kf.id,
      frame: kf.frame,
      x: resolved.x,
      y: resolved.y,
      width: resolved.width,
      height: resolved.height,
      scaleX: resolved.scaleX,
      scaleY: resolved.scaleY,
      rotation: resolved.rotation,
      opacity: resolved.opacity,
      cornerRadius: resolved.customOuterRadius ?? 44,
      relation,
      isImmediatePrev: kf.id === prevKfId,
      isImmediateNext: kf.id === nextKfId,
    };
  });

  const previousKeyframe =
    keyframeNodes.find((n) => n.isImmediatePrev) || null;
  const nextKeyframe = keyframeNodes.find((n) => n.isImmediateNext) || null;

  const firstFrame = sorted[0].frame;
  const lastFrame = sorted[sorted.length - 1].frame;
  const step = Math.max(1, Math.round(sampleStep));

  const sampleFramesSet = new Set<number>();
  for (let f = firstFrame; f <= lastFrame; f += step) {
    sampleFramesSet.add(f);
  }
  for (const kf of sorted) {
    sampleFramesSet.add(kf.frame);
  }
  if (currentFrame >= firstFrame && currentFrame <= lastFrame) {
    sampleFramesSet.add(currentFrame);
  }

  const sampleFrames = Array.from(sampleFramesSet).sort((a, b) => a - b);
  const samples: MotionTrailSample[] = sampleFrames.map((f) => {
    const resolved = resolveDeviceAtFrame(device, sorted, f, totalFrames);
    return {
      frame: f,
      x: resolved.x,
      y: resolved.y,
      scaleX: resolved.scaleX,
      scaleY: resolved.scaleY,
      rotation: resolved.rotation,
      relation: f <= currentFrame ? 'past' : 'future',
    };
  });

  // Build Onion Skin ghost silhouettes for non-current keyframes + intermediate midpoints
  const ghosts: MotionTrailGhost[] = [];

  for (const node of keyframeNodes) {
    if (node.frame === currentFrame) continue;
    const isImmediate = node.isImmediatePrev || node.isImmediateNext;
    ghosts.push({
      frame: node.frame,
      label: node.isImmediatePrev
        ? `PREV · F${String(node.frame).padStart(3, '0')}`
        : node.isImmediateNext
          ? `NEXT · F${String(node.frame).padStart(3, '0')}`
          : `KF · F${String(node.frame).padStart(3, '0')}`,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      scaleX: node.scaleX,
      scaleY: node.scaleY,
      rotation: node.rotation,
      cornerRadius: node.cornerRadius,
      relation: node.relation === 'past' ? 'past' : 'future',
      isKeyframe: true,
      isImmediate,
      weight: isImmediate ? 0.52 : 0.28,
    });
  }

  // Add intermediate onion-skin ghost between immediate previous keyframe and currentFrame
  if (previousKeyframe && currentFrame - previousKeyframe.frame >= 12) {
    const midPrevFrame = Math.round(
      (previousKeyframe.frame + currentFrame) / 2
    );
    const midResolved = resolveDeviceAtFrame(
      device,
      sorted,
      midPrevFrame,
      totalFrames
    );
    ghosts.push({
      frame: midPrevFrame,
      label: `F${String(midPrevFrame).padStart(3, '0')}`,
      x: midResolved.x,
      y: midResolved.y,
      width: midResolved.width,
      height: midResolved.height,
      scaleX: midResolved.scaleX,
      scaleY: midResolved.scaleY,
      rotation: midResolved.rotation,
      cornerRadius: midResolved.customOuterRadius ?? 44,
      relation: 'past',
      isKeyframe: false,
      isImmediate: false,
      weight: 0.2,
    });
  }

  // Add intermediate onion-skin ghost between currentFrame and immediate next keyframe
  if (nextKeyframe && nextKeyframe.frame - currentFrame >= 12) {
    const midNextFrame = Math.round((currentFrame + nextKeyframe.frame) / 2);
    const midResolved = resolveDeviceAtFrame(
      device,
      sorted,
      midNextFrame,
      totalFrames
    );
    ghosts.push({
      frame: midNextFrame,
      label: `F${String(midNextFrame).padStart(3, '0')}`,
      x: midResolved.x,
      y: midResolved.y,
      width: midResolved.width,
      height: midResolved.height,
      scaleX: midResolved.scaleX,
      scaleY: midResolved.scaleY,
      rotation: midResolved.rotation,
      cornerRadius: midResolved.customOuterRadius ?? 44,
      relation: 'future',
      isKeyframe: false,
      isImmediate: false,
      weight: 0.2,
    });
  }

  ghosts.sort((a, b) => a.frame - b.frame);

  return {
    deviceId: device.id,
    deviceName: device.name,
    hasTrail: true,
    currentPoint,
    previousKeyframe,
    nextKeyframe,
    keyframeNodes,
    samples,
    ghosts,
  };
}

/**
 * Formats a frame index and FPS into professional SMPTE/CapCut timecode `HH:MM:SS:FF`.
 * At 30 FPS, frame 30 -> "00:00:01:00", frame 45 -> "00:00:01:15".
 */
export function formatTimecode(frame: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const safeFrame = Math.max(0, Math.round(frame || 0));
  const ff = safeFrame % safeFps;
  const totalSeconds = Math.floor(safeFrame / safeFps);
  const ss = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;
  const hh = Math.floor(totalMinutes / 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(
    ss
  ).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
}

/**
 * Formats a frame index and FPS into compact ruler timecode `MM:SS:FF` (or `SS.ms`s).
 */
export function formatShortTimecode(frame: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const safeFrame = Math.max(0, Math.round(frame || 0));
  const ff = safeFrame % safeFps;
  const totalSeconds = Math.floor(safeFrame / safeFps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(
    ff
  ).padStart(2, '0')}`;
}

export const BASE_TIMELINE_PIXELS_PER_SECOND = 150;

export interface TimelineCoordinateMetrics {
  fps: number;
  durationInFrames: number;
  durationSeconds: number;
  zoom: number;
  pixelsPerSecond: number;
  pixelsPerFrame: number;
  contentWidthPx: number;
  totalWidthPx: number;
}

/**
 * Shared coordinate conversion: converts a timeline `frame` into a horizontal pixel coordinate
 * given `zoom` (where zoom = 1.0 equals 150 pixels per second) and `scrollOffset` in pixels.
 */
export function frameToPixel(
  frame: number,
  zoom = 1,
  scrollOffset = 0,
  fps = 30
): number {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const safeZoom = Math.max(0.05, Math.min(8, zoom || 1));
  const pixelsPerFrame = (BASE_TIMELINE_PIXELS_PER_SECOND / safeFps) * safeZoom;
  return Number((frame * pixelsPerFrame - scrollOffset).toFixed(2));
}

/**
 * Shared coordinate conversion: converts a viewport-relative `pixel` offset into an integer
 * timeline frame index given `zoom` and `scrollOffset` in pixels.
 */
export function pixelToFrame(
  pixel: number,
  zoom = 1,
  scrollOffset = 0,
  fps = 30,
  maxFrame?: number
): number {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const safeZoom = Math.max(0.05, Math.min(8, zoom || 1));
  const pixelsPerFrame = (BASE_TIMELINE_PIXELS_PER_SECOND / safeFps) * safeZoom;
  const rawFrame = Math.round(
    (pixel + scrollOffset) / Math.max(0.01, pixelsPerFrame)
  );
  if (maxFrame !== undefined) {
    return Math.max(0, Math.min(Math.round(maxFrame), rawFrame));
  }
  return Math.max(0, rawFrame);
}

/**
 * Computes the complete timeline scale metrics for a project of `durationInFrames` at `fps` and `zoom`.
 */
export function computeTimelineMetrics(
  durationInFrames: number,
  fps = 30,
  zoom = 1,
  viewportWidth = 1000
): TimelineCoordinateMetrics {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const totalFrames = Math.max(2, Math.round(durationInFrames || 180));
  const safeZoom = Math.max(0.08, Math.min(6, Number((zoom || 1).toFixed(3))));
  const safeViewport = Math.max(240, Math.round(viewportWidth || 1000));
  const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * safeZoom;
  const pixelsPerFrame = pixelsPerSecond / safeFps;
  const contentWidthPx = Math.max(
    120,
    Math.ceil(totalFrames * pixelsPerFrame)
  );
  const totalWidthPx = Math.max(safeViewport, contentWidthPx + 48);

  return {
    fps: safeFps,
    durationInFrames: totalFrames,
    durationSeconds: Number((totalFrames / safeFps).toFixed(2)),
    zoom: safeZoom,
    pixelsPerSecond: Number(pixelsPerSecond.toFixed(2)),
    pixelsPerFrame: Number(pixelsPerFrame.toFixed(4)),
    contentWidthPx,
    totalWidthPx,
  };
}

/**
 * Computes the timeline zoom factor required to fit the entire `durationInFrames` inside `viewportWidth`.
 */
export function computeFitTimelineZoom(
  durationInFrames: number,
  fps = 30,
  viewportWidth = 1000
): number {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const totalFrames = Math.max(10, Math.round(durationInFrames || 180));
  const usableWidth = Math.max(200, viewportWidth - 56);
  const baseWidth = (totalFrames / safeFps) * BASE_TIMELINE_PIXELS_PER_SECOND;
  const rawZoom = usableWidth / Math.max(1, baseWidth);
  return Math.max(0.08, Math.min(4, Number(rawZoom.toFixed(2))));
}

export interface TimelineRulerTick {
  frame: number;
  percent: number;
  pixelLeft: number;
  isMajor: boolean;
  showFrameDetail: boolean;
  timecodeLabel: string;
  shortTimecodeLabel: string;
  secondsLabel: string;
  frameLabel: string;
}

/**
 * Computes major and minor ruler ticks that adapt to the current timeline zoom level
 * and sequence duration in frames, using the shared `frameToPixel` coordinate model.
 * At 30 FPS: Frame 0 = 00:00:00:00, Frame 30 = 00:00:01:00, Frame 60 = 00:00:02:00.
 */
export function computeAdaptiveRulerTicks(
  durationInFrames: number,
  fps: number,
  zoom: number
): TimelineRulerTick[] {
  const totalFrames = Math.max(2, Math.round(durationInFrames));
  const safeFps = Math.max(1, Math.round(fps || 30));
  const safeZoom = Math.max(0.08, Math.min(8, zoom || 1));
  const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * safeZoom;
  const pixelsPerFrame = pixelsPerSecond / safeFps;

  // Choose major & minor tick frame intervals based on visual pixel spacing (~100px-160px per major tick)
  let majorStepFrames = safeFps; // Default 1 second (30 frames)
  let minorStepFrames = Math.max(1, Math.round(safeFps / 6)); // 5 frames
  const showFrameDetail = pixelsPerFrame >= 8;

  if (pixelsPerSecond >= 450) {
    // High zoom (>= 3.0x): major every 5 frames, minor every 1 single frame
    majorStepFrames = Math.max(5, Math.round(safeFps / 6));
    minorStepFrames = 1;
  } else if (pixelsPerSecond >= 240) {
    // Detailed zoom (>= 1.6x): major every 15 frames (0.5s), minor every 1-3 frames
    majorStepFrames = Math.max(10, Math.round(safeFps / 2));
    minorStepFrames = pixelsPerFrame >= 10 ? 1 : 3;
  } else if (pixelsPerSecond >= 95) {
    // Standard 100% zoom (0.65x - 1.6x): major every 1 second (30f), minor every 5 frames
    majorStepFrames = safeFps;
    minorStepFrames = Math.max(5, Math.round(safeFps / 6));
  } else if (pixelsPerSecond >= 48) {
    // Medium-out zoom: major every 2 seconds (60f), minor every 15 frames (0.5s)
    majorStepFrames = safeFps * 2;
    minorStepFrames = Math.max(10, Math.round(safeFps / 2));
  } else if (pixelsPerSecond >= 22) {
    // Long project overview: major every 5 seconds (150f), minor every 1 second (30f)
    majorStepFrames = safeFps * 5;
    minorStepFrames = safeFps;
  } else {
    // 60s+ full-project fit: major every 10 seconds (300f), minor every 2 seconds (60f)
    majorStepFrames = safeFps * 10;
    minorStepFrames = safeFps * 2;
  }

  const ticks: TimelineRulerTick[] = [];
  const maxIndex = totalFrames;

  for (let f = 0; f <= maxIndex; f += minorStepFrames) {
    const isMajor = f === 0 || f % majorStepFrames === 0;
    const pct = (f / Math.max(1, maxIndex)) * 100;
    const secVal = f / safeFps;
    ticks.push({
      frame: f,
      percent: Number(pct.toFixed(4)),
      pixelLeft: frameToPixel(f, safeZoom, 0, safeFps),
      isMajor,
      showFrameDetail,
      timecodeLabel: formatTimecode(f, safeFps),
      shortTimecodeLabel: formatShortTimecode(f, safeFps),
      secondsLabel: `${secVal.toFixed(f % safeFps === 0 ? 0 : 1)}s`,
      frameLabel: `F${f}`,
    });
  }

  // Always include final frame tick if not crowding the last major tick
  const lastTick = ticks[ticks.length - 1];
  if (!lastTick || lastTick.frame < maxIndex) {
    const isFarEnough =
      !lastTick ||
      frameToPixel(maxIndex - lastTick.frame, safeZoom, 0, safeFps) >= 90;
    ticks.push({
      frame: maxIndex,
      percent: 100,
      pixelLeft: frameToPixel(maxIndex, safeZoom, 0, safeFps),
      isMajor: isFarEnough,
      showFrameDetail,
      timecodeLabel: formatTimecode(maxIndex, safeFps),
      shortTimecodeLabel: formatShortTimecode(maxIndex, safeFps),
      secondsLabel: `${(maxIndex / safeFps).toFixed(1)}s`,
      frameLabel: `F${maxIndex}`,
    });
  }

  return ticks;
}

/**
 * Resizes a SceneDrawingObject's bounding box (`width`, `height`) while:
 * 1. Supporting proportional scaling when `lockAspectRatio` is enabled
 *    (changing width automatically adjusts height, and vice versa).
 * 2. Scaling freehand paths (`brush`, `pen`, `bezier`) and `line`/`arrow` points
 *    using their bounding box while preserving their relative shape.
 */
export function resizeDrawingGeometry(
  drawing: SceneDrawingObject,
  requestedWidth?: number,
  requestedHeight?: number,
  lockAspectRatioOverride?: boolean
): Pick<SceneDrawingObject, 'width' | 'height' | 'points' | 'lockAspectRatio'> {
  const minSize = 16;
  const maxSize = 3840;
  const oldW = Math.max(minSize, drawing.width || 120);
  const oldH = Math.max(minSize, drawing.height || 120);
  const aspect = oldW / Math.max(1, oldH);
  const locked =
    lockAspectRatioOverride !== undefined
      ? lockAspectRatioOverride
      : Boolean(drawing.lockAspectRatio || drawing.tool === 'circle');

  let newW =
    requestedWidth !== undefined
      ? Math.max(minSize, Math.min(maxSize, Math.round(requestedWidth)))
      : oldW;
  let newH =
    requestedHeight !== undefined
      ? Math.max(minSize, Math.min(maxSize, Math.round(requestedHeight)))
      : oldH;

  if (locked) {
    if (requestedWidth !== undefined && requestedHeight === undefined) {
      newH = Math.max(
        minSize,
        Math.min(maxSize, Math.round(newW / Math.max(0.05, aspect)))
      );
    } else if (requestedHeight !== undefined && requestedWidth === undefined) {
      newW = Math.max(
        minSize,
        Math.min(maxSize, Math.round(newH * aspect))
      );
    } else if (requestedWidth !== undefined && requestedHeight !== undefined) {
      // Both dragged (e.g. corner handle): preserve original aspect ratio based on dominant delta
      const scaleRatio = Math.max(newW / oldW, newH / oldH);
      newW = Math.max(minSize, Math.min(maxSize, Math.round(oldW * scaleRatio)));
      newH = Math.max(minSize, Math.min(maxSize, Math.round(oldH * scaleRatio)));
    }
  }

  const ratioX = newW / Math.max(1, oldW);
  const ratioY = newH / Math.max(1, oldH);

  let nextPoints = drawing.points || [];
  if (nextPoints.length > 0 && (Math.abs(ratioX - 1) > 1e-4 || Math.abs(ratioY - 1) > 1e-4)) {
    nextPoints = nextPoints.map((pt) => ({
      x: Number((pt.x * ratioX).toFixed(2)),
      y: Number((pt.y * ratioY).toFixed(2)),
    }));
  }

  return {
    width: newW,
    height: newH,
    points: nextPoints,
    lockAspectRatio: locked,
  };
}

/**
 * Updates a Line or Arrow drawing object from explicit canvas start and end coordinates
 * `(startX, startY)` -> `(endX, endY)` and recalculates center `(x, y)`, `width`, `height`, and local `points`.
 */
/**
 * Updates a Line or Arrow drawing object from explicit canvas start and end coordinates
 * `(startX, startY)` -> `(endX, endY)` and recalculates center `(x, y)`, `width`, `height`, and local `points`.
 */
export function updateDrawingLineEndpoints(
  drawing: SceneDrawingObject,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Pick<SceneDrawingObject, 'x' | 'y' | 'width' | 'height' | 'points'> {
  const cx = Math.round((startX + endX) / 2);
  const cy = Math.round((startY + endY) / 2);
  const width = Math.max(16, Math.round(Math.abs(endX - startX)));
  const height = Math.max(16, Math.round(Math.abs(endY - startY)));
  return {
    x: cx,
    y: cy,
    width,
    height,
    points: [
      { x: Math.round(startX - cx), y: Math.round(startY - cy) },
      { x: Math.round(endX - cx), y: Math.round(endY - cy) },
    ],
  };
}

/**
 * Updates a single control point `pointIndex` of a Pen, Bezier, Brush, Line, or Arrow drawing
 * in canvas coordinates `(canvasX, canvasY)` and re-centers its bounding box `(x, y, width, height)`.
 */
export function updateDrawingControlPoint(
  drawing: SceneDrawingObject,
  pointIndex: number,
  canvasX: number,
  canvasY: number
): Pick<SceneDrawingObject, 'x' | 'y' | 'width' | 'height' | 'points'> {
  const worldPoints = (drawing.points || []).map((pt, idx) =>
    idx === pointIndex
      ? { x: Math.round(canvasX), y: Math.round(canvasY) }
      : { x: Math.round(drawing.x + pt.x), y: Math.round(drawing.y + pt.y) }
  );
  if (worldPoints.length === 0) {
    return {
      x: drawing.x,
      y: drawing.y,
      width: drawing.width,
      height: drawing.height,
      points: [],
    };
  }
  let minX = worldPoints[0].x;
  let maxX = worldPoints[0].x;
  let minY = worldPoints[0].y;
  let maxY = worldPoints[0].y;
  for (const p of worldPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  const width = Math.max(16, Math.round(maxX - minX));
  const height = Math.max(16, Math.round(maxY - minY));
  return {
    x: cx,
    y: cy,
    width,
    height,
    points: worldPoints.map((p) => ({
      x: Math.round(p.x - cx),
      y: Math.round(p.y - cy),
    })),
  };
}

/**
 * Computes the accurate geometric path length of a SceneDrawingObject for smooth
 * Draw-On, Stroke-Reveal, Moving-Light, and Neon-Trace animations.
 */
export function computeDrawingPathLength(drawing: SceneDrawingObject): number {
  const w = Math.max(16, drawing.width || 120);
  const h = Math.max(16, drawing.height || 120);

  if (
    (drawing.tool === 'brush' ||
      drawing.tool === 'pen' ||
      drawing.tool === 'bezier' ||
      drawing.tool === 'line' ||
      drawing.tool === 'arrow') &&
    drawing.points &&
    drawing.points.length >= 2
  ) {
    let total = 0;
    for (let i = 1; i < drawing.points.length; i++) {
      const dx = drawing.points[i].x - drawing.points[i - 1].x;
      const dy = drawing.points[i].y - drawing.points[i - 1].y;
      total += Math.hypot(dx, dy);
    }
    if (drawing.tool === 'arrow') {
      total += Math.max(28, (drawing.strokeWidth || 4) * 6.5);
    }
    return Math.max(24, Math.round(total));
  }

  if (drawing.tool === 'circle' || drawing.tool === 'ellipse') {
    // Ramanujan ellipse perimeter approximation
    const a = w / 2;
    const b = h / 2;
    const hVal = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    const perim =
      Math.PI * (a + b) * (1 + (3 * hVal) / (10 + Math.sqrt(4 - 3 * hVal)));
    return Math.max(48, Math.round(perim));
  }

  if (drawing.tool === 'rounded-rect') {
    const r = Math.min(w / 2, h / 2, Math.max(0, drawing.cornerRadius || 24));
    const straight = 2 * (w - 2 * r) + 2 * (h - 2 * r);
    const corners = 2 * Math.PI * r;
    return Math.max(48, Math.round(straight + corners));
  }

  return Math.max(48, Math.round(2 * (w + h)));
}

/**
 * Non-destructively trims a SceneDrawingObject's timeline start (`left`) or end (`right`) frame
 * without altering its geometric width or height.
 */
export function computeTrimmedDrawingClip(
  drawing: SceneDrawingObject,
  edge: 'left' | 'right',
  deltaTimelineFrames: number,
  maxTimelineFrames = 1800
): SceneDrawingObject {
  const minVisibleFrames = 5;
  const origStart = Math.max(0, drawing.startFrame ?? 0);
  const origDur = Math.max(
    minVisibleFrames,
    drawing.durationFrames ?? drawing.animationDurationFrames ?? 180
  );
  const origEnd = origStart + origDur;

  if (edge === 'left') {
    const maxStart = origEnd - minVisibleFrames;
    const newStart = Math.max(
      0,
      Math.min(maxStart, origStart + Math.round(deltaTimelineFrames))
    );
    const newDur = Math.max(minVisibleFrames, origEnd - newStart);
    return {
      ...drawing,
      startFrame: newStart,
      durationFrames: newDur,
    };
  } else {
    const maxDur = Math.max(minVisibleFrames, maxTimelineFrames - origStart);
    const newDur = Math.max(
      minVisibleFrames,
      Math.min(maxDur, origDur + Math.round(deltaTimelineFrames))
    );
    return {
      ...drawing,
      startFrame: origStart,
      durationFrames: newDur,
    };
  }
}

export interface SplitDrawingClipResult {
  ok: boolean;
  reason?: string;
  firstDrawing?: SceneDrawingObject;
  secondDrawing?: SceneDrawingObject;
}

/**
 * Splits a SceneDrawingObject's timeline clip at `playheadFrame` into two independent drawing objects
 * preserving the vector shape, glow, and animation settings.
 */
export function splitDrawingClipAtFrame(
  drawing: SceneDrawingObject,
  playheadFrame: number,
  newIdSuffix = `${Date.now().toString(36)}`,
  defaultDurationFrames = 180
): SplitDrawingClipResult {
  const clipStart = Math.max(0, drawing.startFrame ?? 0);
  const clipDur = Math.max(
    5,
    drawing.durationFrames ?? drawing.animationDurationFrames ?? defaultDurationFrames
  );
  const clipEnd = clipStart + clipDur;
  const minSegmentFrames = 2;

  if (
    playheadFrame < clipStart + minSegmentFrames ||
    playheadFrame > clipEnd - minSegmentFrames
  ) {
    return {
      ok: false,
      reason: `Move the playhead (currently F${playheadFrame}) inside "${drawing.name}" (F${clipStart}–F${clipEnd}) to split.`,
    };
  }

  const firstDur = playheadFrame - clipStart;
  const secondDur = clipEnd - playheadFrame;
  const baseName = drawing.name.replace(/\s*\(Part\s+\d+\)$/i, '');

  const firstDrawing: SceneDrawingObject = {
    ...JSON.parse(JSON.stringify(drawing)),
    name: `${baseName} (Part 1)`,
    startFrame: clipStart,
    durationFrames: firstDur,
  };

  const secondDrawing: SceneDrawingObject = {
    ...JSON.parse(JSON.stringify(drawing)),
    id: `draw-split-${newIdSuffix}`,
    name: `${baseName} (Part 2)`,
    startFrame: playheadFrame,
    durationFrames: secondDur,
  };

  return {
    ok: true,
    firstDrawing,
    secondDrawing,
  };
}

/**
 * Applies either a standard non-destructive trim (`ripple = false`) or a CapCut-style
 * Ripple Trim (`ripple = true`) to `targetClipId` and returns the updated `TimelineClip[]` array.
 */
export function applyClipTrimWithRipple(
  clips: TimelineClip[],
  targetClipId: string,
  edge: 'left' | 'right',
  deltaTimelineFrames: number,
  maxSourceFrames = 3600,
  ripple = false
): TimelineClip[] {
  const target = clips.find((c) => c.id === targetClipId);
  if (!target || target.locked) return clips;

  const trimmed = computeTrimmedClip(
    target,
    edge,
    deltaTimelineFrames,
    maxSourceFrames
  );

  if (!ripple) {
    return clips.map((c) => (c.id === targetClipId ? trimmed : c));
  }

  // In Ripple Trim mode:
  // - If trimming the left edge, keep the clip starting at its original startFrame and shift downstream clips
  // - If trimming the right edge, shift downstream clips on the same trackId by (newDuration - origDuration)
  const origStart = target.startFrame;
  const origEnd = target.startFrame + target.durationFrames;
  const durationDelta = trimmed.durationFrames - target.durationFrames;

  const rippleTrimmedTarget: TimelineClip =
    edge === 'left'
      ? {
          ...trimmed,
          startFrame: origStart,
        }
      : trimmed;

  return clips.map((c) => {
    if (c.id === targetClipId) return rippleTrimmedTarget;
    if (c.trackId === target.trackId && c.startFrame >= origEnd) {
      return {
        ...c,
        startFrame: Math.max(0, c.startFrame + durationDelta),
      };
    }
    return c;
  });
}

export interface SplitEligibility {
  canSplit: boolean;
  targetType: 'clip' | 'drawing' | 'webcam' | null;
  targetName: string;
  reason: string;
}

/**
 * Determines whether the currently selected video clip, drawing clip, or webcam overlay can be split at `playheadFrame`,
 * returning a clear explanation if the playhead is outside the selected clip or if the clip is locked.
 */
export function canSplitAtPlayhead(
  selectedClip: TimelineClip | null | undefined,
  selectedDrawing: SceneDrawingObject | null | undefined,
  playheadFrame: number,
  defaultDurationFrames = 180,
  selectedWebcam?: SceneWebcamOverlay | null
): SplitEligibility {
  const minSegmentFrames = 2;

  if (selectedWebcam) {
    if (selectedWebcam.locked) {
      return {
        canSplit: false,
        targetType: 'webcam',
        targetName: selectedWebcam.name,
        reason: `"${selectedWebcam.name}" is locked. Unlock the track to split.`,
      };
    }
    const startF = Math.max(0, selectedWebcam.startFrame ?? 0);
    const durF = Math.max(5, selectedWebcam.durationFrames ?? defaultDurationFrames);
    const endF = startF + durF;
    if (
      playheadFrame < startF + minSegmentFrames ||
      playheadFrame > endF - minSegmentFrames
    ) {
      return {
        canSplit: false,
        targetType: 'webcam',
        targetName: selectedWebcam.name,
        reason: `Playhead (F${playheadFrame}) is outside "${selectedWebcam.name}" (F${startF}–F${endF}). Move playhead inside clip to split.`,
      };
    }
    return {
      canSplit: true,
      targetType: 'webcam',
      targetName: selectedWebcam.name,
      reason: `Split "${selectedWebcam.name}" at frame F${playheadFrame} (S)`,
    };
  }

  if (selectedDrawing) {
    if (selectedDrawing.locked) {
      return {
        canSplit: false,
        targetType: 'drawing',
        targetName: selectedDrawing.name,
        reason: `"${selectedDrawing.name}" is locked. Unlock the track to split.`,
      };
    }
    const startF = Math.max(0, selectedDrawing.startFrame ?? 0);
    const durF = Math.max(
      5,
      selectedDrawing.durationFrames ??
        selectedDrawing.animationDurationFrames ??
        defaultDurationFrames
    );
    const endF = startF + durF;
    if (
      playheadFrame < startF + minSegmentFrames ||
      playheadFrame > endF - minSegmentFrames
    ) {
      return {
        canSplit: false,
        targetType: 'drawing',
        targetName: selectedDrawing.name,
        reason: `Playhead (F${playheadFrame}) is outside "${selectedDrawing.name}" (F${startF}–F${endF}). Move playhead inside clip to split.`,
      };
    }
    return {
      canSplit: true,
      targetType: 'drawing',
      targetName: selectedDrawing.name,
      reason: `Split "${selectedDrawing.name}" at frame F${playheadFrame} (S)`,
    };
  }

  if (selectedClip) {
    if (selectedClip.locked) {
      return {
        canSplit: false,
        targetType: 'clip',
        targetName: selectedClip.name,
        reason: `"${selectedClip.name}" is locked. Unlock the track to split.`,
      };
    }
    const startF = selectedClip.startFrame;
    const endF = selectedClip.startFrame + selectedClip.durationFrames;
    if (
      playheadFrame < startF + minSegmentFrames ||
      playheadFrame > endF - minSegmentFrames
    ) {
      return {
        canSplit: false,
        targetType: 'clip',
        targetName: selectedClip.name,
        reason: `Playhead (F${playheadFrame}) is outside "${selectedClip.name}" (F${startF}–F${endF}). Move playhead inside clip to split.`,
      };
    }
    return {
      canSplit: true,
      targetType: 'clip',
      targetName: selectedClip.name,
      reason: `Split "${selectedClip.name}" at frame F${playheadFrame} (S)`,
    };
  }

  return {
    canSplit: false,
    targetType: null,
    targetName: '',
    reason: 'Select a video, drawing, or webcam clip and place the playhead inside it to split (S).',
  };
}

export interface ClipFilmstripThumbDescriptor {
  index: number;
  timelineFrame: number;
  sourceFrame: number;
  sourceSeconds: number;
  timecodeLabel: string;
  sceneLabel: string;
  accentHue: number;
}

/**
 * Generates responsive filmstrip thumbnail descriptors across a video clip's pixel width,
 * mapping each tile to its exact source frame (`[trimStartFrames, sourceOutFrame]`) so
 * trimmed and split clips show the exact portion of the source recording they reference.
 */
export function computeClipFilmstripThumbs(
  clip: TimelineClip,
  fps = 30,
  clipWidthPx = 240
): ClipFilmstripThumbDescriptor[] {
  const safeFps = Math.max(1, Math.round(fps || 30));
  const count = Math.max(1, Math.min(30, Math.floor(Math.max(48, clipWidthPx) / 64)));
  const speed = Math.max(0.1, clip.playbackSpeed || 1);
  const inFrame = Math.max(0, clip.trimStartFrames || 0);
  const durFrames = Math.max(1, clip.durationFrames || 30);

  const thumbs: ClipFilmstripThumbDescriptor[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 0 : i / count;
    const frameOffset = Math.round(ratio * durFrames);
    const timelineFrame = clip.startFrame + frameOffset;
    const sourceFrame = inFrame + Math.round(frameOffset * speed);
    const sourceSeconds = Number((sourceFrame / safeFps).toFixed(1));
    const sceneIndex = Math.floor(sourceSeconds / 10) + 1;
    thumbs.push({
      index: i,
      timelineFrame,
      sourceFrame,
      sourceSeconds,
      timecodeLabel: formatShortTimecode(sourceFrame, safeFps),
      sceneLabel: `SC${sceneIndex}`,
      accentHue: (160 + sceneIndex * 38) % 360,
    });
  }
  return thumbs;
}

// ============================================================================
// WEBCAM OVERLAY SHAPE GEOMETRY, PERIMETER & KEYFRAME INTERPOLATION ENGINE
// ============================================================================

export interface WebcamShapeGeometryResult {
  /** Sampled contour vertices in local center-based coordinates [-w/2..w/2, -h/2..h/2] */
  contourPoints: { x: number; y: number }[];
  /** Editable anchor control points in local coordinates (for custom-bezier / organic-blob / curved-asymmetric) */
  controlAnchors: { x: number; y: number }[];
  /** Approximate closed perimeter length in pixels */
  perimeterLength: number;
}

/**
 * Generates a smooth closed Catmull-Rom / cardinal spline contour from `anchors` with `tension` (0.1..1.0).
 */
function sampleClosedSplineContour(
  anchors: { x: number; y: number }[],
  tension = 0.55,
  samplesPerSegment = 14
): { x: number; y: number }[] {
  const n = anchors.length;
  if (n < 3) return anchors;
  const safeTension = Math.max(0.1, Math.min(1, tension || 0.55));
  const out: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = anchors[(i - 1 + n) % n];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % n];
    const p3 = anchors[(i + 2) % n];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * safeTension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * safeTension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * safeTension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * safeTension * 2;

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const u = 1 - t;
      const x =
        u * u * u * p1.x +
        3 * u * u * t * cp1x +
        3 * u * t * t * cp2x +
        t * t * t * p2.x;
      const y =
        u * u * u * p1.y +
        3 * u * u * t * cp1y +
        3 * u * t * t * cp2y +
        t * t * t * p2.y;
      out.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    }
  }
  return out;
}

/**
 * Computes the true vector contour and perimeter length for any `SceneWebcamOverlay` shape,
 * supporting basic shapes, polygons, organic blobs, asymmetric pebbles, arches, and custom Bezier curves.
 */
export function computeWebcamShapeGeometry(
  webcam: Pick<
    SceneWebcamOverlay,
    | 'shape'
    | 'width'
    | 'height'
    | 'cornerRadius'
    | 'curveIntensity'
    | 'curveTension'
    | 'bezierPoints'
  >,
  inset = 0
): WebcamShapeGeometryResult {
  const w = Math.max(24, (webcam.width || 320) - inset * 2);
  const h = Math.max(24, (webcam.height || 320) - inset * 2);
  const rx = w / 2;
  const ry = h / 2;
  const intensity = Math.max(0, Math.min(100, webcam.curveIntensity ?? 50)) / 100;
  const tension = Math.max(0.15, Math.min(1, webcam.curveTension ?? 0.65));

  let contourPoints: { x: number; y: number }[] = [];
  let controlAnchors: { x: number; y: number }[] = [];

  if (
    webcam.shape === 'circle' ||
    webcam.shape === 'ellipse' ||
    webcam.shape === 'oval'
  ) {
    const radX = webcam.shape === 'circle' ? Math.min(rx, ry) : rx;
    const radY = webcam.shape === 'circle' ? Math.min(rx, ry) : ry;
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      contourPoints.push({
        x: Number((Math.cos(a) * radX).toFixed(2)),
        y: Number((Math.sin(a) * radY).toFixed(2)),
      });
    }
  } else if (webcam.shape === 'organic-blob') {
    const anchorsCount = 8;
    const wave = 0.08 + intensity * 0.2;
    const offsets = [1.0, 0.88 - wave * 0.4, 1.04 + wave * 0.5, 0.85, 0.98 + wave * 0.35, 0.86 - wave * 0.3, 1.02 + wave * 0.4, 0.9];
    for (let i = 0; i < anchorsCount; i++) {
      const angle = (i / anchorsCount) * Math.PI * 2 - Math.PI / 2;
      const rMul = offsets[i % offsets.length];
      controlAnchors.push({
        x: Number((Math.cos(angle) * rx * rMul).toFixed(2)),
        y: Number((Math.sin(angle) * ry * rMul).toFixed(2)),
      });
    }
    contourPoints = sampleClosedSplineContour(controlAnchors, tension, 12);
  } else if (webcam.shape === 'curved-asymmetric') {
    const asym = 0.1 + intensity * 0.22;
    controlAnchors = [
      { x: -rx * (0.15 - asym * 0.2), y: -ry * 0.94 },
      { x: rx * (0.85 + asym * 0.35), y: -ry * (0.48 - asym * 0.2) },
      { x: rx * 0.92, y: ry * (0.55 + asym * 0.25) },
      { x: rx * 0.08, y: ry * 0.95 },
      { x: -rx * (0.88 + asym * 0.2), y: ry * (0.42 - asym * 0.15) },
      { x: -rx * 0.82, y: -ry * (0.52 + asym * 0.2) },
    ];
    contourPoints = sampleClosedSplineContour(controlAnchors, tension, 14);
  } else if (webcam.shape === 'custom-bezier') {
    const rawPts =
      webcam.bezierPoints && webcam.bezierPoints.length >= 3
        ? webcam.bezierPoints
        : [
            { x: 0.0, y: -0.46 },
            { x: 0.44, y: -0.26 },
            { x: 0.45, y: 0.28 },
            { x: 0.02, y: 0.46 },
            { x: -0.44, y: 0.25 },
            { x: -0.42, y: -0.28 },
          ];
    controlAnchors = rawPts.map((pt) => ({
      x: Number((Math.max(-0.5, Math.min(0.5, pt.x)) * w).toFixed(2)),
      y: Number((Math.max(-0.5, Math.min(0.5, pt.y)) * h).toFixed(2)),
    }));
    contourPoints = sampleClosedSplineContour(controlAnchors, tension, 14);
  } else if (webcam.shape === 'arch') {
    // Editorial arch: semicircle dome on top, vertical sides, gently rounded base
    const archSteps = 28;
    for (let i = 0; i <= archSteps; i++) {
      const a = Math.PI + (i / archSteps) * Math.PI;
      contourPoints.push({
        x: Number((Math.cos(a) * rx).toFixed(2)),
        y: Number((-ry * 0.15 + Math.sin(a) * (ry * 0.85)).toFixed(2)),
      });
    }
    contourPoints.push({ x: rx, y: ry * 0.92 });
    contourPoints.push({ x: rx * 0.88, y: ry });
    contourPoints.push({ x: -rx * 0.88, y: ry });
    contourPoints.push({ x: -rx, y: ry * 0.92 });
  } else if (webcam.shape === 'rounded-hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      contourPoints.push({
        x: Number((Math.cos(a) * rx).toFixed(2)),
        y: Number((Math.sin(a) * ry).toFixed(2)),
      });
    }
  } else if (webcam.shape === 'octagon') {
    const cut = 0.29;
    contourPoints = [
      { x: -rx * (1 - cut), y: -ry },
      { x: rx * (1 - cut), y: -ry },
      { x: rx, y: -ry * (1 - cut) },
      { x: rx, y: ry * (1 - cut) },
      { x: rx * (1 - cut), y: ry },
      { x: -rx * (1 - cut), y: ry },
      { x: -rx, y: ry * (1 - cut) },
      { x: -rx, y: -ry * (1 - cut) },
    ];
  } else if (webcam.shape === 'diamond') {
    contourPoints = [
      { x: 0, y: -ry },
      { x: rx, y: 0 },
      { x: 0, y: ry },
      { x: -rx, y: 0 },
    ];
  } else if (webcam.shape === 'slanted-rect') {
    const slant = Math.min(rx * 0.36, Math.max(12, rx * (0.12 + intensity * 0.24)));
    contourPoints = [
      { x: -rx + slant, y: -ry },
      { x: rx, y: -ry },
      { x: rx - slant, y: ry },
      { x: -rx, y: ry },
    ];
  } else if (webcam.shape === 'cut-corner') {
    const chamfer = Math.min(w, h) * (0.12 + intensity * 0.1);
    contourPoints = [
      { x: -rx + chamfer, y: -ry },
      { x: rx - chamfer * 0.4, y: -ry },
      { x: rx, y: -ry + chamfer * 0.4 },
      { x: rx, y: ry - chamfer },
      { x: rx - chamfer, y: ry },
      { x: -rx + chamfer * 0.4, y: ry },
      { x: -rx, y: ry - chamfer * 0.4 },
      { x: -rx, y: -ry + chamfer },
    ];
  } else if (webcam.shape === 'speech-bubble') {
    const bodyBottom = ry * 0.74;
    contourPoints = [
      { x: -rx, y: -ry },
      { x: rx, y: -ry },
      { x: rx, y: bodyBottom },
      { x: -rx * 0.1, y: bodyBottom },
      { x: -rx * 0.48, y: ry },
      { x: -rx * 0.38, y: bodyBottom },
      { x: -rx, y: bodyBottom },
    ];
  } else if (webcam.shape === 'custom-svg') {
    // Shield / Crest silhouette
    contourPoints = [
      { x: 0, y: -ry },
      { x: rx * 0.94, y: -ry * 0.72 },
      { x: rx * 0.88, y: ry * 0.18 },
      { x: rx * 0.48, y: ry * 0.68 },
      { x: 0, y: ry },
      { x: -rx * 0.48, y: ry * 0.68 },
      { x: -rx * 0.88, y: ry * 0.18 },
      { x: -rx * 0.94, y: -ry * 0.72 },
    ];
  } else {
    // Rectangular family: rounded-rect, square, vertical-rect, horizontal-rect, capsule
    const halfW = webcam.shape === 'square' ? Math.min(rx, ry) : rx;
    const halfH = webcam.shape === 'square' ? Math.min(rx, ry) : ry;
    const rawR =
      webcam.shape === 'capsule'
        ? Math.min(halfW, halfH)
        : Math.max(0, webcam.cornerRadius ?? 36);
    const r = Math.min(halfW, halfH, rawR);
    const cornerSteps = 8;
    const corners = [
      { cx: halfW - r, cy: -halfH + r, startA: -Math.PI / 2 },
      { cx: halfW - r, cy: halfH - r, startA: 0 },
      { cx: -halfW + r, cy: halfH - r, startA: Math.PI / 2 },
      { cx: -halfW + r, cy: -halfH + r, startA: Math.PI },
    ];
    for (const c of corners) {
      for (let s = 0; s <= cornerSteps; s++) {
        const a = c.startA + (s / cornerSteps) * (Math.PI / 2);
        contourPoints.push({
          x: Number((c.cx + Math.cos(a) * r).toFixed(2)),
          y: Number((c.cy + Math.sin(a) * r).toFixed(2)),
        });
      }
    }
  }

  // Compute closed perimeter length
  let perimeterLength = 0;
  for (let i = 0; i < contourPoints.length; i++) {
    const curr = contourPoints[i];
    const next = contourPoints[(i + 1) % contourPoints.length];
    perimeterLength += Math.hypot(next.x - curr.x, next.y - curr.y);
  }

  return {
    contourPoints,
    controlAnchors,
    perimeterLength: Math.max(64, Math.round(perimeterLength)),
  };
}

/**
 * Convenience helper returning the exact closed perimeter length in pixels for a webcam overlay.
 */
export function computeWebcamPerimeterLength(
  webcam: Pick<
    SceneWebcamOverlay,
    | 'shape'
    | 'width'
    | 'height'
    | 'cornerRadius'
    | 'curveIntensity'
    | 'curveTension'
    | 'bezierPoints'
  >
): number {
  return computeWebcamShapeGeometry(webcam, 0).perimeterLength;
}

/**
 * Updates a single normalized Bezier control point (`[-0.5..0.5]`) on a `SceneWebcamOverlay`
 * and validates that the point remains inside safe bounds to prevent broken clipping masks.
 */
export function updateWebcamBezierPoint(
  webcam: SceneWebcamOverlay,
  pointIndex: number,
  normalizedX: number,
  normalizedY: number
): SceneWebcamOverlay {
  const basePts =
    webcam.bezierPoints && webcam.bezierPoints.length >= 3
      ? [...webcam.bezierPoints]
      : [
          { x: 0.0, y: -0.46 },
          { x: 0.44, y: -0.26 },
          { x: 0.45, y: 0.28 },
          { x: 0.02, y: 0.46 },
          { x: -0.44, y: 0.25 },
          { x: -0.42, y: -0.28 },
        ];
  if (pointIndex < 0 || pointIndex >= basePts.length) return webcam;

  const clampedX = Number(Math.max(-0.49, Math.min(0.49, normalizedX)).toFixed(3));
  const clampedY = Number(Math.max(-0.49, Math.min(0.49, normalizedY)).toFixed(3));
  basePts[pointIndex] = { x: clampedX, y: clampedY };

  return {
    ...webcam,
    shape: 'custom-bezier',
    bezierPoints: basePts,
  };
}

/**
 * Resolves a `SceneWebcamOverlay` at `frame` by applying timeline clip visibility `[startFrame, endFrame]`,
 * entrance/exit transitions, and multi-keyframe property interpolation.
 */
export function resolveWebcamAtFrame(
  webcam: SceneWebcamOverlay,
  keyframes: Keyframe[],
  frame: number,
  totalFrames = 180
): SceneWebcamOverlay {
  const clipStart = Math.max(0, webcam.startFrame ?? 0);
  const clipDuration = Math.max(1, webcam.durationFrames ?? totalFrames);
  const clipEnd = clipStart + clipDuration;

  if (frame < clipStart || frame > clipEnd) {
    return {
      ...webcam,
      opacity: 0,
      visible: false,
    };
  }

  let entranceOpacityMul = 1;
  let entranceScaleMul = 1;
  let entranceOffsetY = 0;
  const transitionFrames = Math.min(15, Math.floor(clipDuration * 0.25));

  if (
    webcam.entranceAnimation &&
    webcam.entranceAnimation !== 'none' &&
    transitionFrames > 0 &&
    frame - clipStart < transitionFrames
  ) {
    const p = evaluateEasing((frame - clipStart) / transitionFrames, 'ease-out');
    if (webcam.entranceAnimation === 'fade-in') {
      entranceOpacityMul = p;
    } else if (webcam.entranceAnimation === 'scale-pop') {
      entranceOpacityMul = p;
      entranceScaleMul = 0.55 + 0.45 * p;
    } else if (webcam.entranceAnimation === 'slide-up') {
      entranceOpacityMul = p;
      entranceOffsetY = (1 - p) * 60;
    }
  }

  let exitOpacityMul = 1;
  let exitScaleMul = 1;
  if (
    webcam.exitAnimation &&
    webcam.exitAnimation !== 'none' &&
    transitionFrames > 0 &&
    clipEnd - frame < transitionFrames
  ) {
    const p = evaluateEasing((clipEnd - frame) / transitionFrames, 'ease-in');
    if (webcam.exitAnimation === 'fade-out') {
      exitOpacityMul = p;
    } else if (webcam.exitAnimation === 'scale-down') {
      exitOpacityMul = p;
      exitScaleMul = 0.55 + 0.45 * p;
    }
  }

  if (!keyframes || keyframes.length === 0) {
    return {
      ...webcam,
      y: webcam.y + entranceOffsetY,
      scaleX: webcam.scaleX * entranceScaleMul * exitScaleMul,
      scaleY: webcam.scaleY * entranceScaleMul * exitScaleMul,
      opacity: Math.max(
        0,
        Math.min(1, webcam.opacity * entranceOpacityMul * exitOpacityMul)
      ),
    };
  }

  const interpolated = interpolateTrackAtFrame(keyframes, frame);
  const x = interpolated.x ?? webcam.x;
  const y = interpolated.y ?? webcam.y;
  const width = interpolated.width ?? webcam.width;
  const height = interpolated.height ?? webcam.height;
  const scaleX = interpolated.scaleX ?? webcam.scaleX;
  const scaleY = interpolated.scaleY ?? webcam.scaleY;
  const rotation = interpolated.rotation ?? webcam.rotation;
  const opacity = interpolated.opacity ?? webcam.opacity;
  const cornerRadius = interpolated.cornerRadius ?? webcam.cornerRadius;
  const borderWidth = interpolated.strokeWidth ?? webcam.borderWidth;
  const borderColor = interpolated.strokeColor ?? webcam.borderColor;
  const borderOpacity = interpolated.borderOpacity ?? webcam.borderOpacity;
  const glowRadius = interpolated.glowBlur ?? webcam.glowRadius;
  const glowIntensity = interpolated.glowIntensity ?? webcam.glowIntensity;
  const glowColor = interpolated.glowColor ?? webcam.glowColor;
  const zoom = interpolated.cropZoom ?? webcam.zoom;
  const panX = interpolated.panX ?? webcam.panX;
  const panY = interpolated.panY ?? webcam.panY;
  const borderAnimationProgress =
    interpolated.borderProgress ?? webcam.borderAnimationProgress ?? 1;
  const curveIntensity = interpolated.curveIntensity ?? webcam.curveIntensity;

  const hasGlowKeyframes = keyframes.some(
    (kf) => kf.properties.glowIntensity !== undefined
  );

  return {
    ...webcam,
    x,
    y: y + entranceOffsetY,
    width: Math.max(24, width),
    height: Math.max(24, height),
    scaleX: scaleX * entranceScaleMul * exitScaleMul,
    scaleY: scaleY * entranceScaleMul * exitScaleMul,
    rotation,
    opacity: Math.max(
      0,
      Math.min(1, opacity * entranceOpacityMul * exitOpacityMul)
    ),
    cornerRadius: Math.max(0, cornerRadius),
    borderWidth: Math.max(0, borderWidth),
    borderColor,
    borderOpacity: Math.max(0, Math.min(1, borderOpacity)),
    glowEnabled: hasGlowKeyframes
      ? glowIntensity > 0.01
      : webcam.glowEnabled,
    glowRadius: Math.max(0, glowRadius),
    glowIntensity: Math.max(0, glowIntensity),
    glowColor,
    zoom: Math.max(0.5, Math.min(4, zoom)),
    panX,
    panY,
    borderAnimationProgress: Math.max(0, Math.min(1, borderAnimationProgress)),
    curveIntensity: Math.max(0, Math.min(100, curveIntensity)),
  };
}

/**
 * Non-destructively trims a SceneWebcamOverlay's timeline start or end frame.
 */
export function computeTrimmedWebcamClip(
  webcam: SceneWebcamOverlay,
  edge: 'left' | 'right',
  deltaTimelineFrames: number,
  maxTimelineFrames = 1800
): SceneWebcamOverlay {
  const minVisibleFrames = 5;
  const origStart = Math.max(0, webcam.startFrame ?? 0);
  const origDur = Math.max(minVisibleFrames, webcam.durationFrames ?? 180);
  const origEnd = origStart + origDur;

  if (edge === 'left') {
    const maxStart = origEnd - minVisibleFrames;
    const newStart = Math.max(
      0,
      Math.min(maxStart, origStart + Math.round(deltaTimelineFrames))
    );
    const newDur = Math.max(minVisibleFrames, origEnd - newStart);
    return {
      ...webcam,
      startFrame: newStart,
      durationFrames: newDur,
    };
  } else {
    const maxDur = Math.max(minVisibleFrames, maxTimelineFrames - origStart);
    const newDur = Math.max(
      minVisibleFrames,
      Math.min(maxDur, origDur + Math.round(deltaTimelineFrames))
    );
    return {
      ...webcam,
      startFrame: origStart,
      durationFrames: newDur,
    };
  }
}

export interface SplitWebcamClipResult {
  ok: boolean;
  reason?: string;
  firstWebcam?: SceneWebcamOverlay;
  secondWebcam?: SceneWebcamOverlay;
}

export function splitWebcamClipAtFrame(
  webcam: SceneWebcamOverlay,
  playheadFrame: number,
  newIdSuffix = `${Date.now().toString(36)}`,
  defaultDurationFrames = 180
): SplitWebcamClipResult {
  const clipStart = Math.max(0, webcam.startFrame ?? 0);
  const clipDur = Math.max(5, webcam.durationFrames ?? defaultDurationFrames);
  const clipEnd = clipStart + clipDur;
  const minSegmentFrames = 2;

  if (
    playheadFrame < clipStart + minSegmentFrames ||
    playheadFrame > clipEnd - minSegmentFrames
  ) {
    return {
      ok: false,
      reason: `Move the playhead (currently F${playheadFrame}) inside "${webcam.name}" (F${clipStart}–F${clipEnd}) to split.`,
    };
  }

  const firstDur = playheadFrame - clipStart;
  const secondDur = clipEnd - playheadFrame;
  const baseName = webcam.name.replace(/\s*\(Part\s+\d+\)$/i, '');

  const firstWebcam: SceneWebcamOverlay = {
    ...JSON.parse(JSON.stringify(webcam)),
    name: `${baseName} (Part 1)`,
    startFrame: clipStart,
    durationFrames: firstDur,
  };

  const secondWebcam: SceneWebcamOverlay = {
    ...JSON.parse(JSON.stringify(webcam)),
    id: `webcam-split-${newIdSuffix}`,
    name: `${baseName} (Part 2)`,
    startFrame: playheadFrame,
    durationFrames: secondDur,
  };

  return {
    ok: true,
    firstWebcam,
    secondWebcam,
  };
}

/**
 * Generates the 5-keyframe showcase sequence described in Section 7:
 * - Frame 0: small (scale 0.45), opacity 0%, glow disabled (0%)
 * - Frame 15: scale 100%, opacity 100%
 * - Frame 30: border glow reaches 70% intensity
 * - Frame 60: webcam overlay moves smoothly to a new screen position
 * - Frame 90: border colour transitions to another colour
 */
export function generateWebcamShowcaseKeyframes(
  webcam: SceneWebcamOverlay
): Keyframe[] {
  const startX = webcam.x;
  const startY = webcam.y;
  const targetX = startX > 960 ? Math.max(320, startX - 260) : Math.min(1600, startX + 260);
  const targetY = startY > 540 ? Math.max(260, startY - 140) : Math.min(820, startY + 140);

  return [
    {
      id: `kf-wc-0`,
      frame: 0,
      easing: 'ease-out',
      properties: {
        x: startX,
        y: startY,
        width: webcam.width,
        height: webcam.height,
        scaleX: 0.45,
        scaleY: 0.45,
        rotation: webcam.rotation,
        opacity: 0,
        strokeWidth: webcam.borderWidth,
        strokeColor: webcam.borderColor,
        borderOpacity: webcam.borderOpacity,
        glowBlur: webcam.glowRadius,
        glowIntensity: 0,
        glowColor: webcam.glowColor,
        cropZoom: webcam.zoom,
      },
    },
    {
      id: `kf-wc-15`,
      frame: 15,
      easing: 'ease-in-out',
      properties: {
        x: startX,
        y: startY,
        width: webcam.width,
        height: webcam.height,
        scaleX: 1,
        scaleY: 1,
        rotation: webcam.rotation,
        opacity: 1,
        strokeWidth: webcam.borderWidth,
        strokeColor: webcam.borderColor,
        borderOpacity: webcam.borderOpacity,
        glowBlur: webcam.glowRadius,
        glowIntensity: 0,
        glowColor: webcam.glowColor,
        cropZoom: webcam.zoom,
      },
    },
    {
      id: `kf-wc-30`,
      frame: 30,
      easing: 'ease-in-out',
      properties: {
        x: startX,
        y: startY,
        width: webcam.width,
        height: webcam.height,
        scaleX: 1,
        scaleY: 1,
        rotation: webcam.rotation,
        opacity: 1,
        strokeWidth: webcam.borderWidth,
        strokeColor: webcam.borderColor,
        borderOpacity: webcam.borderOpacity,
        glowBlur: Math.max(28, webcam.glowRadius),
        glowIntensity: 0.7,
        glowColor: webcam.glowColor,
        cropZoom: webcam.zoom,
      },
    },
    {
      id: `kf-wc-60`,
      frame: 60,
      easing: 'cubic-bezier',
      properties: {
        x: targetX,
        y: targetY,
        width: webcam.width,
        height: webcam.height,
        scaleX: 1.05,
        scaleY: 1.05,
        rotation: webcam.rotation,
        opacity: 1,
        strokeWidth: webcam.borderWidth + 1,
        strokeColor: webcam.borderColor,
        borderOpacity: webcam.borderOpacity,
        glowBlur: Math.max(34, webcam.glowRadius),
        glowIntensity: 0.85,
        glowColor: webcam.glowColor,
        cropZoom: webcam.zoom,
      },
    },
    {
      id: `kf-wc-90`,
      frame: 90,
      easing: 'ease-in-out',
      properties: {
        x: targetX,
        y: targetY,
        width: webcam.width,
        height: webcam.height,
        scaleX: 1,
        scaleY: 1,
        rotation: webcam.rotation,
        opacity: 1,
        strokeWidth: webcam.borderWidth + 2,
        strokeColor: webcam.borderSecondaryColor || '#F43F5E',
        borderOpacity: 1,
        glowBlur: Math.max(38, webcam.glowRadius),
        glowIntensity: 0.95,
        glowColor: webcam.glowSecondaryColor || '#A855F7',
        cropZoom: webcam.zoom,
      },
    },
  ];
}

