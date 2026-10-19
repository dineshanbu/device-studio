import React, { useEffect, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Clipboard,
  Copy,
  Crosshair,
  Diamond,
  Eye,
  EyeOff,
  Grid3X3,
  Group,
  Layers,
  Lock,
  Plus,
  Ruler,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { useStudioStore } from '../scene-engine/store.ts';

export interface ViewportContextMenuProps {
  clientX: number;
  clientY: number;
  stageX?: number;
  stageY?: number;
  onClose: () => void;
}

export const ViewportContextMenu: React.FC<ViewportContextMenuProps> = ({
  clientX,
  clientY,
  stageX,
  stageY,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const {
    canvasWidth,
    canvasHeight,
    devices,
    drawings,
    webcams,
    selectedIds,
    selectedDrawingId,
    selectedWebcamId,
    copiedDevices,
    copiedDrawing,
    copiedWebcam,
    copySelectedDevices,
    pasteDevices,
    duplicateSelectedDevices,
    deleteSelectedDevices,
    deleteDrawing,
    deleteWebcam,
    updateDevice,
    updateDrawing,
    updateWebcam,
    reorderSceneLayer,
    addKeyframeAtCurrentFrame,
    groupSelectedDevices,
    ungroupSelectedDevices,
    selectAllDevices,
    snapToGrid,
    toggleSnapToGrid,
    gridSize,
    snapSelectedToGrid,
    showRulers,
    setShowRulers,
  } = useStudioStore();

  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const selectedWebcam = selectedWebcamId
    ? webcams.find((w) => w.id === selectedWebcamId) || null
    : null;
  const selectedDrawing = selectedDrawingId
    ? drawings.find((d) => d.id === selectedDrawingId) || null
    : null;
  const selectedDeviceList = devices.filter((d) => selectedIds.includes(d.id));
  const primaryDevice = selectedDeviceList[0] || null;

  const hasSelection = Boolean(
    selectedWebcam || selectedDrawing || selectedDeviceList.length > 0
  );

  const hasClipboard = Boolean(
    copiedWebcam || copiedDrawing || copiedDevices.length > 0
  );

  const clipboardLabel = copiedWebcam
    ? 'Paste Webcam'
    : copiedDrawing
      ? 'Paste Drawing'
      : copiedDevices.length > 1
        ? `Paste ${copiedDevices.length} Devices`
        : 'Paste';

  let targetHeader = 'Stage Viewport';
  let targetKind: 'webcam' | 'drawing' | 'device' | 'none' = 'none';
  let activeId: string | null = null;
  let isLocked = false;
  let isVisible = true;

  if (selectedWebcam) {
    targetHeader = selectedWebcam.name;
    targetKind = 'webcam';
    activeId = selectedWebcam.id;
    isLocked = selectedWebcam.locked;
    isVisible = selectedWebcam.visible;
  } else if (selectedDrawing) {
    targetHeader = selectedDrawing.name;
    targetKind = 'drawing';
    activeId = selectedDrawing.id;
    isLocked = selectedDrawing.locked;
    isVisible = selectedDrawing.visible;
  } else if (selectedDeviceList.length > 1) {
    targetHeader = `${selectedDeviceList.length} Devices Selected`;
    targetKind = 'device';
    activeId = primaryDevice.id;
    isLocked = primaryDevice.locked;
    isVisible = primaryDevice.visible;
  } else if (primaryDevice) {
    targetHeader = primaryDevice.name;
    targetKind = 'device';
    activeId = primaryDevice.id;
    isLocked = primaryDevice.locked;
    isVisible = primaryDevice.visible;
  }

  const hasGroupedDevice = selectedDeviceList.some((d) => Boolean(d.groupId));

  // Clamp menu coordinates inside browser viewport
  const menuWidth = 236;
  const menuHeight = 360;
  const safeLeft =
    typeof window !== 'undefined'
      ? Math.max(8, Math.min(clientX, window.innerWidth - menuWidth - 12))
      : clientX;
  const safeTop =
    typeof window !== 'undefined'
      ? Math.max(8, Math.min(clientY, window.innerHeight - menuHeight - 12))
      : clientY;

  const handleCopy = () => {
    if (!hasSelection) return;
    copySelectedDevices();
    onClose();
  };

  const handlePaste = () => {
    if (!hasClipboard) return;
    if (stageX !== undefined && stageY !== undefined) {
      pasteDevices({ x: stageX, y: stageY });
    } else {
      pasteDevices();
    }
    onClose();
  };

  const handleDuplicate = () => {
    if (!hasSelection) return;
    duplicateSelectedDevices();
    onClose();
  };

  const handleDelete = () => {
    if (!hasSelection) return;
    if (selectedWebcam) {
      deleteWebcam(selectedWebcam.id);
    } else if (selectedDrawing) {
      deleteDrawing(selectedDrawing.id);
    } else {
      deleteSelectedDevices();
    }
    onClose();
  };

  const handleCenterOnStage = () => {
    const cx = Math.round(canvasWidth / 2);
    const cy = Math.round(canvasHeight / 2);
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, { x: cx, y: cy });
    } else if (selectedDrawing) {
      updateDrawing(selectedDrawing.id, { x: cx, y: cy });
    } else if (primaryDevice) {
      updateDevice(primaryDevice.id, { x: cx, y: cy });
    }
    onClose();
  };

  const handleInsertKeyframe = () => {
    if (!activeId) return;
    addKeyframeAtCurrentFrame(activeId);
    onClose();
  };

  const handleBringToFront = () => {
    if (!activeId || targetKind === 'none') return;
    reorderSceneLayer(targetKind, activeId, 'top');
    onClose();
  };

  const handleSendToBack = () => {
    if (!activeId || targetKind === 'none') return;
    reorderSceneLayer(targetKind, activeId, 'bottom');
    onClose();
  };

  const handleToggleLock = () => {
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, { locked: !selectedWebcam.locked });
    } else if (selectedDrawing) {
      updateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
    } else if (primaryDevice) {
      updateDevice(primaryDevice.id, { locked: !primaryDevice.locked });
    }
    onClose();
  };

  const handleToggleVisibility = () => {
    if (selectedWebcam) {
      updateWebcam(selectedWebcam.id, { visible: !selectedWebcam.visible });
    } else if (selectedDrawing) {
      updateDrawing(selectedDrawing.id, { visible: !selectedDrawing.visible });
    } else if (primaryDevice) {
      updateDevice(primaryDevice.id, { visible: !primaryDevice.visible });
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Viewport Context Menu"
      data-testid="viewport-context-menu"
      data-hud-overlay="true"
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: `${safeLeft}px`, top: `${safeTop}px` }}
      className="fixed z-50 w-58 bg-white/98 backdrop-blur-md border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.16)] py-1.5 text-xs text-slate-800 select-none"
    >
      {/* Context Header */}
      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span
            data-testid="context-menu-target-label"
            className="font-semibold text-slate-900 truncate"
          >
            {targetHeader}
          </span>
        </div>
        {stageX !== undefined && stageY !== undefined && (
          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
            {Math.round(stageX)},{Math.round(stageY)}
          </span>
        )}
      </div>

      {/* Primary Clipboard & Object Actions: Copy, Paste, Duplicate, Delete */}
      <div className="py-1 px-1 space-y-0.5">
        <button
          type="button"
          role="menuitem"
          disabled={!hasSelection}
          onClick={handleCopy}
          data-testid="context-menu-copy"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy</span>
          </span>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+C</kbd>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!hasClipboard}
          onClick={handlePaste}
          data-testid="context-menu-paste"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Clipboard className="w-3.5 h-3.5 text-blue-600" />
            <span>{clipboardLabel}</span>
          </span>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+V</kbd>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!hasSelection}
          onClick={handleDuplicate}
          data-testid="context-menu-duplicate"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Duplicate</span>
          </span>
          <kbd className="text-[10px] font-mono text-slate-400">Ctrl+D</kbd>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!hasSelection}
          onClick={handleDelete}
          data-testid="context-menu-delete"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete</span>
          </span>
          <kbd className="text-[10px] font-mono text-rose-400">Del</kbd>
        </button>
      </div>

      {/* Contextual Element Actions when an element is selected */}
      {hasSelection && (
        <>
          <div className="my-1 border-t border-slate-100" />
          <div className="py-0.5 px-1 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleInsertKeyframe}
              data-testid="context-menu-keyframe"
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Diamond className="w-3.5 h-3.5 text-amber-500" />
                <span>Add Keyframe Here</span>
              </span>
              <kbd className="text-[10px] font-mono text-slate-400">K</kbd>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleCenterOnStage}
              data-testid="context-menu-center"
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-slate-500" />
                <span>Center on Stage</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                snapSelectedToGrid();
                onClose();
              }}
              data-testid="context-menu-snap-to-grid"
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Grid3X3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Align to Grid ({gridSize}px)</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleBringToFront}
              data-testid="context-menu-bring-front"
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ArrowUpToLine className="w-3.5 h-3.5 text-slate-500" />
                <span>Bring to Front</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleSendToBack}
              data-testid="context-menu-send-back"
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ArrowDownToLine className="w-3.5 h-3.5 text-slate-500" />
                <span>Send to Back</span>
              </span>
            </button>

            {selectedDeviceList.length >= 2 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  groupSelectedDevices();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Group className="w-3.5 h-3.5 text-blue-600" />
                  <span>Group Selected Devices</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400">Ctrl+G</kbd>
              </button>
            )}

            {hasGroupedDevice && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  ungroupSelectedDevices();
                  onClose();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Ungroup className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ungroup Devices</span>
                </span>
              </button>
            )}
          </div>

          <div className="my-1 border-t border-slate-100" />
          <div className="py-0.5 px-1 flex items-center gap-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleToggleLock}
              className="flex-1 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {isLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Unlock</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lock</span>
                </>
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleToggleVisibility}
              className="flex-1 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {isVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Show</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Stage-level quick actions when right-clicking */}
      <div className="my-1 border-t border-slate-100" />
      <div className="px-1 py-0.5 space-y-0.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowRulers(!showRulers);
            onClose();
          }}
          data-testid="context-menu-toggle-rulers"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Ruler className="w-3.5 h-3.5 text-blue-600" />
            <span>Viewport Rulers: {showRulers ? 'ON' : 'OFF'}</span>
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            toggleSnapToGrid();
            onClose();
          }}
          data-testid="context-menu-toggle-grid-snap"
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Grid3X3 className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Snap to Grid ({gridSize}px): {snapToGrid ? 'ON' : 'OFF'}
            </span>
          </span>
          <kbd className="text-[10px] font-mono text-slate-400">G</kbd>
        </button>

        {devices.length > 0 && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              selectAllDevices();
              onClose();
            }}
            data-testid="context-menu-select-all"
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <span>Select All Devices ({devices.length})</span>
          </button>
        )}
      </div>
    </div>
  );
};
