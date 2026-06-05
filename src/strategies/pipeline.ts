import type { ExtractedRDF } from '../core/types'
import { STRATEGY_ORDER, RDF_MIMES, RDF_MIME_SET } from '../core/constants'
import { fetchWithRedirect, fetchHeadLinkHeader, fetchHtmlFallback, fetchRDF } from '../core/fetch'
import { baseMime, isRDFMime, normUri } from '../core/utils'
import { extractHtmlHints } from '../core/html-parser'
import { parseLinkHeader } from '../core/link-parser'
import {
  contentNegotiationStrategy,
  linkHeaderStrategy,
  htmlSignpostingStrategy,
  embeddedScriptStrategy,
  foafStrategy,
  sameAsStrategy,
  skosStrategy,
  rdfCollectionsStrategy,
  provenanceStrategy,
  collectionMembershipStrategy,
  htmlLinksStrategy,
  rdfaStrategy,
  microdataStrategy,
  openGraphStrategy,
  dublinCoreStrategy,
  canonicalStrategy,
  httpLinkRelationsStrategy,
  paginationStrategy,
  reverseLinksStrategy,
  circularGraphsStrategy,
  linksetStrategy,
  dcatCatalogStrategy,
  wellKnownStrategy,
  resourceMapStrategy,
  sitemapSignpostingStrategy,
  rssFeedStrategy,
  atomFeedStrategy,
  manifestStrategy,
  apiDiscoveryStrategy,
  type StrategyContext,
  type DiscoveryStrategy,
} from './index'

const STRATEGY_MAP: Record<string, DiscoveryStrategy> = {
  'content-negotiation': contentNegotiationStrategy,
  'signposting-link-header': linkHeaderStrategy,
  'signposting-html-link': htmlSignpostingStrategy,
  'embedded-script': embeddedScriptStrategy,
  'foaf': foafStrategy,
  'same-as': sameAsStrategy,
  'skos': skosStrategy,
  'rdf-collections': rdfCollectionsStrategy,
  'provenance': provenanceStrategy,
  'collection-membership': collectionMembershipStrategy,
  'html-links': htmlLinksStrategy,
  'rdfa': rdfaStrategy,
  'microdata': microdataStrategy,
  'open-graph': openGraphStrategy,
  'dublin-core': dublinCoreStrategy,
  'canonical': canonicalStrategy,
  'http-link-relations': httpLinkRelationsStrategy,
  'pagination': paginationStrategy,
  'reverse-links': reverseLinksStrategy,
  'circular-graphs': circularGraphsStrategy,
  'linkset': linksetStrategy,
  'dcat-catalog': dcatCatalogStrategy,
  'well-known': wellKnownStrategy,
  'resource-map': resourceMapStrategy,
  'sitemap-signposting': sitemapSignpostingStrategy,
  'rss-feed': rssFeedStrategy,
  'atom-feed': atomFeedStrategy,
  'manifest': manifestStrategy,
  'api-discovery': apiDiscoveryStrategy,
}

export interface ContentNegotiationProbe {
  requestedMime: string
  responseMime: string
  chars: number
  isRdf: boolean
  url: string
  body: string
}

export interface StrategyTraceStep {
  strategy: number
  source: ExtractedRDF['source']
  label: string
  quadrant: number
  standard: string
  extraInfo: string
  found: boolean
  hits: Array<{
    format: string
    url: string
    chars: number
  }>
}

export interface DiscoveryOverview {
  found: ExtractedRDF[]
  notFound: Array<ExtractedRDF['source']>
  contentNegotiations: ContentNegotiationProbe[]
  trace: StrategyTraceStep[]
}

async function runHeadSignpostingPreflight(uri: string): Promise<ExtractedRDF | null> {
  const linkHeader = await fetchHeadLinkHeader(uri)
  if (!linkHeader) return null

  const headCtx: StrategyContext = {
    uri,
    bodyText: '',
    linkHeader,
    htmlDoc: null,
  }

  const headerHit = await linkHeaderStrategy.executeFirstHit(headCtx)
  if (headerHit) return headerHit

  for (const linksetUrl of collectLinksetCandidates(uri, '', linkHeader)) {
    const linksetHit = await linksetStrategy.executeFirstHit({ ...headCtx, linksetUrl })
    if (linksetHit) return linksetHit
  }

  return null
}

async function buildStrategyContext(uri: string, allowHtmlFallbackAfterInitialRdf: boolean): Promise<StrategyContext> {
  let bodyText = ''
  let linkHeader: string | null = null
  let initialMime = ''
  let initialOk = false
  let initialBody = ''

  try {
    const discovery = await fetchRDF(uri)
    linkHeader = discovery.headers.get('link')
    initialMime = baseMime(discovery.headers.get('content-type'))
    initialOk = discovery.ok

    try {
      initialBody = await discovery.text()
      bodyText = initialOk && isRDFMime(initialMime) ? '' : initialBody
    } catch {
      bodyText = ''
    }
  } catch {
    // Continue with HTML fallback
  }

  if (!bodyText && (!initialOk || !isRDFMime(initialMime) || allowHtmlFallbackAfterInitialRdf)) {
    const fallback = await fetchHtmlFallback(uri)
    if (fallback.body) {
      bodyText = fallback.body
      if (!linkHeader) linkHeader = fallback.linkHeader
    }
  }

  let htmlDoc: Document | null = null
  if (bodyText) {
    try {
      if (typeof DOMParser !== 'undefined') {
        htmlDoc = new DOMParser().parseFromString(bodyText, 'text/html')
      }
    } catch {
      htmlDoc = null
    }
  }

  return {
    uri,
    bodyText,
    linkHeader,
    htmlDoc,
    initialMime,
    initialOk,
    initialBody,
  } as StrategyContext
}

function collectLinksetCandidates(uri: string, bodyText: string, linkHeader: string | null): string[] {
  const candidates = new Set<string>()

  for (const candidate of linkHeaderStrategy.extractLinksetUrls(linkHeader, uri)) {
    candidates.add(candidate)
  }

  if (bodyText) {
    const htmlHints = extractHtmlHints(bodyText)
    for (const linkset of htmlHints.linksets) {
      try {
        candidates.add(new URL(linkset, uri).toString())
      } catch {
        // Skip malformed linkset URL
      }
    }
  }

  candidates.add(uri)
  return [...candidates]
}

async function probeContentNegotiation(uri: string): Promise<ContentNegotiationProbe[]> {
  const probes: ContentNegotiationProbe[] = []
  const seenFormats = new Set<string>()

  for (const mime of RDF_MIMES) {
    try {
      const res = await fetchWithRedirect(uri, { headers: { Accept: mime } })
      const responseMime = baseMime(res.headers.get('content-type'))
      const body = await res.text()
      const isRdf = res.ok && isRDFMime(responseMime)

      probes.push({
        requestedMime: mime,
        responseMime: responseMime || '(unknown)',
        chars: body.length,
        isRdf,
        url: res.url || uri,
        body,
      })

      if (isRdf && !seenFormats.has(responseMime)) {
        seenFormats.add(responseMime)
      }
    } catch {
      // Skip this MIME type
    }
  }

  return probes
}

export async function discoverFirstRdf(uri: string): Promise<ExtractedRDF | null> {
  const headPreflightHit = await runHeadSignpostingPreflight(uri)
  if (headPreflightHit) return headPreflightHit

  const ctx = await buildStrategyContext(uri, false)

  const ctxAny = ctx as any
  if (ctxAny.initialOk && isRDFMime(ctxAny.initialMime)) {
    return {
      content: ctxAny.initialBody,
      mime: ctxAny.initialMime,
      format: ctxAny.initialMime as ExtractedRDF['format'],
      source: 'content-negotiation',
      url: uri,
      uri,
    } as ExtractedRDF
  }

  // Iterate over STRATEGY_ORDER to try each strategy in order
  for (const source of STRATEGY_ORDER) {
    const strat = STRATEGY_MAP[source]
    if (!strat) continue

    // content-negotiation is already handled as initial fetch above,
    // but we can let it run if it's there
    if (source === 'content-negotiation') continue

    // For linkset, it might need to try multiple candidate URLs (headers + html)
    if (source === 'linkset') {
      for (const linksetUrl of collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)) {
        const linksetHit = await linksetStrategy.executeFirstHit({ ...ctx, linksetUrl })
        if (linksetHit) {
          linksetHit.uri = uri
          return linksetHit
        }
      }
      continue
    }

    try {
      const hit = await strat.executeFirstHit(ctx)
      if (hit) {
        hit.uri = uri
        return hit
      }
    } catch {
      // Ignore and continue
    }
  }

  return null
}

export async function discoverAllRdf(uri: string): Promise<DiscoveryOverview> {
  const ctx = await buildStrategyContext(uri, true)
  const found: ExtractedRDF[] = []
  const notFound: Array<ExtractedRDF['source']> = []
  const contentNegotiations = await probeContentNegotiation(uri)

  // Strategy 1: content negotiation
  const connegHits = []
  for (const probe of contentNegotiations) {
    if (probe.isRdf) {
      const existing = connegHits.find((hit) => hit.format === probe.responseMime)
      if (!existing) {
        connegHits.push({
          content: probe.body,
          mime: probe.responseMime,
          format: probe.responseMime as ExtractedRDF['format'],
          source: 'content-negotiation',
          url: uri,
          uri,
        } as ExtractedRDF)
      }
    }
  }
  if (connegHits.length > 0) {
    found.push(...connegHits)
  } else {
    notFound.push('content-negotiation')
  }

  // Run the remaining strategies in order
  for (const source of STRATEGY_ORDER) {
    if (source === 'content-negotiation') continue

    const strat = STRATEGY_MAP[source]
    if (!strat) continue

    if (source === 'linkset') {
      const linksetCandidates = collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)
      let linksetHits: ExtractedRDF[] = []
      for (const linksetUrl of linksetCandidates) {
        const hits = await linksetStrategy.executeAllHits({ ...ctx, linksetUrl })
        if (hits.length > 0) {
          linksetHits.push(...hits)
        }
      }
      if (linksetHits.length > 0) {
        linksetHits.forEach(h => h.uri = uri)
        found.push(...linksetHits)
      } else {
        notFound.push('linkset')
      }
      continue
    }

    try {
      const hits = await strat.executeAllHits(ctx)
      if (hits.length > 0) {
        hits.forEach(h => h.uri = uri)
        found.push(...hits)
      } else {
        notFound.push(source)
      }
    } catch {
      notFound.push(source)
    }
  }

  const trace: StrategyTraceStep[] = STRATEGY_ORDER.map((source, i) => {
    const hits = found.filter((item) => item.source === source)
    const strat = STRATEGY_MAP[source]
    return {
      strategy: i + 1,
      source,
      label: strat ? strat.label : source,
      quadrant: strat ? strat.quadrant : 1,
      standard: strat?.standard || '',
      extraInfo: strat?.extraInfo || '',
      found: hits.length > 0,
      hits: hits.map((hit) => ({
        format: hit.format,
        url: hit.url,
        chars: hit.content.length,
      })),
    }
  })

  return { found, notFound, contentNegotiations, trace }
}
