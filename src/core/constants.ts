import type { StrategyName } from './types'

export const STRATEGY_ORDER: StrategyName[] = [
  // Quadrant 1: Resource-Direct
  'content-negotiation',
  'signposting-link-header',
  'signposting-html-link',
  'embedded-script',
  'foaf',
  'same-as',
  'skos',
  'rdf-collections',
  'provenance',
  'collection-membership',

  // Quadrant 2: Resource-Inferenced
  'html-links',
  'rdfa',
  'microdata',
  'open-graph',
  'dublin-core',
  'canonical',
  'http-link-relations',
  'pagination',
  'reverse-links',
  'circular-graphs',

  // Quadrant 3: Domain-Direct
  'linkset',
  'dcat-catalog',
  'well-known',
  'resource-map',

  // Quadrant 4: Domain-Inferenced
  'sitemap-signposting',
  'rss-feed',
  'atom-feed',
  'manifest',
  'api-discovery',
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
