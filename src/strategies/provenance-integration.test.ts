import { afterEach, describe, expect, test } from 'bun:test';
import { discoverFirstRdf, discoverAllRdf } from './pipeline';
import type { ExtractedRDF } from '../core/types';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('PROV-O Provenance Tracking Integration', () => {
  test('discoverFirstRdf generates a valid provenance graph', async () => {
    const URI = 'https://example.com/provenance-test';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === URI) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const hit = await discoverFirstRdf(URI);

    expect(hit).not.toBeNull();
    expect(hit?.provenance).toBeDefined();

    const prov = hit!.provenance!;
    
    // Check prefixes
    expect(prov).toContain('@prefix prov: <http://www.w3.org/ns/prov#>');
    expect(prov).toContain('@prefix wrx: <https://cedricdcc.github.io/wrx/vocab.ttl#>');
    expect(prov).toContain('@prefix xsd: <http://www.w3.org/2001/XMLSchema#>');

    // Check target resource assertion
    expect(prov).toContain(`<${URI}> a prov:Entity, wrx:TargetResource .`);

    // Check SoftwareAgent assertion
    expect(prov).toContain('a prov:SoftwareAgent');

    // Check overall extraction activity
    expect(prov).toContain('a prov:Activity, wrx:ExtractionActivity');
    expect(prov).toContain(`prov:used <${URI}>`);

    // Check strategy execution
    expect(prov).toContain('a prov:Activity, wrx:StrategyActivity');

    // Check the derived from relationships for successful metadata
    expect(prov).toContain(`<${URI}#extracted-metadata> a prov:Entity, wrx:ExtractedMetadata ;`);
    expect(prov).toContain(`prov:wasDerivedFrom <${URI}> ;`);
  });

  test('discoverAllRdf generates a valid provenance graph with trace', async () => {
    const URI = 'https://example.com/provenance-all-test';
    const RDF_BODY = '@prefix : <http://example.com/> . :s :p :o .';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === URI) {
        return new Response(RDF_BODY, {
          status: 200,
          headers: { 'content-type': 'text/turtle' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const overview = await discoverAllRdf(URI);

    expect(overview).toBeDefined();
    expect(overview.provenance).toBeDefined();

    const prov = overview.provenance!;

    // Check prefixes
    expect(prov).toContain('@prefix prov: <http://www.w3.org/ns/prov#>');
    expect(prov).toContain('@prefix wrx: <https://cedricdcc.github.io/wrx/vocab.ttl#>');

    // Check target resource assertion
    expect(prov).toContain(`<${URI}> a prov:Entity, wrx:TargetResource .`);

    // Check overall extraction activity
    expect(prov).toContain('a prov:Activity, wrx:ExtractionActivity');

    // Check that conneg plan was instantiated
    expect(prov).toContain('<https://cedricdcc.github.io/wrx/vocab.ttl#ContentNegotiationPlan> a prov:Plan, wrx:ContentNegotiationPlan');
  });
});
