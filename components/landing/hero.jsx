"use client";

import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #fff 1px, transparent 1px), linear-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Subtle accent light following cursor */}
      <div
        className="absolute w-96 h-96 bg-white rounded-full blur-3xl opacity-5 pointer-events-none"
        style={{
          left: `${mousePosition.x - 192}px`,
          top: `${mousePosition.y - 192}px`,
          transition: "all 0.3s ease-out",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <div className="mb-6 inline-block">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-full text-xs font-medium text-muted-foreground">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Now in Beta
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Chat with your
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">
            Git History
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Understand file evolution. Analyze commit patterns. Chat with your codebase history to unlock insights from
          PRs and commits over any time period.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
          <Link href="/dashboard" className="px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-opacity-90 transition-all hover:scale-105 flex items-center justify-center gap-2 group">
            Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

