import type { StrategyName } from './types'

export const STRATEGY_ORDER: StrategyName[] = [
  'content-negotiation',
  'signposting-link-header',
  'linkset',
  'signposting-html-link',
  'embedded-script',
  'sitemap-signposting',
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
