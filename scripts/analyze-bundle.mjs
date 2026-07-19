import { gzipSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CHUNKS = path.join(ROOT, ".next", "static", "chunks");
const REPORT = path.join(ROOT, "docs", "BUNDLE_REPORT.md");
const TOTAL_GZIP_BUDGET = 950 * 1024;
const LARGEST_GZIP_BUDGET = 320 * 1024;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
  }
  return files;
}

const files = await walk(CHUNKS);
const rows = [];
for (const file of files) {
  const contents = await readFile(file);
  const info = await stat(file);
  rows.push({
    file: path.relative(CHUNKS, file),
    raw: info.size,
    gzip: gzipSync(contents).byteLength,
  });
}
rows.sort((a, b) => b.gzip - a.gzip);

const totalRaw = rows.reduce((sum, row) => sum + row.raw, 0);
const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
const largest = rows[0]?.gzip ?? 0;
const kb = (value) => `${(value / 1024).toFixed(1)} KB`;
const status =
  totalGzip <= TOTAL_GZIP_BUDGET && largest <= LARGEST_GZIP_BUDGET
    ? "통과"
    : "예산 초과";

const markdown = `# ViewGrid 번들 보고서

> 자동 생성: ${new Date().toISOString()}  
> 상태: **${status}**

## 요약

- JavaScript 청크: ${rows.length}개
- 전체 원본 크기: ${kb(totalRaw)}
- 전체 gzip 추정: ${kb(totalGzip)} / 예산 ${kb(TOTAL_GZIP_BUDGET)}
- 최대 단일 gzip 청크: ${kb(largest)} / 예산 ${kb(LARGEST_GZIP_BUDGET)}

## 큰 청크 상위 15개

| 파일 | 원본 | gzip 추정 |
|---|---:|---:|
${rows
  .slice(0, 15)
  .map((row) => `| \`${row.file}\` | ${kb(row.raw)} | ${kb(row.gzip)} |`)
  .join("\n")}

## 해석

이 수치는 빌드 산출물 전체 청크의 단순 합계이며, 한 사용자가 첫 화면에서 모두 내려받는 전송량과 동일하지 않습니다. 실제 초기 로드 평가는 Lighthouse와 브라우저 네트워크 패널을 함께 사용합니다.
`;

await writeFile(REPORT, markdown);
console.log(
  JSON.stringify(
    {
      status,
      chunks: rows.length,
      totalRaw,
      totalGzip,
      largestGzip: largest,
      report: path.relative(ROOT, REPORT),
    },
    null,
    2,
  ),
);

if (status !== "통과") process.exitCode = 1;
