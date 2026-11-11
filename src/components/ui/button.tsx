import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Pill-shaped (on theme). Primary = prescription amber with ink text (6.4:1); secondary = foil.
// Every size keeps the tap target at 48px or more.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary:
          "bg-amber text-ink hover:bg-[#f58b00]",
        secondary: "bg-foil text-ink hover:bg-foil-deep",
        ghost: "text-ink hover:bg-foil",
        ink: "bg-ink text-label hover:bg-[#232e3c]",
      },
      size: {
        default: "min-h-[52px] px-7 text-base active:scale-[.98]",
        sm: "min-h-12 px-5 text-sm active:scale-[.98]",
        lg: "min-h-[52px] px-8 text-base active:scale-[.98]",
        icon: "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
