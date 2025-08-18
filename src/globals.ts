export type GlobalCloths = {
  families: Record<string, {
    label: string;
    info?: string;
    colours: { name: string; hex?: string; img?: string }[];
  }>;
};
export type GlobalAccessories = {
  packs: Record<string, { label: string; defaultDelta: number; contents?: string[] }>;
};
export type Globals = { cloths: GlobalCloths; accessories: GlobalAccessories };

type ModelClothRef = {
  ref: string; delta: number; label?: string;
  colours?: "*" | { include?: string[]; exclude?: string[] };
};
type ModelSpec = {
  model: string; label: string; currency?: string;
  finishes: { slug:string; label:string; product_id:number; eta?:string; thumb?:string }[];
  size: { label:string; options:{ value:'6ft'|'7ft'; label:string; delta:number }[] };
  cloth: { label:string; families: ModelClothRef[] } | any; // allow legacy
  modelType:{ label:string; options:{ value:string; label:string; delta:number }[] };
  deliveryInstall:{ label:string; options:{ value:string; label:string; delta:number }[] };
  accessoryPack:{ label:string; options:({ ref:string; delta?:number; label?:string }|any)[] };
};

export type ResolvedCatalog = {
  model:string; label:string; currency?:string;
  finishes: { slug:string; label:string; product_id:number; eta?:string; thumb?:string }[];
  size:{ label:string; options:{ value:'6ft'|'7ft'; label:string; delta:number }[] };
  cloth:{ label:string; families:{ value:string; label:string; delta:number; colours:string[]; swatches?:Record<string,{hex?:string; img?:string}>; info?:string }[] };
  modelType:{ label:string; options:{ value:string; label:string; delta:number }[] };
  deliveryInstall:{ label:string; options:{ value:string; label:string; delta:number }[] };
  accessoryPack:{ label:string; options:{ value:string; label:string; delta:number }[] };
};
export type RuntimeConfig = { model: string; isAdmin: boolean };

export function getRuntimeConfig(el: HTMLElement): RuntimeConfig {
  const d = el.dataset as DOMStringMap & { model?: string; isAdmin?: string };
  const model = (d.model || "supreme-winner").trim();
  const isAdmin = (d.isAdmin === "1") || (String(d.isAdmin).toLowerCase() === "true");
  return { model, isAdmin };
};
export async function fetchGlobals(): Promise<Globals> {
  const base =
    ((window as any).HPTD_CFG?.catalogBaseUrl || `${window.location.origin}/wp-content/uploads/hptd-catalog/`)
    + 'global/';
  const [cloths, accessories] = await Promise.all([
    fetch(`${base}cloths.json`, { credentials: 'same-origin' }).then(r=>r.json()),
    fetch(`${base}accessories.json`, { credentials: 'same-origin' }).then(r=>r.json()),
  ]);
  return { cloths, accessories };
}
function pickColours(rule: ModelClothRef['colours'], all: string[]) {
  if (rule === '*' || !rule) return all.slice();
  if (rule.include) return all.filter(n => rule.include!.includes(n));
  if (rule.exclude) return all.filter(n => !rule.exclude!.includes(n));
  return all.slice();
}
export function resolveCatalog(model: ModelSpec, g: Globals): ResolvedCatalog {
  // cloth
  let cloth: ResolvedCatalog['cloth'];
  if ((model as any).cloth?.families?.[0]?.value) {
    cloth = model.cloth as any; // legacy inline
  } else {
    const spec = model.cloth as { label:string; families: ModelClothRef[] };
    cloth = {
      label: spec.label,
      families: spec.families.map(f => {
        const gf = g.cloths.families[f.ref];
        const names = gf.colours.map(c => c.name);
        const colours = pickColours(f.colours, names);
        const swatches = Object.fromEntries(gf.colours.map(c => [c.name, { hex:c.hex, img:c.img }]));
        return { value:f.ref, label:f.label || gf.label, delta:f.delta, colours, swatches, info: gf.info };
      })
    };
  }
  // accessories
  const acc = model.accessoryPack;
  const accessoryPack = (acc.options[0] as any).ref
    ? {
        label: acc.label,
        options: (acc.options as any[]).map(o => {
          const gp = g.accessories.packs[o.ref];
          return { value:o.ref, label:o.label || gp.label, delta: typeof o.delta==='number' ? o.delta : gp.defaultDelta };
        })
      }
    : (acc as any);

  return {
    model: model.model,
    label: model.label,
    currency: model.currency || 'GBP',
    finishes: model.finishes,
    size: model.size,
    cloth,
    modelType: model.modelType,
    deliveryInstall: model.deliveryInstall,
    accessoryPack,
  };
}
