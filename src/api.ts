import type { StoreProduct } from './types';

const MOUNT_ID = 'hptd-configurator';

// Read config safely (works even if window.HPTD_CFG is missing)
function getCfg() {
  const w: any = (window as any).HPTD_CFG || {};
  const el = document.getElementById(MOUNT_ID);

  const model = w.model || el?.getAttribute('data-model') || 'supreme-winner';

  const restUrl = (
    w.restUrl || new URL('/wp-json/hptd/v1/', window.location.origin).toString()
  ).replace(/\/?$/, '/');

  const storeApiUrl = (
    w.storeApiUrl ||
    new URL('/wp-json/wc/store/v1/', window.location.origin).toString()
  ).replace(/\/?$/, '/');

  const // allow overriding where the catalog files live (trailing slash optional)
    catalogBaseUrl: string =
      (w.catalogBaseUrl as string) ||
      `${window.location.origin}/wp-content/uploads/hptd-catalog/`;

  const nonce = w.nonce || '';
  const isAdmin = !!(w.isAdmin || el?.getAttribute('data-is-admin') === '1');

  return { model, restUrl, storeApiUrl, catalogBaseUrl, nonce, isAdmin };
}

/**
 * Build the URL to the model JSON.
 * Priority:
 *   1) data-catalog-url on the mount element (absolute or relative to current origin)
 *   2) window.HPTD_CFG.catalogBaseUrl + "models/<model>.json"
 *   3) default "/wp-content/uploads/hptd-catalog/models/<model>.json"
 */
export function catalogUrl(model?: string) {
  const el = document.getElementById(MOUNT_ID);
  const attrUrl = el?.getAttribute('data-catalog-url');
  if (attrUrl) {
    // If attrUrl is relative, URL() will resolve it against the current origin
    const absolute = new URL(attrUrl, window.location.origin).toString();
    console.log('[HPTD] catalogUrl: (data-catalog-url) →', absolute);
    return absolute;
  }

  const cfg = getCfg();
  const m = (model || cfg.model).trim();
  const base = cfg.catalogBaseUrl.endsWith('/')
    ? cfg.catalogBaseUrl
    : cfg.catalogBaseUrl + '/';
  const url = `${base}models/${m}.json`;

  console.log('[HPTD] catalogUrl (constructed):', url);
  return url;
}

/**
 * Fetch the catalog JSON at a given URL.
 * If it 404s and the path includes "/models/", we retry once without "models/" for
 * backwards compatibility with older folder layouts.
 */
export async function fetchCatalog<T = any>(url: string): Promise<T> {
  console.log('[HPTD] fetchCatalog →', url);
  const res = await fetch(url, { credentials: 'same-origin' });
  if (res.ok) return res.json();

  // Fallback: try without /models/ if that was part of the path
  if (res.status === 404 && url.includes('/models/')) {
    const fallback = url.replace('/models/', '/');
    console.warn(
      '[HPTD] fetchCatalog 404 → retrying without /models/:',
      fallback
    );
    const res2 = await fetch(fallback, { credentials: 'same-origin' });
    if (res2.ok) return res2.json();
    const text2 = await res2.text().catch(() => '');
    throw new Error(
      `Catalog fetch failed (fallback): ${res2.status} ${text2?.slice(0, 120)}`
    );
  }

  const text = await res.text().catch(() => '');
  throw new Error(`Catalog fetch failed: ${res.status} ${text?.slice(0, 120)}`);
}

export async function fetchProduct(productId: number): Promise<StoreProduct> {
  const { storeApiUrl } = getCfg();
  const url = `${storeApiUrl}products/${productId}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok)
    throw new Error(`Product ${productId} fetch failed: ${res.status}`);
  return res.json();
}

export async function addToCart(payload: any) {
  const { restUrl, nonce } = getCfg();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (nonce) headers['X-WP-Nonce'] = nonce; // route allows guests; nonce optional
  const res = await fetch(`${restUrl}add-to-cart`, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Add to cart failed: ${res.status}`);
  return res.json();
}

export async function createQuote(payload: any) {
  const { restUrl, nonce } = getCfg();
  if (!nonce) throw new Error('Authentication missing (no REST nonce).');
  const res = await fetch(`${restUrl}create-quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce,
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create quote failed: ${res.status}`);
  return res.json();
}

// (Optional) export whether admin+nonce is available
export const env = {
  get isAdmin() {
    return getCfg().isAdmin;
  },
  get hasNonce() {
    return !!getCfg().nonce;
  },
};
