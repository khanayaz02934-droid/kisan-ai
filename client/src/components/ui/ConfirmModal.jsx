import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';

/**
 * Destructive-action confirmation dialog. Renders a red-tinted warning
 * header, a description, and Confirm / Cancel buttons.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  busy = false,
}) {
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={20} />
        </span>
        <p className="text-sm text-muted">{message}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="danger" onClick={onConfirm} disabled={busy} className="flex-1">
          {busy ? <Spinner className="text-white" /> : confirmLabel}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1">
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
