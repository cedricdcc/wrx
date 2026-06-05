# WRX Discovery Strategy Roadmap

This roadmap documents the implementation status of the 30 Web Resource Discovery methods mapped to the 2x2 LOD Discovery taxonomy quadrants.

## 2x2 Taxonomy Overview
- **Quadrant 1 (Q1)**: Resource-Direct (Direct payload on resource URL)
- **Quadrant 2 (Q2)**: Resource-Inferenced (Inferred from resource HTML markup)
- **Quadrant 3 (Q3)**: Domain-Direct (Direct RDF catalog/map at domain root)
- **Quadrant 4 (Q4)**: Domain-Inferenced (Inferred from host-wide XML/text configs)

---

## Strategy Status Checklist

### Quadrant 1: Resource-Level Direct RDF
- [x] **Content Negotiation (`content-negotiation`)** - Requests RDF formats (Accept header).
- [x] **HTTP Link Header Signposting (`signposting-link-header`)** - Follows `rel="describedby"` and `rel="profile"` headers.
- [x] **HTML Link Signposting (`signposting-html-link`)** - Follows `<link rel="describedby">` in head.
- [x] **Embedded Script (`embedded-script`)** - Parses JSON-LD or Turtle from `<script>` tags.
- [ ] **FOAF Relations (`foaf`)** - *Pending* - Discover social/person connections.
- [ ] **OWL SameAs Equivalence (`same-as`)** - *Pending* - Extract resource identity equivalence.
- [ ] **SKOS Relations (`skos`)** - *Pending* - Navigate taxonomy concept schemes.
- [ ] **RDF Collections & Containers (`rdf-collections`)** - *Pending* - Traverse sequence/first/rest list structures.
- [ ] **PROV-O Provenance (`provenance`)** - *Pending* - Extract origin and processing history.
- [ ] **Collection Membership (`collection-membership`)** - *Pending* - Identify members via hasPart/isPartOf.

### Quadrant 2: Resource-Level Inferenced RDF
- [ ] **HTML Hyperlinks (`html-links`)** - *Pending* - Crawl standard anchor links.
- [ ] **RDFa Markup (`rdfa`)** - *Pending* - Parse inline RDFa attributes from the DOM.
- [ ] **Microdata Markup (`microdata`)** - *Pending* - Extract itemscope/itemprop schemas.
- [ ] **Open Graph Protocol (`open-graph`)** - *Pending* - Map `og:X` tags to schema.org triples.
- [ ] **Dublin Core Meta (`dublin-core`)** - *Pending* - Map `DC.X` tags to dcterms triples.
- [ ] **Canonical URLs (`canonical`)** - *Pending* - Extract `rel="canonical"` identity mapping.
- [ ] **HTTP Link Relations (`http-link-relations`)** - *Pending* - Map collection/item links in HTTP headers.
- [ ] **Pagination Links (`pagination`)** - *Pending* - Follow next/prev page lists.
- [ ] **Reverse Links (`reverse-links`)** - *Pending* - Verify cyclic reciprocal backlinks.
- [ ] **Circular Graphs (`circular-graphs`)** - *Pending* - Manage loops in network crawls.

### Quadrant 3: Domain-Level Direct RDF
- [x] **RFC 9264 Linksets (`linkset`)** - Parses plain text or JSON linksets mapping relations.
- [ ] **DCAT Catalog (`dcat-catalog`)** - *Pending* - Traverse host-level DCAT registry catalogs.
- [ ] **Well-Known RFC 8615 Endpoints (`well-known`)** - *Pending* - Check standard well-known profiles.
- [ ] **Resource Map (`resource-map`)** - *Pending* - Fetch and parse OAI-ORE resource maps.

### Quadrant 4: Domain-Level Inferenced RDF
- [x] **Sitemap Signposting (`sitemap-signposting`)** - Traverses robots.txt and sitemap.xml to find describedby targets.
- [ ] **RSS Feed (`rss-feed`)** - *Pending* - Extract updates and metadata from RSS XML.
- [ ] **Atom Feed (`atom-feed`)** - *Pending* - Extract updates and metadata from Atom XML.
- [ ] **Web Manifest (`manifest`)** - *Pending* - Extract application metadata from manifest.json.
- [ ] **API Discovery (`api-discovery`)** - *Pending* - Crawl dynamic JSON API catalog endpoints.
