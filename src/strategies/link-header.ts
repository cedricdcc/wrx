import type { ExtractedRDF } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { parseLinkHeader } from '../core/link-parser'
import { fetchRDF } from '../core/fetch'
import { baseMime, isRDFMime, normUri, isLinksetMime } from '../core/utils'
import { resolveRdfFormat } from '../core/mime'

function hasDeclaredProfile(link: { [key: string]: string }): boolean {
  return Boolean((link['profile'] ?? '').trim())
}

function shouldTryDescribedBy(link: { [key: string]: string }): boolean {
  const declaredType = (link['type'] ?? '').trim()
  if (!declaredType) return true
  if (isRDFMime(declaredType)) return true
  return hasDeclaredProfile(link)
}

/**
 * HTTP Link Header Signposting Strategy (RFC 8288, RFC 9264)
 *
 * Discovers RDF via HTTP Link headers with:
 * - rel=describedby (FAIR signposting)
 * - rel=profile with RDF MIME type (alternative for describedby)
 *
 * Also identifies linkset sources (rel=linkset and rel=profile with linkset MIME type)
 * but delegates actual linkset processing to LinksetStrategy.
 *
 * In single-hit mode, returns the first successful describedby fetch.
 * In all-hits mode, collects all successful describedby fetches.
 */
export class LinkHeaderStrategy implements DiscoveryStrategy {
  readonly label = 'HTTP Link header (rel=describedby)'
  readonly source: ExtractedRDF['source'] = 'signposting-link-header'

  /**
   * Single-hit mode: return the first describedby link that resolves to RDF.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    // No link header, nothing to do
    if (!ctx.linkHeader) return null

    // Parse the Link header
    const links = parseLinkHeader(ctx.linkHeader)

    // Filter for describedby links (may have type constraint)
    const describedByLinks = links.filter(
      (l) => l['rel'] === 'describedby' && shouldTryDescribedBy(l)
    )

    // Also collect rel=profile with RDF MIME type as describedby equivalents
    const profileLinks = links.filter((l) => l['rel'] === 'profile')
    const profileDescribedBy = profileLinks.filter(
      (pl) => shouldTryDescribedBy(pl)
    )

    // Try all describedby sources (profile + direct describedby) in order
    const allDescribedBy = [...describedByLinks, ...profileDescribedBy]

    for (const link of allDescribedBy) {
      const url = link['url']
      if (!url) continue

      try {
        const metaUrl = new URL(url, ctx.uri).toString()
        const res = await fetchRDF(metaUrl)
        const ct = baseMime(res.headers.get('content-type'))
        const body = await res.text()
        const format = resolveRdfFormat(ct, link['type'], body)

        if (format && res.ok) {
          return {
            content: body,
            mime: format,
            format,
            source: this.source,
            url: metaUrl,
          }
        }
      } catch {
        // Skip this link and try the next
      }
    }

    return null
  }

  /**
   * All-hits mode: collect all describedby links that resolve to RDF.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    const found: ExtractedRDF[] = []

    // No link header, nothing to do
    if (!ctx.linkHeader) return found

    // Parse the Link header
    const links = parseLinkHeader(ctx.linkHeader)

    // Filter for describedby links (may have type constraint)
    const describedByLinks = links.filter(
      (l) => l['rel'] === 'describedby' && shouldTryDescribedBy(l)
    )

    // Also collect rel=profile with RDF MIME type as describedby equivalents
    const profileLinks = links.filter((l) => l['rel'] === 'profile')
    const profileDescribedBy = profileLinks.filter(
      (pl) => shouldTryDescribedBy(pl)
    )

    // Try all describedby sources (profile + direct describedby)
    const allDescribedBy = [...describedByLinks, ...profileDescribedBy]
    const seenUrls = new Set<string>()

    for (const link of allDescribedBy) {
      const url = link['url']
      if (!url) continue

      try {
        const metaUrl = new URL(url, ctx.uri).toString()

        // Avoid re-trying the same URL
        if (seenUrls.has(normUri(metaUrl))) continue
        seenUrls.add(normUri(metaUrl))

        const res = await fetchRDF(metaUrl)
        const ct = baseMime(res.headers.get('content-type'))
        const body = await res.text()
        const format = resolveRdfFormat(ct, link['type'], body)

        if (format && res.ok) {
          found.push({
            content: body,
            mime: format,
            format,
            source: this.source,
            url: metaUrl,
          })
        }
      } catch {
        // Skip this link and try the next
      }
    }

    return found
  }

  /**
   * Helper: Extract linkset URLs from Link header (for use by LinksetStrategy).
   * Returns both rel=linkset and rel=profile with linkset MIME type.
   */
  extractLinksetUrls(linkHeader: string | null, baseUri: string): string[] {
    const urls: string[] = []

    if (!linkHeader) return urls

    const links = parseLinkHeader(linkHeader)

    // rel=linkset directly points to a linkset
    const linksetLinks = links.filter((l) => l['rel'] === 'linkset')
    for (const link of linksetLinks) {
      if (link['url']) {
        try {
          urls.push(new URL(link['url'], baseUri).toString())
        } catch {
          // Skip malformed URL
        }
      }
    }

    // rel=profile with linkset MIME type also points to a linkset
    const profileLinks = links.filter(
      (l) => l['rel'] === 'profile' && l['type'] && isLinksetMime(l['type'])
    )
    for (const link of profileLinks) {
      if (link['url']) {
        try {
          const url = new URL(link['url'], baseUri).toString()
          // Avoid duplicates
          if (!urls.some((u) => normUri(u) === normUri(url))) {
            urls.push(url)
          }
        } catch {
          // Skip malformed URL
        }
      }
    }

    return urls
  }
}

export const linkHeaderStrategy = new LinkHeaderStrategy()
