import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-lg border border-muted-foreground/20 bg-background px-4 py-3 text-base shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
