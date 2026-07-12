import { useState } from 'react';
import type { GearConfig } from '../shared/models';
import { AVAILABLE_MODELS } from '../shared/models';

interface SettingsModalProps {
  gears: GearConfig[];
  onSave: (updated: GearConfig[]) => void;
  onReset: () => void;
  onClose: () => void;
}

const EMPTY_VALUE = '__none__';

export default function SettingsModal({ gears, onSave, onReset, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<GearConfig[]>(() => gears.map((g) => ({ ...g })));

  function updateGear(gear: string, modelId: string) {
    setDraft((prev) =>
      prev.map((g) => {
        if (g.gear !== gear) return g;
        if (modelId === EMPTY_VALUE) return { ...g, model: null };
        const model = AVAILABLE_MODELS.find((m) => m.modelId === modelId) ?? null;
        return { ...g, model };
      }),
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Gear → Model Mapping</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {draft.map((g) => (
          <div className="settings-row" key={g.gear}>
            <span className="settings-gear-tag">{g.gear}</span>
            <select
              className="settings-select"
              value={g.model?.modelId ?? EMPTY_VALUE}
              onChange={(e) => updateGear(g.gear, e.target.value)}
            >
              <option value={EMPTY_VALUE}>— Empty / Locked —</option>
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onReset}>
            Reset to defaults
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
