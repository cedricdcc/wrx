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

function printTableReport(
  trace: Array<{ strategy: number; source: string; label: string; quadrant: number; standard: string; extraInfo: string; found: boolean; hits: Array<{ format: string; url: string; chars: number }> }>,
  contentNegotiations: Array<{ requestedMime: string; responseMime: string; chars: number; isRdf: boolean }>
): void {
  const headers = ['#', 'Quadrant', 'Strategy', 'Standard', 'Status', 'Returned / Details'];
  const colWidths = [4, 15, 32, 32, 11, 45];

  const makeBorder = (): string => {
    return '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  };

  const makeRow = (cells: string[]): string => {
    return '| ' + cells.map((cell, i) => {
      const w = colWidths[i];
      const val = cell.length > w ? cell.substring(0, w - 3) + '...' : cell;
      return val.padEnd(w);
    }).join(' | ') + ' |';
  };

  console.log(makeBorder());
  console.log(makeRow(headers));
  console.log(makeBorder());

  const quadMap: Record<number, string> = {
    1: 'Q1 (Resource-D)',
    2: 'Q2 (Resource-I)',
    3: 'Q3 (Domain-D)',
    4: 'Q4 (Domain-I)'
  };

  for (const step of trace) {
    const stratNum = String(step.strategy);
    const quadLabel = quadMap[step.quadrant] || `Q${step.quadrant}`;
    const label = step.label;
    const standard = step.standard || '';
    const status = step.found ? '✅ FOUND' : '❌ -';
    
    let returned = 'None';
    if (step.source === 'content-negotiation') {
      const rdfHits = (contentNegotiations ?? []).filter((r) => r.isRdf);
      if (rdfHits.length > 0) {
        returned = `${rdfHits.length} formats: ` + rdfHits.map((r) => r.responseMime).join(', ');
      }
    } else if (step.hits && step.hits.length > 0) {
      returned = step.hits.map((h) => `${h.format} (${h.chars} chars)`).join(', ');
    }

    console.log(makeRow([stratNum, quadLabel, label, standard, status, returned]));
  }

  console.log(makeBorder());
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

  if (parsed.all || parsed.report) {
    const overview = (await extractAllRDF(url)) as RDFOverview & { trace?: Array<{ strategy: number; source: string; label: string; quadrant: number; standard: string; extraInfo: string; found: boolean; hits: Array<{ format: string; url: string; chars: number }> }>; contentNegotiations?: Array<{ requestedMime: string; responseMime: string; chars: number; isRdf: boolean }>; found?: ExtractedRDF[] };

    console.error(`🔍 Extracting RDF from: ${url}`);
    console.error('');

    if (parsed.report) {
      printTableReport(overview.trace ?? [], overview.contentNegotiations ?? []);
    } else {
      console.error('📊 Strategy Trace:');
      for (const step of overview.trace ?? []) {
        const hits = step.hits;
        const stratNum = step.strategy;
        const label = step.label;
        const quadMap: Record<number, string> = {
          1: 'Q1: Resource-Direct',
          2: 'Q2: Resource-Inferenced',
          3: 'Q3: Domain-Direct',
          4: 'Q4: Domain-Inferenced'
        };
        const quadLabel = quadMap[step.quadrant] || `Q${step.quadrant}`;
        const statusIcon = step.found ? '✅' : '❌';

        console.error(`  ${statusIcon} Strategy ${stratNum} — ${label} (${quadLabel})`);
        console.error(`       Standard:    ${step.standard}`);
        console.error(`       Description: ${step.extraInfo}`);

        if (step.source === 'content-negotiation') {
          const rdfHits = (overview.contentNegotiations ?? []).filter((r) => r.isRdf);
          if (rdfHits.length > 0) {
            console.error(`       What was returned: ${rdfHits.length} RDF format(s) found`);
          } else {
            console.error(`       What was returned: None`);
          }
          const reqW = (overview.contentNegotiations ?? []).length > 0
            ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.requestedMime.length), 'Requested MIME'.length)
            : 'Requested MIME'.length;
          const resW = (overview.contentNegotiations ?? []).length > 0
            ? Math.max(...(overview.contentNegotiations ?? []).map((r) => r.responseMime.length), 'Response MIME'.length)
            : 'Response MIME'.length;
          console.error(`         ${'Requested MIME'.padEnd(reqW)}  →  ${'Response MIME'.padEnd(resW)}  Chars`);
          console.error(`         ${'─'.repeat(reqW)}     ${'─'.repeat(resW)}  ─────`);
          for (const cn of overview.contentNegotiations ?? []) {
            const flag = cn.isRdf ? '✅' : '❌';
            console.error(`         ${cn.requestedMime.padEnd(reqW)}  →  ${cn.responseMime.padEnd(resW)}  ${cn.chars.toLocaleString().padStart(7)}  ${flag}`);
          }
        } else if (hits.length > 0) {
          console.error(`       What was returned:`);
          for (const hit of hits) {
            console.error(`         ${hit.format}  ${hit.url}  (${hit.chars} chars)`);
          }
        } else {
          console.error(`       What was returned: None`);
        }
        console.error('');
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
    }

    mergedRelations = parsed.extendLinks || parsed.profile || parsed.all || parsed.report ? await collectLinkRelationsForUri(url) : [];
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
      if (parsed.extendLinks || parsed.all || parsed.report) {
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