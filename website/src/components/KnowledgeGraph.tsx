import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Palette, Eye, EyeOff } from 'lucide-react';

interface Triple {
  subject: string;
  predicate: string;
  object: string;
  objectType: string;
  datatype?: string;
  sourceUri?: string;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: number; // 1: URI, 2: String, 3: Number, 4: Other
  type: string;
  sources: Set<string>;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  label: string;
}

interface KnowledgeGraphProps {
  triples: Triple[];
  onNodeClick?: (nodeId: string, isUri: boolean) => void;
}

const PRESET_COLORS = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1"
];

const getShortName = (uri: string) => {
  if (!uri || !uri.startsWith('http')) return uri || 'Unknown';
  try {
    const url = new URL(uri);
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart) return lastPart;
    return url.hostname;
  } catch (e) {
    const parts = uri.split(/[/#]/);
    return parts[parts.length - 1] || parts[parts.length - 2] || uri;
  }
};

export default function KnowledgeGraph({ triples, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sourceSettings, setSourceSettings] = useState<Record<string, { color: string, visible: boolean }>>({});

  // Get unique sources
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(triples.map(t => t.sourceUri || 'original')));
  }, [triples]);

  // Sync settings when sources change
  useEffect(() => {
    setSourceSettings(prev => {
      const next = { ...prev };
      uniqueSources.forEach((source, i) => {
        if (!next[source]) {
          next[source] = {
            color: PRESET_COLORS[i % PRESET_COLORS.length],
            visible: true
          };
        }
      });
      return next;
    });
  }, [uniqueSources]);

  const toggleSourceVisibility = (source: string) => {
    setSourceSettings(prev => ({
      ...prev,
      [source]: { ...prev[source], visible: !prev[source].visible }
    }));
  };

  const cycleColor = (source: string) => {
    setSourceSettings(prev => {
      const currentColor = prev[source].color;
      const currentIndex = PRESET_COLORS.indexOf(currentColor);
      const nextIndex = (currentIndex + 1) % PRESET_COLORS.length;
      return {
        ...prev,
        [source]: { ...prev[source], color: PRESET_COLORS[nextIndex] }
      };
    });
  };

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || !triples.length) return;

    // Use a subset of triples to avoid performance issues if there are too many
    const limit = 500;
    const isOverLimit = triples.length > limit;
    const renderTriples = triples.slice(0, limit);

    const nodesMap = new Map<string, Node>();
    const links: Link[] = [];

    const getGroupFromTriple = (type: string, datatype?: string) => {
      if (type === 'NamedNode') return 1;
      if (type === 'Literal') {
        if (datatype?.includes('integer') || datatype?.includes('decimal') || datatype?.includes('float') || datatype?.includes('double')) {
          return 3;
        }
        return 2;
      }
      return 4;
    };

    renderTriples.forEach(t => {
      const sId = t.subject;
      const oId = t.object;
      const source = t.sourceUri || 'original';
      
      if (!nodesMap.has(sId)) {
        nodesMap.set(sId, { id: sId, group: 1, type: 'NamedNode', sources: new Set() });
      }
      if (!nodesMap.has(oId)) {
        const group = getGroupFromTriple(t.objectType, t.datatype);
        nodesMap.set(oId, { id: oId, group, type: t.objectType, sources: new Set() });
      }

      const sNode = nodesMap.get(sId)!;
      const oNode = nodesMap.get(oId)!;
      sNode.sources.add(source);
      oNode.sources.add(source);

      links.push({
        source: sId,
        target: oId,
        label: getShortName(t.predicate)
      });
    });

    const nodes = Array.from(nodesMap.values());

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const g = svg.append("g");

    svg.attr("viewBox", [0, 0, width, height]);

    // Zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Defs for arrowheads
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#3d7a8d")
      .style("stroke", "none");

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(50));

    // Hull Generator
    const hullGroup = g.append("g").attr("class", "hulls");

    const updateHulls = () => {
      const hullData = uniqueSources.map((source) => {
        const setting = sourceSettings[source];
        if (!setting || !setting.visible) return null;

        const sourceNodes = nodes.filter(n => n.sources.has(source));
        if (sourceNodes.length < 3) return null;
        
        const points = sourceNodes.map(n => [n.x!, n.y!] as [number, number]);
        const polygon = d3.polygonHull(points);
        if (!polygon) return null;

        return {
          source,
          polygon,
          color: setting.color
        };
      }).filter(h => h !== null);

      const hulls = hullGroup.selectAll("path")
        .data(hullData, (d: any) => d.source);

      hulls.exit().remove();

      hulls.enter()
        .append("path")
        .merge(hulls as any)
        .attr("fill", (d: any) => d.color)
        .attr("stroke", (d: any) => d.color)
        .attr("stroke-width", 60)
        .attr("stroke-linejoin", "round")
        .attr("opacity", 0.08)
        .attr("d", (d: any) => "M" + d.polygon.join("L") + "Z");
    };

    // Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", "#3d7a8d")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)");

    // Link labels
    const edgePaths = g.append("g").selectAll(".edgepath")
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'edgepath')
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0)
        .attr('id', function (d, i) {return 'edgepath' + i})
        .style("pointer-events", "none");

    const edgeLabels = g.append("g").selectAll(".edgelabel")
        .data(links)
        .enter()
        .append('text')
        .style("pointer-events", "none")
        .attr('class', 'edgelabel')
        .attr('id', function (d, i) {return 'edgelabel' + i})
        .attr('font-size', 9)
        .attr('fill', '#64b5f6')
        .attr('font-family', 'monospace');

    edgeLabels.append('textPath')
        .attr('xlink:href', function (d, i) {return '#edgepath' + i})
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .attr("startOffset", "50%")
        .text((d: any) => d.label);

    const colorMap = {
      1: "#3d7a8d", // URI
      2: "#eab308", // String
      3: "#22c55e", // Number
      4: "#94a3b8"  // Other
    };

    // Nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d.id, d.type === 'NamedNode');
      });

    node.append("circle")
      .attr("r", 8)
      .attr("fill", (d: any) => colorMap[d.group as keyof typeof colorMap] || "#94a3b8")
      .attr("stroke", "#1a3b4c")
      .attr("stroke-width", 1.5);

    node.append("title")
      .text((d) => d.id);

    node.append("text")
      .attr("dx", 12)
      .attr("dy", 4)
      .text((d) => getShortName(d.id))
      .attr("font-size", 10)
      .attr("font-family", "sans-serif")
      .attr("font-weight", (d) => d.group === 1 ? "bold" : "normal")
      .attr("fill", "#1a3b4c");

    simulation.on("tick", () => {
      updateHulls();
      link.attr("d", (d: any) => {
          const dx = d.target.x - d.source.x,
              dy = d.target.y - d.source.y,
              dr = Math.sqrt(dx * dx + dy * dy);
          return "M" + 
              d.source.x + "," + 
              d.source.y + "A" + 
              dr + "," + dr + " 0 0,1 " + 
              d.target.x + "," + 
              d.target.y;
      });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);

      edgePaths.attr('d', (d: any) => {
        return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y;
      });

      edgeLabels.attr('transform', function (d: any) {
        if (d.target.x < d.source.x) {
            const bbox = (this as SVGGraphicsElement).getBBox();
            const rx = bbox.x + bbox.width / 2;
            const ry = bbox.y + bbox.height / 2;
            return 'rotate(180 ' + rx + ' ' + ry + ')';
        }
        else {
            return 'rotate(0)';
        }
      });
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [triples, onNodeClick, sourceSettings, uniqueSources]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: '400px' }}>
      <svg ref={svgRef} className="w-full h-full" />
      
      {triples.length > 500 && (
        <div className="absolute top-4 right-4 bg-yellow-500/90 backdrop-blur-sm text-black px-4 py-2 rounded-lg shadow-lg text-[10px] font-bold flex items-center gap-2 z-20 animate-pulse border border-yellow-600/20">
          <Palette size={14} />
          <span>VISUALIZATION LIMIT: Showing first 500 of {triples.length} triples</span>
        </div>
      )}
      
      {/* Type Legend */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm border border-accent/20 p-3 rounded-lg shadow-sm text-[10px] font-mono flex flex-col gap-2 z-10 pointer-events-none">
        <div className="font-bold border-b border-accent/10 pb-1 mb-1 text-accent">DATA TYPES</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: "#3d7a8d" }} />
          <span>URI (NamedNode)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: "#eab308" }} />
          <span>String Literal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: "#22c55e" }} />
          <span>Numeric Literal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: "#94a3b8" }} />
          <span>Other / Blank</span>
        </div>
      </div>

      {/* Cluster/Source Legend */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm border border-accent/20 p-4 rounded-xl shadow-lg text-[10px] font-mono flex flex-col gap-3 z-10 max-w-[200px] sm:max-w-xs overflow-hidden">
        <div className="font-bold border-b border-accent/10 pb-2 flex items-center justify-between text-accent">
          <span>DATA CLUSTERS</span>
          <Palette size={12} />
        </div>
        
        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
          {uniqueSources.map(source => {
            const setting = sourceSettings[source] || { color: '#ccc', visible: true };
            return (
              <div key={source} className="flex items-center gap-3 py-1 group">
                <button 
                  onClick={() => cycleColor(source)}
                  className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-sm transition-transform active:scale-90"
                  style={{ backgroundColor: setting.color }}
                  title="Change Color"
                />
                <span className="truncate flex-1 font-medium text-poster-dark opacity-80" title={source}>
                  {getShortName(source)}
                </span>
                <button 
                  onClick={() => toggleSourceVisibility(source)}
                  className="shrink-0 text-accent hover:text-poster-dark transition-colors"
                >
                  {setting.visible ? <Eye size={12} /> : <EyeOff size={12} className="opacity-50" />}
                </button>
              </div>
            );
          })}
          {uniqueSources.length === 0 && (
            <div className="text-[#999] italic italic py-2">No sources loaded</div>
          )}
        </div>
        <div className="pt-2 border-t border-accent/10 text-[9px] text-[#999] text-center">
          Click color to cycle palette
        </div>
      </div>
    </div>
  );
}
