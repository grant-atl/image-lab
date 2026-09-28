# Image / Lab

Twelve WebGL loaders that reveal an image when it is ready. Browse the collection, try a photo or upload your own, adjust the effect, then copy or download the React component.

The site follows [Dot Lab](https://dotlab.grantpedersen.com/): the same typography, colors, spacing, controls, and direct copy.

## Run locally

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

The development site runs at [localhost:5174](http://localhost:5174). `npm run preview` serves the production build at [localhost:4174](http://localhost:4174).

## Use a reveal

Download or copy the full component from the site and save it as `ImageReveal.tsx`. It has a named export and includes all twelve effects. In your React app, install its `metal-fx` dependency:

```sh
npm install metal-fx@1.0.4
```

MetalFx 1.0.4 needs a renderer lifecycle fix for React StrictMode and repeated mounts. Copy [scripts/patch-metal-fx.mjs](scripts/patch-metal-fx.mjs) into your app and run it with Node after installing dependencies. This repository runs it automatically with `postinstall`. The patch only guards events from disposed canvases; it leaves the shader and presets unchanged.

The site uses Motion for its page and mobile-menu transitions. The exported reveal component does not depend on Motion.

The exported file includes your selected settings in its usage example. Those settings do not change the component's default props; pass them when you use it.

```tsx
import { ImageReveal } from './ImageReveal';

export function GenerationPreview({
  imageUrl,
  isGenerating,
}: {
  imageUrl: string;
  isGenerating: boolean;
}) {
  return (
    <div style={{ width: '100%', height: 400 }}>
      <ImageReveal
        src={imageUrl}
        alt="Your generated image"
        loading={isGenerating}
        effect="pixel-mosaic"
        duration={3}
        speed={1}
        intensity={0.6}
        color="#baff66"
      />
    </div>
  );
}
```

Give the parent a height. The component fills its parent and crops the image to cover it. Keep `loading` true while your generation request runs; `src` can be empty until a URL is available. Set `loading` to false when the image is ready. The reveal waits for the image to load before starting. This library displays images; it does not generate them.

| Prop | Default | Use |
| --- | --- | --- |
| `src` | Required | Image URL, local path, or object URL. |
| `alt` | `"Image preview"` | Describe the finished image; use `""` for decoration. |
| `loading` | `false` | Hold the animated loader until the result is ready. |
| `effect` | `"pixel-mosaic"` | Choose an effect from the list below. |
| `duration` | `3` | Reveal duration in seconds, independent of loading speed. |
| `speed` | `1` | Loading motion multiplier, from `0` to `3`; liquid metal uses its original speed. |
| `intensity` | `0.6` | Effect strength, from `0` to `1`; unused by liquid metal. |
| `color` | `"#baff66"` | Loader accent as a three- or six-digit hex color; unused by liquid metal. |
| `progress` | Unset | Control the reveal from `0` to `1`; overrides automatic timing. |
| `loop` | `false` | Repeat the loading, reveal, and hold phases for previews. |
| `paused` | `false` | Pause both loading motion and reveal timing. |
| `className` | `""` | Add a class to the wrapper. |
| `onError` | Unset | Receive an image or WebGL error message. |

For the shader effects, change `speed` while the loader runs to adjust its motion without restarting it. At `0`, the material stays still and the image still reveals over the chosen `duration`. Liquid metal uses MetalFx's original motion for any positive speed; `0` pauses its motion.

Effects: `pixel-mosaic`, `noise-dissolve`, `liquid-metal`, `frosted-glass`, `dot-matrix`, `heat-haze`, `satin`, `exposure`, `woven`, `voronoi`, `blur`, and `brushed-metal`.

Animations pause outside the viewport and when the tab is hidden. Reduced-motion preferences and unavailable WebGL use a still-image fallback. Remote images need permission for cross-origin texture loading (CORS); when that is unavailable, the component attempts to show the original image instead. Uploaded files stay in your browser.

Images are resampled to power-of-two texture dimensions, capped at 4,096 pixels per side or the device's lower texture limit. This supports filtered blur; the rendered image keeps its original aspect ratio.

Liquid metal uses the original `<MetalFx preset="chromatic" strength={1} theme="dark">` border over the image. The overlay fades away when the image is ready. Its preset controls the color, intensity, and motion; the playground exposes reveal duration, pause, and progress. Liquid metal's usage example omits the unused appearance controls.

## Checks and credits

`npm test` checks the effect catalog, timeline boundaries, selected export settings, and whether the downloaded component compiles with React and `metal-fx`. `npm run build` checks the application types and builds the site.

With `npm run dev` running, open [the shader checks](http://localhost:5174/tests/shaders.html) to test the eleven custom shader effects, mosaic colors, and the final image on your browser's GPU. [MetalFx lifecycle checks](http://localhost:5174/tests/metal-fx-lifecycle.html) verify that the native border draws in StrictMode and reappears after repeated reveals.

The interface is adapted from Dot Lab under the included [MIT license](LICENSE). Example photographs are from Unsplash: [Alpine](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b), [Forest](https://images.unsplash.com/photo-1441974231531-c6227db76b6e), [Coast](https://images.unsplash.com/photo-1518837695005-2083093ee35b), and [Desert](https://images.unsplash.com/photo-1509316785289-025f5b846b35).

Liquid metal uses the MIT-licensed [metal-fx package by Jakub Antalik](https://github.com/Jakubantalik/metal-fx), version 1.0.4. The original component supplies the chromatic border and its motion.
