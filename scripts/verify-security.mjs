import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const requiredFiles = [
  "SECURITY.md",
  "PRIVACY.md",
  "docs/DEPLOYMENT.md",
  "docs/OPERATIONS.md",
  "src/app/manifest.ts",
  "public/sw.js",
  "src/lib/security-headers.ts",
  "src/lib/request-security.ts",
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (
      entry.isFile() &&
      /\.(?:ts|tsx|js|mjs)$/.test(entry.name) &&
      !/\.(?:test|spec)\./.test(entry.name)
    ) {
      files.push(target);
    }
  }
  return files;
}

const missing = [];
for (const file of requiredFiles) {
  try {
    await readFile(path.join(ROOT, file));
  } catch {
    missing.push(file);
  }
}

const sourceFiles = [
  ...(await walk(path.join(ROOT, "src"))),
  ...(await walk(path.join(ROOT, "public"))),
  path.join(ROOT, "next.config.ts"),
];

const findings = [];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(ROOT, file);
  if (/sk-[A-Za-z0-9_-]{24,}/.test(source)) {
    findings.push(`${relative}: OpenAI 형식의 고정 키 패턴`);
  }
  if (/AIza[A-Za-z0-9_-]{30,}/.test(source)) {
    findings.push(`${relative}: Google 형식의 고정 키 패턴`);
  }
  if (
    /localStorage[\s\S]{0,100}apiKey|apiKey[\s\S]{0,100}localStorage/i.test(
      source,
    )
  ) {
    findings.push(`${relative}: API 키 localStorage 저장 가능성`);
  }
  if (
    /console\.(?:log|debug)\([^\n]*(?:apiKey|imageValue|guideValue|referenceValue)/i.test(
      source,
    )
  ) {
    findings.push(`${relative}: 민감 요청 데이터 로그 가능성`);
  }
}

const securitySource = await readFile(
  path.join(ROOT, "src/lib/security-headers.ts"),
  "utf8",
);
for (const directive of [
  "Content-Security-Policy",
  "frame-ancestors 'none'",
  "Strict-Transport-Security",
  "Permissions-Policy",
  "Referrer-Policy",
]) {
  if (!securitySource.includes(directive)) {
    findings.push(`security-headers.ts: ${directive} 누락`);
  }
}

const serviceWorker = await readFile(path.join(ROOT, "public/sw.js"), "utf8");
if (!serviceWorker.includes('url.pathname.startsWith("/api/")')) {
  findings.push("sw.js: API 캐시 제외 규칙 누락");
}

if (missing.length || findings.length) {
  console.error(JSON.stringify({ missing, findings }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "pass",
      checkedFiles: sourceFiles.length,
      requiredArtifacts: requiredFiles.length,
      secretPatterns: 0,
    },
    null,
    2,
  ),
);
