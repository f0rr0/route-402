import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { db } from "@/lib/db";
import {
  facilitatorCapabilities,
  facilitatorConnections,
} from "@/lib/db/schema";
import type { SupportedResponse } from "@/lib/facilitators/types";

export const runtime = "nodejs";

type SchemeAggregate = Map<string, Set<string>>;

function aggregateSupported(
  rows: Array<{ supportedJson: SupportedResponse | null }>
): SupportedResponse {
  const schemes: SchemeAggregate = new Map();

  for (const row of rows) {
    const supported = row.supportedJson;
    if (!supported?.schemes) {
      continue;
    }

    for (const entry of supported.schemes) {
      if (!schemes.has(entry.scheme)) {
        schemes.set(entry.scheme, new Set<string>());
      }
      const target = schemes.get(entry.scheme);
      for (const network of entry.networks ?? []) {
        target?.add(network);
      }
    }
  }

  return {
    schemes: Array.from(schemes.entries())
      .map(([scheme, networks]) => ({
        scheme,
        networks: Array.from(networks).sort(),
      }))
      .sort((a, b) => a.scheme.localeCompare(b.scheme)),
  };
}

export async function GET(request: Request) {
  const apiKey = await authenticateApiKey(request.headers);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const rows = await db
    .select({
      supportedJson: facilitatorCapabilities.supportedJson,
    })
    .from(facilitatorConnections)
    .leftJoin(
      facilitatorCapabilities,
      eq(facilitatorCapabilities.connectionId, facilitatorConnections.id)
    )
    .where(
      and(
        eq(facilitatorConnections.projectId, apiKey.projectId),
        eq(facilitatorConnections.enabled, true),
        eq(facilitatorCapabilities.status, "ok")
      )
    );

  const supported = aggregateSupported(
    rows.map((row) => ({
      supportedJson: row.supportedJson as SupportedResponse | null,
    }))
  );

  return NextResponse.json(supported, { status: 200 });
}
