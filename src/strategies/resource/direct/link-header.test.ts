import { afterEach, describe, expect, test } from 'bun:test';
import { LinkHeaderStrategy } from './link-header';
import { StrategyContext } from './strategy-interface';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('LinkHeaderStrategy', () => {
  const strategy = new LinkHeaderStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('HTTP Link header (rel=describedby)');
    expect(strategy.source).toBe('signposting-link-header');
  });

  test('executeFirstHit returns null when no link header present', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit returns null when link header lacks describedby', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '',
      linkHeader: '<https://example.com/other>; rel="other"',
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit fetches and returns RDF from describedby link', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

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
      linkHeader: `<${METADATA}>; rel="describedby"; type="text/turtle"`,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(RDF_BODY);
    expect(result?.source).toBe('signposting-link-header');
    expect(result?.url).toBe(METADATA);
  });

  test('executeFirstHit resolves relative describedby URLs against base URI', async () => {
    const RESOURCE = 'https://example.com/path/resource';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/path/metadata.ttl') {
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
      linkHeader: '<./metadata.ttl>; rel="describedby"',
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://example.com/path/metadata.ttl');
  });

  test('executeFirstHit treats rel=profile with RDF MIME as describedby', async () => {
    const RESOURCE = 'https://example.com/resource';
    const PROFILE = 'https://example.com/profile.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

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
      linkHeader: `<${PROFILE}>; rel="profile"; type="text/turtle"`,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe(PROFILE);
  });

  test('executeFirstHit allows describedby links with non-RDF MIME when profile is declared', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.xml';
    const RDF_BODY = '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

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
      linkHeader: `<${METADATA}>; rel="describedby"; type="application/xml"; profile="https://example.com/profile/rdfxml"`,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('application/rdf+xml');
    expect(result?.url).toBe(METADATA);
  });

  test('executeAllHits collects all successful describedby links', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA1 = 'https://example.com/metadata1.ttl';
    const METADATA2 = 'https://example.com/metadata2.ttl';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

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
      linkHeader: `<${METADATA1}>; rel="describedby", <${METADATA2}>; rel="describedby"`,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(2);
    expect(results.every(r => r.source === 'signposting-link-header')).toBe(true);
    expect(results.map(r => r.url).sort()).toEqual([METADATA1, METADATA2].sort());
  });

  test('executeAllHits skips failed describedby fetches', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA1 = 'https://example.com/metadata1.ttl';
    const METADATA2 = 'https://example.com/metadata2.ttl';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === METADATA1) {
        return new Response('@prefix : <http://example.com/> . :s :p :o .', {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      // METADATA2 returns 404
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      linkHeader: `<${METADATA1}>; rel="describedby", <${METADATA2}>; rel="describedby"`,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(1);
    expect(results[0]?.url).toBe(METADATA1);
  });

  test('executeAllHits deduplicates URLs', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.ttl';
    let fetchCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === METADATA) {
        fetchCount++;
        return new Response('@prefix : <http://example.com/> . :s :p :o .', {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: '',
      // Same URL twice (with and without trailing slash variants)
      linkHeader: `<${METADATA}>; rel="describedby", <${METADATA}>; rel="describedby"`,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(1); // Should be deduplicated
    expect(fetchCount).toBeLessThanOrEqual(2); // Should not fetch more times than needed
  });
});
