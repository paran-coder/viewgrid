import { clamp } from "@/lib/utils";

export type OrbitLayoutInput = {
  stageWidth: number;
  stageHeight: number;
  imageWidth: number;
  imageHeight: number;
};

export type OrbitLayout = {
  imageWidth: number;
  imageHeight: number;
  orbitWidth: number;
  orbitHeight: number;
};

/**
 * Calculates a centered source-image plane and an orbit viewport that wraps
 * the actually rendered image rather than the entire editor stage.
 */
export function calculateOrbitLayout(input: OrbitLayoutInput): OrbitLayout {
  const stageWidth = Math.max(1, input.stageWidth);
  const stageHeight = Math.max(1, input.stageHeight);
  const sourceWidth = Math.max(1, input.imageWidth);
  const sourceHeight = Math.max(1, input.imageHeight);
  const sourceAspect = sourceWidth / sourceHeight;

  const maxImageWidth = stageWidth * (sourceAspect >= 1 ? 0.46 : 0.3);
  const maxImageHeight = stageHeight * 0.66;
  const fitScale = Math.min(maxImageWidth / sourceWidth, maxImageHeight / sourceHeight);
  const imageWidth = sourceWidth * fitScale;
  const imageHeight = sourceHeight * fitScale;

  const orbitWidth = clamp(
    Math.max(imageWidth * 2.65, imageHeight * 1.65),
    stageWidth * 0.78,
    stageWidth * 0.96,
  );
  const orbitHeight = clamp(
    Math.max(imageHeight * 1.78, imageWidth * 1.15),
    stageHeight * 0.72,
    stageHeight * 0.94,
  );

  return {
    imageWidth: Math.round(imageWidth),
    imageHeight: Math.round(imageHeight),
    orbitWidth: Math.round(orbitWidth),
    orbitHeight: Math.round(orbitHeight),
  };
}
