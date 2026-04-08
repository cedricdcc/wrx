import { afterEach, describe, expect, test } from 'bun:test';
import { extractRDF } from './rdf-extractor';

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
});
