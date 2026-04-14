import { afterEach, describe, expect, test } from 'bun:test';
import { extractRDF } from './wrx.js';

const originalFetch = globalThis.fetch;
const originalDOMParser = (globalThis as { DOMParser?: unknown }).DOMParser;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDOMParser === undefined) {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;
  } else {
    (globalThis as { DOMParser?: unknown }).DOMParser = originalDOMParser;
  }
});

describe('extractRDF', () => {
  test('extracts RDF from HTML describedby when DOMParser is unavailable', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    let callCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      callCount += 1;
      const url = String(input);

      if (callCount === 1) {
        expect(url).toBe('https://data.example/');
        return new Response(
          '<html><head><link href="./metadata.ttl" rel="describedby" type="text/turtle"></head><body></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      }

      expect(url).toBe('https://data.example/metadata.ttl');
      return new Response('@prefix dcat: <http://www.w3.org/ns/dcat#> .', {
        status: 200,
        headers: { 'content-type': 'text/turtle; charset=utf-8' },
      });
    }) as typeof fetch;

    const result = await extractRDF('https://data.example/');

    expect(result).not.toBeNull();
    expect(result?.source).toBe('signposting-html-link');
    expect(result?.url).toBe('https://data.example/metadata.ttl');
    expect(result?.format).toBe('text/turtle');
  });

  test('does not treat script body text as script type attribute in fallback parser', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    globalThis.fetch = (async () => {
      return new Response(
        '<html><head></head><body><script>const x = "type=\\"text/turtle\\"";</script></body></html>',
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }
      );
    }) as typeof fetch;

    const result = await extractRDF('https://data.example/');

    expect(result).toBeNull();
  });

  test('requests newer RDF serializations (n-quads, trig) during content negotiation', async () => {
    const DATASET = 'https://data.example/dataset';
    const TRIG_BODY = '@prefix : <https://example/> . { :s :p :o . }';
    let seenAccept = '';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === DATASET) {
        seenAccept = accept;
        if (accept.includes('application/trig')) {
          return new Response(TRIG_BODY, {
            status: 200,
            headers: { 'content-type': 'application/trig' },
          });
        }
        return new Response('<html><body>Fallback</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(DATASET);

    expect(seenAccept).toContain('application/n-quads');
    expect(seenAccept).toContain('application/trig');
    expect(result).not.toBeNull();
    expect(result?.source).toBe('content-negotiation');
    expect(result?.format).toBe('application/trig');
    expect(result?.content).toBe(TRIG_BODY);
  });

  // InvenioRDM / Zenodo-style signposting:
  //  - Landing page → Link header with rel=linkset pointing to the API URL
  //  - API URL (Accept: application/linkset+json) → linkset+json with anchor matching
  //    the landing page, describing itself with type application/ld+json
  //  - API URL (Accept: application/ld+json) → JSON-LD metadata
  test('extracts RDF from InvenioRDM-style linkset (anchor matching + type-aware fetch)', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://repo.example/records/42';
    const API = 'https://repo.example/api/records/42';

    const JSONLD_BODY = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      'name': 'Test Dataset',
    });

    const LINKSET_BODY = JSON.stringify({
      linkset: [
        {
          anchor: LANDING,
          'cite-as': [{ href: 'https://doi.example/10.0000/42' }],
          describedby: [
            { href: API, type: 'application/ld+json' },
          ],
          type: [{ href: 'https://schema.org/Dataset' }],
        },
        // Extra entry for a file — should be ignored since anchor doesn't match LANDING
        {
          anchor: `${LANDING}/files/data.csv`,
          collection: [{ href: LANDING }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      // 1. Landing page — HTML with Link header pointing to the linkset
      if (url === LANDING) {
        return new Response('<html><body>Landing</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            link: `<${API}>; rel="linkset"; type="application/linkset+json"`,
          },
        });
      }

      // 2. API URL — returns linkset when asked, JSON-LD when asked for ld+json
      if (url === API) {
        if (accept.includes('application/linkset+json')) {
          return new Response(LINKSET_BODY, {
            status: 200,
            headers: { 'content-type': 'application/linkset+json' },
          });
        }
        if (accept.includes('application/ld+json')) {
          return new Response(JSONLD_BODY, {
            status: 200,
            headers: { 'content-type': 'application/ld+json' },
          });
        }
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.url).toBe(API);
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD_BODY);
  });

  // RFC 9264 Appendix A: JSON-LD linkset representation.
  // The linkset is served as application/ld+json with a top-level "linkset" array and @context.
  test('handles JSON-LD linkset format (application/ld+json with @context and linkset array)', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://repo.example/records/77';
    const API = 'https://repo.example/api/records/77';

    const TURTLE_BODY = '@prefix schema: <https://schema.org/> . <> a schema:Dataset .';

    const JSONLD_LINKSET_BODY = JSON.stringify({
      '@context': { linkset: 'https://www.iana.org/assignments/link-relations/linkset' },
      linkset: [
        {
          anchor: LANDING,
          describedby: [{ href: `${LANDING}.ttl`, type: 'text/turtle' }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === LANDING) {
        return new Response('<html><body>Landing</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            link: `<${API}>; rel="linkset"; type="application/ld+json"`,
          },
        });
      }
      if (url === API && accept.includes('application/linkset+json')) {
        return new Response(JSONLD_LINKSET_BODY, {
          status: 200,
          headers: { 'content-type': 'application/ld+json' },
        });
      }
      if (url === `${LANDING}.ttl`) {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });

  // RFC 9264 §4.1: application/linkset text format.
  // The linkset is served as UTF-8 text with Link-style entries.
  test('handles application/linkset text format', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/resource/55';
    const LINKSET_URL = 'https://data.example/resource/55.linkset';

    const TURTLE_BODY = '@prefix dct: <http://purl.org/dc/terms/> . <> a dct:Dataset .';

    // RFC 9264 §4.1 text linkset: Link-style entries with anchor
    const TEXT_LINKSET =
      `<${LANDING}.ttl> ; rel="describedby" ; type="text/turtle" ; anchor="${LANDING}" ,\n` +
      `<https://schema.org/Dataset> ; rel="type" ; anchor="${LANDING}"`;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === LANDING) {
        return new Response('<html><body>Resource</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            link: `<${LINKSET_URL}>; rel="linkset"; type="application/linkset"`,
          },
        });
      }
      if (url === LINKSET_URL && accept.includes('application/linkset+json')) {
        return new Response(TEXT_LINKSET, {
          status: 200,
          headers: { 'content-type': 'application/linkset' },
        });
      }
      if (url === `${LANDING}.ttl`) {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });

  // RFC 9264 §4: Linkset discovery via URI content negotiation.
  // No Link header — the URI itself serves the linkset when asked with the right Accept.
  test('discovers linkset via URI content negotiation (no Link header required)', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/resource/88';
    const TURTLE_BODY = '@prefix owl: <http://www.w3.org/2002/07/owl#> . <> a owl:Ontology .';

    const LINKSET_BODY = JSON.stringify({
      linkset: [
        {
          anchor: LANDING,
          describedby: [{ href: `${LANDING}.ttl`, type: 'text/turtle' }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === LANDING) {
        // Returns HTML for RDF Accept headers, linkset for linkset Accept headers
        if (accept.includes('application/linkset+json')) {
          return new Response(LINKSET_BODY, {
            status: 200,
            headers: { 'content-type': 'application/linkset+json' },
          });
        }
        return new Response('<html><body>Resource page</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (url === `${LANDING}.ttl`) {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });

  // Some servers return Content-Type: application/json even for JSON-LD payloads.
  // The linkset's declared type should be trusted when the body looks like JSON-LD.
  test('trusts linkset declared type when server returns application/json for JSON-LD', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://repo.example/records/99';
    const API = 'https://repo.example/api/records/99';

    const JSONLD_BODY = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      name: 'Another Dataset',
    });

    const LINKSET_BODY = JSON.stringify({
      linkset: [
        {
          anchor: LANDING,
          describedby: [{ href: API, type: 'application/ld+json' }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === LANDING) {
        return new Response('<html><body></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            link: `<${API}>; rel="linkset"; type="application/linkset+json"`,
          },
        });
      }

      if (url === API) {
        if (accept.includes('application/linkset+json')) {
          // Server returns application/json instead of application/linkset+json
          return new Response(LINKSET_BODY, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        // Metadata endpoint also returns application/json (not application/ld+json)
        return new Response(JSONLD_BODY, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    // Format should be the linkset-declared type, not application/json
    expect(result?.format).toBe('application/ld+json');
  });

  // GS1 Digital Link pattern: Link header points to ?linkType=all linkset URL.
  // The linkset URL returns a linkset+json with a describedby entry pointing back
  // to the original URI for the RDF representation.
  test('handles GS1 Digital Link pattern (Link: rel=linkset ?linkType=all)', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const PRODUCT_URI = 'https://id.gs1.org/01/09506000134352';
    const LINKSET_URL = `${PRODUCT_URI}?linkType=all`;
    const JSONLD_BODY = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: 'Example Product',
    });

    const LINKSET_BODY = JSON.stringify({
      linkset: [
        {
          anchor: PRODUCT_URI,
          describedby: [{ href: PRODUCT_URI, type: 'application/ld+json' }],
          type: [{ href: 'https://schema.org/Product' }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === PRODUCT_URI) {
        // Return linkset when the linkset Accept type is first (conneg discovery or header follow)
        if (accept.startsWith('application/linkset+json')) {
          return new Response(LINKSET_BODY, {
            status: 200,
            headers: { 'content-type': 'application/linkset+json' },
          });
        }
        // Return JSON-LD only when it is the highest-priority requested type
        // (i.e. this is the describedby fetch from within the linkset strategy,
        //  not the initial multi-MIME discovery fetch where turtle is q=1.0)
        if (accept.startsWith('application/ld+json')) {
          return new Response(JSONLD_BODY, {
            status: 200,
            headers: { 'content-type': 'application/ld+json' },
          });
        }
        // Default: HTML landing page with Link header pointing to linkset
        return new Response('<html><body>Product Page</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            link: `<${LINKSET_URL}>; rel="linkset"; type="application/linkset+json"`,
          },
        });
      }
      if (url === LINKSET_URL && accept.includes('application/linkset+json')) {
        return new Response(LINKSET_BODY, {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(PRODUCT_URI);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD_BODY);
  });

  // rel=profile with a linkset MIME type should be treated as a linkset URL.
  // This is equivalent to rel=linkset per RFC 9264 / GS1 Digital Link profile usage.
  test('treats rel=profile with linkset MIME type as a linkset source', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/item/42';
    const PROFILE_LINKSET_URL = 'https://data.example/item/42.linkset.json';
    const TURTLE_BODY = '@prefix skos: <http://www.w3.org/2004/02/skos/core#> . <> a skos:Concept .';

    const LINKSET_BODY = JSON.stringify({
      linkset: [
        {
          anchor: LANDING,
          describedby: [{ href: `${LANDING}.ttl`, type: 'text/turtle' }],
        },
      ],
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === LANDING) {
        return new Response('<html><body>Item</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            // Server advertises the linkset via rel=profile with linkset MIME type
            link: `<${PROFILE_LINKSET_URL}>; rel="profile"; type="application/linkset+json"`,
          },
        });
      }
      if (url === PROFILE_LINKSET_URL && accept.includes('application/linkset+json')) {
        return new Response(LINKSET_BODY, {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }
      if (url === `${LANDING}.ttl`) {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });

  // rel=profile with an RDF MIME type should be treated as a describedby URL.
  test('treats rel=profile with RDF MIME type as a describedby source', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/concept/77';
    const TURTLE_BODY = '@prefix owl: <http://www.w3.org/2002/07/owl#> . <> a owl:Class .';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === LANDING) {
        return new Response('<html><body>Concept</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            // Server advertises the RDF description via rel=profile with RDF MIME type
            link: `<${LANDING}.ttl>; rel="profile"; type="text/turtle"`,
          },
        });
      }
      if (url === `${LANDING}.ttl`) {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('signposting-link-header');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });
});

// ---- parseNTriples ----

import { parseNTriples, countRdfTriples, buildTriplestore } from './wrx.js';

describe('parseNTriples', () => {
  test('parses basic N-Triples', () => {
    const nt = [
      '<https://example.org/s> <https://example.org/p> <https://example.org/o> .',
      '<https://example.org/s> <https://example.org/p2> "hello" .',
    ].join('\n');
    const triples = parseNTriples(nt);
    expect(triples).toHaveLength(2);
    expect(triples[0]).toMatchObject({
      subject: '<https://example.org/s>',
      predicate: '<https://example.org/p>',
      object: '<https://example.org/o>',
    });
    expect(triples[1]).toMatchObject({
      subject: '<https://example.org/s>',
      predicate: '<https://example.org/p2>',
      object: '"hello"',
    });
  });

  test('skips empty lines and comments', () => {
    const nt = [
      '',
      '# this is a comment',
      '<https://example.org/s> <https://example.org/p> <https://example.org/o> .',
      '',
    ].join('\n');
    expect(parseNTriples(nt)).toHaveLength(1);
  });

  test('parses literals with language tags and datatypes', () => {
    const nt = [
      '<https://s> <https://p> "bonjour"@fr .',
      '<https://s> <https://p2> "42"^^<https://www.w3.org/2001/XMLSchema#integer> .',
    ].join('\n');
    const triples = parseNTriples(nt);
    expect(triples).toHaveLength(2);
    expect(triples[0]!.object).toBe('"bonjour"@fr');
    expect(triples[1]!.object).toBe('"42"^^<https://www.w3.org/2001/XMLSchema#integer>');
  });

  test('parses N-Quads and sets graph property', () => {
    const nq = '<https://s> <https://p> <https://o> <https://graph> .';
    const triples = parseNTriples(nq);
    expect(triples).toHaveLength(1);
    expect(triples[0]!.graph).toBe('<https://graph>');
  });

  test('parses blank node subjects and objects', () => {
    const nt = '_:b0 <https://example.org/p> _:b1 .';
    const triples = parseNTriples(nt);
    expect(triples).toHaveLength(1);
    expect(triples[0]!.subject).toBe('_:b0');
    expect(triples[0]!.object).toBe('_:b1');
  });

  test('returns empty array for empty input', () => {
    expect(parseNTriples('')).toHaveLength(0);
    expect(parseNTriples('   \n   ')).toHaveLength(0);
  });
});

// ---- countRdfTriples ----

describe('countRdfTriples', () => {
  test('counts N-Triples exactly', () => {
    const nt = [
      '<https://s> <https://p> <https://o> .',
      '<https://s> <https://p2> "hello" .',
      '# comment',
      '',
    ].join('\n');
    expect(countRdfTriples(nt, 'application/n-triples')).toBe(2);
  });

  test('counts N-Quads exactly', () => {
    const nq = [
      '<https://s> <https://p> <https://o> <https://g> .',
      '<https://s2> <https://p> <https://o> <https://g> .',
    ].join('\n');
    expect(countRdfTriples(nq, 'application/n-quads')).toBe(2);
  });

  test('counts JSON-LD triples approximately', () => {
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      'name': 'Test',
      'description': 'A test dataset',
    });
    // @type = 1, name = 1, description = 1 → 3 triples
    expect(countRdfTriples(jsonLd, 'application/ld+json')).toBe(3);
  });

  test('returns 0 for invalid JSON-LD', () => {
    expect(countRdfTriples('not json', 'application/ld+json')).toBe(0);
  });

  test('returns -1 for Turtle (requires external parser)', () => {
    expect(countRdfTriples('@prefix ex: <https://ex.org/> . ex:s ex:p ex:o .', 'text/turtle')).toBe(-1);
  });

  test('returns -1 for RDF/XML (requires external parser)', () => {
    expect(countRdfTriples('<rdf:RDF/>', 'application/rdf+xml')).toBe(-1);
  });
});

// ---- buildTriplestore ----

describe('buildTriplestore', () => {
  test('builds triplestore from N-Triples source', () => {
    const src = {
      content: '<https://s> <https://p> <https://o> .',
      format: 'application/n-triples',
      source: 'content-negotiation' as const,
      url: 'https://example.org/',
    };
    const ts = buildTriplestore([src]);
    expect(ts.triples).toHaveLength(1);
    expect(ts.sources).toHaveLength(1);
    expect(ts.triples[0]).toMatchObject({
      subject: '<https://s>',
      predicate: '<https://p>',
      object: '<https://o>',
    });
  });

  test('deduplicates identical triples from multiple sources', () => {
    const triple = '<https://s> <https://p> <https://o> .';
    const src1 = { content: triple, format: 'application/n-triples', source: 'content-negotiation' as const, url: 'https://a/' };
    const src2 = { content: triple, format: 'application/n-quads', source: 'linkset' as const, url: 'https://b/' };
    const ts = buildTriplestore([src1, src2]);
    expect(ts.triples).toHaveLength(1); // deduplicated
    expect(ts.sources).toHaveLength(2);
  });

  test('includes non-N-Triples sources in sources list but not in triples', () => {
    const src = {
      content: '@prefix ex: <https://ex.org/> . ex:s ex:p ex:o .',
      format: 'text/turtle',
      source: 'content-negotiation' as const,
      url: 'https://example.org/',
    };
    const ts = buildTriplestore([src]);
    expect(ts.triples).toHaveLength(0); // Turtle not parseable without external lib
    expect(ts.sources).toHaveLength(1);
  });

  test('returns empty triplestore for empty sources', () => {
    const ts = buildTriplestore([]);
    expect(ts.triples).toHaveLength(0);
    expect(ts.sources).toHaveLength(0);
  });
});
