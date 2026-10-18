import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OBJECT_EFFECTS,
  DEFAULT_SCREEN_TRANSFORM,
} from '../device-catalog/catalog.ts';
import type {
  Keyframe,
  SceneDeviceObject,
  SceneDrawingObject,
  TimelineClip,
} from '../shared/types.ts';
import {
  applyClipTrimWithRipple,
  canSplitAtPlayhead,
  computeAdaptiveRulerTicks,
  computeClipFilmstripThumbs,
  computeDeviceMotionTrail,
  computeDrawingPathLength,
  computeFitTimelineZoom,
  computeScreenMediaRect,
  computeSnapPosition,
  computeTimelineMetrics,
  computeTrimmedClip,
  computeTrimmedDrawingClip,
  evaluateAnimatedGlowState,
  evaluateEasing,
  formatShortTimecode,
  formatTimecode,
  frameToPixel,
  generateKeyframesForPreset,
  hexToHsl,
  hexToRgb,
  hslToHex,
  interpolateHexColor,
  interpolateTrackAtFrame,
  pixelToFrame,
  resizeDrawingGeometry,
  resolveActiveClipForMediaAtFrame,
  resolveDeviceAtFrame,
  resolveDrawingAtFrame,
  resolveExportDimensions,
  rgbToHex,
  snapTimelineFrame,
  splitDrawingClipAtFrame,
  splitTimelineClipAtFrame,
  updateDrawingControlPoint,
  updateDrawingLineEndpoints,
} from './math.ts';

test('evaluateEasing returns exact boundary values and expected curves', () => {
  assert.equal(evaluateEasing(0, 'linear'), 0);
  assert.equal(evaluateEasing(1, 'linear'), 1);
  assert.equal(evaluateEasing(0.5, 'linear'), 0.5);
  assert.equal(evaluateEasing(0.5, 'ease-in-out'), 0.5);
  assert.ok(evaluateEasing(0.25, 'ease-in') < 0.25);
  assert.ok(evaluateEasing(0.75, 'ease-out') > 0.75);
});

test('HEX, RGB, and HSL conversions round-trip accurately', () => {
  const rgb = hexToRgb('#38BDF8');
  assert.deepEqual(rgb, { r: 56, g: 189, b: 248 });
  assert.equal(rgbToHex(rgb.r, rgb.g, rgb.b), '#38BDF8');

  const hsl = hexToHsl('#FF0000');
  assert.deepEqual(hsl, { h: 0, s: 100, l: 50 });
  assert.equal(hslToHex(0, 100, 50), '#FF0000');

  const mid = interpolateHexColor('#000000', '#FFFFFF', 0.5);
  assert.equal(mid, '#808080');
});

test('interpolateTrackAtFrame interpolates across 10+ multi-keyframes', () => {
  const keyframes: Keyframe[] = Array.from({ length: 11 }, (_, idx) => ({
    id: `kf-${idx}`,
    frame: idx * 10,
    easing: 'linear',
    properties: {
      x: idx * 100,
      glowIntensity: Number((idx * 0.1).toFixed(2)),
    },
  }));

  const at0 = interpolateTrackAtFrame(keyframes, 0);
  assert.equal(at0.x, 0);

  const at25 = interpolateTrackAtFrame(keyframes, 25);
  assert.equal(at25.x, 250);

  const at85 = interpolateTrackAtFrame(keyframes, 85);
  assert.equal(at85.x, 850);
});

test('multi-keyframe scale and glow animation (0->70%, 45->100%, 90->125%, 135->100%) interpolates accurately', () => {
  const device: SceneDeviceObject = {
    id: 'dev-zoom',
    name: 'Zoom Phone',
    presetId: 'iphone-16-pro',
    x: 960,
    y: 540,
    width: 350,
    height: 720,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotation3DX: 0,
    rotation3DY: 0,
    rotation3DZ: 0,
    pos3DX: 0,
    pos3DY: 0,
    pos3DZ: 0,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    zIndex: 1,
    mediaId: null,
    screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
    effects: { ...DEFAULT_OBJECT_EFFECTS },
  };

  const kfs: Keyframe[] = [
    {
      id: 'k0',
      frame: 0,
      easing: 'linear',
      properties: { scaleX: 0.7, scaleY: 0.7, glowBlur: 20, glowIntensity: 0.4 },
    },
    {
      id: 'k45',
      frame: 45,
      easing: 'linear',
      properties: { scaleX: 1.0, scaleY: 1.0, glowBlur: 50, glowIntensity: 0.8 },
    },
    {
      id: 'k90',
      frame: 90,
      easing: 'linear',
      properties: {
        scaleX: 1.25,
        scaleY: 1.25,
        glowBlur: 80,
        glowIntensity: 1.2,
      },
    },
    {
      id: 'k135',
      frame: 135,
      easing: 'linear',
      properties: { scaleX: 1.0, scaleY: 1.0, glowBlur: 50, glowIntensity: 0.8 },
    },
  ];

  assert.equal(resolveDeviceAtFrame(device, kfs, 0, 180).scaleX, 0.7);
  assert.equal(resolveDeviceAtFrame(device, kfs, 45, 180).scaleX, 1.0);
  assert.equal(resolveDeviceAtFrame(device, kfs, 90, 180).scaleX, 1.25);
  assert.equal(resolveDeviceAtFrame(device, kfs, 135, 180).scaleX, 1.0);

  const midZoomIn = resolveDeviceAtFrame(device, kfs, 67.5, 180);
  assert.ok(midZoomIn.scaleX > 1.1 && midZoomIn.scaleX < 1.15);
  assert.equal(midZoomIn.effects.glowBlur, 65);
});

test('computeTrimmedClip, splitTimelineClipAtFrame, and resolveActiveClipForMediaAtFrame work non-destructively', () => {
  const baseClip: TimelineClip = {
    id: 'clip-1',
    mediaId: 'proc-daw-desktop',
    name: 'Chronos NLE Feed',
    mediaType: 'procedural',
    trackId: 'media-track-1',
    startFrame: 0,
    durationFrames: 180,
    trimStartFrames: 0,
    sourceOutFrame: 180,
    sourceDurationFrames: 300,
    playbackSpeed: 1,
    muted: false,
    locked: false,
    visible: true,
    waveformPeaks: [0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.7],
  };

  // 1. Trim start by +30 frames -> startFrame=30, durationFrames=150, trimStartFrames=30
  const trimmedLeft = computeTrimmedClip(baseClip, 'left', 30, 300);
  assert.equal(trimmedLeft.startFrame, 30);
  assert.equal(trimmedLeft.durationFrames, 150);
  assert.equal(trimmedLeft.trimStartFrames, 30);
  assert.equal(trimmedLeft.sourceOutFrame, 180);

  // 2. Trim end by -40 frames -> startFrame=30, durationFrames=110, sourceOutFrame=140
  const trimmedRight = computeTrimmedClip(trimmedLeft, 'right', -40, 300);
  assert.equal(trimmedRight.startFrame, 30);
  assert.equal(trimmedRight.durationFrames, 110);
  assert.equal(trimmedRight.sourceOutFrame, 140);

  // 3. Split at frame 80 -> Part 1 (30..80, in=30, out=80) & Part 2 (80..140, in=80, out=140)
  const splitRes = splitTimelineClipAtFrame(trimmedRight, 80, 'test');
  assert.equal(splitRes.ok, true);
  assert.equal(splitRes.firstClip?.startFrame, 30);
  assert.equal(splitRes.firstClip?.durationFrames, 50);
  assert.equal(splitRes.firstClip?.trimStartFrames, 30);
  assert.equal(splitRes.firstClip?.sourceOutFrame, 80);

  assert.equal(splitRes.secondClip?.startFrame, 80);
  assert.equal(splitRes.secondClip?.durationFrames, 60);
  assert.equal(splitRes.secondClip?.trimStartFrames, 80);
  assert.equal(splitRes.secondClip?.sourceOutFrame, 140);

  // 4. Evaluate active clip at frame 10 (in trimmed gap before startFrame=30) -> activeClip is null
  const clips = [splitRes.firstClip!, splitRes.secondClip!];
  const at10 = resolveActiveClipForMediaAtFrame(clips, 'proc-daw-desktop', 10);
  assert.equal(at10.hasClipsForMedia, true);
  assert.equal(at10.activeClip, null);

  // 5. Evaluate active clip at frame 95 (15 frames into Part 2, which starts at source frame 80) -> sourceFrame=95
  const at95 = resolveActiveClipForMediaAtFrame(clips, 'proc-daw-desktop', 95);
  assert.equal(at95.activeClip?.id, splitRes.secondClip?.id);
  assert.equal(at95.sourceFrame, 95);
});

test('resolveDrawingAtFrame and snapTimelineFrame work accurately', () => {
  const drawing: SceneDrawingObject = {
    id: 'dr-1',
    name: 'Halo',
    tool: 'ellipse',
    points: [],
    x: 500,
    y: 400,
    width: 300,
    height: 300,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 5,
    strokeColor: '#22D3EE',
    strokeColorEnd: '#A855F7',
    useGradientStroke: true,
    strokeWidth: 4,
    strokeOpacity: 1,
    fillColor: '#22D3EE',
    fillOpacity: 0.05,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    cornerRadius: 24,
    polygonSides: 6,
    glowEnabled: true,
    glowColor: '#22D3EE',
    glowRadius: 24,
    glowIntensity: 0.8,
    glowSpread: 8,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 16,
    animationMode: 'neon-trace',
    animationDurationFrames: 90,
    animationSpeed: 1,
    animationEasing: 'ease-in-out',
  };

  const kfs: Keyframe[] = [
    { id: 'dk0', frame: 0, easing: 'linear', properties: { x: 500, glowBlur: 20 } },
    { id: 'dk60', frame: 60, easing: 'linear', properties: { x: 800, glowBlur: 50 } },
  ];

  const resolved30 = resolveDrawingAtFrame(drawing, kfs, 30);
  assert.equal(resolved30.x, 650);
  assert.equal(resolved30.glowRadius, 35);

  const snapped = snapTimelineFrame(44, [0, 45, 90], true, 2);
  assert.equal(snapped.frame, 45);
});

test('evaluateAnimatedGlowState, computeScreenMediaRect, computeSnapPosition, and resolveExportDimensions work accurately', () => {
  const effects = {
    ...DEFAULT_OBJECT_EFFECTS,
    glowEnabled: true,
    glowColor: '#22D3EE',
    glowSecondaryColor: '#A855F7',
    glowBlur: 48,
    glowSpread: 14,
    glowIntensity: 0.8,
    animatedGlow: true,
    glowAnimationMode: 'neon-sweep' as const,
    glowSpeed: 1.5,
  };

  const state0 = evaluateAnimatedGlowState(effects, 0, 30);
  const state15 = evaluateAnimatedGlowState(effects, 15, 30);
  assert.equal(state0.primaryColor, '#22D3EE');
  assert.notEqual(state0.angleRad, state15.angleRad);

  const rect = computeScreenMediaRect(300, 600, 1200, 600, {
    ...DEFAULT_SCREEN_TRANSFORM,
    fitMode: 'cover',
  });
  assert.equal(rect.dh, 600);
  assert.equal(rect.dw, 1200);

  const snap = computeSnapPosition(958, 540, 1920, 1080, [], true);
  assert.equal(snap.x, 960);

  const dims = resolveExportDimensions({
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: '16:9',
    customWidth: 1920,
    customHeight: 1080,
    fps: 30,
    quality: 0.92,
    transparentBackground: false,
    includeAudio: true,
  });
  assert.deepEqual(dims, { width: 1920, height: 1080 });
});

test('computeDeviceMotionTrail computes past/future keyframes, samples, and onion skin ghosts', () => {
  const dev: SceneDeviceObject = {
    id: 'dev-trail',
    name: 'Trail Phone',
    presetId: 'iphone-16-pro',
    x: 960,
    y: 540,
    width: 350,
    height: 720,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotation3DX: 0,
    rotation3DY: 0,
    rotation3DZ: 0,
    pos3DX: 0,
    pos3DY: 0,
    pos3DZ: 0,
    opacity: 1,
    visible: true,
    locked: false,
    groupId: null,
    zIndex: 1,
    mediaId: null,
    screenTransform: { ...DEFAULT_SCREEN_TRANSFORM },
    effects: { ...DEFAULT_OBJECT_EFFECTS },
  };
  const keyframes: Keyframe[] = [
    {
      id: 'kf-0',
      frame: 0,
      easing: 'linear',
      properties: { x: 800, y: 500, scaleX: 0.8, scaleY: 0.8, rotation: -10 },
    },
    {
      id: 'kf-60',
      frame: 60,
      easing: 'linear',
      properties: { x: 1100, y: 400, scaleX: 1.0, scaleY: 1.0, rotation: 0 },
    },
    {
      id: 'kf-120',
      frame: 120,
      easing: 'linear',
      properties: { x: 1400, y: 560, scaleX: 1.2, scaleY: 1.2, rotation: 12 },
    },
  ];

  const trailAt30 = computeDeviceMotionTrail(dev, keyframes, 30, 180, 10);
  assert.equal(trailAt30.hasTrail, true);
  assert.equal(trailAt30.currentPoint.x, 950);
  assert.equal(trailAt30.currentPoint.y, 450);
  assert.equal(trailAt30.previousKeyframe?.id, 'kf-0');
  assert.equal(trailAt30.previousKeyframe?.relation, 'past');
  assert.equal(trailAt30.nextKeyframe?.id, 'kf-60');
  assert.equal(trailAt30.nextKeyframe?.relation, 'future');
  assert.ok(trailAt30.samples.length >= 13);
  assert.ok(trailAt30.ghosts.some((g) => g.frame === 0 && g.relation === 'past' && g.isImmediate));
  assert.ok(trailAt30.ghosts.some((g) => g.frame === 60 && g.relation === 'future' && g.isImmediate));
  assert.ok(trailAt30.ghosts.some((g) => g.frame === 15 && !g.isKeyframe));
  assert.ok(trailAt30.ghosts.some((g) => g.frame === 45 && !g.isKeyframe));
});

test('formatTimecode and formatShortTimecode format HH:MM:SS:FF accurately at 30 FPS', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00:00');
  assert.equal(formatTimecode(15, 30), '00:00:00:15');
  assert.equal(formatTimecode(30, 30), '00:00:01:00');
  assert.equal(formatTimecode(90, 30), '00:00:03:00');
  assert.equal(formatTimecode(1800, 30), '00:01:00:00');
  assert.equal(formatShortTimecode(45, 30), '00:01:15');
});

test('computeAdaptiveRulerTicks produces major and minor ticks adapting to zoom level', () => {
  const ticks1x = computeAdaptiveRulerTicks(180, 30, 1);
  const ticks4x = computeAdaptiveRulerTicks(180, 30, 4);
  assert.ok(ticks1x.length > 5);
  assert.ok(ticks4x.length > ticks1x.length);
  assert.equal(ticks1x[0].frame, 0);
  assert.equal(ticks1x[0].isMajor, true);
  assert.equal(ticks1x[ticks1x.length - 1].frame, 180);
});

test('resizeDrawingGeometry scales points proportionally and respects lockAspectRatio', () => {
  const baseDrawing: SceneDrawingObject = {
    id: 'dr-1',
    name: 'Neon Brush',
    tool: 'brush',
    x: 500,
    y: 400,
    width: 200,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    strokeColor: '#38BDF8',
    strokeColorEnd: '#A855F7',
    useGradientStroke: false,
    strokeWidth: 6,
    strokeOpacity: 1,
    fillColor: '#000000',
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 16,
    polygonSides: 6,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#38BDF8',
    glowRadius: 24,
    glowIntensity: 1,
    glowSpread: 8,
    glowOpacity: 1,
    lockAspectRatio: true,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 12,
    animationMode: 'none',
    animationSpeed: 1,
    animationDurationFrames: 90,
    animationEasing: 'ease-in-out',
    visible: true,
    locked: false,
    zIndex: 5,
    points: [
      { x: -100, y: -50 },
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ],
  };

  // Locked aspect ratio: doubling width should also double height (100 -> 200) and scale points 2x
  const resized = resizeDrawingGeometry(baseDrawing, 400, undefined);
  assert.equal(resized.width, 400);
  assert.equal(resized.height, 200);
  assert.equal(resized.points[0].x, -200);
  assert.equal(resized.points[0].y, -100);
  assert.equal(resized.points[2].x, 200);
  assert.equal(resized.points[2].y, 100);
});

test('updateDrawingLineEndpoints updates center, bounding box, and local endpoints', () => {
  const dummyLine: SceneDrawingObject = {
    id: 'dr-line',
    name: 'Neon Line',
    tool: 'line',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    strokeColor: '#38BDF8',
    strokeColorEnd: '#A855F7',
    useGradientStroke: false,
    strokeWidth: 4,
    strokeOpacity: 1,
    fillColor: '#000000',
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 0,
    polygonSides: 6,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#38BDF8',
    glowRadius: 16,
    glowIntensity: 1,
    glowSpread: 8,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 12,
    animationMode: 'none',
    animationSpeed: 1,
    animationDurationFrames: 90,
    animationEasing: 'linear',
    visible: true,
    locked: false,
    zIndex: 5,
    points: [
      { x: -50, y: -50 },
      { x: 50, y: 50 },
    ],
  };
  const lineResult = updateDrawingLineEndpoints(dummyLine, 200, 100, 600, 300);
  assert.equal(lineResult.x, 400);
  assert.equal(lineResult.y, 200);
  assert.equal(lineResult.width, 400);
  assert.equal(lineResult.height, 200);
  assert.equal(lineResult.points[0].x, -200);
  assert.equal(lineResult.points[0].y, -100);
  assert.equal(lineResult.points[1].x, 200);
  assert.equal(lineResult.points[1].y, 100);
});

test('resolveDrawingAtFrame interpolates keyframed strokeWidth and strokeColor', () => {
  const drawing: SceneDrawingObject = {
    id: 'dr-stroke',
    name: 'Neon Rect',
    tool: 'rect',
    x: 400,
    y: 300,
    width: 300,
    height: 200,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    strokeColor: '#000000',
    strokeColorEnd: '#A855F7',
    useGradientStroke: false,
    strokeWidth: 4,
    strokeOpacity: 1,
    fillColor: '#000000',
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 16,
    polygonSides: 6,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#38BDF8',
    glowRadius: 20,
    glowIntensity: 1,
    glowSpread: 8,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 12,
    animationMode: 'none',
    animationSpeed: 1,
    animationDurationFrames: 90,
    animationEasing: 'linear',
    visible: true,
    locked: false,
    zIndex: 5,
    points: [],
  };
  const keyframes: Keyframe[] = [
    {
      id: 'k0',
      frame: 0,
      easing: 'linear',
      properties: { strokeWidth: 4, strokeColor: '#000000' },
    },
    {
      id: 'k1',
      frame: 60,
      easing: 'linear',
      properties: { strokeWidth: 20, strokeColor: '#FFFFFF' },
    },
  ];
  const resolvedMid = resolveDrawingAtFrame(drawing, keyframes, 30);
  assert.equal(resolvedMid.strokeWidth, 12);
  assert.equal(resolvedMid.strokeColor.toUpperCase(), '#808080');
});

test('resolveDrawingAtFrame enforces active timeline clip range [startFrame, endFrame] and entrance/exit animations', () => {
  const drawing: SceneDrawingObject = {
    id: 'dr-timed',
    name: 'Timed Neon Rect',
    tool: 'rounded-rect',
    x: 600,
    y: 400,
    width: 320,
    height: 220,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    strokeColor: '#22D3EE',
    strokeColorEnd: '#A855F7',
    useGradientStroke: true,
    strokeWidth: 6,
    strokeOpacity: 1,
    fillColor: '#22D3EE',
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 24,
    polygonSides: 6,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#22D3EE',
    glowRadius: 24,
    glowIntensity: 1,
    glowSpread: 8,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 12,
    startFrame: 30,
    durationFrames: 90, // Active from F30 to F120
    entranceAnimation: 'fade-in',
    exitAnimation: 'fade-out',
    animationMode: 'draw-on',
    animationSpeed: 1,
    animationDurationFrames: 60,
    animationEasing: 'ease-in-out',
    visible: true,
    locked: false,
    zIndex: 5,
    points: [],
  };

  // Before startFrame (F20): must be hidden
  const before = resolveDrawingAtFrame(drawing, [], 20, 180);
  assert.equal(before.visible, false);
  assert.equal(before.opacity, 0);

  // Inside active range (F75): must be visible with full opacity
  const activeMid = resolveDrawingAtFrame(drawing, [], 75, 180);
  assert.equal(activeMid.visible, true);
  assert.equal(activeMid.opacity, 1);

  // After endFrame (F125): must disappear
  const after = resolveDrawingAtFrame(drawing, [], 125, 180);
  assert.equal(after.visible, false);
  assert.equal(after.opacity, 0);
});

test('computeTrimmedDrawingClip and splitDrawingClipAtFrame preserve geometry while modifying timeline timing', () => {
  const drawing: SceneDrawingObject = {
    id: 'dr-clip-1',
    name: 'Neon Pen Path',
    tool: 'pen',
    x: 500,
    y: 400,
    width: 240,
    height: 160,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    strokeColor: '#38BDF8',
    strokeColorEnd: '#A855F7',
    useGradientStroke: false,
    strokeWidth: 5,
    strokeOpacity: 1,
    fillColor: '#000000',
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 0,
    polygonSides: 6,
    lineCap: 'round',
    lineJoin: 'round',
    dashPattern: 'solid',
    glowEnabled: true,
    glowColor: '#38BDF8',
    glowRadius: 24,
    glowIntensity: 1,
    glowSpread: 8,
    shadowEnabled: true,
    shadowColor: '#000000',
    shadowBlur: 12,
    startFrame: 20,
    durationFrames: 100, // F20..F120
    animationMode: 'draw-on',
    animationSpeed: 1,
    animationDurationFrames: 60,
    animationEasing: 'ease-in-out',
    visible: true,
    locked: false,
    zIndex: 6,
    points: [
      { x: -120, y: -80 },
      { x: 0, y: 40 },
      { x: 120, y: 80 },
    ],
  };

  // Trim left by +15 frames -> startFrame: 35, durationFrames: 85, geometric width/height unchanged
  const trimmedLeft = computeTrimmedDrawingClip(drawing, 'left', 15, 180);
  assert.equal(trimmedLeft.startFrame, 35);
  assert.equal(trimmedLeft.durationFrames, 85);
  assert.equal(trimmedLeft.width, 240);
  assert.equal(trimmedLeft.height, 160);

  // Split at F70 -> Part 1 (F20..F70, 50f) and Part 2 (F70..F120, 50f)
  const splitRes = splitDrawingClipAtFrame(drawing, 70, 'test', 180);
  assert.equal(splitRes.ok, true);
  assert.equal(splitRes.firstDrawing?.startFrame, 20);
  assert.equal(splitRes.firstDrawing?.durationFrames, 50);
  assert.equal(splitRes.secondDrawing?.startFrame, 70);
  assert.equal(splitRes.secondDrawing?.durationFrames, 50);
  assert.equal(splitRes.secondDrawing?.points.length, 3);

  // Path length & control point update
  const pathLen = computeDrawingPathLength(drawing);
  assert.ok(pathLen > 200);
  const updatedPt = updateDrawingControlPoint(drawing, 1, 550, 450);
  assert.equal(updatedPt.points.length, 3);
});

test('CapCut timeline coordinate system (frameToPixel, pixelToFrame, computeTimelineMetrics) round-trips accurately for short and 60s+ projects', () => {
  // 60-second project (1800 frames at 30fps)
  const metrics60s = computeTimelineMetrics(1800, 30, 1, 1000);
  assert.equal(metrics60s.pixelsPerSecond, 150);
  assert.equal(metrics60s.pixelsPerFrame, 5);
  assert.ok(metrics60s.contentWidthPx >= 9000);

  const pxAt900 = frameToPixel(900, 1, 0, 30);
  assert.equal(pxAt900, 4500);
  const frameBack = pixelToFrame(pxAt900, 1, 0, 30, 1800);
  assert.equal(frameBack, 900);

  const fitZoom = computeFitTimelineZoom(1800, 30, 900);
  assert.ok(fitZoom < 0.25 && fitZoom >= 0.08);
});

test('applyClipTrimWithRipple, canSplitAtPlayhead, and computeClipFilmstripThumbs work accurately', () => {
  const clipA: TimelineClip = {
    id: 'c-1',
    mediaId: 'm-1',
    name: 'Part 1',
    mediaType: 'video',
    trackId: 'track-1',
    startFrame: 0,
    durationFrames: 90,
    trimStartFrames: 0,
    sourceOutFrame: 90,
    sourceDurationFrames: 180,
    muted: false,
    locked: false,
    visible: true,
    waveformPeaks: [0.5, 0.8, 0.4],
  };
  const clipB: TimelineClip = {
    id: 'c-2',
    mediaId: 'm-1',
    name: 'Part 2',
    mediaType: 'video',
    trackId: 'track-1',
    startFrame: 90,
    durationFrames: 90,
    trimStartFrames: 90,
    sourceOutFrame: 180,
    sourceDurationFrames: 180,
    muted: false,
    locked: false,
    visible: true,
    waveformPeaks: [0.6, 0.7, 0.5],
  };

  // Ripple trim right edge of clipA by -30 frames (90 -> 60): clipB should ripple left from F90 to F60
  const rippled = applyClipTrimWithRipple([clipA, clipB], 'c-1', 'right', -30, 180, true);
  const rA = rippled.find((c) => c.id === 'c-1')!;
  const rB = rippled.find((c) => c.id === 'c-2')!;
  assert.equal(rA.durationFrames, 60);
  assert.equal(rB.startFrame, 60);

  // Split eligibility check
  const canSplitInside = canSplitAtPlayhead(clipA, null, 45, 180);
  assert.equal(canSplitInside.canSplit, true);
  assert.equal(canSplitInside.targetType, 'clip');

  const cannotSplitBoundary = canSplitAtPlayhead(clipA, null, 0, 180);
  assert.equal(cannotSplitBoundary.canSplit, false);

  // Filmstrip thumbnails
  const thumbs = computeClipFilmstripThumbs(clipA, 30, 450);
  assert.ok(thumbs.length >= 4);
  assert.equal(thumbs[0].timecodeLabel, '00:00:00');
});
