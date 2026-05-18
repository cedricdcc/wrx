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
}

export interface RDFOverview {
  found: boolean
  uri?: string
  format?: RDFFormat
  mime?: string
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
}

export type StrategyName =
  | 'content-negotiation'
  | 'link-header'
  | 'linkset'
  | 'html-signposting'
  | 'embedded-rdf'
  | 'sitemap'
