# uri_gator
Typescript module for URI to rdf navigation

## Install

Install directly from GitHub in another Bun project:

```bash
bun add github:cedricdcc/uri_gator
```

## Usage

```ts
import { extractRDF, type ExtractedRDF } from "uri_gator";

const result: ExtractedRDF | null = await extractRDF("https://example.org/dataset");

if (result) {
	console.log(result.source);
	console.log(result.format);
	console.log(result.url);
}
```

This package targets Bun runtime APIs.
