import { useEffect, useState, useCallback, useRef } from 'react';
import type { GearConfig, GearId } from '../shared/models';
import { DEFAULT_GEAR_CONFIG, buildModelCommand } from '../shared/models';
import GearShifter from './GearShifter';
import Readout from './Readout';
import Toast from './Toast';
import SettingsModal from './SettingsModal';
import AutoTypeConfirm from './AutoTypeConfirm';

const AUTO_TYPE_PREF_KEY = 'gear-shifter-auto-type';

interface PendingAutoType {
  modelId: string;
  windowTitle: string;
}

export default function App() {
  const [gears, setGears] = useState<GearConfig[]>(DEFAULT_GEAR_CONFIG);
  const [activeGear, setActiveGear] = useState<GearId>('R');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoTypeEnabled, setAutoTypeEnabled] = useState(
    () => localStorage.getItem(AUTO_TYPE_PREF_KEY) === 'true',
  );
  const [pendingAutoType, setPendingAutoType] = useState<PendingAutoType | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.gearShifter.getGearConfig().then(setGears);
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTO_TYPE_PREF_KEY, String(autoTypeEnabled));
  }, [autoTypeEnabled]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const handleShift = useCallback(
    async (gear: GearId) => {
      const config = gears.find((g) => g.gear === gear);
      if (!config?.model) return; // locked gear, no-op

      setActiveGear(gear);
      const modelId = config.model.modelId;

      if (autoTypeEnabled) {
        const target = await window.gearShifter.getAutoTypeTarget();
        if (target.ok && target.title) {
          // Ask the user to confirm the exact target window by name before
          // anything is actually typed — window-focus detection is best-
          // effort and can occasionally resolve to the wrong window.
          setPendingAutoType({ modelId, windowTitle: target.title });
          return;
        }
        // No usable target — fall back to clipboard so the shift still
        // isn't a dead end.
        const copied = await window.gearShifter.copyModelCommand(modelId);
        showToast(
          copied
            ? `Couldn't find a window to auto-type into (${target.reason}) — copied /model ${modelId} instead, paste it in`
            : `Auto-type and clipboard copy both failed (${target.reason})`,
        );
        return;
      }

      const ok = await window.gearShifter.copyModelCommand(modelId);
      if (ok) {
        showToast(`Copied /model ${modelId} — paste into your Claude Code terminal`);
      } else {
        showToast('Could not copy to clipboard');
      }
    },
    [gears, autoTypeEnabled, showToast],
  );

  const handleConfirmAutoType = useCallback(async () => {
    if (!pendingAutoType) return;
    const { modelId } = pendingAutoType;
    setPendingAutoType(null);
    const result = await window.gearShifter.commitAutoType(modelId);
    if (result.ok) {
      showToast(`Typed /model ${modelId} into your terminal`);
    } else {
      const copied = await window.gearShifter.copyModelCommand(modelId);
      showToast(
        copied
          ? `Auto-type failed (${result.reason}) — copied /model ${modelId} instead, paste it in`
          : `Auto-type and clipboard copy both failed (${result.reason})`,
      );
    }
  }, [pendingAutoType, showToast]);

  const handleCancelAutoType = useCallback(() => {
    setPendingAutoType(null);
    showToast('Auto-type cancelled');
  }, [showToast]);

  const handleSaveSettings = useCallback(async (updated: GearConfig[]) => {
    const saved = await window.gearShifter.setGearConfig(updated);
    setGears(saved);
    setSettingsOpen(false);
    // If the active gear became locked, fall back to R.
    const stillValid = saved.find((g) => g.gear === activeGear)?.model;
    if (!stillValid) setActiveGear('R');
  }, [activeGear]);

  const handleResetSettings = useCallback(async () => {
    const reset = await window.gearShifter.resetGearConfig();
    setGears(reset);
  }, []);

  const currentConfig = gears.find((g) => g.gear === activeGear);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title">
          Gear<span>Shifter</span>
        </div>
        <button
          type="button"
          className="settings-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Edit gear → model mapping"
        >
          ⚙
        </button>
      </div>

      <p className="hint">
        {autoTypeEnabled ? (
          <>
            Auto-type is on — shifting asks you to confirm a target window, then types{' '}
            <code>/model &lt;id&gt;</code> into it. Window detection is best-effort; always check
            the confirmation before accepting.
          </>
        ) : (
          <>
            Shifting copies <code>/model &lt;id&gt;</code> to your clipboard. Paste into your open
            Claude Code terminal — this app can't reach into a running session directly.
          </>
        )}
      </p>

      <label className="auto-type-toggle">
        <input
          type="checkbox"
          checked={autoTypeEnabled}
          onChange={(e) => setAutoTypeEnabled(e.target.checked)}
        />
        Auto-type into a confirmed window (experimental)
      </label>

      <GearShifter gears={gears} activeGear={activeGear} onShift={handleShift} />

      <Readout current={currentConfig} />

      <Toast message={toastMessage} />

      {settingsOpen && (
        <SettingsModal
          gears={gears}
          onSave={handleSaveSettings}
          onReset={handleResetSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingAutoType && (
        <AutoTypeConfirm
          windowTitle={pendingAutoType.windowTitle}
          command={buildModelCommand(pendingAutoType.modelId)}
          onConfirm={handleConfirmAutoType}
          onCancel={handleCancelAutoType}
        />
      )}
    </div>
  );
}
