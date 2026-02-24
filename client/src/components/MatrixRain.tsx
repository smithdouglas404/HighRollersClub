import { useEffect, useRef } from "react";

interface MatrixRainProps {
  color?: string;
  density?: number;
  speed?: number;
  opacity?: number;
  className?: string;
  side?: "left" | "right" | "both" | "full";
}

export function MatrixRain({
  color = "#00ff9d",
  density = 0.6,
  speed = 1,
  opacity = 0.4,
  className = "",
  side = "full",
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let columns: number[] = [];

    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]<>=/\\|";
    const fontSize = 14;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const colCount = Math.floor(canvas.width / fontSize);
      columns = Array.from({ length: colCount }, () =>
        Math.random() * canvas.height / fontSize
      );
    }

    function draw() {
      // Semi-transparent black to create fade trail
      ctx.fillStyle = `rgba(0, 0, 0, 0.05)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns.length; i++) {
        // Apply side masking
        const x = i * fontSize;
        const relX = x / canvas.width;

        if (side === "left" && relX > 0.15) continue;
        if (side === "right" && relX < 0.85) continue;
        if (side === "both" && relX > 0.12 && relX < 0.88) continue;

        // Skip columns based on density
        if (Math.random() > density) {
          columns[i]++;
          continue;
        }

        const y = columns[i] * fontSize;
        const char = chars[Math.floor(Math.random() * chars.length)];

        // Brighter head character
        const headAlpha = 0.9 + Math.random() * 0.1;
        ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
        ctx.fillText(char, x, y);

        // Trail characters above with fading color
        if (Math.random() > 0.7) {
          const trailY = y - fontSize;
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.fillText(trailChar, x, trailY);
          ctx.globalAlpha = 1;
        }

        // Main colored character
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3 + Math.random() * 0.4;
        ctx.fillText(char, x, y - fontSize * 2);
        ctx.globalAlpha = 1;

        columns[i] += speed;

        // Reset column when it goes off screen
        if (y > canvas.height && Math.random() > 0.975) {
          columns[i] = 0;
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [color, density, speed, opacity, side]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{ opacity }}
    />
  );
}
