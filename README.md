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

### CLI

Quick first-match mode:

```sh
bun run wrx.js https://example.org/dataset
```

Explore all extraction strategies:

```sh
bun run wrx.js --all https://example.org/dataset
```

Extend CLI output with modeled web-link relations (JSON + xhtml Turtle-like block):

```sh
bun run wrx.js --extend-links https://example.org/dataset
```

Enable post-harvest profile hook placeholder:

```sh
bun run wrx.js --profile https://example.org/dataset
```

Flags can be combined, for example:

```sh
bun run wrx.js --all --extend-links --profile https://example.org/dataset
```

`--profile` is currently a placeholder step and intentionally does not perform profile extraction yet.

This package targets Bun runtime APIs.
