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

      {/* Scene 2: The Problem (4s - 16s / frames 120 - 480) */}
      <Sequence from={120} durationInFrames={360}>
        <SceneProblem />
      </Sequence>

      {/* Scene 3: The Cascade Matrix (16s - 28s / frames 480 - 840) */}
      <Sequence from={480} durationInFrames={360}>
        <SceneCascade />
      </Sequence>

      {/* Scene 4: Knowledge Graph (28s - 38s / frames 840 - 1140) */}
      <Sequence from={840} durationInFrames={300}>
        <SceneGraph />
      </Sequence>

      {/* Scene 5: Outro & Code (38s - 44s / frames 1140 - 1320) */}
      <Sequence from={1140} durationInFrames={180}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
