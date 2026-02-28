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
      "relative flex w-full touch-none select-none items-center py-1",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-2 w-full grow overflow-hidden rounded-full"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <SliderPrimitive.Range
        className="absolute h-full rounded-full"
        style={{
          background: "linear-gradient(90deg, #0ea5e9, #06b6d4, #00d4ff)",
          boxShadow: "0 0 8px rgba(0,212,255,0.3)",
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-6 w-6 rounded-full shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:scale-110"
      style={{
        background: "linear-gradient(180deg, #fff 0%, #d4d4d8 100%)",
        border: "2px solid rgba(0,212,255,0.5)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 10px rgba(0,212,255,0.2)",
      }}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
