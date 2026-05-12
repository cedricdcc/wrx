import { afterEach, describe, expect, test } from 'bun:test';
import { ContentNegotiationStrategy } from './content-negotiation';
import { StrategyContext } from './strategy-interface';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ContentNegotiationStrategy', () => {
  const strategy = new ContentNegotiationStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('Content Negotiation');
    expect(strategy.source).toBe('content-negotiation');
  });

  test('executeFirstHit returns RDF on successful content negotiation', async () => {
    const URI = 'https://example.com/resource';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      expect(url).toBe(URI);
      expect(accept).toBeTruthy(); // Should have Accept header

      return new Response(RDF_BODY, {
        status: 200,
        headers: { 'content-type': 'text/turtle; charset=utf-8' },
      });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: URI,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(RDF_BODY);
    expect(result?.source).toBe('content-negotiation');
    expect(result?.url).toBe(URI);
  });

  test('executeFirstHit returns null when response is non-RDF', async () => {
    globalThis.fetch = (async () => {
      return new Response('<html><body>Not RDF</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
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

  test('executeFirstHit returns null on fetch error', async () => {
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

  test('executeAllHits collects all RDF formats found', async () => {
    const URI = 'https://example.com/resource';
    const mimeResults: Record<string, string> = {
      'text/turtle': '@prefix : <http://example.com/> . :s :p :o .',
      'application/rdf+xml': '<?xml version="1.0"?><rdf:RDF></rdf:RDF>',
      'application/ld+json': '{"@context": "http://schema.org/"}',
    };

    let requestCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const accept = (init?.headers as Record<string, string> | undefined)?.['Accept'] ?? '';

      expect(url).toBe(URI);

      requestCount++;

      // Return matching format for each mime type request
      for (const [mime, body] of Object.entries(mimeResults)) {
        if (accept === mime) {
          return new Response(body, {
            status: 200,
            headers: { 'content-type': mime },
          });
        }
      }

      // Default: return 406 if no match
      return new Response('Not Acceptable', { status: 406 });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: URI,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.source === 'content-negotiation')).toBe(true);
    expect(results.every(r => r.url === URI)).toBe(true);
    expect(requestCount).toBeGreaterThan(1); // Should try multiple MIME types
  });

  test('executeAllHits deduplicates by format', async () => {
    const URI = 'https://example.com/resource';
    const BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async () => {
      return new Response(BODY, {
        status: 200,
        headers: { 'content-type': 'text/turtle' },
      });
    }) as typeof fetch;

    const ctx: StrategyContext = {
      uri: URI,
      bodyText: '',
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    // Should have only one turtle result (deduplicated)
    const turtleResults = results.filter(r => r.format === 'text/turtle');
    expect(turtleResults.length).toBeLessThanOrEqual(1);
  });
});
