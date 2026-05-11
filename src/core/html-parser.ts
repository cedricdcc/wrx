import { relHasToken } from './utils'

export function parseTagAttributes(tagText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagText)) !== null) {
    const key = (match[1] ?? '').toLowerCase();
    const val = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (key) attrs[key] = val;
  }
  return attrs;
}

export function extractHtmlHints(bodyText: string): {
  describedByLinks: Array<{ href: string; type: string | null }>;
  linksets: string[];
  embeddedScripts: Array<{ type: string; content: string }>;
} {
  const describedByLinks: Array<{ href: string; type: string | null }> = [];
  const linksets: string[] = [];
  const embeddedScripts: Array<{ type: string; content: string }> = [];

  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(bodyText)) !== null) {
    const tag = linkMatch[0] ?? '';
    if (!tag) continue;
    const attrs = parseTagAttributes(tag);
    const rel = attrs['rel'] ?? null;
    const href = attrs['href'] ?? null;
    const type = attrs['type'] ?? null;
    if (!href) continue;
    if (relHasToken(rel, 'describedby')) {
      describedByLinks.push({ href, type });
    }
    if (relHasToken(rel, 'linkset')) {
      linksets.push(href);
    }
  }

  const scriptRegex = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(bodyText)) !== null) {
    const openTag = scriptMatch[1] ?? '';
    const content = (scriptMatch[2] ?? '').trim();
    if (!openTag || !content) continue;
    const attrs = parseTagAttributes(openTag);
    const type = (attrs['type'] ?? '').toLowerCase();
    if (type) embeddedScripts.push({ type, content });
  }

  return { describedByLinks, linksets, embeddedScripts };
}
