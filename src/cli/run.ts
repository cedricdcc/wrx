import { STRATEGY_ORDER } from '../core/constants';
import type { ExtractedRDF, LinkRelationObservation, RDFOverview } from '../core/types';
import { collectLinkRelationsForUri } from '../core/link-parser';
import { extractAllRDF, extractRDF } from '../../wrx.ts';
import { getCliUsage, parseCliArgs } from './args';
import { writeMergedRdfOutput, writeRdfOutput } from './output';

function escapeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isAbsoluteUri(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
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
    if ((rel.options ?? []).length > 0) {
      const optionNodes = (rel.options ?? []).map((opt) => {
        const optName = (opt as { name?: string; key?: string }).name ?? (opt as { name?: string; key?: string }).key ?? '';
        const optVal = (opt as { value?: string }).value ?? '';
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

function collectProfileValues(relations: LinkRelationObservation[]): string[] {
  const profiles = new Set<string>();
  for (const relation of relations) {
    if (relation.rel === 'profile') {
      profiles.add(relation.href);
    }
    for (const option of relation.options ?? []) {
      const optionName = (option.name ?? '').toLowerCase();
      const optionValue = (option.value ?? '').trim();
      if (optionName === 'profile' && optionValue) {
        profiles.add(optionValue);
      }
    }
  }
  return [...profiles];
}

function printHelp(): void {
  console.log(getCliUsage());
}

function selectPrimaryRdf(overview: RDFOverview & { found?: ExtractedRDF[] }): ExtractedRDF | null {
  return overview.found?.[0] ?? null;
}

async function writeOutputIfRequested(parsed: ReturnType<typeof parseCliArgs>, rdf: ExtractedRDF | null): Promise<void> {
  if (!parsed.output) {
    return;
  }

  if (!rdf) {
    throw new Error('Cannot write output because no RDF was discovered');
  }

  const target = await writeRdfOutput(rdf, parsed.output);
  console.error('');
  console.error(`💾 Wrote RDF output to: ${target.path}`);
  console.error(`   MIME: ${target.mime}`);
  if (target.tripleCount !== undefined) {
    console.error(`   Triples: ${target.tripleCount}`);
  }
}

async function writeMergedOutputIfRequested(
  parsed: ReturnType<typeof parseCliArgs>,
  documents: ExtractedRDF[],
  relations: LinkRelationObservation[]
): Promise<void> {
  if (!parsed.output) {
    return;
  }

  const target = await writeMergedRdfOutput(documents, relations, parsed.output);
  console.error('');
  console.error(`💾 Wrote RDF output to: ${target.path}`);
  console.error(`   MIME: ${target.mime}`);
  if (target.tripleCount !== undefined) {
    console.error(`   Triples: ${target.tripleCount}`);
  }
}

export async function runWrxCli(args: string[] = process.argv.slice(2)): Promise<void> {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return;
  }

  if (parsed.help) {
    printHelp();
    return;
  }

  const url = parsed.input ?? null;
  if (!url) {
    printHelp();
    return;
  }

  let outputDocument: ExtractedRDF | null = null;
  let mergedDocuments: ExtractedRDF[] = [];
  let mergedRelations: LinkRelationObservation[] = [];

  if (parsed.all) {
    const overview = (await extractAllRDF(url)) as RDFOverview & { trace?: Array<{ strategy: number; source: string; label: string; hits: Array<{ format: string; url: string; chars: number }> }>; contentNegotiations?: Array<{ requestedMime: string; responseMime: string; chars: number; isRdf: boolean }>; found?: ExtractedRDF[] };

    console.error(`🔍 Extracting RDF from: ${url}`);
    console.error('');
    console.error('📊 Strategy Trace:');
    for (const step of overview.trace ?? []) {
      const hits = step.hits;
      const stratNum = step.strategy;
      const label = step.label;
      if (step.source === 'content-negotiation') {
        const rdfHits = (overview.contentNegotiations ?? []).filter((r) => r.isRdf);
        if (rdfHits.length > 0) {
          console.error(`  ✅ Strategy ${stratNum} — ${label} (${rdfHits.length} RDF format(s) found)`);
        } else {
          console.error(`  ❌ Strategy ${stratNum} — ${label}`);
        }
        const reqW = (overview.contentNegotiations ?? []).length > 0
          ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.requestedMime.length), 'Requested MIME'.length)
          : 'Requested MIME'.length;
        const resW = (overview.contentNegotiations ?? []).length > 0
          ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.responseMime.length), 'Response MIME'.length)
          : 'Response MIME'.length;
        console.error(`       ${'Requested MIME'.padEnd(reqW)}  →  ${'Response MIME'.padEnd(resW)}  Chars`);
        console.error(`       ${'─'.repeat(reqW)}     ${'─'.repeat(resW)}  ─────`);
        for (const cn of overview.contentNegotiations ?? []) {
          const flag = cn.isRdf ? '✅' : '❌';
          console.error(`       ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`);
        }
      } else if (hits.length > 0) {
        console.error(`  ✅ Strategy ${stratNum} — ${label}`);
        for (const hit of hits) {
          console.error(`       ${hit.format}  ${hit.url}  (${hit.chars} chars)`);
        }
      } else {
        console.error(`  ❌ Strategy ${stratNum} — ${label}`);
      }
    }

    console.error('');
    if ((overview.contentNegotiations ?? []).length > 0) {
      console.error('📋 Content Negotiation Overview (all MIME types):');
      for (const cn of overview.contentNegotiations ?? []) {
        const flag = cn.isRdf ? '✅ RDF' : '❌ not RDF';
        console.error(`   ${cn.requestedMime.padEnd(26)} → ${cn.chars.toLocaleString().padStart(7)} chars  (${cn.responseMime})  ${flag}`);
      }
      console.error('');
    }

    mergedRelations = parsed.extendLinks || parsed.profile || parsed.all ? await collectLinkRelationsForUri(url) : [];
    mergedDocuments = (overview.found ?? []).filter((doc) => Boolean(doc));

    if ((overview.found ?? []).length > 0) {
      console.error(`📊 ${(overview.found ?? []).length} unique RDF source(s) found across ${STRATEGY_ORDER.length} strategies tried.`);
    } else {
      console.error('📊 No RDF found after exploring all strategies.');
    }

    outputDocument = selectPrimaryRdf(overview);
  } else {
    console.error(`🔍 Extracting RDF from: ${url}`);
    const result = await extractRDF(url);
    if (result) {
      console.error(`✅ Found RDF (${result.source}) from ${result.url}`);
      console.error(`Format: ${result.format}`);
      console.error(`Content length: ${result.content.length} chars`);
      console.error('\n--- First 500 chars of RDF ---');
      console.error(result.content.slice(0, 500) + (result.content.length > 500 ? '...' : ''));
    } else {
      console.error('❌ No RDF found after trying all strategies.');
    }

    outputDocument = result;

    if (parsed.extendLinks || parsed.profile) {
      mergedRelations = await collectLinkRelationsForUri(url);
    }
  }

  if (parsed.profile) {
    if (mergedRelations.length === 0) {
      mergedRelations = await collectLinkRelationsForUri(url);
    }
    const profiles = collectProfileValues(mergedRelations);

    console.error('');
    console.error(`🧪 Profiles discovered: ${profiles.length}`);
    if (profiles.length > 0) {
      for (const profile of profiles) {
        console.error(`   - ${profile}`);
      }
    }
  }

  try {
    if (parsed.output) {
      if (parsed.extendLinks || parsed.all) {
        const documentsToWrite = mergedDocuments.length > 0 ? mergedDocuments : outputDocument ? [outputDocument] : [];
        await writeMergedOutputIfRequested(parsed, documentsToWrite, mergedRelations);
      } else {
        await writeOutputIfRequested(parsed, outputDocument);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
}