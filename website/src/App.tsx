import { motion, useScroll, useTransform, useSpring, AnimatePresence, useInView, useVelocity } from "motion/react";
import {
  Search,
  Link2,
  FileCode,
  Database,
  ArrowRight,
  Globe,
  ExternalLink,
  Code2,
  Box,
  Settings,
  Share2,
  ListRestart,
  Zap,
  Layers,
  ChevronRight,
  Play,
  Loader2,
  TerminalSquare,
  Network
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import KnowledgeGraph from "./components/KnowledgeGraph";
import { extractRDF } from "wrx";
import * as N3 from "n3";
import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import jsonld from "jsonld";

const STRATEGIES = [
  {
    id: "conneg",
    title: "1. Content Negotiation (Conneg)",
    description: "Negotiating directly with the server by sending targeted HTTP requests containing standardized RDF MIME types in the Accept header. By specifying exact quality values (e.g., q=0.9) for formats like Turtle, JSON-LD, RDF/XML, and N-Triples, WRX cleanly prompts the server to return the structured metadata representation of the resource directly, avoiding generic HTML payloads.",
    icon: Globe,
    details: ["Accept: text/turtle", "Accept: application/ld+json", "Quality Values (q-factor)", "MIME Type Resolution"]
  },
  {
    id: "fair",
    title: "2. FAIR Signposting",
    description: "Inspecting HTTP response headers and HTML headers for explicit relations defined by the FAIR Signposting profile. By scanning for relations like 'describedby' (pointing to metadata), 'cite-as' (persistent identifiers), and 'item' (resource parts), WRX extracts highly reliable links to semantic metadata that the publisher explicitly registered for machine consumption.",
    icon: Search,
    details: ["Link Headers", "rel=describedby", "rel=cite-as", "FAIR Principles"]
  },
  {
    id: "linkset",
    title: "3. RFC 9264 Linksets",
    description: "Locating and parsing standardized RFC 9264 Linksets. Linksets provide a machine-readable map of web links and relations between resources, either embedded within HTML <link> tags, sent via HTTP Link headers with relation=linkset, or hosted as standalone .linkset JSON/text documents. This allows WRX to resolve complex, cross-domain relationship graphs efficiently.",
    icon: Link2,
    details: ["RFC 9264 Linksets", "rel=linkset", "Cross-domain Mappings", "JSON-LD Linksets"]
  },
  {
    id: "embedded",
    title: "4. Embedded RDF",
    description: "Scrutinizing the raw HTML markup of a resolved web page to discover inline semantic data. WRX extracts rich structured graphs from <script type=\"application/ld+json\"> tags, parses RDFa attributes (property, resource, about) embedded in standard HTML elements, and scans Microdata formats. This is extremely powerful for websites using schema.org to enrich their human-readable pages.",
    icon: FileCode,
    details: ["JSON-LD Scripts", "RDFa Attributes", "HTML Microdata", "Schema.org extraction"]
  },
  {
    id: "catalog",
    title: "5. RFC 9727 API-Catalog",
    description: "Leveraging RFC 9727 API catalogs for service and schema discovery. When resolving a URI, WRX checks for associated API-Catalog headers or files. This catalog acts as an automated entrypoint describing all available API endpoints, query capabilities, and semantic metadata definitions associated with the site's dataset, offering a structured path to dynamic queries.",
    icon: Share2,
    details: ["RFC 9727 API-Catalog", "Service Discovery", "Dynamic API Endpoints", "Hydra Vocabularies"]
  },
  {
    id: "fallback",
    title: "6. DCAT & Sitemaps Fallback",
    description: "Our ultimate fallback discovery mechanism. If direct discovery yields no results, WRX searches the domain's root sitemap.xml for structural pathways or queries regional/global DCAT (Data Catalog Vocabulary) portals. By crawling catalog records and distributions, WRX can often find hidden RDF dumps or endpoints that aren't linked on the resource's immediate landing page.",
    icon: Database,
    details: ["Sitemaps Crawling", "DCAT Discovery", "Catalog Distribution Mapping", "Opaque Resource Fallbacks"]
  }
];

const RELATIONS = [
  "describedby", "cite-as", "item", "license", "author"
];

const Header = () => (
  <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md bg-white/40 border-b border-accent/10">
    <div className="flex items-center gap-2">
      <span className="font-sans font-black tracking-tighter text-2xl text-poster-dark">WRX<span className="text-accent">.</span></span>
    </div>
    <div className="hidden md:flex gap-10 font-sans text-[13px] uppercase tracking-widest font-bold">
      <a href="#problem" className="text-poster-dark/40 hover:text-poster-dark transition-colors">The Problem</a>
      <a href="#solution" className="text-poster-dark/40 hover:text-poster-dark transition-colors">The Solution</a>
      <a href="#sandbox" className="text-poster-dark/40 hover:text-poster-dark transition-colors">Sandbox</a>
      <a href="https://github.com/cedricdcc/wrx" target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-80 transition-opacity flex items-center gap-1">
        GitHub <ExternalLink size={12} />
      </a>
    </div>
  </nav>
);

const BlueBox = ({ scrollOpacity }: { scrollOpacity: any }) => {
  const [bytes, setBytes] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      let result = "";
      // Approximately 4 lines of 24 hex pairs/questions
      const length = 96;
      for (let i = 0; i < length; i++) {
        if (Math.random() > 0.85) {
          result += "?";
        } else {
          result += Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
        }
        if (i % 2 === 1) result += " ";
        if (i % 16 === 15) result += "\n";
      }
      setBytes(result);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      style={{ opacity: scrollOpacity }}
      className="relative w-72 h-72 md:w-96 md:h-96 mx-auto"
    >
      {/* The Machine / Black Box */}
      <div className="absolute inset-0 bg-[#0a0a0a] border-2 border-accent/40 rounded-3xl backdrop-blur-xl overflow-hidden flex flex-col items-center justify-center shadow-[0_0_60px_rgba(61,122,141,0.25)] ring-1 ring-white/10">

        {/* Dynamic Byte Stream Background */}
        <div className="absolute inset-0 p-6 opacity-30 select-none pointer-events-none overflow-hidden">
          <pre className="text-[9px] md:text-[11px] font-mono text-accent leading-relaxed break-all whitespace-pre-wrap blur-[0.5px]">
            {bytes}
            {bytes}
            {bytes}
          </pre>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
          <div className="flex flex-col items-center gap-2">
            <div className="px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-[9px] font-mono text-accent uppercase tracking-[0.3em] font-bold">
              Encapsulated Meta-Data
            </div>
            <h3 className="text-white font-sans font-black text-xl tracking-tight">URI BLACK BOX</h3>
          </div>

          <div className="grid grid-cols-2 gap-6 p-4 text-accent/90">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0 }}><Search size={32} strokeWidth={1.5} /></motion.div>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}><Link2 size={32} strokeWidth={1.5} /></motion.div>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }}><Database size={32} strokeWidth={1.5} /></motion.div>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}><Box size={32} strokeWidth={1.5} /></motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-4 border-t border-white/5 w-full"
          >
            <div className="text-[11px] font-sans font-bold text-white/50 uppercase tracking-[0.2em] flex flex-col items-center gap-2">
              <span>Explorable via</span>
              <span className="text-white text-lg tracking-[0.4em] font-black group-hover:text-accent transition-colors">WRX_MODULE</span>
            </div>
          </motion.div>
        </div>

        {/* Scan Line Effect */}
        <motion.div
          animate={{ top: ["-10%", "110%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 w-full h-1/4 bg-gradient-to-b from-transparent via-accent/10 to-transparent pointer-events-none z-20"
        />

        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 blur-[50px] -mr-16 -mt-16 rounded-full" />
      </div>

      {/* Tubes/Pipes Connectors */}
      <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 h-10 bg-accent/10 border-y border-accent/20 backdrop-blur-sm" />
      <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-12 h-10 bg-accent/10 border-y border-accent/20 backdrop-blur-sm" />
      <div className="absolute left-1/2 -top-12 -translate-x-1/2 w-10 h-12 bg-accent/10 border-x border-accent/20 backdrop-blur-sm" />
    </motion.div>
  );
};

const StrategyCard = ({ strategy, index }: { strategy: typeof STRATEGIES[0], index: number }) => {
  const Icon = strategy.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      className="strategy-card-blueprint p-6 md:p-8 rounded-2xl border border-accent/15 hover:border-accent hover:shadow-2xl hover:shadow-accent/5 transition-all duration-300 flex flex-col md:flex-row gap-6 md:gap-8 items-start group"
    >
      {/* Icon and Number */}
      <div className="flex md:flex-col items-center gap-4 shrink-0">
        <div className="w-14 h-14 rounded-2xl bg-accent/5 border border-accent/15 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300 shadow-inner">
          <Icon size={24} strokeWidth={1.5} />
        </div>
        <span className="font-mono text-xs font-black tracking-widest text-accent/40 uppercase md:pt-2">
          Step 0{index + 1}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4">
        <h3 className="text-xl md:text-2xl font-black text-poster-dark group-hover:text-accent transition-colors duration-300">
          {strategy.title}
        </h3>

        <p className="text-[#4a5568] leading-relaxed text-sm md:text-base font-medium">
          {strategy.description}
        </p>

        {/* Technical Specs/Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-accent/5">
          {strategy.details.map((detail: string) => (
            <span key={detail} className="px-3 py-1 bg-accent/5 text-[10px] font-mono font-semibold rounded-md border border-accent/10 text-poster-dark/80 group-hover:bg-accent/10 transition-colors duration-300">
              {detail}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const ProblemSection = () => {
  return (
    <section id="problem" className="relative py-24 md:py-36 z-20 max-w-5xl mx-auto px-8 border-t border-accent/10">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="space-y-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-px bg-accent/30" />
          <span className="text-accent font-black uppercase text-xs tracking-widest block">THE PROBLEM</span>
        </div>

        <h2 className="text-4xl md:text-6xl font-black text-poster-dark tracking-tighter leading-none">
          Findable is not Explorable.
        </h2>

        <div className="grid md:grid-cols-2 gap-10 md:gap-16 pt-6">
          <div className="space-y-6 text-[#4a5568] leading-relaxed text-base md:text-lg">
            <p>
              In the world of Linked Open Data, having a resource's URI is supposed to open the door to a rich graph of interconnected metadata. You've located the resource—it is technically <strong>findable</strong>.
            </p>
            <p>
              However, the actual semantic graphs are often <strong>not explorable</strong>. Standard web clients cannot easily query or follow relationships because there is no single, unified way that publishers expose their RDF.
            </p>
          </div>

          <div className="space-y-6 text-[#4a5568] leading-relaxed text-base md:text-lg">
            <p>
              A server might hide its data behind complex Content Negotiation, embed it inside obscure HTML scripts, scatter relations across HTTP Signposting headers, or point to distant API Catalogs and sitemaps. Managing these diverse strategies manually is slow and highly prone to error.
            </p>
            <p className="text-poster-dark font-semibold">
              This is where <strong>WRX</strong> steps in. WRX unifies many semantic web discovery strategies into an elegant, automated cascading pipeline, turning any findable URI into a fully explorable knowledge graph.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

const StrategiesSection = () => {
  return (
    <section id="solution" className="relative py-24 md:py-32 z-20 max-w-5xl mx-auto px-8 border-t border-accent/10">
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px bg-accent/30" />
          <span className="text-accent font-black uppercase text-xs tracking-widest block">CASCADING PIPELINE</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-poster-dark tracking-tighter">
          Our Discovery Techniques
        </h2>
        <p className="text-poster-dark/60 max-w-xl mt-4 font-medium">
          WRX processes resources by checking each of the following strategies sequentially, cascading automatically until an explorable RDF representation is successfully resolved.
        </p>
      </div>

      <div className="space-y-8">
        {STRATEGIES.map((strategy, i) => (
          <StrategyCard key={strategy.id} strategy={strategy} index={i} />
        ))}
      </div>
    </section>
  );
};

const TryOutSection = () => {
  const [uri, setUri] = useState("https://data.emobon.embrc.eu");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // SPARQL State
  const [query, setQuery] = useState(`SELECT ?p ?o WHERE {
  <https://data.emobon.embrc.eu> ?p ?o.
} LIMIT 10`);
  const [sparqlResults, setSparqlResults] = useState<any[]>([]);
  const [filteredTriples, setFilteredTriples] = useState<any[] | null>(null);
  const [querying, setQuerying] = useState(false);
  const [sparqlError, setSparqlError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'graph' | 'sparql' | 'triples'>('graph');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [showUriActions, setShowUriActions] = useState(false);

  const [triplesAddedFeedback, setTriplesAddedFeedback] = useState<{ count: number, show: boolean }>({ count: 0, show: false });

  const handleExtract = async (e?: any, targetUri?: string, append: boolean = false) => {
    if (e) e.preventDefault();
    const uriToFetch = targetUri || uri;
    setLoading(true);
    setError(null);
    if (!append) {
      setResult(null);
      setFilteredTriples(null);
    }
    setSparqlResults([]);

    try {
      // Direct client-side RDF extraction using WRX
      const wrxResult = await extractRDF(uriToFetch);
      
      if (!wrxResult || !wrxResult.content) {
        throw new Error("No RDF content found");
      }

      const triples: any[] = [];
      let parsed = false;

      // Ensure content is a string
      const contentStr = typeof wrxResult.content === 'string' 
        ? wrxResult.content 
        : JSON.stringify(wrxResult.content);

      const format = (wrxResult.format || '').toLowerCase();

      try {
        if (format.includes('json') && format.includes('ld')) {
          // JSON-LD support
          const json = JSON.parse(contentStr);
          const nquads = await jsonld.toRDF(json, { format: 'application/n-quads' });
          const parser = new N3.Parser({ format: 'N-Quads', baseIRI: wrxResult.url });
          const quads = parser.parse(nquads as string);
          quads.forEach(quad => {
            let datatype = '';
            if (quad.object.termType === 'Literal') {
              datatype = quad.object.datatype.value;
            }
            triples.push({
              subject: quad.subject.value,
              predicate: quad.predicate.value,
              object: quad.object.value,
              objectType: quad.object.termType,
              datatype: datatype
            });
          });
          parsed = true;
        } else {
          // Try N3 parser (supports Turtle, N-Triples, N-Quads, TriG)
          const parser = new N3.Parser({ baseIRI: wrxResult.url });
          const quads = parser.parse(contentStr);
          quads.forEach(quad => {
            let datatype = '';
            if (quad.object.termType === 'Literal') {
              datatype = quad.object.datatype.value;
            }
            triples.push({
              subject: quad.subject.value,
              predicate: quad.predicate.value,
              object: quad.object.value,
              objectType: quad.object.termType,
              datatype: datatype
            });
          });
          parsed = true;
        }
      } catch (e: any) {
        console.error(`Parsing failed for format ${format}:`, e);
      }

      const newData = {
        metadata: {
          source: wrxResult.source,
          format: wrxResult.format,
          url: wrxResult.url
        },
        triples,
        rawContent: parsed ? null : contentStr
      };

      // Tag triples with their source URI for grouping in the graph
      const taggedTriples = (newData.triples || []).map((t: any) => ({
        ...t,
        sourceUri: uriToFetch
      }));

      if (append && result) {
        // Merge triples, avoid duplicates
        const existingTriples = result.triples || [];
        const combined = [...existingTriples];
        let addedCount = 0;

        taggedTriples.forEach((nt: any) => {
          if (!combined.some(et => et.subject === nt.subject && et.predicate === nt.predicate && et.object === nt.object && et.sourceUri === nt.sourceUri)) {
            combined.push(nt);
            addedCount++;
          }
        });

        setTriplesAddedFeedback({ count: addedCount, show: true });
        setTimeout(() => setTriplesAddedFeedback(prev => ({ ...prev, show: false })), 4000);

        setResult({
          ...newData,
          triples: combined,
          metadata: {
            ...newData.metadata,
            source: `Merged (${newData.metadata.source})`,
            mergedSources: [...(result.metadata.mergedSources || [result.metadata.source]), newData.metadata.source]
          }
        });
      } else {
        setResult({
          ...newData,
          triples: taggedTriples
        });
      }

      // Update default query if we find a subject that looks like 'me'
      if (newData.triples && newData.triples.length > 0) {
        const meNode = newData.triples.find((t: any) => t.subject.endsWith('#me') || t.subject.endsWith('/me'));
        if (meNode) {
          setQuery(`SELECT ?p ?o WHERE {
  <${meNode.subject}> ?p ?o.
} LIMIT 10`);
        } else if (!append) {
          setQuery(`SELECT ?s ?p ?o WHERE {
  ?s ?p ?o.
} LIMIT 10`);
        }
      }

      if (targetUri) setUri(targetUri);
      setShowUriActions(false);
      setSelectedUri(null);

    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to extract");
    } finally {
      setLoading(false);
    }
  };

  const executeSparql = async () => {
    if (!result?.triples) return;
    setQuerying(true);
    setSparqlError(null);
    try {
      const store = new N3.Store();
      const { namedNode, literal, defaultGraph } = N3.DataFactory;

      result.triples.forEach((t: any) => {
        store.addQuad(
          namedNode(t.subject),
          namedNode(t.predicate),
          t.objectType === 'Literal' ? literal(t.object) : namedNode(t.object),
          defaultGraph()
        );
      });

      const myEngine = new QueryEngine();
      const bindingsStream = await myEngine.queryBindings(query, {
        sources: [store],
      });

      const bindings = await bindingsStream.toArray();
      const results = bindings.map(b => {
        const resObj: any = {};
        for (const [key, value] of b) {
          resObj[key.value] = value.value;
        }
        return resObj;
      });
      setSparqlResults(results);

      if (results.length > 0) {
        const potentialTriples: any[] = [];
        results.forEach((row: any) => {
          const s = row.s || row.subject || row.subj;
          const p = row.p || row.predicate || row.pred;
          const o = row.o || row.object || row.obj;

          if (s && p && o) {
            // Find original triple to preserve metadata like sourceUri and datatype
            const original = result.triples.find((t: any) =>
              t.subject === String(s) &&
              t.predicate === String(p) &&
              t.object === String(o)
            );

            if (original) {
              potentialTriples.push(original);
            } else {
              potentialTriples.push({
                subject: String(s),
                predicate: String(p),
                object: String(o),
                objectType: String(o).startsWith('http') ? 'NamedNode' : 'Literal'
              });
            }
          }
        });

        if (potentialTriples.length > 0) {
          setFilteredTriples(potentialTriples);
          setActiveTab('graph');
        } else {
          setFilteredTriples(null);
        }
      } else {
        setFilteredTriples(null);
      }
    } catch (err: any) {
      setSparqlError(err.response?.data?.error || err.message || "SPARQL Execution failed");
    } finally {
      setQuerying(false);
    }
  };

  const handleNodeClick = (id: string, isUri: boolean) => {
    if (isUri) {
      setSelectedUri(id);
      setShowUriActions(true);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-12">
        <span className="text-accent font-black uppercase text-xs tracking-widest block mb-4">TRY IT OUT YOURSELF</span>
        <h2 className="text-4xl md:text-5xl font-black text-poster-dark tracking-tighter">
          Live Extraction
        </h2>
      </div>

      <div className="strategy-card-blueprint p-8 rounded-2xl mb-12">
        <form onSubmit={(e) => handleExtract(e)} className="flex flex-col md:flex-row gap-4">
          <input
            type="url"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            className="flex-1 bg-white border border-accent/20 rounded-lg px-6 py-4 outline-none focus:border-accent font-mono text-sm text-poster-dark"
            placeholder="Enter a URI to extract..."
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-accent text-white font-bold uppercase tracking-widest hover:opacity-90 transition-opacity rounded-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Extract
          </button>
        </form>
      </div>

      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 font-medium mb-12">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-12 relative">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Source Strategy</div>
              <div className="font-bold text-accent">{result.metadata.source}</div>
            </div>
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Format</div>
              <div className="font-bold text-poster-dark">{result.metadata.format || 'Unknown'}</div>
            </div>
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Total Triples</div>
              <div className="font-bold text-poster-dark">{result.triples ? result.triples.length : 0}</div>
            </div>
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Active URI</div>
              <div className="font-bold text-poster-dark truncate text-xs">{result.metadata.url}</div>
            </div>
          </div>

          <AnimatePresence>
            {triplesAddedFeedback.show && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-12 right-12 z-[100] bg-accent text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Zap size={20} className="fill-white" />
                </div>
                <div>
                  <div className="font-bold text-sm">Exploration Success</div>
                  <p className="text-xs text-white/80">Added {triplesAddedFeedback.count} new triples to the graph.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-8">
            <div className="strategy-card-blueprint rounded-2xl overflow-hidden border border-accent/20 flex flex-col min-h-[600px]">
              {/* Tabs Header */}
              <div className="border-b border-accent/10 bg-white/50 flex items-center justify-between">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('graph')}
                    className={`px-8 py-5 text-xs font-bold uppercase tracking-widest transition-all border-r border-accent/10 flex items-center gap-2 ${activeTab === 'graph' ? 'bg-white text-accent' : 'text-[#666] hover:bg-white/50'}`}
                  >
                    <Network size={16} /> Knowledge Graph
                  </button>
                  <button
                    onClick={() => setActiveTab('sparql')}
                    className={`px-8 py-5 text-xs font-bold uppercase tracking-widest transition-all border-r border-accent/10 flex items-center gap-2 ${activeTab === 'sparql' ? 'bg-white text-accent' : 'text-[#666] hover:bg-white/50'}`}
                  >
                    <Code2 size={16} /> SPARQL Query
                  </button>
                  <button
                    onClick={() => setActiveTab('triples')}
                    className={`px-8 py-5 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border-r border-accent/10 ${activeTab === 'triples' ? 'bg-white text-accent' : 'text-[#666] hover:bg-white/50'}`}
                  >
                    <TerminalSquare size={16} /> Extracted Triples
                  </button>
                </div>
                <div className="px-6 hidden sm:block">
                  <span className="text-[10px] text-[#666] font-mono uppercase tracking-tighter">Exploration Workspace</span>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 relative flex flex-col">
                {activeTab === 'graph' && (
                  <div className="flex-1 bg-poster-bg/50 relative">
                    <KnowledgeGraph triples={filteredTriples || result.triples} onNodeClick={handleNodeClick} />

                    {filteredTriples && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                        <button
                          onClick={() => setFilteredTriples(null)}
                          className="bg-accent text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-poster-dark transition-colors"
                        >
                          <ListRestart size={12} /> Clear SPARQL Filter ({filteredTriples.length} results)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'sparql' && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col bg-[#0a0a0a]">
                      <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 w-full bg-transparent text-accent-light p-8 font-mono text-sm outline-none resize-none min-h-[300px]"
                        spellCheck={false}
                      />
                      <div className="p-6 border-t border-white/5 flex items-center gap-4 bg-[#0d0d0d]">
                        <button
                          onClick={executeSparql}
                          disabled={querying || !result}
                          className="px-8 py-3 bg-accent text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                          {querying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                          Execute SPARQL
                        </button>
                        {sparqlError && <span className="text-red-400 text-xs font-mono">{sparqlError}</span>}
                      </div>
                    </div>

                    {sparqlResults.length > 0 && (
                      <div className="border-t border-accent/10 bg-white/95 max-h-[300px] overflow-auto">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-[#f8fafc] sticky top-0 border-b border-accent/10">
                            <tr>
                              {Object.keys(sparqlResults[0]).map(key => (
                                <th key={key} className="p-4 border-r border-accent/5 font-bold text-accent uppercase tracking-wider">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sparqlResults.map((row, i) => (
                              <tr key={i} className="hover:bg-accent/5 transition-colors border-b border-accent/5">
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="p-4 border-r border-accent/5 break-all font-medium text-poster-dark">{val}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="p-4 bg-[#f8fafc] text-[10px] text-[#666] font-mono border-t border-accent/10">
                          Query returned {sparqlResults.length} results
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'triples' && (
                  <div className="flex-1 flex flex-col bg-[#0a0a0a]">
                    <div className="flex-1 overflow-auto bg-[#0a0a0a]">
                      <table className="w-full text-left text-xs font-mono border-collapse">
                        <thead className="text-[#666] border-b border-white/10 sticky top-0 bg-[#0a0a0a] z-10">
                          <tr>
                            <th className="p-4 font-normal uppercase tracking-widest text-[10px]">Subject</th>
                            <th className="p-4 font-normal uppercase tracking-widest text-[10px]">Predicate</th>
                            <th className="p-4 font-normal uppercase tracking-widest text-[10px]">Object</th>
                          </tr>
                        </thead>
                        <tbody className="text-white/80">
                          {result.triples.map((t: any, i: number) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 text-accent break-all max-w-[250px] font-medium">{t.subject}</td>
                              <td className="p-4 text-[#64b5f6] break-all max-w-[250px]">{t.predicate}</td>
                              <td className="p-4 break-all text-[#e2e8f0] max-w-[300px]">
                                {t.objectType === 'Literal' ? (
                                  <span className="text-green-400">"{t.object}"</span>
                                ) : (
                                  <span className="text-yellow-500">{"<"}{t.object}{">"}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* URI Action Modal/Overlay */}
                <AnimatePresence>
                  {showUriActions && selectedUri && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-6"
                      onClick={() => setShowUriActions(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-accent/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <Link2 size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-poster-dark">Explore URI</h4>
                            <p className="text-[10px] text-[#666] truncate max-w-[300px]">{selectedUri}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <button
                            onClick={() => handleExtract(null, selectedUri, false)}
                            className="w-full p-4 text-left border border-accent/10 hover:border-accent hover:bg-accent/5 rounded-xl transition-all group flex items-start gap-4"
                          >
                            <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center mt-1">
                              <Layers size={14} className="text-accent" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-poster-dark group-hover:text-accent font-sans">New Graph via WRX</div>
                              <div className="text-[11px] text-[#666]">Replace current view with fresh discovery from this URI.</div>
                            </div>
                          </button>

                          <button
                            onClick={() => handleExtract(null, selectedUri, true)}
                            className="w-full p-4 text-left border border-accent/10 hover:border-accent hover:bg-accent/5 rounded-xl transition-all group flex items-start gap-4"
                          >
                            <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center mt-1">
                              <Zap size={14} className="text-accent" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-poster-dark group-hover:text-accent font-sans">Expand via WRX</div>
                              <div className="text-[11px] text-[#666]">Crawl discovery and merge triples into your current workspace.</div>
                            </div>
                          </button>

                          <button
                            onClick={() => setShowUriActions(false)}
                            className="w-full p-3 text-center text-[#666] hover:text-poster-dark text-xs font-bold uppercase tracking-widest mt-4"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {result.rawContent && (
              <div className="strategy-card-blueprint rounded-2xl overflow-hidden border border-accent/20">
                <div className="border-b border-accent/10 p-6 bg-white/50">
                  <h3 className="font-bold flex items-center gap-2 text-poster-dark">
                    <FileCode size={18} className="text-accent" /> Raw Source Content
                  </h3>
                </div>
                <div className="p-8 bg-[#0a0a0a] overflow-x-auto max-h-[300px] overflow-y-auto">
                  <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap break-words leading-relaxed">
                    {result.rawContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-poster-bg text-poster-dark selection:bg-accent selection:text-white">
      <Header />

      {/* Background Blueprint Grid */}
      <div className="fixed inset-0 data-grid pointer-events-none" />

      {/* Floating Relations Background */}
      <div className="fixed inset-0 flex flex-col justify-around px-8 opacity-10 pointer-events-none">
        {RELATIONS.map((rel, i) => (
          <div key={rel} className="font-mono text-[10px] tracking-widest uppercase">
            {rel} // METADATA_RELATION_{i}
          </div>
        ))}
      </div>

      {/* Hero & Machine Section */}
      <section className="relative min-h-screen z-20 flex flex-col items-center justify-center pt-32 pb-16 px-8 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl px-8 mb-16"
        >
          <div className="mb-6 flex justify-center">
            <span className="text-accent font-black tracking-widest uppercase text-xs border border-accent/20 px-4 py-1.5 rounded-full bg-accent/5">
              THE SOLUTION: RADICAL TRANSPARENCY
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6 title-glow">
            WRX MODULE
          </h1>
          <p className="text-poster-dark/60 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-medium">
            Web Resource Extraction Framework for automated RDF discovery through
            the cascading path approach.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <BlueBox scrollOpacity={1} />
        </motion.div>
      </section>

      {/* Problem Section */}
      <ProblemSection />

      {/* Strategies Section */}
      <StrategiesSection />

      {/* Result Section */}
      <section className="relative py-24 md:py-32 w-full flex items-center justify-center z-40 bg-poster-bg border-t border-accent/10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-5xl px-8"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <span className="text-accent font-black uppercase text-xs tracking-widest block mb-4">THE RESULT</span>
                <h2 className="text-4xl md:text-6xl font-black text-poster-dark tracking-tighter">
                  True<br />Interoperability
                </h2>
              </div>
              <p className="text-[#666] leading-relaxed">
                A foundation for evolving, scalable data ecosystems across heterogeneous sources.
                Each step scored on reliability, provenance, and conversion metadata.
              </p>
              <div className="flex gap-4">
                <div className="p-4 bg-accent/5 border border-accent/10 rounded-lg flex-1">
                  <div className="flex items-center gap-2 text-accent mb-2 font-bold text-sm tracking-tight">
                    <Zap size={16} /> Measurable
                  </div>
                  <div className="text-[10px] text-poster-dark/50 uppercase font-mono">Real-time scoring</div>
                </div>
                <div className="p-4 bg-accent/5 border border-accent/10 rounded-lg flex-1">
                  <div className="flex items-center gap-2 text-accent mb-2 font-bold text-sm tracking-tight">
                    <Layers size={16} /> Standardized
                  </div>
                  <div className="text-[10px] text-poster-dark/50 uppercase font-mono">Open protocols</div>
                </div>
              </div>
            </div>

            <div className="strategy-card-blueprint p-8 md:p-12 rounded-2xl">
              <h3 className="font-bold mb-6 flex items-center gap-2 text-poster-dark">
                <Code2 className="text-accent" /> Start Discovery
              </h3>
              <div className="bg-poster-dark text-white p-6 rounded-lg font-mono text-sm mb-8 overflow-x-auto">
                <div className="flex gap-2 mb-4 opacity-50">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="text-accent-light flex gap-2">
                  <span className="opacity-40">01</span>
                  <span>import &#123; extractRDF &#125; from "wrx";</span>
                </div>
                <div className="text-white/60 flex gap-2">
                  <span className="opacity-40">02</span>
                  <span>const res = await extractRDF(uri);</span>
                </div>
              </div>
              <a href="https://github.com/cedricdcc/wrx" target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-accent text-white font-bold uppercase tracking-widest hover:opacity-90 transition-opacity rounded flex items-center justify-center gap-3">
                GitHub Repository <ArrowRight size={18} />
              </a>
            </div>
          </div>

          <div className="mt-20 pt-10 border-t border-accent/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-mono text-[10px] uppercase text-poster-dark/40 tracking-[0.3em]">
              WRX // RADICAL TRANSPARENCY APPROACH
            </span>
            <div className="flex gap-4">
              <div className="w-8 h-px bg-accent/20 self-center" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest italic">Live Processing</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Try It Out Section */}
      <section id="sandbox" className="relative min-h-screen w-full flex flex-col items-center justify-start z-40 bg-poster-bg pt-20 pb-20 border-t border-accent/10">
        <div className="w-full max-w-7xl px-8">
          <TryOutSection />
        </div>
      </section>
    </div>
  );
}
