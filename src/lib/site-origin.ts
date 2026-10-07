/** One origin for canonical URLs, sitemaps and structured data. */
export function normalizeSiteOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment.');
  }
  url.hostname = url.hostname.replace(/\.$/, '');
  return url.origin;
}

export function isPublicHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(normalizeSiteOrigin(value));
    const hostname = url.hostname;
    const localHost = ['localhost', 'local', 'test', 'invalid', 'example'].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
    const ipAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[');
    const domain = hostname.includes('.') && hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    return url.protocol === 'https:' && domain && !localHost && !ipAddress;
  } catch {
    return false;
  }
}

export const siteUrl = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
export const preventIndexing = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.SITE_NOINDEX === 'true' || !isPublicHttpsOrigin(siteUrl);
