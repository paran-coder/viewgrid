import { describe, expect, it } from "vitest";

import { getCameraQuality, getParameterQuality } from "@/lib/quality";
import type { CameraConfig } from "@/types/camera";

const camera: CameraConfig = {
  id: 1,
  label: "C1",
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 50,
  distance: 1,
  active: true,
};

describe("camera quality", () => {
  it("classifies stable, caution and experimental yaw ranges", () => {
    expect(getParameterQuality("yaw", 25)).toBe("stable");
    expect(getParameterQuality("yaw", -26)).toBe("caution");
    expect(getParameterQuality("yaw", 46)).toBe("caution");
    expect(getParameterQuality("yaw", 81)).toBe("experimental");
  });

  it("uses the riskiest parameter as the camera quality", () => {
    expect(getCameraQuality({ ...camera, pitch: 12 }).level).toBe("caution");
    expect(getCameraQuality({ ...camera, fov: 90 }).level).toBe("experimental");
  });
});
