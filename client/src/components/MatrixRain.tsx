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
    const cvs = canvasRef.current;
    if (!cvs) return;

    const c = cvs.getContext("2d");
    if (!c) return;

    let animId: number;
    let columns: number[] = [];

    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]<>=/\\|";
    const fontSize = 14;

    const resize = () => {
      cvs.width = cvs.offsetWidth;
      cvs.height = cvs.offsetHeight;
      const colCount = Math.floor(cvs.width / fontSize);
      columns = Array.from({ length: colCount }, () =>
        Math.random() * cvs.height / fontSize
      );
    };

    const draw = () => {
      c.fillStyle = "rgba(0, 0, 0, 0.05)";
      c.fillRect(0, 0, cvs.width, cvs.height);

      c.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns.length; i++) {
        const x = i * fontSize;
        const relX = x / cvs.width;

        if (side === "left" && relX > 0.15) continue;
        if (side === "right" && relX < 0.85) continue;
        if (side === "both" && relX > 0.12 && relX < 0.88) continue;

        if (Math.random() > density) {
          columns[i]++;
          continue;
        }

        const y = columns[i] * fontSize;
        const char = chars[Math.floor(Math.random() * chars.length)];

        const headAlpha = 0.9 + Math.random() * 0.1;
        c.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
        c.fillText(char, x, y);

        if (Math.random() > 0.7) {
          const trailY = y - fontSize;
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          c.fillStyle = color;
          c.globalAlpha = 0.6;
          c.fillText(trailChar, x, trailY);
          c.globalAlpha = 1;
        }

        c.fillStyle = color;
        c.globalAlpha = 0.3 + Math.random() * 0.4;
        c.fillText(char, x, y - fontSize * 2);
        c.globalAlpha = 1;

        columns[i] += speed;

        if (y > cvs.height && Math.random() > 0.975) {
          columns[i] = 0;
        }
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

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
