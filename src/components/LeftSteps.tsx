import React from "react";
import type { StepDef } from "../types";

type Props = {
  steps: StepDef[];
  activeKey: string;
  total: number;
  completedKeys: Set<string>;
};

export default function LeftSteps({ steps, activeKey, total, completedKeys }: Props) {
  return (
    <div className="card leftsteps">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <h3 className="m-0">Your build</h3>
          <div className="total">£{total.toLocaleString()}</div>
        </div>
        <ol className="leftsteps__list">
          {steps.map(s => {
            const active = s.key === activeKey;
            const done = completedKeys.has(s.key);
            return (
              <li key={s.key} className={`leftsteps__item ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                <span className="dot">{done ? '✓' : steps.indexOf(s) + 1}</span>
                <span className="texts">
                  <span className="label">{s.label}</span>
                  {s.sub && <span className="sub">{s.sub}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
