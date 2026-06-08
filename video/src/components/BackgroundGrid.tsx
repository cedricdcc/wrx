import { AbsoluteFill } from "remotion";

export const BackgroundGrid: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage: `
          linear-gradient(to right, rgba(26, 59, 76, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(26, 59, 76, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }}
    />
  );
};
