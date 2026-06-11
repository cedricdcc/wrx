import type { StrategyName } from './types'

export const STRATEGY_ORDER: StrategyName[] = [
  // Stage 1: Direct RDF
  'content-negotiation',
  'signposting-link-header',
  'signposting-html-link',
  'embedded-script',
  'linkset',
  'dcat-catalog',
  'well-known',
  'resource-map',

  // Stage 2: Semantic Uplifting
  'html-links',
  'rdfa',
  'microdata',
  'open-graph',
  'dublin-core',
  'canonical',
  'http-link-relations',
  'sitemap-signposting',
  'rss-feed',
  'atom-feed',
  'manifest',
  'api-discovery',

  // Stage 3: Inferred / Reasoned
  'foaf',
  'same-as',
  'skos',
  'rdf-collections',
  'provenance',
  'collection-membership',
  'pagination',
  'reverse-links',
  'circular-graphs',
]

export const RDF_MIMES = [
  'text/turtle',
  'application/ld+json',
  'application/rdf+xml',
  'application/n-triples',
  'application/n-quads',
  'application/trig',
  'text/n3',
]

export const RDF_ACCEPT = RDF_MIMES.join(', ')

export const RDF_MIME_SET = new Set(RDF_MIMES.map((m) => m.toLowerCase()));

export const DEFAULT_USER_AGENT = 'uri-gator/0.0'
