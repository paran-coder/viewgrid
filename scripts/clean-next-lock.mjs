import { rm } from "node:fs/promises";

await rm(".next/lock", { force: true });
