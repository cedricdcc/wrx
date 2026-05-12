import { RDF_ACCEPT } from './constants'
import { baseMime } from './utils'

function fetchWithRedirect(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, redirect: 'follow' });
}

function fetchRDF(url: string): Promise<Response> {
  return fetchWithRedirect(url, { headers: { Accept: RDF_ACCEPT } });
}

async function fetchHeadLinkHeader(url: string): Promise<string | null> {
  try {
    const res = await fetchWithRedirect(url, {
      method: 'HEAD',
      headers: { Accept: RDF_ACCEPT },
    });
    return res.headers.get('link');
  } catch {
    return null;
  }
}

async function fetchHtmlFallback(uri: string): Promise<{ body: string; linkHeader: string | null }> {
  try {
    const res = await fetchWithRedirect(uri, {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.3' },
    });
    if (res.ok) {
      const ct = baseMime(res.headers.get('content-type'));
      if (ct === 'text/html' || ct === 'application/xhtml+xml') {
        return { body: await res.text(), linkHeader: res.headers.get('link') };
      }
    }
  } catch {
    /* ignore */
  }
  return { body: '', linkHeader: null };
}

function fetchDescribedBy(url: string, declaredType?: string): Promise<Response> {
  if (!declaredType) return fetchRDF(url);
  const declared = declaredType.toLowerCase().trim();
  // If declared type is not RDF, fall back to generic RDF negotiation
  // (caller should guard, but be defensive here)
  // Build an Accept header with the declared type at q=1.0, all others below
  const others = [
    'text/turtle',
    'application/ld+json',
    'application/rdf+xml',
    'application/n-triples',
    'text/n3',
    'application/n-quads',
    'application/trig',
  ]
    .filter((m) => m !== declared)
    .map((m, i) => `${m};q=${Math.max(0.1, 0.9 - i * 0.1).toFixed(1)}`);
  const accept = [`${declared};q=1.0`, ...others].join(', ');
  return fetchWithRedirect(url, { headers: { Accept: accept } });
}

export { fetchWithRedirect, fetchRDF, fetchHeadLinkHeader, fetchHtmlFallback, fetchDescribedBy };
