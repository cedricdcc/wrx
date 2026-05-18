import type { ExtractedRDF } from '../core/types'

/**
 * Context passed to each discovery strategy.
 * Fields are lazily evaluated and shared across all strategies in sequence.
 */
export interface StrategyContext {
  /** The resource being interrogated */
  uri: string

  /** Optional explicit linkset URL to fetch while keeping `uri` as the anchor base */
  linksetUrl?: string

  /** HTML body (from content negotiation fetch or HTML fallback) */
  bodyText: string

  /** Link header from initial fetch response */
  linkHeader: string | null

  /** Parsed HTML document (only if DOMParser available and bodyText present) */
  htmlDoc: Document | null
}

/**
 * Result from a strategy execution (for future use in pipeline context).
 */
export interface StrategyResult {
  found: ExtractedRDF[]
  fallbackContext?: Partial<StrategyContext>
}

/**
 * Common interface for all discovery strategies.
 * Each strategy implements both single-hit and all-hits modes.
 */
export interface DiscoveryStrategy {
  /**
   * Execute strategy in single-hit mode (return first success or null).
   * Used by extractRDF() — stops after first successful RDF discovery.
   */
  executeFirstHit(ctx: StrategyContext): Promise<ExtractedRDF | null>

  /**
   * Execute strategy in all-hits mode (collect all successes).
   * Used by extractAllRDF() — exhaustively discovers all available RDF.
   */
  executeAllHits(ctx: StrategyContext): Promise<ExtractedRDF[]>

  /**
   * Human-readable label for logging and trace output.
   * Example: "Content Negotiation", "HTTP Link header (rel=describedby)"
   */
  readonly label: string

  /**
   * Internal source identifier (must match one of ExtractedRDF['source'] discriminant values).
   * Example: "content-negotiation", "signposting-link-header", "linkset"
   */
  readonly source: ExtractedRDF['source']
}
