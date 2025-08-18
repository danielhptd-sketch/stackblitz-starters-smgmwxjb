import React from "react";

export default function SelectCard<T extends string | number | undefined>({
  title,
  options,
  value,
  onChange,
  multi,
}: {
  title: string;
  options: { id: string; label: string; caption?: string }[];
  value: T | T[] | undefined;
  onChange: (v: any) => void;
  multi?: boolean;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  const toggle = (id: string) => {
    if (!multi) return onChange(id);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div>
      <h4 className="mb-3">{title}</h4>
      <div className="grid grid-2">
        {options.map(o => (
          <button
            key={o.id}
            className={`card option ${selected.has(o.id) ? "active" : ""}`}
            type="button"
            onClick={() => toggle(o.id)}
          >
            <div className="card-body">
              <div className="title">{o.label}</div>
              {o.caption && <div className="caption">{o.caption}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}