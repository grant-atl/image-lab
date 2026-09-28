import type { EffectId } from "./reveals";
import revealSource from "../components/ImageReveal.tsx?raw";
import shaderSource from "./reveals.ts?raw";
import license from "../../LICENSE?raw";

export type RevealSettings = { effect: EffectId; duration: number; speed: number; intensity: number; color: string };

export function buildUsage(settings: RevealSettings) {
  const appearance = settings.effect === 'liquid-metal' ? '' : `\n    speed={${settings.speed}}\n    intensity={${settings.intensity}}\n    color=${JSON.stringify(settings.color)}`;
  return `import { ImageReveal } from './ImageReveal';

// Use your generation request's loading state.
<div style={{ width: '100%', height: 400 }}>
  <ImageReveal
    src={imageUrl}
    alt="Your generated image"
    loading={isGenerating}
    effect=${JSON.stringify(settings.effect)}
    duration={${settings.duration}}${appearance}
  />
</div>`;
}

export function buildComponent(settings: RevealSettings) {
  const component = revealSource.replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\.\/lib\/reveals["'];?\s*$/gm, "");
  return `'use client';\n\n// Install dependencies: npm install react metal-fx@1.0.4\n// Download the MetalFx fix from the playground Code tab.\n// Run: node patch-metal-fx.mjs (from your app folder, after installing dependencies).\n\n/*\n${license.trim()}\n*/\n\n${shaderSource}\n${component}\n\n/* Usage\n${buildUsage(settings)}\n*/\n`;
}

export function saveComponent(source: string) {
  const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ImageReveal.tsx";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
