import type { ExtractedRDF } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { fetchWithRedirect, fetchRDF } from '../core/fetch'
import { baseMime, splitRelValues } from '../core/utils'
import { resolveRdfFormat } from '../core/mime'
import { parseTagAttributes } from '../core/html-parser'
import { hasNonEmptyProfileAttribute, shouldAcceptDeclaredType } from '../core/signposting'

interface SitemapLinkNamespace {
  namespaceUri: string
  localName: string
}

const SITEMAP_LINK_NAMESPACES: SitemapLinkNamespace[] = [
  { namespaceUri: 'http://www.w3.org/1999/xhtml', localName: 'link' },
  { namespaceUri: 'http://www.openarchives.org/rs/terms/', localName: 'ln' },
]
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'

function collectConfiguredLinkElements(urlEl: Element): Element[] {
  const found: Element[] = []
  const seen = new Set<Element>()

  for (const { namespaceUri, localName } of SITEMAP_LINK_NAMESPACES) {
    for (const el of urlEl.getElementsByTagNameNS(namespaceUri, localName)) {
      if (!seen.has(el)) {
        seen.add(el)
        found.push(el)
      }
    }
  }

  return found
}

function collectSitemapUrlElements(xmlDoc: Document): Element[] {
  const found: Element[] = []
  const seen = new Set<Element>()

  for (const urlEl of xmlDoc.getElementsByTagName('url')) {
    if (!seen.has(urlEl)) {
      seen.add(urlEl)
      found.push(urlEl)
    }
  }

  for (const urlEl of xmlDoc.getElementsByTagNameNS(SITEMAP_NS, 'url')) {
    if (!seen.has(urlEl)) {
      seen.add(urlEl)
      found.push(urlEl)
    }
  }

  return found
}

function getLocElement(urlEl: Element): Element | null {
  const plain = urlEl.getElementsByTagName('loc')[0]
  if (plain) return plain

  const namespaced = urlEl.getElementsByTagNameNS(SITEMAP_NS, 'loc')[0]
  return namespaced ?? null
}

interface SitemapEntryLink {
  rel: string | null
  type: string | null
  href: string | null
  profile: string | null
}

interface SitemapEntry {
  loc: string
  links: SitemapEntryLink[]
}

/**
 * Lightweight XML fallback parser used when DOMParser is unavailable.
 * This supports sitemap/signmap harvesting in runtimes without browser DOM APIs.
 * It is intentionally conservative and expects simple sitemap structures:
 * - `<url>...</url>` blocks are not expected to be nested or malformed.
 * - Link tags are expected to be ordinary XML tags without `>` inside attribute values.
 * If richer XML features are required, prefer the DOMParser path.
 */
function parseSitemapEntriesFallback(xmlText: string): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  const urlBlocks = xmlText.match(/<url\b[\s\S]*?<\/url>/gi) ?? []
  const localNames = SITEMAP_LINK_NAMESPACES.map((cfg) => cfg.localName.toLowerCase())

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i)
    const loc = (locMatch?.[1] ?? '').trim()
    if (!loc) continue

    const links: SitemapEntryLink[] = []
    const linkTags = block.match(/<([a-zA-Z_][\w.-]*:)?([a-zA-Z_][\w.-]*)\b[^>]*\/?>/g) ?? []
    for (const tagText of linkTags) {
      const localNameMatch = tagText.match(/^<([a-zA-Z_][\w.-]*:)?([a-zA-Z_][\w.-]*)/i)
      const localName = (localNameMatch?.[2] ?? '').toLowerCase()
      if (!localNames.includes(localName)) continue

      const attrs = parseTagAttributes(tagText)
      links.push({
        rel: attrs['rel'] ?? null,
        type: attrs['type'] ?? null,
        href: attrs['href'] ?? null,
        profile: attrs['profile'] ?? null,
      })
    }

    entries.push({ loc, links })
  }

  return entries
}

/**
 * Sitemap Signposting Strategy
 *
 * Fallback discovery method using sitemap-embedded FAIR signposting:
 * 1. Fetch robots.txt to find sitemap URLs
 * 2. Parse each sitemap to find entries matching the requested URI
 * 3. Extract xhtml:link[rel=describedby] elements from sitemap entries
 * 4. Fetch and resolve RDF from those links
 *
 * This is a lower-priority fallback strategy when other signposting methods fail.
 *
 * In single-hit mode, returns the first RDF match found.
 * In all-hits mode, collects all RDF matches.
 */
export class SitemapSignpostingStrategy implements DiscoveryStrategy {
  readonly label = 'Sitemap signposting'
  readonly source: ExtractedRDF['source'] = 'sitemap-signposting'

  /**
   * Single-hit mode: return the first RDF found via sitemap signposting.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    return this._tryExtractFromSitemap(ctx.uri, true)
  }

  /**
   * All-hits mode: collect all RDF found via sitemap signposting.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    return this._tryExtractFromSitemap(ctx.uri, false)
  }

  /**
   * Internal implementation: extract from sitemap, returning either first hit or all hits.
   */
  private async _tryExtractFromSitemap(uri: string, firstHit: boolean): Promise<ExtractedRDF | ExtractedRDF[]> {
    const results: ExtractedRDF[] = []

    // Parse the URI to get host for robots.txt
    let urlObj: URL
    try {
      urlObj = new URL(uri)
    } catch {
      return firstHit ? null : results
    }

    // Fetch robots.txt
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`
    let robotsText: string
    try {
      const res = await fetchWithRedirect(robotsUrl)
      if (!res.ok) return firstHit ? null : results
      robotsText = await res.text()
    } catch {
      return firstHit ? null : results
    }

    // Parse robots.txt to find sitemap URLs
    const sitemaps: string[] = []
    for (const line of robotsText.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const sUrl = trimmed.slice(8).trim()
        if (sUrl) sitemaps.push(sUrl)
      }
    }

    // Try each sitemap
    for (const sitemapUrl of sitemaps) {
      // Fetch sitemap XML
      let sText: string
      try {
        const res = await fetchWithRedirect(sitemapUrl)
        if (!res.ok) continue
        sText = await res.text()
      } catch {
        continue
      }

      const entries: SitemapEntry[] = []

      if (typeof DOMParser !== 'undefined') {
        try {
          const xmlDoc = new DOMParser().parseFromString(sText, 'text/xml')
          if (xmlDoc.getElementsByTagName('parsererror').length > 0) continue

          const urlElements = collectSitemapUrlElements(xmlDoc)
          for (const urlEl of urlElements) {
            const locEl = getLocElement(urlEl)
            const loc = locEl?.textContent?.trim()
            if (!loc) continue

            const links = collectConfiguredLinkElements(urlEl).map((element) => ({
              rel: element.getAttribute('rel'),
              type: element.getAttribute('type'),
              href: element.getAttribute('href'),
              profile: element.getAttribute('profile'),
            }))

            entries.push({ loc, links })
          }
        } catch {
          continue
        }
      } else {
        entries.push(...parseSitemapEntriesFallback(sText))
      }

      for (const entry of entries) {
        const loc = entry.loc
        // Loose matching (handles trailing slash differences)
        if (loc !== uri && loc !== `${uri}/` && uri !== `${loc}/`) continue

        // Found matching entry. Look for FAIR signposting links in configured namespaces.
        const signpostingLinks = entry.links

        for (const signpostingLink of signpostingLinks) {
          const relValues = splitRelValues(signpostingLink.rel).map((value) => value.toLowerCase())
          const type = signpostingLink.type
          const href = signpostingLink.href

          // Accept rel=describedby and rel=profile.
          if (!href) continue
          if (!relValues.includes('describedby') && !relValues.includes('profile')) continue
          if (!shouldAcceptDeclaredType(type, hasNonEmptyProfileAttribute(signpostingLink.profile))) continue

          // Resolve relative URL against sitemap URL
          const metaUrl = new URL(href, sitemapUrl).toString()

          try {
            const metaRes = await fetchRDF(metaUrl)
            const metaCt = baseMime(metaRes.headers.get('content-type'))
            const body = await metaRes.text()
            const format = resolveRdfFormat(metaCt, type ?? undefined, body)

            if (format && metaRes.ok) {
              const rdf: ExtractedRDF = {
                content: body,
                mime: format,
                format,
                source: this.source,
                url: metaUrl,
              }

              if (firstHit) return rdf

              results.push(rdf)
            }
          } catch {
            // Skip this link
          }
        }
      }
    }

    return firstHit ? null : results
  }
}

export const sitemapSignpostingStrategy = new SitemapSignpostingStrategy()
