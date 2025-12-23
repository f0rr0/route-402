"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ProjectNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  badge?: string;
};

type ProjectNavProps = {
  items: ProjectNavItem[];
};

export default function ProjectNav({ items }: ProjectNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex min-w-[160px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition lg:min-w-0",
              isActive
                ? "border-border/70 bg-white/90 text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-white/70 hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <Badge
                variant="warning"
                className="text-[10px] uppercase tracking-wide"
              >
                {item.badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
