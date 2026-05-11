

export function baseMime(contentType: string | null): string {
  if (!contentType) return '';
  const semi = contentType.indexOf(';');
  return (semi === -1 ? contentType : contentType.slice(0, semi)).trim().toLowerCase();
}

export function relHasToken(rel: string | null | undefined, token: string): boolean {
  if (!rel) return false;
  return rel
    .toLowerCase()
    .split(/\s+/)
    .some((r) => r.trim() === token);
}

export function splitRelValues(rel: string | null | undefined): string[] {
  if (!rel) return [];
  return rel
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isAbsoluteUri(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

export function normUri(u: string): string {
  return u.toLowerCase().replace(/\/$/, '');
}

export function escapeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function sanitizeRelationToken(rel: string): string {
  return rel.trim();
}

export function isRDFMime(mime: string): boolean {
  const normalized = (mime ?? '').toLowerCase().trim();
  return normalized === 'text/turtle'
    || normalized === 'application/ld+json'
    || normalized === 'application/rdf+xml'
    || normalized === 'application/n-triples'
    || normalized === 'application/n-quads'
    || normalized === 'application/trig'
    || normalized === 'text/n3';
}

export function isLinksetMime(mime: string): boolean {
  const normalized = (mime ?? '').toLowerCase().trim();
  return normalized === 'application/linkset+json' || normalized === 'application/linkset';
}

export function formatOptionsForKey(options: any[] = []): string {
  return options
    .slice()
    .sort((a, b) => {
      const aName = a.name ?? a.key ?? '';
      const bName = b.name ?? b.key ?? '';
      if (aName === bName) return (a.value ?? '').localeCompare(b.value ?? '');
      return aName.localeCompare(bName);
    })
    .map((opt) => {
      const n = opt.name ?? opt.key ?? '';
      const v = opt.value ?? '';
      return `${n}=${v}`;
    })
    .join('|');
}
