/**
 * CrisisLaunchButton — floating red button visible on every authed page.
 * Click → opens CrisisModal.
 *
 * Position: bottom-right, above any other floating UI. Z-index high enough to
 * sit above modals it doesn't own (but below itself when its own modal is open).
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CrisisModal from './CrisisModal';

export default function CrisisLaunchButton() {
  const { counselor } = useAuth();
  const [open, setOpen] = useState(false);

  if (!counselor?.id) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Start a crisis workflow"
        aria-label="Crisis workflow"
        style={{
          position: 'fixed',
          bottom: 96, // stacks above the Dashboard Quick-Log FAB (which sits at bottom:28, height:56)
          right: 28,
          zIndex: 250,
          background: '#dc2626',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '12px 18px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          letterSpacing: 0.3,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>🚨</span>
        Crisis Now
      </button>

      <CrisisModal open={open} onClose={() => setOpen(false)} counselor={counselor} />
    </>
  );
}
