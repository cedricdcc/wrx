import type { ExtractedRDF } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { fetchWithRedirect, fetchRDF, fetchDescribedBy } from '../core/fetch'
import { baseMime, normUri, isRDFMime, isLinksetMime } from '../core/utils'
import { resolveRdfFormat } from '../core/mime'
import { hasNonEmptyProfileAttribute, shouldAcceptDeclaredType } from '../core/signposting'
import { parseLinkHeader } from '../core/link-parser'

/**
 * Linkset Strategy (RFC 9264)
 *
 * Discovers RDF by fetching and processing RFC 9264 Linkset documents.
 * Supports multiple linkset formats:
 * - application/linkset+json (JSON array format)
 * - application/linkset (text/plain Link header format)
 * - application/ld+json with top-level "linkset" array (RFC 9264 Appendix A)
 *
 * Linkset entries support:
 * - rel=describedby / rel=profile (standard FAIR signposting)
 * - rel=cite-as (DOI/canonical URIs with content negotiation fallback)
 * - anchor filtering (RFC 9264 §4.2)
 *
 * In single-hit mode, returns the first RDF match found.
 * In all-hits mode, collects all RDF matches.
 */
export class LinksetStrategy implements DiscoveryStrategy {
  readonly label = 'RFC 9264 Linkset'
  readonly source: ExtractedRDF['source'] = 'linkset'

  /**
   * Single-hit mode: return the first RDF match found in linkset entries.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    const linksetUrl = ctx.linksetUrl ?? ctx.uri

    // Try the candidate linkset URL while keeping the original URI as the anchor base.
    const result = await this._tryFetchLinkset(linksetUrl, ctx.uri)
    if (result) return result

    return null
  }

  /**
   * All-hits mode: collect all RDF matches from linkset entries.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    const found: ExtractedRDF[] = []

    const linksetUrl = ctx.linksetUrl ?? ctx.uri

    // Try the candidate linkset URL while keeping the original URI as the anchor base.
    const results = await this._tryFetchAllFromLinkset(linksetUrl, ctx.uri)
    found.push(...results)

    return found
  }

  /**
   * Fetch a single linkset and return the first RDF match.
   */
  private async _tryFetchLinkset(linksetUrl: string, baseUri: string): Promise<ExtractedRDF | null> {
    const acceptLinkset = 'application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8'

    let res: Response
    try {
      res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } })
      if (!res.ok) return null
    } catch {
      return null
    }

    const ct = baseMime(res.headers.get('content-type'))

    // Handle JSON-based linkset formats
    if (ct === 'application/linkset+json' || ct === 'application/json' || ct === 'application/ld+json') {
      let data: unknown
      try {
        data = await res.json()
      } catch {
        return null
      }

      const typedData = data as { linkset?: Array<Record<string, unknown>> } | null
      if (!Array.isArray(typedData?.linkset)) return null

      const allCtxs = typedData.linkset

      // RFC 9264 §4.2: prefer entries matching the anchor; fall back to all entries
      const baseNorm = normUri(baseUri)
      const matchedCtxs = allCtxs.filter((ctx) => {
        const anchor = typeof ctx['anchor'] === 'string' ? normUri(ctx['anchor'] as string) : null
        return anchor === baseNorm
      })
      const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs

      // Try each context entry
      for (const ctx of contexts) {
        // Try describedby and profile relations
        for (const rel of ['describedby', 'profile'] as const) {
          const targets = Array.isArray(ctx[rel])
            ? (ctx[rel] as Array<{ href?: string; type?: string }>)
            : []

          for (const target of targets) {
            if (!target.href) continue
            // Skip if declared type is clearly not RDF
            if (!shouldAcceptDeclaredType(target.type, hasNonEmptyProfileAttribute(target.profile))) continue

            const metaUrl = new URL(target.href, linksetUrl).toString()
            try {
              const metaRes = await fetchDescribedBy(metaUrl, target.type)
              if (!metaRes.ok) continue

              const metaCt = baseMime(metaRes.headers.get('content-type'))
              const body = await metaRes.text()
              const format = resolveRdfFormat(metaCt, target.type, body)

              if (format) {
                return { content: body, mime: format, format, source: this.source, url: metaUrl }
              }
            } catch {
              // Skip this target
            }
          }
        }

        // Try cite-as fallback (e.g., DOI resolution with RDF content negotiation)
        const citeAsArr = Array.isArray(ctx['cite-as'])
          ? (ctx['cite-as'] as Array<{ href?: string }>)
          : []

        for (const citeAs of citeAsArr) {
          if (!citeAs.href) continue

          const doiUrl = new URL(citeAs.href, linksetUrl).toString()
          try {
            const doiRes = await fetchRDF(doiUrl)
            if (!doiRes.ok) continue

            const doiCt = baseMime(doiRes.headers.get('content-type'))
            if (isRDFMime(doiCt)) {
              return {
                content: await doiRes.text(),
                mime: doiCt,
                format: doiCt,
                source: this.source,
                url: doiUrl,
              }
            }
          } catch {
            // Skip
          }
        }
      }
    } else if (ct === 'application/linkset') {
      // Handle text-based linkset format (RFC 9264 §2)
      let text = await res.text()
      // Normalize whitespace per RFC 9264
      text = text.replace(/[\r\n\t]+/g, ' ')
      const links = parseLinkHeader(text)

      // Filter by anchor if present
      const baseNorm = normUri(baseUri)
      for (const link of links) {
        // Anchor must match requested URI
        if (link['anchor'] && normUri(link['anchor']) !== baseNorm) continue

        if ((link['rel'] === 'describedby' || link['rel'] === 'profile') && link['url']) {
          const declaredType = link['type']
          if (!shouldAcceptDeclaredType(declaredType, hasNonEmptyProfileAttribute(link['profile']))) continue

          const metaUrl = new URL(link['url'], linksetUrl).toString()
          try {
            const metaRes = await fetchDescribedBy(metaUrl, declaredType)
            if (!metaRes.ok) continue

            const metaCt = baseMime(metaRes.headers.get('content-type'))
            const body = await metaRes.text()
            const format = resolveRdfFormat(metaCt, declaredType, body)

            if (format) {
              return { content: body, mime: format, format, source: this.source, url: metaUrl }
            }
          } catch {
            // Skip
          }
        }
      }
    }

    return null
  }

  /**
   * Fetch a linkset and collect ALL RDF matches.
   */
  private async _tryFetchAllFromLinkset(linksetUrl: string, baseUri: string): Promise<ExtractedRDF[]> {
    const results: ExtractedRDF[] = []
    const acceptLinkset = 'application/linkset+json;q=1.0, application/ld+json;q=0.9, application/linkset;q=0.8'

    let res: Response
    try {
      res = await fetchWithRedirect(linksetUrl, { headers: { Accept: acceptLinkset } })
      if (!res.ok) return results
    } catch {
      return results
    }

    const ct = baseMime(res.headers.get('content-type'))

    // Handle JSON-based linkset formats
    if (ct === 'application/linkset+json' || ct === 'application/json' || ct === 'application/ld+json') {
      let data: unknown
      try {
        data = await res.json()
      } catch {
        return results
      }

      const typedData = data as { linkset?: Array<Record<string, unknown>> } | null
      if (!Array.isArray(typedData?.linkset)) return results

      const allCtxs = typedData.linkset

      // RFC 9264 §4.2: prefer entries matching the anchor; fall back to all entries
      const baseNorm = normUri(baseUri)
      const matchedCtxs = allCtxs.filter((ctx) => {
        const anchor = typeof ctx['anchor'] === 'string' ? normUri(ctx['anchor'] as string) : null
        return anchor === baseNorm
      })
      const contexts = matchedCtxs.length > 0 ? matchedCtxs : allCtxs

      // Collect from each context entry
      for (const ctx of contexts) {
        // Collect from describedby and profile relations
        for (const rel of ['describedby', 'profile'] as const) {
          const targets = Array.isArray(ctx[rel])
            ? (ctx[rel] as Array<{ href?: string; type?: string }>)
            : []

          for (const target of targets) {
            if (!target.href) continue
            if (!shouldAcceptDeclaredType(target.type, hasNonEmptyProfileAttribute(target.profile))) continue

            const metaUrl = new URL(target.href, linksetUrl).toString()
            try {
              const metaRes = await fetchDescribedBy(metaUrl, target.type)
              if (!metaRes.ok) continue

              const metaCt = baseMime(metaRes.headers.get('content-type'))
              const body = await metaRes.text()
              const format = resolveRdfFormat(metaCt, target.type, body)

              if (format) {
                results.push({ content: body, mime: format, format, source: this.source, url: metaUrl })
              }
            } catch {
              // Skip this target
            }
          }
        }

        // Collect from cite-as fallback
        const citeAsArr = Array.isArray(ctx['cite-as'])
          ? (ctx['cite-as'] as Array<{ href?: string }>)
          : []

        for (const citeAs of citeAsArr) {
          if (!citeAs.href) continue

          const doiUrl = new URL(citeAs.href, linksetUrl).toString()
          try {
            const doiRes = await fetchRDF(doiUrl)
            if (!doiRes.ok) continue

            const doiCt = baseMime(doiRes.headers.get('content-type'))
            if (isRDFMime(doiCt)) {
              results.push({
                content: await doiRes.text(),
                mime: doiCt,
                format: doiCt,
                source: this.source,
                url: doiUrl,
              })
            }
          } catch {
            // Skip
          }
        }
      }
    } else if (ct === 'application/linkset') {
      // Handle text-based linkset format
      let text = await res.text()
      text = text.replace(/[\r\n\t]+/g, ' ')
      const links = parseLinkHeader(text)

      // Filter by anchor if present
      const baseNorm = normUri(baseUri)
      for (const link of links) {
        if (link['anchor'] && normUri(link['anchor']) !== baseNorm) continue

        if ((link['rel'] === 'describedby' || link['rel'] === 'profile') && link['url']) {
          const declaredType = link['type']
          if (!shouldAcceptDeclaredType(declaredType, hasNonEmptyProfileAttribute(link['profile']))) continue

          const metaUrl = new URL(link['url'], linksetUrl).toString()
          try {
            const metaRes = await fetchDescribedBy(metaUrl, declaredType)
            if (!metaRes.ok) continue

            const metaCt = baseMime(metaRes.headers.get('content-type'))
            const body = await metaRes.text()
            const format = resolveRdfFormat(metaCt, declaredType, body)

            if (format) {
              results.push({ content: body, mime: format, format, source: this.source, url: metaUrl })
            }
          } catch {
            // Skip
          }
        }
      }
    }

    return results
  }
}

export const linksetStrategy = new LinksetStrategy()
