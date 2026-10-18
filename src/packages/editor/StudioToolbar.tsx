import React, { useState } from 'react';
import {
  Box,
  Check,
  Grid,
  Monitor,
  Redo2,
  Ruler,
  Save,
  Undo2,
} from 'lucide-react';
import { useStudioStore } from '../scene-engine/store.ts';
import type { AspectRatioPreset } from '../shared/types.ts';

export const StudioToolbar: React.FC = () => {
  const {
    projectName,
    editorMode,
    aspectRatio,
    snapToGrid,
    showRulers,
    historyIndex,
    history,
    setProjectName,
    setEditorMode,
    setActiveModal,
    setCanvasAspectRatio,
    setSnapToGrid,
    setShowRulers,
    undo,
    redo,
    saveCurrentProject,
  } = useStudioStore();

  const [justSaved, setJustSaved] = useState(false);

  const handleQuickSave = async () => {
    await saveCurrentProject();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <div className="shrink-0 select-none">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="h-12 flex items-center justify-between gap-8 px-5 bg-[#0B0E14] border-b border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setEditorMode('2d');
          }}
          className="text-base font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0"
        >
          Device Studio
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Studio Navigation"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400"
        >
          <a
            href="#2d-editor"
            onClick={(e) => {
              e.preventDefault();
              setEditorMode('2d');
            }}
            className={`hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              editorMode === '2d' ? 'text-slate-100 underline' : ''
            }`}
          >
            2D Canvas
          </a>
          <a
            href="#3d-simulator"
            onClick={(e) => {
              e.preventDefault();
              setEditorMode('3d');
            }}
            className={`hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              editorMode === '3d' ? 'text-slate-100 underline' : ''
            }`}
          >
            3D Simulator
          </a>
          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal('projects');
            }}
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Projects
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              setActiveModal('architecture');
            }}
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Architecture
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveModal('export')}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Export Scene
          </button>
        </div>
      </header>

      {/* Secondary Workspace Toolbar */}
      <div className="h-10 px-4 bg-[#111724] border-b border-slate-800/90 flex items-center justify-between gap-4 overflow-x-auto">
        {/* Left: Project Name, Save, Undo/Redo */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            aria-label="Current Project Title"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-[#090C12] border border-slate-800 focus:border-sky-500 rounded-md px-2.5 py-1 text-xs font-medium text-slate-200 w-48 outline-none"
          />

          <button
            type="button"
            onClick={handleQuickSave}
            aria-label="Save project to local storage"
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#090C12] hover:bg-slate-800 border border-slate-800 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            {justSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-sky-400" />
                <span>Save</span>
              </>
            )}
          </button>

          <div className="w-px h-4 bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            aria-label="Undo"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-35 rounded hover:bg-slate-800 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            aria-label="Redo"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-35 rounded hover:bg-slate-800 transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: 2D / 3D Workspace Engine Switcher */}
        <div className="flex items-center gap-1 bg-[#090C12] p-0.5 rounded-lg border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setEditorMode('2d')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              editorMode === '2d'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>2D Stage Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('3d')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              editorMode === '3d'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Device Simulator</span>
          </button>
        </div>

        {/* Right: Stage Aspect Ratio, Snap & Rulers */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Stage Aspect Ratio"
            value={aspectRatio}
            onChange={(e) =>
              setCanvasAspectRatio(e.target.value as AspectRatioPreset)
            }
            className="bg-[#090C12] border border-slate-800 rounded-md px-2 py-1 text-xs font-mono tabular-nums text-slate-200"
          >
            <option value="16:9">16:9 (1920×1080)</option>
            <option value="9:16">9:16 (1080×1920)</option>
            <option value="1:1">1:1 (1080×1080)</option>
            <option value="4:3">4:3 (1440×1080)</option>
          </select>

          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            aria-label="Toggle snap to grid"
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors whitespace-nowrap shrink-0 ${
              snapToGrid
                ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                : 'bg-[#090C12] border-slate-800 text-slate-400'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRulers(!showRulers)}
            aria-label="Toggle canvas rulers"
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors whitespace-nowrap shrink-0 ${
              showRulers
                ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                : 'bg-[#090C12] border-slate-800 text-slate-400'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Rulers</span>
          </button>
        </div>
      </div>
    </div>
  );
};
