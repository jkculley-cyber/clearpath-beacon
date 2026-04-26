import { useState, useEffect } from 'react';
import { exportLocalBackup } from '../lib/db';

async function downloadBackup() {
  const data = await exportLocalBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('beacon_last_backup', new Date().toISOString());
}

export default function ConfirmDestructive({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Continue',
  confirmColor = '#dc2626',
  onConfirm,
}) {
  const [backupFirst, setBackupFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset state every time the modal opens (CC8 modal-reset rule).
  useEffect(() => {
    if (open) {
      setBackupFirst(true);
      setBusy(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setError('');
    setBusy(true);
    if (backupFirst) {
      try {
        await downloadBackup();
      } catch (e) {
        setBusy(false);
        setError(`Backup failed — destructive action aborted. ${e?.message || ''}`);
        return;
      }
    }
    try {
      await onConfirm();
    } catch (e) {
      setBusy(false);
      setError(e?.message || 'Action failed.');
      return;
    }
    setBusy(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={busy ? undefined : onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 460,
          width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        <p style={{ marginTop: 10, marginBottom: 16, fontSize: 14, color: '#475569', lineHeight: 1.55 }}>
          {message}
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            marginBottom: 16,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={backupFirst}
            onChange={(e) => setBackupFirst(e.target.checked)}
            disabled={busy}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5 }}>
            <strong>Download a JSON backup first (recommended).</strong>
            <br />
            Local data lives only on this device — there's no server-side undo. If you don't keep a backup and something goes wrong, the data is gone.
          </span>
        </label>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={busy}
            style={{ fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            style={{
              fontSize: 13,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: confirmColor,
              color: '#fff',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
