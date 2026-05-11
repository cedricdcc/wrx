import { StrategyName } from './types'

export const STRATEGY_ORDER: StrategyName[] = [
  'content-negotiation',
  'link-header',
  'linkset',
  'html-signposting',
  'embedded-rdf',
  'sitemap',
]

export const RDF_MIMES = [
  'text/turtle',
  'application/ld+json',
  'application/rdf+xml',
  'application/n-triples',
  'application/n-quads',
  'text/n3',
]

export const RDF_ACCEPT = RDF_MIMES.join(', ')

export const RDF_MIME_SET = new Set(RDF_MIMES.map((m) => m.toLowerCase()));

export const DEFAULT_USER_AGENT = 'uri-gator/0.0'
