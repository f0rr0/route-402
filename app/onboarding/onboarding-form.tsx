"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createOrgProjectAction } from "./actions";

type OrgOption = {
  id: string;
  name: string;
};

type OnboardingFormProps = {
  orgs: OrgOption[];
  defaultOrgId?: string | null;
};

export default function OnboardingForm({
  orgs,
  defaultOrgId,
}: OnboardingFormProps) {
  const router = useRouter();
  const [useNewOrg, setUseNewOrg] = useState(orgs.length === 0);
  const [orgId, setOrgId] = useState(defaultOrgId ?? orgs[0]?.id ?? "");
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasExistingOrgs = orgs.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedProject = projectName.trim();
    if (!trimmedProject) {
      setError("Project name is required.");
      return;
    }

    if (useNewOrg) {
      const trimmedOrg = orgName.trim();
      if (!trimmedOrg) {
        setError("Org name is required.");
        return;
      }
    } else if (!orgId) {
      setError("Select an org to continue.");
      return;
    }

    startTransition(async () => {
      const result = await createOrgProjectAction({
        orgId: useNewOrg ? undefined : orgId,
        orgName: useNewOrg ? orgName.trim() : undefined,
        projectName: trimmedProject,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/projects/${result.projectId}`);
    });
  };

  const toggleNewOrg = (checked: boolean) => {
    setUseNewOrg(checked);
    if (!checked && !orgId && orgs.length > 0) {
      setOrgId(orgs[0].id);
    }
  };

  return (
    <Card className="w-full border-border/70 bg-white/95 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.45)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Workspace details</CardTitle>
            <CardDescription>
              Create your first org and project to get started.
            </CardDescription>
          </div>
          <Badge>Step 1</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {hasExistingOrgs ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Create a new org</Label>
                <Switch
                  checked={useNewOrg}
                  onChange={(event) => toggleNewOrg(event.target.checked)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle off to use an existing org instead.
              </p>

              {!useNewOrg ? (
                <div className="space-y-2">
                  <Label htmlFor="org-select">Organization</Label>
                  <Select
                    id="org-select"
                    value={orgId}
                    onChange={(event) => setOrgId(event.target.value)}
                  >
                    <option value="" disabled>
                      Select an org
                    </option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          {useNewOrg ? (
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                placeholder="Route402 Labs"
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="core-router"
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              You can rename orgs and projects later in settings.
            </p>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create workspace"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
