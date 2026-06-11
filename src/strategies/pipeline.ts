import type { ExtractedRDF } from '../core/types'
import { STRATEGY_ORDER, RDF_MIMES, RDF_MIME_SET } from '../core/constants'
import { logger } from '../core/logger'
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
  stage: number
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
  logger.info({ uri }, 'Starting RDF discovery cascade (first hit mode) for URI: %s', uri)
  const headPreflightHit = await runHeadSignpostingPreflight(uri)
  if (headPreflightHit) {
    const stage = headPreflightHit.source ? STRATEGY_MAP[headPreflightHit.source]?.stage : undefined;
    logger.info({ uri, source: headPreflightHit.source, url: headPreflightHit.url, stage }, 'Preflight hit found via %s from %s', headPreflightHit.source, headPreflightHit.url)
    return headPreflightHit
  }

  logger.debug({ uri }, 'Building strategy context...')
  const ctx = await buildStrategyContext(uri, false)

  const ctxAny = ctx as any
  if (ctxAny.initialOk && isRDFMime(ctxAny.initialMime)) {
    logger.info({ uri, source: 'content-negotiation', url: uri, stage: 1 }, 'Initial response is already RDF (MIME: %s) via content-negotiation', ctxAny.initialMime)
    return {
      content: ctxAny.initialBody,
      mime: ctxAny.initialMime,
      format: ctxAny.initialMime as ExtractedRDF['format'],
      source: 'content-negotiation',
      url: uri,
      uri,
    } as ExtractedRDF
  }

  logger.debug({ uri }, 'Iterating over strategies in cascade order...')
  // Iterate over STRATEGY_ORDER to try each strategy in order
  for (const source of STRATEGY_ORDER) {
    const strat = STRATEGY_MAP[source]
    if (!strat) continue

    // content-negotiation is already handled as initial fetch above,
    // but we can let it run if it's there
    if (source === 'content-negotiation') continue

    // For linkset, it might need to try multiple candidate URLs (headers + html)
    if (source === 'linkset') {
      const candidates = collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)
      logger.debug({ uri, strategy: source, stage: strat.stage, candidatesCount: candidates.length }, 'Evaluating strategy: %s (Stage %s) with %d candidates', strat.label, strat.stage, candidates.length)
      for (const linksetUrl of candidates) {
        logger.debug({ uri, strategy: source, stage: strat.stage, linksetUrl }, 'Trying linkset candidate URL: %s', linksetUrl)
        const linksetHit = await linksetStrategy.executeFirstHit({ ...ctx, linksetUrl })
        if (linksetHit) {
          linksetHit.uri = uri
          logger.info({ uri, strategy: source, stage: strat.stage, url: linksetHit.url }, 'Strategy %s succeeded. Found RDF: %s', strat.label, linksetHit.url)
          return linksetHit
        }
      }
      continue
    }

    try {
      logger.debug({ uri, strategy: source, stage: strat.stage }, 'Executing strategy: %s (Stage %s)', strat.label, strat.stage)
      const hit = await strat.executeFirstHit(ctx)
      if (hit) {
        hit.uri = uri
        logger.info({ uri, strategy: source, stage: strat.stage, url: hit.url }, 'Strategy %s succeeded. Found RDF: %s', strat.label, hit.url)
        return hit
      }
      logger.debug({ uri, strategy: source, stage: strat.stage }, 'Strategy %s yielded no RDF', strat.label)
    } catch (err: any) {
      logger.debug({ uri, strategy: source, stage: strat.stage, error: err.message }, 'Strategy %s failed with error: %s', strat.label, err.message)
      // Ignore and continue
    }
  }

  logger.info({ uri }, 'RDF discovery cascade finished (first hit mode). No RDF found.')
  return null
}

export async function discoverAllRdf(uri: string): Promise<DiscoveryOverview> {
  logger.info({ uri }, 'Starting exhaustive RDF discovery cascade for URI: %s', uri)
  logger.debug({ uri }, 'Building strategy context for exhaustive run...')
  const ctx = await buildStrategyContext(uri, true)
  const found: ExtractedRDF[] = []
  const notFound: Array<ExtractedRDF['source']> = []

  logger.debug({ uri }, 'Probing content negotiation MIME types...')
  const contentNegotiations = await probeContentNegotiation(uri)

  // Strategy 1: content negotiation
  const connegHits = []
  for (const probe of contentNegotiations) {
    logger.debug({ uri, mime: probe.requestedMime, responseMime: probe.responseMime, isRdf: probe.isRdf, chars: probe.chars }, 'Conneg probe: Accept=%s -> Response=%s (%d chars, isRdf=%s)', probe.requestedMime, probe.responseMime, probe.chars, probe.isRdf)
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
    logger.info({ uri, strategy: 'content-negotiation', stage: 1, count: connegHits.length }, 'Content negotiation succeeded. Found %d RDF format(s)', connegHits.length)
    found.push(...connegHits)
  } else {
    logger.debug({ uri, strategy: 'content-negotiation', stage: 1 }, 'Content negotiation yielded no RDF')
    notFound.push('content-negotiation')
  }

  // Run the remaining strategies in order
  for (const source of STRATEGY_ORDER) {
    if (source === 'content-negotiation') continue

    const strat = STRATEGY_MAP[source]
    if (!strat) continue

    if (source === 'linkset') {
      const linksetCandidates = collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)
      logger.debug({ uri, strategy: source, stage: strat.stage, candidatesCount: linksetCandidates.length }, 'Executing strategy: %s (Stage %s) with %d candidates', strat.label, strat.stage, linksetCandidates.length)
      let linksetHits: ExtractedRDF[] = []
      for (const linksetUrl of linksetCandidates) {
        logger.debug({ uri, strategy: source, stage: strat.stage, linksetUrl }, 'Trying linkset candidate URL: %s', linksetUrl)
        const hits = await linksetStrategy.executeAllHits({ ...ctx, linksetUrl })
        if (hits.length > 0) {
          linksetHits.push(...hits)
        }
      }
      if (linksetHits.length > 0) {
        linksetHits.forEach(h => h.uri = uri)
        logger.info({ uri, strategy: source, stage: strat.stage, count: linksetHits.length }, 'Strategy %s found %d RDF source(s)', strat.label, linksetHits.length)
        found.push(...linksetHits)
      } else {
        logger.debug({ uri, strategy: source, stage: strat.stage }, 'Strategy %s yielded no RDF', strat.label)
        notFound.push('linkset')
      }
      continue
    }

    try {
      logger.debug({ uri, strategy: source, stage: strat.stage }, 'Executing strategy: %s (Stage %s)', strat.label, strat.stage)
      const hits = await strat.executeAllHits(ctx)
      if (hits.length > 0) {
        hits.forEach(h => h.uri = uri)
        logger.info({ uri, strategy: source, stage: strat.stage, count: hits.length }, 'Strategy %s found %d RDF source(s)', strat.label, hits.length)
        found.push(...hits)
      } else {
        logger.debug({ uri, strategy: source, stage: strat.stage }, 'Strategy %s yielded no RDF', strat.label)
        notFound.push(source)
      }
    } catch (err: any) {
      logger.debug({ uri, strategy: source, stage: strat.stage, error: err.message }, 'Strategy %s failed with error: %s', strat.label, err.message)
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
      stage: strat ? strat.stage : 1,
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

  logger.info({ uri, totalFound: found.length }, 'Exhaustive RDF discovery cascade complete. Total unique RDF sources found: %d', found.length)
  return { found, notFound, contentNegotiations, trace }
}
