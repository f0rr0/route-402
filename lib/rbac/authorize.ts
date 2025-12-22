export type OrgRole = "owner" | "admin" | "viewer";

export type AuthzContext = {
  orgId: string;
  projectId?: string;
  orgRole: OrgRole;
  userId: string;
};

export function authorize(): AuthzContext {
  throw new Error("authorize() not implemented");
}
