import { afterEach, describe, expect, test } from 'bun:test';
import { extractAllRDF, extractRDF } from './wrx.js';

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
  test('package metadata matches wrx repository identity', async () => {
    const packageJsonPath = new URL('./package.json', import.meta.url);
    const packageJsonRaw = await Bun.file(packageJsonPath).text();
    const pkg = JSON.parse(packageJsonRaw) as {
      name?: string;
      repository?: { url?: string };
      bugs?: { url?: string };
      homepage?: string;
    };

    expect(pkg.name).toBe('wrx');
    expect(pkg.repository?.url).toBe('git+https://github.com/cedricdcc/wrx.git');
    expect(pkg.bugs?.url).toBe('https://github.com/cedricdcc/wrx/issues');
    expect(pkg.homepage).toBe('https://github.com/cedricdcc/wrx#readme');
  });

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

  test('skips a failing header follow-up fetch and continues to later strategies', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/failover/1';
    const METADATA = `${LANDING}.ttl`;
    const JSONLD_BODY = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      name: 'Fallback Dataset',
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === LANDING) {
        return new Response(
          '<html><head></head><body><script type="application/ld+json">' +
            JSONLD_BODY +
            '</script></body></html>',
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
              link: `<${METADATA}>; rel="describedby"; type="text/turtle"`,
            },
          }
        );
      }

      if (url === METADATA) {
        throw new TypeError('Failed to fetch');
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('embedded-script');
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD_BODY);
  });

  test('falls back to embedded scripts when HTML describedby link returns 405', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const LANDING = 'https://data.example/resource/405-fallback';
    const METADATA_URL = 'https://data.example/resource/405-fallback/metadata.ttl';
    const JSONLD_BODY = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      name: 'Resource with 405 Fallback',
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === LANDING) {
        return new Response(
          '<html><head><link rel="describedby" href="./metadata.ttl" type="text/turtle"></head><body>' +
            '<script type="application/ld+json">' +
            JSONLD_BODY +
            '</script></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      }

      if (url === METADATA_URL) {
        return new Response('Method Not Allowed', { status: 405 });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(LANDING);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('embedded-script');
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD_BODY);
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

  // When the RDF content negotiation fetch returns a non-HTML, non-RDF body
  // (e.g. an empty 406 error), the module must fall back to a plain-HTML fetch
  // so that HTML signposting strategies can still discover RDF.
  test('falls back to HTML fetch when content negotiation yields no HTML body', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const URI = 'https://data.example/no-html-from-conneg';
    const TURTLE_BODY = '@prefix dct: <http://purl.org/dc/terms/> . <> a dct:Dataset .';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === URI) {
        // Simulate a server that rejects the RDF Accept header with an empty 406
        if (accept.includes('text/turtle')) {
          return new Response('', { status: 406, headers: { 'content-type': 'text/plain' } });
        }
        // Plain-HTML fallback fetch returns an HTML page with signposting
        return new Response(
          '<html><head><link rel="describedby" href="./data.ttl" type="text/turtle"></head></html>',
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }

      if (url === 'https://data.example/data.ttl') {
        return new Response(TURTLE_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(URI);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('signposting-html-link');
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE_BODY);
  });

  // When the initial fetch throws entirely (e.g. network error), the module must
  // still attempt a plain-HTML fetch and run HTML signposting strategies.
  test('falls back to HTML fetch when initial fetch throws a network error', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const URI = 'https://data.example/throws-on-rdf-accept';
    const JSONLD_BODY = JSON.stringify({ '@context': 'https://schema.org/', '@type': 'Dataset' });
    let callCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      callCount += 1;

      if (url === URI && callCount === 1) {
        // First fetch (RDF content negotiation) — simulate network error
        throw new TypeError('Failed to fetch');
      }

      if (url === URI) {
        // HTML fallback fetch returns page with embedded JSON-LD
        return new Response(
          '<html><body><script type="application/ld+json">' + JSONLD_BODY + '</script></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await extractRDF(URI);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('embedded-script');
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD_BODY);
  });
});

describe('extractAllRDF', () => {
  test('returns the full ordered strategy trace', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const DATASET = 'https://trace.example/dataset';
    const TRIG_BODY = '@prefix : <https://trace.example/> . { :s :p :o . }';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === DATASET) {
        if (accept === 'application/trig') {
          return new Response(TRIG_BODY, {
            status: 200,
            headers: { 'content-type': 'application/trig' },
          });
        }
        return new Response('<html><body>No signposting</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }

      if (url === 'https://trace.example/robots.txt') {
        return new Response('User-agent: *\nDisallow: /', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const overview = await extractAllRDF(DATASET);

    expect(overview.trace).toHaveLength(6);
    expect(overview.trace.map((s) => s.source)).toEqual([
      'content-negotiation',
      'signposting-link-header',
      'linkset',
      'signposting-html-link',
      'embedded-script',
      'sitemap-signposting',
    ]);

    const contentNegotiationStep = overview.trace[0];
    expect(contentNegotiationStep.strategy).toBe(1);
    expect(contentNegotiationStep.found).toBe(true);
    expect(contentNegotiationStep.hits).toEqual([
      {
        format: 'application/trig',
        url: DATASET,
        chars: TRIG_BODY.length,
      },
    ]);

    const sitemapStep = overview.trace[5];
    expect(sitemapStep.strategy).toBe(6);
    expect(sitemapStep.found).toBe(false);
    expect(sitemapStep.hits).toEqual([]);
  });

  // When content negotiation succeeds (returns RDF), the HTML body is discarded.
  // The module must make a separate plain-HTML fetch so that HTML signposting
  // strategies run and can report additional RDF sources.
  test('discovers HTML signposting sources even when content negotiation succeeds', async () => {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;

    const URI = 'https://data.example/dual-source';
    const CN_RDF = '@prefix : <https://example/cn/> . :s :p :o .';
    const HTML_RDF = '@prefix : <https://example/html/> . :x :y :z .';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === URI) {
        // Returns Turtle when asked with a specific MIME (individual conneg probes)
        if (accept === 'text/turtle') {
          return new Response(CN_RDF, {
            status: 200,
            headers: { 'content-type': 'text/turtle' },
          });
        }
        // Returns HTML for the plain-HTML fallback fetch
        if (accept.startsWith('text/html')) {
          return new Response(
            `<html><head><link rel="describedby" href="${URI}.extra.ttl" type="text/turtle"></head></html>`,
            { status: 200, headers: { 'content-type': 'text/html' } }
          );
        }
        // Discovery fetch (multi-MIME Accept) also returns Turtle
        return new Response(CN_RDF, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      if (url === `${URI}.extra.ttl`) {
        return new Response(HTML_RDF, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const overview = await extractAllRDF(URI);

    // Content negotiation should have found RDF
    expect(overview.found.some((r) => r.source === 'content-negotiation')).toBe(true);
    // HTML signposting should also have found RDF from the HTML fallback fetch
    expect(overview.found.some((r) => r.source === 'signposting-html-link')).toBe(true);
  });
});
