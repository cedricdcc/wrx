import type {
  LinkRelationOption,
  LinkRelationObservation,
  LinkRelationOrigin,
} from './types'
import { splitRelValues, sanitizeRelationToken, baseMime } from './utils'
import { fetchWithRedirect, fetchHtmlFallback, fetchRDF } from './fetch'
import { extractHtmlHints } from './html-parser'

export function parseLinkHeader(header: string | null): Array<{ url: string; [key: string]: string }> {
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

function relationKey(item: LinkRelationObservation): string {
  const opts = (item.options ?? [])
    .slice()
    .sort((a, b) => {
      const aKey = (a as any).name ?? (a as any).key ?? '';
      const bKey = (b as any).name ?? (b as any).key ?? '';
      if (aKey === bKey) return ((a as any).value ?? '').localeCompare((b as any).value ?? '');
      return aKey.localeCompare(bKey);
    })
    .map((opt) => {
      const k = (opt as any).name ?? (opt as any).key ?? '';
      const v = (opt as any).value ?? '';
      return `${k}=${v}`;
    })
    .join('|');
  return [item.anchor, item.rel, item.href, item.origin, opts].join('::');
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

export function collectFromParsedLinkEntries(
  entries: Array<{ url: string; [key: string]: string }>,
  defaultAnchor: string,
  origin: LinkRelationOrigin,
  sink: LinkRelationObservation[],
  seen: Set<string>,
  baseForTargetResolution: string
): void {
  for (const entry of entries) {
    const relValues = splitRelValues(entry['rel']);
    if (relValues.length === 0) continue;

    const hrefRaw = entry['url'];
    if (!hrefRaw) continue;

    let href: string;
    try {
      href = new URL(hrefRaw, baseForTargetResolution).toString();
    } catch {
      continue;
    }

    const anchorRaw = entry['anchor'];
    let anchor = defaultAnchor;
    if (anchorRaw) {
      try {
        anchor = new URL(anchorRaw, baseForTargetResolution).toString();
      } catch {
        anchor = defaultAnchor;
      }
    }

    const options: LinkRelationOption[] = Object.entries(entry)
      .filter(([key]) => key !== 'url' && key !== 'rel' && key !== 'anchor')
      .map(([key, value]) => ({ name: key, value }));

    for (const rel of relValues) {
      const relToken = sanitizeRelationToken(rel);
      if (!relToken) continue;
      addLinkRelation(sink, seen, { anchor, rel: relToken, href, options, origin });
    }
  }
}

export function collectFromJsonLinksetContext(
  context: Record<string, unknown>,
  linksetUrl: string,
  baseUri: string,
  sink: LinkRelationObservation[],
  seen: Set<string>
): void {
  const anchorValue = typeof context['anchor'] === 'string' ? context['anchor'] : baseUri;
  let anchor = baseUri;
  try {
    anchor = new URL(anchorValue, linksetUrl).toString();
  } catch {
    anchor = baseUri;
  }

  for (const [relName, rawVal] of Object.entries(context)) {
    if (relName === 'anchor') continue;
    if (!Array.isArray(rawVal)) continue;
    for (const item of rawVal) {
      if (typeof item !== 'object' || item === null) continue;
      const row = item as Record<string, unknown>;
      if (typeof row.href !== 'string') continue;
      let href: string;
      try {
        href = new URL(row.href, linksetUrl).toString();
      } catch {
        continue;
      }
      const options: LinkRelationOption[] = Object.entries(row)
        .filter(([key]) => key !== 'href')
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => ({ name: key, value: value as string }));
      addLinkRelation(sink, seen, {
        anchor,
        rel: relName,
        href,
        options,
        origin: 'linkset',
      });
    }
  }
}

export async function collectLinkRelationsFromLinkset(
  linksetUrl: string,
  baseUri: string,
  sink: LinkRelationObservation[],
  seen: Set<string>
): Promise<void> {
  const acceptLinkset = 'application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8';

  let res: Response;
  try {
    res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } });
    if (!res.ok) return;
  } catch {
    return;
  }

  const ct = baseMime(res.headers.get('content-type'));
  if (ct === 'application/linkset+json' || ct === 'application/json' || ct === 'application/ld+json') {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return;
    }
    const linkset = (data as { linkset?: Array<Record<string, unknown>> } | null)?.linkset;
    if (!Array.isArray(linkset)) return;
    for (const ctx of linkset) {
      collectFromJsonLinksetContext(ctx, linksetUrl, baseUri, sink, seen);
    }
    return;
  }

  if (ct === 'application/linkset') {
    let text: string;
    try {
      text = await res.text();
    } catch {
      return;
    }
    const links = parseLinkHeader(text.replace(/[\r\n\t]+/g, ' '));
    collectFromParsedLinkEntries(links, baseUri, 'linkset', sink, seen, linksetUrl);
  }
}

export async function collectLinkRelationsForUri(uri: string): Promise<LinkRelationObservation[]> {
  const relations: LinkRelationObservation[] = [];
  const seen = new Set<string>();

  let bodyText = '';
  let linkHeader: string | null = null;
  try {
    const discovery = await fetchRDF(uri);
    linkHeader = discovery.headers.get('link');
    const ct = baseMime(discovery.headers.get('content-type'));
    if (!ct || !discovery.ok) {
      try {
        bodyText = await discovery.text();
      } catch {
        bodyText = '';
      }
    } else {
      try {
        await discovery.text();
      } catch {
        // Ignore body read errors while collecting links.
      }
    }
  } catch {
    // Continue with fallback HTML fetch.
  }

  if (!bodyText) {
    const fallback = await fetchHtmlFallback(uri);
    if (fallback.body) {
      bodyText = fallback.body;
      if (!linkHeader) linkHeader = fallback.linkHeader;
    }
  }

  const headerLinks = parseLinkHeader(linkHeader);
  collectFromParsedLinkEntries(headerLinks, uri, 'signposting-link-header', relations, seen, uri);

  const htmlHints = bodyText
    ? extractHtmlHints(bodyText)
    : { describedByLinks: [], linksets: [], embeddedScripts: [] };
  collectFromHtmlHintsInternal(uri, htmlHints, relations, seen);

  const linksetTargets = new Set<string>();
  for (const link of headerLinks) {
    const relValues = splitRelValues(link['rel']);
    if (!relValues.includes('linkset')) continue;
    try {
      linksetTargets.add(new URL(link['url'], uri).toString());
    } catch {
      // Skip malformed linkset URL.
    }
  }
  for (const href of htmlHints.linksets) {
    try {
      linksetTargets.add(new URL(href, uri).toString());
    } catch {
      // Skip malformed linkset URL.
    }
  }

  for (const lsUrl of linksetTargets) {
    await collectLinkRelationsFromLinkset(lsUrl, uri, relations, seen);
  }

  return relations;
}

function collectFromHtmlHintsInternal(
  uri: string,
  htmlHints: ReturnType<typeof extractHtmlHints>,
  sink: LinkRelationObservation[],
  seen: Set<string>
): void {
  for (const link of htmlHints.describedByLinks) {
    try {
      const href = new URL(link.href, uri).toString();
      const options: LinkRelationOption[] = link.type ? [{ name: 'type', value: link.type }] : [];
      addLinkRelation(sink, seen, {
        anchor: uri,
        rel: 'describedby',
        href,
        options,
        origin: 'signposting-html-link',
      });
    } catch {
      // Skip malformed href entries.
    }
  }

  for (const linkset of htmlHints.linksets) {
    try {
      const href = new URL(linkset, uri).toString();
      addLinkRelation(sink, seen, {
        anchor: uri,
        rel: 'linkset',
        href,
        options: [],
        origin: 'signposting-html-link',
      });
    } catch {
      // Skip malformed linkset href.
    }
  }
}
