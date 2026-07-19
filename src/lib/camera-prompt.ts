import { inferBackside } from "@/lib/orbit-projection";
import type { CameraConfig } from "@/types/camera";

type CameraPromptOptions = {
  hasGuide?: boolean;
  hasReference?: boolean;
  referenceCameraLabel?: string;
};

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function describeYaw(yaw: number) {
  const amount = Math.abs(yaw);
  if (amount < 3) return "a centered frontal viewpoint";

  const visibleSide =
    yaw > 0 ? "the subject's right side" : "the subject's left side";
  if (amount <= 20) {
    return `a subtle three-quarter shift, rotated ${formatNumber(amount)} degrees from front so ${visibleSide} is slightly more visible`;
  }
  if (amount <= 45) {
    return `a clear three-quarter view, rotated ${formatNumber(amount)} degrees from front so ${visibleSide} becomes more visible`;
  }
  if (amount <= 90) {
    return `a strong side-oriented view, rotated ${formatNumber(amount)} degrees from front with ${visibleSide} dominating`;
  }
  if (amount <= 140) {
    return `a rear-biased view, rotated ${formatNumber(amount)} degrees from front with the back and ${visibleSide} carrying most of the composition`;
  }
  return `an almost direct back view, rotated ${formatNumber(amount)} degrees from front so the rear of the subject is dominant`;
}

export function describePitch(pitch: number) {
  const amount = Math.abs(pitch);
  if (amount < 3) return "camera at the subject's eye level";
  return pitch > 0
    ? `camera elevated ${formatNumber(amount)} degrees, looking down at the subject`
    : `camera lowered ${formatNumber(amount)} degrees, looking up at the subject`;
}

export function describeFov(fov: number) {
  if (fov <= 30)
    return `${fov}-degree telephoto field of view with compressed perspective`;
  if (fov <= 45)
    return `${fov}-degree short-telephoto field of view with minimal distortion`;
  if (fov <= 60) return `${fov}-degree natural standard-lens field of view`;
  if (fov <= 75)
    return `${fov}-degree wide-angle field of view with restrained subject distortion`;
  return `${fov}-degree strong wide-angle field of view`;
}

export function describeDistance(distance: number) {
  if (distance < 0.8)
    return "close camera distance with the subject filling most of the frame";
  if (distance <= 1.15)
    return "camera distance and subject scale close to the source image";
  if (distance <= 1.5)
    return "slightly increased camera distance with comfortable negative space";
  return "distant camera placement showing the complete subject with generous negative space";
}

export function buildCameraPrompt(
  camera: CameraConfig,
  options: CameraPromptOptions = {},
) {
  const backside = inferBackside(camera);
  const rollInstruction =
    Math.abs(camera.roll) < 2
      ? "Keep the horizon level."
      : `Tilt the camera ${Math.abs(camera.roll)} degrees ${camera.roll > 0 ? "clockwise" : "counterclockwise"}.`;
  const hasGuide = Boolean(options.hasGuide);
  const hasReference = Boolean(options.hasReference);
  const guideIndex = 2;
  const referenceIndex = hasGuide ? 3 : 2;

  return [
    "Image 1 is the exact identity and appearance reference for the subject.",
    ...(hasGuide
      ? [
          `Image ${guideIndex} is a rough virtual-camera composition guide. Use it only for camera direction, subject placement, scale, field of view, and framing.`,
          `Do not copy Image ${guideIndex}'s frame edges, blur, stretched pixels, strip seams, soft background, empty regions, or perspective-warp artifacts.`,
        ]
      : []),
    ...(hasReference
      ? [
          `Image ${referenceIndex} is a previously approved neighboring view${options.referenceCameraLabel ? ` (${options.referenceCameraLabel})` : ""}. Use it to keep the subject's structure, materials, lighting, color balance, background, and design details consistent across the multi-view set.`,
          `Do not copy Image ${referenceIndex}'s camera angle. Follow the camera specification below for the new viewpoint.`,
        ]
      : []),
    "Create one photorealistic product-style image from the requested virtual camera viewpoint.",
    "Rebuild the final image cleanly from Image 1 while using the other images only for their assigned roles.",
    backside
      ? "Because this view reveals rear or hidden surfaces, infer the unseen back-side areas plausibly while keeping the same subject identity, silhouette, materials, and construction logic."
      : "Only reconstruct the newly exposed surfaces needed for this camera shift.",
    "",
    "Camera specification:",
    `- ${describeYaw(camera.yaw)}.`,
    `- ${describePitch(camera.pitch)}.`,
    `- ${describeFov(camera.fov)}.`,
    `- ${describeDistance(camera.distance)}.`,
    `- ${rollInstruction}`,
    "- Aim the camera precisely at the visual center of the subject.",
    "",
    "Multi-view consistency requirements:",
    "- Preserve the same subject identity, silhouette, proportions, materials, color palette, lighting direction, background treatment, and product scale used in the provided references.",
    "- Keep logos, text, controls, seams, connectors, buttons, and small structural details in stable positions.",
    "- Do not add decorations, parts, labels, text, logos, props, or extra subjects.",
    "- Do not redesign or reinterpret the product.",
    backside
      ? "- When the rear is not visible in the source, construct a plausible back view that feels physically continuous with the front and neighboring views."
      : "- Reconstruct only the limited newly exposed side areas required by this camera shift.",
    "- Keep the original aspect ratio and return only the image without borders, captions, or watermarks added by the composition.",
  ].join("\n");
}
