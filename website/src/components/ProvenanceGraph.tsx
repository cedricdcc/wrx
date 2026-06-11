import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import * as N3 from 'n3';

// ── Types ──────────────────────────────────────────────────────────────

export interface ProvNode {
  id: string;
  type: 'Entity' | 'Activity' | 'Agent' | 'Plan';
  label: string;
  properties: Record<string, string[]>;
  turtleSnippet: string;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  provType: ProvNode['type'];
  label: string;
  provNode: ProvNode;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  label: string;
  property: string;
}

interface ProvenanceGraphProps {
  turtleString: string;
  onNodeSelect: (node: ProvNode) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ProvNode['type'], string> = {
  Entity: '#3d7a8d',
  Activity: '#64b5f6',
  Agent: '#10b981',
  Plan: '#f59e0b',
};

const TYPE_STROKE: Record<ProvNode['type'], string> = {
  Entity: '#2d5c6b',
  Activity: '#4a90c4',
  Agent: '#0d9488',
  Plan: '#d97706',
};

const EDGE_STYLES: Record<string, { stroke: string; dash: string; width: number }> = {
  'http://www.w3.org/ns/prov#wasGeneratedBy': { stroke: '#64b5f6', dash: '', width: 1.8 },
  'http://www.w3.org/ns/prov#wasDerivedFrom': { stroke: '#3d7a8d', dash: '6,3', width: 1.5 },
  'http://www.w3.org/ns/prov#wasAssociatedWith': { stroke: '#10b981', dash: '3,3', width: 1.3 },
  'http://www.w3.org/ns/prov#used': { stroke: '#94a3b8', dash: '', width: 1.2 },
  'http://www.w3.org/ns/prov#hadPlan': { stroke: '#f59e0b', dash: '6,2,2,2', width: 1.3 },
  'http://www.w3.org/ns/prov#agent': { stroke: '#10b981', dash: '3,3', width: 1.2 },
  'http://www.w3.org/ns/prov#entity': { stroke: '#3d7a8d', dash: '6,3', width: 1.2 },
  'http://www.w3.org/ns/prov#hadActivity': { stroke: '#64b5f6', dash: '6,3', width: 1.2 },
};

const DEFAULT_EDGE_STYLE = { stroke: '#94a3b8', dash: '4,4', width: 1 };

const PROV_NS = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_SEEALSO = 'http://www.w3.org/2000/01/rdf-schema#seeAlso';

// Properties that represent structural relationships (rendered as edges)
const EDGE_PROPERTIES = new Set([
  `${PROV_NS}wasGeneratedBy`,
  `${PROV_NS}wasDerivedFrom`,
  `${PROV_NS}wasAssociatedWith`,
  `${PROV_NS}used`,
  `${PROV_NS}hadPlan`,
  `${PROV_NS}agent`,
  `${PROV_NS}entity`,
  `${PROV_NS}hadActivity`,
]);

// Properties to skip in edges (they are metadata, not structural)
const SKIP_PROPERTIES = new Set([
  RDF_TYPE,
  RDFS_LABEL,
  `${PROV_NS}startedAtTime`,
  `${PROV_NS}endedAtTime`,
  `${PROV_NS}generatedAtTime`,
  `${PROV_NS}value`,
  RDFS_SEEALSO,
  `${PROV_NS}qualifiedAssociation`,
  `${PROV_NS}qualifiedDerivation`,
]);

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
    return uri.length > 30 ? uri.substring(0, 27) + '…' : uri;
  }
}

function getShortPredicate(uri: string): string {
  if (uri.startsWith(PROV_NS)) return 'prov:' + uri.substring(PROV_NS.length);
  if (uri.includes('#')) {
    const frag = uri.split('#').pop() || '';
    const prefix = uri.includes('wrx') ? 'wrx:' : '';
    return prefix + frag;
  }
  return getShortLabel(uri);
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

// Pentagon path generator
function pentagonPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i / 5);
    points.push(`${cx + r * Math.cos(angle)},${cy - r * Math.sin(angle)}`);
  }
  return 'M' + points.join('L') + 'Z';
}

// Diamond path generator
function diamondPath(cx: number, cy: number, size: number): string {
  return `M${cx},${cy - size} L${cx + size},${cy} L${cx},${cy + size} L${cx - size},${cy} Z`;
}

// ── Parse Turtle ───────────────────────────────────────────────────────

function parseTurtleToGraph(turtleString: string): { nodes: SimNode[]; links: SimLink[] } {
  if (!turtleString || turtleString.trim().length === 0) {
    return { nodes: [], links: [] };
  }

  const parser = new N3.Parser();
  let quads: N3.Quad[];
  try {
    quads = parser.parse(turtleString);
  } catch (e) {
    console.error('Failed to parse PROV-O Turtle:', e);
    return { nodes: [], links: [] };
  }

  // Group quads by subject
  const subjectMap = new Map<string, N3.Quad[]>();
  for (const q of quads) {
    const s = q.subject.value;
    if (!subjectMap.has(s)) subjectMap.set(s, []);
    subjectMap.get(s)!.push(q);
  }

  // Build node map
  const nodeMap = new Map<string, ProvNode>();
  const blankNodeSubjects = new Set<string>();

  for (const [subjectId, subjectQuads] of subjectMap) {
    // Skip blank nodes that are qualifiedAssociation/qualifiedDerivation internals
    if (subjectId.startsWith('_:')) {
      blankNodeSubjects.add(subjectId);
      continue;
    }

    const types = subjectQuads
      .filter(q => q.predicate.value === RDF_TYPE)
      .map(q => q.object.value);

    if (types.length === 0) continue; // Skip untyped nodes

    const labelQuad = subjectQuads.find(q => q.predicate.value === RDFS_LABEL);
    const label = labelQuad ? labelQuad.object.value : getShortLabel(subjectId);
    const provType = classifyNode(types);

    const properties: Record<string, string[]> = {};
    for (const q of subjectQuads) {
      const pred = q.predicate.value;
      if (!properties[pred]) properties[pred] = [];
      properties[pred].push(q.object.value);
    }

    // Build turtle snippet for this node
    const snippetLines = subjectQuads.map(q => {
      const obj = q.object.termType === 'Literal'
        ? `"${q.object.value}"`
        : `<${q.object.value}>`;
      return `<${subjectId}> <${q.predicate.value}> ${obj} .`;
    });

    nodeMap.set(subjectId, {
      id: subjectId,
      type: provType,
      label,
      properties,
      turtleSnippet: snippetLines.join('\n'),
    });
  }

  // Also extract edges from blank node subjects (qualifiedAssociation, qualifiedDerivation)
  // These contain prov:agent, prov:hadPlan, prov:entity, prov:hadActivity
  const extraLinks: SimLink[] = [];
  for (const bnodeId of blankNodeSubjects) {
    const bnodeQuads = subjectMap.get(bnodeId) || [];
    // Find what references this blank node
    let parentSubject: string | null = null;
    for (const q of quads) {
      if (q.object.value === bnodeId && !q.subject.value.startsWith('_:')) {
        parentSubject = q.subject.value;
        break;
      }
    }
    if (!parentSubject) continue;

    for (const q of bnodeQuads) {
      const pred = q.predicate.value;
      if (pred === RDF_TYPE) continue;
      const target = q.object.value;
      if (target.startsWith('_:')) continue;
      if (nodeMap.has(target) && nodeMap.has(parentSubject)) {
        extraLinks.push({
          source: parentSubject,
          target: target,
          label: getShortPredicate(pred),
          property: pred,
        });
      }
    }
  }

  // Build links from direct edges
  const links: SimLink[] = [...extraLinks];
  for (const q of quads) {
    const pred = q.predicate.value;
    const sourceId = q.subject.value;
    const targetId = q.object.value;

    if (sourceId.startsWith('_:')) continue;
    if (SKIP_PROPERTIES.has(pred)) continue;
    if (!EDGE_PROPERTIES.has(pred)) continue;
    if (targetId.startsWith('_:')) continue;
    if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

    // Avoid duplicate edges
    const isDup = links.some(
      l => (typeof l.source === 'string' ? l.source : l.source.id) === sourceId &&
           (typeof l.target === 'string' ? l.target : l.target.id) === targetId &&
           l.property === pred
    );
    if (!isDup) {
      links.push({
        source: sourceId,
        target: targetId,
        label: getShortPredicate(pred),
        property: pred,
      });
    }
  }

  const nodes: SimNode[] = Array.from(nodeMap.values()).map(pn => ({
    id: pn.id,
    provType: pn.type,
    label: pn.label,
    provNode: pn,
  }));

  return { nodes, links };
}

// ── Component ──────────────────────────────────────────────────────────

export default function ProvenanceGraph({ turtleString, onNodeSelect }: ProvenanceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { nodes, links } = useMemo(() => parseTurtleToGraph(turtleString), [turtleString]);

  const renderGraph = useCallback(() => {
    if (!containerRef.current || !svgRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Arrow markers per edge type
    const defs = svg.append('defs');
    Object.entries(EDGE_STYLES).forEach(([prop, style]) => {
      const markerId = 'arrow-' + prop.split('#').pop();
      defs.append('marker')
        .attr('id', markerId)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', style.stroke);
    });

    // Default arrow
    defs.append('marker')
      .attr('id', 'arrow-default')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', DEFAULT_EDGE_STYLE.stroke);

    // Simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(60));

    // Edges
    const linkGroup = g.append('g').attr('class', 'prov-links');

    const linkPaths = linkGroup.selectAll('path')
      .data(links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', d => (EDGE_STYLES[d.property] || DEFAULT_EDGE_STYLE).stroke)
      .attr('stroke-width', d => (EDGE_STYLES[d.property] || DEFAULT_EDGE_STYLE).width)
      .attr('stroke-dasharray', d => (EDGE_STYLES[d.property] || DEFAULT_EDGE_STYLE).dash)
      .attr('marker-end', d => {
        const frag = d.property.split('#').pop();
        return EDGE_STYLES[d.property] ? `url(#arrow-${frag})` : 'url(#arrow-default)';
      })
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .attr('opacity', 0.7);

    // Edge labels
    const edgeLabelPaths = g.append('g').selectAll('.edge-label-path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'edge-label-path')
      .attr('id', (_, i) => `prov-edgepath-${i}`)
      .attr('fill-opacity', 0)
      .attr('stroke-opacity', 0)
      .style('pointer-events', 'none');

    g.append('g').selectAll('.edge-label')
      .data(links)
      .enter()
      .append('text')
      .attr('class', 'edge-label')
      .style('pointer-events', 'none')
      .attr('font-size', 9)
      .attr('fill', d => (EDGE_STYLES[d.property] || DEFAULT_EDGE_STYLE).stroke)
      .attr('font-family', 'monospace')
      .attr('font-weight', '500')
      .append('textPath')
      .attr('xlink:href', (_, i) => `#prov-edgepath-${i}`)
      .style('text-anchor', 'middle')
      .attr('startOffset', '50%')
      .text(d => d.label);

    // Nodes
    const nodeGroup = g.append('g').attr('class', 'prov-nodes');

    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => {
        onNodeSelect(d.provNode);
      });

    // Draw shapes based on type
    node.each(function (d) {
      const el = d3.select(this);
      const fill = TYPE_COLORS[d.provType];
      const stroke = TYPE_STROKE[d.provType];

      switch (d.provType) {
        case 'Entity':
          el.append('rect')
            .attr('x', -55)
            .attr('y', -18)
            .attr('width', 110)
            .attr('height', 36)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', fill + '25')
            .attr('stroke', stroke)
            .attr('stroke-width', 1.8);
          break;

        case 'Activity':
          el.append('rect')
            .attr('x', -60)
            .attr('y', -18)
            .attr('width', 120)
            .attr('height', 36)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', fill + '20')
            .attr('stroke', stroke)
            .attr('stroke-width', 1.8);
          break;

        case 'Agent':
          el.append('path')
            .attr('d', pentagonPath(0, 0, 22))
            .attr('fill', fill + '20')
            .attr('stroke', stroke)
            .attr('stroke-width', 1.8);
          break;

        case 'Plan':
          el.append('path')
            .attr('d', diamondPath(0, 0, 22))
            .attr('fill', fill + '20')
            .attr('stroke', stroke)
            .attr('stroke-width', 1.8);
          break;
      }

      // Hover glow
      el.on('mouseenter', function () {
        d3.select(this).select('rect, path')
          .transition().duration(200)
          .attr('filter', `drop-shadow(0 0 6px ${fill})`);
      }).on('mouseleave', function () {
        d3.select(this).select('rect, path')
          .transition().duration(200)
          .attr('filter', '');
      });
    });

    // Node labels
    node.append('text')
      .attr('dy', d => d.provType === 'Entity' || d.provType === 'Activity' ? 4 : 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#1a3b4c')
      .text(d => d.label.length > 16 ? d.label.substring(0, 14) + '…' : d.label);

    // Type badge below node
    node.append('text')
      .attr('dy', d => {
        switch (d.provType) {
          case 'Entity': return 32;
          case 'Activity': return 32;
          case 'Agent': return 34;
          case 'Plan': return 34;
        }
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', d => TYPE_COLORS[d.provType])
      .attr('opacity', 0.7)
      .text(d => d.provType.toUpperCase());

    // Entry animation
    node.attr('opacity', 0)
      .attr('transform', 'translate(0,0) scale(0.3)')
      .transition()
      .duration(500)
      .delay((_, i) => 100 + i * 80)
      .attr('opacity', 1)
      .attr('transform', d => `translate(${d.x || 0},${d.y || 0}) scale(1)`);

    // Drag behavior
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag as any);

    // Tick
    simulation.on('tick', () => {
      // Update link paths (curved)
      linkGroup.selectAll('path')
        .attr('d', (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
          return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });

      edgeLabelPaths.attr('d', (d: any) => {
        return `M${d.source.x} ${d.source.y} L${d.target.x} ${d.target.y}`;
      });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeSelect]);

  useEffect(() => {
    const cleanup = renderGraph();
    return () => {
      if (cleanup) cleanup();
    };
  }, [renderGraph]);

  if (!turtleString || turtleString.trim().length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center text-slate-400 space-y-3">
          <div className="text-4xl opacity-30">◇</div>
          <div className="text-sm font-medium">No provenance data available</div>
          <div className="text-xs opacity-60">Run an extraction with provenance enabled to see the PROV-O graph</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: '450px' }}>
      <svg ref={svgRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm border border-accent/20 p-3.5 rounded-xl shadow-sm text-[10px] font-mono flex flex-col gap-2.5 z-10 pointer-events-none">
        <div className="font-bold border-b border-accent/10 pb-1.5 mb-0.5 text-accent uppercase tracking-wider">
          PROV-O Types
        </div>
        {/* Entity */}
        <div className="flex items-center gap-2.5">
          <svg width="20" height="14" viewBox="0 0 20 14">
            <rect x="1" y="1" width="18" height="12" rx="3" fill="#3d7a8d25" stroke="#2d5c6b" strokeWidth="1.2" />
          </svg>
          <span className="font-semibold text-[#1a3b4c]">Entity</span>
        </div>
        {/* Activity */}
        <div className="flex items-center gap-2.5">
          <svg width="20" height="14" viewBox="0 0 20 14">
            <rect x="1" y="1" width="18" height="12" rx="1" fill="#64b5f620" stroke="#4a90c4" strokeWidth="1.2" />
          </svg>
          <span className="font-semibold text-[#1a3b4c]">Activity</span>
        </div>
        {/* Agent */}
        <div className="flex items-center gap-2.5">
          <svg width="20" height="14" viewBox="0 0 20 14">
            <path d={pentagonPath(10, 7, 6)} fill="#10b98120" stroke="#0d9488" strokeWidth="1.2" />
          </svg>
          <span className="font-semibold text-[#1a3b4c]">Agent</span>
        </div>
        {/* Plan */}
        <div className="flex items-center gap-2.5">
          <svg width="20" height="14" viewBox="0 0 20 14">
            <path d={diamondPath(10, 7, 6)} fill="#f59e0b20" stroke="#d97706" strokeWidth="1.2" />
          </svg>
          <span className="font-semibold text-[#1a3b4c]">Plan</span>
        </div>
      </div>

      {/* Node count */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-accent/15 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-mono text-accent z-10 pointer-events-none">
        {nodes.length} nodes · {links.length} edges
      </div>
    </div>
  );
}
