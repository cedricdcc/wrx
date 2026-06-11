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
  // Stage 1 active: 15-110. Fail at 110
  // Cascade Stage 1 -> Stage 2: 110-135
  // Stage 2 active: 135-230. Success at 230
  // Cascade Stage 2 -> Stage 3: 230-255
  // Stage 3 active: 255-330. Success at 330

  const getStageState = (stageNum: number, currentFrame: number): "pending" | "active" | "failed" | "success" => {
    if (stageNum === 1) {
      if (currentFrame < 15) return "pending";
      if (currentFrame < 110) return "active";
      return "failed";
    }
    if (stageNum === 2) {
      if (currentFrame < 110) return "pending";
      if (currentFrame < 230) return "active";
      return "success";
    }
    if (stageNum === 3) {
      if (currentFrame < 230) return "pending";
      if (currentFrame < 330) return "active";
      return "success";
    }
    return "pending";
  };

  const getStageStyle = (state: "pending" | "active" | "failed" | "success", stageNum: number) => {
    const activeColor = stageNum === 1 ? "#3d7a8d" : stageNum === 2 ? "#3b82f6" : "#10b981";
    const successBg = stageNum === 1 ? "rgba(61, 122, 141, 0.08)" : stageNum === 2 ? "rgba(59, 130, 246, 0.08)" : "rgba(16, 185, 129, 0.08)";
    const successColor = stageNum === 1 ? "#1a3b4c" : stageNum === 2 ? "#1e3a8a" : "#065f46";

    switch (state) {
      case "active":
        return {
          backgroundColor: stageNum === 1 ? "rgba(61, 122, 141, 0.12)" : stageNum === 2 ? "rgba(59, 130, 246, 0.12)" : "rgba(16, 185, 129, 0.12)",
          borderColor: activeColor,
          color: "#1a3b4c",
          transform: "scale(1.03)",
          boxShadow: `0 15px 35px ${stageNum === 1 ? "rgba(61,122,141,0.12)" : stageNum === 2 ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)"}`,
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
          backgroundColor: successBg,
          borderColor: activeColor,
          color: successColor,
          transform: "scale(1.05)",
          boxShadow: `0 20px 40px ${stageNum === 1 ? "rgba(61,122,141,0.12)" : stageNum === 2 ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)"}`,
        };
      case "pending":
      default:
        return {
          backgroundColor: "#ffffff",
          borderColor: "rgba(26, 59, 76, 0.1)",
          color: "rgba(26, 59, 76, 0.5)",
          transform: "scale(1)",
        };
    }
  };

  // Status message
  let currentStatus = "Initializing cascade pipeline...";
  if (frame >= 15 && frame < 110) {
    currentStatus = "Stage 1: Probing Direct RDF (Conneg, Link headers & Linksets)... HTTP 406";
  } else if (frame >= 110 && frame < 135) {
    currentStatus = "Stage 1 Direct RDF failed. Cascading to Stage 2...";
  } else if (frame >= 135 && frame < 230) {
    currentStatus = "Stage 2: Probing Semantic Uplifting (Embedded Scripts, Microdata, RDFa, Sitemaps)... Success!";
  } else if (frame >= 230 && frame < 255) {
    currentStatus = "Uplifted triples resolved. Cascading to Stage 3 for graph reasoning...";
  } else if (frame >= 255 && frame < 330) {
    currentStatus = "Stage 3: Running Inferred & Reasoned (sameAs, SKOS hierarchies, logical inference)...";
  } else if (frame >= 330) {
    currentStatus = "✅ Stage 3 Success! Logical reasoning fully resolved transitive RDF structure.";
  }

  // Coordinates for pulse calculations (X coords for 3 columns: 150, 450, 750)
  // Y coord is 150 (vertical center of the 300px high box)
  const pulse1X = interpolate(frame, [110, 135], [150, 450], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse1Opacity = interpolate(frame, [110, 112, 133, 135], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pulse2X = interpolate(frame, [230, 255], [450, 750], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse2Opacity = interpolate(frame, [230, 232, 253, 255], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

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

      {/* 3 Columns Container */}
      <div
        style={{
          width: "900px",
          height: "300px",
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
          {/* Path 1: Stage 1 -> Stage 2 */}
          <line x1="150" y1="150" x2="450" y2="150" stroke="#3d7a8d" strokeWidth="2.5" strokeDasharray="5,5" opacity="0.35" />

          {/* Path 2: Stage 2 -> Stage 3 */}
          <line x1="450" y1="150" x2="750" y2="150" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,5" opacity="0.35" />

          {/* Glowing Pulse Dot Stage 1 -> Stage 2 */}
          {frame >= 110 && frame <= 135 && (
            <circle cx={pulse1X} cy="150" r="9" fill="#3b82f6" opacity={pulse1Opacity} style={{ filter: "drop-shadow(0 0 8px #3b82f6)" }} />
          )}

          {/* Glowing Pulse Dot Stage 2 -> Stage 3 */}
          {frame >= 230 && frame <= 255 && (
            <circle cx={pulse2X} cy="150" r="9" fill="#10b981" opacity={pulse2Opacity} style={{ filter: "drop-shadow(0 0 8px #10b981)" }} />
          )}
        </svg>

        {/* Stages Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
            width: "100%",
            height: "100%",
            position: "relative",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {/* Stage 1: Direct RDF */}
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
              ...getStageStyle(getStageState(1, frame), 1),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Stage 1: Direct RDF</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              Content negotiation, HTTP Link headers & Linksets
            </div>
            {getStageState(1, frame) === "failed" && (
              <div style={{ fontSize: "16px", color: "#ef4444", fontWeight: 800, marginTop: "14px" }}>✖ Failed (HTTP 406 / HTML only)</div>
            )}
          </div>

          {/* Stage 2: Semantic Uplifting */}
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
              ...getStageStyle(getStageState(2, frame), 2),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Stage 2: Uplifting</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              Embedded scripts, Microdata, RDFa & Sitemaps
            </div>
            {getStageState(2, frame) === "success" && (
              <div style={{ fontSize: "16px", color: "#3b82f6", fontWeight: 800, marginTop: "14px" }}>✔ Mapped Base Triples</div>
            )}
          </div>

          {/* Stage 3: Inferred & Reasoned */}
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
              ...getStageStyle(getStageState(3, frame), 3),
            }}
          >
            <div style={{ fontSize: "28px", fontWeight: 900 }}>Stage 3: Reasoned</div>
            <div style={{ fontSize: "17px", marginTop: "10px", opacity: 0.85 }} className="font-mono">
              sameAs equivalence, SKOS hierarchies & logical inference
            </div>
            {getStageState(3, frame) === "success" && (
              <div style={{ fontSize: "16px", color: "#10b981", fontWeight: 800, marginTop: "14px" }}>✔ Graph Resolved!</div>
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
