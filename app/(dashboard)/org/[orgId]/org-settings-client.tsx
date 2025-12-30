"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
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
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/lib/rbac/authorize";
import {
  updateMemberRoleAction,
  updateOrgNameAction,
} from "./actions";

export type OrgMemberListItem = {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
  isCurrentUser: boolean;
};

type OrgSettingsClientProps = {
  orgId: string;
  orgName: string;
  orgCreatedAt: string;
  canManage: boolean;
  members: OrgMemberListItem[];
};

const roleLabels: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  viewer: "Viewer",
};

const roleBadge: Record<OrgRole, "success" | "warning" | "default"> = {
  owner: "success",
  admin: "warning",
  viewer: "default",
};

export default function OrgSettingsClient({
  orgId,
  orgName,
  orgCreatedAt,
  canManage,
  members: initialMembers,
}: OrgSettingsClientProps) {
  const [members, setMembers] = useState<OrgMemberListItem[]>(initialMembers);
  const [name, setName] = useState(orgName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [isRenaming, startRename] = useTransition();
  const [, startRoleUpdate] = useTransition();

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members]
  );

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Organization name is required.");
      return;
    }

    startRename(async () => {
      const result = await updateOrgNameAction({ orgId, name: trimmed });
      if (!result.ok) {
        setNameError(result.error);
        return;
      }
      setName(result.name);
    });
  };

  const handleRoleChange = (userId: string, nextRole: OrgRole) => {
    setRoleError(null);
    const current = members.find((member) => member.userId === userId);
    if (!current || current.role === nextRole) {
      return;
    }
    const previousRole = current.role;
    setMembers((prev) =>
      prev.map((member) =>
        member.userId === userId ? { ...member, role: nextRole } : member
      )
    );
    setPendingMemberId(userId);

    startRoleUpdate(async () => {
      const result = await updateMemberRoleAction({
        orgId,
        userId,
        role: nextRole,
      });
      setPendingMemberId(null);

      if (!result.ok) {
        setRoleError(result.error);
        setMembers((prev) =>
          prev.map((member) =>
            member.userId === userId ? { ...member, role: previousRole } : member
          )
        );
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Manage your org profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleRename}>
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canManage}
              />
            </div>
            {nameError ? (
              <p className="text-sm text-destructive">{nameError}</p>
            ) : null}
            <Button type="submit" disabled={!canManage || isRenaming}>
              {isRenaming ? "Saving..." : "Save changes"}
            </Button>
          </form>

          <div className="rounded-xl border border-border/70 bg-white/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Org metadata
            </p>
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <div>
                <p className="text-xs text-muted-foreground">Org ID</p>
                <p className="font-mono text-xs">{orgId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p>{new Date(orgCreatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {!canManage ? (
            <p className="text-xs text-muted-foreground">
              Only owners can edit org settings and member roles.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                {members.length} member{members.length === 1 ? "" : "s"} in this org.
              </CardDescription>
            </div>
            <Badge variant={canManage ? "success" : "warning"}>
              {canManage ? "Owner view" : "Read only"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {roleError ? (
            <p className="text-sm text-destructive">{roleError}</p>
          ) : null}

          {members.map((member) => {
            const isPendingRow = pendingMemberId === member.userId;
            const disableRole =
              !canManage || (member.role === "owner" && ownerCount === 1);

            return (
              <div
                key={member.userId}
                className={cn(
                  "rounded-xl border border-border/70 bg-white/80 p-4",
                  isPendingRow && "opacity-70"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.isCurrentUser ? (
                      <Badge variant="default">You</Badge>
                    ) : null}
                    <Badge variant={roleBadge[member.role]}>
                      {roleLabels[member.role]}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px]">
                    <Label htmlFor={`role-${member.userId}`}>Role</Label>
                    <Select
                      id={`role-${member.userId}`}
                      value={member.role}
                      disabled={disableRole || isPendingRow}
                      onChange={(event) =>
                        handleRoleChange(
                          member.userId,
                          event.target.value as OrgRole
                        )
                      }
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </div>
                  {disableRole ? (
                    <p className="text-xs text-muted-foreground">
                      {member.role === "owner" && ownerCount === 1
                        ? "At least one owner is required."
                        : "Role updates require owner access."}
                    </p>
                  ) : isPendingRow ? (
                    <p className="text-xs text-muted-foreground">
                      Updating role...
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
