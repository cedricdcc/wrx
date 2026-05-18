import type { ExtractedRDF } from '../core/types'
import { STRATEGY_ORDER, RDF_MIMES, RDF_MIME_SET } from '../core/constants'
import { fetchWithRedirect, fetchHeadLinkHeader, fetchHtmlFallback, fetchRDF } from '../core/fetch'
import { baseMime, isRDFMime, normUri } from '../core/utils'
import { extractHtmlHints } from '../core/html-parser'
import { parseLinkHeader } from '../core/link-parser'
import {
  linkHeaderStrategy,
  linksetStrategy,
  htmlSignpostingStrategy,
  embeddedScriptStrategy,
  sitemapSignpostingStrategy,
  type StrategyContext,
} from './index'

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
  }
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

  if (ctx.initialOk && isRDFMime(ctx.initialMime)) {
    return {
      content: ctx.initialBody,
      mime: ctx.initialMime,
      format: ctx.initialMime as ExtractedRDF['format'],
      source: 'content-negotiation',
      url: uri,
    } as ExtractedRDF
  }

  const headerHit = await linkHeaderStrategy.executeFirstHit(ctx)
  if (headerHit) return headerHit

  const htmlHit = await htmlSignpostingStrategy.executeFirstHit(ctx)
  if (htmlHit) return htmlHit

  const embeddedHit = await embeddedScriptStrategy.executeFirstHit(ctx)
  if (embeddedHit) return embeddedHit

  for (const linksetUrl of collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)) {
    const linksetHit = await linksetStrategy.executeFirstHit({ ...ctx, linksetUrl })
    if (linksetHit) return linksetHit
  }

  return sitemapSignpostingStrategy.executeFirstHit(ctx)
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
        } as ExtractedRDF)
      }
    }
  }
  if (connegHits.length > 0) {
    found.push(...connegHits)
  } else {
    notFound.push('content-negotiation')
  }

  // Strategy 2: HTTP Link headers
  const headerHits = await linkHeaderStrategy.executeAllHits(ctx)
  if (headerHits.length > 0) {
    found.push(...headerHits)
  } else {
    notFound.push('signposting-link-header')
  }

  // Strategy 3: linkset candidates discovered from headers and HTML
  const linksetCandidates = collectLinksetCandidates(uri, ctx.bodyText, ctx.linkHeader)
  let linksetHits: ExtractedRDF[] = []
  for (const linksetUrl of linksetCandidates) {
    const hits = await linksetStrategy.executeAllHits({ ...ctx, linksetUrl })
    if (hits.length > 0) {
      linksetHits.push(...hits)
    }
  }
  if (linksetHits.length > 0) {
    found.push(...linksetHits)
  } else {
    notFound.push('linkset')
  }

  // Strategy 4: HTML describedby links
  const htmlHits = await htmlSignpostingStrategy.executeAllHits(ctx)
  if (htmlHits.length > 0) {
    found.push(...htmlHits)
  } else {
    notFound.push('signposting-html-link')
  }

  // Strategy 5: embedded RDF scripts
  const embeddedHits = await embeddedScriptStrategy.executeAllHits(ctx)
  if (embeddedHits.length > 0) {
    found.push(...embeddedHits)
  } else {
    notFound.push('embedded-script')
  }

  // Strategy 6: sitemap fallback
  const sitemapHits = await sitemapSignpostingStrategy.executeAllHits(ctx)
  if (sitemapHits.length > 0) {
    found.push(...sitemapHits)
  } else {
    notFound.push('sitemap-signposting')
  }

  const trace: StrategyTraceStep[] = STRATEGY_ORDER.map((source, i) => {
    const hits = found.filter((item) => item.source === source)
    return {
      strategy: i + 1,
      source,
      label: source === 'content-negotiation'
        ? 'Content Negotiation'
        : source === 'signposting-link-header'
          ? 'HTTP Link header (rel=describedby)'
          : source === 'linkset'
            ? 'Linkset (rel=linkset)'
            : source === 'signposting-html-link'
              ? 'HTML link[rel=describedby]'
              : source === 'embedded-script'
                ? 'Embedded RDF script'
                : 'Sitemap signposting (robots.txt)',
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
