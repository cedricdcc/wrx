import { AbsoluteFill, Sequence } from "remotion";
import { BackgroundGrid } from "./components/BackgroundGrid";
import { SceneIntro } from "./components/SceneIntro";
import { SceneProblem } from "./components/SceneProblem";
import { SceneCascade } from "./components/SceneCascade";
import { SceneGraph } from "./components/SceneGraph";
import { SceneOutro } from "./components/SceneOutro";

export const WRXVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#f8fafc" }}>
      {/* Background is persistent across the whole video */}
      <BackgroundGrid />

      {/* Scene 1: Intro (0s - 4s / frames 0 - 120) */}
      <Sequence from={0} durationInFrames={120}>
        <SceneIntro />
      </Sequence>

      {/* Scene 2: The Problem (4s - 17.5s / frames 120 - 525) */}
      <Sequence from={120} durationInFrames={405}>
        <SceneProblem />
      </Sequence>

      {/* Scene 3: The Cascade Matrix (17.5s - 29.5s / frames 525 - 885) */}
      <Sequence from={525} durationInFrames={360}>
        <SceneCascade />
      </Sequence>

      {/* Scene 4: Knowledge Graph (29.5s - 39.5s / frames 885 - 1185) */}
      <Sequence from={885} durationInFrames={300}>
        <SceneGraph />
      </Sequence>

      {/* Scene 5: Outro & Code (39.5s - 45.5s / frames 1185 - 1365) */}
      <Sequence from={1185} durationInFrames={180}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
