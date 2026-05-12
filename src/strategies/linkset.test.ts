import { afterEach, describe, expect, test } from 'bun:test';
import { LinksetStrategy } from './linkset';
import { StrategyContext } from './strategy-interface';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('LinksetStrategy', () => {
  const strategy = new LinksetStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('RFC 9264 Linkset');
    expect(strategy.source).toBe('linkset');
  });

  test('executeFirstHit returns null when linkset fetch fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Network error');
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit processes JSON linkset format', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          describedby: [{ href: METADATA, type: 'text/turtle' }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === RESOURCE && accept.includes('linkset')) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === METADATA) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(RDF_BODY);
    expect(result?.source).toBe('linkset');
    expect(result?.url).toBe(METADATA);
  });

  test('executeFirstHit filters linkset entries by anchor', async () => {
    const RESOURCE = 'https://example.com/resource';
    const OTHER_RESOURCE = 'https://example.com/other';
    const METADATA = 'https://example.com/metadata.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    const linksetData = {
      linkset: [
        {
          anchor: OTHER_RESOURCE,
          describedby: [{ href: 'https://example.com/other-metadata.ttl' }],
        },
        {
          anchor: RESOURCE,
          describedby: [{ href: METADATA, type: 'text/turtle' }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === METADATA) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe(METADATA);
  });

  test('executeFirstHit processes rel=profile in linkset', async () => {
    const RESOURCE = 'https://example.com/resource';
    const PROFILE = 'https://example.com/profile.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          profile: [{ href: PROFILE, type: 'text/turtle' }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === PROFILE) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe(PROFILE);
  });

  test('executeFirstHit accepts non-RDF declared type when target has profile attribute', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.xml';
    const RDF_BODY = '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          describedby: [{ href: METADATA, type: 'application/xml', profile: 'https://example.com/profile/rdfxml' }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === METADATA) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'application/rdf+xml' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('application/rdf+xml');
    expect(result?.url).toBe(METADATA);
  });

  test('executeFirstHit processes cite-as fallback', async () => {
    const RESOURCE = 'https://example.com/resource';
    const DOI = 'https://doi.org/10.1234/example';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          'cite-as': [{ href: DOI }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === DOI && accept.includes('rdf')) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
  });

  test('executeAllHits collects all matching RDF entries', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA1 = 'https://example.com/metadata1.ttl';
    const METADATA2 = 'https://example.com/metadata2.ld+json';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          describedby: [
            { href: METADATA1, type: 'text/turtle' },
            { href: METADATA2, type: 'application/ld+json' },
          ],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      if (url === METADATA1) {
        return new Response('@prefix : <http://example.com/> . :s :p :o .', {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      if (url === METADATA2) {
        return new Response('{"@context":"http://schema.org/"}', {
          status: 200,
          headers: { 'content-type': 'application/ld+json' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(r => r.source === 'linkset')).toBe(true);
  });

  test('executeFirstHit skips entries with non-RDF declared type', async () => {
    const RESOURCE = 'https://example.com/resource';

    const linksetData = {
      linkset: [
        {
          anchor: RESOURCE,
          describedby: [
            { href: 'https://example.com/doc.html', type: 'text/html' },
          ],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/linkset+json' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).toBeNull();
  });

  test('executeFirstHit handles application/ld+json linkset format', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    const linksetData = {
      '@context': 'https://www.iana.org/assignments/link-relations/linkset',
      linkset: [
        {
          anchor: RESOURCE,
          describedby: [{ href: METADATA, type: 'text/turtle' }],
        },
      ],
    };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === RESOURCE) {
        return new Response(JSON.stringify(linksetData), {
          status: 200,
          headers: { 'content-type': 'application/ld+json' },
        });
      }

      if (url === METADATA) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('linkset');
  });
});
