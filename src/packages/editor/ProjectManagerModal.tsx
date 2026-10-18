import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Layers,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteProjectFromDb,
  listProjectsFromDb,
} from '../scene-engine/db.ts';
import { useStudioStore } from '../scene-engine/store.ts';
import type { ProjectDocument } from '../shared/types.ts';

export const ProjectManagerModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    projectId,
    projectName,
    projectVersion,
    mediaAssets,
    setProjectName,
    newProject,
    saveCurrentProject,
    loadProjectDocument,
    duplicateCurrentProject,
    exportProjectJsonString,
  } = useStudioStore();

  const [savedProjects, setSavedProjects] = useState<ProjectDocument[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (activeModal === 'projects') {
      listProjectsFromDb().then(setSavedProjects);
    }
  }, [activeModal]);

  if (activeModal !== 'projects' && activeModal !== 'architecture') return null;

  const missingAssets = mediaAssets.filter((m) => m.missing);

  const handleSave = async () => {
    await saveCurrentProject();
    const list = await listProjectsFromDb();
    setSavedProjects(list);
    setStatusMessage('Project saved to local IndexedDB storage.');
  };

  const handleDuplicate = async () => {
    await duplicateCurrentProject();
    const list = await listProjectsFromDb();
    setSavedProjects(list);
    setStatusMessage('Project duplicated and saved.');
  };

  const handleExportJson = () => {
    const json = exportProjectJsonString();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'
    }.studio.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectDocument;
      if (!parsed || !Array.isArray(parsed.devices)) {
        throw new Error('Invalid Device Studio scene JSON file.');
      }
      loadProjectDocument(parsed);
      setStatusMessage(
        `Loaded project "${parsed.name}" (v${parsed.version || 1}).`
      );
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to parse project JSON.'
      );
    }
  };

  if (activeModal === 'architecture') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arch-modal-title"
        className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl bg-[#0E131D] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111724]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h2
                id="arch-modal-title"
                className="text-base font-semibold text-slate-100"
              >
                Modular Architecture & Tauri 2 Desktop Packaging
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              aria-label="Close architecture modal"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4 text-xs text-slate-300 overflow-y-auto max-h-[75vh]">
            <p className="text-slate-400 leading-relaxed">
              Device Studio shares a unified scene engine, device catalog, media
              pipeline, and deterministic renderer across Web and Tauri 2
              Windows Desktop builds:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-[#090C12] border border-slate-800">
                <div className="text-sky-400 font-semibold">
                  packages/device-catalog
                </div>
                <div className="text-slate-400 mt-1">
                  14 calibrated presets across iPhone, Android, Tablet, Laptop,
                  Monitor, Browser, and Wearable/Handheld categories.
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#090C12] border border-slate-800">
                <div className="text-sky-400 font-semibold">
                  packages/scene-engine
                </div>
                <div className="text-slate-400 mt-1">
                  Deterministic keyframe spline math, screen fit calculator,
                  Zustand store, and Dexie IndexedDB persistence.
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#090C12] border border-slate-800">
                <div className="text-sky-400 font-semibold">
                  packages/render-2d & render-3d
                </div>
                <div className="text-slate-400 mt-1">
                  Interactive 2D canvas editor + Three.js PBR 3D simulator with
                  RoomEnvironment and composite multi-part meshes.
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#090C12] border border-slate-800">
                <div className="text-sky-400 font-semibold">
                  apps/desktop (Tauri 2)
                </div>
                <div className="text-slate-400 mt-1">
                  Windows WebView2 shell (`tauri.conf.json`) with native file
                  dialogs and FFmpeg sidecar CLI encoding.
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-3.5 border-t border-slate-800 bg-[#111724] flex justify-end">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-4 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="projects-modal-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl bg-[#0E131D] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111724]">
          <div>
            <h2
              id="projects-modal-title"
              className="text-base font-semibold text-slate-100"
            >
              Project Manager & Local Storage
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              IndexedDB (Dexie) local persistence · Versioned JSON scene format
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('none')}
            aria-label="Close project manager"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {missingAssets.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Missing Local Media Blobs:</strong>{' '}
                {missingAssets.length} uploaded file(s) need to be re-linked in
                the Media tab.
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              {statusMessage}
            </div>
          )}

          {importError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {importError}
            </div>
          )}

          {/* Active Project Settings */}
          <div className="p-4 rounded-xl bg-[#090C12] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Active Project (v{projectVersion})
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                ID: {projectId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                aria-label="Project Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="flex-1 min-w-[200px] bg-[#111724] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                Save Now
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  newProject();
                  setStatusMessage('Initialized new studio project.');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 bg-[#111724] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                Export .studio.json
              </button>

              <label className="px-3 py-1.5 bg-[#111724] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                Import .studio.json
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Saved IndexedDB Projects */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saved IndexedDB Projects ({savedProjects.length})
            </h3>
            {savedProjects.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-[#090C12] border border-slate-800/80 text-xs text-slate-500">
                No projects saved in IndexedDB yet. Click &ldquo;Save Now&rdquo;
                above to persist your scene.
              </div>
            ) : (
              <div className="space-y-2">
                {savedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-lg bg-[#090C12] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200">
                        {proj.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {proj.devices.length} devices · {proj.aspectRatio} ·
                        Updated {new Date(proj.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          loadProjectDocument(proj);
                          setActiveModal('none');
                        }}
                        className="px-3 py-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs rounded-md flex items-center gap-1"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteProjectFromDb(proj.id);
                          setSavedProjects(await listProjectsFromDb());
                        }}
                        aria-label={`Delete project ${proj.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
