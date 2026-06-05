/**
 * Strategy modules for RDF discovery divided into the 2x2 taxonomy quadrants
 */

export type { DiscoveryStrategy, StrategyContext, StrategyResult } from './strategy-interface'

// === Quadrant 1: Resource-Direct ===
export { ContentNegotiationStrategy, contentNegotiationStrategy } from './resource/direct/content-negotiation'
export { LinkHeaderStrategy, linkHeaderStrategy } from './resource/direct/link-header'
export { EmbeddedScriptStrategy, embeddedScriptStrategy } from './resource/direct/embedded-script'
export { HtmlSignpostingStrategy, htmlSignpostingStrategy } from './resource/direct/html-signposting'
export { FoafStrategy, foafStrategy } from './resource/direct/foaf'
export { SameAsStrategy, sameAsStrategy } from './resource/direct/same-as'
export { SkosStrategy, skosStrategy } from './resource/direct/skos'
export { RdfCollectionsStrategy, rdfCollectionsStrategy } from './resource/direct/rdf-collections'
export { ProvenanceStrategy, provenanceStrategy } from './resource/direct/provenance'
export { CollectionMembershipStrategy, collectionMembershipStrategy } from './resource/direct/collection-membership'

// === Quadrant 2: Resource-Inferenced ===
export { HtmlLinksStrategy, htmlLinksStrategy } from './resource/inferenced/html-links'
export { RdfaStrategy, rdfaStrategy } from './resource/inferenced/rdfa'
export { MicrodataStrategy, microdataStrategy } from './resource/inferenced/microdata'
export { OpenGraphStrategy, openGraphStrategy } from './resource/inferenced/open-graph'
export { DublinCoreStrategy, dublinCoreStrategy } from './resource/inferenced/dublin-core'
export { CanonicalStrategy, canonicalStrategy } from './resource/inferenced/canonical'
export { HttpLinkRelationsStrategy, httpLinkRelationsStrategy } from './resource/inferenced/http-link-relations'
export { PaginationStrategy, paginationStrategy } from './resource/inferenced/pagination'
export { ReverseLinksStrategy, reverseLinksStrategy } from './resource/inferenced/reverse-links'
export { CircularGraphsStrategy, circularGraphsStrategy } from './resource/inferenced/circular-graphs'

// === Quadrant 3: Domain-Direct ===
export { LinksetStrategy, linksetStrategy } from './domain/direct/linkset'
export { DcatCatalogStrategy, dcatCatalogStrategy } from './domain/direct/dcat-catalog'
export { WellKnownStrategy, wellKnownStrategy } from './domain/direct/well-known'
export { ResourceMapStrategy, resourceMapStrategy } from './domain/direct/resource-map'

// === Quadrant 4: Domain-Inferenced ===
export { SitemapSignpostingStrategy, sitemapSignpostingStrategy } from './domain/inferenced/sitemap-signposting'
export { RssFeedStrategy, rssFeedStrategy } from './domain/inferenced/rss-feed'
export { AtomFeedStrategy, atomFeedStrategy } from './domain/inferenced/atom-feed'
export { ManifestStrategy, manifestStrategy } from './domain/inferenced/manifest'
export { ApiDiscoveryStrategy, apiDiscoveryStrategy } from './domain/inferenced/api-discovery'

export { STRATEGY_ORDER } from '../core/constants'
