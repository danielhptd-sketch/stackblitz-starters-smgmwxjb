import React, { useEffect, useMemo, useState } from 'react';
import type { Catalog, Selection, StoreProduct, StepKey } from './types';
import {
  catalogUrl,
  fetchCatalog,
  fetchProduct,
  addToCart,
  createQuote,
} from './api';
import { computeTotal, extractBasePrice, gbp } from './pricing';
import LeftSteps from './components/LeftSteps';
import SelectCard from './components/SelectCard';
import { FinishDropdown } from './components/FinishDropdown';
import { fetchGlobals, resolveCatalog, type ResolvedCatalog } from './globals';

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finOpen, setFinOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const rootEl = document.getElementById('hptd-configurator');
  const isAdmin = rootEl?.getAttribute('data-is-admin') === '1';

  function makeStepMeta(
    c: Catalog
  ): Record<StepKey, { label: string; sub: string }> {
    return {
      size: { label: c.size.label, sub: 'Choose your size' },
      cloth: {
        label: c.cloth.label || 'Playing Surface',
        sub: 'Select cloth type',
      },
      modelType: { label: c.modelType.label, sub: 'Model options' },
      deliveryInstall: {
        label: c.deliveryInstall.label,
        sub: 'Delivery & install',
      },
      accessoryPack: { label: c.accessoryPack.label, sub: 'Optional' },
      details: { label: 'Details', sub: 'Corners & legs' },
      tops: { label: 'Table Tops', sub: 'Add a dining top' },
    };
  }

  // Load catalog (model spec) + globals, then resolve refs
  useEffect(() => {
    const url = catalogUrl();
    Promise.all([fetchCatalog<any>(url), fetchGlobals()])
      .then(([modelSpec, globals]) => {
        const resolved = resolveCatalog(modelSpec, globals) as ResolvedCatalog;
        setCatalog(resolved as any);
        setSel({
          finishSlug: resolved.finishes[0]?.slug || '',
          size: resolved.size.options[0]?.value || '6ft',
          clothFamily: resolved.cloth.families[0]?.value || '',
          clothColour: resolved.cloth.families[0]?.colours[0] || '',
          modelType: resolved.modelType.options[0]?.value || '',
          deliveryInstall: resolved.deliveryInstall.options[0]?.value || '',
          accessoryPack: resolved.accessoryPack.options[0]?.value || 'free',
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load product when finish changes
  useEffect(() => {
    if (!catalog || !sel) return;
    const fin = catalog.finishes.find((f) => f.slug === sel.finishSlug);
    if (!fin) return;
    setLoading(true);
    fetchProduct(fin.product_id)
      .then((p) => {
        setProduct(p);
        setBasePrice(extractBasePrice(p));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [catalog, sel?.finishSlug]);

  const priceState = useMemo(() => {
    if (!catalog || !sel) {
      return {
        total: 0,
        deltas: {
          size: 0,
          cloth: 0,
          modelType: 0,
          deliveryInstall: 0,
          accessoryPack: 0,
        },
      } as any;
    }
    return computeTotal(catalog, sel, basePrice);
  }, [catalog, sel, basePrice]);

  if (error)
    return (
      <div className="hptd-wrap">
        <div className="card" style={{ padding: 12 }}>
          Error: {error}
        </div>
      </div>
    );
  if (!catalog || !sel)
    return (
      <div className="hptd-wrap">
        <div className="card" style={{ padding: 12 }}>
          Loading…
        </div>
      </div>
    );

  const fin = catalog.finishes.find((f) => f.slug === sel.finishSlug)!;
  const images = product?.images ?? [];
  const eta = fin.eta || '';

  // helpers
  const setField = <K extends keyof Selection>(key: K, value: Selection[K]) =>
    setSel({ ...(sel as Selection), [key]: value });

  const currentFamily =
    catalog.cloth.families.find((f) => f.value === sel.clothFamily) ||
    catalog.cloth.families[0];

  // Dynamic flow (always include Delivery & Installation as a regular step)
  const order: StepKey[] = catalog.flow?.steps?.length
    ? (catalog.flow!.steps as StepKey[])
    : ([
        'size',
        'cloth',
        'modelType',
        'deliveryInstall',
        'accessoryPack',
      ] as StepKey[]);

  const meta = makeStepMeta(catalog);
  const deliveryInSidebar = catalog.flow?.deliveryPlacement === 'sidebar';
  const stepKeys = order;
  useEffect(() => {
    if (stepIndex > stepKeys.length - 1) {
      setStepIndex(stepKeys.length - 1);
    }
  }, [stepKeys.length]);
  // Left panel steps list
  const leftSteps = stepKeys.map((k) => ({
    key: k,
    label: meta[k].label,
    sub: meta[k].sub,
  }));
  const currentKey = stepKeys[stepIndex];
  const completedKeys = new Set(stepKeys.filter((k) => stepCompleteByKey(k)));

  function stepCompleteByKey(k: StepKey) {
    if (!sel) return false;
    switch (k) {
      case 'size':
        return !!sel.size;
      case 'cloth':
        return !!(sel.clothFamily && sel.clothColour);
      case 'modelType':
        return !!sel.modelType;
      case 'deliveryInstall':
        return !!sel.deliveryInstall;
      case 'accessoryPack':
        return !!sel.accessoryPack;
      case 'details':
      case 'tops':
        return true; // placeholders
      default:
        return false;
    }
  }
  const allComplete = stepKeys.every(stepCompleteByKey);

  async function doAddToCart() {
    try {
      const payload = {
        product_id: fin.product_id,
        quantity: 1,
        meta: {
          hptd_model: catalog.label,
          hptd_finish: fin.label,
          hptd_size: sel.size,
          hptd_cloth_family:
            (catalog.cloth.families.find((f) => f.value === sel.clothFamily)
              ?.label as string) || sel.clothFamily,
          hptd_cloth_colour: sel.clothColour,
          hptd_model_type:
            (catalog.modelType.options.find((o) => o.value === sel.modelType)
              ?.label as string) || sel.modelType,
          hptd_delivery_install:
            (catalog.deliveryInstall.options.find(
              (o) => o.value === sel.deliveryInstall
            )?.label as string) || sel.deliveryInstall,
          hptd_accessory_pack:
            (catalog.accessoryPack.options.find(
              (o) => o.value === sel.accessoryPack
            )?.label as string) || sel.accessoryPack,
          hptd_eta: eta,
          hptd_price_breakdown: JSON.stringify({
            base: basePrice,
            ...priceState.deltas,
            total: priceState.total,
          }),
          hptd_computed_total: priceState.total,
          hptd_config_snapshot: JSON.stringify(sel),
        },
      };
      await addToCart(payload);
      window.location.href = '/cart/';
    } catch (e: any) {
      alert(e.message || 'Add to cart failed');
    }
  }

  async function handleCreateQuote() {
    try {
      const res = await createQuote({
        product_id: fin.product_id,
        quantity: 1,
        meta: {
          hptd_model: catalog.label,
          hptd_finish: fin.label,
          hptd_size: sel.size,
          hptd_cloth_family:
            (catalog.cloth.families.find((f) => f.value === sel.clothFamily)
              ?.label as string) || sel.clothFamily,
          hptd_cloth_colour: sel.clothColour,
          hptd_model_type:
            (catalog.modelType.options.find((o) => o.value === sel.modelType)
              ?.label as string) || sel.modelType,
          hptd_delivery_install:
            (catalog.deliveryInstall.options.find(
              (o) => o.value === sel.deliveryInstall
            )?.label as string) || sel.deliveryInstall,
          hptd_accessory_pack:
            (catalog.accessoryPack.options.find(
              (o) => o.value === sel.accessoryPack
            )?.label as string) || sel.accessoryPack,
          hptd_eta: eta,
          hptd_price_breakdown: JSON.stringify({
            base: basePrice,
            ...priceState.deltas,
            total: priceState.total,
          }),
          hptd_computed_total: priceState.total,
          hptd_config_snapshot: JSON.stringify(sel),
        },
      });
      if (res?.order_edit_url) window.location.href = res.order_edit_url;
    } catch (e: any) {
      alert(e.message || 'Create quote failed');
    }
  }

  return (
    <div className="hptd-wrap">
      <div className="hptd-grid3">
        {/* LEFT: Steps */}
        <LeftSteps
          steps={leftSteps}
          activeKey={currentKey}
          total={priceState.total}
          completedKeys={completedKeys}
        />

        {/* CENTER: Hero + Finish dropdown + Gallery */}
        <section className="centerPane card">
          <FinishDropdown
            label={fin.label}
            open={finOpen}
            onToggle={() => setFinOpen((v) => !v)}
          >
            <div className="finishesGrid">
              {catalog.finishes.map((fx) => (
                <button
                  key={fx.slug}
                  className={`finishTile ${
                    sel.finishSlug === fx.slug ? 'active' : ''
                  }`}
                  onClick={() => {
                    setField('finishSlug', fx.slug);
                    setFinOpen(false);
                  }}
                >
                  <div className="thumb">
                    {fx.thumb ? (
                      <img src={fx.thumb} alt="" />
                    ) : (
                      fx.label.slice(0, 1)
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{fx.label}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {fx.eta ? `ETA ${fx.eta}` : 'ETA TBC'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </FinishDropdown>

          <div className="hero">
            {images[0] ? (
              <img src={images[0].src} alt={images[0].alt || fin.label} />
            ) : (
              <div
                className="muted"
                style={{ padding: 40, textAlign: 'center' }}
              >
                No image
              </div>
            )}
            <div className="tags">
              <span className="tag">{sel.size}</span>
              <span className="tag">
                {(
                  catalog.cloth.families.find(
                    (f) => f.value === sel.clothFamily
                  ) || {}
                ).label || sel.clothFamily}
              </span>
              <span className="tag">{sel.clothColour}</span>
            </div>
            <div className="pricechip">{gbp(priceState.total)}</div>
          </div>

          {images.length > 1 && (
            <div className="gallery">
              {images.slice(1, 8).map((img) => (
                <img key={img.id} src={img.src} alt={img.alt || ''} />
              ))}
            </div>
          )}
        </section>

        {/* RIGHT: Step panel */}
        <section className="rightPane card">
          {/* Size */}
          {currentKey === 'size' && (
            <div>
              <div className="sectionTitle">
                <h3>{meta.size.label}</h3>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {catalog.size.options.map((o) => (
                  <SelectCard
                    key={o.value}
                    active={sel.size === o.value}
                    onClick={() => setField('size', o.value)}
                    right={<span>{gbp(basePrice + (o.delta || 0))}</span>}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{o.label}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.value === '6ft' ? '6ft x 3ft' : '7ft x 3.5ft'}
                      </div>
                    </div>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {/* Cloth */}
          {currentKey === 'cloth' && (
            <div>
              <div className="sectionTitle">
                <h3>{meta.cloth.label}</h3>
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 8 }}>
                {catalog.cloth.families.map((fx) => (
                  <SelectCard
                    key={fx.value}
                    active={sel.clothFamily === fx.value}
                    onClick={() =>
                      setSel({
                        ...(sel as Selection),
                        clothFamily: fx.value,
                        clothColour: fx.colours[0] || '',
                      })
                    }
                    right={
                      fx.delta ? (
                        <span>{`+${gbp(fx.delta)}`}</span>
                      ) : (
                        <span className="muted">Standard</span>
                      )
                    }
                  >
                    <div style={{ fontWeight: 700 }}>{fx.label}</div>
                  </SelectCard>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {currentFamily.colours.map((c) => (
                  <button
                    key={c}
                    className={`sw ${sel.clothColour === c ? 'active' : ''}`}
                    title={c}
                    onClick={() => setField('clothColour', c)}
                  >
                    <span
                      style={{
                        background: currentFamily.swatches?.[c]?.hex || '#ccc',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Model Type */}
          {currentKey === 'modelType' && (
            <div>
              <div className="sectionTitle">
                <h3>{meta.modelType.label}</h3>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {catalog.modelType.options.map((o) => (
                  <SelectCard
                    key={o.value}
                    active={sel.modelType === o.value}
                    onClick={() => setField('modelType', o.value)}
                    right={
                      o.delta ? (
                        <span>{`+${gbp(o.delta)}`}</span>
                      ) : (
                        <span className="muted">Standard</span>
                      )
                    }
                  >
                    <div style={{ fontWeight: 700 }}>{o.label}</div>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {/* Delivery & Installation (always a normal step) */}
          {currentKey === 'deliveryInstall' && (
            <div>
              <div className="sectionTitle">
                <h3>{meta.deliveryInstall.label}</h3>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {catalog.deliveryInstall.options.map((o) => (
                  <SelectCard
                    key={o.value}
                    active={sel.deliveryInstall === o.value}
                    onClick={() => setField('deliveryInstall', o.value)}
                    right={
                      o.delta ? (
                        <span>{`+${gbp(o.delta)}`}</span>
                      ) : (
                        <span className="muted">Included</span>
                      )
                    }
                  >
                    <div style={{ fontWeight: 700 }}>{o.label}</div>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {/* Accessories */}
          {currentKey === 'accessoryPack' && (
            <div>
              <div className="sectionTitle">
                <h3>{meta.accessoryPack.label}</h3>
                <span className="muted">Optional</span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {catalog.accessoryPack.options.map((o) => (
                  <SelectCard
                    key={o.value}
                    active={sel.accessoryPack === o.value}
                    onClick={() => setField('accessoryPack', o.value)}
                    right={
                      o.delta ? (
                        <span>{`+${gbp(o.delta)}`}</span>
                      ) : (
                        <span className="muted">Included</span>
                      )
                    }
                  >
                    <div style={{ fontWeight: 700 }}>{o.label}</div>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {/* Step controls + summary */}
          <div style={{ marginTop: 12 }}>
            <div className="stepctrl">
              <button
                className="btn"
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                disabled={stepIndex === 0}
              >
                ← Back
              </button>

              {stepIndex < stepKeys.length - 1 && (
                <button
                  className="btn primary"
                  onClick={() =>
                    setStepIndex((s) => Math.min(stepKeys.length - 1, s + 1))
                  }
                  disabled={!stepCompleteByKey(currentKey)}
                >
                  Next →
                </button>
              )}

              {stepIndex === stepKeys.length - 1 && (
                <button
                  className="btn primary"
                  onClick={doAddToCart}
                  disabled={!allComplete}
                >
                  Add to Cart
                </button>
              )}
            </div>

            {/* Base & total */}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div className="muted">Table:</div>
              <div>{gbp(basePrice)}</div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              <div>Total:</div>
              <div>{gbp(priceState.total)}</div>
            </div>

            {isAdmin && (
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={handleCreateQuote}>
                  Create Quote
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
