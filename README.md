# wrx
Web resource extraction for RDF metadata discovery.

`wrx.js` is the public entrypoint in this repository. It uses a cascading discovery strategy: content negotiation first, then FAIR signposting through HTTP and HTML links, then linkset resolution, embedded RDF scripts, and finally sitemap/DCAT fallback.

## Install

Install directly from GitHub in another Bun project:

```bash
bun add github:cedricdcc/wrx
```

## Usage

```ts
import { extractRDF, type ExtractedRDF } from "wrx";

const result: ExtractedRDF | null = await extractRDF("https://example.org/dataset");

if (result) {
	console.log(result.source);
	console.log(result.format);
	console.log(result.url);
}
```

When working in this repository directly, import from `./wrx.js`.

This package targets Bun runtime APIs.
