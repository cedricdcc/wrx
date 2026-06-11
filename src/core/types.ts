export type RDFFormat =
  | 'turtle'
  | 'jsonld'
  | 'ntriples'
  | 'nquads'
  | 'rdfxml'
  | 'trig'
  | 'n3'
  | 'unknown'

export interface ExtractedRDF {
  uri: string
  content: string
  mime: string
  format?: RDFFormat
  source?: string
  url?: string
  provenance?: string
}

export interface RDFOverview {
  found: boolean
  uri?: string
  format?: RDFFormat
  mime?: string
  provenance?: string
}

export interface ContentNegotiationResult {
  uri: string
  mime: string
  status: number
  body?: string
}

export interface LinkRelationOption {
  name: string
  value?: string
}

export interface LinkRelationOrigin {
  type: 'linkset' | 'html' | 'link-header' | 'other'
  sourceUri: string
}

export interface LinkRelationObservation {
  anchor?: string
  rel: string
  href: string
  title?: string
  hreflang?: string
  media?: string
  options?: LinkRelationOption[]
  origin?: LinkRelationOrigin
}

export interface ParsedCliArgs {
  all?: boolean
  extendLinks?: boolean
  help?: boolean
  input?: string
  output?: string
  profile?: boolean
  provenance?: boolean
  report?: boolean
  verbose?: boolean
}

export type StrategyName =
  // Quadrant 1
  | 'content-negotiation'
  | 'signposting-link-header'
  | 'signposting-html-link'
  | 'embedded-script'
  | 'foaf'
  | 'same-as'
  | 'skos'
  | 'rdf-collections'
  | 'provenance'
  | 'collection-membership'
  // Quadrant 2
  | 'html-links'
  | 'rdfa'
  | 'microdata'
  | 'open-graph'
  | 'dublin-core'
  | 'canonical'
  | 'http-link-relations'
  | 'pagination'
  | 'reverse-links'
  | 'circular-graphs'
  // Quadrant 3
  | 'linkset'
  | 'dcat-catalog'
  | 'well-known'
  | 'resource-map'
  // Quadrant 4
  | 'sitemap-signposting'
  | 'rss-feed'
  | 'atom-feed'
  | 'manifest'
  | 'api-discovery'
