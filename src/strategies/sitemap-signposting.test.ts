import { afterEach, describe, expect, test } from 'bun:test';
import { SitemapSignpostingStrategy } from './sitemap-signposting';
import { StrategyContext } from './strategy-interface';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('SitemapSignpostingStrategy', () => {
  const strategy = new SitemapSignpostingStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('Sitemap signposting');
    expect(strategy.source).toBe('sitemap-signposting');
  });

  test('executeFirstHit returns null when robots.txt fetch fails', async () => {
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

  test('executeFirstHit returns null when robots.txt not found', async () => {
    globalThis.fetch = (async () => {
      return new Response('Not found', { status: 404 });
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

  test('executeFirstHit returns null when no sitemaps found', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response('User-agent: *\nDisallow: /admin', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      return new Response('Not found', { status: 404 });
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

  test('executeFirstHit returns null when sitemap entry does not match URI', async () => {
    const RESOURCE = 'https://example.com/resource';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response('Sitemap: https://example.com/sitemap.xml', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/sitemap.xml') {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
              <loc>https://example.com/other</loc>
            </url>
          </urlset>`, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
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

  test('executeFirstHit tries multiple sitemaps but returns null if none have match', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response(`Sitemap: https://example.com/sitemap1.xml
Sitemap: https://example.com/sitemap2.xml`, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/sitemap1.xml' || url === 'https://example.com/sitemap2.xml') {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/other</loc></url>
          </urlset>`, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        });
      }

      return new Response('Not found', { status: 404 });
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

  test('executeAllHits returns empty array when no matches found', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response('Sitemap: https://example.com/sitemap.xml', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/sitemap.xml') {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/other</loc></url>
          </urlset>`, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(0);
  });

  test('executeFirstHit supports ResourceSync rs:ln describedby links', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response('Sitemap: https://example.com/sitemap.xml', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/sitemap.xml') {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:rs="http://www.openarchives.org/rs/terms/">
            <url>
              <loc>${RESOURCE}</loc>
              <rs:ln rel="describedby" href="${METADATA}" type="text/turtle" />
            </url>
          </urlset>`, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
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
    expect(result?.format).toBe('text/turtle');
  });

  test('executeFirstHit accepts non-RDF declared type when profile is present in sitemap links', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA = 'https://example.com/metadata.xml';
    const RDF_BODY = '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://example.com/robots.txt') {
        return new Response('Sitemap: https://example.com/sitemap.xml', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }

      if (url === 'https://example.com/sitemap.xml') {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
            <url>
              <loc>${RESOURCE}</loc>
              <xhtml:link rel="describedby" href="${METADATA}" type="application/xml" profile="https://example.com/profile/rdfxml" />
            </url>
          </urlset>`, {
          status: 200,
          headers: { 'content-type': 'application/xml' },
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
});
