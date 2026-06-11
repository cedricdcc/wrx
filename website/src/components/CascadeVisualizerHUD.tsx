import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Cpu,
  Layers,
  Network,
  HelpCircle,
  Sparkles
} from "lucide-react";

interface NodeData {
  id: string;
  label: string;
  type: "subject" | "uri" | "literal" | "class";
  x: number;
  y: number;
}

interface EdgeData {
  from: string;
  to: string;
  label: string;
}

interface Preset {
  name: string;
  badge: string;
  uri: string;
  stages: {
    s1: "success" | "failed" | "pending";
    s2: "success" | "failed" | "pending";
    s3: "success" | "failed" | "pending";
  };
  timeline: {
    stage: "input" | "blackbox" | "matrix" | "output";
    activeStage?: number;
    stageStatus?: Record<number, "pending" | "active" | "success" | "failed">;
    statusText: string;
    delay: number;
  }[];
  nodes: NodeData[];
  edges: EdgeData[];
}

const PRESETS: Record<string, Preset> = {
  zenodo: {
    name: "Zenodo Repository",
    badge: "Scholarly DOI",
    uri: "https://doi.org/10.5281/zenodo.827613",
    stages: { s1: "success", s2: "pending", s3: "pending" },
    timeline: [
      { stage: "input", statusText: "📥 Ingesting: https://doi.org/10.5281/zenodo.827613", delay: 500 },
      { stage: "blackbox", statusText: "🔌 Probing HTTP headers & preflight conneg...", delay: 600 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Negotiating application/ld+json... (Fail: 406)", delay: 750 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Checking describedby Link headers... (None found)", delay: 600 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Resolving external RFC 9264 Linkset...", delay: 750 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "success", 2: "pending", 3: "pending" }, statusText: "✅ Stage 1: Direct Linkset resolved to JSON-LD target", delay: 800 },
      { stage: "blackbox", statusText: "⚡ Fetching JSON-LD payload... 200 OK", delay: 800 },
      { stage: "output", statusText: "🎉 Success! Resolved 4 triples via Direct RDF linkset.", delay: 400 }
    ],
    nodes: [
      { id: "s", label: "zenodo:827613", type: "subject", x: 180, y: 110 },
      { id: "o1", label: "doi:10.5281/...", type: "uri", x: 50, y: 110 },
      { id: "o2", label: "dcat:Dataset", type: "class", x: 310, y: 40 },
      { id: "o3", label: "Plankton Obs...", type: "literal", x: 310, y: 110 },
      { id: "o4", label: "data.ttl", type: "uri", x: 180, y: 220 }
    ],
    edges: [
      { from: "s", to: "o1", label: "owl:sameAs" },
      { from: "s", to: "o2", label: "rdf:type" },
      { from: "s", to: "o3", label: "dct:title" },
      { from: "s", to: "o4", label: "dcat:distribution" }
    ]
  },
  embrc: {
    name: "EMBRC Data Portal",
    badge: "EMBRC Portal",
    uri: "https://data.emobon.embrc.eu",
    stages: { s1: "success", s2: "pending", s3: "pending" },
    timeline: [
      { stage: "input", statusText: "📥 Ingesting: https://data.emobon.embrc.eu", delay: 500 },
      { stage: "blackbox", statusText: "🔌 Probing HTTP Accept header negotiation...", delay: 600 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Negotiating text/turtle content...", delay: 800 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "success", 2: "pending", 3: "pending" }, statusText: "✅ Stage 1: Directly resolved 200 OK (Content-Type: text/turtle)", delay: 800 },
      { stage: "output", statusText: "🎉 Success! Directly negotiated RDF payload.", delay: 400 }
    ],
    nodes: [
      { id: "s", label: "embrc:portal", type: "subject", x: 180, y: 110 },
      { id: "o1", label: "dcat:Catalog", type: "class", x: 50, y: 110 },
      { id: "o2", label: "org:embrc", type: "uri", x: 310, y: 50 },
      { id: "o3", label: "dataset:emobon", type: "uri", x: 310, y: 170 }
    ],
    edges: [
      { from: "s", to: "o1", label: "rdf:type" },
      { from: "s", to: "o2", label: "dct:publisher" },
      { from: "s", to: "o3", label: "dcat:dataset" }
    ]
  },
  marineinfo: {
    name: "MarineInfo Portal",
    badge: "Person Record",
    uri: "https://marineinfo.org/id/person/1",
    stages: { s1: "failed", s2: "success", s3: "pending" },
    timeline: [
      { stage: "input", statusText: "📥 Ingesting: https://marineinfo.org/id/person/1", delay: 500 },
      { stage: "blackbox", statusText: "🔌 Probing headers & preflight conneg...", delay: 600 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Evaluating Content Negotiation... (Fail: HTML only)", delay: 800 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "failed", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: Probing link header signposts... (None found)", delay: 700 },
      { stage: "matrix", activeStage: 2, stageStatus: { 1: "failed", 2: "active", 3: "pending" }, statusText: "🔍 Stage 2: Parsing HTML DOM for RDF-like markup...", delay: 800 },
      { stage: "matrix", activeStage: 2, stageStatus: { 1: "failed", 2: "success", 3: "pending" }, statusText: "✅ Stage 2: Uplifted microdata / schema.org tags on page", delay: 850 },
      { stage: "output", statusText: "🎉 Success! Resolved 3 triples via Semantic Uplifting.", delay: 400 }
    ],
    nodes: [
      { id: "s", label: "person:1", type: "subject", x: 180, y: 110 },
      { id: "o1", label: "schema:Person", type: "class", x: 50, y: 110 },
      { id: "o2", label: "Cedric Decruw", type: "literal", x: 310, y: 50 },
      { id: "o3", label: "org:vliz", type: "uri", x: 310, y: 170 }
    ],
    edges: [
      { from: "s", to: "o1", label: "rdf:type" },
      { from: "s", to: "o2", label: "schema:name" },
      { from: "s", to: "o3", label: "schema:worksFor" }
    ]
  },
  dbpedia: {
    name: "DBpedia / Wikipedia",
    badge: "Wiki Concept",
    uri: "http://dbpedia.org/resource/Subaru_Impreza_WRX",
    stages: { s1: "success", s2: "pending", s3: "success" },
    timeline: [
      { stage: "input", statusText: "📥 Ingesting: http://dbpedia.org/resource/Subaru_Impreza_WRX", delay: 500 },
      { stage: "blackbox", statusText: "🔌 Checking redirect -> dbpedia.org/data/Subaru_Impreza_WRX.jsonld", delay: 700 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "active", 2: "pending", 3: "pending" }, statusText: "🔍 Stage 1: content-negotiation (Accept: JSON-LD)...", delay: 800 },
      { stage: "matrix", activeStage: 1, stageStatus: { 1: "success", 2: "pending", 3: "pending" }, statusText: "✅ Stage 1: Resolved JSON-LD model representing WRX", delay: 700 },
      { stage: "matrix", activeStage: 3, stageStatus: { 1: "success", 2: "pending", 3: "active" }, statusText: "🔍 Stage 3: Resolving OWL sameAs equivalence & loops...", delay: 800 },
      { stage: "matrix", activeStage: 3, stageStatus: { 1: "success", 2: "pending", 3: "success" }, statusText: "✅ Stage 3: Equivalence reasoning succeeded", delay: 800 },
      { stage: "output", statusText: "🎉 Success! Resolved 3 triples with inferred equivalence.", delay: 400 }
    ],
    nodes: [
      { id: "s", label: "dbpedia:Subaru_WRX", type: "subject", x: 180, y: 110 },
      { id: "o1", label: "dbo:Automobile", type: "class", x: 50, y: 110 },
      { id: "o2", label: "Subaru", type: "uri", x: 310, y: 50 },
      { id: "o3", label: "Subaru Impreza WRX", type: "literal", x: 310, y: 170 }
    ],
    edges: [
      { from: "s", to: "o1", label: "rdf:type" },
      { from: "s", to: "o2", label: "dbo:manufacturer" },
      { from: "s", to: "o3", label: "rdfs:label" }
    ]
  }
};

const PRESET_KEYS = ["zenodo", "embrc", "marineinfo", "dbpedia"];

export default function CascadeVisualizerHUD() {
  const [presetIndex, setPresetIndex] = useState<number>(0);
  const [displayedUri, setDisplayedUri] = useState<string>("");
  const [currentStage, setCurrentStage] = useState<"idle" | "input" | "blackbox" | "matrix" | "output">("idle");
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [stageStates, setStageStates] = useState<Record<number, "pending" | "active" | "success" | "failed">>({
    1: "pending",
    2: "pending",
    3: "pending"
  });
  const [showGraph, setShowGraph] = useState<boolean>(false);
  const [graphProgress, setGraphProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");

  const [binaryDigits, setBinaryDigits] = useState<{ id: number; char: string; top: number; left: number; opacity: number }[]>([]);

  const activePreset = PRESETS[PRESET_KEYS[presetIndex]];

  // Generate random binary background digits on mount
  useEffect(() => {
    const digits = [];
    for (let i = 0; i < 40; i++) {
      digits.push({
        id: i,
        char: Math.random() > 0.5 ? "1" : "0",
        top: Math.random() * 100,
        left: Math.random() * 100,
        opacity: Math.random() * 0.3 + 0.05
      });
    }
    setBinaryDigits(digits);
  }, []);

  // Primary Loop Controller
  useEffect(() => {
    let active = true;

    const runAutomatedLoop = async () => {
      while (active) {
        setIsPlaying(true);
        const targetPreset = PRESETS[PRESET_KEYS[presetIndex]];
        const targetUri = targetPreset.uri;

        // 1. Backspacing Phase
        if (displayedUri.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          // Reset status, graph, and stages
          setShowGraph(false);
          setGraphProgress(0);
          setCurrentStage("idle");
          setStatusText("");
          setStageStates({ 1: "pending", 2: "pending", 3: "pending" });
          setActiveStage(null);

          const chars = displayedUri.split("");
          while (chars.length > 0 && active) {
            chars.pop();
            setDisplayedUri(chars.join(""));
            await new Promise((resolve) => setTimeout(resolve, 15));
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // 2. Typing Phase
        const uriChars = targetUri.split("");
        let currentTyped = "";
        for (let i = 0; i < uriChars.length && active; i++) {
          currentTyped += uriChars[i];
          setDisplayedUri(currentTyped);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        if (!active) break;
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 3. Execution Simulation Phase
        setCurrentStage("input");
        setStatusText("Ingesting URI...");
        await new Promise((resolve) => setTimeout(resolve, 400));

        const statuses = { 1: "pending" as const, 2: "pending" as const, 3: "pending" as const };

        for (let j = 0; j < targetPreset.timeline.length && active; j++) {
          const event = targetPreset.timeline[j];
          setCurrentStage(event.stage);
          setStatusText(event.statusText);

          if (event.activeStage !== undefined) {
            setActiveStage(event.activeStage);
          }
          if (event.stageStatus) {
            Object.assign(statuses, event.stageStatus);
            setStageStates({ ...statuses });
          }

          await new Promise((resolve) => setTimeout(resolve, event.delay));
        }

        if (!active) break;

        // 4. Output Graph Rendering Phase
        setCurrentStage("output");
        setShowGraph(true);

        for (let g = 1; g <= targetPreset.edges.length && active; g++) {
          setGraphProgress(g);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!active) break;

        // 5. Success hold phase (3 seconds)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Increment preset index
        setPresetIndex((prev) => (prev + 1) % PRESET_KEYS.length);
      }
    };

    runAutomatedLoop();

    return () => {
      active = false;
    };
  }, [presetIndex]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 select-none">
      
      {/* 1. TOP: Clean glowing URI Address Field */}
      <div className="w-full max-w-xl mx-auto p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center font-mono text-xs md:text-sm text-accent-light tracking-wide shadow-inner relative overflow-hidden">
        <div className="flex items-center gap-2 shrink-0 select-none mr-3 text-slate-500">
          <Globe size={15} />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80">URI</span>
        </div>
        <div className="flex-1 truncate relative flex items-center">
          <span>{displayedUri || "Waiting for address..."}</span>
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-1.5 h-3.5 bg-accent-light ml-0.5 inline-block"
          />
        </div>
      </div>

      {/* Pulsing Downward Connector 1 */}
      <div className="h-6 w-full flex items-center justify-center relative">
        <svg className="h-full w-4" viewBox="0 0 16 24" fill="none">
          <line x1="8" y1="0" x2="8" y2="24" stroke="#3d7a8d" strokeWidth="1.5" strokeDasharray="3,3" />
          <motion.circle
            animate={{ cy: [0, 24] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            cx="8"
            cy="0"
            r="2.5"
            fill="#64b5f6"
            className="glow-line"
          />
        </svg>
      </div>

      {/* 2. CENTER: The Morphing Black Box -> 3-Stage Pipeline Container */}
      <div className="w-full max-w-xl h-64 mx-auto relative flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentStage !== "matrix" ? (
            // Stage 2: The URI Black Box View
            <motion.div
              key="blackbox"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className={`absolute inset-0 p-5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 overflow-hidden ${
                currentStage === "blackbox"
                  ? "bg-slate-950 border-accent shadow-[0_0_25px_rgba(61,122,141,0.25)]"
                  : currentStage === "output"
                  ? "bg-slate-950/80 border-slate-800"
                  : "bg-slate-950 border-slate-900"
              }`}
            >
              {/* Binary stream backdrop */}
              <div className="absolute inset-0 select-none pointer-events-none opacity-40">
                {binaryDigits.map((d) => (
                  <span
                    key={d.id}
                    style={{
                      position: "absolute",
                      top: `${d.top}%`,
                      left: `${d.left}%`,
                      opacity: d.opacity,
                      fontSize: "9px"
                    }}
                    className="font-mono text-accent animate-pulse"
                  >
                    {d.char}
                  </span>
                ))}
              </div>

              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="relative">
                  <Cpu size={44} className={currentStage === "blackbox" ? "text-accent-light animate-spin-slow" : "text-slate-650"} />
                  {currentStage === "blackbox" && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-accent animate-ping" />
                  )}
                </div>
                <div>
                  <h5 className="text-sm md:text-base font-sans font-black uppercase tracking-wider text-slate-200">URI Black Box</h5>
                  <p className="text-[11px] md:text-xs font-mono text-slate-400 mt-1.5 max-w-[340px]">
                    {statusText || "Diagnostics Inactive"}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            // Stage 3: The 3-Stage Linear Pipeline View
            <motion.div
              key="matrix"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 p-5 bg-slate-950 border border-accent rounded-2xl flex flex-col gap-2.5 shadow-[0_0_25px_rgba(61,122,141,0.2)]"
            >
              {/* Binary backdrop inside Matrix */}
              <div className="absolute inset-0 select-none pointer-events-none opacity-20">
                {binaryDigits.slice(0, 20).map((d) => (
                  <span
                    key={d.id}
                    style={{
                      position: "absolute",
                      top: `${d.top}%`,
                      left: `${d.left}%`,
                      opacity: d.opacity,
                      fontSize: "8px"
                    }}
                    className="font-mono text-accent"
                  >
                    {d.char}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 relative z-10">
                <span className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 text-slate-350">
                  <Layers size={14} className="text-accent-light" /> 3-Stage Discovery Pipeline
                </span>
                <span className="text-[10px] font-mono text-slate-500">Execution Stages</span>
              </div>

              <div className="grid grid-cols-3 gap-3 relative z-10 flex-1">
                {/* Stage 1 */}
                <div className={`rounded-xl border p-3 flex flex-col justify-center transition-all duration-300 ${
                  activeStage === 1
                    ? "bg-accent/20 border-accent text-accent-light shadow-[0_0_10px_rgba(96,165,250,0.1)] scale-[1.02]"
                    : stageStates[1] === "success"
                    ? "bg-green-950/20 border-green-500/40 text-green-400"
                    : stageStates[1] === "failed"
                    ? "bg-red-950/35 border-red-500/30 text-red-400"
                    : "bg-slate-900 border-slate-800/80 text-slate-400"
                }`}>
                  <div className="text-[10px] md:text-[11px] font-sans font-bold uppercase leading-tight">Stage 1: Direct</div>
                  <div className="text-[9px] font-mono opacity-60 mt-1">Conneg, Link headers, Linksets</div>
                </div>
                {/* Stage 2 */}
                <div className={`rounded-xl border p-3 flex flex-col justify-center transition-all duration-300 ${
                  activeStage === 2
                    ? "bg-accent/20 border-accent text-accent-light shadow-[0_0_10px_rgba(96,165,250,0.1)] scale-[1.02]"
                    : stageStates[2] === "success"
                    ? "bg-green-950/20 border-green-500/40 text-green-400"
                    : stageStates[2] === "failed"
                    ? "bg-red-950/35 border-red-500/30 text-red-400"
                    : "bg-slate-900 border-slate-800/80 text-slate-400"
                }`}>
                  <div className="text-[10px] md:text-[11px] font-sans font-bold uppercase leading-tight">Stage 2: Uplift</div>
                  <div className="text-[9px] font-mono opacity-60 mt-1">Microdata, RDFa, Sitemaps/Feeds</div>
                </div>
                {/* Stage 3 */}
                <div className={`rounded-xl border p-3 flex flex-col justify-center transition-all duration-300 ${
                  activeStage === 3
                    ? "bg-accent/20 border-accent text-accent-light shadow-[0_0_10px_rgba(96,165,250,0.1)] scale-[1.02]"
                    : stageStates[3] === "success"
                    ? "bg-green-950/20 border-green-500/40 text-green-400"
                    : stageStates[3] === "failed"
                    ? "bg-red-950/35 border-red-500/30 text-red-400"
                    : "bg-slate-900 border-slate-800/80 text-slate-400"
                }`}>
                  <div className="text-[10px] md:text-[11px] font-sans font-bold uppercase leading-tight">Stage 3: Reason</div>
                  <div className="text-[9px] font-mono opacity-60 mt-1">sameAs, foaf, loops, pagination</div>
                </div>
              </div>

              {/* Localized Strategy Sub-label */}
              <div className="text-[11px] md:text-xs font-mono text-slate-400 text-center animate-pulse py-2 mt-1.5 bg-slate-950/40 border border-slate-850 rounded-lg max-w-md mx-auto w-full truncate relative z-10">
                {statusText}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pulsing Downward Connector 2 */}
      <div className="h-6 w-full flex items-center justify-center relative">
        <svg className="h-full w-4" viewBox="0 0 16 24" fill="none">
          <line x1="8" y1="0" x2="8" y2="24" stroke="#3d7a8d" strokeWidth="1.5" strokeDasharray="3,3" />
          <motion.circle
            animate={currentStage === "output" ? { cy: [0, 24] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            cx="8"
            cy="0"
            r="3.5"
            fill={currentStage === "output" ? "#22c55e" : "#4b5563"}
            className="glow-line"
          />
        </svg>
      </div>

      {/* 3. BOTTOM: The Animated SVG Knowledge Graph Panel (Site Palette) */}
      <div className="w-full max-w-xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden select-none h-64">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5 relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
            <Network size={14} className="text-accent animate-pulse" /> Resolved RDF Graph Output
          </div>
          {showGraph && (
            <span className="px-3 py-1 bg-accent/10 text-accent-light rounded-full text-xs font-bold border border-accent/20">
              ACTIVE
            </span>
          )}
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {showGraph ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full relative"
              >
                <svg className="w-full h-full" viewBox="0 0 360 220" style={{ overflow: "visible" }}>
                  <defs>
                    <marker
                      id="accent-arrow"
                      viewBox="0 0 10 10"
                      refX="16"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#3d7a8d" />
                    </marker>
                  </defs>

                  {/* Edges / Predicate Lines */}
                  {activePreset.edges.map((edge, idx) => {
                    if (idx >= graphProgress) return null;
                    const fromNode = activePreset.nodes.find((n) => n.id === edge.from)!;
                    const toNode = activePreset.nodes.find((n) => n.id === edge.to)!;

                    return (
                      <g key={`edge-${idx}`}>
                        <motion.line
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.75 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke="#3d7a8d"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                          markerEnd="url(#accent-arrow)"
                        />
                        <motion.text
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 }}
                          x={(fromNode.x + toNode.x) / 2}
                          y={(fromNode.y + toNode.y) / 2 - 5}
                          fill="#64b5f6"
                          fontSize="10"
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {edge.label}
                        </motion.text>
                      </g>
                    );
                  })}

                  {/* Nodes / RDF Subjects & Objects */}
                  {activePreset.nodes.map((node, idx) => {
                    const isConnected =
                      node.id === "s" ||
                      activePreset.edges.some((e, edgeIdx) => edgeIdx < graphProgress && (e.from === node.id || e.to === node.id));

                    if (!isConnected) return null;

                    // Styles mapping directly to the site palette (no purple)
                    const fill =
                      node.type === "subject"
                        ? "rgba(61, 122, 141, 0.3)"   // Teal fill
                        : node.type === "uri"
                        ? "rgba(100, 181, 246, 0.2)"  // Soft blue fill
                        : node.type === "class"
                        ? "rgba(13, 148, 136, 0.2)"   // Soft dark teal fill
                        : "rgba(203, 213, 225, 0.15)"; // Literal fill

                    const stroke =
                      node.type === "subject"
                        ? "#3d7a8d" // Teal border
                        : node.type === "uri"
                        ? "#64b5f6" // Soft blue border
                        : node.type === "class"
                        ? "#0d9488" // Dark teal border
                        : "#cbd5e1"; // Bright grey border

                    const textFill =
                      node.type === "subject"
                        ? "#e2e8f0"
                        : node.type === "uri"
                        ? "#bfdbfe"
                        : node.type === "class"
                        ? "#ccfbf1"
                        : "#f1f5f9";

                    return (
                      <motion.g
                        key={node.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                          // Continuous subtle hovering drift
                          x: [0, Math.sin(idx + 1) * 3, Math.cos(idx + 1) * 3, 0],
                          y: [0, Math.cos(idx + 2) * 3, Math.sin(idx + 2) * 3, 0]
                        }}
                        transition={{
                          scale: { type: "spring", stiffness: 120, damping: 12 },
                          opacity: { duration: 0.3 },
                          x: { duration: 6 + idx, repeat: Infinity, ease: "easeInOut" },
                          y: { duration: 5 + idx, repeat: Infinity, ease: "easeInOut" }
                        }}
                      >
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.type === "subject" ? 18 : 14}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="1.5"
                        />
                        <text
                          x={node.x}
                          y={node.y + (node.type === "subject" ? 30 : 26)}
                          fill={textFill}
                          fontSize="10"
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontWeight={node.type === "subject" ? "bold" : "normal"}
                        >
                          {node.label}
                        </text>
                      </motion.g>
                    );
                  })}
                </svg>

                {/* Status Overlay */}
                {graphProgress === activePreset.edges.length && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-2.5 right-2.5 px-2 py-1 bg-accent/15 border border-accent/25 rounded-md flex items-center gap-1.5 text-[10px] font-mono text-accent-light"
                  >
                    <Sparkles size={12} className="fill-accent-light/10 text-accent-light" /> Graph Resolved
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center text-slate-400 gap-2.5"
              >
                <HelpCircle size={36} className="stroke-[1.5] animate-pulse text-slate-500" />
                <span className="text-xs md:text-sm font-medium font-sans max-w-[240px] leading-normal text-slate-400">
                  {isPlaying
                    ? "Resolving signposting & building RDF..."
                    : "Awaiting automated data stream ingestion..."}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
