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

function parseRdfText(content: string, mime: string): Promise<ReturnType<typeof DataFactory.quad>[]> {
  const normalizedMime = normalizeMime(mime);

  if (normalizedMime === 'application/ld+json') {
    return (async () => {
      const parsed = JSON.parse(content);
      // Prevent jsonld from attempting to dereference remote contexts during conversion
      function sanitizeContext(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(sanitizeContext);
        if (typeof obj['@context'] === 'string') {
          // Replace remote context URL with an empty context to avoid network fetches
          obj = { ...obj, '@context': {} };
        } else if (typeof obj['@context'] === 'object') {
          obj = { ...obj, '@context': sanitizeContext(obj['@context']) };
        }
        return obj;
      }

      const safeParsed = sanitizeContext(parsed);
      const nquads = await jsonld.toRDF(safeParsed, { format: 'application/n-quads' });
      return parseRdfText(String(nquads), 'application/n-quads');
    })();
  }

  const parserFormat = mimeToParserFormat(normalizedMime);
  if (!parserFormat) {
    throw new Error(`Unsupported RDF source MIME for merging: ${mime}`);
  }

  const parser = new Parser({ format: parserFormat as never });
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
    const quads = await parseRdfText(document.content, document.mime);
    for (const quad of quads) {
      const key = quad.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(quad);
    }
  }

  for (const relation of relations) {
    for (const quad of relationToQuads(relation)) {
      const key = quad.toString();
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

  throw new Error(`Serialization from ${document.mime} to ${outputMime} is not implemented yet`);
}

export async function writeRdfOutput(document: ExtractedRDF, outputPath: string): Promise<ResolvedOutputTarget> {
  const target = resolveOutputTarget(outputPath);
  const serialized = await serializeRdfForOutput(document, target.mime);
  await Bun.write(target.path, serialized);
  return target;
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
  return target;
}