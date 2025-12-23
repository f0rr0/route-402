import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { decryptCredentials } from "@/lib/crypto/credentials";
import type { EncryptedPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { routingDecisions, settlementState, facilitatorConnections } from "@/lib/db/schema";
import { getAdapter } from "@/lib/facilitators";
import { buildRoutingContext } from "@/lib/routing/context";
import { evaluateRuleset } from "@/lib/routing/eval";
import { loadActiveRuleset, loadEligibleConnections } from "@/lib/routing/selection";
import type { SettleResNormalized } from "@/lib/types/x402";
import { settleRequestSchema } from "@/lib/types/x402-schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

function stripRawProvider<T extends { rawProvider?: unknown }>(value: T) {
  const { rawProvider: _rawProvider, ...safe } = value;
  return safe;
}

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  const serialized = entries.map(
    ([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`
  );
  return `{${serialized.join(",")}}`;
}

function fingerprintFor(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

async function logDecision(params: {
  projectId: string;
  requestId: string;
  connectionId?: string | null;
  ruleName?: string | null;
  latencyMs: number;
  ok: boolean;
  errorCode?: string | null;
  fingerprint?: string | null;
}) {
  await db.insert(routingDecisions).values({
    projectId: params.projectId,
    requestId: params.requestId,
    endpoint: "settle",
    connectionId: params.connectionId ?? null,
    ruleName: params.ruleName ?? null,
    fingerprint: params.fingerprint ?? null,
    latencyMs: params.latencyMs,
    ok: params.ok,
    errorCode: params.errorCode ?? null,
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  const apiKey = await authenticateApiKey(request.headers);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: z.infer<typeof settleRequestSchema>;
  try {
    body = settleRequestSchema.parse(await request.json());
  } catch (error) {
    const errors =
      error instanceof z.ZodError ? formatZodErrors(error) : ["Invalid request"];
    return NextResponse.json(
      { error: "Invalid request", code: "invalid_request", details: errors },
      { status: 422 }
    );
  }

  const fingerprint = fingerprintFor({
    paymentPayload: body.paymentPayload,
    paymentRequirements: body.paymentRequirements,
  });

  let ruleset;
  try {
    ruleset = await loadActiveRuleset(apiKey.projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid ruleset";
    return NextResponse.json(
      { error: message, code: "ruleset_invalid" },
      { status: 422 }
    );
  }

  if (!ruleset) {
    return NextResponse.json(
      { error: "Ruleset not configured", code: "ruleset_missing" },
      { status: 422 }
    );
  }

  const context = buildRoutingContext(body.paymentRequirements, "settle");
  const eligible = await loadEligibleConnections(apiKey.projectId, context);
  if (eligible.length === 0) {
    await logDecision({
      projectId: apiKey.projectId,
      requestId,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: "no_eligible_connections",
      fingerprint,
    });
    return NextResponse.json(
      { error: "No eligible connections", code: "no_eligible_connections" },
      { status: 503 }
    );
  }

  const existing = await db
    .select({
      connectionId: settlementState.connectionId,
      status: settlementState.status,
    })
    .from(settlementState)
    .where(
      and(
        eq(settlementState.projectId, apiKey.projectId),
        eq(settlementState.fingerprint, fingerprint)
      )
    )
    .limit(1);

  let selected = null as
    | {
        id: string;
        name: string;
        provider: "cdp" | "thirdweb";
        credentialsEnc: unknown;
      }
    | null;
  let ruleName = existing[0]?.connectionId ? "sticky" : "default";

  if (existing[0]?.connectionId) {
    const existingConnection = await db
      .select({
        id: facilitatorConnections.id,
        name: facilitatorConnections.name,
        provider: facilitatorConnections.provider,
        credentialsEnc: facilitatorConnections.credentialsEnc,
      })
      .from(facilitatorConnections)
      .where(eq(facilitatorConnections.id, existing[0].connectionId))
      .limit(1);

    selected = existingConnection[0] ?? null;
  }

  if (!selected) {
    const decision = evaluateRuleset(ruleset, context);
    const decisionConnection = eligible.find(
      (connection) => connection.name === decision.connectionName
    );

    if (!decisionConnection) {
      await logDecision({
        projectId: apiKey.projectId,
        requestId,
        latencyMs: Date.now() - startedAt,
        ok: false,
        errorCode: "no_route",
        fingerprint,
      });
      return NextResponse.json(
        { error: "No routing match", code: "no_route" },
        { status: 422 }
      );
    }

    selected = decisionConnection;
    ruleName = decision.ruleName;

    const insert = await db
      .insert(settlementState)
      .values({
        projectId: apiKey.projectId,
        fingerprint,
        connectionId: selected.id,
        status: "pending",
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ connectionId: settlementState.connectionId });

    if (!insert[0]?.connectionId) {
      const existingState = await db
        .select({ connectionId: settlementState.connectionId })
        .from(settlementState)
        .where(
          and(
            eq(settlementState.projectId, apiKey.projectId),
            eq(settlementState.fingerprint, fingerprint)
          )
        )
        .limit(1);

      if (existingState[0]?.connectionId) {
        selected =
          eligible.find(
            (connection) => connection.id === existingState[0]?.connectionId
          ) ?? selected;
        ruleName = "sticky";
      }
    }
  }

  if (!selected) {
    await logDecision({
      projectId: apiKey.projectId,
      requestId,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: "no_route",
      fingerprint,
    });
    return NextResponse.json(
      { error: "No routing match", code: "no_route" },
      { status: 422 }
    );
  }

  let response: SettleResNormalized;
  try {
    response = await getAdapter(selected.provider).settle(
      {
        projectId: apiKey.projectId,
        connectionId: selected.id,
        provider: selected.provider,
        credentials: decryptCredentials(
          apiKey.projectId,
          selected.credentialsEnc as EncryptedPayload
        ) as Record<string, unknown>,
      },
      body
    );
  } catch (error) {
    await db
      .update(settlementState)
      .set({ status: "unknown", updatedAt: new Date() })
      .where(
        and(
          eq(settlementState.projectId, apiKey.projectId),
          eq(settlementState.fingerprint, fingerprint)
        )
      );

    await logDecision({
      projectId: apiKey.projectId,
      requestId,
      connectionId: selected.id,
      ruleName,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: "upstream_error",
      fingerprint,
    });

    return NextResponse.json(
      { error: "Settlement unknown", code: "settle_unknown", requestId },
      { status: 503 }
    );
  }

  const safeResponse = stripRawProvider(response);
  const latencyMs = Date.now() - startedAt;

  await db
    .update(settlementState)
    .set({
      status: safeResponse.success ? "settled" : "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(settlementState.projectId, apiKey.projectId),
        eq(settlementState.fingerprint, fingerprint)
      )
    );

  await logDecision({
    projectId: apiKey.projectId,
    requestId,
    connectionId: selected.id,
    ruleName,
    latencyMs,
    ok: safeResponse.success,
    errorCode: safeResponse.success ? null : "settle_failed",
    fingerprint,
  });

  return NextResponse.json(safeResponse, {
    status: 200,
    headers: {
      "x-route402-connection": selected.name,
      "x-route402-rule": ruleName,
    },
  });
}
