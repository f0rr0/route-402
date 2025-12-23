import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/auth/api-keys";
import { decryptCredentials } from "@/lib/crypto/credentials";
import type { EncryptedPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { routingDecisions } from "@/lib/db/schema";
import { getAdapter } from "@/lib/facilitators";
import { buildRoutingContext } from "@/lib/routing/context";
import { evaluateRuleset } from "@/lib/routing/eval";
import { loadActiveRuleset, loadEligibleConnections } from "@/lib/routing/selection";
import type { VerifyResNormalized } from "@/lib/types/x402";
import { verifyRequestSchema } from "@/lib/types/x402-schema";

export const runtime = "nodejs";

function stripRawProvider<T extends { rawProvider?: unknown }>(value: T) {
  const { rawProvider: _rawProvider, ...safe } = value;
  return safe;
}

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}

async function logDecision(params: {
  projectId: string;
  requestId: string;
  connectionId?: string | null;
  ruleName?: string | null;
  latencyMs: number;
  ok: boolean;
  errorCode?: string | null;
}) {
  await db.insert(routingDecisions).values({
    projectId: params.projectId,
    requestId: params.requestId,
    endpoint: "verify",
    connectionId: params.connectionId ?? null,
    ruleName: params.ruleName ?? null,
    fingerprint: null,
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

  let body: z.infer<typeof verifyRequestSchema>;
  try {
    body = verifyRequestSchema.parse(await request.json());
  } catch (error) {
    const errors =
      error instanceof z.ZodError ? formatZodErrors(error) : ["Invalid request"];
    return NextResponse.json(
      { error: "Invalid request", code: "invalid_request", details: errors },
      { status: 422 }
    );
  }

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

  const context = buildRoutingContext(body.paymentRequirements, "verify");
  const eligible = await loadEligibleConnections(apiKey.projectId, context);
  if (eligible.length === 0) {
    await logDecision({
      projectId: apiKey.projectId,
      requestId,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: "no_eligible_connections",
    });
    return NextResponse.json(
      { error: "No eligible connections", code: "no_eligible_connections" },
      { status: 503 }
    );
  }

  const decision = evaluateRuleset(ruleset, context);
  let selected = eligible.find(
    (connection) => connection.name === decision.connectionName
  );
  let ruleName = decision.ruleName;

  if (!selected) {
    const defaultConnection = eligible.find(
      (connection) => connection.name === ruleset.default
    );
    if (defaultConnection) {
      selected = defaultConnection;
      ruleName = "default";
    } else if (eligible[0]) {
      selected = eligible[0];
      ruleName = "fallback";
    }
  }

  if (!selected) {
    await logDecision({
      projectId: apiKey.projectId,
      requestId,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorCode: "no_route",
    });
    return NextResponse.json(
      { error: "No routing match", code: "no_route" },
      { status: 503 }
    );
  }

  let response: VerifyResNormalized;
  try {
    response = await getAdapter(selected.provider).verify(
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
    const fallback = eligible.find((connection) => connection.id !== selected?.id);
    if (!fallback) {
      await logDecision({
        projectId: apiKey.projectId,
        requestId,
        connectionId: selected.id,
        ruleName,
        latencyMs: Date.now() - startedAt,
        ok: false,
        errorCode: "upstream_error",
      });
      return NextResponse.json(
        { error: "Upstream facilitator error", code: "upstream_error" },
        { status: 502 }
      );
    }

    try {
      response = await getAdapter(fallback.provider).verify(
        {
          projectId: apiKey.projectId,
          connectionId: fallback.id,
          provider: fallback.provider,
          credentials: decryptCredentials(
            apiKey.projectId,
            fallback.credentialsEnc as EncryptedPayload
          ) as Record<string, unknown>,
        },
        body
      );
      selected = fallback;
      ruleName = "fallback";
    } catch (fallbackError) {
      await logDecision({
        projectId: apiKey.projectId,
        requestId,
        connectionId: fallback.id,
        ruleName: "fallback",
        latencyMs: Date.now() - startedAt,
        ok: false,
        errorCode: "upstream_error",
      });
      return NextResponse.json(
        { error: "Upstream facilitator error", code: "upstream_error" },
        { status: 502 }
      );
    }
  }

  const safeResponse = stripRawProvider(response);
  const latencyMs = Date.now() - startedAt;

  await logDecision({
    projectId: apiKey.projectId,
    requestId,
    connectionId: selected.id,
    ruleName,
    latencyMs,
    ok: true,
  });

  return NextResponse.json(safeResponse, {
    status: 200,
    headers: {
      "x-route402-connection": selected.name,
      "x-route402-rule": ruleName,
    },
  });
}
