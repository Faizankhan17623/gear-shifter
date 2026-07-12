import type { GearConfig } from '../shared/models';

interface ReadoutProps {
  current: GearConfig | undefined;
}

export default function Readout({ current }: ReadoutProps) {
  if (!current) return null;

  return (
    <div className="readout">
      <div className="readout-row">
        <span className="readout-gear-badge">GEAR {current.gear}</span>
        <span className="readout-model-name">
          {current.model ? current.model.name : 'Empty — reserved'}
        </span>
      </div>
      <div className="readout-desc">
        {current.model ? current.model.description : 'No model assigned to this gear yet. Room to grow.'}
      </div>
      {current.model && <div className="readout-model-id">/model {current.model.modelId}</div>}
    </div>
  );
}
