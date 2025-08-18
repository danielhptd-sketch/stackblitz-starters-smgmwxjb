import React from 'react';

export function Swatch({
  hex,
  active,
  onClick,
  title,
}: {
  hex: string;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`sw ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <span style={{ background: hex }} />
    </button>
  );
}
