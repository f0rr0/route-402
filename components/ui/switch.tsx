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
      <span className="relative h-5 w-9 rounded-full bg-zinc-200 transition peer-checked:bg-zinc-900">
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
      </span>
    </label>
  )
);

Switch.displayName = "Switch";

export { Switch };
