import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Draw offset: 500 to 0 over 45 frames
  const strokeOffset = interpolate(frame, [0, 45], [500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // Solid text fill fade-in after stroke completes
  const fillOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slogan slide and fade-in
  const sloganOpacity = interpolate(frame, [35, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sloganTranslateY = interpolate(frame, [35, 65], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Teal dot animations
  const dotOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  // Continuous glowing scale pulse
  const dotScale = interpolate(
    Math.sin((frame - 50) / 4), 
    [-1, 1], 
    [0.9, 1.25]
  );

  // Transition out: frames 105 to 120 (scale down and fade out)
  const sceneScale = interpolate(frame, [105, 120], [1, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const sceneOpacity = interpolate(frame, [105, 120], [1, 0], {
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
      }}
    >
      {/* SVG Container for the drawn Logo */}
      <div style={{ height: "240px", overflow: "visible" }}>
        <svg width="600" height="240" viewBox="0 0 600 240" style={{ overflow: "visible" }}>
          {/* Outlined and filled text */}
          <text
            x="20"
            y="185"
            fontSize="200"
            fontWeight="900"
            fill="#1a3b4c"
            fillOpacity={fillOpacity}
            stroke="#1a3b4c"
            strokeWidth="3.5"
            strokeDasharray="600"
            strokeDashoffset={strokeOffset}
            fontFamily="Inter, sans-serif"
            letterSpacing="-0.05em"
          >
            WRX
          </text>
          
          {/* Glowing teal dot */}
          <circle
            cx="520"
            cy="165"
            r="20"
            fill="#3d7a8d"
            opacity={dotOpacity}
            transform={`translate(520, 165) scale(${dotScale}) translate(-520, -165)`}
            style={{
              filter: "drop-shadow(0 0 16px rgba(61,122,141,0.6))",
            }}
          />
        </svg>
      </div>

      {/* Slogan */}
      <div
        style={{
          opacity: sloganOpacity,
          transform: `translateY(${sloganTranslateY}px)`,
          fontSize: "40px",
          fontWeight: 700,
          color: "#3d7a8d",
          marginTop: "40px",
          fontFamily: "Inter, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        because findability <span style={{ color: "#1a3b4c" }}>does not equal discoverability</span>
      </div>
    </AbsoluteFill>
  );
};
