# uri_gator — RDF Extractor Documentation

## Overview

`rdf-extractor.ts` is a zero-dependency Bun/TypeScript module that retrieves RDF metadata from any URI. It follows a **cascading strategy**: each approach is tried in priority order and the first successful result is immediately returned. The module never requires external npm packages — it uses only Bun's built-in `fetch`, `URL`, and `DOMParser`.

---

## Module Architecture

```mermaid
graph TB
    subgraph "rdf-extractor.ts — Public API"
        A["extractRDF(uri: string)\n→ Promise&lt;ExtractedRDF | null&gt;"]
    end

    subgraph "Internal Helpers"
        B["fetchRDF(url)\nSends Accept header for RDF MIME types"]
        C["parseLinkHeader(header)\nParses HTTP Link / RFC 9264 text linksets"]
        D["baseMime(contentType)\nStrips charset/params from Content-Type"]
        E["isRDFMime(mime)\nChecks MIME against known RDF serializations"]
        F["tryExtractFromLinkset(url, base)\nResolves application/linkset+json or application/linkset"]
        G["tryExtractFromSitemapAndDCAT(uri)\nrobots.txt → sitemap.xml → xhtml:link signposting"]
    end

    subgraph "Return Type"
        H["ExtractedRDF\n• content: string\n• format: string\n• source: SourceEnum\n• url: string"]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H

    F --> B
    F --> C
    F --> D
    F --> E
    G --> B
    G --> D
    G --> E
```

### Key Types

| Type / Constant | Purpose |
|---|---|
| `ExtractedRDF` | The result object returned on success |
| `RDF_MIMES` | `Set<string>` of all recognised RDF MIME types |
| `RDF_ACCEPT` | The `Accept` header value sent during content negotiation |

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
    HTML_DB["**Step 3a — HTML &lt;link rel=describedby&gt;**\nFor each &lt;link rel=describedby&gt; in HTML\n(type is RDF or absent)"]
    HTML_DB -->|no HTML or no matching link| HTML_LS
    HTML_DB -->|fetch target → RDF| RET4(["`return ExtractedRDF\nsource: 'signposting-html-link'`"])
    HTML_DB -->|fetch target → not RDF| HTML_LS

    %% ── Step 3b: HTML linkset ─────────────────────────────────────────────
    HTML_LS["**Step 3b — HTML &lt;link rel=linkset&gt;**\nFor each &lt;link rel=linkset&gt; in HTML\ncall tryExtractFromLinkset()"]
    HTML_LS -->|linkset yields RDF| RET5(["`return ExtractedRDF\nsource: 'linkset'`"])
    HTML_LS -->|no linkset or no RDF| SCRIPT

    %% ── Step 3c: Embedded script ──────────────────────────────────────────
    SCRIPT["**Step 3c — Embedded RDF &lt;script&gt;**\nFor each &lt;script type=…&gt; where type is RDF MIME\n(e.g. application/ld+json, text/turtle)"]
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

`tryExtractFromLinkset()` is called by Steps 2b and 3b above. It handles **two** RFC 9264 serialisations.

```mermaid
flowchart TD
    LS_START(["tryExtractFromLinkset(linksetUrl, baseUri)"])
    LS_START --> FETCH_LS["fetch(linksetUrl)\nAccept: application/linkset+json;q=1.0, application/linkset;q=0.9"]
    FETCH_LS -->|error or non-200| LS_NULL([return null])
    FETCH_LS -->|200 OK| CHECK_CT{Content-Type?}

    CHECK_CT -->|application/linkset+json| JSON_PATH
    CHECK_CT -->|application/linkset| TEXT_PATH
    CHECK_CT -->|other| LS_NULL2([return null])

    subgraph JSON_PATH ["JSON Linkset (application/linkset+json)"]
        J1["Parse JSON → data.linkset[]"]
        J2["For each context object:\nCheck rel: describedby and rel: profile arrays"]
        J3{target.href present?\ntarget.type is RDF or absent?}
        J4["fetchRDF(target.href)\nCheck Content-Type → is RDF?"]
        J5(["`return ExtractedRDF\nsource: 'linkset'`"])
        J1 --> J2 --> J3
        J3 -->|yes| J4 --> J5
        J3 -->|no| J2
    end

    subgraph TEXT_PATH ["Text Linkset (application/linkset)"]
        T1["Read body, normalise whitespace"]
        T2["parseLinkHeader() → links[]"]
        T3{rel=describedby\nor rel=profile?}
        T4["fetchRDF(link.url)\nCheck Content-Type → is RDF?"]
        T5(["`return ExtractedRDF\nsource: 'linkset'`"])
        T1 --> T2 --> T3
        T3 -->|yes| T4 --> T5
        T3 -->|no| T3
    end

    style J5 fill:#2d6a4f,color:#fff
    style T5 fill:#2d6a4f,color:#fff
    style LS_NULL fill:#9d0208,color:#fff
    style LS_NULL2 fill:#9d0208,color:#fff
```

---

## Sitemap Fallback — Detail

`tryExtractFromSitemapAndDCAT()` is the last-resort strategy when all other approaches fail.

```mermaid
flowchart TD
    SM_START(["tryExtractFromSitemapAndDCAT(uri)"])
    SM_START --> ROBOTS["fetch {protocol}//{host}/robots.txt"]
    ROBOTS -->|error or non-200| SM_NULL([return null])
    ROBOTS -->|ok| PARSE_ROBOTS["Parse Sitemap: directives from robots.txt"]
    PARSE_ROBOTS --> FOR_SM["For each sitemapUrl …"]
    FOR_SM --> FETCH_SM["fetch(sitemapUrl)"]
    FETCH_SM -->|error or non-200| NEXT_SM[next sitemap]
    NEXT_SM --> FOR_SM
    FETCH_SM -->|ok| PARSE_XML["DOMParser.parseFromString(text, 'text/xml')"]
    PARSE_XML -->|parse error| NEXT_SM
    PARSE_XML -->|ok| FOR_URL["For each &lt;url&gt; element …"]
    FOR_URL --> CHECK_LOC{&lt;loc&gt; matches\nrequested URI?\n(trailing-slash tolerant)}
    CHECK_LOC -->|no| NEXT_URL[next &lt;url&gt;]
    NEXT_URL --> FOR_URL
    CHECK_LOC -->|yes| FOR_XLINK["For each &lt;xhtml:link&gt; in matching &lt;url&gt;"]
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
├── rdf-extractor.ts      # Core module — export extractRDF(), ExtractedRDF
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
import { extractRDF, type ExtractedRDF } from './rdf-extractor.ts';

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

### As a CLI tool

```sh
bun run rdf-extractor.ts https://example.org/dataset
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

---

## Design Decisions

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

### Trailing-slash normalisation
URI comparison in the sitemap strategy accepts `https://example.org/foo`, `https://example.org/foo/` and their reverse without requiring exact equality.
