import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

interface NodeProps {
  id: string;
  label: string;
  type: "subject" | "uri" | "class" | "literal";
  x: number;
  y: number;
  delay: number;
}

interface EdgeProps {
  fromId: string;
  toId: string;
  label: string;
  delay: number;
}

export const SceneGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Transition-in (0 - 15 frames): scale down from 1.15 to 1, fade in
  const sceneScale = interpolate(frame, [0, 15], [1.15, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2. Transition-out (280 - 300 frames): scale down to 0.8, fade out
  const outScale = interpolate(frame, [280, 300], [1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const outOpacity = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalScale = frame >= 280 ? outScale : sceneScale;
  const finalOpacity = frame >= 280 ? outOpacity : sceneOpacity;

  // Graph nodes details
  const nodes: NodeProps[] = [
    { id: "s", label: "resource:123", type: "subject", x: 480, y: 300, delay: 15 },
    { id: "o1", label: "dcat:Dataset", type: "class", x: 780, y: 150, delay: 55 },
    { id: "o2", label: "org:VLIZ", type: "uri", x: 180, y: 180, delay: 95 },
    { id: "o3", label: "Plankton Obs...", type: "literal", x: 480, y: 480, delay: 135 },
    { id: "o4", label: "orcid:0000-0002-8614-2390", type: "uri", x: 180, y: 420, delay: 175 },
    { id: "o5", label: '"North Sea"', type: "literal", x: 780, y: 450, delay: 215 },
  ];

  // Graph edges details
  const edges: EdgeProps[] = [
    { fromId: "s", toId: "o1", label: "rdf:type", delay: 40 },
    { fromId: "s", toId: "o2", label: "dct:publisher", delay: 80 },
    { fromId: "s", toId: "o3", label: "dct:title", delay: 120 },
    { fromId: "s", toId: "o4", label: "dct:creator", delay: 160 },
    { fromId: "s", toId: "o5", label: "dct:spatial", delay: 200 },
  ];

  const getStyleForType = (type: "subject" | "uri" | "class" | "literal") => {
    switch (type) {
      case "subject":
        return { fill: "rgba(61, 122, 141, 0.15)", stroke: "#3d7a8d", textFill: "#1a3b4c", radius: 46 };
      case "uri":
        return { fill: "rgba(100, 181, 246, 0.15)", stroke: "#64b5f6", textFill: "#1a3b4c", radius: 38 };
      case "class":
        return { fill: "rgba(129, 140, 248, 0.15)", stroke: "#818cf8", textFill: "#1a3b4c", radius: 38 };
      case "literal":
      default:
        return { fill: "rgba(203, 213, 225, 0.2)", stroke: "#cbd5e1", textFill: "#4a5568", radius: 38 };
    }
  };

  // Helper to calculate continuous floating offset coordinate
  const getFloatingOffset = (idx: number, currentFrame: number) => {
    const floatX = Math.sin(currentFrame / 18 + idx * 1.5) * 6;
    const floatY = Math.cos(currentFrame / 15 + idx * 2.2) * 6;
    return { x: floatX, y: floatY };
  };

  // Helper to find node with floats included
  const getNodePosition = (nodeId: string, currentFrame: number) => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) return { x: 0, y: 0 };
    const n = nodes[idx];
    const offset = getFloatingOffset(idx, currentFrame);
    return { x: n.x + offset.x, y: n.y + offset.y };
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "60px",
        flexDirection: "column",
        opacity: finalOpacity,
        transform: `scale(${finalScale})`,
        backgroundColor: "#f8fafc",
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: "48px",
          fontWeight: 900,
          color: "#1a3b4c",
          marginBottom: "10px",
          textAlign: "center",
          letterSpacing: "-0.03em",
        }}
      >
        Resolved RDF Graph Output
      </h2>
      <p
        style={{
          fontSize: "24px",
          color: "#4a5568",
          marginBottom: "40px",
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        All raw metadata parsed, combined, and represented as clean semantic relations.
      </p>

      {/* SVG Canvas */}
      <div
        style={{
          width: "960px",
          height: "580px",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          border: "2.5px solid rgba(61,122,141,0.15)",
          boxShadow: "0 25px 60px rgba(26,59,76,0.08)",
          position: "relative",
          overflow: "visible",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 960 580" style={{ overflow: "visible" }}>
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="38" // Positioned neatly at edge of standard object nodes
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3d7a8d" />
            </marker>
            <marker
              id="graph-arrow-subject"
              viewBox="0 0 10 10"
              refX="46" // Offset for larger subject node
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3d7a8d" />
            </marker>
          </defs>

          {/* Edges / Connector Lines */}
          {edges.map((edge, idx) => {
            if (frame < edge.delay) return null;

            const fromPos = getNodePosition(edge.fromId, frame);
            const toPos = getNodePosition(edge.toId, frame);

            // Path length drawing progress
            const drawProgress = spring({
              frame: frame - edge.delay,
              fps,
              config: { damping: 18, stiffness: 85 },
            });

            const textOpacity = interpolate(frame - edge.delay, [12, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

            const currentX = interpolate(drawProgress, [0, 1], [fromPos.x, toPos.x]);
            const currentY = interpolate(drawProgress, [0, 1], [fromPos.y, toPos.y]);

            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;

            // Animate glowing pulse along the edge lines (loops every 45 frames)
            const pulseProgress = ((frame - edge.delay) % 45) / 45;
            const pulseX = fromPos.x + pulseProgress * (toPos.x - fromPos.x);
            const pulseY = fromPos.y + pulseProgress * (toPos.y - fromPos.y);
            const pulseOpacity = interpolate(pulseProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

            return (
              <g key={`edge-${idx}`}>
                {/* Main line connector */}
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={currentX}
                  y2={currentY}
                  stroke="#3d7a8d"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                  markerEnd={drawProgress >= 0.96 ? (edge.toId === "s" ? "url(#graph-arrow-subject)" : "url(#graph-arrow)") : undefined}
                />

                {/* Moving glowing signal pulse along line */}
                {drawProgress >= 0.95 && (
                  <circle
                    cx={pulseX}
                    cy={pulseY}
                    r="8"
                    fill="#64b5f6"
                    opacity={pulseOpacity}
                    style={{
                      filter: "drop-shadow(0 0 6px #64b5f6)",
                    }}
                  />
                )}

                {/* Predicate label */}
                <text
                  x={midX}
                  y={midY - 12}
                  opacity={textOpacity}
                  fill="#3d7a8d"
                  fontSize="15"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node, idx) => {
            if (frame < node.delay) return null;

            // Spring scale pop in
            const scale = spring({
              frame: frame - node.delay,
              fps,
              config: { damping: 13, stiffness: 95 },
            });

            const style = getStyleForType(node.type);
            const pos = getNodePosition(node.id, frame);

            return (
              <g
                key={`node-${idx}`}
                transform={`translate(${pos.x}, ${pos.y}) scale(${scale})`}
                style={{ overflow: "visible" }}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={style.radius}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth="2.5"
                  style={{
                    filter: "drop-shadow(0 5px 12px rgba(26,59,76,0.06))",
                  }}
                />
                <text
                  x={0}
                  y={style.radius + 24}
                  fill={style.textFill}
                  fontSize="16"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </AbsoluteFill>
  );
};
