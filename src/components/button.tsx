// The app's Button lives in ui/button (shadcn, restyled to DESIGN.md). Re-exported here so pages import
// from one place: `import { Button, ButtonLink } from "@/components/button"`.
import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./ui/button";

export { Button, buttonVariants };

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
