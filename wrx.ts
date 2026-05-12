// wrx.ts
// TypeScript module for Bun to extract web resources and RDF metadata from a URI using cascading discovery.
// Run with: bun run wrx.js (or import the function in your Bun project)
// No external dependencies — uses only built-in Bun/fetch + DOMParser (available in Bun).

import {
  ExtractedRDF,
  ContentNegotiationResult,
  RDFOverview,
  LinkRelationOption,
  LinkRelationObservation,
  LinkRelationOrigin,
  ParsedCliArgs,
} from './src/core/types';

import { STRATEGY_ORDER, RDF_MIME_SET, RDF_ACCEPT } from './src/core/constants';

import {
  baseMime,
  relHasToken,
  splitRelValues,
  isAbsoluteUri,
  normUri,
  escapeLiteral,
  sanitizeRelationToken,
  isRDFMime,
  isLinksetMime,
} from './src/core/utils';

import { fetchWithRedirect, fetchRDF, fetchHtmlFallback, fetchDescribedBy } from './src/core/fetch';
import { looksLikeJsonLd, resolveRdfFormat } from './src/core/mime';
import {
  parseLinkHeader,
  collectFromParsedLinkEntries,
  collectFromJsonLinksetContext,
  collectLinkRelationsFromLinkset,
  collectLinkRelationsForUri,
} from './src/core/link-parser';
import { extractHtmlHints } from './src/core/html-parser';
import { discoverFirstRdf, discoverAllRdf } from './src/strategies/pipeline';

const STRATEGY_LABELS: Record<ExtractedRDF['source'], string> = {
  'content-negotiation':    'Content Negotiation',
  'signposting-link-header':'HTTP Link header (rel=describedby)',
  'linkset':                'Linkset (rel=linkset)',
  'signposting-html-link':  'HTML link[rel=describedby]',
  'embedded-script':        'Embedded RDF script',
  'sitemap-signposting':    'Sitemap signposting (robots.txt)',
};

/** Check if a MIME type is a linkset format */
function isLinksetMime(mime: string): boolean {
  const m = mime.toLowerCase().trim();
  return m === 'application/linkset+json' || m === 'application/linkset';
}

function isRDFMime(mime: string): boolean {
  return RDF_MIME_SET.has((mime ?? '').toLowerCase().trim());
}

function parseCliArgs(args: string[]): ParsedCliArgs {
  let allMode = false;
  let profileMode = false;
  let extendLinksMode = false;
  let url: string | null = null;

  for (const arg of args) {
    if (arg === '--all') {
      allMode = true;
      continue;
    }
    if (arg === '--profile') {
      profileMode = true;
      continue;
    }
    if (arg === '--extend-links') {
      extendLinksMode = true;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (!url) {
      url = arg;
      continue;
    }
    throw new Error(`Unexpected extra positional argument: ${arg}`);
  }

  return { allMode, profileMode, extendLinksMode, url };
}

// Link relation helpers are implemented in src/core/link-parser.ts; keep
// rendering helpers here for CLI output.

function escapeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderRelForTurtle(rel: string): string {
  return isAbsoluteUri(rel) ? `<${rel}>` : `"${escapeLiteral(rel)}"`;
}

function renderLinkRelationsJson(relations: LinkRelationObservation[]): string {
  return JSON.stringify(
    relations.map((rel) => ({
      anchor: rel.anchor,
      rel: rel.rel,
      href: rel.href,
      origin: rel.origin,
      options: rel.options,
    })),
    null,
    2
  );
}

function renderLinkRelationsTurtle(relations: LinkRelationObservation[]): string {
  const lines: string[] = ['@prefix xhtml: <http://www.w3.org/1999/xhtml>.', ''];
  for (const rel of relations) {
    lines.push('[] a xhtml:link;');
    lines.push(`   xhtml:anchor <${rel.anchor}>;`);
    lines.push(`   xhtml:rel ${renderRelForTurtle(rel.rel)};`);
    lines.push(`   xhtml:href <${rel.href}>;`);
    if (rel.options.length > 0) {
      const optionNodes = rel.options.map((opt) => {
        const optName = (opt as any).name ?? (opt as any).key ?? '';
        const optVal = (opt as any).value ?? '';
        return `[ a xhtml:LinkOption;\n       xhtml:optionKey \"${escapeLiteral(optName)}\";\n       xhtml:optionVal \"${escapeLiteral(optVal)}\" ]`;
      });
      lines.push(`   xhtml:option ${optionNodes.join(',\n                ')}.`);
    } else {
      lines.push('   xhtml:option [].');
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}


// Linkset and sitemap/DCAT extraction are implemented in strategy modules.

/** Full strategy-by-strategy execution trace (in the same order as the paper flow) */
export interface StrategyTraceStep {
  /** 1-based strategy index in the extraction flow */
  strategy: number;
  /** Internal source identifier used by ExtractedRDF */
  source: ExtractedRDF['source'];
  /** Human-readable strategy label */
  label: string;
  /** Whether this strategy produced at least one RDF hit */
  found: boolean;
  /** RDF hits produced by this strategy */
  hits: Array<{
    format: string;
    url: string;
    chars: number;
  }>;
}

// Full linkset and sitemap harvesting delegated to strategy modules.

/**
 * Explores ALL extraction paths and returns every RDF source found.
 * Unlike extractRDF(), this does NOT short-circuit on the first success.
 */
export async function extractAllRDF(uri: string): Promise<RDFOverview> {
  return discoverAllRdf(uri) as unknown as RDFOverview;
}

/**
 * Main entry point: tries to extract RDF using the cascading discovery strategy.
 * Returns the first successful RDF or null if nothing was found.
 */
export async function extractRDF(uri: string): Promise<ExtractedRDF | null> {
  return discoverFirstRdf(uri)
}

export async function runWrxCli(args: string[] = process.argv.slice(2)): Promise<void> {
  let parsed: ParsedCliArgs
  try {
    parsed = parseCliArgs(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return
  }

  const parsedArgs = parsed as unknown as { url?: string | null; allMode?: boolean; profileMode?: boolean; extendLinksMode?: boolean }
  const url = parsedArgs.url ?? null
  const allMode = Boolean(parsedArgs.allMode)
  const profileMode = Boolean(parsedArgs.profileMode)
  const extendLinksMode = Boolean(parsedArgs.extendLinksMode)

  if (!url) {
    console.error('Usage: bun run wrx.js [--all] [--profile] [--extend-links] <URI>')
    return
  }

  let harvestedOverview: Awaited<ReturnType<typeof extractAllRDF>> | null = null

  if (allMode) {
    harvestedOverview = await extractAllRDF(url)
    const overview = harvestedOverview

    console.log(`🔍 Extracting RDF from: ${url}`)
    console.log('')
    console.log('📊 Strategy Trace:')
    for (const step of overview.trace) {
      const hits = step.hits
      const stratNum = step.strategy
      const label = step.label
      if (step.source === 'content-negotiation') {
        const rdfHits = overview.contentNegotiations.filter((r) => r.isRdf)
        if (rdfHits.length > 0) {
          console.log(`  ✅ Strategy ${stratNum} — ${label} (${rdfHits.length} RDF format(s) found)`)
        } else {
          console.log(`  ❌ Strategy ${stratNum} — ${label}`)
        }
        const reqW = overview.contentNegotiations.length > 0
          ? Math.max(...overview.contentNegotiations.map((r) => r.requestedMime.length), 'Requested MIME'.length)
          : 'Requested MIME'.length
        const resW = overview.contentNegotiations.length > 0
          ? Math.max(...overview.contentNegotiations.map((r) => r.responseMime.length), 'Response MIME'.length)
          : 'Response MIME'.length
        console.log(`       ${'Requested MIME'.padEnd(reqW)}  →  ${'Response MIME'.padEnd(resW)}  Chars`)
        console.log(`       ${'─'.repeat(reqW)}     ${'─'.repeat(resW)}  ─────`)
        for (const cn of overview.contentNegotiations) {
          const flag = cn.isRdf ? '✅' : '❌'
          console.log(`       ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`)
        }
      } else if (hits.length > 0) {
        console.log(`  ✅ Strategy ${stratNum} — ${label}`)
        for (const hit of hits) {
          console.log(`       ${hit.format}  ${hit.url}  (${hit.chars} chars)`)
        }
      } else {
        console.log(`  ❌ Strategy ${stratNum} — ${label}`)
      }
    }

    console.log('')
    if (overview.contentNegotiations.length > 0) {
      console.log('📋 Content Negotiation Overview (all MIME types):')
      for (const cn of overview.contentNegotiations) {
        const flag = cn.isRdf ? '✅ RDF' : '❌ not RDF'
        console.log(`   ${cn.requestedMime.padEnd(26)} → ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`)
      }
      console.log('')
    }

    if (overview.found.length > 0) {
      console.log(`📊 ${overview.found.length} unique RDF source(s) found across ${STRATEGY_ORDER.length} strategies tried.`)
    } else {
      console.log('📊 No RDF found after exploring all strategies.')
    }
  } else {
    console.log(`🔍 Extracting RDF from: ${url}`)
    const result = await extractRDF(url)
    if (result) {
      console.log(`✅ Found RDF (${result.source}) from ${result.url}`)
      console.log(`Format: ${result.format}`)
      console.log(`Content length: ${result.content.length} chars`)
      console.log('\n--- First 500 chars of RDF ---')
      console.log(result.content.slice(0, 500) + (result.content.length > 500 ? '...' : ''))
    } else {
      console.log('❌ No RDF found after trying all strategies.')
    }
  }

  if (extendLinksMode) {
    const relations = await collectLinkRelationsForUri(url)
    console.log('')
    console.log('🔗 Extended Link Relations (JSON):')
    console.log(renderLinkRelationsJson(relations))
    console.log('')
    console.log('🔗 Extended Link Relations (xhtml Turtle-like):')
    console.log(renderLinkRelationsTurtle(relations))
  }

  if (profileMode) {
    const harvestCount = harvestedOverview ? harvestedOverview.found.length : 0
    console.log('')
    console.log(`🧪 --profile placeholder: harvested ${harvestCount} RDF source(s).`)
    console.log('TODO: profile discovery step is reserved and intentionally not implemented yet.')
  }
}

if (import.meta.main) {
  await runWrxCli()
}
