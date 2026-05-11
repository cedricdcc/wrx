/**
 * Strategy modules for RDF discovery
 *
 * Each strategy implements the DiscoveryStrategy interface and provides
 * executeFirstHit() and executeAllHits() methods for single-hit and all-hits modes.
 */

export type { DiscoveryStrategy, StrategyContext, StrategyResult } from './strategy-interface'

export { ContentNegotiationStrategy, contentNegotiationStrategy } from './content-negotiation'
export { LinkHeaderStrategy, linkHeaderStrategy } from './link-header'
export { EmbeddedScriptStrategy, embeddedScriptStrategy } from './embedded-script'
export { LinksetStrategy, linksetStrategy } from './linkset'
export { HtmlSignpostingStrategy, htmlSignpostingStrategy } from './html-signposting'
export { SitemapSignpostingStrategy, sitemapSignpostingStrategy } from './sitemap-signposting'

/**
 * Ordered list of strategy instances for use in the discovery pipeline.
 *
 * Strategies are tried in order:
 * 1. Content Negotiation (highest priority)
 * 2. HTTP Link Header (FAIR signposting)
 * 3. Embedded RDF scripts
 * 4. RFC 9264 Linkset
 * 5. HTML link[rel=describedby] (FAIR signposting)
 * 6. Sitemap Signposting (lowest priority fallback)
 */
export { STRATEGY_ORDER } from '../core/constants'
