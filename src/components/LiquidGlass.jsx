import React, { useEffect, useRef } from "react";
import "./LiquidGlass.css";

/**
 * LiquidGlass Component - VisionOS / Apple-style Liquid Glass Pane
 * 
 * Uses liquid-gl WebGPU / WebGL shader refraction with automatic fallback
 * to ultra-crisp CSS backdrop filter with specular sheen & chromatic edge refraction.
 */
export default function LiquidGlass({
  children,
  className = "",
  style = {},
  interactive = false,
  refraction = 0.015,
  aberration = 0.02,
  bevelDepth = 0.1,
  bevelWidth = 0.18,
  frost = 0,
  tint = undefined,
  tilt = false,
  as: Component = "div",
  ...props
}) {
  const elementRef = useRef(null);

  useEffect(() => {
    let lensInstance = null;
    let isMounted = true;

    // Dynamically attempt liquid-gl WebGPU/WebGL initialization
    const initLiquidGL = async () => {
      try {
        if (!elementRef.current || typeof window === "undefined") return;

        // Skip heavy WebGPU/WebGL canvas on lower-end mobile devices or if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReducedMotion) return;

        const liquidGLModule = await import("liquid-gl");
        const liquidGL = liquidGLModule.default || liquidGLModule;

        if (typeof liquidGL === "function" && isMounted && elementRef.current) {
          lensInstance = liquidGL({
            engine: "auto",
            target: elementRef.current,
            resolution: window.devicePixelRatio > 1 ? 1.5 : 1.0,
            refraction,
            aberration,
            bevelDepth,
            bevelWidth,
            frost,
            tint,
            shadow: true,
            specular: true,
            tilt,
            tiltFactor: 4,
          });
        }
      } catch (err) {
        // Fallback safely to Apple CSS liquid glass styling
        console.debug("[LiquidGlass] WebGL/WebGPU shader note, running CSS fallback:", err?.message || err);
      }
    };

    initLiquidGL();

    return () => {
      isMounted = false;
      try {
        if (lensInstance && typeof lensInstance.destroy === "function") {
          lensInstance.destroy();
        }
      } catch (_) {}
    };
  }, [refraction, aberration, bevelDepth, bevelWidth, frost, tint, tilt]);

  const combinedClasses = [
    "apple-liquid-glass",
    interactive ? "apple-liquid-glass-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component
      ref={elementRef}
      className={combinedClasses}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}
