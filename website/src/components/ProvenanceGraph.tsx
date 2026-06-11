import { useState, useMemo, MouseEvent } from 'react';
import * as N3 from 'n3';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Cpu,
  Layers,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Database,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Info,
  ArrowDown,
  ExternalLink,
  Zap,
  User,
  ArrowRight
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

export interface ProvNode {
  id: string;
  type: 'Entity' | 'Activity' | 'Agent' | 'Plan';
  label: string;
  properties: Record<string, string[]>;
  turtleSnippet: string;
}

interface ProvenanceGraphProps {
  turtleString: string;
  onNodeSelect: (node: ProvNode) => void;
}

interface RdfStatement {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  objectType: string;
}

interface TimelineStep {
  id: string;
  type: 'Target' | 'Strategy' | 'Document' | 'Metadata' | 'Inference';
  title: string;
  badge: string;
  status: 'success' | 'failed' | 'pending';
  timestamp?: string;
  duration?: string;
  properties: Record<string, string[]>;
  turtleSnippet: string;
  provNode: ProvNode;
  
  // Strategy-specific
  planLabel?: string;
  planSeeAlso?: string;
  agentLabel?: string;
  plan?: {
    id: string;
    label: string;
    seeAlso?: string;
  };
  
  // Document-specific
  url?: string;
  derivedFrom?: string;
  
  // Metadata-specific
  value?: string;
  
  // Inference-specific
  ruleName?: string;
  premises?: RdfStatement[];
  conclusion?: RdfStatement;
}

// ── Constants ──────────────────────────────────────────────────────────

const PROV_NS = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_SEEALSO = 'http://www.w3.org/2000/01/rdf-schema#seeAlso';

// ── Helpers ────────────────────────────────────────────────────────────

function getShortLabel(uri: string): string {
  if (uri.startsWith('urn:uuid:')) {
    return uri.substring(9, 17) + '…';
  }
  if (uri.includes('#')) {
    return uri.split('#').pop() || uri;
  }
  try {
    const url = new URL(uri);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || url.hostname;
  } catch {
    return uri.length > 40 ? uri.substring(0, 37) + '…' : uri;
  }
}

function getPlanOrder(planId: string): number {
  const short = getShortLabel(planId);
  const PLAN_ORDER = [
    'ContentNegotiationPlan',
    'SignpostingLinkHeaderPlan',
    'SignpostingHtmlLinkPlan',
    'EmbeddedScriptPlan',
    'LinksetPlan',
    'SitemapSignpostingPlan'
  ];
  const idx = PLAN_ORDER.findIndex(p => short.includes(p));
  return idx !== -1 ? idx : 999;
}

function classifyNode(types: string[]): ProvNode['type'] {
  for (const t of types) {
    if (t === `${PROV_NS}SoftwareAgent` || t === `${PROV_NS}Agent`) return 'Agent';
    if (t === `${PROV_NS}Plan` || t.includes('Plan')) return 'Plan';
    if (t === `${PROV_NS}Activity` || t.includes('Activity')) return 'Activity';
    if (t === `${PROV_NS}Entity` || t.includes('Entity') || t.includes('Resource') || t.includes('Metadata')) return 'Entity';
  }
  return 'Entity';
}

function traverseRdfList(listId: string, subjectMap: Map<string, N3.Quad[]>): string[] {
  const items: string[] = [];
  let current = listId;
  const visited = new Set<string>();
  
  while (current && current !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil' && !visited.has(current)) {
    visited.add(current);
    const quads = subjectMap.get(current) || [];
    const first = quads.find(q => q.predicate.value.endsWith('first'))?.object.value;
    if (first) items.push(first);
    const rest = quads.find(q => q.predicate.value.endsWith('rest'))?.object.value;
    current = rest || '';
  }
  return items;
}

// ── Parsing Logic ──────────────────────────────────────────────────────

function parseProvenanceTimeline(turtleString: string): TimelineStep[] {
  if (!turtleString || turtleString.trim().length === 0) return [];
  
  const parser = new N3.Parser();
  let quads: N3.Quad[] = [];
  try {
    quads = parser.parse(turtleString);
  } catch (e) {
    console.error('Failed to parse PROV-O Turtle:', e);
    return [];
  }

  // Group quads by subject
  const subjectMap = new Map<string, N3.Quad[]>();
  for (const q of quads) {
    const s = q.subject.value;
    if (!subjectMap.has(s)) subjectMap.set(s, []);
    subjectMap.get(s)!.push(q);
  }

  // Direct property lookup helper
  const getProperties = (s: string): Record<string, string[]> => {
    const props: Record<string, string[]> = {};
    const sq = subjectMap.get(s) || [];
    for (const q of sq) {
      const p = q.predicate.value;
      if (!props[p]) props[p] = [];
      props[p].push(q.object.value);
    }
    return props;
  };

  // Build Turtle snippet helper
  const getSnippet = (s: string): string => {
    const sq = subjectMap.get(s) || [];
    return sq.map(q => {
      const obj = q.object.termType === 'Literal' ? `"${q.object.value}"` : `<${q.object.value}>`;
      return `<${s}> <${q.predicate.value}> ${obj} .`;
    }).join('\n');
  };

  // Helper to build a ProvNode
  const buildProvNode = (s: string, type: ProvNode['type']): ProvNode => {
    const props = getProperties(s);
    const label = props[RDFS_LABEL]?.[0] || getShortLabel(s);
    return {
      id: s,
      type,
      label,
      properties: props,
      turtleSnippet: getSnippet(s)
    };
  };

  // Find overall activity & Target URI
  const overallActivity = Array.from(subjectMap.entries()).find(([_, qs]) =>
    qs.some(q => q.predicate.value === RDF_TYPE && q.object.value.endsWith('ExtractionActivity'))
  );
  const overallActId = overallActivity?.[0];
  const targetUri = overallActivity 
    ? overallActivity[1].find(q => q.predicate.value === `${PROV_NS}used`)?.object.value 
    : null;

  // Find metadata entities
  const metadataEntities = Array.from(subjectMap.entries())
    .filter(([_, qs]) => qs.some(q => q.predicate.value === RDF_TYPE && q.object.value.endsWith('ExtractedMetadata')))
    .map(([s]) => s);

  // Gather successful activities
  const successfulActivities = new Set<string>();
  const derivationLinks = new Map<string, { entity: string; hadPlan?: string }>(); // activityUuid -> derivation details

  for (const metaId of metadataEntities) {
    const metaQuads = subjectMap.get(metaId) || [];
    const derivations = metaQuads.filter(q => q.predicate.value === `${PROV_NS}qualifiedDerivation`).map(q => q.object.value);
    for (const derivId of derivations) {
      const derivQuads = subjectMap.get(derivId) || [];
      const actId = derivQuads.find(q => q.predicate.value === `${PROV_NS}hadActivity`)?.object.value;
      const entityId = derivQuads.find(q => q.predicate.value === `${PROV_NS}entity`)?.object.value;
      const planId = derivQuads.find(q => q.predicate.value === `${PROV_NS}hadPlan`)?.object.value;
      if (actId) {
        successfulActivities.add(actId);
        if (entityId) {
          derivationLinks.set(actId, { entity: entityId, hadPlan: planId });
        }
      }
    }
  }

  // Parse RDF statement premises & conclusions
  const statementMap = new Map<string, RdfStatement>();
  for (const [s, qs] of subjectMap.entries()) {
    const isStatement = qs.some(q => q.predicate.value === RDF_TYPE && q.object.value.endsWith('Statement'));
    if (isStatement) {
      const subj = qs.find(q => q.predicate.value.endsWith('subject'))?.object.value;
      const pred = qs.find(q => q.predicate.value.endsWith('predicate'))?.object.value;
      const objQuad = qs.find(q => q.predicate.value.endsWith('object'))?.object;
      if (subj && pred && objQuad) {
        statementMap.set(s, {
          id: s,
          subject: subj,
          predicate: pred,
          object: objQuad.value,
          objectType: objQuad.termType
        });
      }
    }
  }

  const steps: TimelineStep[] = [];

  // ── Step 1: Target Resource Requested Card ──
  if (targetUri) {
    const targetNode = buildProvNode(targetUri, 'Entity');
    const startedTime = overallActId ? getProperties(overallActId)[`${PROV_NS}startedAtTime`]?.[0] : undefined;
    
    steps.push({
      id: targetUri,
      type: 'Target',
      title: 'Target Resource Requested',
      badge: 'TARGET',
      status: 'success',
      url: targetUri,
      timestamp: startedTime,
      properties: getProperties(targetUri),
      turtleSnippet: getSnippet(targetUri),
      provNode: targetNode
    });
  }

  // ── Step 2: Strategy Activities ──
  const strategyActivityIds = Array.from(subjectMap.entries())
    .filter(([_, qs]) => qs.some(q => q.predicate.value === RDF_TYPE && q.object.value.endsWith('StrategyActivity')))
    .map(([id]) => id);

  // Resolve plan definitions
  const planMap = new Map<string, { id: string; label: string; seeAlso?: string }>();
  const planSubjects = Array.from(subjectMap.entries()).filter(([_, qs]) =>
    qs.some(q => q.predicate.value === RDF_TYPE && (q.object.value === `${PROV_NS}Plan` || q.object.value.endsWith('Plan')))
  );
  for (const [pId, pQuads] of planSubjects) {
    const label = pQuads.find(q => q.predicate.value === RDFS_LABEL)?.object.value || getShortLabel(pId);
    const seeAlso = pQuads.find(q => q.predicate.value === RDFS_SEEALSO)?.object.value;
    planMap.set(pId, { id: pId, label, seeAlso });
  }

  // Resolve agent definitions
  const agentMap = new Map<string, { id: string; label: string }>();
  const agentSubjects = Array.from(subjectMap.entries()).filter(([_, qs]) =>
    qs.some(q => q.predicate.value === RDF_TYPE && (q.object.value === `${PROV_NS}SoftwareAgent` || q.object.value === `${PROV_NS}Agent`))
  );
  for (const [aId, aQuads] of agentSubjects) {
    const label = aQuads.find(q => q.predicate.value === RDFS_LABEL)?.object.value || getShortLabel(aId);
    agentMap.set(aId, { id: aId, label });
  }

  const strategySteps: TimelineStep[] = [];
  for (const actId of strategyActivityIds) {
    const actProps = getProperties(actId);
    
    let planId: string | null = null;
    const assoc = actProps[`${PROV_NS}qualifiedAssociation`]?.[0];
    if (assoc) {
      const assocQuads = subjectMap.get(assoc) || [];
      planId = assocQuads.find(q => q.predicate.value === `${PROV_NS}hadPlan`)?.object.value || null;
    }
    if (!planId) {
      planId = actProps[`${PROV_NS}hadPlan`]?.[0] || null;
    }

    const plan = planId ? planMap.get(planId) : null;
    const agentId = actProps[`${PROV_NS}wasAssociatedWith`]?.[0] || null;
    const agent = agentId ? agentMap.get(agentId) : null;

    const isSuccess = successfulActivities.has(actId);
    const title = plan ? plan.label.replace(' Strategy Specification', '').replace(' Strategy', '') : getShortLabel(actId);

    const stepNode = buildProvNode(actId, 'Activity');

    strategySteps.push({
      id: actId,
      type: 'Strategy',
      title,
      badge: 'STRATEGY',
      status: isSuccess ? 'success' : 'failed',
      planLabel: plan?.label,
      planSeeAlso: plan?.seeAlso,
      agentLabel: agent?.label,
      properties: actProps,
      turtleSnippet: getSnippet(actId),
      provNode: stepNode,
      plan: plan ? { id: plan.id, label: plan.label, seeAlso: plan.seeAlso } : undefined
    });

    if (isSuccess) {
      const derivation = derivationLinks.get(actId);
      if (derivation && derivation.entity && derivation.entity !== targetUri && !derivation.entity.endsWith('#extracted-metadata')) {
        const docId = derivation.entity;
        
        let docUrl = docId;
        let finalDocId = docId;
        
        if (docId.startsWith('urn:uuid:')) {
          const realEntity = Array.from(subjectMap.entries()).find(([_, qs]) =>
            qs.some(q => q.predicate.value === `${PROV_NS}wasDerivedFrom` && q.object.value === docId)
          );
          if (realEntity && !realEntity[0].endsWith('#extracted-metadata')) {
            docUrl = realEntity[0];
            finalDocId = realEntity[0];
          }
        }

        const docNode = buildProvNode(finalDocId, 'Entity');
        strategySteps.push({
          id: finalDocId,
          type: 'Document',
          title: `Fetched Intermediate Document`,
          badge: 'DOCUMENT',
          status: 'success',
          url: docUrl,
          properties: getProperties(finalDocId),
          turtleSnippet: getSnippet(finalDocId),
          provNode: docNode
        });
      }
    }
  }

  // Sort strategies based on plan execution order
  strategySteps.sort((a, b) => {
    if (a.type === 'Strategy' && b.type === 'Strategy') {
      const aPlan = a.plan?.id || '';
      const bPlan = b.plan?.id || '';
      return getPlanOrder(aPlan) - getPlanOrder(bPlan);
    }
    return 0;
  });

  steps.push(...strategySteps);

  // ── Step 3: Extracted Metadata ──
  for (const metaId of metadataEntities) {
    const metaProps = getProperties(metaId);
    const metaNode = buildProvNode(metaId, 'Entity');
    const val = metaProps[`${PROV_NS}value`]?.[0];
    const generatedTime = metaProps[`${PROV_NS}generatedAtTime`]?.[0];

    steps.push({
      id: metaId,
      type: 'Metadata',
      title: 'Extracted RDF Metadata',
      badge: 'METADATA',
      status: 'success',
      value: val,
      timestamp: generatedTime,
      properties: metaProps,
      turtleSnippet: getSnippet(metaId),
      provNode: metaNode
    });
  }

  // ── Step 4: Inference/Rule Reasoning ──
  const inferenceActivityIds = Array.from(subjectMap.entries())
    .filter(([id, qs]) => 
      qs.some(q => 
        q.predicate.value === RDF_TYPE && 
        (q.object.value.endsWith('InferenceActivity') || 
         q.object.value === 'http://www.w3.org/2000/10/swap/reason#Inference' ||
         q.object.value.endsWith('Inference'))
      )
    )
    .map(([id]) => id);

  for (const infId of inferenceActivityIds) {
    const infProps = getProperties(infId);
    const infNode = buildProvNode(infId, 'Activity');

    let planId = infProps[`${PROV_NS}hadPlan`]?.[0] || null;
    if (!planId) {
      const assoc = infProps[`${PROV_NS}qualifiedAssociation`]?.[0];
      if (assoc) {
        const assocQuads = subjectMap.get(assoc) || [];
        planId = assocQuads.find(q => q.predicate.value === `${PROV_NS}hadPlan`)?.object.value || null;
      }
    }
    const ruleName = planId ? getShortLabel(planId) : 'Inference Rule';

    const usedIds = infProps[`${PROV_NS}used`] || [];
    const evidenceListId = infProps['http://www.w3.org/2000/10/swap/reason#evidence']?.[0];
    if (evidenceListId) {
      const listItems = traverseRdfList(evidenceListId, subjectMap);
      usedIds.push(...listItems);
    }

    const premises = usedIds
      .map(id => statementMap.get(id))
      .filter((stmt): stmt is RdfStatement => !!stmt);

    const conclusionStmt = Array.from(statementMap.values()).find(stmt => {
      const stmtQuads = subjectMap.get(stmt.id) || [];
      return stmtQuads.some(q => q.predicate.value === `${PROV_NS}wasGeneratedBy` && q.object.value === infId);
    });

    steps.push({
      id: infId,
      type: 'Inference',
      title: ruleName,
      badge: 'INFERENCE',
      status: 'success',
      ruleName,
      premises,
      conclusion: conclusionStmt,
      properties: infProps,
      turtleSnippet: getSnippet(infId),
      provNode: infNode
    });
  }

  return steps;
}

// ── Component ──────────────────────────────────────────────────────────

export default function ProvenanceGraph({ turtleString, onNodeSelect }: ProvenanceGraphProps) {
  const [showFailed, setShowFailed] = useState<boolean>(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const steps = useMemo(() => parseProvenanceTimeline(turtleString), [turtleString]);

  const stats = useMemo(() => {
    const total = steps.length;
    const strategies = steps.filter(s => s.type === 'Strategy');
    const successes = strategies.filter(s => s.status === 'success').length;
    const failures = strategies.filter(s => s.status === 'failed').length;
    const inferences = steps.filter(s => s.type === 'Inference').length;
    return { total, successes, failures, inferences };
  }, [steps]);

  const toggleExpand = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string, e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedValue(id);
    setTimeout(() => setCopiedValue(null), 2000);
  };

  const visibleSteps = useMemo(() => {
    return steps.filter(step => {
      if (step.status === 'failed' && !showFailed) {
        return false;
      }
      return true;
    });
  }, [steps, showFailed]);

  if (!turtleString || turtleString.trim().length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center text-slate-450 space-y-3 p-8">
          <HelpCircle size={40} className="mx-auto stroke-[1.2] opacity-40 text-slate-500 animate-pulse" />
          <div className="text-sm font-bold text-slate-700">No provenance data available</div>
          <div className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
            Run an extraction with provenance enabled in the sandbox to see the structured W3C PROV-O audit trail.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[500px] flex flex-col bg-[#f8fafc] text-slate-900 overflow-hidden relative">
      
      {/* ── Top Control Bar ── */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-accent/10 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-20 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-sans font-black text-sm text-poster-dark uppercase tracking-widest flex items-center gap-2">
            <Layers size={15} className="text-accent animate-pulse" /> Provenance Derivation Timeline
          </h3>
          <p className="text-[10px] font-mono text-[#666] font-semibold">
            {stats.successes} successful harvests · {stats.failures} failed attempts {stats.inferences > 0 && `· ${stats.inferences} inferences`}
          </p>
        </div>

        {stats.failures > 0 && (
          <label className="relative flex items-center gap-2.5 cursor-pointer group select-none">
            <input
              type="checkbox"
              checked={showFailed}
              onChange={(e) => setShowFailed(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 border border-slate-300 rounded-full peer peer-checked:bg-accent peer-checked:border-accent relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-4 transition-colors" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 group-hover:text-accent transition-colors">
              Show failed attempts
            </span>
          </label>
        )}
      </div>

      {/* ── Timeline Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-8 relative max-h-[600px]">
        {/* Central Vertical Connector Line */}
        {visibleSteps.length > 1 && (
          <div className="absolute left-[33px] top-12 bottom-12 w-0.5 border-l-2 border-dashed border-accent/25 z-0" />
        )}

        <div className="space-y-6 relative z-10">
          <AnimatePresence initial={false}>
            {visibleSteps.map((step, idx) => {
              const isExpanded = !!expandedSteps[step.id];
              const isSelected = false; // Could connect to highlighted state

              // Type Styling Configuration
              let borderStyle = 'border-slate-200/80 bg-white';
              let iconBg = 'bg-slate-100 text-slate-650';
              let IconComponent = Cpu;
              let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';

              if (step.type === 'Target') {
                borderStyle = 'border-accent/20 bg-white hover:border-accent/40 shadow-sm';
                iconBg = 'bg-accent/10 text-accent';
                IconComponent = Globe;
                badgeColor = 'bg-accent/5 text-accent border-accent/10';
              } else if (step.type === 'Strategy') {
                if (step.status === 'success') {
                  borderStyle = 'border-green-500/20 bg-green-500/[0.02] hover:border-green-500/40 shadow-sm';
                  iconBg = 'bg-green-500/10 text-green-600';
                  badgeColor = 'bg-green-500/5 text-green-700 border-green-500/15';
                } else {
                  borderStyle = 'border-red-500/20 bg-red-500/[0.01] hover:border-red-550/30 opacity-75';
                  iconBg = 'bg-red-500/10 text-red-500';
                  badgeColor = 'bg-red-500/5 text-red-700 border-red-500/15';
                }
              } else if (step.type === 'Document') {
                borderStyle = 'border-slate-200 bg-white hover:border-slate-350 shadow-sm';
                iconBg = 'bg-slate-100 text-slate-600';
                IconComponent = FileCode;
                badgeColor = 'bg-slate-50 text-slate-600 border-slate-150';
              } else if (step.type === 'Metadata') {
                borderStyle = 'border-emerald-500/25 bg-emerald-500/[0.03] hover:border-emerald-500/40 shadow-sm';
                iconBg = 'bg-emerald-500/10 text-emerald-600';
                IconComponent = Database;
                badgeColor = 'bg-emerald-500/5 text-emerald-700 border-emerald-500/15';
              } else if (step.type === 'Inference') {
                borderStyle = 'border-indigo-500/20 bg-indigo-500/[0.02] hover:border-indigo-500/40 shadow-sm';
                iconBg = 'bg-indigo-500/10 text-indigo-600';
                IconComponent = Zap;
                badgeColor = 'bg-indigo-500/5 text-indigo-700 border-indigo-500/15';
              }

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => onNodeSelect(step.provNode)}
                  className={`flex items-start gap-4 md:gap-5 p-4 md:p-5 rounded-2xl border ${borderStyle} transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.005] group`}
                >
                  {/* Step Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner relative z-10 ${iconBg}`}>
                    <IconComponent size={18} />
                    {step.type === 'Strategy' && step.status === 'failed' && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                    )}
                  </div>

                  {/* Step Body */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    
                    {/* Header line */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-black border uppercase tracking-widest ${badgeColor}`}>
                          {step.badge}
                        </span>
                        <h4 className="font-sans font-black text-sm text-poster-dark truncate">
                          {step.title}
                        </h4>
                      </div>
                      
                      {/* Sub-badge / Spec Indicator */}
                      {step.type === 'Strategy' && step.planLabel && (
                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          <span className="px-1.5 py-0.5 bg-accent/5 text-accent rounded-[4px] text-[9px] font-bold font-mono border border-accent/10">
                            {getShortLabel(step.plan?.id || '')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Standard properties depending on type */}
                    <div className="text-xs text-slate-600 space-y-1.5 font-medium">
                      
                      {/* Target Step url */}
                      {step.type === 'Target' && step.url && (
                        <div className="font-mono text-[11px] text-[#4a90c4] break-all truncate">
                          {step.url}
                        </div>
                      )}

                      {/* Document Step url */}
                      {step.type === 'Document' && step.url && (
                        <div className="font-mono text-[11px] text-[#4a90c4] break-all flex items-center gap-1.5 truncate">
                          <ArrowRight size={11} className="text-slate-450 shrink-0" />
                          {step.url}
                        </div>
                      )}

                      {/* Strategy Description */}
                      {step.type === 'Strategy' && (
                        <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                          {step.status === 'success' 
                            ? `Successfully evaluated strategy step and extracted RDF content.` 
                            : `Attempted discovery technique but returned no RDF payload.`}
                        </p>
                      )}

                      {/* Metadata Size / Timestamp */}
                      {step.type === 'Metadata' && (
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                          {step.value && (
                            <span>SIZE: {(step.value.length / 1024).toFixed(2)} KB</span>
                          )}
                          {step.timestamp && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {new Date(step.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Inference Statement Conclusion */}
                      {step.type === 'Inference' && step.conclusion && (
                        <div className="bg-indigo-550/5 border border-indigo-500/10 rounded-xl p-3 space-y-2 mt-1 select-text">
                          <div className="text-[8px] font-mono font-bold text-indigo-650 uppercase tracking-widest">Inferred Statement Conclusion</div>
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-indigo-950 font-semibold break-all leading-normal">
                            <span className="text-accent truncate max-w-[150px]" title={step.conclusion.subject}>
                              {getShortLabel(step.conclusion.subject)}
                            </span>
                            <span className="text-indigo-500 font-bold">
                              {getShortLabel(step.conclusion.predicate)}
                            </span>
                            {step.conclusion.objectType === 'Literal' ? (
                              <span className="text-emerald-600">"{step.conclusion.object}"</span>
                            ) : (
                              <span className="text-yellow-600 truncate max-w-[150px]" title={step.conclusion.object}>
                                &lt;{getShortLabel(step.conclusion.object)}&gt;
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Collapsible details toggle buttons */}
                    {(step.type === 'Strategy' || step.type === 'Metadata' || step.type === 'Inference') && (
                      <div className="flex items-center gap-4 pt-1">
                        <button
                          onClick={(e) => toggleExpand(step.id, e)}
                          className="text-[10px] font-mono font-bold text-accent hover:underline flex items-center gap-1 transition-all select-none"
                        >
                          {isExpanded ? (
                            <><ChevronUp size={12} /> Hide Details</>
                          ) : (
                            <><ChevronDown size={12} /> View Details</>
                          )}
                        </button>
                        
                        {step.type === 'Metadata' && step.value && (
                          <button
                            onClick={(e) => copyToClipboard(step.value || '', step.id, e)}
                            className="text-[10px] font-mono font-bold text-slate-500 hover:text-accent flex items-center gap-1 transition-colors select-none ml-auto"
                          >
                            {copiedValue === step.id ? (
                              <><Check size={11} className="text-green-500" /> Copied!</>
                            ) : (
                              <><Copy size={11} /> Copy RDF</>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── Expandable Detail Block ── */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden pt-2.5 border-t border-accent/5"
                          onClick={(e) => e.stopPropagation()} // Stop modal triggers inside accordion
                        >
                          
                          {/* Strategy Details Block */}
                          {step.type === 'Strategy' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-mono text-slate-600 leading-normal">
                              <div>
                                <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Software Agent</div>
                                <div className="text-slate-800 font-bold flex items-center gap-1">
                                  <User size={10} className="text-slate-450" /> {step.agentLabel || 'wrx.js library'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Cascade Plan</div>
                                <div className="text-slate-800 font-bold truncate" title={step.plan?.id}>
                                  {getShortLabel(step.plan?.id || '')}
                                </div>
                              </div>
                              {step.planSeeAlso && (
                                <div className="sm:col-span-2 border-t border-slate-200/50 pt-2 mt-0.5">
                                  <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold mb-1">Standard Specification</div>
                                  <a
                                    href={step.planSeeAlso}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent font-bold hover:underline flex items-center gap-1"
                                  >
                                    <BookOpen size={10} /> Read Spec Protocol <ExternalLink size={8} />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metadata Value Code Block */}
                          {step.type === 'Metadata' && step.value && (
                            <div className="space-y-1.5 select-text">
                              <div className="text-[8px] font-mono font-bold text-slate-450 uppercase tracking-widest">Extracted RDF Payload Preview</div>
                              <pre className="bg-[#0a0a0a] text-slate-200 font-mono text-[10px] p-3.5 rounded-xl border border-slate-800 overflow-x-auto max-h-[160px] overflow-y-auto leading-relaxed">
                                {step.value}
                              </pre>
                            </div>
                          )}

                          {/* Inference Premises list */}
                          {step.type === 'Inference' && step.premises && step.premises.length > 0 && (
                            <div className="space-y-2 mt-1 select-text">
                              <div className="text-[8px] font-mono font-bold text-indigo-500/80 uppercase tracking-widest">Premise Facts (Triples Used)</div>
                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                {step.premises.map((premise, pi) => (
                                  <div key={pi} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-700 leading-normal">
                                    <span className="text-accent truncate max-w-[120px] font-semibold" title={premise.subject}>
                                      {getShortLabel(premise.subject)}
                                    </span>
                                    <span className="text-indigo-500 font-bold">
                                      {getShortLabel(premise.predicate)}
                                    </span>
                                    {premise.objectType === 'Literal' ? (
                                      <span className="text-emerald-600 font-bold">"{premise.object}"</span>
                                    ) : (
                                      <span className="text-yellow-600 truncate max-w-[120px]" title={premise.object}>
                                        &lt;{getShortLabel(premise.object)}&gt;
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                  {/* Inspector indicator */}
                  <div className="w-5 h-10 flex items-center justify-center text-slate-350 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all select-none">
                    <ArrowRight size={14} />
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      
      {/* ── Help Footer ── */}
      <div className="bg-white border-t border-accent/10 px-6 py-4 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5 select-none">
          <Info size={12} className="text-accent shrink-0" />
          <span>Click any card to inspect namespaces, prefixes & Turtle triples.</span>
        </div>
        <div className="hidden sm:block select-none opacity-60">
          W3C PROV-O Standard
        </div>
      </div>
      
    </div>
  );
}
