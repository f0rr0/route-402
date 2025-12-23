import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={cn("inline-flex cursor-pointer items-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        {...props}
      />
      <span className="relative inline-flex h-5 w-9 items-center rounded-full border border-input bg-input transition-colors peer-checked:bg-primary peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background">
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  )
);

Switch.displayName = "Switch";

export { Switch };
