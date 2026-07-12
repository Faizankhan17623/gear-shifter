interface AutoTypeConfirmProps {
  windowTitle: string;
  command: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AutoTypeConfirm({ windowTitle, command, onConfirm, onCancel }: AutoTypeConfirmProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirm auto-type target</h2>
        </div>
        <p className="confirm-body">
          About to type <code>{command}</code> into:
        </p>
        <div className="confirm-target-window">{windowTitle}</div>
        <p className="confirm-warning">
          If this isn't your Claude Code terminal, cancel and switch to it first.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Yes, type it
          </button>
        </div>
      </div>
    </div>
  );
}
