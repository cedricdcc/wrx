# wrx.js — Web Resource Extraction Documentation

## Overview

`wrx.js` is a zero-dependency Bun/TypeScript module for web resource extraction from any URI. It retrieves RDF metadata using a **cascading strategy**: each discovery step is tried in priority order and the first successful result is immediately returned. The module never requires external npm packages — it uses only Bun's built-in `fetch`, `URL`, and `DOMParser`.

---

## Module Architecture

```mermaid
graph TB
    subgraph "wrx.js — Public API"
        A["extractRDF(uri: string)\nreturns Promise of ExtractedRDF or null"]
    end

    subgraph "Internal Helpers"
        B["fetchRDF(url)\nSends Accept header for RDF MIME types"]
        B2["fetchDescribedBy(url, declaredType?)\nType-aware fetch — puts declared MIME first in Accept"]
        C["parseLinkHeader(header)\nParses HTTP Link / RFC 9264 text linksets"]
        D["baseMime(contentType)\nStrips charset/params from Content-Type"]
        E["isRDFMime(mime)\nChecks MIME against known RDF serializations"]
        E2["looksLikeJsonLd(text)\nDetects JSON-LD markers in a JSON body"]
        E3["resolveRdfFormat(ct, declared, body)\nReturns effective RDF MIME, trusting declared type\nwhen server returns application/json for JSON-LD"]
        E4["normUri(u)\nLower-cases and strips trailing slash for URI comparison"]
        F["tryExtractFromLinkset(url, base)\nResolves application/linkset+json or application/linkset\nwith anchor matching and cite-as fallback"]
        G["tryExtractFromSitemapAndDCAT(uri)\nrobots.txt → sitemap.xml → xhtml:link signposting"]
    end

    subgraph "Return Type"
        H["ExtractedRDF\n• content: string\n• format: string\n• source: SourceEnum\n• url: string"]
        H2["RDFOverview\n• found: ExtractedRDF[]\n• notFound: source[]\n• contentNegotiations: ContentNegotiationResult[]"]
    end

    A --> B
    A --> B2
    A --> C
    A --> D
    A --> E
    A --> E2
    A --> E3
    A --> E4
    A --> F
    A --> G
    A --> H
    A --> H2

    F --> B
    F --> B2
    F --> C
    F --> D
    F --> E
    F --> E2
    F --> E3
    F --> E4
    G --> B
    G --> D
    G --> E
```

### Key Types

| Type / Constant | Purpose |
|---|---|
| `ExtractedRDF` | The result object returned on success |
| `RDFOverview` | Returned by `extractAllRDF()` — all hits + strategies that found nothing |
| `RDF_MIMES` | `Set<string>` of all recognised RDF MIME types |
| `RDF_ACCEPT` | The `Accept` header value sent during generic content negotiation |

#### `ExtractedRDF` interface

```typescript
interface ExtractedRDF {
  content: string;   // Raw RDF payload
  format:  string;   // MIME type (e.g. "text/turtle")
  source:            // Where it was found
    | 'content-negotiation'
    | 'signposting-link-header'
    | 'signposting-html-link'
    | 'embedded-script'
    | 'linkset'
    | 'sitemap-signposting';
  url: string;       // Final URL the RDF was fetched from
}
```

#### `RDFOverview` interface (returned by `extractAllRDF`)

```typescript
interface ContentNegotiationResult {
  requestedMime: string;  // MIME type sent in the Accept header
  responseMime:  string;  // Content-Type returned by the server
  chars:         number;  // Length of the response body
  isRdf:         boolean; // Whether the response is a known RDF serialization
  url:           string;  // Request URL
}

interface RDFOverview {
  found:                ExtractedRDF[];                    // All successful RDF hits
  notFound:             Array<ExtractedRDF['source']>;     // Strategies that yielded nothing
  contentNegotiations:  ContentNegotiationResult[];        // Per-MIME-type results for Strategy 1
}
```

#### Supported RDF MIME types

| MIME type | Serialisation |
|---|---|
| `text/turtle` | Turtle |
| `application/ld+json` | JSON-LD |
| `application/rdf+xml` | RDF/XML |
| `application/n-triples` | N-Triples |
| `text/n3` | Notation3 |
| `application/n-quads` | N-Quads |

---

## Extraction Strategy — Full Flowchart

The diagram below captures every decision branch inside `extractRDF()`.

```mermaid
flowchart TD
    START(["`**extractRDF(uri)**`"]) --> CN

    %% ── Step 1: Content Negotiation ──────────────────────────────────────
    CN["**Step 1 — Content Negotiation**\nfetch(uri)\nAccept: text/turtle;q=1.0, application/ld+json;q=0.9 …"]
    CN -->|fetch error| NULL1([return null])
    CN -->|response ok AND Content-Type is RDF| RET1(["`return ExtractedRDF\nsource: 'content-negotiation'`"])
    CN -->|not RDF or non-200| PARSE_BODY

    %% ── Parse body & Link header ──────────────────────────────────────────
    PARSE_BODY["Read response body as text\nParse as HTML (DOMParser)\nParse HTTP Link header"]

    PARSE_BODY --> LH

    %% ── Step 2a: Link header — describedby ────────────────────────────────
    LH["**Step 2a — HTTP Link: rel=describedby**\nFor each link where rel=describedby\n(and type is RDF or absent)"]
    LH -->|no matching links| LS_HDR
    LH -->|fetch target → RDF| RET2(["`return ExtractedRDF\nsource: 'signposting-link-header'`"])
    LH -->|fetch target → not RDF| LS_HDR

    %% ── Step 2b: Link header — linkset ────────────────────────────────────
    LS_HDR["**Step 2b — HTTP Link: rel=linkset**\nFor each linkset URL in Link header\ncall tryExtractFromLinkset()"]
    LS_HDR -->|linkset yields RDF| RET3(["`return ExtractedRDF\nsource: 'linkset'`"])
    LS_HDR -->|no linkset or no RDF| HTML_DB

    %% ── Step 3a: HTML describedby ─────────────────────────────────────────
    HTML_DB["**Step 3a — HTML link rel=describedby**\nFor each link[rel=describedby] in HTML\ntype is RDF or absent"]
    HTML_DB -->|no HTML or no matching link| HTML_LS
    HTML_DB -->|fetch target → RDF| RET4(["`return ExtractedRDF\nsource: 'signposting-html-link'`"])
    HTML_DB -->|fetch target → not RDF| HTML_LS

    %% ── Step 3b: HTML linkset ─────────────────────────────────────────────
    HTML_LS["**Step 3b — HTML link rel=linkset**\nFor each link[rel=linkset] in HTML\ncall tryExtractFromLinkset()"]
    HTML_LS -->|linkset yields RDF| RET5(["`return ExtractedRDF\nsource: 'linkset'`"])
    HTML_LS -->|no linkset or no RDF| SCRIPT

    %% ── Step 3c: Embedded script ──────────────────────────────────────────
    SCRIPT["**Step 3c — Embedded RDF script**\nFor each script[type=RDF MIME] in HTML\ne.g. application/ld+json, text/turtle"]
    SCRIPT -->|found non-empty script| RET6(["`return ExtractedRDF\nsource: 'embedded-script'`"])
    SCRIPT -->|none found| SITEMAP

    %% ── Step 4: Sitemap fallback ──────────────────────────────────────────
    SITEMAP["**Step 4 — robots.txt → sitemap.xml**\ncall tryExtractFromSitemapAndDCAT()"]
    SITEMAP -->|FAIR signposting found| RET7(["`return ExtractedRDF\nsource: 'sitemap-signposting'`"])
    SITEMAP -->|nothing found| NULL2([return null])

    %% ── Styling ───────────────────────────────────────────────────────────
    style RET1 fill:#2d6a4f,color:#fff
    style RET2 fill:#2d6a4f,color:#fff
    style RET3 fill:#2d6a4f,color:#fff
    style RET4 fill:#2d6a4f,color:#fff
    style RET5 fill:#2d6a4f,color:#fff
    style RET6 fill:#2d6a4f,color:#fff
    style RET7 fill:#2d6a4f,color:#fff
    style NULL1 fill:#9d0208,color:#fff
    style NULL2 fill:#9d0208,color:#fff
```

---

## Linkset Resolution — Detail

`tryExtractFromLinkset()` is called by Steps 2b and 3b above (linkset discovery via HTTP `Link` header and via HTML `<link rel="linkset">` element). It handles **two** RFC 9264 serialisations and applies FAIR Signposting best practices (anchor matching, type-aware fetch, JSON-LD trust, `cite-as` fallback) to maximise compatibility with InvenioRDM / Zenodo deployments.

```mermaid
flowchart TD
    LS_START(["tryExtractFromLinkset(linksetUrl, baseUri)"])
    LS_START --> FETCH_LS["fetch(linksetUrl)\nAccept: application/linkset+json;q=1.0, application/linkset;q=0.9"]
    FETCH_LS -->|error or non-200| LS_NULL([return null])
    FETCH_LS -->|200 OK| CHECK_CT{Content-Type?}

    CHECK_CT -->|application/linkset+json\nor application/json| JSON_PATH
    CHECK_CT -->|application/linkset| TEXT_PATH
    CHECK_CT -->|other| LS_NULL2([return null])

    subgraph JSON_PATH ["JSON Linkset (application/linkset+json or application/json with linkset array)"]
        J1["Parse JSON\nVerify body has linkset array"]
        J_ANCHOR{Any entry whose\nanchor matches baseUri?}
        J_SEL["Use matching entries\nor all entries if none match"]
        J2["For each context entry:\nCheck describedby and profile arrays"]
        J3{target.href present?\nDeclared type is RDF or absent?}
        J4["fetchDescribedBy(href, declaredType)\nType-aware: declared MIME first in Accept"]
        J5["resolveRdfFormat(responseCt, declaredType, body)\nTrust declared type if server returns\napplication/json but body looks like JSON-LD"]
        J6{Effective format\nis RDF?}
        J7(["`return ExtractedRDF\nsource: 'linkset'`"])
        JCA["cite-as fallback:\nfetchRDF(citeAs.href)\nContent-negotiate via DOI URL"]
        JCA2{RDF MIME\nreturned?}
        JCA3(["`return ExtractedRDF\nsource: 'linkset'`"])
        J1 --> J_ANCHOR --> J_SEL --> J2 --> J3
        J3 -->|yes| J4 --> J5 --> J6
        J6 -->|yes| J7
        J6 -->|no| J2
        J3 -->|no, or all targets exhausted| JCA --> JCA2
        JCA2 -->|yes| JCA3
        JCA2 -->|no| LS_NULL3([return null])
    end

    subgraph TEXT_PATH ["Text Linkset (application/linkset)"]
        T1["Read body, normalise whitespace"]
        T2["parseLinkHeader() → links[]"]
        T_ANCHOR{Link has anchor?\nDoes it match baseUri?}
        T3{rel=describedby\nor rel=profile?}
        T4["fetchDescribedBy(url, declaredType)\nType-aware fetch"]
        T5["resolveRdfFormat(responseCt, declaredType, body)"]
        T6{Effective format\nis RDF?}
        T7(["`return ExtractedRDF\nsource: 'linkset'`"])
        T1 --> T2 --> T_ANCHOR
        T_ANCHOR -->|no anchor, or anchor matches| T3
        T_ANCHOR -->|anchor does not match| T2
        T3 -->|yes| T4 --> T5 --> T6
        T6 -->|yes| T7
        T6 -->|no| T3
        T3 -->|no matching links| LS_NULL4([return null])
    end

    style J7 fill:#2d6a4f,color:#fff
    style JCA3 fill:#2d6a4f,color:#fff
    style T7 fill:#2d6a4f,color:#fff
    style LS_NULL fill:#9d0208,color:#fff
    style LS_NULL2 fill:#9d0208,color:#fff
    style LS_NULL3 fill:#9d0208,color:#fff
    style LS_NULL4 fill:#9d0208,color:#fff
```

---

## Sitemap Fallback — Detail

`tryExtractFromSitemapAndDCAT()` is the last-resort strategy when all other approaches fail.

```mermaid
flowchart TD
    SM_START(["tryExtractFromSitemapAndDCAT(uri)"])
    SM_START --> ROBOTS["fetch /robots.txt from base URL"]
    ROBOTS -->|error or non-200| SM_NULL([return null])
    ROBOTS -->|ok| PARSE_ROBOTS["Parse Sitemap: directives from robots.txt"]
    PARSE_ROBOTS --> FOR_SM["For each sitemapUrl …"]
    FOR_SM --> FETCH_SM["fetch(sitemapUrl)"]
    FETCH_SM -->|error or non-200| NEXT_SM[next sitemap]
    NEXT_SM --> FOR_SM
    FETCH_SM -->|ok| PARSE_XML["DOMParser.parseFromString(text, 'text/xml')"]
    PARSE_XML -->|parse error| NEXT_SM
    PARSE_XML -->|ok| FOR_URL["For each url element in sitemap …"]
    FOR_URL --> CHECK_LOC{"loc matches requested URI?\ntrailing-slash tolerant"}
    CHECK_LOC -->|no| NEXT_URL[next url entry]
    NEXT_URL --> FOR_URL
    CHECK_LOC -->|yes| FOR_XLINK["For each xhtml:link in matching url entry"]
    FOR_XLINK --> CHECK_REL{rel=describedby?\nhref present?\ntype is RDF or absent?}
    CHECK_REL -->|no| NEXT_XLINK[next xhtml:link]
    NEXT_XLINK --> FOR_XLINK
    CHECK_REL -->|yes| FETCH_META["fetchRDF(href)\nCheck Content-Type → is RDF?"]
    FETCH_META -->|RDF confirmed| RET(["`return ExtractedRDF\nsource: 'sitemap-signposting'`"])
    FETCH_META -->|not RDF| NEXT_XLINK

    style RET fill:#2d6a4f,color:#fff
    style SM_NULL fill:#9d0208,color:#fff
```

---

## Strategy Priority Table

| Priority | Strategy | Trigger condition | `source` value |
|:---:|---|---|---|
| 1 | **Content negotiation** | Server returns RDF MIME directly | `content-negotiation` |
| 2 | **HTTP Link header — describedby** | `Link: <…>; rel="describedby"` header with RDF type | `signposting-link-header` |
| 3 | **HTTP Link header — linkset** | `Link: <…>; rel="linkset"` → resolved linkset contains RDF | `linkset` |
| 4 | **HTML link — describedby** | `<link rel="describedby">` in HTML `<head>` | `signposting-html-link` |
| 5 | **HTML link — linkset** | `<link rel="linkset">` in HTML `<head>` → resolved linkset contains RDF | `linkset` |
| 6 | **Embedded script** | `<script type="application/ld+json">` (or other RDF MIME) in HTML body | `embedded-script` |
| 7 | **Sitemap signposting** | `robots.txt` → `sitemap.xml` → `<xhtml:link rel="describedby">` in matching `<url>` entry | `sitemap-signposting` |

---

## File Structure

```
uri_gator/
├── wrx.ts                # Core module — export extractRDF(), ExtractedRDF
├── wrx.js                # Public entrypoint wrapper
├── bun-globals.d.ts      # Ambient types for import.meta.main and process
├── package.json          # Bun project manifest
├── tsconfig.json         # TypeScript config (ESNext + DOM + DOM.Iterable libs)
├── DOCUMENTATION.md      # This file
└── README.md             # Project overview
```

---

## Usage

### As a library

```typescript
import { extractRDF, type ExtractedRDF } from './wrx.js';

const result: ExtractedRDF | null = await extractRDF('https://example.org/dataset');

if (result) {
  console.log(result.source);   // e.g. 'content-negotiation'
  console.log(result.format);   // e.g. 'text/turtle'
  console.log(result.url);      // resolved URL the RDF came from
  console.log(result.content);  // raw RDF string
} else {
  console.log('No RDF found.');
}
```

Install in another Bun project with:

```sh
bun add github:cedricdcc/uri_gator
```

### As a CLI tool — first-match mode

```sh
bun run wrx.js https://example.org/dataset
```

Example output:
```
🔍 Extracting RDF from: https://example.org/dataset
✅ Found RDF (content-negotiation) from https://example.org/dataset
Format: text/turtle
Content length: 4821 chars

--- First 500 chars of RDF ---
@prefix dcat: <http://www.w3.org/ns/dcat#> .
...
```

### As a CLI tool — `--all` mode (explore all paths)

Pass `--all` to run every extraction strategy and get a full overview of what is available for the resource, instead of stopping at the first success:

```sh
bun run wrx.js --all https://example.org/dataset
```

Example output:
```
🔍 Exploring all RDF paths for: https://example.org/dataset

  ✅ Strategy 1 — Content Negotiation (3 RDF format(s) found)
       Requested MIME                →  Response MIME                  Chars
       ──────────────────────────      ──────────────────────────      ─────
       text/turtle                   →  text/turtle                       4,821  ✅
       application/ld+json           →  application/ld+json               2,341  ✅
       application/rdf+xml           →  text/html                        15,234  ❌
       application/n-triples         →  application/n-triples             8,901  ✅
       text/n3                       →  text/turtle                       4,821  ✅ (duplicate format)
       application/n-quads           →  text/html                        15,234  ❌
  ✅ Strategy 2 — HTTP Link header (rel=describedby)
       text/turtle  https://example.org/dataset.ttl  (4821 chars)
  ❌ Strategy 3 — Linkset (rel=linkset)
  ❌ Strategy 4 — HTML link[rel=describedby]
  ✅ Strategy 5 — Embedded RDF script
       application/ld+json  https://example.org/dataset  (312 chars)
  ❌ Strategy 6 — Sitemap signposting (robots.txt)

📋 Content Negotiation Overview (all MIME types):
   text/turtle                →   4,821 chars  (text/turtle)             ✅ RDF
   application/ld+json        →   2,341 chars  (application/ld+json)     ✅ RDF
   application/rdf+xml        →  15,234 chars  (text/html)               ❌ not RDF
   application/n-triples      →   8,901 chars  (application/n-triples)   ✅ RDF
   text/n3                    →   4,821 chars  (text/turtle)             ✅ RDF
   application/n-quads        →  15,234 chars  (text/html)               ❌ not RDF

📊 3 unique RDF source(s) found across 6 strategies tried.
```

> **Note:** `text/n3` returned `text/turtle` in the example above, which is the same format as the first request. The `found` array deduplicates by response format, so both requests count in `contentNegotiations` but only one entry appears in `found`.

### As a library — `extractAllRDF`

```typescript
import { extractAllRDF, type RDFOverview } from './wrx.js';

const overview: RDFOverview = await extractAllRDF('https://example.org/dataset');

for (const rdf of overview.found) {
  console.log(rdf.source, rdf.format, rdf.url);
}
console.log('Not found via:', overview.notFound);

// Content negotiation details (one entry per MIME type tried)
for (const cn of overview.contentNegotiations) {
  console.log(`${cn.requestedMime} → ${cn.responseMime} (${cn.chars} chars) ${cn.isRdf ? '✅' : '❌'}`);
}
```

---

## Design Decisions

### Per-MIME-type content negotiation in `--all` mode
In the default `extractRDF()` mode, a single HTTP request is made with a combined `Accept` header listing all supported RDF MIME types. In `extractAllRDF()` (`--all` mode), each RDF MIME type is tried individually in its own HTTP request so that every possible server response is captured. Results are deduplicated (two requests returning the same format produce only one entry in `found`). Non-RDF responses are recorded in `contentNegotiations` with their character count, making it easy to see which MIME types the server does — and does not — support for the target resource.

### No external dependencies
The module relies exclusively on Bun built-ins (`fetch`, `URL`, `DOMParser`, `Response`). This keeps deployment simple — no `node_modules`, no `bun install` required at runtime.

### `baseMime()` helper
`Content-Type` headers can include parameters (e.g. `text/turtle; charset=utf-8`). The `baseMime()` helper strips these safely without using array indexing (which would trigger TypeScript's `noUncheckedIndexedAccess` warning).

### Graceful failure
Every network call is wrapped in `try/catch`. A failure in any step causes a fall-through to the next strategy rather than an exception — `null` is returned only when all strategies are exhausted.

### RFC 9264 linkset support
Both serialisations are supported:
- `application/linkset+json` — JSON format, checks `describedby` and `profile` relation arrays
- `application/linkset` — text format, treated as a Link header and parsed with `parseLinkHeader()`

### RFC 9264 anchor matching (InvenioRDM / Zenodo)
A linkset document may describe multiple resources (e.g. the landing page and each of its files). Per RFC 9264 §4.2, the entry whose `anchor` URI matches the requested URI should be preferred over the others. `normUri()` normalises both URIs (lowercase, strip trailing slash) before comparing, so `https://zenodo.org/records/42` and `https://zenodo.org/records/42/` are treated as equivalent. When no entry's anchor matches, all entries are iterated as a fallback to support servers that omit the `anchor` field.

### Type-aware `fetchDescribedBy()` (InvenioRDM / Zenodo)
InvenioRDM/Zenodo linkset entries declare a specific RDF type for their `describedby` targets (e.g. `"type": "application/ld+json"`). The `fetchDescribedBy()` helper builds an `Accept` header that places the declared MIME type at `q=1.0` and all other RDF types below it, maximising the chance the server returns the format it advertises without the consumer having to know the server's routing logic.

### JSON-LD trust via `resolveRdfFormat()` and `looksLikeJsonLd()`
Some InvenioRDM deployments return `Content-Type: application/json` even when the body is JSON-LD. `looksLikeJsonLd()` checks for JSON-LD structural markers (`@context`, `@type`, `@graph`) at the top level of the parsed body (including top-level arrays, which are valid JSON-LD). `resolveRdfFormat()` uses this to trust the linkset's declared MIME type in these cases, setting `format` to `application/ld+json` rather than `application/json`.

### `application/json` linkset body fallback
For the same reason, if a server returns `Content-Type: application/json` for the linkset request itself but the body contains a top-level `linkset` array, the body is parsed and processed as `application/linkset+json`.

### `cite-as` content-negotiation fallback
When a linkset entry's `describedby`/`profile` targets all fail to return RDF, the module tries RDF content negotiation on any `cite-as` URI in the same entry (typically a DOI). This catches cases where a DOI resolves with proper `Accept`-based negotiation even though the direct metadata URL is inaccessible.

### Trailing-slash normalisation
URI comparison in the sitemap strategy accepts `https://example.org/foo`, `https://example.org/foo/` and their reverse without requiring exact equality. The same `normUri()` helper is used for anchor matching in the linkset strategy.
