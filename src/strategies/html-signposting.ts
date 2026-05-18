import type { ExtractedRDF } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { fetchRDF } from '../core/fetch'
import { baseMime, isRDFMime, relHasToken } from '../core/utils'
import { resolveRdfFormat } from '../core/mime'

/**
 * HTML Signposting Strategy (FAIR signposting)
 *
 * Extracts RDF by discovering link[rel=describedby] elements in HTML documents.
 * These links point to RDF descriptions of the resource.
 *
 * Uses both:
 * - DOMParser-parsed HTML (if available)
 * - Extracted hints from content (fallback if DOMParser unavailable)
 *
 * In single-hit mode, returns the first link that resolves to RDF.
 * In all-hits mode, collects all links that resolve to RDF.
 */
export class HtmlSignpostingStrategy implements DiscoveryStrategy {
  readonly label = 'HTML link[rel=describedby]'
  readonly source: ExtractedRDF['source'] = 'signposting-html-link'

  /**
   * Single-hit mode: return the first HTML describedby link that resolves to RDF.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    // No body text, nothing to extract
    if (!ctx.bodyText) return null

    // Collect describedby links from HTML
    const links = this._extractDescribedByLinks(ctx.bodyText, ctx.htmlDoc)

    // Try each link
    for (const { href, type } of links) {
      if (!type || isRDFMime(type)) {
        const metaUrl = new URL(href, ctx.uri).toString()

        try {
          const res = await fetchRDF(metaUrl)
          const ct = baseMime(res.headers.get('content-type'))
          const body = await res.text()
          const format = resolveRdfFormat(ct, type || undefined, body)

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
    }

    return null
  }

  /**
   * All-hits mode: collect all HTML describedby links that resolve to RDF.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    const found: ExtractedRDF[] = []

    // No body text, nothing to extract
    if (!ctx.bodyText) return found

    // Collect describedby links from HTML
    const links = this._extractDescribedByLinks(ctx.bodyText, ctx.htmlDoc)

    // Try each link
    for (const { href, type } of links) {
      if (!type || isRDFMime(type)) {
        const metaUrl = new URL(href, ctx.uri).toString()

        try {
          const res = await fetchRDF(metaUrl)
          const ct = baseMime(res.headers.get('content-type'))
          const body = await res.text()
          const format = resolveRdfFormat(ct, type || undefined, body)

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
    }

    return found
  }

  /**
   * Extract link[rel=describedby] elements from HTML body using DOMParser if available,
   * else regex fallback.
   */
  private _extractDescribedByLinks(
    bodyText: string,
    htmlDoc: Document | null
  ): Array<{ href: string; type: string | null }> {
    const links: Array<{ href: string; type: string | null }> = []
    const seenUrls = new Set<string>()

    // Prefer DOMParser if available
    if (htmlDoc) {
      try {
        for (const el of htmlDoc.querySelectorAll('link')) {
          const rel = el.getAttribute('rel')
          const href = el.getAttribute('href')
          const type = el.getAttribute('type')

          if (!href) continue
          if (!relHasToken(rel, 'describedby')) continue

          if (!seenUrls.has(href)) {
            links.push({ href, type: type || null })
            seenUrls.add(href)
          }
        }
        return links
      } catch {
        // Fall through to regex approach
      }
    }

    // Fallback: regex extraction
    const linkRegex = /<link\b[^>]*>/gi
    let match: RegExpExecArray | null
    while ((match = linkRegex.exec(bodyText)) !== null) {
      const tag = match[0] ?? ''
      if (!tag) continue

      // Extract attributes using regex
      const relMatch = tag.match(/rel\s*=\s*["']?([^\s"'>;]+)/i)
      const hrefMatch = tag.match(/href\s*=\s*["']?([^\s"'>;]+)/i)
      const typeMatch = tag.match(/type\s*=\s*["']?([^\s"'>;]+)/i)

      const rel = relMatch?.[1]
      const href = hrefMatch?.[1]
      const type = typeMatch?.[1]

      if (!href || !rel) continue
      if (!relHasToken(rel, 'describedby')) continue

      if (!seenUrls.has(href)) {
        links.push({ href, type: type || null })
        seenUrls.add(href)
      }
    }

    return links
  }
}

export const htmlSignpostingStrategy = new HtmlSignpostingStrategy()
