"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RoutingEndpoint } from "@/lib/routing/types";
import {
  dryRunRulesetAction,
  saveRulesetAction,
  validateRulesetAction,
  type DryRunRulesetResult,
  type SaveRulesetResult,
  type ValidateRulesetResult,
} from "./actions";

const DEFAULT_RULESET = `default: "thirdweb-prod"
rules:
  - name: base-usdc
    when:
      all:
        - eq: [network, "base"]
        - eq: [asset, "USDC"]
    then:
      use: "cdp-base"`;

const DEFAULT_REQUIREMENTS = `{
  "scheme": "exact",
  "network": "base",
  "asset": "USDC",
  "amount": "10",
  "payTo": "0x0000000000000000000000000000000000000000"
}`;

type RulesEditorProps = {
  projectId: string;
  initialYaml?: string | null;
  initialVersion?: number | null;
};

export default function RulesEditor({
  projectId,
  initialYaml,
  initialVersion,
}: RulesEditorProps) {
  const [yamlText, setYamlText] = useState<string>(
    initialYaml?.trim() ? initialYaml : DEFAULT_RULESET
  );
  const [requirementsJson, setRequirementsJson] = useState(DEFAULT_REQUIREMENTS);
  const [endpoint, setEndpoint] = useState<RoutingEndpoint>("verify");
  const [validateResult, setValidateResult] =
    useState<ValidateRulesetResult | null>(null);
  const [dryRunResult, setDryRunResult] =
    useState<DryRunRulesetResult | null>(null);
  const [saveResult, setSaveResult] = useState<SaveRulesetResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(
    initialVersion ?? null
  );

  const handleValidate = async () => {
    setIsValidating(true);
    setValidateResult(null);
    try {
      const result = await validateRulesetAction({ projectId, yamlText });
      setValidateResult(result);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDryRun = async () => {
    setIsDryRunning(true);
    setDryRunResult(null);
    try {
      const result = await dryRunRulesetAction({
        projectId,
        yamlText,
        endpoint,
        requirementsJson,
      });
      setDryRunResult(result);
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const result = await saveRulesetAction({ projectId, yamlText });
      setSaveResult(result);
      if (result.ok) {
        setSavedVersion(result.version);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ruleset</CardTitle>
          <CardDescription>
            Paste or edit your YAML rules. First match wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ruleset-yaml">Ruleset YAML</Label>
              <span className="text-xs text-muted-foreground">
                {savedVersion ? `v${savedVersion}` : "Draft"}
              </span>
            </div>
            <Textarea
              id="ruleset-yaml"
              className="min-h-[280px] font-mono text-xs"
              value={yamlText}
              onChange={(event) => setYamlText(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleValidate} disabled={isValidating}>
              {isValidating ? "Validating..." : "Validate"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save ruleset"}
            </Button>
          </div>
          {validateResult ? (
            validateResult.ok ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Valid ruleset. Default: {validateResult.summary.defaultConnection}
                , rules: {validateResult.summary.ruleCount}.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-destructive">
                {validateResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )
          ) : null}
          {saveResult ? (
            saveResult.ok ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Saved as version {saveResult.version}.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-destructive">
                {saveResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dry run</CardTitle>
          <CardDescription>
            Test routing against sample payment requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Select
              id="endpoint"
              value={endpoint}
              onChange={(event) =>
                setEndpoint(event.target.value as RoutingEndpoint)
              }
            >
              <option value="verify">verify</option>
              <option value="settle">settle</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="requirements-json">Payment requirements JSON</Label>
            <Textarea
              id="requirements-json"
              className="min-h-[220px] font-mono text-xs"
              value={requirementsJson}
              onChange={(event) => setRequirementsJson(event.target.value)}
            />
          </div>
          <Button type="button" onClick={handleDryRun} disabled={isDryRunning}>
            {isDryRunning ? "Running..." : "Run dry test"}
          </Button>
          {dryRunResult ? (
            dryRunResult.ok ? (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                <p>
                  Routed to <strong>{dryRunResult.decision.connectionName}</strong>{" "}
                  via <strong>{dryRunResult.decision.ruleName}</strong>.
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-xs text-emerald-900 dark:text-emerald-200">
{JSON.stringify(
  { context: dryRunResult.context, decision: dryRunResult.decision },
  null,
  2
)}
                </pre>
              </div>
            ) : (
              <ul className="space-y-1 text-sm text-destructive">
                {dryRunResult.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
