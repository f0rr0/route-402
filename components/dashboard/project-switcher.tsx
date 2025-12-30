"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type ProjectOption = {
  id: string;
  name: string;
};

type OrgOption = {
  id: string;
  name: string;
  projects: ProjectOption[];
};

type ProjectSwitcherProps = {
  orgs: OrgOption[];
  currentProjectId: string;
};

export default function ProjectSwitcher({
  orgs,
  currentProjectId,
}: ProjectSwitcherProps) {
  const router = useRouter();

  if (orgs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="project-switcher" className="text-xs uppercase tracking-[0.2em]">
        Switch project
      </Label>
      <Select
        id="project-switcher"
        value={currentProjectId}
        onChange={(event) => {
          const nextId = event.target.value;
          if (nextId && nextId !== currentProjectId) {
            router.push(`/projects/${nextId}`);
          }
        }}
      >
        {orgs.map((org) => (
          <optgroup key={org.id} label={org.name}>
            {org.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
