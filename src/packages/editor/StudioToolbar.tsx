import React, { useState } from 'react';
import {
  Box,
  Check,
  Download,
  FolderOpen,
  Layers,
  MonitorPlay,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { useStudioStore } from '../scene-engine/store.ts';
import type { AspectRatioPreset } from '../shared/types.ts';

export const StudioToolbar: React.FC = () => {
  const {
    projectName,
    setProjectName,
    lastSavedAt,
    saveCurrentProject,
    editorMode,
    setEditorMode,
    activeModal,
    setActiveModal,
    aspectRatio,
    setCanvasAspectRatio,
    canvasWidth,
    canvasHeight,
    isPlaying,
    setIsPlaying,
    undo,
    redo,
    historyIndex,
    history,
  } = useStudioStore();

  const [savePulse, setSavePulse] = useState(false);

  const handleQuickSave = async () => {
    await saveCurrentProject();
    setSavePulse(true);
    setTimeout(() => setSavePulse(false), 1400);
  };

  const ratios: { id: AspectRatioPreset; label: string }[] = [
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '1:1', label: '1:1' },
    { id: '4:3', label: '4:3' },
  ];

  const isEditorActive = editorMode === '2d' && activeModal === 'none';
  const is3DActive = editorMode === '3d' && activeModal === 'none';
  const isProjectsActive = activeModal === 'projects';
  const isExportActive = activeModal === 'export';

  return (
    <header className="h-13 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none z-30 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {/* Left: Brand, Project Name & Save Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
              Device Studio
            </span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-slate-50 rounded px-1 -ml-1 w-48 truncate transition-colors"
              aria-label="Project Name"
            />
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Save status button */}
        <button
          onClick={handleQuickSave}
          title="Save project to browser database"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            savePulse
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {savePulse ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save</span>
              {lastSavedAt && (
                <span className="text-[10px] text-slate-400 font-normal hidden xl:inline">
                  · Auto
                </span>
              )}
            </>
          )}
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center: Primary Top-Level Workspace Navigation (1. Editor, 2. 3D Studio, 3. Projects, 4. Export) */}
      <nav
        aria-label="Primary Workspace Areas"
        className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 gap-1"
      >
        <button
          onClick={() => {
            setEditorMode('2d');
            if (activeModal !== 'none') setActiveModal('none');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isEditorActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => {
            setEditorMode('3d');
            if (activeModal !== 'none') setActiveModal('none');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            is3DActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Studio</span>
        </button>

        <button
          onClick={() =>
            setActiveModal(isProjectsActive ? 'none' : 'projects')
          }
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isProjectsActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Projects</span>
        </button>

        <button
          onClick={() => setActiveModal(isExportActive ? 'none' : 'export')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isExportActive
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </nav>

      {/* Right: Aspect Ratio, Preview Play/Pause & Primary Export Action */}
      <div className="flex items-center gap-2.5">
        {/* Aspect Ratio Selector */}
        <div className="hidden lg:flex items-center bg-slate-50 rounded-md p-0.5 border border-slate-200">
          {ratios.map((r) => (
            <button
              key={r.id}
              onClick={() => setCanvasAspectRatio(r.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                aspectRatio === r.id
                  ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/70 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="px-2 text-[10px] font-mono text-slate-400 border-l border-slate-200 ml-1">
            {canvasWidth}×{canvasHeight}
          </span>
        </div>

        {/* Preview Play / Pause button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          title="Preview Timeline Playback (Space)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
            isPlaying
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview</span>
            </>
          )}
        </button>

        {/* Primary Export CTA */}
        <button
          onClick={() => setActiveModal('export')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
