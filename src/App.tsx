import React, { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { StudioToolbar } from './packages/editor/StudioToolbar.tsx';
import { LeftSidebar } from './packages/editor/LeftSidebar.tsx';
import { RightInspector } from './packages/editor/RightInspector.tsx';
import { Canvas2DEditor } from './packages/render-2d/Canvas2DEditor.tsx';
import { Canvas3DSimulator } from './packages/render-3d/Canvas3DSimulator.tsx';
import { TimelinePanel } from './packages/timeline/TimelinePanel.tsx';
import { ExportModal } from './packages/export/ExportModal.tsx';
import { ProjectManagerModal } from './packages/editor/ProjectManagerModal.tsx';
import { useStudioStore } from './packages/scene-engine/store.ts';

export function App() {
  const {
    editorMode,
    isPlaying,
    fps,
    durationInFrames,
    currentFrame,
    loopPlayback,
    setCurrentFrame,
    setIsPlaying,
    undo,
    redo,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    copySelectedDevices,
    pasteDevices,
    groupSelectedDevices,
    ungroupSelectedDevices,
    stepFrame,
    addKeyframeAtCurrentFrame,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    deleteDrawing,
    deleteWebcam,
    saveCurrentProject,
    splitSelectedClipAtPlayhead,
    trimSelectedClipToPlayhead,
  } = useStudioStore();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Master timeline requestAnimationFrame loop
  useEffect(() => {
    if (!isPlaying) return;
    let lastTime = performance.now();
    let animId = 0;
    const frameInterval = 1000 / fps;

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      if (elapsed >= frameInterval) {
        lastTime = now - (elapsed % frameInterval);
        const state = useStudioStore.getState();
        const nextFrame = state.currentFrame + 1;
        if (nextFrame >= state.durationInFrames) {
          if (state.loopPlayback) {
            state.setCurrentFrame(0);
          } else {
            state.setCurrentFrame(state.durationInFrames - 1);
            state.setIsPlaying(false);
            return;
          }
        } else {
          state.setCurrentFrame(nextFrame);
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, fps, durationInFrames, loopPlayback, setCurrentFrame, setIsPlaying]);

  // Background auto-save every 20 seconds when changes occur
  useEffect(() => {
    const timer = setInterval(() => {
      saveCurrentProject();
    }, 20000);
    return () => clearInterval(timer);
  }, [saveCurrentProject]);

  // Global Studio Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!useStudioStore.getState().isPlaying);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedDevices();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectedDevices();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteDevices();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelectedDevices();
        else groupSelectedDevices();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentProject();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedWebcamId) {
          deleteWebcam(selectedWebcamId);
        } else if (selectedDrawingId) {
          deleteDrawing(selectedDrawingId);
        } else {
          deleteSelectedDevices();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(e.shiftKey ? -10 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(e.shiftKey ? 10 : 1);
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const target =
          selectedWebcamId || selectedDrawingId || selectedIds[0];
        if (target) addKeyframeAtCurrentFrame(target);
      } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        splitSelectedClipAtPlayhead();
      } else if (e.key === '[') {
        e.preventDefault();
        trimSelectedClipToPlayhead('left');
      } else if (e.key === ']') {
        e.preventDefault();
        trimSelectedClipToPlayhead('right');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setIsPlaying,
    undo,
    redo,
    duplicateSelectedDevices,
    copySelectedDevices,
    pasteDevices,
    groupSelectedDevices,
    ungroupSelectedDevices,
    deleteSelectedDevices,
    deleteDrawing,
    deleteWebcam,
    stepFrame,
    addKeyframeAtCurrentFrame,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    currentFrame,
    saveCurrentProject,
    splitSelectedClipAtPlayhead,
    trimSelectedClipToPlayhead,
  ]);

  return (
    <div
      data-theme="light"
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#F8FAFC] text-[#0F172A] select-none"
    >
      {/* Top Studio Header */}
      <StudioToolbar />

      {/* Main Middle Workspace: Left Sidebar + Center Viewport + Right Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {!leftCollapsed && <LeftSidebar />}

        {/* Center Viewport with subtle panel toggle handles */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* Subtle Left/Right Sidebar Collapse Toggles in top corners of viewport */}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            title={leftCollapsed ? 'Expand Left Asset Sidebar' : 'Collapse Left Asset Sidebar'}
            className="absolute top-2.5 left-2.5 z-20 p-1.5 rounded-md bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/90 shadow-2xs transition-colors"
          >
            {leftCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            title={rightCollapsed ? 'Expand Right Inspector' : 'Collapse Right Inspector'}
            className="absolute top-2.5 right-2.5 z-20 p-1.5 rounded-md bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/90 shadow-2xs transition-colors"
          >
            {rightCollapsed ? (
              <PanelRightOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )}
          </button>

          {editorMode === '2d' ? <Canvas2DEditor /> : <Canvas3DSimulator />}
        </div>

        {!rightCollapsed && <RightInspector />}
      </div>

      {/* Bottom Keyframe & Animation Timeline */}
      <TimelinePanel />

      {/* Modals */}
      <ExportModal />
      <ProjectManagerModal />
    </div>
  );
}

export default App;
