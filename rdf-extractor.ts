// rdf-extractor.ts
// TypeScript module for Bun to extract RDF from a URI following the specified strategy.
// Run with: bun run rdf-extractor.ts (or import the function in your Bun project)
// No external dependencies — uses only built-in Bun/fetch + DOMParser (available in Bun).

export interface ExtractedRDF {
  /** The raw RDF content (as string) */
  content: string;
  /** The Content-Type / MIME of the RDF (e.g. "text/turtle", "application/ld+json") */
  format: string;
  /** Where the RDF was obtained from */
  source:
    | 'content-negotiation'
    | 'signposting-link-header'
    | 'signposting-html-link'
    | 'embedded-script'
    | 'linkset'
    | 'sitemap-signposting';
  /** The URL the RDF was ultimately fetched from */
  url: string;
}

/** MIME types we consider valid RDF serializations */
const RDF_MIMES = new Set([
  'text/turtle',
  'application/ld+json',
  'application/rdf+xml',
  'application/n-triples',
  'text/n3',
  'application/n-quads',
]);

/** Preferred Accept header for content negotiation */
const RDF_ACCEPT = [
  'text/turtle;q=1.0',
  'application/ld+json;q=0.9',
  'application/rdf+xml;q=0.8',
  'application/n-triples;q=0.7',
  'text/n3;q=0.6',
].join(', ');

/** Simple but robust Link header parser (handles both HTTP Link and application/linkset) */
function parseLinkHeader(header: string | null): Array<{ url: string; [key: string]: string }> {
  if (!header?.trim()) return [];
  return header
    .split(',')
    .map((part) => {
      part = part.trim();
      const urlMatch = part.match(/<([^>]+)>/);
      if (!urlMatch) return null;
      const url = urlMatch[1] ?? '';
      if (!url) return null;
      const link: { url: string; [key: string]: string } = { url };
      const paramsPart = part.substring(part.indexOf('>') + 1).trim();
      if (paramsPart) {
        const paramParts = paramsPart.split(';').map((p) => p.trim()).filter(Boolean);
        for (const p of paramParts) {
          const eqIndex = p.indexOf('=');
          if (eqIndex === -1) continue;
          const key = p.slice(0, eqIndex).trim().toLowerCase();
          let val = p.slice(eqIndex + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          link[key] = val;
        }
      }
      return link;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
}

/** Check if a MIME type is RDF */
function isRDFMime(mime: string): boolean {
  return RDF_MIMES.has(mime.toLowerCase().trim());
}

/** Extract the base MIME type (before any parameters) from a Content-Type header value */
function baseMime(contentType: string | null): string {
  if (!contentType) return '';
  const semi = contentType.indexOf(';');
  return (semi === -1 ? contentType : contentType.slice(0, semi)).trim().toLowerCase();
}

function relHasToken(rel: string | null | undefined, token: string): boolean {
  if (!rel) return false;
  return rel
    .toLowerCase()
    .split(/\s+/)
    .some((r) => r.trim() === token);
}

function parseTagAttributes(tagText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagText)) !== null) {
    const key = (match[1] ?? '').toLowerCase();
    const val = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (key) attrs[key] = val;
  }
  return attrs;
}

function extractHtmlHints(bodyText: string): {
  describedByLinks: Array<{ href: string; type: string | null }>;
  linksets: string[];
  embeddedScripts: Array<{ type: string; content: string }>;
} {
  const describedByLinks: Array<{ href: string; type: string | null }> = [];
  const linksets: string[] = [];
  const embeddedScripts: Array<{ type: string; content: string }> = [];

  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(bodyText)) !== null) {
    const tag = linkMatch[0] ?? '';
    if (!tag) continue;
    const attrs = parseTagAttributes(tag);
    const rel = attrs['rel'] ?? null;
    const href = attrs['href'] ?? null;
    const type = attrs['type'] ?? null;
    if (!href) continue;
    if (relHasToken(rel, 'describedby')) {
      describedByLinks.push({ href, type });
    }
    if (relHasToken(rel, 'linkset')) {
      linksets.push(href);
    }
  }

  const scriptRegex = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(bodyText)) !== null) {
    const openTag = scriptMatch[1] ?? '';
    const content = (scriptMatch[2] ?? '').trim();
    if (!openTag || !content) continue;
    const attrs = parseTagAttributes(openTag);
    const type = (attrs['type'] ?? '').toLowerCase();
    if (type) embeddedScripts.push({ type, content });
  }

  return { describedByLinks, linksets, embeddedScripts };
}

/** Fetch a URL with RDF content negotiation */
async function fetchRDF(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: RDF_ACCEPT },
    redirect: 'follow',
  });
}

/**
 * Fetch a describedby URL, prioritising the declared RDF type from the linkset.
 * When the linkset declares a specific type (e.g. "application/ld+json"), sending
 * that type first maximises the chance of receiving the right content type back.
 */
async function fetchDescribedBy(url: string, declaredType?: string): Promise<Response> {
  if (!declaredType || !isRDFMime(declaredType)) return fetchRDF(url);
  // Build an Accept header with the declared type at q=1.0, all others below
  const others = ['text/turtle', 'application/ld+json', 'application/rdf+xml', 'application/n-triples', 'text/n3']
    .filter((m) => m !== declaredType)
    .map((m, i) => `${m};q=${Math.max(0.1, 0.9 - i * 0.1).toFixed(1)}`);
  const accept = [`${declaredType};q=1.0`, ...others].join(', ');
  return fetch(url, { headers: { Accept: accept }, redirect: 'follow' });
}

/**
 * Return true if the text parses as JSON and contains JSON-LD indicators
 * (@context, @type, or @graph at the top level).
 * Used to accept responses with Content-Type: application/json that are
 * actually JSON-LD (common with some InvenioRDM / Zenodo endpoints).
 */
function looksLikeJsonLd(text: string): boolean {
  try {
    const obj = JSON.parse(text) as unknown;
    // Handle both plain objects and top-level arrays (valid JSON-LD containers)
    const records = Array.isArray(obj) ? obj : [obj];
    return records.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        ('@context' in (item as Record<string, unknown>) ||
          '@type' in (item as Record<string, unknown>) ||
          '@graph' in (item as Record<string, unknown>))
    );
  } catch {
    return false;
  }
}

/**
 * Determine the effective RDF MIME type for a describedby response.
 *
 * Rules (in order):
 * 1. If the response Content-Type is already a known RDF MIME, use it.
 * 2. If the linkset declared an RDF type AND the response came back as
 *    application/json AND the body looks like JSON-LD, trust the declaration.
 *
 * Returns the MIME string, or null if the response is not recognisable as RDF.
 */
function resolveRdfFormat(
  responseCt: string,
  declaredType: string | undefined,
  body: string
): string | null {
  if (isRDFMime(responseCt)) return responseCt;
  if (
    declaredType &&
    isRDFMime(declaredType) &&
    responseCt === 'application/json' &&
    looksLikeJsonLd(body)
  ) {
    return declaredType;
  }
  return null;
}

/**
 * Normalise a URI for anchor comparison:
 * lower-case and remove a trailing slash so that
 * "https://example.org/foo" and "https://example.org/foo/" compare equal.
 */
function normUri(u: string): string {
  return u.toLowerCase().replace(/\/$/, '');
}

/** Try to extract RDF from a linkset (application/linkset+json or application/linkset) */
async function tryExtractFromLinkset(
  linksetUrl: string,
  baseUri: string
): Promise<ExtractedRDF | null> {
  const acceptLinkset = 'application/linkset+json;q=1.0, application/linkset;q=0.9';
  let res: Response;
  try {
    res = await fetch(linksetUrl, { headers: { Accept: acceptLinkset }, redirect: 'follow' });
    if (!res.ok) return null;
  } catch {
    return null;
  }

  const ct = baseMime(res.headers.get('content-type'));

  // Handle application/linkset+json.
  // Also accept application/json as a fallback for servers that don't set the exact CT.
  if (ct === 'application/linkset+json' || ct === 'application/json') {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    const typedData = data as { linkset?: Array<Record<string, unknown>> } | null;
    // Guard: only proceed if the body actually has a 'linkset' array
    if (!Array.isArray(typedData?.linkset)) return null;
    const allCtxs = typedData.linkset;

    // RFC 9264 §4.2: prefer the entry whose anchor matches the requested URI;
    // fall back to all entries when no match is found.
    const baseNorm = normUri(baseUri);
    const matchedCtxs = allCtxs.filter((ctx) => {
      const anchor = typeof ctx['anchor'] === 'string' ? normUri(ctx['anchor'] as string) : null;
      return anchor === baseNorm;
    });
    const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs;

    for (const ctx of contexts) {
      // 1. describedby / profile relations
      for (const rel of ['describedby', 'profile'] as const) {
        const targets = Array.isArray(ctx[rel])
          ? (ctx[rel] as Array<{ href?: string; type?: string }>)
          : [];
        for (const target of targets) {
          if (!target.href) continue;
          // Skip if the declared type is set and is clearly not RDF
          if (target.type && !isRDFMime(target.type)) continue;
          const metaUrl = new URL(target.href, linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, target.type);
            if (!metaRes.ok) continue;
            const metaCt = baseMime(metaRes.headers.get('content-type'));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, target.type, body);
            if (format) return { content: body, format, source: 'linkset', url: metaUrl };
          } catch { /* skip this target */ }
        }
      }

      // 2. cite-as content-negotiation fallback: try the canonical URI (e.g. DOI)
      const citeAsArr = Array.isArray(ctx['cite-as'])
        ? (ctx['cite-as'] as Array<{ href?: string }>)
        : [];
      for (const citeAs of citeAsArr) {
        if (!citeAs.href) continue;
        const doiUrl = new URL(citeAs.href, linksetUrl).toString();
        try {
          const doiRes = await fetchRDF(doiUrl);
          if (!doiRes.ok) continue;
          const doiCt = baseMime(doiRes.headers.get('content-type'));
          if (isRDFMime(doiCt)) {
            return { content: await doiRes.text(), format: doiCt, source: 'linkset', url: doiUrl };
          }
        } catch { /* skip */ }
      }
    }
  } else if (ct === 'application/linkset') {
    let text = await res.text();
    // Normalize whitespace (RFC 9264 allows newlines/tabs for readability)
    text = text.replace(/[\r\n\t]+/g, ' ');
    const links = parseLinkHeader(text);
    // RFC 9264 §4.1: filter by anchor when present
    const baseNorm = normUri(baseUri);
    for (const link of links) {
      // If anchor is set, it must match the requested URI
      if (link['anchor'] && normUri(link['anchor']) !== baseNorm) continue;
      if ((link['rel'] === 'describedby' || link['rel'] === 'profile') && link['url']) {
        const declaredType = link['type'];
        if (declaredType && !isRDFMime(declaredType)) continue;
        const metaUrl = new URL(link['url'], linksetUrl).toString();
        try {
          const metaRes = await fetchDescribedBy(metaUrl, declaredType);
          if (!metaRes.ok) continue;
          const metaCt = baseMime(metaRes.headers.get('content-type'));
          const body = await metaRes.text();
          const format = resolveRdfFormat(metaCt, declaredType, body);
          if (format) return { content: body, format, source: 'linkset', url: metaUrl };
        } catch { /* skip */ }
      }
    }
  }
  return null;
}

/** Fallback: parse robots.txt → sitemap.xml → look for the URI and any embedded FAIR signposting */
async function tryExtractFromSitemapAndDCAT(uri: string): Promise<ExtractedRDF | null> {
  let urlObj: URL;
  try {
    urlObj = new URL(uri);
  } catch {
    return null;
  }

  const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  let robotsText: string;
  try {
    const res = await fetch(robotsUrl);
    if (!res.ok) return null;
    robotsText = await res.text();
  } catch {
    return null;
  }

  const sitemaps: string[] = [];
  for (const line of robotsText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('sitemap:')) {
      const sUrl = trimmed.slice(8).trim();
      if (sUrl) sitemaps.push(sUrl);
    }
  }

  for (const sitemapUrl of sitemaps) {
    let sText: string;
    try {
      const res = await fetch(sitemapUrl);
      if (!res.ok) continue;
      sText = await res.text();
    } catch {
      continue;
    }

    let xmlDoc: Document;
    try {
      xmlDoc = new DOMParser().parseFromString(sText, 'text/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) continue;
    } catch {
      continue;
    }

    const urlElements = xmlDoc.getElementsByTagName('url');
    for (const urlEl of urlElements) {
      const locEl = urlEl.getElementsByTagName('loc')[0];
      if (!locEl) continue;
      const loc = locEl.textContent?.trim();
      // Loose matching (handles trailing slash differences)
      if (loc === uri || loc === uri + '/' || uri === loc + '/') {
        // Look for FAIR signposting inside the sitemap entry (xhtml:link rel="describedby")
        const xhtmlNs = 'http://www.w3.org/1999/xhtml';
        const xLinks = urlEl.getElementsByTagNameNS(xhtmlNs, 'link');
        for (const xLink of xLinks) {
          const rel = xLink.getAttribute('rel');
          const type = xLink.getAttribute('type');
          const href = xLink.getAttribute('href');
          if (rel === 'describedby' && href && (!type || isRDFMime(type))) {
            const metaUrl = new URL(href, sitemapUrl).toString();
            const metaRes = await fetchRDF(metaUrl);
            const metaCt = baseMime(metaRes.headers.get('content-type'));
            if (isRDFMime(metaCt) && metaRes.ok) {
              return {
                content: await metaRes.text(),
                format: metaCt,
                source: 'sitemap-signposting',
                url: metaUrl,
              };
            }
          }
        }
      }
    }
  }
  return null;
}

/** Overview of all RDF sources discovered across every extraction strategy */
export interface RDFOverview {
  /** All RDF sources that were successfully extracted */
  found: ExtractedRDF[];
  /** Names of strategies that were tried but yielded no RDF */
  notFound: Array<ExtractedRDF['source']>;
}

/** Collect ALL RDF hits from a linkset (does not stop on first success) */
async function tryExtractAllFromLinkset(
  linksetUrl: string,
  baseUri: string
): Promise<ExtractedRDF[]> {
  const results: ExtractedRDF[] = [];
  const acceptLinkset = 'application/linkset+json;q=1.0, application/linkset;q=0.9';
  let res: Response;
  try {
    res = await fetch(linksetUrl, { headers: { Accept: acceptLinkset }, redirect: 'follow' });
    if (!res.ok) return results;
  } catch {
    return results;
  }

  const ct = baseMime(res.headers.get('content-type'));

  if (ct === 'application/linkset+json' || ct === 'application/json') {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return results;
    }
    const typedData = data as { linkset?: Array<Record<string, unknown>> } | null;
    if (!Array.isArray(typedData?.linkset)) return results;
    const allCtxs = typedData.linkset;

    const baseNorm = normUri(baseUri);
    const matchedCtxs = allCtxs.filter((ctx) => {
      const anchor = typeof ctx['anchor'] === 'string' ? normUri(ctx['anchor'] as string) : null;
      return anchor === baseNorm;
    });
    const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs;

    for (const ctx of contexts) {
      for (const rel of ['describedby', 'profile'] as const) {
        const targets = Array.isArray(ctx[rel])
          ? (ctx[rel] as Array<{ href?: string; type?: string }>)
          : [];
        for (const target of targets) {
          if (!target.href) continue;
          if (target.type && !isRDFMime(target.type)) continue;
          const metaUrl = new URL(target.href, linksetUrl).toString();
          try {
            const metaRes = await fetchDescribedBy(metaUrl, target.type);
            if (!metaRes.ok) continue;
            const metaCt = baseMime(metaRes.headers.get('content-type'));
            const body = await metaRes.text();
            const format = resolveRdfFormat(metaCt, target.type, body);
            if (format) results.push({ content: body, format, source: 'linkset', url: metaUrl });
          } catch {
            // skip this target
          }
        }
      }

      // cite-as fallback
      const citeAsArr = Array.isArray(ctx['cite-as'])
        ? (ctx['cite-as'] as Array<{ href?: string }>)
        : [];
      for (const citeAs of citeAsArr) {
        if (!citeAs.href) continue;
        const doiUrl = new URL(citeAs.href, linksetUrl).toString();
        try {
          const doiRes = await fetchRDF(doiUrl);
          if (!doiRes.ok) continue;
          const doiCt = baseMime(doiRes.headers.get('content-type'));
          if (isRDFMime(doiCt)) {
            results.push({ content: await doiRes.text(), format: doiCt, source: 'linkset', url: doiUrl });
          }
        } catch { /* skip */ }
      }
    }
  } else if (ct === 'application/linkset') {
    let text = await res.text();
    text = text.replace(/[\r\n\t]+/g, ' ');
    const links = parseLinkHeader(text);
    const baseNorm = normUri(baseUri);
    for (const link of links) {
      if (link['anchor'] && normUri(link['anchor']) !== baseNorm) continue;
      if ((link['rel'] === 'describedby' || link['rel'] === 'profile') && link['url']) {
        const declaredType = link['type'];
        if (declaredType && !isRDFMime(declaredType)) continue;
        const metaUrl = new URL(link['url'], linksetUrl).toString();
        try {
          const metaRes = await fetchDescribedBy(metaUrl, declaredType);
          if (!metaRes.ok) continue;
          const metaCt = baseMime(metaRes.headers.get('content-type'));
          const body = await metaRes.text();
          const format = resolveRdfFormat(metaCt, declaredType, body);
          if (format) results.push({ content: body, format, source: 'linkset', url: metaUrl });
        } catch {
          // skip this link
        }
      }
    }
  }
  return results;
}

/** Collect ALL RDF hits from robots.txt → sitemap.xml → xhtml:link signposting */
async function tryExtractAllFromSitemapAndDCAT(uri: string): Promise<ExtractedRDF[]> {
  const results: ExtractedRDF[] = [];
  let urlObj: URL;
  try {
    urlObj = new URL(uri);
  } catch {
    return results;
  }

  const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
  let robotsText: string;
  try {
    const res = await fetch(robotsUrl);
    if (!res.ok) return results;
    robotsText = await res.text();
  } catch {
    return results;
  }

  const sitemaps: string[] = [];
  for (const line of robotsText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('sitemap:')) {
      const sUrl = trimmed.slice(8).trim();
      if (sUrl) sitemaps.push(sUrl);
    }
  }

  for (const sitemapUrl of sitemaps) {
    let sText: string;
    try {
      const res = await fetch(sitemapUrl);
      if (!res.ok) continue;
      sText = await res.text();
    } catch {
      continue;
    }

    let xmlDoc: Document;
    try {
      xmlDoc = new DOMParser().parseFromString(sText, 'text/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) continue;
    } catch {
      continue;
    }

    const urlElements = xmlDoc.getElementsByTagName('url');
    for (const urlEl of urlElements) {
      const locEl = urlEl.getElementsByTagName('loc')[0];
      if (!locEl) continue;
      const loc = locEl.textContent?.trim();
      if (loc === uri || loc === uri + '/' || uri === loc + '/') {
        const xhtmlNs = 'http://www.w3.org/1999/xhtml';
        const xLinks = urlEl.getElementsByTagNameNS(xhtmlNs, 'link');
        for (const xLink of xLinks) {
          const rel = xLink.getAttribute('rel');
          const type = xLink.getAttribute('type');
          const href = xLink.getAttribute('href');
          if (rel === 'describedby' && href && (!type || isRDFMime(type))) {
            const metaUrl = new URL(href, sitemapUrl).toString();
            try {
              const metaRes = await fetchRDF(metaUrl);
              const metaCt = baseMime(metaRes.headers.get('content-type'));
              if (isRDFMime(metaCt) && metaRes.ok) {
                results.push({
                  content: await metaRes.text(),
                  format: metaCt,
                  source: 'sitemap-signposting',
                  url: metaUrl,
                });
              }
            } catch {
              // skip this link
            }
          }
        }
      }
    }
  }
  return results;
}

/**
 * Explores ALL extraction paths and returns every RDF source found.
 * Unlike extractRDF(), this does NOT short-circuit on the first success.
 */
export async function extractAllRDF(uri: string): Promise<RDFOverview> {
  const found: ExtractedRDF[] = [];
  const notFound: Array<ExtractedRDF['source']> = [];

  // --- Strategy 1: Content Negotiation ---
  let res: Response | null = null;
  let bodyText = '';
  let linkHeader: string | null = null;
  try {
    res = await fetchRDF(uri);
    const ct = baseMime(res.headers.get('content-type'));
    linkHeader = res.headers.get('link');
    if (isRDFMime(ct) && res.ok) {
      found.push({ content: await res.text(), format: ct, source: 'content-negotiation', url: uri });
    } else {
      notFound.push('content-negotiation');
      try { bodyText = await res.text(); } catch { bodyText = ''; }
    }
  } catch {
    notFound.push('content-negotiation');
  }

  const htmlHints = bodyText
    ? extractHtmlHints(bodyText)
    : { describedByLinks: [], linksets: [], embeddedScripts: [] };

  let htmlDoc: Document | null = null;
  if (bodyText) {
    try {
      if (typeof DOMParser !== 'undefined') {
        htmlDoc = new DOMParser().parseFromString(bodyText, 'text/html');
      }
    } catch { /* not HTML */ }
  }

  const links = parseLinkHeader(linkHeader);

  // --- Strategy 2: HTTP Link header — rel=describedby ---
  const headerDescribedBy = links.filter(
    (l) => l['rel'] === 'describedby' && (!l['type'] || isRDFMime(l['type']))
  );
  let headerDescribedByFound = false;
  for (const link of headerDescribedBy) {
    const metaUrl = new URL(link['url'], uri).toString();
    try {
      const metaRes = await fetchRDF(metaUrl);
      const metaCt = baseMime(metaRes.headers.get('content-type'));
      if (isRDFMime(metaCt) && metaRes.ok) {
        found.push({ content: await metaRes.text(), format: metaCt, source: 'signposting-link-header', url: metaUrl });
        headerDescribedByFound = true;
      }
    } catch { /* skip */ }
  }
  if (!headerDescribedByFound) notFound.push('signposting-link-header');

  // --- Strategy 3: HTTP Link header — rel=linkset ---
  const headerLinksets = links.filter((l) => l['rel'] === 'linkset');
  let headerLinksetFound = false;
  for (const ls of headerLinksets) {
    const lsUrl = new URL(ls['url'], uri).toString();
    const hits = await tryExtractAllFromLinkset(lsUrl, uri);
    if (hits.length > 0) { found.push(...hits); headerLinksetFound = true; }
  }
  if (!headerLinksetFound) notFound.push('linkset');

  // --- Strategy 4: HTML link[rel=describedby] ---
  const htmlDescribedBy = new Map<string, string | null>();
  const htmlLinksets = new Set<string>();
  const htmlScripts: Array<{ type: string; content: string }> = [];

  if (htmlDoc) {
    for (const el of htmlDoc.querySelectorAll('link')) {
      const rel = el.getAttribute('rel');
      const href = el.getAttribute('href');
      const type = el.getAttribute('type');
      if (!href) continue;
      if (relHasToken(rel, 'describedby')) htmlDescribedBy.set(href, type);
      if (relHasToken(rel, 'linkset')) htmlLinksets.add(href);
    }
    for (const script of htmlDoc.querySelectorAll('script[type]')) {
      const type = script.getAttribute('type')?.toLowerCase() ?? '';
      const content = script.textContent?.trim() ?? '';
      if (type && content) htmlScripts.push({ type, content });
    }
  }
  for (const link of htmlHints.describedByLinks) htmlDescribedBy.set(link.href, link.type);
  for (const linkset of htmlHints.linksets) htmlLinksets.add(linkset);
  htmlScripts.push(...htmlHints.embeddedScripts);

  let htmlDescribedByFound = false;
  for (const [href, type] of htmlDescribedBy) {
    if (!type || isRDFMime(type)) {
      const metaUrl = new URL(href, uri).toString();
      try {
        const metaRes = await fetchRDF(metaUrl);
        const metaCt = baseMime(metaRes.headers.get('content-type'));
        if (isRDFMime(metaCt) && metaRes.ok) {
          found.push({ content: await metaRes.text(), format: metaCt, source: 'signposting-html-link', url: metaUrl });
          htmlDescribedByFound = true;
        }
      } catch { /* skip */ }
    }
  }
  if (!htmlDescribedByFound) notFound.push('signposting-html-link');

  // --- Strategy 5: HTML link[rel=linkset] ---
  // (deduplicated against header linksets to avoid double counting)
  const headerLinksetUrls = new Set(
    headerLinksets.map((ls) => new URL(ls['url'], uri).toString())
  );
  let htmlLinksetFound = false;
  for (const href of htmlLinksets) {
    const lsUrl = new URL(href, uri).toString();
    if (headerLinksetUrls.has(lsUrl)) continue; // already tried above
    const hits = await tryExtractAllFromLinkset(lsUrl, uri);
    if (hits.length > 0) {
      found.push(...hits);
      htmlLinksetFound = true;
    }
  }
  // Only push 'linkset' to notFound if both header AND html linkset found nothing
  if (!headerLinksetFound && !htmlLinksetFound && notFound.includes('linkset')) {
    // already pushed above
  } else if (!headerLinksetFound && htmlLinksetFound) {
    // remove the 'linkset' we pushed for the header phase
    const idx = notFound.indexOf('linkset');
    if (idx !== -1) notFound.splice(idx, 1);
  }

  // --- Strategy 6: Embedded RDF scripts ---
  let embeddedFound = false;
  for (const script of htmlScripts) {
    const type = script.type.toLowerCase();
    if (isRDFMime(type)) {
      found.push({ content: script.content, format: type, source: 'embedded-script', url: uri });
      embeddedFound = true;
    }
  }
  if (!embeddedFound) notFound.push('embedded-script');

  // --- Strategy 7: Sitemap signposting ---
  const sitemapHits = await tryExtractAllFromSitemapAndDCAT(uri);
  if (sitemapHits.length > 0) {
    found.push(...sitemapHits);
  } else {
    notFound.push('sitemap-signposting');
  }

  return { found, notFound };
}

/**
 * Main entry point: tries to extract RDF following the exact strategy you described.
 * Returns the first successful RDF or null if nothing was found.
 */
export async function extractRDF(uri: string): Promise<ExtractedRDF | null> {
  // 1. Content negotiation (highest priority)
  let res: Response;
  try {
    res = await fetchRDF(uri);
  } catch {
    return null;
  }

  let ct = baseMime(res.headers.get('content-type'));
  if (isRDFMime(ct) && res.ok) {
    return {
      content: await res.text(),
      format: ct,
      source: 'content-negotiation',
      url: uri,
    };
  }

  // We will use the body for HTML parsing (signposting / embedded scripts)
  let bodyText: string;
  try {
    bodyText = await res.text();
  } catch {
    bodyText = '';
  }

  let htmlDoc: Document | null = null;
  if (bodyText) {
    try {
      if (typeof DOMParser !== 'undefined') {
        htmlDoc = new DOMParser().parseFromString(bodyText, 'text/html');
      }
    } catch {
      // not HTML, ignore
    }
  }

  const htmlHints = bodyText
    ? extractHtmlHints(bodyText)
    : { describedByLinks: [], linksets: [], embeddedScripts: [] };

  // 2. HTTP Link headers (FAIR signposting + linksets)
  const linkHeader = res.headers.get('link');
  const links = parseLinkHeader(linkHeader);

  // Describedby from Link header
  const describedByFromHeader = links.filter(
    (l) => l['rel'] === 'describedby' && (!l['type'] || isRDFMime(l['type']))
  );
  for (const link of describedByFromHeader) {
    const metaUrl = new URL(link['url'], uri).toString();
    const metaRes = await fetchRDF(metaUrl);
    const metaCt = baseMime(metaRes.headers.get('content-type'));
    if (isRDFMime(metaCt) && metaRes.ok) {
      return {
        content: await metaRes.text(),
        format: metaCt,
        source: 'signposting-link-header',
        url: metaUrl,
      };
    }
  }

  // Linkset from Link header
  const linksetFromHeader = links.filter((l) => l['rel'] === 'linkset');
  for (const ls of linksetFromHeader) {
    const lsUrl = new URL(ls['url'], uri).toString();
    const rdf = await tryExtractFromLinkset(lsUrl, uri);
    if (rdf) return rdf;
  }

  // 3. HTML FAIR signposting + embedded RDF scripts
  const htmlDescribedBy = new Map<string, string | null>();
  const htmlLinksets = new Set<string>();
  const htmlScripts: Array<{ type: string; content: string }> = [];

  if (htmlDoc) {
    for (const el of htmlDoc.querySelectorAll('link')) {
      const rel = el.getAttribute('rel');
      const href = el.getAttribute('href');
      const type = el.getAttribute('type');
      if (!href) continue;
      if (relHasToken(rel, 'describedby')) {
        htmlDescribedBy.set(href, type);
      }
      if (relHasToken(rel, 'linkset')) {
        htmlLinksets.add(href);
      }
    }

    for (const script of htmlDoc.querySelectorAll('script[type]')) {
      const type = script.getAttribute('type')?.toLowerCase() ?? '';
      const content = script.textContent?.trim() ?? '';
      if (type && content) {
        htmlScripts.push({ type, content });
      }
    }
  }

  for (const link of htmlHints.describedByLinks) {
    htmlDescribedBy.set(link.href, link.type);
  }
  for (const linkset of htmlHints.linksets) {
    htmlLinksets.add(linkset);
  }
  htmlScripts.push(...htmlHints.embeddedScripts);

  for (const [href, type] of htmlDescribedBy) {
    if (!type || isRDFMime(type)) {
      const metaUrl = new URL(href, uri).toString();
      let metaRes: Response;
      try {
        metaRes = await fetchRDF(metaUrl);
      } catch {
        continue;
      }
      const metaCt = baseMime(metaRes.headers.get('content-type'));
      if (isRDFMime(metaCt) && metaRes.ok) {
        return {
          content: await metaRes.text(),
          format: metaCt,
          source: 'signposting-html-link',
          url: metaUrl,
        };
      }
    }
  }

  for (const href of htmlLinksets) {
    const lsUrl = new URL(href, uri).toString();
    const rdf = await tryExtractFromLinkset(lsUrl, uri);
    if (rdf) return rdf;
  }

  // Embedded <script type="text/turtle"> or application/ld+json etc.
  for (const script of htmlScripts) {
    const type = script.type.toLowerCase();
    if (isRDFMime(type)) {
      return {
        content: script.content,
        format: type,
        source: 'embedded-script',
        url: uri,
      };
    }
  }

  // 4. Final fallback: robots.txt → sitemap.xml → DCAT/FAIR signposting inside sitemap entry
  const sitemapRDF = await tryExtractFromSitemapAndDCAT(uri);
  if (sitemapRDF) return sitemapRDF;

  // Nothing found
  return null;
}

// Optional CLI for quick testing
// Usage:
//   bun run rdf-extractor.ts <URI>          — return first RDF found
//   bun run rdf-extractor.ts --all <URI>    — explore all paths and print overview
if (import.meta.main) {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all');
  const url = args.find((a: string) => a !== '--all');

  if (!url) {
    console.error('Usage: bun run rdf-extractor.ts [--all] <URI>');
    process.exit(1);
  }

  if (allMode) {
    console.log(`🔍 Exploring all RDF paths for: ${url}\n`);
    const overview = await extractAllRDF(url);

    const STRATEGY_LABELS: Record<ExtractedRDF['source'], string> = {
      'content-negotiation':    'Content Negotiation',
      'signposting-link-header':'HTTP Link header (rel=describedby)',
      'linkset':                'Linkset (rel=linkset)',
      'signposting-html-link':  'HTML link[rel=describedby]',
      'embedded-script':        'Embedded RDF script',
      'sitemap-signposting':    'Sitemap signposting (robots.txt)',
    };

    const allSources: ExtractedRDF['source'][] = [
      'content-negotiation',
      'signposting-link-header',
      'linkset',
      'signposting-html-link',
      'embedded-script',
      'sitemap-signposting',
    ];

    // Group found entries by source for display
    const bySource = new Map<string, ExtractedRDF[]>();
    for (const entry of overview.found) {
      const key = entry.source;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(entry);
    }

    let stratNum = 0;
    for (const source of allSources) {
      stratNum++;
      const label = STRATEGY_LABELS[source];
      const hits = bySource.get(source) ?? [];
      if (hits.length > 0) {
        console.log(`  ✅ Strategy ${stratNum} — ${label}`);
        for (const hit of hits) {
          console.log(`       ${hit.format}  ${hit.url}  (${hit.content.length} chars)`);
        }
      } else {
        console.log(`  ❌ Strategy ${stratNum} — ${label}`);
      }
    }

    console.log('');
    if (overview.found.length > 0) {
      console.log(`📊 ${overview.found.length} RDF source(s) found across ${allSources.length} strategies tried.`);
    } else {
      console.log('📊 No RDF found after exploring all strategies.');
    }
  } else {
    console.log(`🔍 Extracting RDF from: ${url}`);
    const result = await extractRDF(url);
    if (result) {
      console.log(`✅ Found RDF (${result.source}) from ${result.url}`);
      console.log(`Format: ${result.format}`);
      console.log(`Content length: ${result.content.length} chars`);
      console.log('\n--- First 500 chars of RDF ---');
      console.log(result.content.slice(0, 500) + (result.content.length > 500 ? '...' : ''));
    } else {
      console.log('❌ No RDF found after trying all strategies.');
    }
  }
}
