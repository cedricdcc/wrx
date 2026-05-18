import type { ExtractedRDF, ContentNegotiationResult } from '../core/types'
import type { StrategyContext, DiscoveryStrategy } from './strategy-interface'
import { fetchRDF, fetchWithRedirect } from '../core/fetch'
import { baseMime, isRDFMime } from '../core/utils'
import { RDF_MIMES } from '../core/constants'

/**
 * Content Negotiation Strategy (RFC 7231 §5.3.2)
 *
 * Tries to fetch the resource with Accept headers requesting each RDF MIME type.
 * In single-hit mode, tries MIME types in order of preference until one succeeds.
 * In all-hits mode, exhaustively tries all MIME types and collects all successes.
 *
 * Note: This strategy ALSO hydrates the initial response body and link header
 * for use by downstream strategies (if the response was not RDF).
 */
export class ContentNegotiationStrategy implements DiscoveryStrategy {
  readonly label = 'Content Negotiation'
  readonly source: ExtractedRDF['source'] = 'content-negotiation'

  /**
   * Single-hit mode: return the first RDF match found.
   */
  async executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null> {
    try {
      const res = await fetchRDF(ctx.uri)
      const ct = baseMime(res.headers.get('content-type'))
      const body = await res.text()

      if (res.ok && isRDFMime(ct)) {
        return {
          content: body,
          mime: ct,
          format: ct,
          source: this.source,
          url: ctx.uri,
        }
      }
    } catch {
      // Let later strategies run
    }

    return null
  }

  /**
   * All-hits mode: collect all RDF matches (exhaustive search).
   * Also records all content negotiation attempts for --all output.
   */
  async executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]> {
    const found: ExtractedRDF[] = []
    const contentNegotiations: ContentNegotiationResult[] = []
    const seenFormats = new Set<string>()

    for (const mime of RDF_MIMES) {
      try {
        const res = await fetchWithRedirect(ctx.uri, { headers: { Accept: mime } });
        const ct = baseMime(res.headers.get('content-type'));
        const body = await res.text();
        const isRdf = res.ok && isRDFMime(ct);

        // Record attempt for --all output
        contentNegotiations.push({
          requestedMime: mime,
          responseMime: ct || '(unknown)',
          chars: body.length,
          isRdf,
          url: res.url || ctx.uri,
        });

        // Add to results if RDF and not already seen
        if (isRdf && !seenFormats.has(ct)) {
          seenFormats.add(ct);
          found.push({
            content: body,
            mime: ct,
            format: ct,
            source: this.source,
            url: ctx.uri,
          });
        }
      } catch {
        // Skip this MIME type
      }
    }

    return found
  }
}

export const contentNegotiationStrategy = new ContentNegotiationStrategy()
