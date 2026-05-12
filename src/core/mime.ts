import { RDF_MIME_SET } from './constants'

export function looksLikeJsonLd(text: string): boolean {
  try {
    const obj = JSON.parse(text) as unknown;
    const records = Array.isArray(obj) ? obj : [obj];
    return records.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        ('@context' in (item as Record<string, unknown>) ||
          '@type' in (item as Record<string, unknown>) ||
          '@graph' in (item as Record<string, unknown>))
    );
  } catch {
    return false;
  }
}

export function resolveRdfFormat(
  responseCt: string,
  declaredType: string | undefined,
  body: string
): string | null {
  const ct = (responseCt ?? '').toLowerCase().trim();
  if (RDF_MIME_SET.has(ct)) return ct;
  if (
    declaredType &&
    RDF_MIME_SET.has(declaredType.toLowerCase().trim()) &&
    ct === 'application/json' &&
    looksLikeJsonLd(body)
  ) {
    return declaredType;
  }
  return null;
}
