"use client";

import { useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const drawGradient = () => {
      const { width, height } = canvas;
      
      // Create animated gradient blobs
      const gradient1 = ctx.createRadialGradient(
        width * 0.2 + Math.sin(time * 0.001) * 100,
        height * 0.3 + Math.cos(time * 0.0015) * 100,
        0,
        width * 0.2 + Math.sin(time * 0.001) * 100,
        height * 0.3 + Math.cos(time * 0.0015) * 100,
        width * 0.5
      );
      gradient1.addColorStop(0, "rgba(14, 165, 233, 0.15)"); // sky-500
      gradient1.addColorStop(1, "rgba(14, 165, 233, 0)");

      const gradient2 = ctx.createRadialGradient(
        width * 0.8 + Math.cos(time * 0.0012) * 100,
        height * 0.6 + Math.sin(time * 0.001) * 100,
        0,
        width * 0.8 + Math.cos(time * 0.0012) * 100,
        height * 0.6 + Math.sin(time * 0.001) * 100,
        width * 0.5
      );
      gradient2.addColorStop(0, "rgba(139, 92, 246, 0.12)"); // violet-500
      gradient2.addColorStop(1, "rgba(139, 92, 246, 0)");

      const gradient3 = ctx.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.0008) * 150,
        height * 0.8 + Math.cos(time * 0.001) * 150,
        0,
        width * 0.5 + Math.sin(time * 0.0008) * 150,
        height * 0.8 + Math.cos(time * 0.001) * 150,
        width * 0.4
      );
      gradient3.addColorStop(0, "rgba(16, 185, 129, 0.1)"); // emerald-500
      gradient3.addColorStop(1, "rgba(16, 185, 129, 0)");

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = gradient3;
      ctx.fillRect(0, 0, width, height);
    };

    const animate = () => {
      time++;
      drawGradient();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 opacity-40"
      aria-hidden="true"
    />
  );
}
