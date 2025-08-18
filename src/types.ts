export type Size = "6ft" | "7ft";
export type ModelKind = "freeplay" | "coin" | "electric" | "contactless";

export type StepKey =
  | "finish"
  | "size"
  | "clothFamily"
  | "clothColor"
  | "modelType"
  | "accessories"; // delivery/installation is now separate UI (not a step)

export interface StepDef {
  key: StepKey;
  label: string;
  required?: boolean; // controls Next button enablement
  visible?: boolean;  // supports hiding steps dynamically
}

export interface Selection {
  finish?: string;
  size?: Size;
  clothFamily?: string;
  clothColor?: string;
  modelType?: ModelKind;
  accessoriesPack?: "free" | "deluxe";
  accessoriesExtras: string[];
  deliveryInstall?: string; // separated UI; still part of price
}

export type PriceBreakdown = {
  base: number;
  finishDelta: number;
  clothDelta: number;
  accessoriesDelta: number;
  deliveryDelta: number;
  total: number;
};