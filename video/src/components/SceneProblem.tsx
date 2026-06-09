import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { Globe, Server } from "lucide-react";

export const SceneProblem: React.FC = () => {
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

  // 2. Transition-out (390 - 405 frames): scale down to 0.8, fade out
  const outScale = interpolate(frame, [390, 405], [1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const outOpacity = interpolate(frame, [390, 405], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalScale = frame >= 390 ? outScale : sceneScale;
  const finalOpacity = frame >= 390 ? outOpacity : sceneOpacity;

  // Bezier curve calculations
  const getBezierPoint = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    return { x, y };
  };

  // Branching paths coordinates
  const path1 = { p0: { x: 350, y: 140 }, p1: { x: 800, y: -20 }, p2: { x: 1250, y: 140 } };
  const path2 = { p0: { x: 350, y: 195 }, p1: { x: 800, y: 120 }, p2: { x: 1250, y: 195 } };
  const path3 = { p0: { x: 350, y: 255 }, p1: { x: 800, y: 330 }, p2: { x: 1250, y: 255 } };
  const path4 = { p0: { x: 350, y: 310 }, p1: { x: 800, y: 470 }, p2: { x: 1250, y: 310 } };

  // Sequential probes
  // Probe 1: Content Negotiation (frames 30 - 65)
  const probe1Active = frame >= 30 && frame <= 65;
  const t1 = interpolate(frame, [30, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pos1 = getBezierPoint(t1, path1.p0, path1.p1, path1.p2);
  const probe1Failed = frame >= 65;

  // Probe 2: Link Headers (frames 100 - 135)
  const probe2Active = frame >= 100 && frame <= 135;
  const t2 = interpolate(frame, [100, 135], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pos2 = getBezierPoint(t2, path2.p0, path2.p1, path2.p2);
  const probe2Failed = frame >= 135;

  // Probe 3: HTML Signposts (frames 170 - 205)
  const probe3Active = frame >= 170 && frame <= 205;
  const t3 = interpolate(frame, [170, 205], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pos3 = getBezierPoint(t3, path3.p0, path3.p1, path3.p2);
  const probe3Failed = frame >= 205;

  // Probe 4: Sitemaps / Linksets (frames 240 - 275)
  const probe4Active = frame >= 240 && frame <= 275;
  const t4 = interpolate(frame, [240, 275], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pos4 = getBezierPoint(t4, path4.p0, path4.p1, path4.p2);
  const probe4Failed = frame >= 275;

  // Status labels opacity transitions
  const label1Opacity = interpolate(frame, [65, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const label2Opacity = interpolate(frame, [135, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const label3Opacity = interpolate(frame, [205, 215], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const label4Opacity = interpolate(frame, [275, 285], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Camera Shake logic
  const shakeForCollision = (collisionFrame: number, startFrame: number, duration: number, maxAmplitude: number) => {
    if (collisionFrame >= startFrame && collisionFrame < startFrame + duration) {
      const progress = (collisionFrame - startFrame) / duration;
      const amplitude = interpolate(progress, [0, 1], [maxAmplitude, 0]);
      return {
        x: Math.sin(collisionFrame * 3.5) * amplitude,
        y: Math.cos(collisionFrame * 3.0) * amplitude,
      };
    }
    return { x: 0, y: 0 };
  };

  const s1 = shakeForCollision(frame, 65, 12, 6);
  const s2 = shakeForCollision(frame, 135, 12, 6);
  const s3 = shakeForCollision(frame, 205, 12, 6);
  const s4 = shakeForCollision(frame, 275, 12, 6);
  const sFinal = shakeForCollision(frame, 300, 25, 15);

  const shakeX = s1.x + s2.x + s3.x + s4.x + sFinal.x;
  const shakeY = s1.y + s2.y + s3.y + s4.y + sFinal.y;

  // Final card pop-in
  const errorSpring = spring({
    frame: frame - 300,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const errorOpacity = interpolate(frame, [300, 310], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "60px",
        flexDirection: "column",
        opacity: finalOpacity,
        transform: `scale(${finalScale}) translate(${shakeX}px, ${shakeY}px)`,
        backgroundColor: "#f8fafc",
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: "50px",
          fontWeight: 900,
          color: "#1a3b4c",
          marginBottom: "15px",
          textAlign: "center",
          letterSpacing: "-0.03em",
        }}
      >
        How a Machine <span style={{ color: "#ef4444" }}>fails</span> to retrieve Linked Open Data
      </h2>
      <p
        style={{
          fontSize: "24px",
          color: "#4a5568",
          marginBottom: "45px",
          textAlign: "center",
          fontWeight: 500,
          opacity: subtitleOpacity,
        }}
      >
        Because developers implement diverse specifications unequally and without documentation, standard clients are left blind.
        Unable to explore the distributed semantic web.
      </p>

      {/* Main visual wrapper */}
      <div
        style={{
          display: "flex",
          width: "1600px",
          height: "450px",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          marginBottom: "40px",
        }}
      >
        {/* Left Side: Client Computer Representation */}
        <div
          style={{
            width: "350px",
            height: "260px",
            border: "3px solid #1a3b4c",
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 15px 35px rgba(26,59,76,0.06)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "rgba(61,122,141,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Globe size={40} style={{ color: "#3d7a8d" }} />
          </div>
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#1a3b4c" }}>Standard Client</span>
          <span style={{ fontSize: "14px", color: "#666", marginTop: "4px" }} className="font-mono">
            Wants RDF Discovery
          </span>
        </div>

        {/* Center SVG: Labyrinth Paths */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 5,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {/* Path 1: Content Negotiation */}
          <path
            d={`M ${path1.p0.x} ${path1.p0.y} Q ${path1.p1.x} ${path1.p1.y} ${path1.p2.x} ${path1.p2.y}`}
            fill="none"
            stroke={probe1Failed ? "#ef4444" : "rgba(26,59,76,0.12)"}
            strokeWidth="3.5"
            strokeDasharray={probe1Failed ? undefined : "5,5"}
          />
          {/* Path 2: Link Headers */}
          <path
            d={`M ${path2.p0.x} ${path2.p0.y} Q ${path2.p1.x} ${path2.p1.y} ${path2.p2.x} ${path2.p2.y}`}
            fill="none"
            stroke={probe2Failed ? "#ef4444" : "rgba(26,59,76,0.12)"}
            strokeWidth="3.5"
            strokeDasharray={probe2Failed ? undefined : "5,5"}
          />
          {/* Path 3: HTML Signposts */}
          <path
            d={`M ${path3.p0.x} ${path3.p0.y} Q ${path3.p1.x} ${path3.p1.y} ${path3.p2.x} ${path3.p2.y}`}
            fill="none"
            stroke={probe3Failed ? "#ef4444" : "rgba(26,59,76,0.12)"}
            strokeWidth="3.5"
            strokeDasharray={probe3Failed ? undefined : "5,5"}
          />
          {/* Path 4: Sitemaps / Linksets */}
          <path
            d={`M ${path4.p0.x} ${path4.p0.y} Q ${path4.p1.x} ${path4.p1.y} ${path4.p2.x} ${path4.p2.y}`}
            fill="none"
            stroke={probe4Failed ? "#ef4444" : "rgba(26,59,76,0.12)"}
            strokeWidth="3.5"
            strokeDasharray={probe4Failed ? undefined : "5,5"}
          />

          {/* Traveling pulses */}
          {probe1Active && renderPulseDot(pos1)}
          {probe2Active && renderPulseDot(pos2)}
          {probe3Active && renderPulseDot(pos3)}
          {probe4Active && renderPulseDot(pos4)}

          {/* Red Fail X Marks at endpoints */}
          {probe1Failed && renderFailX(path1.p2.x, path1.p2.y)}
          {probe2Failed && renderFailX(path2.p2.x, path2.p2.y)}
          {probe3Failed && renderFailX(path3.p2.x, path3.p2.y)}
          {probe4Failed && renderFailX(path4.p2.x, path4.p2.y)}

          {/* Text Labels overlaid cleanly */}
          {probe1Failed && (
            <text
              x="800"
              y="50"
              fill="#ef4444"
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              opacity={label1Opacity}
              fontFamily="monospace"
              style={{ filter: "drop-shadow(0 2px 4px rgba(255,255,255,0.9))" }}
            >
              Content Negotiation: FAILED (Returned HTML only)
            </text>
          )}

          {probe2Failed && (
            <text
              x="800"
              y="135"
              fill="#ef4444"
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              opacity={label2Opacity}
              fontFamily="monospace"
              style={{ filter: "drop-shadow(0 2px 4px rgba(255,255,255,0.9))" }}
            >
              RFC 8288 Link Headers: FAILED (None declared)
            </text>
          )}

          {probe3Failed && (
            <text
              x="800"
              y="315"
              fill="#ef4444"
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              opacity={label3Opacity}
              fontFamily="monospace"
              style={{ filter: "drop-shadow(0 2px 4px rgba(255,255,255,0.9))" }}
            >
              HTML Signposts: FAILED (No relation tags found)
            </text>
          )}

          {probe4Failed && (
            <text
              x="800"
              y="405"
              fill="#ef4444"
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              opacity={label4Opacity}
              fontFamily="monospace"
              style={{ filter: "drop-shadow(0 2px 4px rgba(255,255,255,0.9))" }}
            >
              Sitemaps & Linksets: FAILED (Undocumented endpoints)
            </text>
          )}
        </svg>

        {/* Right Side: Remote Server Representation */}
        <div
          style={{
            width: "350px",
            height: "260px",
            border: "3px solid #1a3b4c",
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 15px 35px rgba(26,59,76,0.06)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "rgba(26,59,76,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Server size={40} style={{ color: "#1a3b4c" }} />
          </div>
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#1a3b4c" }}>Remote Server</span>
          <span style={{ fontSize: "14px", color: "#666", marginTop: "4px" }} className="font-mono">
            Fragmented Implementations
          </span>
        </div>

        {/* Center: Overlaid 406 Error Popup */}
        {frame >= 300 && (
          <div
            style={{
              position: "absolute",
              top: "140px",
              left: "50%",
              transform: `translateX(-50%) scale(${errorSpring})`,
              opacity: errorOpacity,
              zIndex: 30,
              padding: "30px 50px",
              backgroundColor: "rgba(239, 68, 68, 0.95)",
              border: "3px solid #dc2626",
              borderRadius: "20px",
              color: "#ffffff",
              textAlign: "center",
              boxShadow: "0 25px 60px rgba(239,68,68,0.35)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ fontSize: "30px", fontWeight: 900, marginBottom: "8px", letterSpacing: "-0.02em" }}>
              DISCOVERY OBFUSCATED
            </div>
            <div style={{ fontSize: "18px", opacity: 0.9, fontWeight: 500 }}>
              Client lacks automated mappings to locate RDF relations.
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Helper components rendered manually inside SVG
const renderPulseDot = (pos: { x: number; y: number }) => {
  return (
    <circle
      cx={pos.x}
      cy={pos.y}
      r="10"
      fill="#64b5f6"
      style={{
        filter: "drop-shadow(0 0 10px #64b5f6)",
      }}
    />
  );
};

const renderFailX = (x: number, y: number) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r="14" fill="#ef4444" />
      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
};
