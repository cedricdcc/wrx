import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const SceneOutro: React.FC = () => {
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

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15 },
  });

  const codeOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const codeTranslateY = interpolate(frame, [25, 50], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const linkOpacity = interpolate(frame, [50, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        opacity: sceneOpacity,
        transform: `scale(${sceneScale})`,
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: "64px",
          fontWeight: 900,
          color: "#1a3b4c",
          letterSpacing: "-0.04em",
          marginBottom: "50px",
          textAlign: "center",
        }}
      >
        Improved <span style={{ color: "#3d7a8d" }}>Explorability.</span>
      </div>

      {/* Code Snippet Container */}
      <div
        style={{
          opacity: codeOpacity,
          transform: `translateY(${codeTranslateY}px)`,
          width: "800px",
          backgroundColor: "#1a3b4c",
          borderRadius: "20px",
          padding: "35px",
          boxShadow: "0 20px 40px rgba(26,59,76,0.15)",
          border: "1px solid rgba(61,122,141,0.2)",
          marginBottom: "40px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", marginBottom: "25px", opacity: 0.5 }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ff5f56" }} />
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#27c93f" }} />
        </div>
        <pre
          className="font-mono"
          style={{
            margin: 0,
            fontSize: "26px",
            color: "#bfdbfe",
            lineHeight: 1.5,
          }}
        >
          <div>
            <span style={{ color: "#64b5f6" }}>import</span> {"{"} extractRDF {"}"} <span style={{ color: "#64b5f6" }}>from</span> <span style={{ color: "#a5f3fc" }}>"wrx"</span>;
          </div>
          <div style={{ marginTop: "10px" }}>
            <span style={{ color: "#64b5f6" }}>const</span> res = <span style={{ color: "#64b5f6" }}>await</span> extractRDF(url);
          </div>
        </pre>
      </div>

      <div
        style={{
          opacity: linkOpacity,
          fontSize: "28px",
          fontWeight: 700,
          color: "#3d7a8d",
          letterSpacing: "-0.01em",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        Get started by clicking the <span style={{ color: "#3d7a8d" }}>Sandbox button</span> below.
      </div>
    </AbsoluteFill>
  );
};
