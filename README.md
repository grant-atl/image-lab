# Image / Lab

12 image loaders for React. Each effect has a playground, and you can download the source to use in your own project.

The effects use WebGL. The downloaded component needs React and React DOM 18 or newer, plus `metal-fx@1.0.4`.

## Run the site

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open [localhost:5174](http://localhost:5174).

## Use a reveal

Click an effect to open the playground. Download `.tsx` saves the component and all 12 effects in one file, `ImageReveal.tsx`. Put that file in your React project and install its dependency:

```sh
npm install metal-fx@1.0.4
```

MetalFx 1.0.4 has a startup bug that can leave its border hidden in React StrictMode or after a replay. Its CommonJS entry also has the wrong file extension, which prevents CommonJS consumers from importing the component. Download the fix from the playground's Code tab, or copy [patch-metal-fx.mjs](scripts/patch-metal-fx.mjs) into your app. Run it from your app folder after installing dependencies:

```sh
node patch-metal-fx.mjs
```

If you keep the file in `scripts/`, use `node scripts/patch-metal-fx.mjs` instead. Add that command to your app's `postinstall` script so the fix survives a fresh install. This repository already does that. The fix corrects renderer cleanup and the CommonJS entry; the shader and presets stay the same.

Then import the component:

```tsx
import { ImageReveal } from './ImageReveal';

export default function GenerationPreview({
  imageUrl,
  isGenerating,
}: {
  imageUrl: string;
  isGenerating: boolean;
}) {
  return (
    <div style={{ height: 400 }}>
      <ImageReveal
        src={imageUrl}
        alt="Your generated image"
        loading={isGenerating}
        effect="pixel-mosaic"
        duration={3}
        speed={1}
      />
    </div>
  );
}
```

Give the parent a height, as in the example. The component fills its parent and crops the image to cover it.

Keep `loading` true while your image generates. `src` can be empty until you have a URL. Set `loading` to false when the image is ready; the reveal waits for the image to load before starting.

To use your playground settings, open the Code tab and choose Copy usage. Downloading the component doesn't change its defaults. Copy component and Download `.tsx` include your settings in a commented usage example.

The exported file includes `'use client'` for React frameworks that use server components.

## Props

| Prop | Default | Description |
| --- | --- | --- |
| `src` | Required | Image URL, local path, or object URL. |
| `alt` | `'Image preview'` | Describe the finished image. Use `''` for decoration. |
| `loading` | `false` | Keep the loader running until the image is ready. |
| `effect` | `'pixel-mosaic'` | Effect to draw. See the IDs below. |
| `duration` | `3` | Reveal duration in seconds. |
| `speed` | `1` | Loading speed multiplier, clamped between `0` and `3`. Zero freezes motion. |
| `intensity` | `0.6` | Effect strength, clamped between `0` and `1`. |
| `color` | `'#baff66'` | Loader color. Accepts a three- or six-digit hex color. |
| `progress` | None | Set the reveal from `0` to `1` instead of using automatic timing. |
| `loop` | `false` | Repeat the loading, reveal, and hold phases. |
| `paused` | `false` | Freeze loading motion and reveal timing. |
| `className` | None | CSS class for the wrapper. |
| `onError` | None | Receive an image or WebGL error message. |

Liquid metal uses its preset's color, strength, and speed. It ignores `color` and `intensity`; any positive `speed` uses its original motion, and `0` pauses it.

## Effects

```text
pixel-mosaic · noise-dissolve · liquid-metal · frosted-glass
dot-matrix · heat-haze · satin · exposure
woven · voronoi · blur · brushed-metal
```

The playground calls `voronoi` Cellular and `blur` Soft focus.

## Motion

Loading speed and reveal duration are separate. Change `speed` while the loader runs to adjust its motion without restarting it. At zero speed, the loader stays still and the image still reveals over the chosen `duration`. Set `paused` to freeze both.

Pixel mosaic cells take on the image's colors before resolving into detail. Liquid metal uses the original MetalFx chromatic border at full strength around a charcoal panel, then fades into the image. Its playground has controls for reveal duration, progress, and pause.

Animations stop when the preview leaves the viewport or the tab is hidden. People with reduced motion enabled see the image without animation. If WebGL is unavailable, the component shows a still image.

Remote images need cross-origin access (CORS) to work with WebGL. If an image can't be used as a texture, the component tries to display the original image instead. Uploaded preview images stay in your browser.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local site. |
| `npm run build` | Check TypeScript and build the site into `dist/`. |
| `npm run preview` | Serve the built site at [localhost:4174](http://localhost:4174). |
| `npm test` | Check the effect catalog, timing, loading speed, and exported component. |

The shaders are in [reveals.ts](src/lib/reveals.ts). [ImageReveal.tsx](src/components/ImageReveal.tsx) handles image loading, drawing, and motion. Images are resized for WebGL textures, with a maximum of 4,096 pixels per side or the device's lower limit. The displayed image keeps its original aspect ratio.

With the site running, open the [shader checks](http://localhost:5174/tests/shaders.html) to check the effects on your browser's GPU. The [MetalFx lifecycle checks](http://localhost:5174/tests/metal-fx-lifecycle.html) check that its border draws in StrictMode and reappears after repeated reveals.

The website uses React, TypeScript, Vite, and [Motion](https://motion.dev/) for page and mobile-menu transitions. The downloaded component doesn't depend on Motion.

## License and credit

[MIT](LICENSE). You can use this in personal and commercial projects. Keep the license notice when distributing the code.

The website shares its interface with [Dotlab](https://dotlab.grantpedersen.com/). Liquid metal uses the MIT-licensed [metal-fx package by Jakub Antalik](https://github.com/Jakubantalik/metal-fx).

Example photographs are from Unsplash: [Alpine](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b), [Forest](https://images.unsplash.com/photo-1441974231531-c6227db76b6e), [Coast](https://images.unsplash.com/photo-1518837695005-2083093ee35b), and [Desert](https://images.unsplash.com/photo-1509316785289-025f5b846b35).
