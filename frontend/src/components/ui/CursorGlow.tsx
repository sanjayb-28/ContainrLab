"use client";

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current) return;
      
      // Create a subtle spotlight effect that follows the cursor
      const x = e.clientX;
      const y = e.clientY;
      
      spotlightRef.current.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(16,185,129,0.06), transparent 40%)`;
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={spotlightRef}
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
      aria-hidden="true"
    />
  );
}
