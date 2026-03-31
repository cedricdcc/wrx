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

/** Fetch a URL with RDF content negotiation */
async function fetchRDF(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: RDF_ACCEPT },
    redirect: 'follow',
  });
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

  if (ct === 'application/linkset+json') {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    const typedData = data as { linkset?: Array<Record<string, unknown>> } | null;
    const contexts = Array.isArray(typedData?.linkset) ? typedData.linkset : [];
    for (const ctx of contexts) {
      // Look for describedby AND profile (as per user spec: "the linkset will contain the profile")
      for (const rel of ['describedby', 'profile'] as const) {
        const targets = Array.isArray(ctx[rel]) ? (ctx[rel] as Array<{ href?: string; type?: string }>) : [];
        for (const target of targets) {
          if (target.href && (!target.type || isRDFMime(target.type))) {
            const metaUrl = new URL(target.href, linksetUrl).toString();
            const metaRes = await fetchRDF(metaUrl);
            const metaCt = baseMime(metaRes.headers.get('content-type'));
            if (isRDFMime(metaCt) && metaRes.ok) {
              return {
                content: await metaRes.text(),
                format: metaCt,
                source: 'linkset',
                url: metaUrl,
              };
            }
          }
        }
      }
    }
  } else if (ct === 'application/linkset') {
    let text = await res.text();
    // Normalize whitespace (RFC 9264 allows newlines/tabs for readability)
    text = text.replace(/[\r\n\t]+/g, ' ');
    const links = parseLinkHeader(text);
    for (const link of links) {
      if ((link['rel'] === 'describedby' || link['rel'] === 'profile') && link['url']) {
        const metaUrl = new URL(link['url'], linksetUrl).toString();
        const metaRes = await fetchRDF(metaUrl);
        const metaCt = baseMime(metaRes.headers.get('content-type'));
        if (isRDFMime(metaCt) && metaRes.ok) {
          return {
            content: await metaRes.text(),
            format: metaCt,
            source: 'linkset',
            url: metaUrl,
          };
        }
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
      htmlDoc = new DOMParser().parseFromString(bodyText, 'text/html');
    } catch {
      // not HTML, ignore
    }
  }

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
  if (htmlDoc) {
    // <link rel="describedby"> in HTML
    const htmlLinks = htmlDoc.querySelectorAll('link[rel="describedby"]');
    for (const el of htmlLinks) {
      const href = el.getAttribute('href');
      const type = el.getAttribute('type');
      if (href && (!type || isRDFMime(type))) {
        const metaUrl = new URL(href, uri).toString();
        const metaRes = await fetchRDF(metaUrl);
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

    // <link rel="linkset"> in HTML
    const htmlLinksets = htmlDoc.querySelectorAll('link[rel="linkset"]');
    for (const el of htmlLinksets) {
      const href = el.getAttribute('href');
      if (href) {
        const lsUrl = new URL(href, uri).toString();
        const rdf = await tryExtractFromLinkset(lsUrl, uri);
        if (rdf) return rdf;
      }
    }

    // Embedded <script type="text/turtle"> or application/ld+json etc.
    // (this matches your "<script describedby>" description)
    const scripts = htmlDoc.querySelectorAll('script[type]');
    for (const script of scripts) {
      const type = script.getAttribute('type')?.toLowerCase() ?? '';
      if (isRDFMime(type)) {
        const content = script.textContent?.trim();
        if (content) {
          return {
            content,
            format: type,
            source: 'embedded-script',
            url: uri,
          };
        }
      }
    }
  }

  // 4. Final fallback: robots.txt → sitemap.xml → DCAT/FAIR signposting inside sitemap entry
  const sitemapRDF = await tryExtractFromSitemapAndDCAT(uri);
  if (sitemapRDF) return sitemapRDF;

  // Nothing found
  return null;
}

// Optional CLI for quick testing (bun run rdf-extractor.ts <url>)
if (import.meta.main) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: bun run rdf-extractor.ts <URI>');
    process.exit(1);
  }
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
