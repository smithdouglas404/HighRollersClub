import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-3 w-full grow overflow-hidden rounded-full"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(10,15,25,0.6) 100%)",
        border: "1px solid rgba(0,212,255,0.2)",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), 0 0 6px rgba(0,212,255,0.08)",
      }}
    >
      <SliderPrimitive.Range
        className="absolute h-full rounded-full"
        style={{
          background: "linear-gradient(90deg, #0891b2, #06b6d4, #22d3ee, #00d4ff)",
          boxShadow: "0 0 12px rgba(0,212,255,0.4), 0 0 4px rgba(0,212,255,0.2)",
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-7 w-7 rounded-full shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95"
      style={{
        background: "radial-gradient(circle at 35% 35%, #ffffff 0%, #e0e0e0 40%, #a0a0a0 100%)",
        border: "2.5px solid rgba(0,212,255,0.6)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.5), 0 0 14px rgba(0,212,255,0.3), inset 0 1px 2px rgba(255,255,255,0.4)",
      }}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
