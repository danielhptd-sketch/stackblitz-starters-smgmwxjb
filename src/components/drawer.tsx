import React, { PropsWithChildren } from 'react';

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
}>;

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="btn" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}
