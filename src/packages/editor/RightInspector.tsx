import React, { useEffect, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  Crop,
  Diamond,
  Eye,
  Film,
  FlipHorizontal,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Palette,
  PenTool,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Sliders,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  ANIMATION_PRESETS,
  DEFAULT_BROWSER_THEME,
  DEFAULT_CUSTOM_BEZIER,
  DEVICE_CATALOG,
  DEVICE_TRANSITION_PRESETS,
  EASING_FUNCTION_OPTIONS,
  TRANSITION_CATEGORIES,
  TRANSITION_PRESET_GROUPS,
  WEBCAM_SHAPE_LIBRARY,
  WEBCAM_STYLE_PRESETS,
  getDevicePresetById,
} from '../device-catalog/catalog.ts';
import {
  clampCustomBezierPoints,
  computeTransitionDelayFrames,
  evaluateEasing,
  fitCubicBezierFromStroke,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  resolveWebcamAtFrame,
  updateDrawingLineEndpoints,
} from '../scene-engine/math.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type {
  AnimationPresetId,
  CustomBezierControlPoints,
  DeviceFinishStyle,
  DeviceTransitionPreset,
  DrawingAnimationMode,
  EasingType,
  GlowAnimationMode,
  ObjectEffects,
  ScreenFitMode,
  TransitionPresetCategory,
  TransitionPresetGroup,
  TransitionTimingMode,
  WebcamBorderAnimationMode,
  WebcamFrameShapeType,
} from '../shared/types.ts';

type InspectorTab = 'transform' | 'style' | 'media' | 'effects' | 'animation';

interface ThumbnailPose {
  tx: number;
  ty: number;
  scale: number;
  rotZ: number;
  rotX: number;
  rotY: number;
  opacity: number;
  glowBlur: number;
  glowColor: string;
  ghostTx: number;
  ghostTy: number;
  ghostScale: number;
  ghostRotZ: number;
  trajectoryPath: string;
}

function computeTransitionThumbnailPose(
  presetId: AnimationPresetId,
  rawT: number,
  easing: EasingType,
  startOpacity = 0,
  endOpacity = 1,
  customBezier?: CustomBezierControlPoints
): ThumbnailPose {
  const t = Math.max(0, Math.min(1, rawT));
  const eased = evaluateEasing(t, easing, customBezier);
  const clampedStartOp = Math.max(0, Math.min(1, startOpacity));
  const clampedEndOp = Math.max(0, Math.min(1, endOpacity));

  const pose: ThumbnailPose = {
    tx: 0,
    ty: 0,
    scale: 1,
    rotZ: 0,
    rotX: 0,
    rotY: 0,
    opacity: 1,
    glowBlur: 0,
    glowColor: 'rgba(56, 189, 248, 0.7)',
    ghostTx: 0,
    ghostTy: 0,
    ghostScale: 1,
    ghostRotZ: 0,
    trajectoryPath: 'M 32 32 L 64 32',
  };

  switch (presetId) {
    case 'slide-in':
      pose.tx = (1 - eased) * 28;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.scale = 0.92 + 0.08 * eased;
      pose.ghostTx = 24;
      pose.trajectoryPath = 'M 78 32 L 48 32 M 54 27 L 48 32 L 54 37';
      break;
    case 'slide-in-left':
      pose.tx = (1 - eased) * -28;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.scale = 0.92 + 0.08 * eased;
      pose.ghostTx = -24;
      pose.trajectoryPath = 'M 18 32 L 48 32 M 42 27 L 48 32 L 42 37';
      break;
    case 'slide-in-up':
      pose.ty = (1 - eased) * 20;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.scale = 0.92 + 0.08 * eased;
      pose.ghostTy = 17;
      pose.trajectoryPath = 'M 48 54 L 48 32 M 43 38 L 48 32 L 53 38';
      break;
    case 'slide-in-down':
      pose.ty = (1 - eased) * -20;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.scale = 0.92 + 0.08 * eased;
      pose.ghostTy = -17;
      pose.trajectoryPath = 'M 48 10 L 48 32 M 43 26 L 48 32 L 53 26';
      break;
    case 'device-slide-in':
      pose.tx = (1 - eased) * 24;
      pose.ty = (1 - eased) * 15;
      pose.rotZ = (1 - eased) * 14;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.ghostTx = 20;
      pose.ghostTy = 13;
      pose.ghostRotZ = 14;
      pose.trajectoryPath = 'M 74 48 L 48 32 M 55 31 L 48 32 L 51 38';
      break;
    case 'slide-out':
      pose.tx = eased * 28;
      pose.opacity = 1 - 0.88 * eased;
      pose.scale = 1 - 0.08 * eased;
      pose.ghostTx = 0;
      pose.trajectoryPath = 'M 48 32 L 78 32 M 72 27 L 78 32 L 72 37';
      break;
    case 'fade':
      pose.opacity = 0.08 + 0.92 * eased;
      pose.scale = 0.95 + 0.05 * eased;
      pose.glowBlur = Math.sin(t * Math.PI) * 10;
      pose.trajectoryPath =
        'M 32 32 A 16 16 0 1 1 64 32 A 16 16 0 1 1 32 32';
      break;
    case 'fade-up':
      pose.ty = (1 - eased) * 14;
      pose.opacity = 0.08 + 0.92 * eased;
      pose.ghostTy = 13;
      pose.trajectoryPath = 'M 48 48 L 48 32 M 43 37 L 48 32 L 53 37';
      break;
    case 'fade-in-out': {
      const env =
        t < 0.35
          ? evaluateEasing(t / 0.35, easing)
          : t > 0.7
            ? 1 - evaluateEasing((t - 0.7) / 0.3, easing)
            : 1;
      pose.opacity = 0.08 + 0.92 * env;
      pose.scale = 0.94 + 0.06 * env;
      pose.trajectoryPath = 'M 22 44 Q 48 16 74 44';
      break;
    }
    case 'fade-out':
      pose.opacity = 1 - 0.92 * eased;
      pose.scale = 1 - 0.06 * eased;
      pose.trajectoryPath =
        'M 36 32 A 12 12 0 1 0 60 32 A 12 12 0 1 0 36 32';
      break;
    case 'zoom':
      pose.scale = 0.42 + 0.58 * eased;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.ghostScale = 0.45;
      pose.trajectoryPath =
        'M 34 42 L 24 50 M 62 22 L 72 14 M 34 22 L 24 14 M 62 42 L 72 50';
      break;
    case 'zoom-in':
      pose.scale =
        t < 0.65
          ? 0.55 + 0.68 * evaluateEasing(t / 0.65, easing)
          : 1.23 - 0.23 * evaluateEasing((t - 0.65) / 0.35, easing);
      pose.opacity = Math.min(1, 0.25 + t * 1.8);
      pose.ghostScale = 0.55;
      pose.trajectoryPath = 'M 36 40 L 26 48 M 60 24 L 70 16';
      break;
    case 'zoom-out':
      pose.scale = 1.48 - 0.48 * eased;
      pose.opacity = 0.2 + 0.8 * eased;
      pose.ghostScale = 1.4;
      pose.trajectoryPath =
        'M 24 14 L 34 22 M 72 14 L 62 22 M 24 50 L 34 42 M 72 50 L 62 42';
      break;
    case 'zoom-bounce': {
      const sp = evaluateEasing(t, 'spring');
      pose.scale = 0.38 + 0.62 * sp;
      pose.opacity = Math.min(1, 0.2 + t * 2);
      pose.ghostScale = 0.42;
      pose.trajectoryPath = 'M 30 32 C 36 14, 60 14, 66 32';
      break;
    }
    case 'zoom-punch-out':
      pose.scale = 1 + 0.55 * eased;
      pose.opacity = 1 - 0.92 * eased;
      pose.ghostScale = 1;
      pose.trajectoryPath =
        'M 36 24 L 22 12 M 60 24 L 74 12 M 36 40 L 22 52 M 60 40 L 74 52';
      break;
    case 'flip-3d':
      pose.rotY = (1 - eased) * -68;
      pose.scale = 0.78 + 0.22 * eased;
      pose.opacity = 0.25 + 0.75 * eased;
      pose.trajectoryPath = 'M 26 36 C 36 18, 60 18, 70 36';
      break;
    case 'tilt-reveal-3d':
      pose.rotX = (1 - eased) * 52;
      pose.ty = (1 - eased) * 10;
      pose.scale = 0.84 + 0.16 * eased;
      pose.trajectoryPath = 'M 48 52 C 34 42, 34 24, 48 14';
      break;
    case 'rotation-reveal':
      pose.rotY = -42 + eased * 64;
      pose.rotX = 18 - eased * 26;
      pose.trajectoryPath = 'M 22 38 C 38 16, 58 16, 74 30';
      break;
    case 'camera-push-in':
      pose.scale = 0.72 + 0.42 * eased;
      pose.rotX = (1 - eased) * 18;
      pose.glowBlur = eased * 10;
      pose.trajectoryPath = 'M 32 46 L 44 34 M 64 46 L 52 34';
      break;
    case 'smooth-scale': {
      const wave = Math.sin(t * Math.PI * 2);
      pose.scale = 1 + 0.16 * wave;
      pose.trajectoryPath = 'M 24 32 Q 36 18 48 32 T 72 32';
      break;
    }
    case 'floating-motion': {
      const wave = Math.sin(t * Math.PI * 2);
      pose.ty = wave * -8;
      pose.rotZ = Math.cos(t * Math.PI * 2) * 5;
      pose.trajectoryPath = 'M 24 32 Q 36 16 48 32 T 72 32';
      break;
    }
    case 'glow-pulse': {
      const pulse = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      pose.glowBlur = 4 + pulse * 16;
      pose.scale = 0.96 + pulse * 0.08;
      pose.trajectoryPath =
        'M 30 32 A 18 18 0 1 1 66 32 A 18 18 0 1 1 30 32';
      break;
    }
    case 'neon-border-sweep': {
      const pulse = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      pose.glowBlur = 8 + pulse * 12;
      pose.glowColor =
        t < 0.33
          ? 'rgba(56, 189, 248, 0.85)'
          : t < 0.66
            ? 'rgba(168, 85, 247, 0.85)'
            : 'rgba(236, 72, 153, 0.85)';
      pose.trajectoryPath = 'M 28 16 L 68 16 L 68 48 L 28 48 Z';
      break;
    }
    case 'spring-bounce': {
      const sp = evaluateEasing(t, 'spring');
      pose.ty = (1 - sp) * -22;
      pose.scale = 0.85 + 0.15 * sp;
      pose.ghostTy = -20;
      pose.trajectoryPath = 'M 48 10 L 48 36 M 43 30 L 48 36 L 53 30';
      break;
    }
  }
  if (presetId === 'fade-in-out') {
    const env =
      t < 0.35
        ? evaluateEasing(t / 0.35, easing, customBezier)
        : t > 0.7
          ? 1 - evaluateEasing((t - 0.7) / 0.3, easing, customBezier)
          : 1;
    pose.opacity = clampedStartOp + (clampedEndOp - clampedStartOp) * env;
  } else {
    pose.opacity = clampedStartOp + (clampedEndOp - clampedStartOp) * eased;
  }
  return pose;
}

const TransitionPresetThumbnail: React.FC<{
  preset: DeviceTransitionPreset;
  easing: EasingType;
  customBezier?: CustomBezierControlPoints;
  durationMs: number;
  startOpacity: number;
  endOpacity: number;
  motionBlurEnabled?: boolean;
  motionBlurIntensity?: number;
  loopTransition?: boolean;
  isHovering: boolean;
  isApplied: boolean;
  onApply: () => void;
}> = ({
  preset,
  easing,
  customBezier,
  durationMs,
  startOpacity,
  endOpacity,
  motionBlurEnabled = false,
  motionBlurIntensity = 0,
  loopTransition = false,
  isHovering,
  isApplied,
  onApply,
}) => {
  const [progress, setProgress] = useState<number>(0.35);

  useEffect(() => {
    let rafId = 0;
    const startMs = performance.now();
    const cycleMs = Math.max(350, Math.min(2200, durationMs));
    const holdMs = loopTransition ? 0 : 240;
    const totalCycle = cycleMs + holdMs;

    const tick = (now: number) => {
      const elapsed = (now - startMs) % totalCycle;
      const rawT = Math.min(1, elapsed / cycleMs);
      setProgress(rawT);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    preset.id,
    easing,
    customBezier?.x1,
    customBezier?.y1,
    customBezier?.x2,
    customBezier?.y2,
    durationMs,
    startOpacity,
    endOpacity,
    motionBlurEnabled,
    motionBlurIntensity,
    loopTransition,
  ]);

  const pose = computeTransitionThumbnailPose(
    preset.id,
    progress,
    easing,
    startOpacity,
    endOpacity,
    customBezier
  );
  const effectiveMb =
    motionBlurEnabled && motionBlurIntensity > 0
      ? Math.max(0, Math.min(1, motionBlurIntensity))
      : 0;
  const trailPose1 =
    effectiveMb > 0
      ? computeTransitionThumbnailPose(
          preset.id,
          Math.max(0, progress - 0.07 * (0.5 + effectiveMb)),
          easing,
          startOpacity,
          endOpacity,
          customBezier
        )
      : null;
  const trailPose2 =
    effectiveMb > 0
      ? computeTransitionThumbnailPose(
          preset.id,
          Math.max(0, progress - 0.14 * (0.5 + effectiveMb)),
          easing,
          startOpacity,
          endOpacity,
          customBezier
        )
      : null;
  const motionEnvelope = Math.sin(progress * Math.PI);
  const activeThumbBlurPx =
    effectiveMb > 0 ? Number((effectiveMb * 2.6 * motionEnvelope).toFixed(2)) : 0;

  return (
    <div
      data-testid="transition-hover-preview"
      role="region"
      aria-label={`Animation thumbnail preview for ${preset.name}`}
      className={`rounded-lg border p-2 transition-all ${
        isHovering
          ? 'bg-blue-50/70 border-blue-400 shadow-xs'
          : 'bg-slate-50/90 border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* Miniature Studio Stage Animation Thumbnail */}
        <div
          data-testid="transition-animation-thumbnail"
          title={`Live animation thumbnail preview: ${preset.name} (${durationMs}ms, ${easing}${
            effectiveMb > 0 ? `, Motion Blur ${Math.round(effectiveMb * 100)}%` : ''
          })`}
          className="w-24 h-16 rounded-md bg-slate-900 border border-slate-700/90 relative overflow-hidden shrink-0 flex items-center justify-center"
          style={{ perspective: '180px' }}
        >
          {/* Stage Grid & Trajectory SVG */}
          <svg
            viewBox="0 0 96 64"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <line
              x1="0"
              y1="32"
              x2="96"
              y2="32"
              stroke="rgba(148, 163, 184, 0.14)"
              strokeWidth="1"
            />
            <line
              x1="48"
              y1="0"
              x2="48"
              y2="64"
              stroke="rgba(148, 163, 184, 0.14)"
              strokeWidth="1"
            />
            <path
              d={pose.trajectoryPath}
              fill="none"
              stroke="rgba(56, 189, 248, 0.45)"
              strokeWidth="1.25"
              strokeDasharray="2.5 2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Ghost Start-Pose Wireframe */}
          <div
            className="w-6 h-10 rounded-[4px] border border-dashed border-slate-500/45 absolute pointer-events-none"
            style={{
              transform: `translate3d(${pose.ghostTx}px, ${pose.ghostTy}px, 0px) scale(${pose.ghostScale}) rotateZ(${pose.ghostRotZ}deg)`,
            }}
          />

          {/* Directional Motion Blur Echo Trails */}
          {trailPose2 && effectiveMb > 0 && (
            <div
              data-testid="transition-thumbnail-motion-blur-trail"
              className="w-6 h-10 rounded-[4px] bg-sky-400/35 absolute pointer-events-none"
              style={{
                transform: `translate3d(${trailPose2.tx.toFixed(2)}px, ${trailPose2.ty.toFixed(2)}px, 0px) scale(${trailPose2.scale.toFixed(3)}) rotateX(${trailPose2.rotX.toFixed(1)}deg) rotateY(${trailPose2.rotY.toFixed(1)}deg) rotateZ(${trailPose2.rotZ.toFixed(1)}deg)`,
                opacity: Number((trailPose2.opacity * effectiveMb * 0.28).toFixed(3)),
                filter: `blur(${(1.2 + effectiveMb * 2.5).toFixed(1)}px)`,
              }}
            />
          )}
          {trailPose1 && effectiveMb > 0 && (
            <div
              className="w-6 h-10 rounded-[4px] bg-sky-400/50 absolute pointer-events-none"
              style={{
                transform: `translate3d(${trailPose1.tx.toFixed(2)}px, ${trailPose1.ty.toFixed(2)}px, 0px) scale(${trailPose1.scale.toFixed(3)}) rotateX(${trailPose1.rotX.toFixed(1)}deg) rotateY(${trailPose1.rotY.toFixed(1)}deg) rotateZ(${trailPose1.rotZ.toFixed(1)}deg)`,
                opacity: Number((trailPose1.opacity * effectiveMb * 0.45).toFixed(3)),
                filter: `blur(${(0.8 + effectiveMb * 1.8).toFixed(1)}px)`,
              }}
            />
          )}

          {/* Live Animated Miniature Device Mockup */}
          <div
            data-testid="transition-thumbnail-device"
            className="w-6 h-10 rounded-[4px] border border-sky-300 bg-gradient-to-br from-sky-400/90 via-blue-600/90 to-indigo-700/95 relative flex flex-col items-center pt-1 shadow-xs"
            style={{
              transform: `translate3d(${pose.tx.toFixed(2)}px, ${pose.ty.toFixed(2)}px, 0px) scale(${pose.scale.toFixed(3)}) rotateX(${pose.rotX.toFixed(1)}deg) rotateY(${pose.rotY.toFixed(1)}deg) rotateZ(${pose.rotZ.toFixed(1)}deg)`,
              opacity: Number(pose.opacity.toFixed(3)),
              filter:
                activeThumbBlurPx > 0.05
                  ? `blur(${activeThumbBlurPx}px)`
                  : undefined,
              boxShadow:
                pose.glowBlur > 0
                  ? `0 0 ${pose.glowBlur.toFixed(1)}px ${pose.glowColor}`
                  : '0 2px 6px rgba(15, 23, 42, 0.5)',
            }}
          >
            <div className="w-2.5 h-0.5 rounded-full bg-slate-950/80" />
            <div className="w-4 h-6 mt-0.5 rounded-[2px] bg-white/20 border border-white/25" />
          </div>

          {/* Top-Left Category Tag */}
          <span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-950/80 text-[8px] font-mono font-semibold text-sky-300 border border-sky-500/30 leading-tight">
            {preset.shortLabel}
          </span>

          {/* Bottom Progress Scrub Bar */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800">
            <div
              className="h-full bg-sky-400"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Metadata & Preview-Before-Apply Controls */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isHovering
                  ? 'bg-blue-600 text-white'
                  : isApplied
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <Eye className="w-2.5 h-2.5" />
              <span>
                {isHovering
                  ? 'Hover Preview'
                  : isApplied
                    ? 'Applied Preset'
                    : 'Preview · Ready'}
              </span>
            </span>
            <span className="text-[9px] font-mono text-slate-500 shrink-0">
              {durationMs}ms · {Math.round(startOpacity * 100)}%→
              {Math.round(endOpacity * 100)}%
              {effectiveMb > 0 ? ` · MB ${Math.round(effectiveMb * 100)}%` : ''}
              {loopTransition ? ' · Loop ∞' : ''} · {easing}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {preset.name}
            </div>
            <button
              type="button"
              onClick={onApply}
              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold shrink-0 cursor-pointer transition-colors"
            >
              {isApplied ? 'Re-Apply' : 'Apply'}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 line-clamp-1">
            {preset.description}
          </p>
        </div>
      </div>
    </div>
  );
};

const TransitionGalleryVisualPreview: React.FC<{
  preset: DeviceTransitionPreset;
  easing: EasingType;
  customBezier?: CustomBezierControlPoints;
  durationMs: number;
  startOpacity: number;
  endOpacity: number;
  isActive: boolean;
  testIdPrefix: string;
}> = ({
  preset,
  easing,
  customBezier,
  durationMs,
  startOpacity,
  endOpacity,
  isActive,
  testIdPrefix,
}) => {
  const [progress, setProgress] = useState<number>(0.58);

  useEffect(() => {
    if (!isActive) {
      setProgress(0.58);
      return;
    }
    let rafId = 0;
    const startMs = performance.now();
    const cycleMs = Math.max(350, Math.min(2000, durationMs));
    const totalCycle = cycleMs + 180;

    const tick = (now: number) => {
      const elapsed = (now - startMs) % totalCycle;
      const rawT = Math.min(1, elapsed / cycleMs);
      setProgress(rawT);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, preset.id, durationMs]);

  const pose = computeTransitionThumbnailPose(
    preset.id,
    progress,
    easing,
    startOpacity,
    endOpacity,
    customBezier
  );
  const trailPose = computeTransitionThumbnailPose(
    preset.id,
    Math.max(0, progress - 0.22),
    easing,
    startOpacity,
    endOpacity,
    customBezier
  );

  const categoryColorClass =
    preset.category === 'Slide'
      ? 'text-sky-300 border-sky-500/40 bg-sky-950/80'
      : preset.category === 'Fade'
        ? 'text-violet-300 border-violet-500/40 bg-violet-950/80'
        : preset.category === 'Zoom'
          ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/80'
          : preset.category === '3D'
            ? 'text-amber-300 border-amber-500/40 bg-amber-950/80'
            : 'text-pink-300 border-pink-500/40 bg-pink-950/80';

  return (
    <div
      data-testid={`${testIdPrefix}-visual-preview-${preset.id}`}
      data-visual-preview={preset.id}
      data-category={preset.category}
      aria-label={`Visual preview of ${preset.name} (${preset.category})`}
      className={`w-full h-12 rounded bg-slate-900 border relative overflow-hidden flex items-center justify-center shrink-0 transition-colors ${
        isActive ? 'border-blue-400 shadow-xs' : 'border-slate-700/90'
      }`}
      style={{ perspective: '160px' }}
    >
      {/* Stage Grid & Motion Trajectory Vector Path */}
      <svg
        viewBox="0 0 96 64"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <line
          x1="0"
          y1="32"
          x2="96"
          y2="32"
          stroke="rgba(148, 163, 184, 0.14)"
          strokeWidth="1"
        />
        <line
          x1="48"
          y1="0"
          x2="48"
          y2="64"
          stroke="rgba(148, 163, 184, 0.14)"
          strokeWidth="1"
        />
        <path
          d={pose.trajectoryPath}
          fill="none"
          stroke={isActive ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.45)'}
          strokeWidth="1.4"
          strokeDasharray="2.5 2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Ghost Start-Pose Wireframe */}
      <div
        className="w-5 h-8 rounded-[3px] border border-dashed border-slate-500/45 absolute pointer-events-none"
        style={{
          transform: `translate3d(${(pose.ghostTx * 0.78).toFixed(1)}px, ${(pose.ghostTy * 0.78).toFixed(1)}px, 0px) scale(${pose.ghostScale}) rotateZ(${pose.ghostRotZ}deg)`,
        }}
      />

      {/* Motion Trail Echo */}
      <div
        className="w-5 h-8 rounded-[3px] bg-sky-400/25 border border-sky-400/30 absolute pointer-events-none"
        style={{
          transform: `translate3d(${(trailPose.tx * 0.78).toFixed(1)}px, ${(trailPose.ty * 0.78).toFixed(1)}px, 0px) scale(${(trailPose.scale * 0.95).toFixed(2)}) rotateX(${trailPose.rotX.toFixed(1)}deg) rotateY(${trailPose.rotY.toFixed(1)}deg) rotateZ(${trailPose.rotZ.toFixed(1)}deg)`,
          opacity: Number((trailPose.opacity * 0.35).toFixed(2)),
        }}
      />

      {/* Animated Miniature 3D Device Mockup */}
      <div
        data-testid={`${testIdPrefix}-preview-device-${preset.id}`}
        className="w-5 h-8 rounded-[3px] border border-sky-300 bg-gradient-to-br from-sky-400/90 via-blue-600/90 to-indigo-700/95 relative flex flex-col items-center pt-0.5 shadow-2xs pointer-events-none"
        style={{
          transform: `translate3d(${(pose.tx * 0.78).toFixed(1)}px, ${(pose.ty * 0.78).toFixed(1)}px, 0px) scale(${pose.scale.toFixed(2)}) rotateX(${pose.rotX.toFixed(1)}deg) rotateY(${pose.rotY.toFixed(1)}deg) rotateZ(${pose.rotZ.toFixed(1)}deg)`,
          opacity: Number(pose.opacity.toFixed(2)),
          boxShadow:
            pose.glowBlur > 0
              ? `0 0 ${Math.min(12, pose.glowBlur).toFixed(1)}px ${pose.glowColor}`
              : '0 1px 4px rgba(15, 23, 42, 0.5)',
        }}
      >
        <div className="w-2 h-0.5 rounded-full bg-slate-950/80" />
        <div className="w-3.5 h-5 mt-0.5 rounded-[1.5px] bg-white/20 border border-white/25" />
      </div>

      {/* Top-Left Category Badge */}
      <span
        className={`absolute top-1 left-1 px-1 py-0.2 rounded text-[7px] font-mono font-semibold border leading-tight pointer-events-none ${categoryColorClass}`}
      >
        {preset.category}
      </span>

      {/* Top-Right Duration Badge */}
      <span className="absolute top-1 right-1 px-1 py-0.2 rounded bg-slate-950/75 text-[7px] font-mono text-slate-300 border border-slate-700/80 leading-tight pointer-events-none">
        {preset.defaultDurationFrames}f
      </span>

      {/* Bottom Progress Scrub Bar */}
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-800 pointer-events-none">
        <div
          className="h-full bg-sky-400"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
};

const EASING_CURVE_SPECS: Record<
  EasingType,
  {
    formula: string;
    badge: string;
    accentColor: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
  }
> = {
  linear: {
    formula: 'f(t) = t',
    badge: 'Uniform 1:1',
    accentColor: '#2563EB',
    p1: { x: 0.33, y: 0.33 },
    p2: { x: 0.67, y: 0.67 },
  },
  'ease-in': {
    formula: 'f(t) = t³',
    badge: 'Slow → Fast',
    accentColor: '#4F46E5',
    p1: { x: 0.55, y: 0.05 },
    p2: { x: 0.68, y: 0.19 },
  },
  'ease-out': {
    formula: 'f(t) = 1 - (1 - t)³',
    badge: 'Fast → Smooth',
    accentColor: '#0284C7',
    p1: { x: 0.22, y: 0.61 },
    p2: { x: 0.36, y: 1.0 },
  },
  'ease-in-out': {
    formula: '4t³ / 1 - (-2t+2)³/2',
    badge: 'Symmetric S',
    accentColor: '#7C3AED',
    p1: { x: 0.65, y: 0.0 },
    p2: { x: 0.35, y: 1.0 },
  },
  'cubic-bezier': {
    formula: '1 - (1 - t)⁴',
    badge: 'Studio S-Curve',
    accentColor: '#0EA5E9',
    p1: { x: 0.16, y: 1.0 },
    p2: { x: 0.3, y: 1.0 },
  },
  spring: {
    formula: '2⁻⁹ᵗ·sin((9t-0.75)·2π/3)+1',
    badge: 'Spring Overshoot',
    accentColor: '#10B981',
    p1: { x: 0.25, y: 1.18 },
    p2: { x: 0.52, y: 0.96 },
  },
  'custom-path': {
    formula: 'cubic-bezier(x1, y1, x2, y2)',
    badge: 'Custom Path',
    accentColor: '#EC4899',
    p1: { x: 0.25, y: 0.85 },
    p2: { x: 0.35, y: 1.0 },
  },
};

const CUSTOM_BEZIER_SHAPE_PRESETS: {
  id: string;
  label: string;
  points: CustomBezierControlPoints;
}[] = [
  {
    id: 'snappy-overshoot',
    label: 'Overshoot',
    points: { x1: 0.34, y1: 1.42, x2: 0.64, y2: 1.0 },
  },
  {
    id: 'anticipate-snap',
    label: 'Anticipate',
    points: { x1: 0.36, y1: -0.32, x2: 0.26, y2: 1.0 },
  },
  {
    id: 'whip-in-out',
    label: 'Whip S',
    points: { x1: 0.85, y1: 0.0, x2: 0.15, y2: 1.0 },
  },
  {
    id: 'expo-glide',
    label: 'Expo Out',
    points: { x1: 0.16, y1: 1.0, x2: 0.3, y2: 1.0 },
  },
];

const InteractiveEasingCurveGraph: React.FC<{
  easing: EasingType;
  customBezier: CustomBezierControlPoints;
  durationMs: number;
  onSelectEasing: (nextEasing: EasingType) => void;
  onChangeCustomBezier: (nextBezier: CustomBezierControlPoints) => void;
  idPrefix: string;
}> = ({
  easing,
  customBezier,
  durationMs,
  onSelectEasing,
  onChangeCustomBezier,
  idPrefix,
}) => {
  const [probeT, setProbeT] = useState<number>(0.35);
  const [isPointerActive, setIsPointerActive] = useState<boolean>(false);
  const [draggingHandle, setDraggingHandle] = useState<'p1' | 'p2' | null>(
    null
  );
  const [isDrawPathMode, setIsDrawPathMode] = useState<boolean>(false);
  const [isDrawingStroke, setIsDrawingStroke] = useState<boolean>(false);
  const [drawnStrokePoints, setDrawnStrokePoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [drawCycleIdx, setDrawCycleIdx] = useState<number>(0);

  const clampedCb = clampCustomBezierPoints(customBezier);
  const isCustomPath = easing === 'custom-path';
  const baseSpec =
    EASING_CURVE_SPECS[easing] || EASING_CURVE_SPECS['cubic-bezier'];
  const activeP1 = isCustomPath
    ? { x: clampedCb.x1, y: clampedCb.y1 }
    : baseSpec.p1;
  const activeP2 = isCustomPath
    ? { x: clampedCb.x2, y: clampedCb.y2 }
    : baseSpec.p2;
  const activeFormula = isCustomPath
    ? `cubic-bezier(${clampedCb.x1.toFixed(2)}, ${clampedCb.y1.toFixed(
        2
      )}, ${clampedCb.x2.toFixed(2)}, ${clampedCb.y2.toFixed(2)})`
    : baseSpec.formula;

  // SVG plot geometry (viewBox 0 0 220 110)
  const padLeft = 24;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 18;
  const plotWidth = 220 - padLeft - padRight; // 182
  const plotHeight = 110 - padTop - padBottom; // 74

  const toSvgX = (t: number) => Number((padLeft + t * plotWidth).toFixed(2));
  const toSvgY = (v: number) =>
    Number((padTop + (1 - v) * plotHeight).toFixed(2));

  // Dynamically sample the easing function across [0, 1]
  const sampleCount = 48;
  const sampledPoints: { t: number; v: number; x: number; y: number }[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const v = evaluateEasing(t, easing, clampedCb);
    sampledPoints.push({
      t,
      v,
      x: toSvgX(t),
      y: toSvgY(v),
    });
  }

  const curvePathD = sampledPoints
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');
  const areaPathD = `${curvePathD} L ${toSvgX(1)} ${toSvgY(0)} L ${toSvgX(
    0
  )} ${toSvgY(0)} Z`;

  const drawnStrokePathD =
    drawnStrokePoints.length > 0
      ? drawnStrokePoints
          .map(
            (pt, idx) =>
              `${idx === 0 ? 'M' : 'L'} ${toSvgX(pt.x)} ${toSvgY(pt.y)}`
          )
          .join(' ')
      : '';

  // Control handle coordinates
  const startX = toSvgX(0);
  const startY = toSvgY(0);
  const endX = toSvgX(1);
  const endY = toSvgY(1);
  const cp1X = toSvgX(activeP1.x);
  const cp1Y = toSvgY(activeP1.y);
  const cp2X = toSvgX(activeP2.x);
  const cp2Y = toSvgY(activeP2.y);

  // Evaluate active probe position & instantaneous velocity (derivative)
  const clampedProbeT = Math.max(0, Math.min(1, probeT));
  const probeOutput = evaluateEasing(clampedProbeT, easing, clampedCb);
  const dt = 0.01;
  const vBefore = evaluateEasing(
    Math.max(0, clampedProbeT - dt),
    easing,
    clampedCb
  );
  const vAfter = evaluateEasing(
    Math.min(1, clampedProbeT + dt),
    easing,
    clampedCb
  );
  const instantSlope = Number(((vAfter - vBefore) / (2 * dt)).toFixed(2));
  const probeSvgX = toSvgX(clampedProbeT);
  const probeSvgY = toSvgY(probeOutput);
  const probeTimeMs = Math.round(clampedProbeT * durationMs);
  const probeOutputPct = Math.round(probeOutput * 100);

  const pointerToNormalizedPoint = (
    e: React.MouseEvent<SVGElement, MouseEvent>,
    svgEl: SVGSVGElement | null
  ): { x: number; y: number; hasLayout: boolean } => {
    const rect = svgEl ? svgEl.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
    if (rect.width > 0 && rect.height > 0) {
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const svgX = (relX / rect.width) * 220;
      const svgY = (relY / rect.height) * 110;
      const nx = Math.max(
        0,
        Math.min(1, Number(((svgX - padLeft) / plotWidth).toFixed(2)))
      );
      const ny = Math.max(
        -0.5,
        Math.min(1.5, Number((1 - (svgY - padTop) / plotHeight).toFixed(2)))
      );
      return { x: nx, y: ny, hasLayout: true };
    }
    return { x: 0.42, y: 1.15, hasLayout: false };
  };

  const handleSvgMouseDown = (
    e: React.MouseEvent<SVGSVGElement, MouseEvent>
  ) => {
    const pt = pointerToNormalizedPoint(e, e.currentTarget);
    if (isDrawPathMode || isCustomPath) {
      if (isDrawPathMode) {
        setIsDrawingStroke(true);
        const initialPts = pt.hasLayout
          ? [
              { x: 0, y: 0 },
              { x: pt.x, y: pt.y },
            ]
          : [
              { x: 0, y: 0 },
              { x: 0.32, y: 0.92 },
              { x: 0.68, y: 1.14 },
              { x: 1, y: 1 },
            ];
        setDrawnStrokePoints(initialPts);
        onChangeCustomBezier(fitCubicBezierFromStroke(initialPts));
        return;
      }
      // Determine closer control handle P1 or P2
      const dist1 = Math.hypot(pt.x - activeP1.x, pt.y - activeP1.y);
      const dist2 = Math.hypot(pt.x - activeP2.x, pt.y - activeP2.y);
      const targetHandle = dist1 <= dist2 ? 'p1' : 'p2';
      setDraggingHandle(targetHandle);
      if (pt.hasLayout) {
        onChangeCustomBezier(
          targetHandle === 'p1'
            ? { ...clampedCb, x1: pt.x, y1: pt.y }
            : { ...clampedCb, x2: pt.x, y2: pt.y }
        );
      } else {
        const nextPreset =
          CUSTOM_BEZIER_SHAPE_PRESETS[
            drawCycleIdx % CUSTOM_BEZIER_SHAPE_PRESETS.length
          ];
        setDrawCycleIdx((c) => c + 1);
        onChangeCustomBezier(nextPreset.points);
      }
    }
  };

  const handleSvgMouseMove = (
    e: React.MouseEvent<SVGSVGElement, MouseEvent>
  ) => {
    const pt = pointerToNormalizedPoint(e, e.currentTarget);
    if (isDrawingStroke) {
      const nextPts = pt.hasLayout
        ? [...drawnStrokePoints, { x: pt.x, y: pt.y }]
        : [
            { x: 0, y: 0 },
            { x: 0.28, y: 0.88 },
            { x: 0.64, y: 1.18 },
            { x: 1, y: 1 },
          ];
      setDrawnStrokePoints(nextPts);
      onChangeCustomBezier(fitCubicBezierFromStroke(nextPts));
      setProbeT(pt.x);
      return;
    }

    if (draggingHandle) {
      if (pt.hasLayout) {
        onChangeCustomBezier(
          draggingHandle === 'p1'
            ? { ...clampedCb, x1: pt.x, y1: pt.y }
            : { ...clampedCb, x2: pt.x, y2: pt.y }
        );
      } else {
        onChangeCustomBezier(
          draggingHandle === 'p1'
            ? {
                ...clampedCb,
                x1: Number(Math.min(0.95, clampedCb.x1 + 0.12).toFixed(2)),
                y1: Number(Math.min(1.4, clampedCb.y1 + 0.15).toFixed(2)),
              }
            : {
                ...clampedCb,
                x2: Number(Math.max(0.1, clampedCb.x2 - 0.1).toFixed(2)),
                y2: Number(Math.min(1.4, clampedCb.y2 + 0.12).toFixed(2)),
              }
        );
      }
      setProbeT(pt.x);
      return;
    }

    if (pt.hasLayout) {
      setProbeT(pt.x);
    } else {
      const steps = [0.2, 0.35, 0.5, 0.65, 0.8];
      const currIdx = steps.findIndex((s) => Math.abs(s - probeT) < 0.03);
      const nextStep = steps[(currIdx + 1) % steps.length];
      setProbeT(nextStep);
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingHandle(null);
    setIsDrawingStroke(false);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const pt = pointerToNormalizedPoint(e, e.currentTarget);
    if (pt.hasLayout) {
      setProbeT(pt.x);
    } else {
      const steps = [0.2, 0.35, 0.5, 0.65, 0.8];
      const currIdx = steps.findIndex((s) => Math.abs(s - probeT) < 0.03);
      const nextStep = steps[(currIdx + 1) % steps.length];
      setProbeT(nextStep);
    }
  };

  return (
    <div
      data-testid="easing-curve-graph"
      data-easing={easing}
      aria-label={`Easing Curve Visual Graph (${easing})`}
      className="bg-white border border-slate-200 rounded-md p-2 space-y-2 shadow-2xs"
    >
      {/* Graph Header with Dynamic Curve Badge & Formula */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: baseSpec.accentColor }}
          />
          <span className="text-[10px] font-semibold text-slate-700 truncate">
            Easing Curve Graph
          </span>
          <span
            data-testid={`${idPrefix}-easing-curve-badge`}
            className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0"
          >
            {baseSpec.badge}
          </span>
        </div>
        <span
          data-testid={`${idPrefix}-easing-curve-formula`}
          className="text-[9px] font-mono text-slate-500 truncate"
        >
          {activeFormula}
        </span>
      </div>

      {/* Interactive SVG Easing Curve Plot (Supports Probe Scrubbing, Control Handle Dragging & Custom Path Drawing) */}
      <div className="relative rounded bg-slate-950 border border-slate-800 overflow-hidden">
        <svg
          role="img"
          aria-label={`Interactive ${easing} Easing Curve Graph`}
          data-testid="easing-curve-svg"
          data-easing={easing}
          viewBox="0 0 220 110"
          onMouseEnter={() => setIsPointerActive(true)}
          onMouseLeave={() => {
            setIsPointerActive(false);
            setDraggingHandle(null);
            setIsDrawingStroke(false);
          }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onClick={handleSvgClick}
          className="w-full h-24 block cursor-crosshair select-none"
        >
          <defs>
            <linearGradient
              id={`${idPrefix}-easing-area-grad-${easing}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={baseSpec.accentColor}
                stopOpacity="0.36"
              />
              <stop
                offset="100%"
                stopColor={baseSpec.accentColor}
                stopOpacity="0.03"
              />
            </linearGradient>
          </defs>

          {/* Horizontal & Vertical Reference Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const gx = toSvgX(g);
            const gy = toSvgY(g);
            return (
              <g key={g}>
                <line
                  x1={padLeft}
                  y1={gy}
                  x2={padLeft + plotWidth}
                  y2={gy}
                  stroke={g === 0 || g === 1 ? '#334155' : '#1E293B'}
                  strokeWidth={g === 0 || g === 1 ? '1' : '0.75'}
                  strokeDasharray={g === 0 || g === 1 ? undefined : '2 2'}
                />
                <line
                  x1={gx}
                  y1={padTop}
                  x2={gx}
                  y2={padTop + plotHeight}
                  stroke={g === 0 || g === 1 ? '#334155' : '#1E293B'}
                  strokeWidth={g === 0 || g === 1 ? '1' : '0.75'}
                  strokeDasharray={g === 0 || g === 1 ? undefined : '2 2'}
                />
              </g>
            );
          })}

          {/* Axis Labels */}
          <text
            x="6"
            y={toSvgY(1) + 3}
            fill="#64748B"
            fontSize="7"
            fontFamily="monospace"
          >
            1.0
          </text>
          <text
            x="6"
            y={toSvgY(0.5) + 3}
            fill="#475569"
            fontSize="7"
            fontFamily="monospace"
          >
            0.5
          </text>
          <text
            x="6"
            y={toSvgY(0) + 3}
            fill="#64748B"
            fontSize="7"
            fontFamily="monospace"
          >
            0.0
          </text>
          <text
            x={padLeft}
            y="106"
            fill="#64748B"
            fontSize="7"
            fontFamily="monospace"
          >
            0%
          </text>
          <text
            x={toSvgX(0.5) - 8}
            y="106"
            fill="#475569"
            fontSize="7"
            fontFamily="monospace"
          >
            time (t)
          </text>
          <text
            x={padLeft + plotWidth - 16}
            y="106"
            fill="#64748B"
            fontSize="7"
            fontFamily="monospace"
          >
            100%
          </text>

          {/* Reference Linear Diagonal Baseline */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.65"
          />

          {/* Dynamic Shaded Area Under Easing Curve */}
          <path
            data-testid="easing-curve-area"
            d={areaPathD}
            fill={`url(#${idPrefix}-easing-area-grad-${easing})`}
          />

          {/* User-Drawn Freehand Stroke Preview (when drawing Custom Path) */}
          {drawnStrokePathD && (
            <path
              data-testid="custom-bezier-drawn-stroke"
              d={drawnStrokePathD}
              fill="none"
              stroke="#F472B6"
              strokeWidth="1.2"
              strokeDasharray="2 2"
              opacity="0.85"
            />
          )}

          {/* Control Tangent Handles (P0->P1 and P3->P2) */}
          <line
            data-testid="easing-control-line-1"
            x1={startX}
            y1={startY}
            x2={cp1X}
            y2={cp1Y}
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            opacity="0.85"
          />
          <line
            data-testid="easing-control-line-2"
            x1={endX}
            y1={endY}
            x2={cp2X}
            y2={cp2Y}
            stroke="#A855F7"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            opacity="0.85"
          />

          {/* Dynamic Easing Curve Path */}
          <path
            data-testid="easing-curve-path"
            data-easing={easing}
            d={curvePathD}
            fill="none"
            stroke={baseSpec.accentColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Velocity Distribution Dots Along Curve */}
          {[0.2, 0.4, 0.6, 0.8].map((sampleT) => {
            const sv = evaluateEasing(sampleT, easing, clampedCb);
            return (
              <circle
                key={sampleT}
                cx={toSvgX(sampleT)}
                cy={toSvgY(sv)}
                r="1.8"
                fill="#E2E8F0"
                opacity="0.75"
              />
            );
          })}

          {/* Interactive Draggable Control Point Handles P1 & P2 */}
          <circle
            data-testid="easing-control-point-1"
            role="slider"
            aria-label="Custom Bezier Control Point P1"
            aria-valuetext={`${activeP1.x.toFixed(2)}, ${activeP1.y.toFixed(2)}`}
            cx={cp1X}
            cy={cp1Y}
            r={isCustomPath || draggingHandle === 'p1' ? '4.5' : '3.4'}
            fill="#0F172A"
            stroke="#38BDF8"
            strokeWidth="1.8"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingHandle('p1');
              if (!isCustomPath) {
                onChangeCustomBezier({
                  x1: activeP1.x,
                  y1: activeP1.y,
                  x2: activeP2.x,
                  y2: activeP2.y,
                });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              onChangeCustomBezier({
                ...clampedCb,
                x1: Number(Math.min(0.95, activeP1.x + 0.08).toFixed(2)),
                y1: Number(Math.min(1.4, activeP1.y + 0.12).toFixed(2)),
              });
            }}
          />
          <circle
            data-testid="easing-control-point-2"
            role="slider"
            aria-label="Custom Bezier Control Point P2"
            aria-valuetext={`${activeP2.x.toFixed(2)}, ${activeP2.y.toFixed(2)}`}
            cx={cp2X}
            cy={cp2Y}
            r={isCustomPath || draggingHandle === 'p2' ? '4.5' : '3.4'}
            fill="#0F172A"
            stroke="#A855F7"
            strokeWidth="1.8"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingHandle('p2');
              if (!isCustomPath) {
                onChangeCustomBezier({
                  x1: activeP1.x,
                  y1: activeP1.y,
                  x2: activeP2.x,
                  y2: activeP2.y,
                });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              onChangeCustomBezier({
                ...clampedCb,
                x2: Number(Math.max(0.08, activeP2.x - 0.08).toFixed(2)),
                y2: Number(Math.min(1.4, activeP2.y + 0.1).toFixed(2)),
              });
            }}
          />

          {/* Interactive Probe Crosshair & Active Curve Point Marker */}
          <line
            x1={probeSvgX}
            y1={padTop}
            x2={probeSvgX}
            y2={padTop + plotHeight}
            stroke="#38BDF8"
            strokeWidth="0.9"
            strokeDasharray="2 2"
            opacity={isPointerActive ? '0.9' : '0.5'}
          />
          <line
            x1={padLeft}
            y1={probeSvgY}
            x2={padLeft + plotWidth}
            y2={probeSvgY}
            stroke="#38BDF8"
            strokeWidth="0.9"
            strokeDasharray="2 2"
            opacity={isPointerActive ? '0.9' : '0.5'}
          />
          <circle
            data-testid="easing-curve-marker"
            cx={probeSvgX}
            cy={probeSvgY}
            r="4.2"
            fill="#38BDF8"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />

          {/* Start & End Anchor Nodes */}
          <circle cx={startX} cy={startY} r="2.5" fill="#94A3B8" />
          <circle cx={endX} cy={endY} r="2.5" fill="#F8FAFC" />
        </svg>
      </div>

      {/* Interactive Time Probe Scrubber & Telemetry Readout */}
      <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
        <span
          data-testid={`${idPrefix}-easing-probe-readout`}
          className="text-slate-600 truncate"
        >
          t={Math.round(clampedProbeT * 100)}% ({probeTimeMs}ms) →{' '}
          <strong className="text-blue-700">{probeOutputPct}%</strong> (v=
          {instantSlope}x)
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {[0.25, 0.5, 0.75].map((tPreset) => {
            const isSelectedT = Math.abs(clampedProbeT - tPreset) < 0.03;
            return (
              <button
                key={tPreset}
                type="button"
                title={`Inspect curve at t=${Math.round(tPreset * 100)}%`}
                onClick={() => setProbeT(tPreset)}
                className={`px-1 py-0.2 rounded text-[9px] border cursor-pointer ${
                  isSelectedT
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                t={Math.round(tPreset * 100)}%
              </button>
            );
          })}
          <button
            type="button"
            data-testid={`${idPrefix}-custom-path-toggle-button`}
            title="Switch to Custom Path cubic-bezier editor"
            onClick={() => onSelectEasing('custom-path')}
            className={`px-1.5 py-0.2 rounded text-[9px] border font-semibold cursor-pointer ${
              isCustomPath
                ? 'bg-pink-600 text-white border-pink-600'
                : 'bg-white hover:bg-pink-50 text-pink-600 border-pink-200'
            }`}
          >
            Custom Path ✎
          </button>
          <button
            type="button"
            title="Cycle to next easing curve function"
            onClick={() => {
              const idx = EASING_FUNCTION_OPTIONS.findIndex(
                (o) => o.id === easing
              );
              const nextOpt =
                EASING_FUNCTION_OPTIONS[
                  (idx + 1) % EASING_FUNCTION_OPTIONS.length
                ];
              if (nextOpt) onSelectEasing(nextOpt.id);
            }}
            className="px-1.5 py-0.2 rounded text-[9px] bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 font-semibold cursor-pointer"
          >
            Next Curve ↻
          </button>
        </div>
      </div>

      {/* Custom Path Cubic-Bezier Interactive Editor Panel */}
      {isCustomPath && (
        <div
          role="region"
          aria-label="Custom Path Cubic-Bezier Editor"
          data-testid={`${idPrefix}-custom-path-editor`}
          className="bg-slate-50 border border-pink-200/90 rounded-md p-2 space-y-2"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <PenTool className="w-3 h-3 text-pink-600 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-800 truncate">
                Custom Path Cubic-Bezier Editor
              </span>
            </div>
            <span
              data-testid={`${idPrefix}-custom-bezier-css-value`}
              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 shrink-0"
            >
              cubic-bezier({clampedCb.x1.toFixed(2)}, {clampedCb.y1.toFixed(2)},{' '}
              {clampedCb.x2.toFixed(2)}, {clampedCb.y2.toFixed(2)})
            </span>
          </div>

          {/* Interactive Drawing Mode Switch: Drag Control Handles vs Draw Freehand Path */}
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              data-testid={`${idPrefix}-drag-handles-mode-button`}
              onClick={() => setIsDrawPathMode(false)}
              className={`py-1 px-2 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                !isDrawPathMode
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Drag P1/P2 Handles
            </button>
            <button
              type="button"
              data-testid={`${idPrefix}-draw-path-mode-button`}
              onClick={() => {
                setIsDrawPathMode(true);
                const sampleStroke = [
                  { x: 0, y: 0 },
                  { x: 0.3, y: 0.9 },
                  { x: 0.65, y: 1.15 },
                  { x: 1, y: 1 },
                ];
                setDrawnStrokePoints(sampleStroke);
                onChangeCustomBezier(fitCubicBezierFromStroke(sampleStroke));
              }}
              className={`py-1 px-2 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                isDrawPathMode
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-pink-50'
              }`}
            >
              Draw Custom Path ✎
            </button>
          </div>

          {/* Control Point P1 (x1, y1) and P2 (x2, y2) Sliders */}
          <div className="grid grid-cols-2 gap-2">
            {/* P1 (x1, y1) */}
            <div className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="font-semibold text-sky-600">
                  P1 (Start Tangent)
                </span>
                <span className="text-slate-600">
                  ({clampedCb.x1.toFixed(2)}, {clampedCb.y1.toFixed(2)})
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <label htmlFor={`${idPrefix}-bezier-x1-slider`}>X1</label>
                  <span className="font-mono">{clampedCb.x1.toFixed(2)}</span>
                </div>
                <input
                  id={`${idPrefix}-bezier-x1-slider`}
                  aria-label="Custom Bezier X1"
                  data-testid={`${idPrefix}-bezier-x1-slider`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={clampedCb.x1}
                  onChange={(e) =>
                    onChangeCustomBezier({
                      ...clampedCb,
                      x1: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <label htmlFor={`${idPrefix}-bezier-y1-slider`}>Y1</label>
                  <span className="font-mono">{clampedCb.y1.toFixed(2)}</span>
                </div>
                <input
                  id={`${idPrefix}-bezier-y1-slider`}
                  aria-label="Custom Bezier Y1"
                  data-testid={`${idPrefix}-bezier-y1-slider`}
                  type="range"
                  min={-0.5}
                  max={1.5}
                  step={0.01}
                  value={clampedCb.y1}
                  onChange={(e) =>
                    onChangeCustomBezier({
                      ...clampedCb,
                      y1: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* P2 (x2, y2) */}
            <div className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="font-semibold text-purple-600">
                  P2 (End Tangent)
                </span>
                <span className="text-slate-600">
                  ({clampedCb.x2.toFixed(2)}, {clampedCb.y2.toFixed(2)})
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <label htmlFor={`${idPrefix}-bezier-x2-slider`}>X2</label>
                  <span className="font-mono">{clampedCb.x2.toFixed(2)}</span>
                </div>
                <input
                  id={`${idPrefix}-bezier-x2-slider`}
                  aria-label="Custom Bezier X2"
                  data-testid={`${idPrefix}-bezier-x2-slider`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={clampedCb.x2}
                  onChange={(e) =>
                    onChangeCustomBezier({
                      ...clampedCb,
                      x2: Number(e.target.value),
                    })
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <label htmlFor={`${idPrefix}-bezier-y2-slider`}>Y2</label>
                  <span className="font-mono">{clampedCb.y2.toFixed(2)}</span>
                </div>
                <input
                  id={`${idPrefix}-bezier-y2-slider`}
                  aria-label="Custom Bezier Y2"
                  data-testid={`${idPrefix}-bezier-y2-slider`}
                  type="range"
                  min={-0.5}
                  max={1.5}
                  step={0.01}
                  value={clampedCb.y2}
                  onChange={(e) =>
                    onChangeCustomBezier({
                      ...clampedCb,
                      y2: Number(e.target.value),
                    })
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Quick Custom Cubic-Bezier Curve Shape Presets */}
          <div className="grid grid-cols-5 gap-1">
            {CUSTOM_BEZIER_SHAPE_PRESETS.map((presetShape) => {
              const isMatched =
                Math.abs(clampedCb.x1 - presetShape.points.x1) < 0.02 &&
                Math.abs(clampedCb.y1 - presetShape.points.y1) < 0.02 &&
                Math.abs(clampedCb.x2 - presetShape.points.x2) < 0.02 &&
                Math.abs(clampedCb.y2 - presetShape.points.y2) < 0.02;
              return (
                <button
                  key={presetShape.id}
                  type="button"
                  data-testid={`${idPrefix}-custom-shape-${presetShape.id}`}
                  onClick={() => {
                    setDrawnStrokePoints([]);
                    onChangeCustomBezier(presetShape.points);
                  }}
                  className={`py-0.5 px-1 rounded text-[9px] font-mono border truncate cursor-pointer ${
                    isMatched
                      ? 'bg-pink-50 border-pink-400 text-pink-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {presetShape.label}
                </button>
              );
            })}
            <button
              type="button"
              data-testid={`${idPrefix}-custom-shape-reset`}
              onClick={() => {
                setDrawnStrokePoints([]);
                onChangeCustomBezier(DEFAULT_CUSTOM_BEZIER);
              }}
              className="py-0.5 px-1 rounded text-[9px] font-mono border bg-white border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const RightInspector: React.FC = () => {
  const {
    canvasWidth,
    canvasHeight,
    devices,
    drawings,
    webcams,
    clips,
    tracks,
    currentFrame,
    durationInFrames,
    fps,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    selectedClipId,
    mediaAssets,
    background,
    studio3D,
    updateStudio3D,
    updateDevice,
    updateDeviceScreenTransform,
    updateDeviceEffects,
    updateDeviceBrowserTheme,
    assignMediaToDevice,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    updateDrawing,
    deleteDrawing,
    duplicateDrawing,
    updateWebcam,
    deleteWebcam,
    duplicateWebcam,
    applyWebcamStylePreset,
    updateClip,
    trimSelectedClipToPlayhead,
    splitSelectedClipAtPlayhead,
    duplicateSelectedClip,
    deleteSelectedClip,
    addKeyframeAtCurrentFrame,
    jumpToAdjacentKeyframe,
    clearTrackKeyframes,
    updateDeviceTransitionEasing,
    updateDeviceTransitionDuration,
    updateDeviceTransitionOpacity,
    updateDeviceTransitionMotionBlur,
    updateDeviceTransitionLoop,
    updateDeviceTransitionCustomBezier,
    updateDeviceTransitionStartDelay,
    applyAnimationPresetToDevice,
    resetDeviceTransition,
    copiedTransition,
    copyDeviceTransition,
    pasteDeviceTransition,
    favoriteTransitionPresetIds,
    toggleFavoriteTransitionPreset,
    setLeftTab,
  } = useStudioStore();

  const [activeTab, setActiveTab] = useState<InspectorTab>('transform');
  const [selectedAnimPreset, setSelectedAnimPreset] =
    useState<AnimationPresetId | null>(null);
  const [transitionCategory, setTransitionCategory] = useState<
    TransitionPresetCategory | 'All'
  >('All');
  const [selectedTransitionGroup, setSelectedTransitionGroup] = useState<
    TransitionPresetGroup | 'Favorites' | 'All'
  >('All');
  const [transitionSearch, setTransitionSearch] = useState('');
  const [transitionTimingMode, setTransitionTimingMode] =
    useState<TransitionTimingMode>('from-start');
  const [transitionDurationMs, setTransitionDurationMs] =
    useState<number>(1000);
  const [transitionDurationFrames, setTransitionDurationFrames] =
    useState<number>(30);
  const [transitionStartDelayMs, setTransitionStartDelayMs] =
    useState<number>(0);
  const [transitionEasing, setTransitionEasing] =
    useState<EasingType>('cubic-bezier');
  const [transitionCustomBezier, setTransitionCustomBezier] =
    useState<CustomBezierControlPoints>(DEFAULT_CUSTOM_BEZIER);
  const [transitionStartOpacity, setTransitionStartOpacity] =
    useState<number>(0);
  const [transitionEndOpacity, setTransitionEndOpacity] = useState<number>(1);
  const [transitionMotionBlur, setTransitionMotionBlur] =
    useState<boolean>(false);
  const [transitionMotionBlurIntensity, setTransitionMotionBlurIntensity] =
    useState<number>(0);
  const [transitionLoop, setTransitionLoop] = useState<boolean>(false);
  const [transitionStaggerFrames, setTransitionStaggerFrames] =
    useState<number>(6);
  const [autoPlayOnApply, setAutoPlayOnApply] = useState<boolean>(true);
  const [stagedPresetId, setStagedPresetId] =
    useState<AnimationPresetId>('slide-in');
  const [stagedPresetByDevice, setStagedPresetByDevice] = useState<
    Record<string, AnimationPresetId>
  >({});
  const [hoveredPresetId, setHoveredPresetId] =
    useState<AnimationPresetId | null>(null);
  const [isHoveringTransitionDropdown, setIsHoveringTransitionDropdown] =
    useState<boolean>(false);
  const [isTransitionDropdownMenuOpen, setIsTransitionDropdownMenuOpen] =
    useState<boolean>(true);
  const [transitionDropdownViewMode, setTransitionDropdownViewMode] = useState<
    'grid' | 'list'
  >('grid');
  const [dropdownCategoryFilter, setDropdownCategoryFilter] = useState<
    TransitionPresetCategory | 'All'
  >('All');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const rawSelectedDrawing = drawings.find((dr) => dr.id === selectedDrawingId);
  const rawSelectedWebcam = webcams.find((wc) => wc.id === selectedWebcamId);
  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const rawSelectedDevice =
    devices.find((d) => selectedIds.includes(d.id)) || null;

  const drawingTrack = rawSelectedDrawing
    ? tracks.find((t) => t.targetId === rawSelectedDrawing.id)
    : undefined;
  const selectedDrawing = rawSelectedDrawing
    ? resolveDrawingAtFrame(
        rawSelectedDrawing,
        drawingTrack ? drawingTrack.keyframes : [],
        currentFrame,
        durationInFrames
      )
    : undefined;

  const webcamTrack = rawSelectedWebcam
    ? tracks.find((t) => t.targetId === rawSelectedWebcam.id)
    : undefined;
  const selectedWebcam = rawSelectedWebcam
    ? resolveWebcamAtFrame(
        rawSelectedWebcam,
        webcamTrack ? webcamTrack.keyframes : [],
        currentFrame,
        durationInFrames
      )
    : undefined;

  const deviceTrack = rawSelectedDevice
    ? tracks.find((t) => t.targetId === rawSelectedDevice.id)
    : undefined;
  const selectedDevice = rawSelectedDevice
    ? resolveDeviceAtFrame(
        rawSelectedDevice,
        deviceTrack ? deviceTrack.keyframes : [],
        currentFrame,
        durationInFrames
      )
    : undefined;

  // Common Keyframe Bar Header
  const renderKeyframeBar = (
    targetId: string,
    keyframesCount: number,
    hasKfAtPlayhead: boolean
  ) => (
    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <Diamond
          className={`w-3.5 h-3.5 shrink-0 ${
            hasKfAtPlayhead
              ? 'text-blue-600 fill-blue-600'
              : keyframesCount > 1
                ? 'text-blue-500'
                : 'text-slate-400'
          }`}
        />
        <span className="text-[11px] font-mono font-semibold text-slate-700">
          F{String(currentFrame).padStart(3, '0')}
        </span>
        <span className="text-[10px] text-slate-500">
          · {keyframesCount} keyframe{keyframesCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => jumpToAdjacentKeyframe('prev')}
          title="Previous Keyframe"
          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          onClick={() => addKeyframeAtCurrentFrame(targetId)}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
            hasKfAtPlayhead
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
          }`}
        >
          {hasKfAtPlayhead ? 'Update KF' : '+ Keyframe'}
        </button>
        <button
          onClick={() => jumpToAdjacentKeyframe('next')}
          title="Next Keyframe"
          className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // 1. WEBCAM OVERLAY INSPECTOR
  // ============================================================================
  if (selectedWebcam && rawSelectedWebcam) {
    const wcKfs = webcamTrack ? webcamTrack.keyframes : [];
    const hasKf = wcKfs.some((k) => k.frame === currentFrame);

    return (
      <aside
        aria-label="Webcam Properties Inspector"
        className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none shrink-0 z-20"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input
                type="text"
                value={rawSelectedWebcam.name}
                onChange={(e) =>
                  updateWebcam(selectedWebcam.id, { name: e.target.value })
                }
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none focus:bg-slate-50 rounded px-1 -ml-1 truncate w-44"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Webcam · {selectedWebcam.shape} ({Math.round(selectedWebcam.width)}
              ×{Math.round(selectedWebcam.height)})
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => duplicateWebcam(selectedWebcam.id)}
              title="Duplicate Webcam"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteWebcam(selectedWebcam.id)}
              title="Delete Webcam"
              className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {renderKeyframeBar(selectedWebcam.id, wcKfs.length, hasKf)}

        {/* Contextual Inspector Tabs */}
        <div className="grid grid-cols-5 bg-slate-50 p-1 border-b border-slate-200 gap-0.5">
          {(
            [
              { id: 'transform', label: 'Transform' },
              { id: 'style', label: 'Shape' },
              { id: 'media', label: 'Video' },
              { id: 'effects', label: 'Glow' },
              { id: 'animation', label: 'Motion' },
            ] as { id: InspectorTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-1.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {activeTab === 'transform' && (
            <>
              {/* Alignment Quick Actions */}
              <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, {
                      x: selectedWebcam.width / 2 + 48,
                    })
                  }
                  title="Align Left"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignStartVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, { x: canvasWidth / 2 })
                  }
                  title="Center Horizontally"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignCenterVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, {
                      x: canvasWidth - selectedWebcam.width / 2 - 48,
                    })
                  }
                  title="Align Right"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignEndVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, {
                      y: selectedWebcam.height / 2 + 48,
                    })
                  }
                  title="Align Top"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignStartHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, { y: canvasHeight / 2 })
                  }
                  title="Center Vertically"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignCenterHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateWebcam(selectedWebcam.id, {
                      y: canvasHeight - selectedWebcam.height / 2 - 48,
                    })
                  }
                  title="Align Bottom"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignEndHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Position X
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedWebcam.x)}
                    onChange={(e) =>
                      updateWebcam(selectedWebcam.id, {
                        x: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Position Y
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedWebcam.y)}
                    onChange={(e) =>
                      updateWebcam(selectedWebcam.id, {
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={1920}
                    value={Math.round(selectedWebcam.width)}
                    onChange={(e) => {
                      const nextW = Math.max(60, Number(e.target.value));
                      updateWebcam(
                        selectedWebcam.id,
                        selectedWebcam.lockAspectRatio
                          ? { width: nextW, height: nextW }
                          : { width: nextW }
                      );
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={1920}
                    value={Math.round(selectedWebcam.height)}
                    onChange={(e) => {
                      const nextH = Math.max(60, Number(e.target.value));
                      updateWebcam(
                        selectedWebcam.id,
                        selectedWebcam.lockAspectRatio
                          ? { width: nextH, height: nextH }
                          : { height: nextH }
                      );
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Rotation</span>
                  <span className="font-mono">
                    {Math.round(selectedWebcam.rotation)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedWebcam.rotation}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      rotation: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Opacity</span>
                  <span className="font-mono">
                    {Math.round(selectedWebcam.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.02}
                  value={selectedWebcam.opacity}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      opacity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="text-[11px] font-medium text-slate-600 block mb-1.5">
                  Layer Position vs Devices
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() =>
                      updateWebcam(selectedWebcam.id, {
                        layerPosition: 'above-devices',
                      })
                    }
                    className={`py-1.5 px-2 rounded text-xs font-medium border ${
                      selectedWebcam.layerPosition !== 'below-devices'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Above Devices (PiP)
                  </button>
                  <button
                    onClick={() =>
                      updateWebcam(selectedWebcam.id, {
                        layerPosition: 'below-devices',
                      })
                    }
                    className={`py-1.5 px-2 rounded text-xs font-medium border ${
                      selectedWebcam.layerPosition === 'below-devices'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Behind Devices
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'style' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Webcam Frame Shape
                </label>
                <select
                  value={selectedWebcam.shape}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      shape: e.target.value as WebcamFrameShapeType,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  {WEBCAM_SHAPE_LIBRARY.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Corner Radius / Fillet</span>
                  <span className="font-mono">
                    {Math.round(selectedWebcam.cornerRadius)}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={selectedWebcam.cornerRadius}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      cornerRadius: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Curve Intensity</span>
                  <span className="font-mono">
                    {Math.round(selectedWebcam.curveIntensity)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedWebcam.curveIntensity}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      curveIntensity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Frame Border
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedWebcam.borderEnabled}
                    onChange={(e) =>
                      updateWebcam(selectedWebcam.id, {
                        borderEnabled: e.target.checked,
                      })
                    }
                    className="accent-blue-600"
                  />
                </div>

                {selectedWebcam.borderEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                        <span>Primary</span>
                        <input
                          type="color"
                          value={selectedWebcam.borderColor}
                          onChange={(e) =>
                            updateWebcam(selectedWebcam.id, {
                              borderColor: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border-0"
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                        <span>Accent</span>
                        <input
                          type="color"
                          value={selectedWebcam.borderSecondaryColor}
                          onChange={(e) =>
                            updateWebcam(selectedWebcam.id, {
                              borderSecondaryColor: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded border-0"
                        />
                      </label>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Border Thickness</span>
                        <span className="font-mono">
                          {selectedWebcam.borderWidth}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        value={selectedWebcam.borderWidth}
                        onChange={(e) =>
                          updateWebcam(selectedWebcam.id, {
                            borderWidth: Number(e.target.value),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Inner Frame Padding</span>
                        <span className="font-mono">
                          {selectedWebcam.innerPadding}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        value={selectedWebcam.innerPadding}
                        onChange={(e) =>
                          updateWebcam(selectedWebcam.id, {
                            innerPadding: Number(e.target.value),
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'media' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Video Fit Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['cover', 'contain', 'fill'] as ScreenFitMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        onClick={() =>
                          updateWebcam(selectedWebcam.id, { fitMode: m })
                        }
                        className={`py-1.5 rounded text-xs font-medium capitalize border ${
                          selectedWebcam.fitMode === m
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Camera Zoom</span>
                  <span className="font-mono">
                    {Math.round(selectedWebcam.zoom * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={selectedWebcam.zoom}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      zoom: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Pan X</span>
                    <span className="font-mono">{selectedWebcam.panX}px</span>
                  </div>
                  <input
                    type="range"
                    min={-200}
                    max={200}
                    value={selectedWebcam.panX}
                    onChange={(e) =>
                      updateWebcam(selectedWebcam.id, {
                        panX: Number(e.target.value),
                      })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Pan Y</span>
                    <span className="font-mono">{selectedWebcam.panY}px</span>
                  </div>
                  <input
                    type="range"
                    min={-200}
                    max={200}
                    value={selectedWebcam.panY}
                    onChange={(e) =>
                      updateWebcam(selectedWebcam.id, {
                        panY: Number(e.target.value),
                      })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  updateWebcam(selectedWebcam.id, {
                    mirrorHorizontal: !selectedWebcam.mirrorHorizontal,
                  })
                }
                className={`w-full py-1.5 px-3 rounded-md text-xs font-medium border flex items-center justify-center gap-1.5 ${
                  selectedWebcam.mirrorHorizontal
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>
                  Horizontal Mirror ({selectedWebcam.mirrorHorizontal ? 'On' : 'Off'})
                </span>
              </button>
            </>
          )}

          {activeTab === 'effects' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Outer Neon Glow
                </span>
                <input
                  type="checkbox"
                  checked={selectedWebcam.glowEnabled}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      glowEnabled: e.target.checked,
                    })
                  }
                  className="accent-blue-600"
                />
              </div>

              {selectedWebcam.glowEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      <span>Glow Primary</span>
                      <input
                        type="color"
                        value={selectedWebcam.glowColor}
                        onChange={(e) =>
                          updateWebcam(selectedWebcam.id, {
                            glowColor: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      <span>Secondary</span>
                      <input
                        type="color"
                        value={selectedWebcam.glowSecondaryColor}
                        onChange={(e) =>
                          updateWebcam(selectedWebcam.id, {
                            glowSecondaryColor: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Glow Blur Radius</span>
                      <span className="font-mono">
                        {Math.round(selectedWebcam.glowRadius)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={100}
                      value={selectedWebcam.glowRadius}
                      onChange={(e) =>
                        updateWebcam(selectedWebcam.id, {
                          glowRadius: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Glow Intensity</span>
                      <span className="font-mono">
                        {Math.round(selectedWebcam.glowIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={selectedWebcam.glowIntensity}
                      onChange={(e) =>
                        updateWebcam(selectedWebcam.id, {
                          glowIntensity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'animation' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Animated Border Mode
                </label>
                <select
                  value={selectedWebcam.borderAnimationMode}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      borderAnimationMode:
                        e.target.value as WebcamBorderAnimationMode,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="perimeter-trace">Perimeter Trace</option>
                  <option value="moving-light">Moving Light Beam</option>
                  <option value="pulsing-neon">Pulsing Neon Rim</option>
                  <option value="gradient-rotation">Rotating Gradient</option>
                  <option value="rainbow-cycle">Rainbow Cycle</option>
                  <option value="breathing">Subtle Breathing</option>
                  <option value="draw-on">Draw-On Reveal</option>
                  <option value="none">Static Border</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Border Animation Speed</span>
                  <span className="font-mono">
                    {selectedWebcam.borderAnimationSpeed.toFixed(1)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.1}
                  value={selectedWebcam.borderAnimationSpeed}
                  onChange={(e) =>
                    updateWebcam(selectedWebcam.id, {
                      borderAnimationSpeed: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <button
                onClick={() => clearTrackKeyframes(selectedWebcam.id)}
                className="w-full py-1.5 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Track Keyframes</span>
              </button>
            </>
          )}
        </div>
      </aside>
    );
  }

  // ============================================================================
  // 2. DRAWING / ANNOTATION INSPECTOR
  // ============================================================================
  if (selectedDrawing && rawSelectedDrawing) {
    const drKfs = drawingTrack ? drawingTrack.keyframes : [];
    const hasKf = drKfs.some((k) => k.frame === currentFrame);

    return (
      <aside
        aria-label="Drawing Properties Inspector"
        className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none shrink-0 z-20"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <input
                type="text"
                value={rawSelectedDrawing.name}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, { name: e.target.value })
                }
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none focus:bg-slate-50 rounded px-1 -ml-1 truncate w-44"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5 capitalize">
              Drawing · {selectedDrawing.tool} (
              {Math.round(selectedDrawing.width)}×
              {Math.round(selectedDrawing.height)})
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => duplicateDrawing(selectedDrawing.id)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteDrawing(selectedDrawing.id)}
              className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {renderKeyframeBar(selectedDrawing.id, drKfs.length, hasKf)}

        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* Text content if Text or Callout */}
          {(selectedDrawing.tool === 'text' ||
            selectedDrawing.tool === 'callout-box' ||
            Boolean(rawSelectedDrawing.text)) && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 block">
                Annotation Label Text
              </label>
              <input
                type="text"
                value={rawSelectedDrawing.text || ''}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, { text: e.target.value })
                }
                placeholder="Enter callout text..."
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>
          )}

          {/* Transform */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Position X
              </label>
              <input
                type="number"
                value={Math.round(selectedDrawing.x)}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    x: Number(e.target.value),
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Position Y
              </label>
              <input
                type="number"
                value={Math.round(selectedDrawing.y)}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    y: Number(e.target.value),
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Width
              </label>
              <input
                type="number"
                min={20}
                value={Math.round(selectedDrawing.width)}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    width: Math.max(20, Number(e.target.value)),
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Height
              </label>
              <input
                type="number"
                min={20}
                value={Math.round(selectedDrawing.height)}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    height: Math.max(20, Number(e.target.value)),
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Stroke & Fill */}
          <div className="space-y-2.5 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold text-slate-800">
              Stroke & Glow Appearance
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                <span>Stroke</span>
                <input
                  type="color"
                  value={selectedDrawing.strokeColor}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      strokeColor: e.target.value,
                    })
                  }
                  className="w-5 h-5 rounded border-0"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                <span>Glow</span>
                <input
                  type="color"
                  value={selectedDrawing.glowColor}
                  onChange={(e) =>
                    updateDrawing(selectedDrawing.id, {
                      glowColor: e.target.value,
                    })
                  }
                  className="w-5 h-5 rounded border-0"
                />
              </label>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Stroke Width</span>
                <span className="font-mono">
                  {selectedDrawing.strokeWidth}px
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={32}
                value={selectedDrawing.strokeWidth}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    strokeWidth: Number(e.target.value),
                  })
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Neon Glow Blur</span>
                <span className="font-mono">
                  {Math.round(selectedDrawing.glowRadius)}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={selectedDrawing.glowRadius}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    glowRadius: Number(e.target.value),
                  })
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-800 block mb-1">
                Path Motion Mode
              </label>
              <select
                value={selectedDrawing.animationMode}
                onChange={(e) =>
                  updateDrawing(selectedDrawing.id, {
                    animationMode: e.target.value as DrawingAnimationMode,
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="neon-trace">Travelling Neon Trace</option>
                <option value="draw-on">Draw-On Path Reveal</option>
                <option value="stroke-reveal">Looping Stroke Reveal</option>
                <option value="pulsing-outline">Pulsing Outline</option>
                <option value="moving-light">Moving Light Beam</option>
                <option value="color-shift">Rainbow Colour Shift</option>
                <option value="none">Static Path</option>
              </select>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ============================================================================
  // 3. TIMELINE CLIP INSPECTOR
  // ============================================================================
  if (selectedClip) {
    return (
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none shrink-0 z-20">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-900 truncate w-48">
              {selectedClip.name}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Clip · F{selectedClip.startFrame}–F
              {selectedClip.startFrame + selectedClip.durationFrames}
            </div>
          </div>
          <button
            onClick={deleteSelectedClip}
            className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => trimSelectedClipToPlayhead('left')}
              className="py-1.5 px-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium"
            >
              [ Trim Start
            </button>
            <button
              onClick={() => trimSelectedClipToPlayhead('right')}
              className="py-1.5 px-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium"
            >
              Trim End ]
            </button>
          </div>
          <button
            onClick={splitSelectedClipAtPlayhead}
            className="w-full py-1.5 px-3 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split Clip at Playhead (S)</span>
          </button>
        </div>
      </aside>
    );
  }

  // ============================================================================
  // 4. DEVICE MOCKUP INSPECTOR
  // ============================================================================
  if (selectedDevice && rawSelectedDevice) {
    const preset = getDevicePresetById(selectedDevice.presetId);
    const devKfs = deviceTrack ? deviceTrack.keyframes : [];
    const hasKf = devKfs.some((k) => k.frame === currentFrame);
    const multiSelectedCount = selectedIds.length;
    const currentStagedPresetId: AnimationPresetId =
      stagedPresetByDevice[selectedDevice.id] ??
      rawSelectedDevice.activeTransitionPresetId ??
      'slide-in';
    const activePresetId =
      rawSelectedDevice.activeTransitionPresetId ??
      stagedPresetByDevice[selectedDevice.id] ??
      null;
    const activeEasingValue: EasingType =
      rawSelectedDevice.activeTransitionEasing ||
      devKfs.find((k) => k.frame > 0)?.easing ||
      devKfs[0]?.easing ||
      'cubic-bezier';
    const activeCustomBezier: CustomBezierControlPoints =
      clampCustomBezierPoints(
        rawSelectedDevice.activeTransitionCustomBezier ||
          rawSelectedDevice.effects.customBezierPoints ||
          devKfs.find((k) => k.frame > 0)?.customBezier ||
          devKfs[0]?.customBezier ||
          transitionCustomBezier
      );
    const activeEasingMeta =
      EASING_FUNCTION_OPTIONS.find((o) => o.id === activeEasingValue) ||
      EASING_FUNCTION_OPTIONS[0];
    const activeDurationMs = Math.max(
      100,
      Math.min(2000, rawSelectedDevice.activeTransitionDurationMs ?? 1000)
    );
    const activeDurationFrames = Math.max(
      2,
      Math.round((activeDurationMs / 1000) * fps)
    );
    const activeStartDelayMs = Math.max(
      0,
      Math.min(
        5000,
        Math.round(
          rawSelectedDevice.activeTransitionStartDelayMs ??
            rawSelectedDevice.effects.transitionStartDelayMs ??
            0
        )
      )
    );
    const activeStartDelayFrames = computeTransitionDelayFrames(
      activeStartDelayMs,
      fps,
      durationInFrames
    );
    const activeStartOpacity = Math.max(
      0,
      Math.min(
        1,
        rawSelectedDevice.activeTransitionStartOpacity ??
          rawSelectedDevice.effects.transitionStartOpacity ??
          0
      )
    );
    const activeEndOpacity = Math.max(
      0,
      Math.min(
        1,
        rawSelectedDevice.activeTransitionEndOpacity ??
          rawSelectedDevice.effects.transitionEndOpacity ??
          1
      )
    );
    const activeStartOpacityPct = Math.round(activeStartOpacity * 100);
    const activeEndOpacityPct = Math.round(activeEndOpacity * 100);
    const activeMotionBlurEnabled = Boolean(
      rawSelectedDevice.activeTransitionMotionBlur ??
        rawSelectedDevice.effects.motionBlur ??
        false
    );
    const activeMotionBlurIntensity = Math.max(
      0,
      Math.min(
        1,
        rawSelectedDevice.activeTransitionMotionBlurIntensity ??
          rawSelectedDevice.effects.motionBlurIntensity ??
          (activeMotionBlurEnabled ? 0.5 : 0)
      )
    );
    const activeMotionBlurIntensityPct = Math.round(
      activeMotionBlurIntensity * 100
    );
    const activeLoopTransition = Boolean(
      rawSelectedDevice.activeTransitionLoop ??
        rawSelectedDevice.effects.loopTransition ??
        false
    );
    const loopCycleCount = Math.max(
      1,
      Math.ceil(durationInFrames / Math.max(2, activeDurationFrames))
    );
    const hasAppliedTransition = Boolean(
      activePresetId ||
        devKfs.length > 1 ||
        (selectedDevice.effects.entranceAnimation &&
          selectedDevice.effects.entranceAnimation !== 'none') ||
        (selectedDevice.effects.exitAnimation &&
          selectedDevice.effects.exitAnimation !== 'none') ||
        activeEasingValue !== 'linear' ||
        activeStartOpacity !== 0 ||
        activeEndOpacity !== 1 ||
        activeMotionBlurEnabled ||
        activeMotionBlurIntensity > 0 ||
        activeLoopTransition ||
        activeStartDelayMs > 0
    );

    const previewPresetId: AnimationPresetId =
      hoveredPresetId || activePresetId || currentStagedPresetId || 'slide-in';
    const previewPreset: DeviceTransitionPreset =
      DEVICE_TRANSITION_PRESETS.find((p) => p.id === previewPresetId) ||
      DEVICE_TRANSITION_PRESETS[0];
    const isHoverPreviewActive =
      Boolean(hoveredPresetId) ||
      isHoveringTransitionDropdown ||
      isTransitionDropdownMenuOpen;

    const parseSliderOpacity = (rawVal: number): number => {
      if (Number.isNaN(rawVal)) return 0;
      if (rawVal > 0 && rawVal < 1) {
        return Number(Math.max(0, Math.min(1, rawVal)).toFixed(2));
      }
      return Number(
        Math.max(0, Math.min(1, Math.round(rawVal) / 100)).toFixed(2)
      );
    };

    const handleApplyTransition = (transPreset: DeviceTransitionPreset) => {
      setSelectedAnimPreset(transPreset.id);
      setStagedPresetId(transPreset.id);
      setStagedPresetByDevice((prev) => ({
        ...prev,
        [selectedDevice.id]: transPreset.id,
      }));
      setIsTransitionDropdownMenuOpen(false);
      applyAnimationPresetToDevice(selectedDevice.id, transPreset.id, {
        timingMode: transitionTimingMode,
        transitionDurationFrames: activeDurationFrames,
        transitionDurationMs: activeDurationMs,
        startDelayMs: activeStartDelayMs,
        easing: activeEasingValue,
        customBezier: activeCustomBezier,
        startOpacity: activeStartOpacity,
        endOpacity: activeEndOpacity,
        motionBlur: activeMotionBlurEnabled,
        motionBlurIntensity: activeMotionBlurIntensity,
        loopTransition: activeLoopTransition,
        staggerFrames: transitionStaggerFrames,
        applyToAllSelected: true,
        autoPlay: autoPlayOnApply,
      });
    };

    const handleSelectTransitionEasing = (nextEasing: EasingType) => {
      setTransitionEasing(nextEasing);
      updateDeviceTransitionEasing(selectedDevice.id, nextEasing, {
        applyToAllSelected: true,
      });
    };

    const handleChangeCustomBezier = (
      nextBezier: CustomBezierControlPoints
    ) => {
      const clamped = clampCustomBezierPoints(nextBezier);
      setTransitionEasing('custom-path');
      setTransitionCustomBezier(clamped);
      updateDeviceTransitionCustomBezier(selectedDevice.id, clamped, {
        applyToAllSelected: true,
      });
    };

    const handleChangeTransitionDurationMs = (nextMs: number) => {
      const clampedMs = Math.max(100, Math.min(2000, Math.round(nextMs)));
      const nextFrames = Math.max(2, Math.round((clampedMs / 1000) * fps));
      setTransitionDurationMs(clampedMs);
      setTransitionDurationFrames(nextFrames);
      updateDeviceTransitionDuration(selectedDevice.id, clampedMs, {
        applyToAllSelected: true,
      });
    };

    const handleChangeTransitionStartDelayMs = (nextDelayMs: number) => {
      const parsed = Number.isNaN(nextDelayMs) ? 0 : nextDelayMs;
      const clampedDelayMs = Math.max(0, Math.min(5000, Math.round(parsed)));
      setTransitionStartDelayMs(clampedDelayMs);
      updateDeviceTransitionStartDelay(selectedDevice.id, clampedDelayMs, {
        applyToAllSelected: true,
      });
    };

    const handleChangeTransitionStartOpacity = (rawVal: number) => {
      const nextStart = parseSliderOpacity(rawVal);
      setTransitionStartOpacity(nextStart);
      updateDeviceTransitionOpacity(
        selectedDevice.id,
        { startOpacity: nextStart, endOpacity: activeEndOpacity },
        { applyToAllSelected: true }
      );
    };

    const handleChangeTransitionEndOpacity = (rawVal: number) => {
      const nextEnd = parseSliderOpacity(rawVal);
      setTransitionEndOpacity(nextEnd);
      updateDeviceTransitionOpacity(
        selectedDevice.id,
        { startOpacity: activeStartOpacity, endOpacity: nextEnd },
        { applyToAllSelected: true }
      );
    };

    const handleSetTransitionOpacityRange = (
      nextStart: number,
      nextEnd: number
    ) => {
      const clampedStart = Number(
        Math.max(0, Math.min(1, nextStart)).toFixed(2)
      );
      const clampedEnd = Number(Math.max(0, Math.min(1, nextEnd)).toFixed(2));
      setTransitionStartOpacity(clampedStart);
      setTransitionEndOpacity(clampedEnd);
      updateDeviceTransitionOpacity(
        selectedDevice.id,
        { startOpacity: clampedStart, endOpacity: clampedEnd },
        { applyToAllSelected: true }
      );
    };

    const handleToggleTransitionMotionBlur = (enabled: boolean) => {
      const nextIntensity = enabled
        ? activeMotionBlurIntensity > 0
          ? activeMotionBlurIntensity
          : 0.5
        : 0;
      setTransitionMotionBlur(enabled);
      setTransitionMotionBlurIntensity(nextIntensity);
      updateDeviceTransitionMotionBlur(
        selectedDevice.id,
        { enabled, intensity: nextIntensity },
        { applyToAllSelected: true }
      );
    };

    const handleChangeTransitionMotionBlurIntensity = (rawVal: number) => {
      const nextIntensity = parseSliderOpacity(rawVal);
      const nextEnabled = nextIntensity > 0;
      setTransitionMotionBlur(nextEnabled);
      setTransitionMotionBlurIntensity(nextIntensity);
      updateDeviceTransitionMotionBlur(
        selectedDevice.id,
        { enabled: nextEnabled, intensity: nextIntensity },
        { applyToAllSelected: true }
      );
    };

    const handleToggleTransitionLoop = (enabled: boolean) => {
      setTransitionLoop(enabled);
      updateDeviceTransitionLoop(selectedDevice.id, enabled, {
        applyToAllSelected: true,
      });
    };

    const handleResetTransition = () => {
      setSelectedAnimPreset(null);
      setStagedPresetId('slide-in');
      setStagedPresetByDevice((prev) => {
        const next = { ...prev };
        delete next[selectedDevice.id];
        return next;
      });
      setHoveredPresetId(null);
      setTransitionEasing('linear');
      setTransitionCustomBezier(DEFAULT_CUSTOM_BEZIER);
      setTransitionDurationMs(1000);
      setTransitionDurationFrames(Math.max(2, Math.round(fps)));
      setTransitionStartDelayMs(0);
      setTransitionStartOpacity(0);
      setTransitionEndOpacity(1);
      setTransitionMotionBlur(false);
      setTransitionMotionBlurIntensity(0);
      setTransitionLoop(false);
      resetDeviceTransition(selectedDevice.id, {
        applyToAllSelected: true,
      });
    };

    const handleCopyTransition = () => {
      const presetToCopy: AnimationPresetId =
        stagedPresetByDevice[selectedDevice.id] ??
        rawSelectedDevice.activeTransitionPresetId ??
        'slide-in';
      copyDeviceTransition(selectedDevice.id, {
        presetId: presetToCopy,
        durationMs: activeDurationMs,
        startDelayMs: activeStartDelayMs,
        easing: activeEasingValue,
        customBezier: activeCustomBezier,
        startOpacity: activeStartOpacity,
        endOpacity: activeEndOpacity,
        motionBlur: activeMotionBlurEnabled,
        motionBlurIntensity: activeMotionBlurEnabled
          ? activeMotionBlurIntensity
          : 0,
        loopTransition: activeLoopTransition,
        entranceAnimation: selectedDevice.effects.entranceAnimation,
        exitAnimation: selectedDevice.effects.exitAnimation,
      });
    };

    const handlePasteTransition = () => {
      if (!copiedTransition) return;
      const pastedPreset = copiedTransition.presetId || 'slide-in';
      const targets =
        selectedIds.length > 0 && selectedIds.includes(selectedDevice.id)
          ? selectedIds
          : [selectedDevice.id];
      setStagedPresetByDevice((prev) => {
        const next = { ...prev };
        targets.forEach((id) => {
          next[id] = pastedPreset;
        });
        return next;
      });
      setSelectedAnimPreset(copiedTransition.presetId);
      setStagedPresetId(pastedPreset);
      setTransitionEasing(copiedTransition.easing);
      if (copiedTransition.customBezier) {
        setTransitionCustomBezier(
          clampCustomBezierPoints(copiedTransition.customBezier)
        );
      }
      setTransitionDurationMs(copiedTransition.durationMs);
      setTransitionDurationFrames(
        Math.max(2, Math.round((copiedTransition.durationMs / 1000) * fps))
      );
      setTransitionStartDelayMs(copiedTransition.startDelayMs ?? 0);
      setTransitionStartOpacity(copiedTransition.startOpacity);
      setTransitionEndOpacity(copiedTransition.endOpacity);
      setTransitionMotionBlur(copiedTransition.motionBlur);
      setTransitionMotionBlurIntensity(
        copiedTransition.motionBlur ? copiedTransition.motionBlurIntensity : 0
      );
      setTransitionLoop(Boolean(copiedTransition.loopTransition));
      pasteDeviceTransition(selectedDevice.id, {
        applyToAllSelected: true,
        autoPlay: autoPlayOnApply,
      });
    };

    const copiedPresetMeta = copiedTransition?.presetId
      ? DEVICE_TRANSITION_PRESETS.find(
          (p) => p.id === copiedTransition.presetId
        )
      : null;
    const copiedPresetLabel = copiedPresetMeta
      ? copiedPresetMeta.name
      : copiedTransition?.presetId || 'Custom';

    const renderTransitionClipboardControls = (idPrefix: string) => (
      <div
        data-testid={`${idPrefix}-clipboard-controls`}
        className="bg-slate-50 border border-slate-200 rounded-md p-2 space-y-1.5"
      >
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-label="Copy Transition"
            data-testid={`${idPrefix}-copy-transition-button`}
            title="Copy preset, duration, easing, opacity, and motion blur settings from this device"
            onClick={handleCopyTransition}
            className="py-1.5 px-2.5 rounded-md bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Copy className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Copy Transition</span>
          </button>
          <button
            type="button"
            aria-label="Paste Transition"
            data-testid={`${idPrefix}-paste-transition-button`}
            title={
              copiedTransition
                ? `Apply copied transition from ${copiedTransition.sourceDeviceName} to selected device`
                : 'Copy a transition setup from a device first'
            }
            disabled={!copiedTransition}
            onClick={handlePasteTransition}
            className={`py-1.5 px-2.5 rounded-md border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              copiedTransition
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            <Clipboard className="w-3 h-3 shrink-0" />
            <span>Paste Transition</span>
          </button>
        </div>

        {copiedTransition && (
          <div
            data-testid={`${idPrefix}-copied-transition-summary`}
            className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-blue-50/80 border border-blue-200/80 text-[10px] text-blue-900"
          >
            <div className="flex items-center gap-1 min-w-0">
              <Check className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="font-semibold truncate">
                Copied ({copiedTransition.sourceDeviceName}):
              </span>
            </div>
            <span className="font-mono text-[9px] text-blue-700 shrink-0">
              {copiedPresetLabel} · {copiedTransition.durationMs}ms
              {copiedTransition.startDelayMs
                ? ` · +${copiedTransition.startDelayMs}ms`
                : ''}{' '}
              · {copiedTransition.easing} ·{' '}
              {Math.round(copiedTransition.startOpacity * 100)}%→
              {Math.round(copiedTransition.endOpacity * 100)}% ·{' '}
              {copiedTransition.motionBlur
                ? `MB ${Math.round(copiedTransition.motionBlurIntensity * 100)}%`
                : 'MB Off'}
              {copiedTransition.loopTransition ? ' · Loop ∞' : ''}
            </span>
          </div>
        )}
      </div>
    );

    const renderTransitionStartDelayControls = (idPrefix: string) => (
      <div
        data-testid={`${idPrefix}-start-delay-controls`}
        className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-1.5"
      >
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${idPrefix}-start-delay-input`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"
          >
            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Start Delay</span>
          </label>
          <span
            data-testid={`${idPrefix}-start-delay-status`}
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
              activeStartDelayMs > 0
                ? 'text-blue-700 bg-blue-50 border-blue-200'
                : 'text-slate-500 bg-white border-slate-200'
            }`}
          >
            {activeStartDelayMs > 0
              ? `+${activeStartDelayMs}ms (F${String(activeStartDelayFrames).padStart(3, '0')} · +${(
                  activeStartDelayMs / 1000
                ).toFixed(2)}s)`
              : '0ms (F000 · No Delay)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id={`${idPrefix}-start-delay-input`}
              aria-label="Start Delay"
              data-testid={`${idPrefix}-start-delay-input`}
              type="number"
              min={0}
              max={5000}
              step={50}
              value={activeStartDelayMs}
              onChange={(e) =>
                handleChangeTransitionStartDelayMs(Number(e.target.value))
              }
              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 pr-14 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-400"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
              ms · +{activeStartDelayFrames}f
            </span>
          </div>
          {activeStartDelayMs > 0 && (
            <button
              type="button"
              data-testid={`${idPrefix}-start-delay-clear`}
              onClick={() => handleChangeTransitionStartDelayMs(0)}
              title="Reset Start Delay to 0ms"
              className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium cursor-pointer shrink-0"
            >
              0ms
            </button>
          )}
        </div>

        <input
          id={`${idPrefix}-start-delay-slider`}
          aria-label="Start Delay Slider"
          data-testid={`${idPrefix}-start-delay-slider`}
          type="range"
          min={0}
          max={3000}
          step={50}
          value={Math.min(3000, activeStartDelayMs)}
          onChange={(e) =>
            handleChangeTransitionStartDelayMs(Number(e.target.value))
          }
          className="w-full accent-blue-600 cursor-pointer"
        />

        <div className="grid grid-cols-5 gap-1">
          {[0, 250, 500, 1000, 2000].map((delayOptMs) => (
            <button
              key={delayOptMs}
              type="button"
              data-testid={`${idPrefix}-start-delay-preset-${delayOptMs}`}
              onClick={() => handleChangeTransitionStartDelayMs(delayOptMs)}
              className={`py-0.5 rounded text-[9px] font-mono border cursor-pointer ${
                activeStartDelayMs === delayOptMs
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {delayOptMs === 0 ? '0ms' : `+${delayOptMs}ms`}
            </button>
          ))}
        </div>
      </div>
    );

    const renderTransitionLoopControl = (idPrefix: string) => (
      <div
        data-testid={`${idPrefix}-loop-transition-controls`}
        className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-1"
      >
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${idPrefix}-loop-transition-checkbox`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer"
          >
            <input
              id={`${idPrefix}-loop-transition-checkbox`}
              aria-label="Loop Transition"
              data-testid={`${idPrefix}-loop-transition-checkbox`}
              type="checkbox"
              checked={activeLoopTransition}
              onChange={(e) => handleToggleTransitionLoop(e.target.checked)}
              className="accent-blue-600 rounded cursor-pointer"
            />
            <span>Loop Transition</span>
          </label>
          <span
            data-testid={`${idPrefix}-loop-transition-status`}
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
              activeLoopTransition
                ? 'text-blue-700 bg-blue-50 border-blue-200'
                : 'text-slate-500 bg-white border-slate-200'
            }`}
          >
            {activeLoopTransition
              ? `Repeating ∞ (${activeDurationMs}ms · ${loopCycleCount}×)`
              : 'Single Play (1×)'}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 leading-snug">
          {activeLoopTransition
            ? `Applied transition repeats indefinitely every ${activeDurationMs}ms (${activeDurationFrames}f · ${loopCycleCount} cycles across ${durationInFrames}f sequence).`
            : 'Enable to repeat the applied transition preset indefinitely during playback.'}
        </div>
      </div>
    );

    const renderTransitionMotionBlurControls = (idPrefix: string) => (
      <div
        data-testid="transition-motion-blur-controls"
        className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${idPrefix}-motion-blur-checkbox`}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer"
          >
            <input
              id={`${idPrefix}-motion-blur-checkbox`}
              aria-label="Motion Blur"
              data-testid={`${idPrefix}-motion-blur-checkbox`}
              type="checkbox"
              checked={activeMotionBlurEnabled}
              onChange={(e) =>
                handleToggleTransitionMotionBlur(e.target.checked)
              }
              className="accent-blue-600 rounded cursor-pointer"
            />
            <span>Motion Blur</span>
          </label>
          <span
            data-testid={`${idPrefix}-motion-blur-status`}
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
              activeMotionBlurEnabled
                ? 'text-blue-700 bg-blue-50 border-blue-200'
                : 'text-slate-500 bg-white border-slate-200'
            }`}
          >
            {activeMotionBlurEnabled
              ? `Enabled · ${activeMotionBlurIntensityPct}%`
              : 'Off (0%)'}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <label
              htmlFor={`${idPrefix}-motion-blur-intensity-slider`}
              className="font-medium text-slate-700"
            >
              Motion Blur Intensity
            </label>
            <span className="font-mono text-slate-700">
              {activeMotionBlurEnabled ? activeMotionBlurIntensityPct : 0}%
            </span>
          </div>
          <input
            id={`${idPrefix}-motion-blur-intensity-slider`}
            aria-label="Motion Blur Intensity"
            data-testid={`${idPrefix}-motion-blur-intensity-slider`}
            type="range"
            min={0}
            max={100}
            step={0.01}
            value={activeMotionBlurEnabled ? activeMotionBlurIntensityPct : 0}
            onChange={(e) =>
              handleChangeTransitionMotionBlurIntensity(Number(e.target.value))
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            {[
              { label: 'Off', val: 0 },
              { label: '25%', val: 0.25 },
              { label: '50%', val: 0.5 },
              { label: '75%', val: 0.75 },
              { label: '100%', val: 1 },
            ].map((presetOpt) => {
              const effectiveInt = activeMotionBlurEnabled
                ? activeMotionBlurIntensity
                : 0;
              const isSelectedPreset =
                Math.abs(effectiveInt - presetOpt.val) < 0.01;
              return (
                <button
                  key={presetOpt.label}
                  type="button"
                  onClick={() =>
                    presetOpt.val === 0
                      ? handleToggleTransitionMotionBlur(false)
                      : handleChangeTransitionMotionBlurIntensity(
                          presetOpt.val * 100
                        )
                  }
                  className={`py-0.5 rounded text-[9px] font-mono border cursor-pointer ${
                    isSelectedPreset
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {presetOpt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

    const renderTransitionOpacityControls = (idPrefix: string) => (
      <div
        data-testid="transition-opacity-range-controls"
        className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-2"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold text-slate-700">
            Transition Opacity Range
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
              {activeStartOpacityPct}% → {activeEndOpacityPct}%
            </span>
            <button
              type="button"
              title="Swap starting and ending opacity levels"
              onClick={() =>
                handleSetTransitionOpacityRange(
                  activeEndOpacity,
                  activeStartOpacity
                )
              }
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium cursor-pointer"
            >
              ⇄ Swap
            </button>
          </div>
        </div>

        {/* Visual Fading Transparency Range Bar */}
        <div
          className="h-2.5 rounded-full border border-slate-300/80 relative overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
          }}
        >
          <div
            className="absolute inset-0 transition-all"
            style={{
              background: `linear-gradient(90deg, rgba(37, 99, 235, ${activeStartOpacity.toFixed(
                2
              )}) 0%, rgba(37, 99, 235, ${activeEndOpacity.toFixed(2)}) 100%)`,
            }}
          />
        </div>

        <div className="space-y-1.5">
          {/* Starting Opacity Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <label
                htmlFor={`${idPrefix}-start-opacity-slider`}
                className="font-medium text-slate-700"
              >
                Starting Opacity
              </label>
              <span className="font-mono text-slate-700">
                {activeStartOpacityPct}%
              </span>
            </div>
            <input
              id={`${idPrefix}-start-opacity-slider`}
              aria-label="Starting Opacity"
              data-testid={`${idPrefix}-start-opacity-slider`}
              type="range"
              min={0}
              max={100}
              step={0.01}
              value={activeStartOpacityPct}
              onChange={(e) =>
                handleChangeTransitionStartOpacity(Number(e.target.value))
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Ending Opacity Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <label
                htmlFor={`${idPrefix}-end-opacity-slider`}
                className="font-medium text-slate-700"
              >
                Ending Opacity
              </label>
              <span className="font-mono text-slate-700">
                {activeEndOpacityPct}%
              </span>
            </div>
            <input
              id={`${idPrefix}-end-opacity-slider`}
              aria-label="Ending Opacity"
              data-testid={`${idPrefix}-end-opacity-slider`}
              type="range"
              min={0}
              max={100}
              step={0.01}
              value={activeEndOpacityPct}
              onChange={(e) =>
                handleChangeTransitionEndOpacity(Number(e.target.value))
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Transparency Range Presets */}
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          {[
            { label: '0%→100%', start: 0, end: 1 },
            { label: '25%→100%', start: 0.25, end: 1 },
            { label: '50%→100%', start: 0.5, end: 1 },
            { label: '100%→0%', start: 1, end: 0 },
          ].map((rng) => {
            const isActiveRange =
              Math.abs(activeStartOpacity - rng.start) < 0.01 &&
              Math.abs(activeEndOpacity - rng.end) < 0.01;
            return (
              <button
                key={rng.label}
                type="button"
                onClick={() =>
                  handleSetTransitionOpacityRange(rng.start, rng.end)
                }
                className={`py-0.5 rounded text-[9px] font-mono border cursor-pointer ${
                  isActiveRange
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {rng.label}
              </button>
            );
          })}
        </div>
      </div>
    );

    const renderDirectionBadgeIcon = (
      hint: DeviceTransitionPreset['directionHint'],
      isActive: boolean
    ) => {
      const iconCls = `w-3.5 h-3.5 shrink-0 ${
        isActive ? 'text-blue-600' : 'text-slate-500'
      }`;
      switch (hint) {
        case 'left':
          return <ArrowLeft className={iconCls} />;
        case 'right':
          return <ArrowRight className={iconCls} />;
        case 'up':
          return <ArrowUp className={iconCls} />;
        case 'down':
          return <ArrowDown className={iconCls} />;
        case 'in':
          return <Maximize2 className={iconCls} />;
        case 'out':
          return <Minimize2 className={iconCls} />;
        case 'fade':
          return <Sparkles className={iconCls} />;
        case '3d':
          return <Layers className={iconCls} />;
        case 'loop':
        default:
          return <Play className={iconCls} />;
      }
    };

    const filteredTransitionPresets = DEVICE_TRANSITION_PRESETS.filter((tp) => {
      const matchCat =
        transitionCategory === 'All' || tp.category === transitionCategory;
      const q = transitionSearch.trim().toLowerCase();
      const matchQuery =
        !q ||
        tp.name.toLowerCase().includes(q) ||
        tp.shortLabel.toLowerCase().includes(q) ||
        tp.description.toLowerCase().includes(q) ||
        tp.category.toLowerCase().includes(q) ||
        tp.group.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });

    const quickTransitionPresets = DEVICE_TRANSITION_PRESETS.filter((tp) =>
      [
        'slide-in',
        'fade',
        'zoom',
        'flip-3d',
        'slide-out',
        'fade-out',
        'zoom-punch-out',
        'zoom-bounce',
        'smooth-scale',
        'glow-pulse',
      ].includes(tp.id)
    );

    const favoritePresets: DeviceTransitionPreset[] =
      favoriteTransitionPresetIds
        .map((id) => DEVICE_TRANSITION_PRESETS.find((tp) => tp.id === id))
        .filter((tp): tp is DeviceTransitionPreset => Boolean(tp));

    const favoriteFilteredPresets: DeviceTransitionPreset[] =
      favoritePresets.filter((tp) =>
        filteredTransitionPresets.some((f) => f.id === tp.id)
      );

    const handleToggleTransitionGroup = (
      group: TransitionPresetGroup | 'Favorites'
    ) => {
      setSelectedTransitionGroup((prev) => (prev === group ? 'All' : group));
    };

    const renderFavoriteStarButton = (
      tp: DeviceTransitionPreset,
      idPrefix: string
    ) => {
      const isFav = favoriteTransitionPresetIds.includes(tp.id);
      return (
        <button
          type="button"
          aria-label={
            isFav ? `Remove ${tp.name} from Favorites` : `Favorite ${tp.name}`
          }
          aria-pressed={isFav}
          title={
            isFav
              ? `Remove ${tp.name} from Favorites`
              : `Save ${tp.name} to Favorites`
          }
          data-testid={`${idPrefix}-favorite-${tp.id}`}
          data-favorite-preset={tp.id}
          data-favorited={isFav ? 'true' : 'false'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteTransitionPreset(tp.id);
          }}
          className={`p-1 rounded transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
            isFav
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 border border-amber-200'
              : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50/70 border border-transparent hover:border-amber-200/70'
          }`}
        >
          <Star
            className={`w-3 h-3 ${
              isFav ? 'fill-amber-400 text-amber-500' : ''
            }`}
          />
        </button>
      );
    };

    const renderDropdownPresetItem = (
      tp: DeviceTransitionPreset,
      idPrefix: 'quick-transition' | 'inspector-transition',
      favPrefix: string,
      isFavSection = false
    ) => {
      const isItemHovered = previewPreset.id === tp.id;
      const isItemApplied =
        rawSelectedDevice.activeTransitionPresetId === tp.id;

      if (transitionDropdownViewMode === 'grid') {
        return (
          <div
            key={`${favPrefix}-grid-${tp.id}`}
            data-testid={`${idPrefix}-dropdown-gallery-card-${tp.id}`}
            data-preset-id={tp.id}
            data-category={tp.category}
            data-group={tp.group}
            onMouseEnter={() => {
              setHoveredPresetId(tp.id);
              setStagedPresetId(tp.id);
            }}
            onMouseLeave={() => setHoveredPresetId(null)}
            className={`rounded-md border p-1.5 transition-all flex flex-col gap-1 relative ${
              isItemHovered
                ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-2xs'
                : isItemApplied
                  ? 'bg-emerald-50/60 border-emerald-300 text-slate-900'
                  : isFavSection
                    ? 'bg-white hover:bg-amber-50/40 border-amber-200/80 text-slate-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
            }`}
          >
            <button
              type="button"
              role="option"
              aria-selected={isItemHovered}
              onFocus={() => {
                setHoveredPresetId(tp.id);
                setStagedPresetId(tp.id);
              }}
              onClick={() => handleApplyTransition(tp)}
              title={`${tp.name} (${tp.category} · ${tp.group}) — ${tp.description}`}
              className="w-full text-left flex flex-col gap-1 cursor-pointer min-w-0"
            >
              <TransitionGalleryVisualPreview
                preset={tp}
                easing={activeEasingValue}
                customBezier={activeCustomBezier}
                durationMs={activeDurationMs}
                startOpacity={activeStartOpacity}
                endOpacity={activeEndOpacity}
                isActive={isItemHovered || isItemApplied}
                testIdPrefix={`${idPrefix}-dropdown`}
              />
              <div className="flex items-center gap-1 min-w-0 pr-5 pt-0.5">
                {renderDirectionBadgeIcon(
                  tp.directionHint,
                  isItemHovered || isItemApplied
                )}
                <span className="text-[10px] font-semibold truncate">
                  {tp.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-slate-400">
                <span className="truncate">
                  {tp.category} · {tp.badge}
                </span>
                <span
                  className={
                    isItemApplied
                      ? 'text-emerald-600 font-semibold shrink-0'
                      : 'text-slate-400 shrink-0'
                  }
                >
                  {isItemApplied ? 'Applied' : isFavSection ? 'Saved' : 'Apply'}
                </span>
              </div>
            </button>
            <div className="absolute bottom-5 right-1.5 z-10">
              {renderFavoriteStarButton(tp, favPrefix)}
            </div>
          </div>
        );
      }

      return (
        <div
          key={`${favPrefix}-list-${tp.id}`}
          data-testid={`${idPrefix}-dropdown-list-item-${tp.id}`}
          className={`w-full px-2 py-1 flex items-center justify-between gap-1.5 transition-colors ${
            isItemHovered
              ? 'bg-blue-50 text-blue-900 font-semibold'
              : isFavSection
                ? 'hover:bg-amber-50/50 text-slate-700'
                : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <button
            type="button"
            role="option"
            aria-selected={isItemHovered}
            onMouseEnter={() => {
              setHoveredPresetId(tp.id);
              setStagedPresetId(tp.id);
            }}
            onFocus={() => {
              setHoveredPresetId(tp.id);
              setStagedPresetId(tp.id);
            }}
            onClick={() => handleApplyTransition(tp)}
            className="flex-1 min-w-0 text-left flex items-center justify-between gap-2 text-[11px] cursor-pointer py-0.5"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {renderDirectionBadgeIcon(
                tp.directionHint,
                isItemHovered || isItemApplied
              )}
              <span className="truncate">{tp.name}</span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 shrink-0">
              {tp.category} ·{' '}
              {isItemApplied
                ? 'Applied'
                : isFavSection
                  ? 'Saved'
                  : 'Hover to preview'}
            </span>
          </button>
          {renderFavoriteStarButton(tp, favPrefix)}
        </div>
      );
    };

    const renderTransitionPresetDropdownCard = (
      idPrefix: 'quick-transition' | 'inspector-transition'
    ) => {
      const favoriteDropdownItems = favoritePresets.filter(
        (tp) =>
          dropdownCategoryFilter === 'All' ||
          tp.category === dropdownCategoryFilter
      );

      return (
        <div
          data-testid={`${idPrefix}-preset-dropdown`}
          className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-2 relative"
          onMouseEnter={() => setIsHoveringTransitionDropdown(true)}
          onMouseLeave={() => setIsHoveringTransitionDropdown(false)}
        >
          <div className="flex items-center justify-between gap-1.5">
            <label
              htmlFor={`${idPrefix}-preset-select`}
              className="text-[11px] font-semibold text-slate-700 shrink-0"
            >
              Transition Preset
            </label>
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
              <select
                id={`${idPrefix}-preset-select`}
                aria-label="Transition Preset"
                value={currentStagedPresetId}
                onClick={() => setIsTransitionDropdownMenuOpen(true)}
                onFocus={() => {
                  setIsHoveringTransitionDropdown(true);
                  setIsTransitionDropdownMenuOpen(true);
                }}
                onBlur={() => setIsHoveringTransitionDropdown(false)}
                onChange={(e) => {
                  const nextId = e.target.value as AnimationPresetId;
                  setStagedPresetId(nextId);
                  setStagedPresetByDevice((prev) => ({
                    ...prev,
                    [selectedDevice.id]: nextId,
                  }));
                  setHoveredPresetId(nextId);
                  setIsTransitionDropdownMenuOpen(true);
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:border-blue-400 cursor-pointer max-w-[116px] truncate"
              >
                {favoritePresets.length > 0 && (
                  <optgroup
                    label="Favorites"
                    title="Favorites — Frequently used animations"
                    data-testid={`${idPrefix}-optgroup-favorites`}
                  >
                    {favoritePresets.map((tp) => (
                      <option key={`fav-${idPrefix}-${tp.id}`} value={tp.id}>
                        ★ {tp.name} ({tp.category})
                      </option>
                    ))}
                  </optgroup>
                )}
                {TRANSITION_PRESET_GROUPS.map((grp) => (
                  <optgroup
                    key={grp.id}
                    label={grp.label}
                    title={`${grp.label} — ${grp.description}`}
                    data-testid={`${idPrefix}-optgroup-${grp.id.toLowerCase()}`}
                  >
                    {DEVICE_TRANSITION_PRESETS.filter(
                      (tp) => tp.group === grp.id
                    ).map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.name} ({tp.category})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* View Mode Switcher: Grid Gallery vs List */}
              <div
                role="group"
                aria-label="Dropdown Gallery View Mode"
                className="flex items-center bg-white border border-slate-200 rounded p-0.5 shrink-0"
              >
                <button
                  type="button"
                  aria-label="Grid Gallery View"
                  aria-pressed={transitionDropdownViewMode === 'grid'}
                  data-testid={`${idPrefix}-dropdown-grid-view-button`}
                  title="Grid-based gallery view with visual animation previews"
                  onClick={() => {
                    setTransitionDropdownViewMode('grid');
                    setIsTransitionDropdownMenuOpen(true);
                  }}
                  className={`px-1 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5 cursor-pointer transition-colors ${
                    transitionDropdownViewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-2.5 h-2.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  aria-label="List View"
                  aria-pressed={transitionDropdownViewMode === 'list'}
                  data-testid={`${idPrefix}-dropdown-list-view-button`}
                  title="Compact list view"
                  onClick={() => {
                    setTransitionDropdownViewMode('list');
                    setIsTransitionDropdownMenuOpen(true);
                  }}
                  className={`px-1 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5 cursor-pointer transition-colors ${
                    transitionDropdownViewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <List className="w-2.5 h-2.5" />
                </button>
              </div>

              <button
                type="button"
                aria-label="Browse Transition Presets with Hover Preview"
                aria-expanded={isTransitionDropdownMenuOpen}
                data-testid={`${idPrefix}-dropdown-toggle-button`}
                title="Toggle transition preset gallery dropdown"
                onClick={() =>
                  setIsTransitionDropdownMenuOpen((prev) => !prev)
                }
                className="px-1 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium flex items-center cursor-pointer shrink-0"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Quick Section Header Navigation Bar (All, Favorites, Entrances, Exits, Emphasis) */}
          <div
            role="navigation"
            aria-label="Transition Preset Dropdown Sections"
            data-testid={`${idPrefix}-dropdown-section-nav`}
            className="grid grid-cols-5 gap-1 bg-white p-1 rounded border border-slate-200/90"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedTransitionGroup('All');
                setIsTransitionDropdownMenuOpen(true);
              }}
              className={`py-0.5 px-1 rounded text-[9px] font-semibold transition-colors cursor-pointer truncate ${
                selectedTransitionGroup === 'All'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              data-testid={`${idPrefix}-dropdown-nav-favorites`}
              onClick={() => {
                setSelectedTransitionGroup((prev) =>
                  prev === 'Favorites' ? 'All' : 'Favorites'
                );
                setIsTransitionDropdownMenuOpen(true);
              }}
              className={`py-0.5 px-1 rounded text-[9px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-0.5 truncate ${
                selectedTransitionGroup === 'Favorites'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Star
                className={`w-2.5 h-2.5 shrink-0 ${
                  selectedTransitionGroup === 'Favorites'
                    ? 'fill-white text-white'
                    : 'fill-amber-400 text-amber-500'
                }`}
              />
              <span className="truncate">Favs</span>
              <span className="font-mono text-[8px] opacity-80">
                {favoritePresets.length}
              </span>
            </button>
            {TRANSITION_PRESET_GROUPS.map((grp) => {
              const count = DEVICE_TRANSITION_PRESETS.filter(
                (tp) => tp.group === grp.id
              ).length;
              const isActiveSec = selectedTransitionGroup === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  data-testid={`${idPrefix}-dropdown-nav-${grp.id.toLowerCase()}`}
                  onClick={() => {
                    setSelectedTransitionGroup((prev) =>
                      prev === grp.id ? 'All' : grp.id
                    );
                    setIsTransitionDropdownMenuOpen(true);
                  }}
                  className={`py-0.5 px-1 rounded text-[9px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 truncate ${
                    isActiveSec
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isActiveSec
                        ? 'bg-white'
                        : grp.id === 'Entrances'
                          ? 'bg-emerald-500'
                          : grp.id === 'Exits'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                    }`}
                  />
                  <span className="truncate">{grp.label}</span>
                  <span className="font-mono text-[8px] opacity-75">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Motion Category Filter Bar (All, Slide, Fade, Zoom, 3D, Loop) */}
          <div
            role="navigation"
            aria-label="Transition Preset Categories"
            data-testid={`${idPrefix}-dropdown-category-nav`}
            className="grid grid-cols-6 gap-1 bg-white px-1 py-0.5 rounded border border-slate-200/80"
          >
            {TRANSITION_CATEGORIES.map((cat) => {
              const isCatActive = dropdownCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`${idPrefix}-dropdown-cat-${cat.id.toLowerCase()}`}
                  onClick={() => {
                    setDropdownCategoryFilter((prev) =>
                      prev === cat.id && cat.id !== 'All' ? 'All' : cat.id
                    );
                    setIsTransitionDropdownMenuOpen(true);
                  }}
                  className={`py-0.5 px-1 rounded text-[8px] font-semibold transition-colors cursor-pointer truncate ${
                    isCatActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Dropdown Gallery & Section List */}
          {isTransitionDropdownMenuOpen && (
            <div
              role="listbox"
              aria-label="Transition Preset Hover Preview Options"
              data-testid={`${idPrefix}-grouped-dropdown-menu`}
              data-view-mode={transitionDropdownViewMode}
              className="max-h-72 overflow-y-auto bg-white border border-blue-300 rounded-md shadow-md divide-y divide-slate-100"
            >
              {(selectedTransitionGroup === 'All' ||
                selectedTransitionGroup === 'Favorites') &&
                favoriteDropdownItems.length > 0 && (
                  <div
                    role="group"
                    aria-label="Favorites"
                    data-testid={`${idPrefix}-dropdown-section-favorites`}
                    className="divide-y divide-amber-100/60 bg-amber-50/20"
                  >
                    <div
                      data-testid={`${idPrefix}-dropdown-header-favorites`}
                      className="sticky top-0 z-10 px-2.5 py-1.5 bg-amber-50/95 backdrop-blur-xs border-b border-amber-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          Favorites
                        </h4>
                        <span className="text-[9px] text-amber-700/80 truncate">
                          — Saved transitions
                        </span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-white border border-amber-200 font-mono text-[9px] font-semibold text-amber-800 shrink-0">
                        {favoriteDropdownItems.length}
                      </span>
                    </div>
                    <div
                      data-testid={`${idPrefix}-dropdown-gallery-grid-favorites`}
                      className={
                        transitionDropdownViewMode === 'grid'
                          ? 'grid grid-cols-2 gap-1.5 p-1.5'
                          : 'divide-y divide-amber-100/60'
                      }
                    >
                      {favoriteDropdownItems.map((tp) =>
                        renderDropdownPresetItem(
                          tp,
                          idPrefix,
                          `${idPrefix}-dropdown-fav`,
                          true
                        )
                      )}
                    </div>
                  </div>
                )}

              {TRANSITION_PRESET_GROUPS.filter(
                (grp) =>
                  selectedTransitionGroup === 'All' ||
                  selectedTransitionGroup === grp.id
              ).map((grp) => {
                const groupOptions = DEVICE_TRANSITION_PRESETS.filter(
                  (tp) =>
                    tp.group === grp.id &&
                    (dropdownCategoryFilter === 'All' ||
                      tp.category === dropdownCategoryFilter)
                );
                if (groupOptions.length === 0) return null;
                return (
                  <div
                    key={grp.id}
                    role="group"
                    aria-label={grp.label}
                    data-testid={`${idPrefix}-dropdown-section-${grp.id.toLowerCase()}`}
                    className="divide-y divide-slate-100"
                  >
                    <div
                      data-testid={`${idPrefix}-dropdown-header-${grp.id.toLowerCase()}`}
                      className="sticky top-0 z-10 px-2.5 py-1.5 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            grp.id === 'Entrances'
                              ? 'bg-emerald-500'
                              : grp.id === 'Exits'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                          }`}
                        />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                          {grp.label}
                        </h4>
                        <span className="text-[9px] text-slate-500 truncate">
                          — {grp.description}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 font-mono text-[9px] font-semibold text-slate-600 shrink-0">
                        {groupOptions.length}
                      </span>
                    </div>
                    <div
                      data-testid={`${idPrefix}-dropdown-gallery-grid-${grp.id.toLowerCase()}`}
                      className={
                        transitionDropdownViewMode === 'grid'
                          ? 'grid grid-cols-2 gap-1.5 p-1.5'
                          : 'divide-y divide-slate-50'
                      }
                    >
                      {groupOptions.map((tp) =>
                        renderDropdownPresetItem(
                          tp,
                          idPrefix,
                          `${idPrefix}-dropdown`,
                          false
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Small Animation Thumbnail Preview of the Selected/Hovered Preset Before Applying */}
          <TransitionPresetThumbnail
            preset={previewPreset}
            easing={activeEasingValue}
            customBezier={activeCustomBezier}
            durationMs={activeDurationMs}
            startOpacity={activeStartOpacity}
            endOpacity={activeEndOpacity}
            motionBlurEnabled={activeMotionBlurEnabled}
            motionBlurIntensity={activeMotionBlurIntensity}
            loopTransition={activeLoopTransition}
            isHovering={isHoverPreviewActive}
            isApplied={
              rawSelectedDevice.activeTransitionPresetId === previewPreset.id
            }
            onApply={() => handleApplyTransition(previewPreset)}
          />
        </div>
      );
    };

    return (
      <aside
        aria-label="Device Properties Inspector"
        className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none shrink-0 z-20"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <input
                type="text"
                value={rawSelectedDevice.name}
                onChange={(e) =>
                  updateDevice(selectedDevice.id, { name: e.target.value })
                }
                className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none focus:bg-slate-50 rounded px-1 -ml-1 truncate w-36"
              />
              {multiSelectedCount > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700 shrink-0">
                  {multiSelectedCount} Selected
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {preset.name} ·{' '}
              {Math.round(selectedDevice.width * selectedDevice.scaleX)}×
              {Math.round(selectedDevice.height * selectedDevice.scaleY)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={duplicateSelectedDevices}
              title="Duplicate Device"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={deleteSelectedDevices}
              title="Delete Device"
              className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {renderKeyframeBar(selectedDevice.id, devKfs.length, hasKf)}

        {/* Contextual Inspector Tabs */}
        <div className="grid grid-cols-5 bg-slate-50 p-1 border-b border-slate-200 gap-0.5">
          {(
            [
              { id: 'transform', label: 'Transform' },
              { id: 'style', label: 'Frame' },
              { id: 'media', label: 'Screen' },
              { id: 'effects', label: 'Glow' },
              { id: 'animation', label: 'Transitions' },
            ] as { id: InspectorTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-1.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {activeTab === 'transform' && (
            <>
              {/* Quick Alignment Bar */}
              <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, {
                      x:
                        (selectedDevice.width * selectedDevice.scaleX) / 2 + 60,
                    })
                  }
                  title="Align Left"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignStartVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, { x: canvasWidth / 2 })
                  }
                  title="Center Horizontally"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignCenterVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, {
                      x:
                        canvasWidth -
                        (selectedDevice.width * selectedDevice.scaleX) / 2 -
                        60,
                    })
                  }
                  title="Align Right"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignEndVertical className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, {
                      y:
                        (selectedDevice.height * selectedDevice.scaleY) / 2 +
                        60,
                    })
                  }
                  title="Align Top"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignStartHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, { y: canvasHeight / 2 })
                  }
                  title="Center Vertically"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignCenterHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateDevice(selectedDevice.id, {
                      y:
                        canvasHeight -
                        (selectedDevice.height * selectedDevice.scaleY) / 2 -
                        60,
                    })
                  }
                  title="Align Bottom"
                  className="p-1.5 rounded hover:bg-white text-slate-600 flex justify-center"
                >
                  <AlignEndHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Position X
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedDevice.x)}
                    onChange={(e) =>
                      updateDevice(selectedDevice.id, {
                        x: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Position Y
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedDevice.y)}
                    onChange={(e) =>
                      updateDevice(selectedDevice.id, {
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Scale</span>
                  <span className="font-mono">
                    {Math.round(selectedDevice.scaleX * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={2.2}
                  step={0.02}
                  value={selectedDevice.scaleX}
                  onChange={(e) => {
                    const s = Number(e.target.value);
                    updateDevice(selectedDevice.id, { scaleX: s, scaleY: s });
                  }}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>2D Rotation</span>
                  <span className="font-mono">
                    {Math.round(selectedDevice.rotation)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedDevice.rotation}
                  onChange={(e) =>
                    updateDevice(selectedDevice.id, {
                      rotation: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>3D Perspective Tilt (Y)</span>
                  <span className="font-mono">
                    {Math.round(selectedDevice.rotation3DY)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={selectedDevice.rotation3DY}
                  onChange={(e) =>
                    updateDevice(selectedDevice.id, {
                      rotation3DY: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Opacity</span>
                  <span className="font-mono">
                    {Math.round(selectedDevice.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.02}
                  value={selectedDevice.opacity}
                  onChange={(e) =>
                    updateDevice(selectedDevice.id, {
                      opacity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Quick Transition Presets Strip directly accessible in Transform Tab */}
              <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-800">
                      Quick Transition Presets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetTransition}
                      title="Clear applied transition effects and reset easing to linear"
                      className="text-[11px] font-medium text-slate-600 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Transition</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('animation')}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Library ({DEVICE_TRANSITION_PRESETS.length}) →
                    </button>
                  </div>
                </div>

                {/* Copy & Paste Transition Setup Buttons */}
                {renderTransitionClipboardControls('quick-transition')}

                {/* Transition Preset Dropdown with Grid-Based Gallery View & Visual Previews */}
                {renderTransitionPresetDropdownCard('quick-transition')}

                {/* Easing Function Selector & Interactive Visual Curve Graph for Applied Transition Presets */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg
                        viewBox="0 0 24 20"
                        className="w-4 h-3.5 text-blue-600 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d={activeEasingMeta.svgPath} />
                      </svg>
                      <label
                        htmlFor="quick-transition-easing-select"
                        className="text-[11px] font-medium text-slate-700 truncate"
                      >
                        Easing Function
                      </label>
                    </div>
                    <select
                      id="quick-transition-easing-select"
                      aria-label="Transition Easing Function"
                      value={activeEasingValue}
                      onChange={(e) =>
                        handleSelectTransitionEasing(
                          e.target.value as EasingType
                        )
                      }
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {EASING_FUNCTION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Interactive Visual Easing Curve Graph & Custom Path Editor */}
                  <InteractiveEasingCurveGraph
                    idPrefix="quick-transition"
                    easing={activeEasingValue}
                    customBezier={activeCustomBezier}
                    durationMs={activeDurationMs}
                    onSelectEasing={handleSelectTransitionEasing}
                    onChangeCustomBezier={handleChangeCustomBezier}
                  />
                </div>

                {/* Duration Slider (100ms to 2000ms) for Applied Transition Presets */}
                <div className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label
                      htmlFor="quick-transition-duration-slider"
                      className="font-medium text-slate-700"
                    >
                      Duration
                    </label>
                    <span className="font-mono text-slate-700">
                      {activeDurationMs}ms ({activeDurationFrames}f)
                    </span>
                  </div>
                  <input
                    id="quick-transition-duration-slider"
                    aria-label="Transition Duration (ms)"
                    type="range"
                    min={100}
                    max={2000}
                    step={50}
                    value={activeDurationMs}
                    onChange={(e) =>
                      handleChangeTransitionDurationMs(Number(e.target.value))
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>100ms</span>
                    <span>1000ms</span>
                    <span>2000ms</span>
                  </div>
                </div>

                {/* Start Delay Input Field & Timeline Offset Controls */}
                {renderTransitionStartDelayControls('quick-transition')}

                {/* Starting & Ending Opacity Range Sliders for Transition Effects */}
                {renderTransitionOpacityControls('quick-transition')}

                {/* Motion Blur Checkbox & Intensity Slider for Transition Effects */}
                {renderTransitionMotionBlurControls('quick-transition')}

                {/* Loop Transition Checkbox for Indefinite Transition Repetition */}
                {renderTransitionLoopControl('quick-transition')}

                {/* Categorical Transition Preset Groups (Entrances, Exits, Emphasis) */}
                <div
                  data-testid="quick-transition-categorical-groups"
                  className="space-y-2"
                >
                  {selectedTransitionGroup !== 'All' && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-slate-500">
                        Filtered by group:{' '}
                        <strong className="text-slate-700">
                          {selectedTransitionGroup}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTransitionGroup('All')}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Show All Groups
                      </button>
                    </div>
                  )}

                  {/* Favorites Group at the Top of the List */}
                  <div
                    role="group"
                    aria-label="Favorites"
                    data-testid="quick-transition-group-favorites"
                    className={`border rounded-md p-2 space-y-1.5 transition-colors ${
                      favoritePresets.length > 0
                        ? 'bg-amber-50/60 border-amber-200/90'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleTransitionGroup('Favorites')}
                      aria-expanded={
                        selectedTransitionGroup === 'All' ||
                        selectedTransitionGroup === 'Favorites'
                      }
                      data-testid="quick-transition-group-header-favorites"
                      className="w-full flex items-center justify-between gap-1.5 text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        <h4 className="text-[11px] font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                          Favorites
                        </h4>
                        <span className="text-[9px] text-slate-400 truncate">
                          · Saved animations
                        </span>
                      </div>
                      <span
                        data-testid="quick-transition-favorites-count"
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 border ${
                          selectedTransitionGroup === 'Favorites'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : favoritePresets.length > 0
                              ? 'bg-amber-100/80 text-amber-800 border-amber-300 font-semibold'
                              : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {favoritePresets.length}
                      </span>
                    </button>

                    {(selectedTransitionGroup === 'All' ||
                      selectedTransitionGroup === 'Favorites') &&
                      (favoritePresets.length > 0 ? (
                        <div
                          data-testid="quick-transition-favorites-list"
                          className="grid grid-cols-2 gap-1.5 pt-0.5"
                        >
                          {favoritePresets.map((tp) => {
                            const isSelected = activePresetId === tp.id;
                            return (
                              <div
                                key={`fav-card-${tp.id}`}
                                data-testid={`quick-transition-favorite-item-${tp.id}`}
                                onMouseEnter={() => setHoveredPresetId(tp.id)}
                                onMouseLeave={() => setHoveredPresetId(null)}
                                className={`p-1.5 rounded-md border transition-all flex flex-col gap-1 ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-400 text-blue-900'
                                    : 'bg-white hover:bg-amber-50/40 border-amber-200/80 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onFocus={() => setHoveredPresetId(tp.id)}
                                    onBlur={() => setHoveredPresetId(null)}
                                    onClick={() => handleApplyTransition(tp)}
                                    title={tp.description}
                                    className="flex items-center gap-1 text-left cursor-pointer min-w-0 flex-1"
                                  >
                                    {renderDirectionBadgeIcon(
                                      tp.directionHint,
                                      isSelected
                                    )}
                                    <span className="text-[9px] font-mono text-slate-400">
                                      {tp.defaultDurationFrames}f
                                    </span>
                                  </button>
                                  {renderFavoriteStarButton(
                                    tp,
                                    'quick-transition-favorites'
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleApplyTransition(tp)}
                                  title={tp.description}
                                  className="text-[11px] font-semibold truncate text-left cursor-pointer"
                                >
                                  {tp.shortLabel}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          data-testid="quick-transition-favorites-empty"
                          className="text-[10px] text-slate-400 py-1 px-2 bg-white/70 rounded border border-dashed border-slate-200"
                        >
                          Click the ★ Star icon next to any preset below to save
                          it to Favorites.
                        </div>
                      ))}
                  </div>

                  {TRANSITION_PRESET_GROUPS.map((grp) => {
                    const groupPresets = quickTransitionPresets.filter(
                      (tp) => tp.group === grp.id
                    );
                    const isGroupExpanded =
                      selectedTransitionGroup === 'All' ||
                      selectedTransitionGroup === grp.id;
                    const isGroupFocused = selectedTransitionGroup === grp.id;

                    return (
                      <div
                        key={grp.id}
                        role="group"
                        aria-label={grp.label}
                        data-testid={`quick-transition-group-${grp.id.toLowerCase()}`}
                        className="bg-slate-50/70 border border-slate-200 rounded-md p-2 space-y-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTransitionGroup(grp.id)}
                          aria-expanded={isGroupExpanded}
                          data-testid={`quick-transition-group-header-${grp.id.toLowerCase()}`}
                          className="w-full flex items-center justify-between gap-1.5 text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                grp.id === 'Entrances'
                                  ? 'bg-emerald-500'
                                  : grp.id === 'Exits'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500'
                              }`}
                            />
                            <h4 className="text-[11px] font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                              {grp.label}
                            </h4>
                            <span className="text-[9px] text-slate-400 truncate">
                              · {grp.description}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 border ${
                              isGroupFocused
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            {groupPresets.length}
                          </span>
                        </button>

                        {isGroupExpanded && (
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            {groupPresets.map((tp) => {
                              const isSelected = activePresetId === tp.id;
                              return (
                                <div
                                  key={tp.id}
                                  data-testid={`quick-transition-preset-card-${tp.id}`}
                                  onMouseEnter={() => {
                                    setHoveredPresetId(tp.id);
                                  }}
                                  onMouseLeave={() => setHoveredPresetId(null)}
                                  className={`p-1.5 rounded-md border transition-all flex flex-col gap-1 ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-400 text-blue-900'
                                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <button
                                      type="button"
                                      onFocus={() => {
                                        setHoveredPresetId(tp.id);
                                      }}
                                      onBlur={() => setHoveredPresetId(null)}
                                      onClick={() => handleApplyTransition(tp)}
                                      title={tp.description}
                                      className="flex items-center gap-1 text-left cursor-pointer min-w-0 flex-1"
                                    >
                                      {renderDirectionBadgeIcon(
                                        tp.directionHint,
                                        isSelected
                                      )}
                                      <span className="text-[9px] font-mono text-slate-400">
                                        {tp.defaultDurationFrames}f
                                      </span>
                                    </button>
                                    {renderFavoriteStarButton(
                                      tp,
                                      'quick-transition'
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onFocus={() => {
                                      setHoveredPresetId(tp.id);
                                    }}
                                    onBlur={() => setHoveredPresetId(null)}
                                    onClick={() => handleApplyTransition(tp)}
                                    title={tp.description}
                                    className="text-[11px] font-semibold truncate text-left cursor-pointer"
                                  >
                                    {tp.shortLabel}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'style' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Hardware Model Preset
                </label>
                <select
                  value={selectedDevice.presetId}
                  onChange={(e) => {
                    const nextPreset = getDevicePresetById(e.target.value);
                    updateDevice(selectedDevice.id, {
                      presetId: nextPreset.id,
                      width: nextPreset.width,
                      height: nextPreset.height,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {DEVICE_CATALOG.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Surface Finish Style
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      'matte',
                      'polished',
                      'metallic-gradient',
                      'brushed',
                      'glass',
                    ] as DeviceFinishStyle[]
                  ).map((fin) => (
                    <button
                      key={fin}
                      onClick={() =>
                        updateDevice(selectedDevice.id, { finishStyle: fin })
                      }
                      className={`py-1.5 rounded text-[11px] font-medium capitalize border ${
                        (selectedDevice.finishStyle || 'brushed') === fin
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {fin}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                  <span>Chassis</span>
                  <input
                    type="color"
                    value={
                      selectedDevice.customFrameColor || preset.frameColor
                    }
                    onChange={(e) =>
                      updateDevice(selectedDevice.id, {
                        customFrameColor: e.target.value,
                      })
                    }
                    className="w-5 h-5 rounded border-0"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                  <span>Rim Accent</span>
                  <input
                    type="color"
                    value={
                      selectedDevice.customFrameSecondaryColor ||
                      preset.frameAccentColor
                    }
                    onChange={(e) =>
                      updateDevice(selectedDevice.id, {
                        customFrameSecondaryColor: e.target.value,
                      })
                    }
                    className="w-5 h-5 rounded border-0"
                  />
                </label>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Outer Corner Radius</span>
                  <span className="font-mono">
                    {selectedDevice.customOuterRadius ?? preset.outerRadius}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedDevice.customOuterRadius ?? preset.outerRadius}
                  onChange={(e) =>
                    updateDevice(selectedDevice.id, {
                      customOuterRadius: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>
            </>
          )}

          {activeTab === 'media' && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Screen Content Source
                </label>
                <select
                  value={selectedDevice.mediaId || ''}
                  onChange={(e) =>
                    assignMediaToDevice(
                      selectedDevice.id,
                      e.target.value || null
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {mediaAssets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Screen Fit Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['cover', 'contain', 'stretch'] as ScreenFitMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        onClick={() =>
                          updateDeviceScreenTransform(selectedDevice.id, {
                            fitMode: m,
                          })
                        }
                        className={`py-1.5 rounded text-xs font-medium capitalize border ${
                          selectedDevice.screenTransform.fitMode === m
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Screen Content Zoom</span>
                  <span className="font-mono">
                    {Math.round(selectedDevice.screenTransform.zoom * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={selectedDevice.screenTransform.zoom}
                  onChange={(e) =>
                    updateDeviceScreenTransform(selectedDevice.id, {
                      zoom: Number(e.target.value),
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>
            </>
          )}

          {activeTab === 'effects' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Perimeter Neon Glow
                </span>
                <input
                  type="checkbox"
                  checked={selectedDevice.effects.glowEnabled}
                  onChange={(e) =>
                    updateDeviceEffects(selectedDevice.id, {
                      glowEnabled: e.target.checked,
                    })
                  }
                  className="accent-blue-600"
                />
              </div>

              {selectedDevice.effects.glowEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      <span>Primary</span>
                      <input
                        type="color"
                        value={selectedDevice.effects.glowColor}
                        onChange={(e) =>
                          updateDeviceEffects(selectedDevice.id, {
                            glowColor: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </label>
                    <label className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      <span>Secondary</span>
                      <input
                        type="color"
                        value={
                          selectedDevice.effects.glowSecondaryColor ||
                          selectedDevice.effects.glowColor
                        }
                        onChange={(e) =>
                          updateDeviceEffects(selectedDevice.id, {
                            glowSecondaryColor: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded border-0"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Glow Blur</span>
                      <span className="font-mono">
                        {Math.round(selectedDevice.effects.glowBlur)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={120}
                      value={selectedDevice.effects.glowBlur}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          glowBlur: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Glow Intensity</span>
                      <span className="font-mono">
                        {Math.round(selectedDevice.effects.glowIntensity * 100)}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={selectedDevice.effects.glowIntensity}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          glowIntensity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Glow Animation Mode
                    </label>
                    <select
                      value={
                        selectedDevice.effects.glowAnimationMode || 'none'
                      }
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          animatedGlow: e.target.value !== 'none',
                          glowAnimationMode:
                            e.target.value as GlowAnimationMode,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="none">Static Ambient Glow</option>
                      <option value="pulse">Breathing Pulse</option>
                      <option value="perimeter-sweep">
                        Perimeter Neon Sweep
                      </option>
                      <option value="rotating-gradient">
                        Rotating Gradient
                      </option>
                      <option value="rainbow-cycle">Rainbow Cycle</option>
                    </select>
                  </div>
                </>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Contact Drop Shadow
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedDevice.effects.shadowEnabled}
                    onChange={(e) =>
                      updateDeviceEffects(selectedDevice.id, {
                        shadowEnabled: e.target.checked,
                      })
                    }
                    className="accent-blue-600"
                  />
                </div>
                {selectedDevice.effects.shadowEnabled && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Shadow Blur</span>
                      <span className="font-mono">
                        {selectedDevice.effects.shadowBlur}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedDevice.effects.shadowBlur}
                      onChange={(e) =>
                        updateDeviceEffects(selectedDevice.id, {
                          shadowBlur: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'animation' && (
            <>
              {/* Transition Library Header & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">
                    Transition Preset Library
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleResetTransition}
                      title="Clear applied transition effects and reset easing to linear"
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Transition</span>
                    </button>
                  </div>
                </div>

                {/* Copy & Paste Transition Setup Buttons in Transitions Tab */}
                {renderTransitionClipboardControls('inspector-transition')}

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={transitionSearch}
                    onChange={(e) => setTransitionSearch(e.target.value)}
                    placeholder="Search Slide In, Fade, Zoom..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white"
                  />
                </div>

                {/* Category Filter Tabs */}
                <div className="grid grid-cols-6 gap-1 bg-slate-100/80 p-1 rounded-md border border-slate-200">
                  {TRANSITION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setTransitionCategory(cat.id)}
                      className={`py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                        transitionCategory === cat.id
                          ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition Timing, Duration & Curve Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Transition Timing & Curve
                  </span>
                  <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlayOnApply}
                      onChange={(e) => setAutoPlayOnApply(e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                    <span>Auto-Preview</span>
                  </label>
                </div>

                {/* Placement Mode */}
                <div>
                  <div className="text-[10px] font-medium text-slate-500 mb-1">
                    Start Position
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'from-start', label: 'Start (F000)' },
                        {
                          id: 'at-playhead',
                          label: `Playhead (F${String(currentFrame).padStart(2, '0')})`,
                        },
                        { id: 'full-timeline', label: 'Full Clip' },
                      ] as { id: TransitionTimingMode; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setTransitionTimingMode(m.id)}
                        className={`py-1 px-1.5 rounded text-[10px] font-medium border truncate cursor-pointer ${
                          transitionTimingMode === m.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration & Easing Function */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="inspector-transition-easing-select"
                        className="text-[10px] font-semibold text-slate-600 flex items-center gap-1.5"
                      >
                        <svg
                          viewBox="0 0 24 20"
                          className="w-3.5 h-3 text-blue-600 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d={activeEasingMeta.svgPath} />
                        </svg>
                        <span>Easing Function</span>
                      </label>
                      <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {activeEasingMeta.description}
                      </span>
                    </div>
                    <select
                      id="inspector-transition-easing-select"
                      aria-label="Transition Easing Function"
                      value={activeEasingValue}
                      onChange={(e) =>
                        handleSelectTransitionEasing(
                          e.target.value as EasingType
                        )
                      }
                      className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {EASING_FUNCTION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} — {opt.description}
                        </option>
                      ))}
                    </select>

                    {/* Dynamic Interactive Visual Easing Curve Graph & Custom Path Editor in Transitions Tab */}
                    <div className="mt-2">
                      <InteractiveEasingCurveGraph
                        idPrefix="inspector-transition"
                        easing={activeEasingValue}
                        customBezier={activeCustomBezier}
                        durationMs={activeDurationMs}
                        onSelectEasing={handleSelectTransitionEasing}
                        onChangeCustomBezier={handleChangeCustomBezier}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] text-slate-600">
                      <label
                        htmlFor="inspector-transition-duration-slider"
                        className="font-semibold text-slate-600"
                      >
                        Duration
                      </label>
                      <span className="font-mono text-slate-700 font-medium">
                        {activeDurationMs}ms ({activeDurationFrames}f ·{' '}
                        {(activeDurationMs / 1000).toFixed(2)}s)
                      </span>
                    </div>
                    <input
                      id="inspector-transition-duration-slider"
                      aria-label="Duration"
                      type="range"
                      min={100}
                      max={2000}
                      step={50}
                      value={activeDurationMs}
                      onChange={(e) =>
                        handleChangeTransitionDurationMs(Number(e.target.value))
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="grid grid-cols-5 gap-1">
                      {[100, 500, 1000, 1500, 2000].map((ms) => (
                        <button
                          key={ms}
                          onClick={() => handleChangeTransitionDurationMs(ms)}
                          className={`py-1 rounded text-[10px] font-mono border cursor-pointer ${
                            activeDurationMs === ms
                              ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {ms}ms
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Delay Input Field & Timeline Offset Controls in Transitions Tab */}
                  {renderTransitionStartDelayControls('inspector-transition')}

                  {/* Starting & Ending Opacity Range Sliders in Transitions Tab */}
                  {renderTransitionOpacityControls('inspector-transition')}

                  {/* Motion Blur Checkbox & Intensity Slider in Transitions Tab */}
                  {renderTransitionMotionBlurControls('inspector-transition')}

                  {/* Loop Transition Checkbox in Transitions Tab */}
                  {renderTransitionLoopControl('inspector-transition')}
                </div>

                {multiSelectedCount > 1 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                    <span className="text-[10px] font-medium text-slate-600">
                      Multi-Device Stagger Delay
                    </span>
                    <div className="flex items-center gap-1">
                      {[0, 4, 8, 12].map((st) => (
                        <button
                          key={st}
                          onClick={() => setTransitionStaggerFrames(st)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                            transitionStaggerFrames === st
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          +{st}f
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Transition Preset Dropdown with Grid-Based Gallery View & Visual Previews in Transitions Tab */}
              {renderTransitionPresetDropdownCard('inspector-transition')}

              {/* Categorical Preset Library Groups (Favorites at Top, then Entrances, Exits, Emphasis) */}
              <div
                data-testid="transition-library-categorical-groups"
                className="space-y-2.5 max-h-96 overflow-y-auto pr-0.5"
              >
                {selectedTransitionGroup !== 'All' && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-slate-500">
                      Showing group:{' '}
                      <strong className="text-slate-700">
                        {selectedTransitionGroup}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTransitionGroup('All')}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Show All Groups
                    </button>
                  </div>
                )}

                {/* Favorites Group at the Top of the Transition Preset Library */}
                <div
                  role="group"
                  aria-label="Favorites"
                  data-testid="transition-library-group-favorites"
                  className={`border rounded-lg p-2 space-y-1.5 transition-colors ${
                    favoriteFilteredPresets.length > 0
                      ? 'bg-amber-50/60 border-amber-200/90'
                      : 'bg-slate-50/75 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTransitionGroup('Favorites')}
                    aria-expanded={
                      selectedTransitionGroup === 'All' ||
                      selectedTransitionGroup === 'Favorites'
                    }
                    data-testid="transition-library-group-header-favorites"
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group px-0.5"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                      <h4 className="text-xs font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                        Favorites
                      </h4>
                      <span className="text-[10px] text-slate-400 truncate">
                        Frequently used animations
                      </span>
                    </div>
                    <span
                      data-testid="transition-library-favorites-count"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border ${
                        selectedTransitionGroup === 'Favorites'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : favoriteFilteredPresets.length > 0
                            ? 'bg-amber-100/80 text-amber-800 border-amber-300 font-semibold'
                            : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {favoriteFilteredPresets.length}
                    </span>
                  </button>

                  {(selectedTransitionGroup === 'All' ||
                    selectedTransitionGroup === 'Favorites') &&
                    (favoriteFilteredPresets.length > 0 ? (
                      <div
                        data-testid="transition-library-favorites-list"
                        className="space-y-1.5 pt-0.5"
                      >
                        {favoriteFilteredPresets.map((tp) => {
                          const isSelected = activePresetId === tp.id;
                          return (
                            <div
                              key={`lib-fav-${tp.id}`}
                              data-testid={`transition-library-favorite-item-${tp.id}`}
                              onMouseEnter={() => setHoveredPresetId(tp.id)}
                              onMouseLeave={() => setHoveredPresetId(null)}
                              className={`w-full p-2 rounded-lg border transition-all flex items-start gap-2 ${
                                isSelected
                                  ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-2xs'
                                  : 'bg-white hover:bg-amber-50/40 border-amber-200/80 text-slate-800'
                              }`}
                            >
                              <button
                                type="button"
                                onFocus={() => setHoveredPresetId(tp.id)}
                                onBlur={() => setHoveredPresetId(null)}
                                onClick={() => handleApplyTransition(tp)}
                                className="flex-1 min-w-0 text-left cursor-pointer flex items-start gap-2.5"
                              >
                                <div
                                  className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? 'bg-white border-blue-300 shadow-2xs'
                                      : 'bg-amber-50/60 border-amber-200'
                                  }`}
                                >
                                  {renderDirectionBadgeIcon(
                                    tp.directionHint,
                                    isSelected
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="text-xs font-semibold truncate">
                                      {tp.name}
                                    </span>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 bg-amber-50 text-amber-800 border-amber-200">
                                      {tp.category} · {tp.badge}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                                    {tp.description}
                                  </div>
                                </div>
                              </button>
                              {renderFavoriteStarButton(
                                tp,
                                'transition-library-favorites'
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        data-testid="transition-library-favorites-empty"
                        className="text-[10px] text-slate-400 py-1.5 px-2 bg-white/80 rounded border border-dashed border-slate-200"
                      >
                        Click the ★ Star button next to any preset below to save
                        it to Favorites.
                      </div>
                    ))}
                </div>

                {TRANSITION_PRESET_GROUPS.map((grp) => {
                  const groupPresets = filteredTransitionPresets.filter(
                    (tp) => tp.group === grp.id
                  );
                  const isGroupExpanded =
                    selectedTransitionGroup === 'All' ||
                    selectedTransitionGroup === grp.id;
                  const isGroupFocused = selectedTransitionGroup === grp.id;

                  return (
                    <div
                      key={grp.id}
                      role="group"
                      aria-label={grp.label}
                      data-testid={`transition-library-group-${grp.id.toLowerCase()}`}
                      className="bg-slate-50/75 border border-slate-200 rounded-lg p-2 space-y-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTransitionGroup(grp.id)}
                        aria-expanded={isGroupExpanded}
                        data-testid={`transition-library-group-header-${grp.id.toLowerCase()}`}
                        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group px-0.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              grp.id === 'Entrances'
                                ? 'bg-emerald-500'
                                : grp.id === 'Exits'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                            }`}
                          />
                          <h4 className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {grp.label}
                          </h4>
                          <span className="text-[10px] text-slate-400 truncate">
                            {grp.description}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border ${
                            isGroupFocused
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {groupPresets.length}
                        </span>
                      </button>

                      {isGroupExpanded && groupPresets.length > 0 && (
                        <div className="space-y-1.5 pt-0.5">
                          {groupPresets.map((tp) => {
                            const isSelected = activePresetId === tp.id;
                            return (
                              <div
                                key={tp.id}
                                data-testid={`transition-library-preset-card-${tp.id}`}
                                onMouseEnter={() => {
                                  setHoveredPresetId(tp.id);
                                }}
                                onMouseLeave={() => setHoveredPresetId(null)}
                                className={`w-full p-2 rounded-lg border transition-all flex items-start gap-2 ${
                                  isSelected
                                    ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-2xs'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              >
                                <button
                                  type="button"
                                  onFocus={() => {
                                    setHoveredPresetId(tp.id);
                                  }}
                                  onBlur={() => setHoveredPresetId(null)}
                                  onClick={() => handleApplyTransition(tp)}
                                  className="flex-1 min-w-0 text-left cursor-pointer flex items-start gap-2.5"
                                >
                                  <div
                                    className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                      isSelected
                                        ? 'bg-white border-blue-300 shadow-2xs'
                                        : 'bg-slate-50 border-slate-200'
                                    }`}
                                  >
                                    {renderDirectionBadgeIcon(
                                      tp.directionHint,
                                      isSelected
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-xs font-semibold truncate">
                                        {tp.name}
                                      </span>
                                      <span
                                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                                          tp.category === 'Slide'
                                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                                            : tp.category === 'Fade'
                                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                                              : tp.category === 'Zoom'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : tp.category === '3D'
                                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        {tp.category} · {tp.badge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                                      {tp.description}
                                    </div>
                                  </div>
                                </button>
                                {renderFavoriteStarButton(
                                  tp,
                                  'transition-library'
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredTransitionPresets.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No transition presets match "{transitionSearch}"
                  </div>
                )}
              </div>

              {/* Clip Entrance & Exit Modifiers */}
              <div className="border-t border-slate-200 pt-3 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">
                  Non-Destructive Clip Entrance & Exit
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 block mb-1">
                      Entrance Transition
                    </label>
                    <select
                      value={selectedDevice.effects.entranceAnimation || 'none'}
                      onChange={(e) => {
                        const val = e.target
                          .value as ObjectEffects['entranceAnimation'];
                        const targets =
                          selectedIds.length > 0
                            ? selectedIds
                            : [selectedDevice.id];
                        targets.forEach((id) =>
                          updateDeviceEffects(id, { entranceAnimation: val })
                        );
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-900"
                    >
                      <option value="none">None</option>
                      <option value="slide-left">Slide In (From Right)</option>
                      <option value="slide-right">Slide In (From Left)</option>
                      <option value="slide-up">Slide In Up</option>
                      <option value="slide-down">Slide In Down</option>
                      <option value="fade-in">Fade In</option>
                      <option value="fade-up">Fade & Rise</option>
                      <option value="zoom-in">Zoom In</option>
                      <option value="zoom-out">Zoom Out Settle</option>
                      <option value="scale-pop">Scale Pop</option>
                      <option value="rotate-3d">3D Flip Reveal</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-slate-600 block mb-1">
                      Exit Transition
                    </label>
                    <select
                      value={selectedDevice.effects.exitAnimation || 'none'}
                      onChange={(e) => {
                        const val = e.target
                          .value as ObjectEffects['exitAnimation'];
                        const targets =
                          selectedIds.length > 0
                            ? selectedIds
                            : [selectedDevice.id];
                        targets.forEach((id) =>
                          updateDeviceEffects(id, { exitAnimation: val })
                        );
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-900"
                    >
                      <option value="none">None</option>
                      <option value="fade-out">Fade Out</option>
                      <option value="scale-down">Zoom Down</option>
                      <option value="zoom-out">Zoom Portal Out</option>
                      <option value="slide-right">Slide Out Right</option>
                      <option value="slide-left">Slide Out Left</option>
                      <option value="slide-down">Slide Out Down</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <button
                  onClick={handleResetTransition}
                  className={`w-full py-2 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    hasAppliedTransition
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    Reset Transition
                    {multiSelectedCount > 1 ? ` (${multiSelectedCount})` : ''}
                  </span>
                </button>
                <div className="text-[10px] text-slate-400 text-center">
                  Clears applied transition presets, entrance/exit effects, and
                  resets easing to Linear.
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }

  // ============================================================================
  // 5. SCENE & BACKGROUND INSPECTOR (Fallback when no object is selected)
  // ============================================================================
  return (
    <aside
      aria-label="Scene Properties Inspector"
      className="w-80 bg-white border-l border-slate-200 flex flex-col h-full select-none shrink-0 z-20"
    >
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="text-xs font-semibold text-slate-900">
          Scene & Stage Properties
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {canvasWidth}×{canvasHeight}px · {fps} FPS
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="text-xs font-semibold text-slate-800">
            Scene Summary
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-white border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                {devices.length}
              </div>
              <div className="text-[10px] text-slate-500">Devices</div>
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                {webcams.length}
              </div>
              <div className="text-[10px] text-slate-500">Webcams</div>
            </div>
            <div className="p-2 rounded bg-white border border-slate-200">
              <div className="text-sm font-bold text-slate-900">
                {drawings.length}
              </div>
              <div className="text-[10px] text-slate-500">Drawings</div>
            </div>
          </div>
        </div>

        {/* Quick Background Layers Link */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Background Stack
            </span>
            <button
              onClick={() => setLeftTab('backgrounds')}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Manage Layers →
            </button>
          </div>
          <div className="text-[11px] text-slate-600">
            {(background.layers || []).filter((l) => l.visible).length} active
            background layers
          </div>
        </div>

        {/* 3D Studio Lighting Quick Controls */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-xs font-semibold text-slate-800">
            3D Studio Lighting & Camera
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-600 mb-1">
              <span>Key Light Intensity</span>
              <span className="font-mono">
                {studio3D.keyLightIntensity.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0.2}
              max={4}
              step={0.1}
              value={studio3D.keyLightIntensity}
              onChange={(e) =>
                updateStudio3D({ keyLightIntensity: Number(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-600 mb-1">
              <span>Rim Light Intensity</span>
              <span className="font-mono">
                {studio3D.rimLightIntensity.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={0.1}
              value={studio3D.rimLightIntensity}
              onChange={(e) =>
                updateStudio3D({ rimLightIntensity: Number(e.target.value) })
              }
              className="w-full accent-blue-600"
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
