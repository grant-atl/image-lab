import { useCallback, useEffect, useRef, useState } from "react";
import { ImageReveal } from "./ImageReveal";
import { COLORS, Icon, Toast, useDialog, type CopyHandler } from "./ui";
import { EFFECTS, type EffectId } from "../lib/reveals";
import { SAMPLES } from "../lib/samples";
import { buildComponent, buildUsage, saveComponent, type RevealSettings } from "../lib/export";
import metalFxPatchUrl from "../../scripts/patch-metal-fx.mjs?url";
import "./reveal-playground.css";

const DEFAULTS = { duration: 3, speed: 1, intensity: 0.6, color: COLORS[0] };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

function RangeControl({ name, label, value, min, max, step, display, disabled = false, onChange }: {
  name: string; label: string; value: number; min: number; max: number; step: number;
  display: string; disabled?: boolean; onChange: (value: number) => void;
}) {
  return (
    <div className="control-section">
      <label className="range-label" htmlFor={`reveal-${name}`}>{label}<output>{display}</output></label>
      <input id={`reveal-${name}`} type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-valuetext={display} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

export function RevealPlayground({ initialEffect, reducedMotion, message, onClose, onCopy }: {
  initialEffect: EffectId;
  reducedMotion: boolean;
  message: string;
  onClose: () => void;
  onCopy: CopyHandler;
}) {
  const [settings, setSettings] = useState<RevealSettings>({ ...DEFAULTS, effect: initialEffect });
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [image, setImage] = useState<{ src: string; name: string; alt: string }>(SAMPLES[0]);
  const [loop, setLoop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<number>();
  const [replay, setReplay] = useState(0);
  const [imageError, setImageError] = useState("");
  const [readingImage, setReadingImage] = useState(false);
  const uploadVersion = useRef(0);
  const localUrls = useRef(new Set<string>());
  const dialog = useDialog(onClose, reducedMotion);
  const metadata = EFFECTS.find((effect) => effect.id === settings.effect)!;
  const nativeMetal = settings.effect === "liquid-metal";
  const update = <K extends keyof RevealSettings>(key: K, value: RevealSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => () => {
    uploadVersion.current++;
    localUrls.current.forEach((url) => URL.revokeObjectURL(url));
    localUrls.current.clear();
  }, []);

  useEffect(() => () => {
    if (localUrls.current.delete(image.src)) URL.revokeObjectURL(image.src);
  }, [image.src]);

  const restart = () => {
    setProgress(undefined);
    setLoading(false);
    setPaused(false);
    setReplay((current) => current + 1);
  };
  const chooseSample = (sample: (typeof SAMPLES)[number]) => {
    uploadVersion.current++;
    setReadingImage(false);
    setImageError("");
    setImage(sample);
    restart();
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const version = ++uploadVersion.current;
    setImageError("");
    setReadingImage(false);
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError("Choose a JPEG, PNG, WebP, AVIF, or GIF image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError("Choose an image smaller than 12 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    localUrls.current.add(url);
    const release = () => {
      localUrls.current.delete(url);
      URL.revokeObjectURL(url);
    };
    setReadingImage(true);
    try {
      const decoded = new Image();
      decoded.src = url;
      await decoded.decode();
      if (version !== uploadVersion.current) { release(); return; }
      if (decoded.naturalWidth > 8192 || decoded.naturalHeight > 8192 || decoded.naturalWidth * decoded.naturalHeight > 24_000_000) {
        release();
        setImageError("Choose an image under 24 megapixels, with neither side over 8,192 pixels.");
        return;
      }
      setImage({ src: url, name: file.name, alt: "Your uploaded image" });
      restart();
    } catch {
      release();
      if (version === uploadVersion.current) setImageError("This image could not be opened. Try another file.");
    } finally {
      if (version === uploadVersion.current) setReadingImage(false);
    }
  };
  const previewError = useCallback((error: string) => setImageError(error), []);
  const reset = () => {
    setSettings({ ...DEFAULTS, effect: initialEffect });
    setLoop(true);
    restart();
  };

  return (
    <dialog {...dialog.props} className="playground-dialog reveal-dialog" aria-labelledby="reveal-playground-title">
      <div className="dialog-inner">
        <div className="dialog-header">
          <h2 id="reveal-playground-title">Playground</h2>
          <button className="icon-button" onClick={dialog.close} aria-label="Close image reveal playground"><Icon name="close" size={21} /></button>
        </div>
        <div className="playground-layout">
          <div className="playground-main">
            <div className="preview-toolbar">
              <div className="segmented" aria-label="Playground view">
                <button className={tab === "preview" ? "active" : ""} aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
                <button className={tab === "code" ? "active" : ""} aria-pressed={tab === "code"} onClick={() => setTab("code")}>Code</button>
              </div>
              <span className="preview-tag">{metadata.name}</span>
            </div>
            <div hidden={tab !== "preview"}>
              <div className="reveal-preview-surface">
                <ImageReveal key={replay} {...settings} src={image.src} alt={image.alt} loop={loop && !reducedMotion && progress === undefined} loading={loading && !reducedMotion} progress={reducedMotion ? 1 : progress} paused={paused || reducedMotion || tab !== "preview"} className="reveal-playground-image" onError={previewError} />
              </div>
              <div className="reveal-playback">
                <button className="button button-secondary" disabled={reducedMotion} onClick={() => setPaused(!paused)}><Icon name={paused ? "play" : "pause"} size={14} />{paused ? "Play" : "Pause"}</button>
                <button className="text-button" disabled={reducedMotion} onClick={restart}><Icon name="reset" size={14} />Replay</button>
                <label className="reveal-loop"><input type="checkbox" checked={loop} disabled={reducedMotion} onChange={(event) => { setLoop(event.target.checked); restart(); }} />Loop preview</label>
              </div>
              <div className="reveal-loading-test">
                <button className="text-button" disabled={reducedMotion} onClick={() => { setProgress(undefined); setLoop(false); setPaused(false); setLoading(!loading); if (!loading) setReplay((current) => current + 1); }}>{loading ? "Reveal image" : "Test loading"}<Icon name="arrow" size={14} /></button>
                <span>{loading ? "Loader stays on until you reveal the image." : "Preview the wait for a generated image."}</span>
              </div>
              <RangeControl name="progress" label="Reveal progress" value={progress === undefined ? 0 : progress * 100} min={0} max={100} step={1} display={progress === undefined ? "Auto" : `${Math.round(progress * 100)}%`} disabled={reducedMotion} onChange={(value) => { setProgress(value / 100); setLoading(false); setLoop(false); }} />
              {reducedMotion && <p className="reveal-note">Your device has reduced motion enabled. The image is shown without animation.</p>}
              <div className="reveal-image-picker">
                <span className="control-label">Preview image</span>
                <div className="reveal-samples" aria-label="Sample images">
                  {SAMPLES.map((sample) => <button key={sample.src} className={image.src === sample.src ? "selected" : ""} aria-pressed={image.src === sample.src} onClick={() => chooseSample(sample)}><img src={sample.src} alt="" /><span>{sample.name}</span></button>)}
                </div>
                <div className="reveal-upload-row">
                  <label className="button button-secondary reveal-upload">Use your image<input type="file" accept={IMAGE_TYPES.join(",")} aria-label="Use your image" aria-describedby="reveal-upload-note reveal-image-error" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
                  <span className="reveal-image-name" title={image.name}>{readingImage ? "Reading image…" : image.name}</span>
                </div>
                <p className="reveal-note" id="reveal-upload-note">Your image stays in this browser.</p>
                <p className="reveal-image-error" id="reveal-image-error" role="status" aria-live="polite">{imageError}</p>
              </div>
            </div>
            {tab === "code" && <div className="usage-code reveal-usage">
              <div><span>GeneratedImage.tsx</span><button className="text-button" onClick={() => onCopy(buildUsage(settings), "Usage example copied")}><Icon name="copy" size={14} />Copy usage</button></div>
              <pre><code>{buildUsage(settings)}</code></pre>
              <p>Save the component as <strong>ImageReveal.tsx</strong>. Set <code>loading</code> while an image is generating, then pass the finished image to <code>src</code>.</p>
              <p>Copy component and Download .tsx include all effects and your settings. Install <code>metal-fx@1.0.4</code> alongside React.</p>
              <p><a href={metalFxPatchUrl} download="patch-metal-fx.mjs">Download the MetalFx fix</a> and run <code>node patch-metal-fx.mjs</code> from your app folder after installing dependencies. This fixes the package’s preview startup; its appearance stays the same.</p>
              <p>The preview image is not included. Use an image from your app.</p>
            </div>}
          </div>
          <aside className="playground-settings reveal-settings" aria-label="Image reveal settings">
            <label className="control-label" htmlFor="reveal-effect">Effect</label>
            <select id="reveal-effect" value={settings.effect} onChange={(event) => { update("effect", event.target.value as EffectId); if (event.target.value === "liquid-metal") update("speed", 1); restart(); }}>{EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select>
            <p className="reveal-effect-description">{metadata.description}</p>
            {!nativeMetal && <RangeControl name="speed" label="Loading speed" value={settings.speed} min={0} max={3} step={0.1} display={`${Number(settings.speed.toFixed(1))}×`} disabled={reducedMotion} onChange={(value) => update("speed", value)} />}
            <RangeControl name="duration" label="Reveal duration" value={settings.duration} min={0.5} max={6} step={0.1} display={`${Number(settings.duration.toFixed(1))} s`} disabled={reducedMotion} onChange={(value) => update("duration", value)} />
            {!nativeMetal && <RangeControl name="intensity" label="Intensity" value={settings.intensity} min={0} max={1} step={0.05} display={`${Math.round(settings.intensity * 100)}%`} disabled={reducedMotion} onChange={(value) => update("intensity", value)} />}
            <div className="control-section">
              <span className="control-label">Loader color</span>
              {nativeMetal ? <p className="reveal-effect-description">Chromatic · Original motion</p> : <>
              <div className="color-swatches">{COLORS.map((color) => <button key={color} style={{ background: color }} className={settings.color === color ? "chosen" : ""} aria-label={`Set color ${color}`} aria-pressed={settings.color === color} onClick={() => update("color", color)} />)}</div>
              <label className="custom-color"><input type="color" value={settings.color} onChange={(event) => update("color", event.target.value)} aria-label="Custom loader color" /><span>{settings.color.toUpperCase()}</span><span>CUSTOM</span></label>
              </>}
            </div>
            <button className="text-button reset-button" onClick={reset}><Icon name="reset" size={13} />Reset settings</button>
            <div className="export-actions">
              <button className="button button-primary" onClick={() => onCopy(buildComponent(settings), "Complete React component copied")}><Icon name="copy" size={17} />Copy component</button>
              <button className="button button-secondary" onClick={() => saveComponent(buildComponent(settings))}><Icon name="down" size={16} />Download .tsx</button>
            </div>
          </aside>
        </div>
      </div>
      <Toast message={message} />
    </dialog>
  );
}
