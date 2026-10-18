/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LeftSidebar } from './packages/editor/LeftSidebar.tsx';
import { ProjectManagerModal } from './packages/editor/ProjectManagerModal.tsx';
import { RightInspector } from './packages/editor/RightInspector.tsx';
import { StudioToolbar } from './packages/editor/StudioToolbar.tsx';
import { ExportModal } from './packages/export/ExportModal.tsx';
import { Canvas2DEditor } from './packages/render-2d/Canvas2DEditor.tsx';
import { Canvas3DSimulator } from './packages/render-3d/Canvas3DSimulator.tsx';
import { useStudioStore } from './packages/scene-engine/store.ts';
import { TimelinePanel } from './packages/timeline/TimelinePanel.tsx';

export default function App() {
  const {
    editorMode,
    isPlaying,
    setIsPlaying,
    undo,
    redo,
    deleteSelectedDevices,
    duplicateSelectedDevices,
    copySelectedDevices,
    pasteDevices,
    saveCurrentProject,
    selectAllDevices,
  } = useStudioStore();

  const [mobilePanel, setMobilePanel] = useState<
    'canvas' | 'library' | 'inspector'
  >('canvas');

  // Global Studio Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedDevices();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectedDevices();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteDevices();
        return;
      }
      if (isMod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllDevices();
        return;
      }
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentProject();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedDevices();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(!useStudioStore.getState().isPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    duplicateSelectedDevices,
    copySelectedDevices,
    pasteDevices,
    selectAllDevices,
    saveCurrentProject,
    deleteSelectedDevices,
    setIsPlaying,
  ]);

  // Autosave to IndexedDB every 15 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      saveCurrentProject();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [saveCurrentProject]);

  return (
    <div
      data-state={isPlaying ? 'playing' : editorMode}
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B0E14] text-[#F1F5F9]"
    >
      {/* Top Bar & Workspace Sub-Toolbar */}
      <StudioToolbar />

      {/* Mobile Viewport Drawer Switcher (< 1024px) */}
      <div className="flex lg:hidden items-center justify-around bg-[#0E131D] border-b border-slate-800 py-1.5 px-2 shrink-0">
        {(
          [
            { id: 'library', label: 'Library & Layers' },
            { id: 'canvas', label: 'Stage Viewport' },
            { id: 'inspector', label: 'Properties' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePanel(tab.id)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              mobilePanel === tab.id
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main 3-Column Studio Workspace */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar (Desktop always visible, Mobile when active) */}
        <div
          className={`${
            mobilePanel === 'library' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-auto h-full`}
        >
          <LeftSidebar />
        </div>

        {/* Center Interactive Stage (2D Canvas or 3D Simulator) */}
        <div
          className={`${
            mobilePanel === 'canvas' ? 'flex' : 'hidden lg:flex'
          } flex-1 h-full min-w-0 flex-col`}
        >
          {editorMode === '2d' ? <Canvas2DEditor /> : <Canvas3DSimulator />}
        </div>

        {/* Right Object Properties & Effects Inspector */}
        <div
          className={`${
            mobilePanel === 'inspector' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-auto h-full`}
        >
          <RightInspector />
        </div>
      </main>

      {/* Bottom Collapsible Deterministic Animation Timeline */}
      <TimelinePanel />

      {/* Modals */}
      <ProjectManagerModal />
      <ExportModal />
    </div>
  );
}
