// wrx.ts
// TypeScript module for Bun to extract web resources and RDF metadata from a URI using cascading discovery.
// Run with: bun run wrx.js (or import the function in your Bun project)
// No external dependencies — uses only built-in Bun/fetch + DOMParser (available in Bun).

import {
  ExtractedRDF,
  ContentNegotiationResult,
  RDFOverview,
  LinkRelationOption,
  LinkRelationObservation,
  LinkRelationOrigin,
  ParsedCliArgs,
} from './src/core/types';

import { STRATEGY_ORDER, RDF_MIME_SET, RDF_ACCEPT } from './src/core/constants';

import {
  baseMime,
  relHasToken,
  splitRelValues,
  isAbsoluteUri,
  normUri,
  escapeLiteral,
  sanitizeRelationToken,
  formatOptionsForKey,
} from './src/core/utils';

import { fetchWithRedirect, fetchRDF, fetchHtmlFallback, fetchDescribedBy } from './src/core/fetch';
import { looksLikeJsonLd, resolveRdfFormat } from './src/core/mime';
import {
  parseLinkHeader,
  collectFromParsedLinkEntries,
  collectFromJsonLinksetContext,
  collectLinkRelationsFromLinkset,
  collectLinkRelationsForUri,
} from './src/core/link-parser';
import { extractHtmlHints } from './src/core/html-parser';
import { discoverFirstRdf, discoverAllRdf } from './src/strategies/pipeline';

const STRATEGY_LABELS: Record<ExtractedRDF['source'], string> = {
  'content-negotiation':    'Content Negotiation',
  'signposting-link-header':'HTTP Link header (rel=describedby)',
  'linkset':                'Linkset (rel=linkset)',
  'signposting-html-link':  'HTML link[rel=describedby]',
  'embedded-script':        'Embedded RDF script',
  'sitemap-signposting':    'Sitemap signposting (robots.txt)',
};

/** Check if a MIME type is a linkset format */
function isLinksetMime(mime: string): boolean {
  const m = mime.toLowerCase().trim();
  return m === 'application/linkset+json' || m === 'application/linkset';
}

function isRDFMime(mime: string): boolean {
  return RDF_MIME_SET.has((mime ?? '').toLowerCase().trim());
}

function parseCliArgs(args: string[]): ParsedCliArgs {
  let allMode = false;
  let profileMode = false;
  let extendLinksMode = false;
  let url: string | null = null;

  for (const arg of args) {
    if (arg === '--all') {
      allMode = true;
      continue;
    }
    if (arg === '--profile') {
      profileMode = true;
      continue;
    }
    if (arg === '--extend-links') {
      extendLinksMode = true;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (!url) {
      url = arg;
      continue;
    }
    throw new Error(`Unexpected extra positional argument: ${arg}`);
  }

  return { allMode, profileMode, extendLinksMode, url };
}

function formatOptionsForKey(options: LinkRelationOption[]): string {
  return options
    .slice()
    .sort((a, b) => {
      if (a.key === b.key) return a.value.localeCompare(b.value);
      return a.key.localeCompare(b.key);
    })
    .map((opt) => `${opt.key}=${opt.value}`)
    .join('|');
}

function relationKey(item: LinkRelationObservation): string {
  return [item.anchor, item.rel, item.href, item.origin, formatOptionsForKey(item.options)].join('::');
}

function addLinkRelation(
  items: LinkRelationObservation[],
  seen: Set<string>,
  item: LinkRelationObservation
): void {
  const key = relationKey(item);
  if (seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

function escapeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderRelForTurtle(rel: string): string {
  return isAbsoluteUri(rel) ? `<${rel}>` : `"${escapeLiteral(rel)}"`;
}

function renderLinkRelationsJson(relations: LinkRelationObservation[]): string {
  return JSON.stringify(
    relations.map((rel) => ({
      anchor: rel.anchor,
      rel: rel.rel,
      href: rel.href,
      origin: rel.origin,
      options: rel.options,
    })),
    null,
    2
  );
}

function renderLinkRelationsTurtle(relations: LinkRelationObservation[]): string {
  const lines: string[] = ['@prefix xhtml: <http://www.w3.org/1999/xhtml>.', ''];
  for (const rel of relations) {
    lines.push('[] a xhtml:link;');
    lines.push(`   xhtml:anchor <${rel.anchor}>;`);
    lines.push(`   xhtml:rel ${renderRelForTurtle(rel.rel)};`);
    lines.push(`   xhtml:href <${rel.href}>;`);
    if (rel.options.length > 0) {
      const optionNodes = rel.options.map((opt) => {
        const optName = (opt as any).name ?? (opt as any).key ?? '';
        const optVal = (opt as any).value ?? '';
        return `[ a xhtml:LinkOption;\n       xhtml:optionKey \"${escapeLiteral(optName)}\";\n       xhtml:optionVal \"${escapeLiteral(optVal)}\" ]`;
      });
      lines.push(`   xhtml:option ${optionNodes.join(',\n                ')}.`);
    } else {
      lines.push('   xhtml:option [].');
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}


/** Try to extract RDF from a linkset (application/linkset+json, application/ld+json with linkset, or application/linkset text) */
async function tryExtractFromLinkset(
  linksetUrl: string,
  baseUri: string
): Promise<ExtractedRDF | null> {
  const acceptLinkset = 'application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8';
  let res: Response;
  try {
    res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
    if (!res.ok) return null;
  } catch {
    return null;
  }

  const ct = baseMime(res.headers.get('content-type'));

  // Handle application/linkset+json.
  // Also accept application/json as a fallback for servers that don't set the exact CT.
  // Also accept application/ld+json when the body carries a top-level "linkset" array
  // (RFC 9264 Appendix A JSON-LD linkset representation).
  if (ct === 'application/linkset+json' || ct === 'application/json' || ct === 'application/ld+json') {
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
    const res = await fetchWithRedirect(robotsUrl);
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
      const res = await fetchWithRedirect(sitemapUrl);
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

/** Full strategy-by-strategy execution trace (in the same order as the paper flow) */
export interface StrategyTraceStep {
  /** 1-based strategy index in the extraction flow */
  strategy: number;
  /** Internal source identifier used by ExtractedRDF */
  source: ExtractedRDF['source'];
  /** Human-readable strategy label */
  label: string;
  /** Whether this strategy produced at least one RDF hit */
  found: boolean;
  /** RDF hits produced by this strategy */
  hits: Array<{
    format: string;
    url: string;
    chars: number;
  }>;
}

/** Collect ALL RDF hits from a linkset (does not stop on first success) */
async function tryExtractAllFromLinkset(
  linksetUrl: string,
  baseUri: string
): Promise<ExtractedRDF[]> {
  const results: ExtractedRDF[] = [];
  const acceptLinkset = 'application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8';
  let res: Response;
  try {
    res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
    if (!res.ok) return results;
  } catch {
    return results;
  }

  const ct = baseMime(res.headers.get('content-type'));

  if (ct === 'application/linkset+json' || ct === 'application/json' || ct === 'application/ld+json') {
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
    const res = await fetchWithRedirect(robotsUrl);
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
      const res = await fetchWithRedirect(sitemapUrl);
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
  return discoverAllRdf(uri) as unknown as RDFOverview;
}

/**
 * Main entry point: tries to extract RDF using the cascading discovery strategy.
 * Returns the first successful RDF or null if nothing was found.
 */
export async function extractRDF(uri: string): Promise<ExtractedRDF | null> {
  return discoverFirstRdf(uri)
}

export async function runWrxCli(args: string[] = process.argv.slice(2)): Promise<void> {
  let parsed: ParsedCliArgs
  try {
    parsed = parseCliArgs(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return
  }

  const parsedArgs = parsed as unknown as { url?: string | null; allMode?: boolean; profileMode?: boolean; extendLinksMode?: boolean }
  const url = parsedArgs.url ?? null
  const allMode = Boolean(parsedArgs.allMode)
  const profileMode = Boolean(parsedArgs.profileMode)
  const extendLinksMode = Boolean(parsedArgs.extendLinksMode)

  if (!url) {
    console.error('Usage: bun run wrx.js [--all] [--profile] [--extend-links] <URI>')
    return
  }

  let harvestedOverview: Awaited<ReturnType<typeof extractAllRDF>> | null = null

  if (allMode) {
    harvestedOverview = await extractAllRDF(url)
    const overview = harvestedOverview

    console.log(`🔍 Extracting RDF from: ${url}`)
    console.log('')
    console.log('📊 Strategy Trace:')
    for (const step of overview.trace) {
      const hits = step.hits
      const stratNum = step.strategy
      const label = step.label
      if (step.source === 'content-negotiation') {
        const rdfHits = overview.contentNegotiations.filter((r) => r.isRdf)
        if (rdfHits.length > 0) {
          console.log(`  ✅ Strategy ${stratNum} — ${label} (${rdfHits.length} RDF format(s) found)`)
        } else {
          console.log(`  ❌ Strategy ${stratNum} — ${label}`)
        }
        const reqW = overview.contentNegotiations.length > 0
          ? Math.max(...overview.contentNegotiations.map((r) => r.requestedMime.length), 'Requested MIME'.length)
          : 'Requested MIME'.length
        const resW = overview.contentNegotiations.length > 0
          ? Math.max(...overview.contentNegotiations.map((r) => r.responseMime.length), 'Response MIME'.length)
          : 'Response MIME'.length
        console.log(`       ${'Requested MIME'.padEnd(reqW)}  →  ${'Response MIME'.padEnd(resW)}  Chars`)
        console.log(`       ${'─'.repeat(reqW)}     ${'─'.repeat(resW)}  ─────`)
        for (const cn of overview.contentNegotiations) {
          const flag = cn.isRdf ? '✅' : '❌'
          console.log(`       ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`)
        }
      } else if (hits.length > 0) {
        console.log(`  ✅ Strategy ${stratNum} — ${label}`)
        for (const hit of hits) {
          console.log(`       ${hit.format}  ${hit.url}  (${hit.chars} chars)`)
        }
      } else {
        console.log(`  ❌ Strategy ${stratNum} — ${label}`)
      }
    }

    console.log('')
    if (overview.contentNegotiations.length > 0) {
      console.log('📋 Content Negotiation Overview (all MIME types):')
      for (const cn of overview.contentNegotiations) {
        const flag = cn.isRdf ? '✅ RDF' : '❌ not RDF'
        console.log(`   ${cn.requestedMime.padEnd(26)} → ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`)
      }
      console.log('')
    }

    if (overview.found.length > 0) {
      console.log(`📊 ${overview.found.length} unique RDF source(s) found across ${STRATEGY_ORDER.length} strategies tried.`)
    } else {
      console.log('📊 No RDF found after exploring all strategies.')
    }
  } else {
    console.log(`🔍 Extracting RDF from: ${url}`)
    const result = await extractRDF(url)
    if (result) {
      console.log(`✅ Found RDF (${result.source}) from ${result.url}`)
      console.log(`Format: ${result.format}`)
      console.log(`Content length: ${result.content.length} chars`)
      console.log('\n--- First 500 chars of RDF ---')
      console.log(result.content.slice(0, 500) + (result.content.length > 500 ? '...' : ''))
    } else {
      console.log('❌ No RDF found after trying all strategies.')
    }
  }

  if (extendLinksMode) {
    const relations = await collectLinkRelationsForUri(url)
    console.log('')
    console.log('🔗 Extended Link Relations (JSON):')
    console.log(renderLinkRelationsJson(relations))
    console.log('')
    console.log('🔗 Extended Link Relations (xhtml Turtle-like):')
    console.log(renderLinkRelationsTurtle(relations))
  }

  if (profileMode) {
    const harvestCount = harvestedOverview ? harvestedOverview.found.length : 0
    console.log('')
    console.log(`🧪 --profile placeholder: harvested ${harvestCount} RDF source(s).`)
    console.log('TODO: profile discovery step is reserved and intentionally not implemented yet.')
  }
}

if (import.meta.main) {
  await runWrxCli()
}
