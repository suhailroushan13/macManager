"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type ProgressAnimation = "charge" | "discharge" | boolean

function Progress({
  className,
  value,
  animated = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { animated?: ProgressAnimation }) {
  const mode = animated === true ? "charge" : animated;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="relative size-full flex-1 overflow-hidden bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {mode === "charge" && (
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ animation: "progress-charge 1.2s ease-in-out infinite" }}
          />
        )}
        {mode === "discharge" && (
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/25 to-transparent"
            style={{ animation: "progress-discharge 1.6s ease-in-out infinite" }}
          />
        )}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
