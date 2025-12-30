"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ApiKeyListItem } from "./types";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
} from "./actions";

type KeysClientProps = {
  projectId: string;
  initialKeys: ApiKeyListItem[];
};

type CreatedKeyState = {
  key: string;
  name: string;
};

export default function KeysClient({
  projectId,
  initialKeys,
}: KeysClientProps) {
  const [keys, setKeys] = useState<ApiKeyListItem[]>(initialKeys);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKeyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    type: "revoke" | "rotate";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasActiveKeys = useMemo(
    () => keys.some((key) => !key.revokedAt),
    [keys]
  );

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Not used yet";

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Key name is required.");
      return;
    }

    startTransition(async () => {
      const result = await createApiKeyAction({
        projectId,
        name: trimmed,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCreatedKey({ key: result.key, name: result.record.name });
      setKeys((prev) => [result.record, ...prev]);
      setName("");
      setCopied(false);
    });
  };

  const handleRevoke = (keyId: string) => {
    setError(null);
    setPendingAction({ id: keyId, type: "revoke" });
    startTransition(async () => {
      const result = await revokeApiKeyAction({ projectId, keyId });
      setPendingAction(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setKeys((prev) =>
        prev.map((key) => (key.id === keyId ? result.record : key))
      );
    });
  };

  const handleRotate = (keyId: string) => {
    setError(null);
    setPendingAction({ id: keyId, type: "rotate" });
    startTransition(async () => {
      const result = await rotateApiKeyAction({ projectId, keyId });
      setPendingAction(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCreatedKey({ key: result.key, name: result.record.name });
      setKeys((prev) => {
        const updated = prev.map((item) =>
          item.id === result.revoked.id ? result.revoked : item
        );
        return [result.record, ...updated];
      });
      setCopied(false);
    });
  };

  const handleCopy = async () => {
    if (!createdKey?.key) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setError("Copy failed. Select the key and copy it manually.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Create an API key
            </h3>
            <p className="text-sm text-muted-foreground">
              Keys are shown once. Store them in your secrets manager.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="prod-router"
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create key"}
            </Button>
          </form>

          {createdKey ? (
            <div className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                    New key
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {createdKey.name}
                  </p>
                </div>
                <Badge variant="success">One-time</Badge>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-emerald-900">
                {createdKey.key}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy key"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreatedKey(null)}
                >
                  Dismiss
                </Button>
              </div>
              <p className="text-xs text-emerald-700">
                This key will not be shown again once dismissed.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Active keys
              </h3>
              <p className="text-sm text-muted-foreground">
                Revoke or rotate keys at any time.
              </p>
            </div>
            <Badge variant={hasActiveKeys ? "success" : "warning"}>
              {hasActiveKeys ? "Live" : "None"}
            </Badge>
          </div>

          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys created yet.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => {
                const isRevoked = Boolean(key.revokedAt);
                const isRowPending =
                  pendingAction?.id === key.id ? pendingAction.type : null;

                return (
                  <div
                    key={key.id}
                    className={cn(
                      "rounded-xl border border-border/70 bg-white/80 p-4",
                      isRevoked && "opacity-70"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {key.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={isRevoked ? "destructive" : "success"}>
                        {isRevoked ? "revoked" : "active"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Last used: {formatDate(key.lastUsedAt)}</span>
                      {isRevoked && key.revokedAt ? (
                        <span>
                          Revoked {new Date(key.revokedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    {!isRevoked ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRotate(key.id)}
                        >
                          {isRowPending === "rotate"
                            ? "Rotating..."
                            : "Rotate"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRevoke(key.id)}
                        >
                          {isRowPending === "revoke"
                            ? "Revoking..."
                            : "Revoke"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
