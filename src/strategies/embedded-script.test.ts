import { afterEach, describe, expect, test } from 'bun:test';
import { EmbeddedScriptStrategy } from './embedded-script';
import { StrategyContext } from './strategy-interface';

const originalDOMParser = (globalThis as { DOMParser?: unknown }).DOMParser;

afterEach(() => {
  if (originalDOMParser === undefined) {
    delete (globalThis as { DOMParser?: unknown }).DOMParser;
  } else {
    (globalThis as { DOMParser?: unknown }).DOMParser = originalDOMParser;
  }
});

describe('EmbeddedScriptStrategy', () => {
  const strategy = new EmbeddedScriptStrategy();

  test('properties are set correctly', () => {
    expect(strategy.label).toBe('Embedded RDF script');
    expect(strategy.source).toBe('embedded-script');
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

  test('executeFirstHit returns null when no embedded scripts', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '<html><body>No scripts here</body></html>',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit extracts JSON-LD from script tag', async () => {
    const JSONLD = '{"@context":"http://schema.org/","@type":"Dataset"}';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body><script type="application/ld+json">${JSONLD}</script></body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD);
    expect(result?.source).toBe('embedded-script');
    expect(result?.url).toBe('https://example.com/resource');
  });

  test('executeFirstHit extracts Turtle from script tag', async () => {
    const TURTLE = '@prefix : <http://example.com/> . :s :p :o .';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body><script type="text/turtle">${TURTLE}</script></body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('text/turtle');
    expect(result?.content).toBe(TURTLE);
  });

  test('executeFirstHit returns first script when multiple RDF scripts exist', async () => {
    const JSONLD = '{"@context":"http://schema.org/"}';
    const TURTLE = '@prefix : <http://example.com/> . :s :p :o .';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body>
        <script type="application/ld+json">${JSONLD}</script>
        <script type="text/turtle">${TURTLE}</script>
      </body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('application/ld+json');
    expect(result?.content).toBe(JSONLD);
  });

  test('executeFirstHit ignores script tags without type attribute', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '<html><body><script>console.log("hello");</script></body></html>',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit ignores script tags with non-RDF type', async () => {
    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: '<html><body><script type="text/javascript">console.log("hello");</script></body></html>',
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);
    expect(result).toBeNull();
  });

  test('executeFirstHit handles case-insensitive type attribute', async () => {
    const JSONLD = '{"@context":"http://schema.org/"}';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body><script type="APPLICATION/LD+JSON">${JSONLD}</script></body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('application/ld+json');
  });

  test('executeAllHits collects all embedded RDF scripts', async () => {
    const JSONLD = '{"@context":"http://schema.org/"}';
    const TURTLE = '@prefix : <http://example.com/> . :s :p :o .';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body>
        <script type="application/ld+json">${JSONLD}</script>
        <script type="text/turtle">${TURTLE}</script>
      </body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(2);
    expect(results.every(r => r.source === 'embedded-script')).toBe(true);
    expect(results.map(r => r.format).sort()).toEqual(['application/ld+json', 'text/turtle'].sort());
  });

  test('executeAllHits skips non-RDF scripts', async () => {
    const JSONLD = '{"@context":"http://schema.org/"}';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body>
        <script type="application/ld+json">${JSONLD}</script>
        <script type="text/javascript">console.log("hello");</script>
      </body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const results = await strategy.executeAllHits(ctx);

    expect(results.length).toBe(1);
    expect(results[0]?.format).toBe('application/ld+json');
  });

  test('executeFirstHit strips whitespace from script content', async () => {
    const JSONLD = '{"@context":"http://schema.org/"}';

    const ctx: StrategyContext = {
      uri: 'https://example.com/resource',
      bodyText: `<html><body>
        <script type="application/ld+json">
          ${JSONLD}
        </script>
      </body></html>`,
      linkHeader: null,
      htmlDoc: null,
    };

    const result = await strategy.executeFirstHit(ctx);

    expect(result).not.toBeNull();
    expect(result?.content).toBe(JSONLD);
  });
});
