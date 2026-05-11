import { ExtractedRDF } from '../core/types'
import { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { fetchWithRedirect, fetchRDF } from '../core/fetch'
import { baseMime, isRDFMime } from '../core/utils'

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

      // Parse sitemap XML
      let xmlDoc: Document
      try {
        xmlDoc = new DOMParser().parseFromString(sText, 'text/xml')
        // Check for XML parse errors
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) continue
      } catch {
        continue
      }

      // Find URL entries matching the requested URI
      const urlElements = xmlDoc.getElementsByTagName('url')
      for (const urlEl of urlElements) {
        const locEl = urlEl.getElementsByTagName('loc')[0]
        if (!locEl) continue

        const loc = locEl.textContent?.trim()
        // Loose matching (handles trailing slash differences)
        if (loc !== uri && loc !== `${uri}/` && uri !== `${loc}/`) continue

        // Found matching entry. Look for xhtml:link rel=describedby
        const xhtmlNs = 'http://www.w3.org/1999/xhtml'
        const xLinks = urlEl.getElementsByTagNameNS(xhtmlNs, 'link')

        for (const xLink of xLinks) {
          const rel = xLink.getAttribute('rel')
          const type = xLink.getAttribute('type')
          const href = xLink.getAttribute('href')

          // Must be rel=describedby with RDF type (or no type)
          if (rel !== 'describedby' || !href) continue
          if (type && !isRDFMime(type)) continue

          // Resolve relative URL against sitemap URL
          const metaUrl = new URL(href, sitemapUrl).toString()

          try {
            const metaRes = await fetchRDF(metaUrl)
            const metaCt = baseMime(metaRes.headers.get('content-type'))

            if (isRDFMime(metaCt) && metaRes.ok) {
              const rdf: ExtractedRDF = {
                content: await metaRes.text(),
                format: metaCt,
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
