// wrx.ts
// TypeScript module for Bun to extract web resources and RDF metadata from a URI using cascading discovery.
// Run with: bun run wrx.js (or import the function in your Bun project)
// No external dependencies — uses only built-in Bun/fetch + DOMParser (available in Bun).

import type {
  ExtractedRDF,
  ContentNegotiationResult,
  RDFOverview,
  LinkRelationObservation,
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

export async function extractLinkRelations(uri: string): Promise<LinkRelationObservation[]> {
  return collectLinkRelationsForUri(uri)
}

function collectProfileValues(relations: LinkRelationObservation[]): string[] {
  const profiles = new Set<string>()
  for (const relation of relations) {
    if (relation.rel === 'profile') {
      profiles.add(relation.href)
    }
    for (const option of relation.options) {
      const optionName = (option.name ?? '').toLowerCase()
      const optionValue = (option.value ?? '').trim()
      if (optionName === 'profile' && optionValue) {
        profiles.add(optionValue)
      }
    }
  }
  return [...profiles]
}

if (import.meta.main) {
  (async () => {
    const cliPath = './src/cli/run.ts';
    const { runWrxCli } = await import(/* @vite-ignore */ cliPath);
    await runWrxCli();
  })();
}
