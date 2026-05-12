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
});
