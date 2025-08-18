import type { Selection, PriceBreakdown, Size, ModelKind } from './types';

// Adapt these maps to your actual JSON pricing; the keys are placeholders you can wire up quickly.
const BASE_PRICE: Record<ModelKind, Record<Size, number>> = {
  freeplay: { '6ft': 1195, '7ft': 1295 },
  coin: { '6ft': 1475, '7ft': 1575 },
  electric: { '6ft': 0, '7ft': 0 },
  contactless: { '6ft': 0, '7ft': 0 },
};

const FINISH_DELTA: Record<string, number> = {
  // e.g. "Black Pearl": 0,
};
const CLOTH_DELTA: Record<string, number> = {
  // e.g. "Hainsworth Elite Pro": 60
};
const ACCESSORY_PACK_DELTA: Record<string, number> = { free: 0, deluxe: 95 };
const ACCESSORY_EXTRA_DELTA: Record<string, number> = {
  // e.g. "Wall Rack": 39
};
const DELIVERY_DELTA: Record<string, number> = {
  // e.g. "stairs": 60, "islands": 150
};

export function price(selection: Selection): PriceBreakdown {
  const base = (() => {
    const mk = selection.modelType || 'freeplay';
    const sz = selection.size || '7ft';
    return BASE_PRICE[mk]?.[sz] ?? 0;
  })();

  const finishDelta = selection.finish
    ? FINISH_DELTA[selection.finish] ?? 0
    : 0;
  const clothDelta = selection.clothFamily
    ? CLOTH_DELTA[selection.clothFamily] ?? 0
    : 0;

  const accessoriesPack = selection.accessoriesPack ?? 'free';
  const packDelta = ACCESSORY_PACK_DELTA[accessoriesPack] ?? 0;
  const extrasDelta = (selection.accessoriesExtras || []).reduce(
    (sum, id) => sum + (ACCESSORY_EXTRA_DELTA[id] ?? 0),
    0
  );
  const accessoriesDelta = packDelta + extrasDelta;

  const deliveryDelta = selection.deliveryInstall
    ? DELIVERY_DELTA[selection.deliveryInstall] ?? 0
    : 0;

  const total =
    base + finishDelta + clothDelta + accessoriesDelta + deliveryDelta;
  return {
    base,
    finishDelta,
    clothDelta,
    accessoriesDelta,
    deliveryDelta,
    total,
  };
}
// If you don't already export gbp from here, include this:
export function gbp(n: number): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(n);
  } catch {
    return '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');
  }
}

/**
 * Extract a sensible base price from a WooCommerce product object.
 * Tries common fields across Store API / REST / variations.
 */
export function extractBasePrice(product: any): number {
  if (!product) return 0;

  const candidates = [
    product.price,
    product.regular_price,
    product.sale_price,
    product?.prices?.price,
    product?.prices?.regular_price,
    product?.prices?.sale_price,
    // occasionally present on first variation
    product?.variations?.[0]?.price,
    product?.variations?.[0]?.regular_price,
    product?.variations?.[0]?.sale_price,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}
// ---------------------------
// ADD THIS AT THE END OF FILE
// ---------------------------

type Deltas = {
  size: number;
  cloth: number;
  modelType: number;
  deliveryInstall: number;
  accessoryPack: number;
};

/**
 * Compute total using the resolved catalog + current selection.
 * Returns { total, deltas } where deltas are keyed to your step keys.
 */
export function computeTotal(
  catalog: any,
  sel: Selection,
  basePrice: number
): { total: number; deltas: Deltas } {
  // Size delta
  const szOpt = catalog?.size?.options?.find((o: any) => o.value === sel.size);
  const sizeDelta = Number(szOpt?.delta || 0);

  // Cloth family delta (colour itself usually £0, the family adds the cost)
  const fam = catalog?.cloth?.families?.find(
    (f: any) => f.value === sel.clothFamily
  );
  const clothDelta = Number(fam?.delta || 0);

  // Model type delta
  const mtOpt = catalog?.modelType?.options?.find(
    (o: any) => o.value === sel.modelType
  );
  const modelTypeDelta = Number(mtOpt?.delta || 0);

  // Delivery & Installation delta
  const diOpt = catalog?.deliveryInstall?.options?.find(
    (o: any) => o.value === sel.deliveryInstall
  );
  const deliveryInstallDelta = Number(diOpt?.delta || 0);

  // Accessory pack delta
  const apOpt = catalog?.accessoryPack?.options?.find(
    (o: any) => o.value === sel.accessoryPack
  );
  const accessoryPackDelta = Number(apOpt?.delta || 0);

  const deltas: Deltas = {
    size: sizeDelta,
    cloth: clothDelta,
    modelType: modelTypeDelta,
    deliveryInstall: deliveryInstallDelta,
    accessoryPack: accessoryPackDelta,
  };

  // If you later support accessoriesExtras with per-item deltas:
  // const extrasTotal = (sel.accessoriesExtras || []).reduce((sum, id) => {
  //   const ex = catalog?.accessories?.extras?.find((x: any) => x.value === id);
  //   return sum + Number(ex?.delta || 0);
  // }, 0);
  // deltas.accessoryPack += extrasTotal; // or split into a separate key if you prefer

  const total =
    Number(basePrice || 0) +
    deltas.size +
    deltas.cloth +
    deltas.modelType +
    deltas.deliveryInstall +
    deltas.accessoryPack;

  return { total, deltas };
}
