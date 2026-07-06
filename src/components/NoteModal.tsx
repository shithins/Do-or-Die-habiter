import React, { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';

interface NoteModalProps {
  isOpen: boolean;
  habitName: string;
  habitUnit?: string; // optional unit (e.g., "hrs", "pages")
  date: string;
  onClose: () => void;
  onConfirm: (note: string, value?: number) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  habitName,
  habitUnit,
  date,
  onClose,
  onConfirm
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [noteText, setNoteText] = useState('');
  const [valueText, setValueText] = useState('');

  // Control dialog show/hide via native API
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setNoteText('');
      setValueText('');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Fallback for browsers that do not support declarative light-dismiss (Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (!isDialogContent) {
          onClose();
        }
      };

      dialog.addEventListener('click', handleBackdropClick);
      return () => {
        dialog.removeEventListener('click', handleBackdropClick);
      };
    }
  }, [onClose]);

  // Listen to close events (Esc key native close) to sync state back to parent
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (isOpen) {
        onClose();
      }
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = valueText.trim() !== '' ? parseFloat(valueText) : undefined;
    onConfirm(noteText.trim(), isNaN(numValue as number) ? undefined : numValue);
  };

  const handleSkip = () => {
    onConfirm('', undefined);
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="modal-title"
    >
      <div className="modal-content">
        <div className="modal-title-row">
          <div>
            <h3 id="modal-title" className="text-lg font-bold text-white">
              Log Progress
            </h3>
            <p className="text-xs text-zinc-400">
              {habitName} on {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-close-modal"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Numeric Quantity Input - Shown if habit tracks a unit */}
          {habitUnit && (
            <div className="form-field-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="value-input" className="input-label">
                Quantity ({habitUnit})
              </label>
              <div className="flex items-center" style={{ gap: '0.5rem' }}>
                <input
                  id="value-input"
                  type="number"
                  step="any"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  placeholder="e.g. 8"
                  className="input-text"
                  style={{ maxWidth: '120px' }}
                  autoFocus={!!habitUnit}
                  required
                />
                <span className="text-sm font-semibold text-zinc-400">
                  {habitUnit}
                </span>
              </div>
            </div>
          )}

          {/* Progress Note */}
          <div className="form-field-group">
            <label htmlFor="note-input" className="input-label">
              Optional Note
            </label>
            <textarea
              id="note-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What book did you read? What did you work on?"
              rows={3}
              maxLength={200}
              className="textarea-note"
              autoFocus={!habitUnit}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleSkip}
              className="btn-skip-note"
            >
              Skip
            </button>
            <button
              type="submit"
              className="btn-save-note"
            >
              <Check size={16} />
              Save & Complete
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
