# wrx
Web resource extraction for RDF metadata discovery.

`wrx.js` is the public entrypoint in this repository. It uses a cascading discovery strategy: content negotiation first, then FAIR signposting through HTTP and HTML links, then linkset resolution, embedded RDF scripts, and finally sitemap/DCAT fallback. The CLI parser and runner live in separate modules under `src/cli/`.

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

Show CLI help:

```sh
bun run wrx.js --help
```

Explore all extraction strategies:

```sh
bun run wrx.js --all https://example.org/dataset
```

Extend CLI output with modeled web-link relations (JSON + xhtml Turtle-like block):

```sh
bun run wrx.js --extend-links https://example.org/dataset
```

Enable FAIR profile discovery summary:

```sh
bun run wrx.js --profile https://example.org/dataset
```

Write the extracted RDF to a file chosen by extension:

```sh
bun run wrx.js --output dataset.ttl https://example.org/dataset
```

Flags can be combined, for example:

```sh
bun run wrx.js --all --extend-links --profile https://example.org/dataset
```

`--profile` now reports discovered profile URIs from Link headers/linksets (including `profile` link-extension attributes and `rel=profile` targets).

`--output` writes the extracted RDF payload to the requested path. Relative paths are resolved from the current working directory, and the destination extension must map to a supported RDF MIME type.

In addition to RDF extraction, the library also exports `extractLinkRelations(uri)` to harvest modeled web-link relations (e.g., `describedby`, `cite-as`, `item`, `license`, `author`) for signposting graph use cases.

This package targets Bun runtime APIs.
