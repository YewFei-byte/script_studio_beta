import React from 'react';
import { Save } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';

// "You have unsaved changes" when leaving a page that has a Save button.
export default function UnsavedChangesDialog({ what = 'changes', onSave, onDiscard, onStay }) {
  return (
    <Modal open onClose={onStay} width={400} zIndex={95}>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>Save your {what}?</h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 20 }}>You changed things but didn't press Save yet.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GlassButton variant="primary" icon={Save} onClick={onSave} style={{ justifyContent: 'center' }}>Save and continue</GlassButton>
        <GlassButton variant="ghost" onClick={onDiscard} style={{ justifyContent: 'center' }}>Don't save</GlassButton>
        <GlassButton variant="subtle" onClick={onStay} style={{ justifyContent: 'center' }}>Keep editing</GlassButton>
      </div>
    </Modal>
  );
}
