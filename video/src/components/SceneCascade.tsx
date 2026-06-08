import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export const SceneCascade: React.FC = () => {
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

  // 2. Transition-out (345 - 360 frames): scale down to 0.8, fade out
  const outScale = interpolate(frame, [345, 360], [1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const outOpacity = interpolate(frame, [345, 360], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalScale = frame >= 345 ? outScale : sceneScale;
  const finalOpacity = frame >= 345 ? outOpacity : sceneOpacity;

  // 3. Timing for cascading phases
  // Q1 active: 15-70. Fail at 70
  // Cascade Q1 -> Q2: 70-85
  // Q2 active: 85-140. Fail at 140
  // Cascade Q2 -> Q3: 140-155
  // Q3 active: 155-210. Fail at 210
  // Cascade Q3 -> Q4: 210-225
  // Q4 active: 225-275. Success at 275

  const getQuadState = (quadNum: number, currentFrame: number): "pending" | "active" | "failed" | "success" => {
    if (quadNum === 1) {
      if (currentFrame < 15) return "pending";
      if (currentFrame < 70) return "active";
      return "failed";
    }
    if (quadNum === 2) {
      if (currentFrame < 85) return "pending";
      if (currentFrame < 140) return "active";
      return "failed";
    }
    if (quadNum === 3) {
      if (currentFrame < 155) return "pending";
      if (currentFrame < 210) return "active";
      return "failed";
    }
    if (quadNum === 4) {
      if (currentFrame < 225) return "pending";
      if (currentFrame < 270) return "active";
      return "success";
    }
    return "pending";
  };

  const getQuadStyle = (state: "pending" | "active" | "failed" | "success") => {
    switch (state) {
      case "active":
        return {
          backgroundColor: "rgba(61, 122, 141, 0.12)",
          borderColor: "#3d7a8d",
          color: "#1a3b4c",
          transform: "scale(1.03)",
          boxShadow: "0 15px 35px rgba(61,122,141,0.12)",
        };
      case "failed":
        return {
          backgroundColor: "rgba(239, 68, 68, 0.03)",
          borderColor: "rgba(239, 68, 68, 0.2)",
          color: "rgba(26,59,76,0.4)",
          transform: "scale(1)",
        };
      case "success":
        return {
          backgroundColor: "rgba(34, 197, 94, 0.08)",
          borderColor: "#22c55e",
          color: "#166534",
          transform: "scale(1.05)",
          boxShadow: "0 20px 40px rgba(34,197,94,0.12)",
        };
      case "pending":
      default:
        return {
          backgroundColor: "#ffffff",
          borderColor: "rgba(26, 59, 76, 0.1)",
          color: "rgba(26,59,76,0.5)",
          transform: "scale(1)",
        };
    }
  };

  // Status message
  let currentStatus = "Initializing cascade pipeline...";
  if (frame >= 15 && frame < 70) currentStatus = "Q1: Probing Content Negotiation (Accept: text/turtle)... HTTP 406";
  else if (frame >= 70 && frame < 85) currentStatus = "Q1 Failed. Cascading to Q2...";
  else if (frame >= 85 && frame < 140) currentStatus = "Q2: Parsing HTML DOM link describedby... None found";
  else if (frame >= 140 && frame < 155) currentStatus = "Q2 Failed. Cascading to Q3...";
  else if (frame >= 155 && frame < 210) currentStatus = "Q3: Resolving external RFC 9264 linksets... None found";
  else if (frame >= 210 && frame < 225) currentStatus = "Q3 Failed. Cascading to Q4...";
  else if (frame >= 225 && frame < 270) currentStatus = "Q4: Scanning robots.txt & Domain Sitemap XML...";
  else if (frame >= 270) currentStatus = "✅ Q4 Success! Discovered sitemap entry with RDF link relation.";

  // Coordinates for pulse calculations
  // Path 1 (Q1 center to Q2 center): (219, 104) to (681, 104)
  const pulse1X = interpolate(frame, [70, 85], [219, 681], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse1Opacity = interpolate(frame, [70, 72, 83, 85], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Path 2 (Q2 center to Q3 center):
  // Segment A: (681, 104) to (681, 220)  - [140, 143]
  // Segment B: (681, 220) to (219, 220)  - [143, 152]
  // Segment C: (219, 220) to (219, 336)  - [152, 155]
  let pulse2X = 681;
  let pulse2Y = 104;
  if (frame >= 140 && frame <= 155) {
    const segment = interpolate(frame, [140, 155], [0, 1]);
    if (segment < 0.2) {
      pulse2Y = interpolate(segment, [0, 0.2], [104, 220]);
    } else if (segment < 0.8) {
      pulse2Y = 220;
      pulse2X = interpolate(segment, [0.2, 0.8], [681, 219]);
    } else {
      pulse2X = 219;
      pulse2Y = interpolate(segment, [0.8, 1], [220, 336]);
    }
  }
  const pulse2Opacity = interpolate(frame, [140, 142, 153, 155], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Path 3 (Q3 center to Q4 center): (219, 336) to (681, 336)
  const pulse3X = interpolate(frame, [210, 225], [219, 681], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse3Opacity = interpolate(frame, [210, 212, 223, 225], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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
        Cascading Discovery Pipeline
      </h2>
      <p
        style={{
          fontSize: "24px",
          color: "#4a5568",
          marginBottom: "50px",
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        WRX checks each discovery technique sequentially, fallback-routing automatically.
      </p>

      {/* 2x2 Matrix Container */}
      <div
        style={{
          width: "900px",
          height: "440px",
          position: "relative",
          marginBottom: "50px",
        }}
      >
        {/* SVG Circuit Lines behind quadrants */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {/* Path 1: Q1 -> Q2 */}
          <line x1="219" y1="104" x2="681" y2="104" stroke="#3d7a8d" strokeWidth="2.5" strokeDasharray="5,5" opacity="0.35" />
          
          {/* Path 2: Q2 -> Q3 */}
          <path d="M 681,104 L 681,220 L 219,220 L 219,336" stroke="#3d7a8d" strokeWidth="2.5" strokeDasharray="5,5" fill="none" opacity="0.35" />
          
          {/* Path 3: Q3 -> Q4 */}
          <line x1="219" y1="336" x2="681" y2="336" stroke="#3d7a8d" strokeWidth="2.5" strokeDasharray="5,5" opacity="0.35" />

          {/* Glowing Pulse Dot Q1 -> Q2 */}
          {frame >= 70 && frame <= 85 && (
            <circle cx={pulse1X} cy="104" r="9" fill="#64b5f6" opacity={pulse1Opacity} style={{ filter: "drop-shadow(0 0 8px #64b5f6)" }} />
          )}

          {/* Glowing Pulse Dot Q2 -> Q3 */}
          {frame >= 140 && frame <= 155 && (
            <circle cx={pulse2X} cy={pulse2Y} r="9" fill="#64b5f6" opacity={pulse2Opacity} style={{ filter: "drop-shadow(0 0 8px #64b5f6)" }} />
          )}

          {/* Glowing Pulse Dot Q3 -> Q4 */}
          {frame >= 210 && frame <= 225 && (
            <circle cx={pulse3X} cy="336" r="9" fill="#64b5f6" opacity={pulse3Opacity} style={{ filter: "drop-shadow(0 0 8px #64b5f6)" }} />
          )}
        </svg>

        {/* Quadrants Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            width: "100%",
            height: "100%",
            position: "relative",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {/* Q1: Resource-Direct */}
          <div
            style={{
              borderRadius: "20px",
              borderWidth: "2.5px",
              borderStyle: "solid",
              padding: "30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              ...getQuadStyle(getQuadState(1, frame)),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Q1: Resource-Direct</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              Content negotiation, Link header
            </div>
            {getQuadState(1, frame) === "failed" && (
              <div style={{ fontSize: "16px", color: "#ef4444", fontWeight: 800, marginTop: "14px" }}>✖ Failed (HTTP 406 / HTML only)</div>
            )}
          </div>

          {/* Q2: Resource-Inferred */}
          <div
            style={{
              borderRadius: "20px",
              borderWidth: "2.5px",
              borderStyle: "solid",
              padding: "30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              ...getQuadStyle(getQuadState(2, frame)),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Q2: Resource-Inferred</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              HTML signpost link, script tag
            </div>
            {getQuadState(2, frame) === "failed" && (
              <div style={{ fontSize: "16px", color: "#ef4444", fontWeight: 800, marginTop: "14px" }}>✖ Failed (No RDF link tags found)</div>
            )}
          </div>

          {/* Q3: Domain-Direct */}
          <div
            style={{
              borderRadius: "20px",
              borderWidth: "2.5px",
              borderStyle: "solid",
              padding: "30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              ...getQuadStyle(getQuadState(3, frame)),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Q3: Domain-Direct</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              Linksets RFC 9264, DCAT Catalogs
            </div>
            {getQuadState(3, frame) === "failed" && (
              <div style={{ fontSize: "16px", color: "#ef4444", fontWeight: 800, marginTop: "14px" }}>✖ Failed (No external linksets host)</div>
            )}
          </div>

          {/* Q4: Domain-Inferred */}
          <div
            style={{
              borderRadius: "20px",
              borderWidth: "2.5px",
              borderStyle: "solid",
              padding: "30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              ...getQuadStyle(getQuadState(4, frame)),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Q4: Domain-Inferred</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              robots.txt, Sitemap indices
            </div>
            {getQuadState(4, frame) === "success" && (
              <div style={{ fontSize: "16px", color: "#22c55e", fontWeight: 800, marginTop: "14px" }}>✔ Success (Metadata discovered!)</div>
            )}
          </div>
        </div>
      </div>

      {/* Progress status bar */}
      <div
        className="font-mono text-accent-light"
        style={{
          width: "900px",
          padding: "18px 24px",
          backgroundColor: "#1a3b4c",
          borderRadius: "12px",
          color: "#64b5f6",
          fontSize: "20px",
          fontWeight: 500,
          textAlign: "center",
          border: "1px solid rgba(61,122,141,0.2)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {currentStatus}
      </div>
    </AbsoluteFill>
  );
};
