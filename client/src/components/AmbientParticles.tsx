import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

export function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let animFrame: number;

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 40;

    const colors = [
      "rgba(201,168,76,",   // gold
      "rgba(0,240,255,",    // cyan
      "rgba(0,255,157,",    // green
      "rgba(255,255,255,",  // white
    ];

    function spawnParticle(): Particle {
      return {
        x: Math.random() * width,
        y: height + 10,
        size: Math.random() * 2 + 0.5,
        speedY: -(Math.random() * 0.4 + 0.15),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: Math.random() * 400 + 200,
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = spawnParticle();
      p.y = Math.random() * height;
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.speedX;
        p.y += p.speedY;

        // Fade in/out
        const lifeRatio = p.life / p.maxLife;
        if (lifeRatio < 0.1) {
          p.opacity = lifeRatio / 0.1;
        } else if (lifeRatio > 0.8) {
          p.opacity = (1 - lifeRatio) / 0.2;
        } else {
          p.opacity = 1;
        }

        const alpha = Math.max(0, Math.min(1, p.opacity * 0.6));

        // Glow
        ctx!.beginPath();
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, `${p.color}${alpha * 0.3})`);
        gradient.addColorStop(1, `${p.color}0)`);
        ctx!.fillStyle = gradient;
        ctx!.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx!.fill();

        // Core
        ctx!.beginPath();
        ctx!.fillStyle = `${p.color}${alpha})`;
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();

        // Recycle
        if (p.life >= p.maxLife || p.y < -20) {
          particles[i] = spawnParticle();
        }
      }

      animFrame = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}
