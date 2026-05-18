import { extname, isAbsolute, resolve } from 'node:path';

import { DataFactory, Parser, Writer } from 'n3';
import jsonld from 'jsonld';

import type { LinkRelationObservation } from '../core/types';
import type { ExtractedRDF } from '../core/types';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.ttl': 'text/turtle',
  '.n3': 'text/n3',
  '.nt': 'application/n-triples',
  '.nq': 'application/n-quads',
  '.trig': 'application/trig',
  '.jsonld': 'application/ld+json',
  '.rdf': 'application/rdf+xml',
};

export interface ResolvedOutputTarget {
  path: string;
  mime: string;
  tripleCount?: number;
}

function normalizeMime(mime: string | undefined): string {
  return (mime ?? '').toLowerCase().trim();
}

function mimeToParserFormat(mime: string): string {
  switch (normalizeMime(mime)) {
    case 'text/turtle':
      return 'Turtle';
    case 'text/n3':
      return 'N3';
    case 'application/n-triples':
      return 'N-Triples';
    case 'application/n-quads':
      return 'N-Quads';
    case 'application/trig':
      return 'TriG';
    default:
      return '';
  }
}

function mimeToWriterFormat(mime: string): string {
  switch (normalizeMime(mime)) {
    case 'text/turtle':
      return 'Turtle';
    case 'text/n3':
      return 'N3';
    case 'application/n-triples':
      return 'N-Triples';
    case 'application/n-quads':
      return 'N-Quads';
    case 'application/trig':
      return 'TriG';
    default:
      return '';
  }
}

function parseRdfText(content: string, mime: string, baseIRI?: string): Promise<ReturnType<typeof DataFactory.quad>[]> {
  const normalizedMime = normalizeMime(mime);

  if (normalizedMime === 'application/ld+json') {
    return (async () => {
      const parsed = JSON.parse(content);
      // Fallback only: avoid remote context dereferencing when conversion fails.
      function stripRemoteContextUrls(obj: unknown): unknown {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(stripRemoteContextUrls);
        const jsonObject = obj as Record<string, unknown>;
        if (typeof jsonObject['@context'] === 'string') {
          return { ...jsonObject, '@context': {} };
        }
        if (typeof jsonObject['@context'] === 'object') {
          return { ...jsonObject, '@context': stripRemoteContextUrls(jsonObject['@context']) };
        }
        return jsonObject;
      }

      try {
        const nquads = await jsonld.toRDF(parsed, { format: 'application/n-quads', base: baseIRI });
        return parseRdfText(String(nquads), 'application/n-quads', baseIRI);
      } catch {
        const safeParsed = stripRemoteContextUrls(parsed);
        const nquads = await jsonld.toRDF(safeParsed, { format: 'application/n-quads', base: baseIRI });
        return parseRdfText(String(nquads), 'application/n-quads', baseIRI);
      }
    })();
  }

  const parserFormat = mimeToParserFormat(normalizedMime);
  if (!parserFormat) {
    throw new Error(`Unsupported RDF source MIME for merging: ${mime}`);
  }

  const parser = new Parser({ format: parserFormat as never, baseIRI });
  const quads: ReturnType<typeof DataFactory.quad>[] = [];

  return new Promise<ReturnType<typeof DataFactory.quad>[]>((resolve, reject) => {
    parser.parse(content, (error: unknown, quad?: ReturnType<typeof DataFactory.quad>) => {
      if (error) {
        reject(error);
        return;
      }

      if (quad) {
        quads.push(quad);
        return;
      }

      resolve(quads);
    });
  });
}

function relationToQuads(relation: LinkRelationObservation): ReturnType<typeof DataFactory.quad>[] {
  const rdfType = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const xhtml = 'http://www.w3.org/1999/xhtml#';
  const subject = DataFactory.blankNode();
  const quads: ReturnType<typeof DataFactory.quad>[] = [
    DataFactory.quad(subject, rdfType, DataFactory.namedNode(`${xhtml}link`)),
    DataFactory.quad(subject, DataFactory.namedNode(`${xhtml}anchor`), DataFactory.namedNode(relation.anchor ?? relation.href)),
    DataFactory.quad(
      subject,
      DataFactory.namedNode(`${xhtml}rel`),
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relation.rel)
        ? DataFactory.namedNode(relation.rel)
        : DataFactory.literal(relation.rel)
    ),
    DataFactory.quad(subject, DataFactory.namedNode(`${xhtml}href`), DataFactory.namedNode(relation.href)),
  ];

  for (const option of relation.options ?? []) {
    const optionNode = DataFactory.blankNode();
    quads.push(DataFactory.quad(subject, DataFactory.namedNode(`${xhtml}option`), optionNode));
    quads.push(DataFactory.quad(optionNode, rdfType, DataFactory.namedNode(`${xhtml}LinkOption`)));
    quads.push(DataFactory.quad(optionNode, DataFactory.namedNode(`${xhtml}optionKey`), DataFactory.literal(option.name ?? '')));
    quads.push(DataFactory.quad(optionNode, DataFactory.namedNode(`${xhtml}optionVal`), DataFactory.literal(option.value ?? '')));
  }

  if ((relation.options ?? []).length === 0) {
    quads.push(DataFactory.quad(subject, DataFactory.namedNode(`${xhtml}option`), DataFactory.blankNode()));
  }

  return quads;
}

async function mergeRdfDocuments(
  documents: ExtractedRDF[],
  relations: LinkRelationObservation[]
): Promise<ReturnType<typeof DataFactory.quad>[]> {
  const seen = new Set<string>();
  const merged: ReturnType<typeof DataFactory.quad>[] = [];

  for (const document of documents) {
    try {
      const quads = await parseRdfText(document.content, document.mime, (document as any).url || document.uri);
      for (const quad of quads) {
        const key = JSON.stringify(quad);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(quad);
      }
    } catch (error) {
      console.error(`⚠️ Skipping document for merging: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const relation of relations) {
    for (const quad of relationToQuads(relation)) {
      const key = JSON.stringify(quad);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(quad);
    }
  }

  return merged;
}

async function serializeMergedQuads(
  quads: ReturnType<typeof DataFactory.quad>[],
  outputMime: string
): Promise<string> {
  const normalizedMime = normalizeMime(outputMime);

  if (normalizedMime === 'application/ld+json') {
    const writer = new Writer({ format: 'N-Quads' as never });
    writer.addQuads(quads as never);
    const nquads = await new Promise<string>((resolve, reject) => {
      writer.end((error: unknown, result?: string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result ?? '');
      });
    });
    const json = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });
    return `${JSON.stringify(json, null, 2)}\n`;
  }

  const writerFormat = mimeToWriterFormat(normalizedMime);
  if (!writerFormat) {
    throw new Error(`Unsupported output MIME for merged RDF serialization: ${outputMime}`);
  }

  const writer = new Writer({ format: writerFormat as never });
  writer.addQuads(quads as never);
  return await new Promise<string>((resolve, reject) => {
    writer.end((error: unknown, result?: string) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result ?? '');
    });
  });
}

export function resolveOutputTarget(outputPath: string): ResolvedOutputTarget {
  const absolutePath = isAbsolute(outputPath) ? outputPath : resolve(process.cwd(), outputPath);
  const extension = extname(outputPath).toLowerCase();
  const mime = MIME_BY_EXTENSION[extension];

  if (!mime) {
    throw new Error(`Unsupported output extension for ${outputPath}`);
  }

  return { path: absolutePath, mime };
}

function canWriteAsIs(sourceMime: string, targetMime: string): boolean {
  const source = normalizeMime(sourceMime);
  const target = normalizeMime(targetMime);

  if (source === target) {
    return true;
  }

  if (source === 'application/n-triples' && (target === 'text/turtle' || target === 'text/n3')) {
    return true;
  }

  return false;
}

export async function serializeRdfForOutput(document: ExtractedRDF, outputMime: string): Promise<string> {
  const sourceMime = normalizeMime(document.mime);
  const targetMime = normalizeMime(outputMime);

  if (!sourceMime) {
    throw new Error('Cannot serialize RDF without a source MIME type');
  }

  if (sourceMime === targetMime) {
    return document.content;
  }

  if (sourceMime === 'application/rdf+xml' || targetMime === 'application/rdf+xml') {
    throw new Error(`RDF/XML conversion is not supported yet: ${sourceMime} → ${targetMime}`);
  }

  if (sourceMime === 'application/ld+json' && targetMime === 'application/ld+json') {
    return document.content;
  }

  if (canWriteAsIs(sourceMime, targetMime)) {
    return document.content;
  }

  try {
    const quads = await parseRdfText(document.content, sourceMime, (document as any).url || document.uri);
    return await serializeMergedQuads(quads, targetMime);
  } catch (error) {
    throw new Error(`Serialization from ${document.mime} to ${outputMime} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function writeRdfOutput(document: ExtractedRDF, outputPath: string): Promise<ResolvedOutputTarget> {
  const target = resolveOutputTarget(outputPath);
  const serialized = await serializeRdfForOutput(document, target.mime);
  await Bun.write(target.path, serialized);

  let tripleCount: number | undefined;
  try {
    const quads = await parseRdfText(serialized, target.mime, (document as any).url || document.uri);
    tripleCount = quads.length;
  } catch (error) {
    // Ignore error if we cannot parse the output format (e.g. unsupported MIME)
  }

  return { ...target, tripleCount };
}

export async function writeMergedRdfOutput(
  documents: ExtractedRDF[],
  relations: LinkRelationObservation[],
  outputPath: string
): Promise<ResolvedOutputTarget> {
  const target = resolveOutputTarget(outputPath);
  const merged = await mergeRdfDocuments(documents, relations);
  const serialized = await serializeMergedQuads(merged, target.mime);
  await Bun.write(target.path, serialized);
  return { ...target, tripleCount: merged.length };
}
