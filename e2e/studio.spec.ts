import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
  "base64",
);

test("upload to camera edit to virtual result flow", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /카메라를 배치하고/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "멀티앵글 카메라 스튜디오" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "로컬 카메라 가이드" }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: /API에 사용/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("heading", { name: "멀티뷰 일관성" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /C1 카메라 선택/ }).click();
  await page.getByLabel("좌우 각도 숫자 입력").fill("42");
  await expect(page.getByText("주의", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /안전한 9뷰/ }).click();
  await page.getByRole("button", { name: /가상 미리보기/ }).click();

  await expect(
    page.getByRole("heading", { name: "멀티앵글 생성 결과" }),
  ).toBeVisible();
  await expect(page.getByText("가상 미리보기").first()).toBeVisible({
    timeout: 8_000,
  });
  await expect(page.getByAltText("C9 가상 결과")).toBeVisible();
});

test("connects a user key and generates one mocked API result", async ({
  page,
}) => {
  await page.route("**/api/connection", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        message: "API 키와 모델 연결을 확인했습니다.",
      }),
    });
  });
  let singleRequestBody = "";
  await page.route("**/api/generate", async (route) => {
    singleRequestBody = route.request().postData() ?? "";
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: {
        "X-ViewGrid-Duration-Ms": "880",
        "X-ViewGrid-Guide-Used": "true",
      },
      body: onePixelPng,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
  await page.getByRole("button", { name: "API 설정" }).first().click();
  await page.getByRole("radio", { name: /OpenAI/ }).click();
  await page.getByPlaceholder("sk-...").fill("playwright-test-key");
  await page.getByRole("button", { name: "연결 확인" }).click();
  await expect(
    page.getByText("API 키와 모델 연결을 확인했습니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await page.getByRole("button", { name: /C5 한 장 생성/ }).click();
  await expect(
    page.getByRole("heading", { name: "멀티앵글 생성 결과" }),
  ).toBeVisible();
  await expect(page.getByAltText("C5 실제 생성 결과")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("API", { exact: true })).toBeVisible();
  expect(singleRequestBody).toContain('name="guide"');
  expect(singleRequestBody).toContain("Image 2 is a rough virtual-camera");
});

test("generates an active nine-camera queue and enables sheet exports", async ({
  page,
}) => {
  let generationRequests = 0;
  let neighboringReferenceRequests = 0;
  await page.route("**/api/connection", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/generate", async (route) => {
    generationRequests += 1;
    const usesReference = (route.request().postData() ?? "").includes(
      'name="reference"',
    );
    if (usesReference) neighboringReferenceRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: {
        "X-ViewGrid-Duration-Ms": "100",
        "X-ViewGrid-Guide-Used": "true",
        "X-ViewGrid-Reference-Used": usesReference ? "true" : "false",
      },
      body: onePixelPng,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
  await page.getByRole("button", { name: "API 설정" }).first().click();
  await page.getByRole("radio", { name: /OpenAI/ }).click();
  await page.getByPlaceholder("sk-...").fill("playwright-batch-key");
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await page.getByRole("button", { name: "활성 9개 실제 생성" }).click();
  await expect(
    page.getByRole("heading", { name: "멀티앵글 생성 결과" }),
  ).toBeVisible();
  await expect(
    page.getByText("현재 설정과 일치 9/9개 · 보관 결과 9개"),
  ).toBeVisible({
    timeout: 30_000,
  });
  expect(generationRequests).toBe(9);
  expect(neighboringReferenceRequests).toBe(8);
  await expect(page.getByRole("button", { name: "3×3 PNG" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "결과 ZIP" })).toBeEnabled();

  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "결과 ZIP" }).click();
  await expect((await zipDownload).suggestedFilename()).toMatch(/\.zip$/);
});

test("can disable the guide for source-only A/B generation", async ({
  page,
}) => {
  let requestBody = "";
  await page.route("**/api/generate", async (route) => {
    requestBody = route.request().postData() ?? "";
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "X-ViewGrid-Guide-Used": "false" },
      body: onePixelPng,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
  await page.getByRole("switch", { name: /API에 사용/ }).click();
  await expect(
    page.getByRole("switch", { name: /API에 미사용/ }),
  ).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "API 설정" }).first().click();
  await page.getByRole("radio", { name: /OpenAI/ }).click();
  await page.getByPlaceholder("sk-...").fill("playwright-source-only");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: /C5 한 장 생성/ }).click();
  await expect(page.getByAltText("C5 실제 생성 결과")).toBeVisible({
    timeout: 15_000,
  });
  expect(requestBody).not.toContain('name="guide"');
  expect(requestBody).not.toContain("Image 2 is a rough virtual-camera");
});

test("has no serious accessibility violations in primary screens", async ({
  page,
}) => {
  await page.goto("/");
  let results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);

  await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);

  await page.getByRole("button", { name: "API 설정" }).first().click();
  results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test.describe("responsive layout", () => {
  for (const viewport of [
    { name: "mobile", width: 360, height: 800 },
    { name: "tablet", width: 768, height: 900 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    test(`${viewport.name} editor is usable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.getByRole("button", { name: "데모 이미지로 시작" }).click();
      await expect(
        page.getByRole("heading", { name: "멀티앵글 카메라 스튜디오" }),
      ).toBeVisible();
      await expect(
        page.getByRole("complementary", { name: "카메라 설정" }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/viewgrid-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
