import type { EffectId } from "./reveals";
import revealSource from "../components/ImageReveal.tsx?raw";
import shaderSource from "./reveals.ts?raw";
import license from "../../LICENSE?raw";
import metalFxPatchSource from "../../scripts/patch-metal-fx.mjs?raw";

export const metalFxFixPrompt = `Use the downloaded ImageReveal.tsx in this existing React app and apply the image/lab MetalFx fix.

1. Inspect the app's package.json and use its existing package manager. Install and pin metal-fx@1.0.4 as an exact dependency; reuse the app's existing React installation.
2. Save the script below exactly as scripts/patch-metal-fx.mjs, creating the scripts folder if needed.
3. After installing dependencies, run node scripts/patch-metal-fx.mjs from the app folder.
4. Ensure package.json's postinstall runs node scripts/patch-metal-fx.mjs after dependency installation. Preserve any existing postinstall command and append the patch command with && only if it is not already present; do not replace other install steps.
5. Keep the downloaded ImageReveal.tsx, shaders, chromatic preset, and appearance unchanged. This patch only fixes MetalFx preview startup and CommonJS imports.
6. Run the app's applicable type checks, tests, and build. If browser testing is available, verify Liquid Metal appears during loading and after repeated reveals. Report any checks you could not complete.

scripts/patch-metal-fx.mjs:
\`\`\`js
${metalFxPatchSource}\`\`\`
`;

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
