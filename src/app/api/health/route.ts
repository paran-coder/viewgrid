import { NextResponse } from "next/server";

import { noStoreApiHeaders, createRequestId } from "@/lib/request-security";
import { MODEL_DEFINITIONS } from "@/lib/providers/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "viewgrid",
      version: process.env.npm_package_version ?? "1.0.0",
      providers: [...new Set(MODEL_DEFINITIONS.map((model) => model.provider))],
      models: MODEL_DEFINITIONS.map((model) => model.id),
      timestamp: new Date().toISOString(),
    },
    { headers: noStoreApiHeaders(createRequestId()) },
  );
}
