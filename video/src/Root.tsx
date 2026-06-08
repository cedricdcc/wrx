import "./index.css";
import { Composition } from "remotion";
import { WRXVideo } from "./WRXVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WRXVideo"
        component={WRXVideo}
        durationInFrames={1320}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
