import React from 'react';

type FinishDropdownProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function FinishDropdown({ label, open, onToggle, children }: FinishDropdownProps) {
  return (
    <div className="finishbar">
      <button type="button" className="finishbar__btn" onClick={onToggle} aria-expanded={open}>
        <span className="ico" aria-hidden>🎨</span>
        <span>{label}</span>
        <span className="chev" aria-hidden>▾</span>
      </button>
      {open && <div className="finishbar__panel card">{children}</div>}
    </div>
  );
}
