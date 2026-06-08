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
  Network,
  CheckCircle2,
  Clock,
  BookOpen,
  Activity,
  ChevronDown,
  Check
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import KnowledgeGraph from "./components/KnowledgeGraph";
import { extractRDF, extractLinkRelations, extractAllRDF, collectProfileValues } from "wrx";
import * as N3 from "n3";
import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import jsonld from "jsonld";

import {
  contentNegotiationStrategy,
  linkHeaderStrategy,
  htmlSignpostingStrategy,
  embeddedScriptStrategy,
  foafStrategy,
  sameAsStrategy,
  skosStrategy,
  rdfCollectionsStrategy,
  provenanceStrategy,
  collectionMembershipStrategy,
  htmlLinksStrategy,
  rdfaStrategy,
  microdataStrategy,
  openGraphStrategy,
  dublinCoreStrategy,
  canonicalStrategy,
  httpLinkRelationsStrategy,
  paginationStrategy,
  reverseLinksStrategy,
  circularGraphsStrategy,
  linksetStrategy,
  dcatCatalogStrategy,
  wellKnownStrategy,
  resourceMapStrategy,
  sitemapSignpostingStrategy,
  rssFeedStrategy,
  atomFeedStrategy,
  manifestStrategy,
  apiDiscoveryStrategy
} from "../../src/strategies/index";

const ALL_STRATEGIES = [
  contentNegotiationStrategy,
  linkHeaderStrategy,
  htmlSignpostingStrategy,
  embeddedScriptStrategy,
  foafStrategy,
  sameAsStrategy,
  skosStrategy,
  rdfCollectionsStrategy,
  provenanceStrategy,
  collectionMembershipStrategy,
  htmlLinksStrategy,
  rdfaStrategy,
  microdataStrategy,
  openGraphStrategy,
  dublinCoreStrategy,
  canonicalStrategy,
  httpLinkRelationsStrategy,
  paginationStrategy,
  reverseLinksStrategy,
  circularGraphsStrategy,
  linksetStrategy,
  dcatCatalogStrategy,
  wellKnownStrategy,
  resourceMapStrategy,
  sitemapSignpostingStrategy,
  rssFeedStrategy,
  atomFeedStrategy,
  manifestStrategy,
  apiDiscoveryStrategy
];

const IMPLEMENTED_STRATEGY_IDS = [
  'content-negotiation',
  'signposting-link-header',
  'signposting-html-link',
  'embedded-script',
  'linkset',
  'sitemap-signposting'
];

const STRATEGY_ICONS: Record<string, any> = {
  'content-negotiation': Globe,
  'signposting-link-header': Search,
  'signposting-html-link': Search,
  'embedded-script': FileCode,
  'foaf': Layers,
  'same-as': Link2,
  'skos': Layers,
  'rdf-collections': Database,
  'provenance': Zap,
  'collection-membership': Layers,
  'html-links': Link2,
  'rdfa': FileCode,
  'microdata': FileCode,
  'open-graph': Share2,
  'dublin-core': FileCode,
  'canonical': Link2,
  'http-link-relations': Network,
  'pagination': ListRestart,
  'reverse-links': Network,
  'circular-graphs': Network,
  'linkset': Link2,
  'dcat-catalog': Database,
  'well-known': Globe,
  'resource-map': Database,
  'sitemap-signposting': Database,
  'rss-feed': Share2,
  'atom-feed': Share2,
  'manifest': FileCode,
  'api-discovery': Share2,
};


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
  const [selectedStrategy, setSelectedStrategy] = useState<any | null>(null);

  // Group strategies by quadrant
  const q1 = ALL_STRATEGIES.filter(s => s.quadrant === 1);
  const q2 = ALL_STRATEGIES.filter(s => s.quadrant === 2);
  const q3 = ALL_STRATEGIES.filter(s => s.quadrant === 3);
  const q4 = ALL_STRATEGIES.filter(s => s.quadrant === 4);

  const renderQuadrantCard = (title: string, quadrantNum: number, strategies: any[], desc: string, badgeColor: string) => {
    return (
      <div className="strategy-card-blueprint p-6 rounded-2xl flex flex-col justify-between group transition-all hover:border-accent hover:shadow-2xl duration-300">
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="font-sans font-black text-poster-dark/80 text-base uppercase tracking-wider">
              Q{quadrantNum}: {title}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${badgeColor} uppercase tracking-wider`}>
              {quadrantNum === 1 || quadrantNum === 3 ? "Direct RDF" : "Inferenced"}
            </span>
          </div>
          <p className="text-xs text-poster-dark/60 font-medium mb-6 leading-relaxed">
            {desc}
          </p>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {strategies.map((s) => {
              const Icon = STRATEGY_ICONS[s.source] || Search;
              const isImplemented = IMPLEMENTED_STRATEGY_IDS.includes(s.source);
              return (
                <button
                  key={s.source}
                  onClick={() => setSelectedStrategy(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all duration-200 ${
                    isImplemented
                      ? "bg-accent/5 hover:bg-accent/10 border-accent/20 text-poster-dark hover:border-accent"
                      : "bg-poster-bg/50 hover:bg-poster-bg border-dashed border-accent/10 text-poster-dark/60 hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1 rounded ${isImplemented ? "bg-accent/10 text-accent" : "bg-poster-dark/5 text-poster-dark/40"}`}>
                      <Icon size={14} />
                    </div>
                    <span className="truncate font-sans font-semibold">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isImplemented ? (
                      <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded-[4px] text-[9px] font-bold uppercase tracking-wider">
                        Active
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-[4px] text-[9px] font-bold uppercase tracking-wider">
                        Roadmap
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section id="solution" className="relative py-24 md:py-32 z-20 max-w-6xl mx-auto px-8 border-t border-accent/10">
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px bg-accent/30" />
          <span className="text-accent font-black uppercase text-xs tracking-widest block">2X2 TAXONOMY MATRIX</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-poster-dark tracking-tighter">
          Cascading Discovery Pipeline
        </h2>
        <p className="text-poster-dark/60 max-w-2xl mt-4 font-medium">
          WRX processes resources by checking each discovery technique sequentially, cascading automatically until an explorable RDF representation is successfully resolved. Clicking any technique exposes its specification details.
        </p>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {/* Quadrant 1 */}
        {renderQuadrantCard(
          "Resource-Direct",
          1,
          q1,
          "Natively serialized RDF retrieved directly from the resource URI response headers or page body.",
          "bg-accent/10 text-accent border border-accent/20"
        )}

        {/* Quadrant 2 */}
        {renderQuadrantCard(
          "Resource-Inferenced",
          2,
          q2,
          "Embedded markup or hyperlinks within the resource page that the client must parse and translate into RDF.",
          "bg-blue-500/10 text-blue-600 border border-blue-200/20"
        )}

        {/* Quadrant 3 */}
        {renderQuadrantCard(
          "Domain-Direct",
          3,
          q3,
          "Natively serialized RDF datasets hosted at domain-wide endpoints or dynamic catalogs.",
          "bg-teal-500/10 text-teal-600 border border-teal-200/20"
        )}

        {/* Quadrant 4 */}
        {renderQuadrantCard(
          "Domain-Inferenced",
          4,
          q4,
          "Host-wide XML indices, sitemaps, and feeds that detail resource paths and require translation to RDF.",
          "bg-indigo-500/10 text-indigo-600 border border-indigo-200/20"
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedStrategy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedStrategy(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full border border-accent/20 relative"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  IMPLEMENTED_STRATEGY_IDS.includes(selectedStrategy.source)
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "bg-poster-dark/5 text-poster-dark/40 border border-poster-dark/10"
                }`}>
                  {(() => {
                    const Icon = STRATEGY_ICONS[selectedStrategy.source] || Search;
                    return <Icon size={24} />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-black uppercase tracking-widest text-accent">
                      Quadrant {selectedStrategy.quadrant}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
                      IMPLEMENTED_STRATEGY_IDS.includes(selectedStrategy.source)
                        ? "bg-green-500/10 text-green-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {IMPLEMENTED_STRATEGY_IDS.includes(selectedStrategy.source) ? "Implemented / Active" : "Roadmap / Planned"}
                    </span>
                  </div>
                  <h4 className="font-black text-xl text-poster-dark tracking-tight leading-tight">
                    {selectedStrategy.label}
                  </h4>
                </div>
              </div>

              {/* Taxonomy Specs */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-poster-bg rounded-xl border border-accent/5 mb-6 text-xs font-semibold">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-poster-dark/50 mb-1">Location</div>
                  <div className="text-poster-dark font-bold font-sans flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {selectedStrategy.location} Level
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-poster-dark/50 mb-1">Extraction Type</div>
                  <div className="text-poster-dark font-bold font-sans flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {selectedStrategy.extraction} RDF
                  </div>
                </div>
              </div>

              {/* Description & Specs */}
              <div className="space-y-4 mb-8">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#666] block mb-1">Concept Overview</span>
                  <p className="text-sm text-[#4a5568] leading-relaxed font-medium">
                    {selectedStrategy.extraInfo?.replace('TODO: ', '') || "No explanation provided."}
                  </p>
                </div>

                {selectedStrategy.standard && (
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#666] block mb-1">Protocol / Standard</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-poster-dark font-bold bg-accent/5 px-2.5 py-1 rounded border border-accent/10">
                        {selectedStrategy.standard}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex gap-3 pt-4 border-t border-accent/5">
                {selectedStrategy.specLink && (
                  <a
                    href={selectedStrategy.specLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 bg-accent hover:opacity-90 transition-opacity text-white text-center text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                  >
                    <BookOpen size={14} /> View Specification <ExternalLink size={10} />
                  </a>
                )}
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="px-6 py-3 border border-[#cbd5e1] hover:bg-poster-bg transition-colors text-poster-dark text-xs font-bold uppercase tracking-widest rounded-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const RoadmapSection = () => {
  const [activeTab, setActiveTab] = useState<1 | 3 | 2 | 4>(1); // Quadrant rank order: 1 -> 3 -> 2 -> 4

  // Group strategies by quadrant
  const q1 = ALL_STRATEGIES.filter(s => s.quadrant === 1);
  const q2 = ALL_STRATEGIES.filter(s => s.quadrant === 2);
  const q3 = ALL_STRATEGIES.filter(s => s.quadrant === 3);
  const q4 = ALL_STRATEGIES.filter(s => s.quadrant === 4);

  // Count implemented per quadrant
  const countImplemented = (strategies: any[]) =>
    strategies.filter(s => IMPLEMENTED_STRATEGY_IDS.includes(s.source)).length;

  const q1Imp = countImplemented(q1);
  const q2Imp = countImplemented(q2);
  const q3Imp = countImplemented(q3);
  const q4Imp = countImplemented(q4);

  const totalImplemented = q1Imp + q2Imp + q3Imp + q4Imp;
  const totalStrategies = ALL_STRATEGIES.length;
  const percentage = Math.round((totalImplemented / totalStrategies) * 100);

  const quadrants = [
    { id: 1 as const, name: "Resource-Direct", rank: 1, count: q1.length, imp: q1Imp, color: "accent", strategies: q1, desc: "Direct RDF payloads served on the resource URI." },
    { id: 3 as const, name: "Domain-Direct", rank: 2, count: q3.length, imp: q3Imp, color: "teal-500", strategies: q3, desc: "Direct RDF catalogs hosted at host-wide entrypoints." },
    { id: 2 as const, name: "Resource-Inferenced", rank: 3, count: q2.length, imp: q2Imp, color: "blue-500", strategies: q2, desc: "Embedded page structures requiring client translation to RDF." },
    { id: 4 as const, name: "Domain-Inferenced", rank: 4, count: q4.length, imp: q4Imp, color: "indigo-500", strategies: q4, desc: "Domain XML indices and feeds describing resource locations." }
  ];

  const activeQuad = quadrants.find(q => q.id === activeTab)!;

  return (
    <section id="roadmap" className="relative py-24 md:py-32 z-20 max-w-6xl mx-auto px-8 border-t border-accent/10">
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px bg-accent/30" />
          <span className="text-accent font-black uppercase text-xs tracking-widest block">DEVELOPMENT ROADMAP</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-poster-dark tracking-tighter">
              Implementation Roadmap
            </h2>
            <p className="text-poster-dark/60 max-w-xl mt-4 font-medium">
              Tracking the completeness of the WRX discovery engine. Quadrants are prioritized by their semantic confidence ranking (Resource-Direct first, Domain-Inferenced last).
            </p>
          </div>

          {/* Progress Circle or Bar */}
          <div className="flex items-center gap-6 p-6 bg-white border border-accent/15 rounded-2xl shadow-sm shrink-0">
            {/* Progress Bar or Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-accent/10"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-accent"
                  strokeDasharray={`${percentage}, 100`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute font-sans font-black text-sm text-poster-dark">
                {percentage}%
              </div>
            </div>
            <div>
              <div className="font-sans font-black text-base text-poster-dark">
                {totalImplemented} / {totalStrategies}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-widest text-poster-dark/50">
                Strategies Active
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quadrant Progress Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {quadrants.map((q) => {
          const isSelected = activeTab === q.id;
          const qPercent = Math.round((q.imp / q.count) * 100);
          return (
            <button
              key={q.id}
              onClick={() => setActiveTab(q.id)}
              className={`p-5 rounded-2xl text-left border transition-all duration-300 ${
                isSelected
                  ? "bg-white border-accent shadow-lg shadow-accent/5 ring-1 ring-accent/10 scale-[1.02]"
                  : "bg-white/40 border-accent/10 hover:border-accent/30 hover:bg-white/70"
              }`}
            >
              <div className="text-[9px] font-mono font-black uppercase tracking-wider text-poster-dark/40 mb-1 flex items-center justify-between">
                <span>Rank {q.rank}</span>
                <span>Q{q.id}</span>
              </div>
              <h4 className="font-black text-sm text-poster-dark truncate mb-3">
                {q.name}
              </h4>
              <div className="w-full bg-poster-dark/5 rounded-full h-1.5 mb-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    q.id === 1 ? "bg-accent" : q.id === 3 ? "bg-teal-500" : q.id === 2 ? "bg-blue-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${qPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-poster-dark/70">
                <span>{q.imp} / {q.count} Active</span>
                <span>{qPercent}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Content / Interactive Timeline */}
      <div className="strategy-card-blueprint rounded-3xl overflow-hidden border border-accent/15 bg-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-accent/5 pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
                Quadrant {activeQuad.id} Mappings
              </span>
              <span className="px-2 py-0.5 bg-accent/5 border border-accent/10 rounded text-[9px] font-mono font-bold text-accent uppercase tracking-wider">
                Rank {activeQuad.rank} Priority
              </span>
            </div>
            <h3 className="text-xl font-black text-poster-dark tracking-tight">
              {activeQuad.name} Phase
            </h3>
            <p className="text-xs text-poster-dark/50 font-medium mt-1">
              {activeQuad.desc}
            </p>
          </div>

          <div className="text-[11px] font-bold text-poster-dark/60 font-mono">
            {activeQuad.imp} of {activeQuad.count} techniques completed
          </div>
        </div>

        {/* Timeline List */}
        <div className="relative border-l-2 border-accent/10 ml-3 pl-6 md:pl-8 space-y-8 py-2">
          {activeQuad.strategies.map((s) => {
            const isImplemented = IMPLEMENTED_STRATEGY_IDS.includes(s.source);
            const Icon = STRATEGY_ICONS[s.source] || Search;
            return (
              <div key={s.source} className="relative group">
                {/* Connector Dot */}
                <div className={`absolute -left-[33px] md:-left-[41px] top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-300 ${
                  isImplemented
                    ? "bg-white border-green-500 text-green-500"
                    : "bg-white border-amber-500/40 text-amber-500/40 group-hover:border-amber-500"
                }`}>
                  {isImplemented ? <Check size={10} strokeWidth={3} /> : <Clock size={10} />}
                </div>

                <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-8 justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1 rounded ${isImplemented ? "bg-green-50 text-green-600" : "bg-amber-50/50 text-amber-600/60"}`}>
                        <Icon size={14} />
                      </div>
                      <h4 className={`text-base font-black tracking-tight ${isImplemented ? "text-poster-dark" : "text-poster-dark/50"}`}>
                        {s.label}
                      </h4>
                      {isImplemented ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-[9px] font-bold uppercase tracking-wider">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[9px] font-bold uppercase tracking-wider">
                          Planned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#4a5568]/80 leading-relaxed font-medium pl-0.5">
                      {s.extraInfo?.replace('TODO: ', '') || "Concept explanation details."}
                    </p>
                  </div>

                  {/* Specification info */}
                  {s.standard && (
                    <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 mt-1">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-poster-dark/40">Specification</span>
                      {s.specLink ? (
                        <a
                          href={s.specLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-accent/5 hover:bg-accent/10 border border-accent/10 rounded font-sans text-[11px] font-bold text-accent transition-colors flex items-center gap-1.5"
                        >
                          {s.standard} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="px-2.5 py-1 bg-poster-dark/5 border border-poster-dark/10 rounded font-sans text-[11px] font-bold text-poster-dark/60">
                          {s.standard}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

function convertRelationsToTriples(relations: any[], sourceUri: string): any[] {
  const triples: any[] = [];
  const xhtml = 'http://www.w3.org/1999/xhtml#';
  const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  for (const relation of relations) {
    // Generate a unique blank node ID for this link relation
    const blankNodeId = `_:b_link_${Math.random().toString(36).substring(2, 9)}`;

    triples.push({
      subject: blankNodeId,
      predicate: rdfType,
      object: `${xhtml}link`,
      objectType: 'NamedNode',
      datatype: '',
      sourceUri
    });

    triples.push({
      subject: blankNodeId,
      predicate: `${xhtml}anchor`,
      object: relation.anchor ?? relation.href,
      objectType: 'NamedNode',
      datatype: '',
      sourceUri
    });

    const isRelAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relation.rel);
    triples.push({
      subject: blankNodeId,
      predicate: `${xhtml}rel`,
      object: relation.rel,
      objectType: isRelAbsolute ? 'NamedNode' : 'Literal',
      datatype: '',
      sourceUri
    });

    triples.push({
      subject: blankNodeId,
      predicate: `${xhtml}href`,
      object: relation.href,
      objectType: 'NamedNode',
      datatype: '',
      sourceUri
    });

    const options = relation.options ?? [];
    for (const option of options) {
      const optionNodeId = `_:b_opt_${Math.random().toString(36).substring(2, 9)}`;
      
      triples.push({
        subject: blankNodeId,
        predicate: `${xhtml}option`,
        object: optionNodeId,
        objectType: 'BlankNode',
        datatype: '',
        sourceUri
      });

      triples.push({
        subject: optionNodeId,
        predicate: rdfType,
        object: `${xhtml}LinkOption`,
        objectType: 'NamedNode',
        datatype: '',
        sourceUri
      });

      triples.push({
        subject: optionNodeId,
        predicate: `${xhtml}optionKey`,
        object: option.name ?? '',
        objectType: 'Literal',
        datatype: '',
        sourceUri
      });

      triples.push({
        subject: optionNodeId,
        predicate: `${xhtml}optionVal`,
        object: option.value ?? '',
        objectType: 'Literal',
        datatype: '',
        sourceUri
      });
    }

    if (options.length === 0) {
      const emptyOptionNodeId = `_:b_opt_${Math.random().toString(36).substring(2, 9)}`;
      triples.push({
        subject: blankNodeId,
        predicate: `${xhtml}option`,
        object: emptyOptionNodeId,
        objectType: 'BlankNode',
        datatype: '',
        sourceUri
      });
    }
  }

  return triples;
}

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

  const [activeTab, setActiveTab] = useState<'graph' | 'sparql' | 'triples' | 'report'>('report');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [showUriActions, setShowUriActions] = useState(false);

  const [triplesAddedFeedback, setTriplesAddedFeedback] = useState<{ count: number, show: boolean }>({ count: 0, show: false });
  const [extendLinks, setExtendLinks] = useState(true);

  // Report & Trace States
  const [traceSteps, setTraceSteps] = useState<any[]>([]);
  const [strategyTriples, setStrategyTriples] = useState<Record<string, any[]>>({});
  const [selectedReportStrategy, setSelectedReportStrategy] = useState<any | null>(null);

  const parseRdfToTriples = async (contentStr: string, format: string, url: string): Promise<any[]> => {
    const triples: any[] = [];
    try {
      const lowerFormat = (format || '').toLowerCase();
      if (lowerFormat.includes('json') && lowerFormat.includes('ld')) {
        const json = JSON.parse(contentStr);
        const nquads = await jsonld.toRDF(json, { format: 'application/n-quads' });
        const parser = new N3.Parser({ format: 'N-Quads', baseIRI: url });
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
      } else {
        const parser = new N3.Parser({ baseIRI: url });
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
      }
    } catch (e) {
      console.error(`Parsing failed for format ${format}:`, e);
    }
    return triples;
  };

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
      const [allRdfResult, linkRelations] = await Promise.all([
        extractAllRDF(uriToFetch).catch(() => null),
        extendLinks ? extractLinkRelations(uriToFetch).catch(err => {
          console.error("Failed to extract link relations:", err);
          return [];
        }) : Promise.resolve([])
      ]);
      
      const overview = allRdfResult as any;
      const hasRdf = !!(overview && overview.found && overview.found.length > 0);
      const hasLinks = !!(linkRelations && linkRelations.length > 0);

      if (!hasRdf && !hasLinks) {
        throw new Error("No RDF content or web-link relations found");
      }

      // Track triples per strategy
      const triplesMap: Record<string, any[]> = {};
      let allMergedTriples: any[] = [];
      let primaryRawContent = "";
      let primarySource = "";
      let primaryFormat = "";
      let primaryUrl = uriToFetch;

      if (hasRdf && overview && overview.found) {
        for (const item of overview.found) {
          const contentStr = typeof item.content === 'string' 
            ? item.content 
            : JSON.stringify(item.content);
          
          if (!primaryRawContent) {
            primaryRawContent = contentStr;
            primarySource = item.source || 'Content Negotiation';
            primaryFormat = item.format || item.mime || '';
            primaryUrl = item.url || uriToFetch;
          }

          const parsedTriples = await parseRdfToTriples(contentStr, item.format || item.mime || '', item.url || uriToFetch);
          
          // Store under this strategy
          const srcKey = item.source || 'content-negotiation';
          if (!triplesMap[srcKey]) triplesMap[srcKey] = [];
          triplesMap[srcKey] = [...triplesMap[srcKey], ...parsedTriples];

          // Merge to the global pool (avoiding exact duplicates)
          parsedTriples.forEach((pt: any) => {
            if (!allMergedTriples.some(t => t.subject === pt.subject && t.predicate === pt.predicate && t.object === pt.object)) {
              allMergedTriples.push(pt);
            }
          });
        }
      }

      // Convert Link Relations to Triples and merge
      let extendedLinksCount = 0;
      let profiles: string[] = [];
      if (linkRelations) {
        profiles = collectProfileValues(linkRelations);
      }
      if (hasLinks && linkRelations) {
        const relationTriples = convertRelationsToTriples(linkRelations, uriToFetch);
        extendedLinksCount = relationTriples.length;
        triplesMap['extended-links'] = relationTriples;
        
        relationTriples.forEach((rt: any) => {
          if (!allMergedTriples.some(t => t.subject === rt.subject && t.predicate === rt.predicate && t.object === rt.object)) {
            allMergedTriples.push(rt);
          }
        });
      }

      setStrategyTriples(triplesMap);

      if (overview && overview.trace) {
        setTraceSteps(overview.trace);
      } else {
        setTraceSteps([]);
      }

      const newData = {
        metadata: {
          source: primarySource || 'Extended Web-Link Relations',
          format: primaryFormat || 'linkset-relations',
          url: primaryUrl,
          extendedLinksCount,
          profiles
        },
        triples: allMergedTriples,
        rawContent: primaryRawContent || null
      };

      // Tag triples with their source URI for grouping in the graph
      const taggedTriples = (newData.triples || []).map((t: any) => ({
        ...t,
        sourceUri: t.sourceUri || uriToFetch
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

      <div className="strategy-card-blueprint p-8 rounded-2xl mb-12 flex flex-col gap-4">
        <form onSubmit={(e) => handleExtract(e)} className="flex flex-col md:flex-row gap-4 w-full">
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

        <div className="flex items-center gap-2 select-none border-t border-accent/5 pt-3">
          <label className="relative flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={extendLinks}
              onChange={(e) => setExtendLinks(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-accent/10 border border-accent/30 rounded-full peer-checked:bg-accent relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 transition-colors" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#4a5568] group-hover:text-accent transition-colors flex items-center gap-1.5">
              <Link2 size={13} className="text-accent" /> Extend Links (Include Web-Link Relations as Triples)
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 font-medium mb-12">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-12 relative">
          <div className="grid md:grid-cols-4 gap-6">
            {/* Box 1: Actual URL */}
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Actual URL</div>
              <div className="font-bold text-poster-dark truncate text-xs" title={result.metadata.url}>{result.metadata.url}</div>
            </div>

            {/* Box 2: Discovery Strategy */}
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Discovery Strategy</div>
              <div className="font-bold text-accent">{result.metadata.source}</div>
            </div>

            {/* Box 3: Profiles */}
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Profiles</div>
              <div className="font-bold text-poster-dark flex flex-wrap gap-1.5 mt-1">
                {result.metadata.profiles && result.metadata.profiles.length > 0 ? (
                  result.metadata.profiles.map((prof: string, idx: number) => {
                    let label = prof;
                    try {
                      const urlObj = new URL(prof);
                      label = urlObj.hash ? urlObj.hash.substring(1) : urlObj.pathname.split('/').filter(Boolean).pop() || prof;
                    } catch (e) {}
                    return (
                      <a
                        key={idx}
                        href={prof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent rounded text-[10px] font-mono font-bold tracking-tight transition-colors truncate max-w-[150px]"
                        title={prof}
                      >
                        {label}
                      </a>
                    );
                  })
                ) : (
                  <span className="text-poster-dark/40 font-normal text-xs italic">No profile declared</span>
                )}
              </div>
            </div>

            {/* Box 4: Total Triples */}
            <div className="p-6 bg-white border border-accent/10 rounded-xl shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-[#666] mb-2">Total Triples</div>
              <div className="font-bold text-poster-dark flex items-center gap-2">
                <span>{result.triples ? result.triples.length : 0}</span>
                {result.metadata.extendedLinksCount > 0 && (
                  <span className="text-[9px] font-bold text-accent bg-accent/5 px-2 py-0.5 rounded-full border border-accent/10 whitespace-nowrap">
                    +{result.metadata.extendedLinksCount} web-links
                  </span>
                )}
              </div>
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
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-8 py-5 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border-r border-accent/10 ${activeTab === 'report' ? 'bg-white text-accent' : 'text-[#666] hover:bg-white/50'}`}
                  >
                    <Activity size={16} /> Cascade Report
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

                {activeTab === 'report' && (
                  <div className="flex-1 flex flex-col bg-[#f8fafc] p-6 md:p-8 overflow-y-auto max-h-[650px]">
                    {/* Report Overview Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white border border-accent/15 rounded-xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                          <Activity size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-poster-dark/50 font-bold mb-0.5">Cascade Flow</div>
                          <div className="font-sans font-black text-lg text-poster-dark">
                            {traceSteps.length > 0 ? traceSteps.length : 29} checked
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-accent/15 rounded-xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-poster-dark/50 font-bold mb-0.5">Successful Hits</div>
                          <div className="font-sans font-black text-lg text-poster-dark">
                            {traceSteps.filter(t => t.found).length} strategies
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-accent/15 rounded-xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600">
                          <Layers size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-poster-dark/50 font-bold mb-0.5">Extracted Graph</div>
                          <div className="font-sans font-black text-lg text-poster-dark">
                            {result?.triples?.length || 0} triples
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trace Steps Table */}
                    <div className="bg-white border border-accent/15 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-accent/10 bg-white flex items-center justify-between">
                        <h4 className="font-sans font-black text-poster-dark tracking-tight text-sm">
                          Cascade Strategy Trace Steps
                        </h4>
                        <span className="px-2 py-0.5 bg-accent/5 rounded text-[10px] font-mono font-bold text-accent uppercase tracking-wider">
                          --all active
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-sans border-collapse">
                          <thead className="bg-[#f8fafc] text-poster-dark/50 border-b border-accent/10 font-bold font-mono">
                            <tr>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Step</th>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Strategy</th>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Quadrant</th>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Status</th>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Payload</th>
                              <th className="p-4 uppercase tracking-wider text-[10px]">Triples</th>
                              <th className="p-4 uppercase tracking-wider text-[10px] text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-accent/5">
                            {traceSteps.map((step) => {
                              const strategyTriplesCount = (strategyTriples[step.source] || []).length;
                              return (
                                <tr key={step.source} className="hover:bg-accent/5 transition-colors">
                                  <td className="p-4 font-mono font-black text-poster-dark/50 text-[11px]">
                                    Step 0{step.strategy || step.strategy === 0 ? step.strategy : step.index + 1}
                                  </td>
                                  <td className="p-4 font-sans font-bold text-poster-dark text-xs">
                                    {step.label}
                                  </td>
                                  <td className="p-4 font-sans font-semibold text-poster-dark/70 text-xs">
                                    Q{step.quadrant}: {
                                      step.quadrant === 1 ? "Resource-Direct" :
                                      step.quadrant === 2 ? "Resource-Inferenced" :
                                      step.quadrant === 3 ? "Domain-Direct" :
                                      "Domain-Inferenced"
                                    }
                                  </td>
                                  <td className="p-4">
                                    {step.found ? (
                                      <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-green-500" /> RDF Found
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                        <span className="w-1 h-1 rounded-full bg-red-500" /> No RDF
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-4 font-mono font-bold text-poster-dark/70 text-[11px]">
                                    {step.found && step.hits?.[0]?.chars
                                      ? `${(step.hits[0].chars / 1024).toFixed(2)} KB`
                                      : "-"}
                                  </td>
                                  <td className="p-4 font-mono font-bold text-[11px]">
                                    {step.found ? (
                                      <span className="text-accent">{strategyTriplesCount} triples</span>
                                    ) : (
                                      <span className="text-poster-dark/40">-</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-right">
                                    {step.found && strategyTriplesCount > 0 ? (
                                      <button
                                        onClick={() => setSelectedReportStrategy(step)}
                                        className="px-3 py-1.5 bg-accent hover:opacity-90 transition-opacity text-white text-[10px] font-bold uppercase tracking-widest rounded-md inline-flex items-center gap-1 shadow-sm font-sans"
                                      >
                                        View Triples
                                      </button>
                                    ) : (
                                      <button
                                        disabled
                                        className="px-3 py-1.5 border border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-md inline-flex items-center gap-1 cursor-not-allowed font-sans"
                                      >
                                        No Triples
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
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

                {/* Strategy Triples Detail Modal */}
                <AnimatePresence>
                  {selectedReportStrategy && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-6"
                      onClick={() => setSelectedReportStrategy(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full border border-accent/20 flex flex-col max-h-[90%]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                              {(() => {
                                const Icon = STRATEGY_ICONS[selectedReportStrategy.source] || Search;
                                return <Icon size={24} />;
                              })()}
                            </div>
                            <div>
                              <h4 className="font-bold text-poster-dark font-sans">{selectedReportStrategy.label} Triples</h4>
                              <p className="text-[10px] text-[#666] font-sans">
                                Extracted {(strategyTriples[selectedReportStrategy.source] || []).length} triples
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const triples = strategyTriples[selectedReportStrategy.source] || [];
                              const ntriplesContent = triples.map(t => {
                                const objStr = t.objectType === 'Literal' ? `"${t.object}"` : `<${t.object}>`;
                                return `<${t.subject}> <${t.predicate}> ${objStr} .`;
                              }).join('\n');
                              const blob = new Blob([ntriplesContent], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${selectedReportStrategy.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_triples.nt`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          >
                            Download .nt
                          </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl mb-6">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead className="text-white/40 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                              <tr>
                                <th className="p-3 font-normal uppercase tracking-widest text-[9px]">Subject</th>
                                <th className="p-3 font-normal uppercase tracking-widest text-[9px]">Predicate</th>
                                <th className="p-3 font-normal uppercase tracking-widest text-[9px]">Object</th>
                              </tr>
                            </thead>
                            <tbody className="text-white/80">
                              {(strategyTriples[selectedReportStrategy.source] || []).map((t: any, i: number) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-white/5 transition-colors">
                                  <td className="p-3 text-accent break-all max-w-[180px] font-medium">{t.subject}</td>
                                  <td className="p-3 text-[#64b5f6] break-all max-w-[180px]">{t.predicate}</td>
                                  <td className="p-3 break-all text-[#e2e8f0] max-w-[200px]">
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

                        <button
                          onClick={() => setSelectedReportStrategy(null)}
                          className="w-full py-3 text-center border border-slate-200 hover:bg-slate-50 text-poster-dark text-xs font-bold uppercase tracking-widest rounded-lg transition-colors cursor-pointer font-sans"
                        >
                          Close
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem("visited_wrx");
    if (hasVisited) {
      setIsReturningVisitor(true);
    } else {
      localStorage.setItem("visited_wrx", "true");
    }
  }, []);

  const problemSection = <ProblemSection key="problem" />;
  const strategiesSection = <StrategiesSection key="strategies" />;
  const roadmapSection = <RoadmapSection key="roadmap" />;
  
  const resultSection = (
    <section key="result" className="relative py-24 md:py-32 w-full flex items-center justify-center z-40 bg-poster-bg border-t border-accent/10">
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
  );

  const sandboxSection = (
    <section id="sandbox" key="sandbox" className="relative min-h-screen w-full flex flex-col items-center justify-start z-40 bg-poster-bg pt-20 pb-20 border-t border-accent/10">
      <div className="w-full max-w-7xl px-8">
        <TryOutSection />
      </div>
    </section>
  );

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

      {/* Hero Section */}
      <section className="relative min-h-screen z-20 flex flex-col items-center justify-center pt-28 pb-16 px-8 max-w-7xl mx-auto w-full">

        {/* Video Explainer Player - Center aligned & Large (max-w-5xl) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="w-full max-w-5xl rounded-3xl overflow-hidden border border-accent/20 shadow-2xl shadow-accent/15 bg-white relative p-1.5 backdrop-blur-md mb-10"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full aspect-video rounded-2xl bg-[#f8fafc] object-cover"
            src="./assets/wrx_explainer.mp4"
          />
        </motion.div>

        {/* Action Buttons Centered Below Video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex flex-wrap justify-center gap-4 w-full"
        >
          <a
            href="#sandbox"
            className="px-8 py-4 bg-accent text-white font-bold uppercase tracking-widest text-xs rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-accent/20 cursor-pointer"
          >
            <Play size={12} fill="white" /> Launch Sandbox
          </a>
          <a
            href="https://cedricdcc.github.io/papers/wrx/wrx.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 border border-poster-dark/20 hover:bg-poster-dark/5 text-poster-dark font-bold uppercase tracking-widest text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen size={12} /> Read Paper
          </a>
        </motion.div>
      </section>

      {/* Render sections conditionally based on returning visitor status */}
      {isReturningVisitor ? (
        <>
          {sandboxSection}
          {problemSection}
          {strategiesSection}
          {roadmapSection}
          {resultSection}
        </>
      ) : (
        <>
          {problemSection}
          {strategiesSection}
          {roadmapSection}
          {resultSection}
          {sandboxSection}
        </>
      )}
    </div>
  );
}
