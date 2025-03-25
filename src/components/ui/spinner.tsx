import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Spinner = ({ className, size = "md" }: SpinnerProps) => {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-4",
    lg: "w-10 h-10 border-4",
  };

  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full border-t-2 border-slate-900 border-opacity-75",
        sizes[size],
        className
      )}
    />
  );
};
