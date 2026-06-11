import { STRATEGY_ORDER } from '../core/constants';
import type { ExtractedRDF, LinkRelationObservation, RDFOverview } from '../core/types';
import { collectLinkRelationsForUri } from '../core/link-parser';
import { extractAllRDF, extractRDF, setLogLevel } from '../../wrx.ts';
import { logger } from '../core/logger';
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
  logger.info({ path: target.path, mime: target.mime, triples: target.tripleCount }, 'Saved RDF output to %s (%d triples)', target.path, target.tripleCount);
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
  logger.info({ path: target.path, mime: target.mime, triples: target.tripleCount }, 'Saved merged RDF output to %s (%d triples)', target.path, target.tripleCount);
}

export async function runWrxCli(args: string[] = process.argv.slice(2)): Promise<void> {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
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

  if (parsed.verbose) {
    setLogLevel('debug');
  }

  let outputDocument: ExtractedRDF | null = null;
  let mergedDocuments: ExtractedRDF[] = [];
  let mergedRelations: LinkRelationObservation[] = [];

  if (parsed.all || parsed.report) {
    const overview = (await extractAllRDF(url)) as RDFOverview & { found?: ExtractedRDF[] };

    mergedRelations = parsed.extendLinks || parsed.profile || parsed.all || parsed.report ? await collectLinkRelationsForUri(url) : [];
    mergedDocuments = (overview.found ?? []).filter((doc) => Boolean(doc));

    outputDocument = selectPrimaryRdf(overview);
  } else {
    const result = await extractRDF(url);
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
    logger.info({ profiles, count: profiles.length }, 'Profiles discovered: %d', profiles.length);
  }

  try {
    if (parsed.output) {
      if (parsed.extendLinks || parsed.all || parsed.report) {
        await writeMergedOutputIfRequested(parsed, mergedDocuments, mergedRelations);
      } else {
        await writeOutputIfRequested(parsed, outputDocument);
      }
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
  }
}