import React, { useMemo, useState } from "react";
import type { Selection, StepDef } from "../types";
import SelectCard from "./SelectCard";

type Props = {
  steps: StepDef[];                 // each has { key, label, render(), isComplete?(sel), canNext?(sel) }
  selection: Selection;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  canSubmit: boolean;
  onSubmit: () => void;
};

export function Stepper({ steps, selection, setSelection, canSubmit, onSubmit }: Props) {
  const [activeKey, setActiveKey] = useState(steps[0]?.key);
  const idx = Math.max(0, steps.findIndex(s => s.key === activeKey));
  const isLast = idx === steps.length - 1;

  const canNext = useMemo(() => {
    const def = steps[idx];
    return def?.canNext ? !!def.canNext(selection) : !!def?.isComplete?.(selection);
  }, [steps, idx, selection]);

  function go(delta: number) {
    const nextIdx = Math.min(steps.length - 1, Math.max(0, idx + delta));
    setActiveKey(steps[nextIdx].key);
  }

  return (
    <div className="card">
      <div className="card-body">
        {steps[idx]?.render({ selection, setSelection })}

        <div className="row mt-4 justify-between">
          <button className="btn" onClick={() => go(-1)} disabled={idx === 0}>Back</button>
          {!isLast && (
            <button className="btn primary" onClick={() => go(1)} disabled={!canNext}>Next</button>
          )}
          {isLast && (
            <button className="btn primary" onClick={onSubmit} disabled={!canSubmit}>Add to cart</button>
          )}
        </div>
      </div>
    </div>
  );
}
