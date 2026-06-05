import { afterEach, describe, expect, test } from 'bun:test';
import { HtmlSignpostingStrategy } from './html-signposting';
import { StrategyContext } from './strategy-interface';

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

describe('HtmlSignpostingStrategy', () => {
  const strategy = new HtmlSignpostingStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('HTML link[rel=describedby]');
    expect(strategy.source).toBe('signposting-html-link');
  });

  test('executeFirstHit returns null when no body text', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit returns null when no describedby links', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '<html><head><link rel="alternate" href="/other"></head></html>',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit extracts RDF from link[rel=describedby]', async () => {
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
      bodyText: `<html><head><link href="${METADATA}" rel="describedby" type="text/turtle"></head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(RDF_BODY);
    expect(result?.source).toBe('signposting-html-link');
    expect(result?.url).toBe(METADATA);
  });

  test('executeFirstHit resolves relative URLs against base URI', async () => {
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
      bodyText: '<html><head><link href="./metadata.ttl" rel="describedby"></head></html>',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://example.com/path/metadata.ttl');
  });

  test('executeFirstHit returns first matching link when multiple exist', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA1 = 'https://example.com/metadata1.ttl';
    const METADATA2 = 'https://example.com/metadata2.ld+json';

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
      bodyText: `<html><head>
        <link href="${METADATA1}" rel="describedby" type="text/turtle">
        <link href="${METADATA2}" rel="describedby" type="application/ld+json">
      </head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe(METADATA1);
  });

  test('executeFirstHit skips links with failed fetch', async () => {
    const RESOURCE = 'https://example.com/resource';
    const FAILED_METADATA = 'https://example.com/failed.ttl';
    const SUCCESS_METADATA = 'https://example.com/success.ttl';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === FAILED_METADATA) {
        return new Response('Not found', { status: 404 });
      }

      if (url === SUCCESS_METADATA) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: `<html><head>
        <link href="${FAILED_METADATA}" rel="describedby">
        <link href="${SUCCESS_METADATA}" rel="describedby">
      </head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.url).toBe(SUCCESS_METADATA);
  });

  test('executeAllHits collects all matching links', async () => {
    const RESOURCE = 'https://example.com/resource';
    const METADATA1 = 'https://example.com/metadata1.ttl';
    const METADATA2 = 'https://example.com/metadata2.ld+json';

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
      bodyText: `<html><head>
        <link href="${METADATA1}" rel="describedby">
        <link href="${METADATA2}" rel="describedby">
      </head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(2);
    expect(results.every(r => r.source === 'signposting-html-link')).toBe(true);
    expect(results.map(r => r.url).sort()).toEqual([METADATA1, METADATA2].sort());
  });

  test('executeAllHits skips links with non-RDF declared type', async () => {
    const RESOURCE = 'https://example.com/resource';

    const ctx: StrategyContext = {
      uri: RESOURCE,
      bodyText: `<html><head>
        <link href="https://example.com/doc.html" rel="describedby" type="text/html">
      </head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(0);
  });

  test('executeFirstHit accepts link without type attribute', async () => {
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
      bodyText: `<html><head><link href="${METADATA}" rel="describedby"></head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.source).toBe('signposting-html-link');
  });

  test('executeFirstHit handles case-insensitive rel attribute parsing', async () => {
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
      bodyText: `<html><head><link href="${METADATA}" rel="DescribedBy"></head></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
  });
});
