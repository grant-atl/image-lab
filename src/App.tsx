import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ImageReveal } from "./components/ImageReveal";
import { MobileNav } from "./components/MobileNav";
import { RevealPlayground } from "./components/RevealPlayground";
import { Icon, Toast } from "./components/ui";
import { EFFECTS, type EffectId } from "./lib/reveals";
import { SAMPLES } from "./lib/samples";

const HERO_EFFECTS: EffectId[] = ["pixel-mosaic", "liquid-metal", "dot-matrix"];

function Brand() {
  return <a className="brand" href="/" aria-label="Image Lab home">
    <span className="brand-mark" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
    <span>image<span className="brand-slash">/</span>lab<span className="brand-period">.</span></span>
  </a>;
}

export default function App() {
  const [category, setCategory] = useState("All effects");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [selected, setSelected] = useState<EffectId | null>(null);
  const [heroEffect, setHeroEffect] = useState<EffectId>("pixel-mosaic");
  const [replay, setReplay] = useState(0);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "/" && !selected && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [selected]);

  const copy = async (text: string, message = "Copied to clipboard") => {
    try { await navigator.clipboard.writeText(text); setToast(message); }
    catch { setToast("Clipboard unavailable. Use Download to save the component."); }
  };
  const stopMotion = paused || reducedMotion || !!selected;
  const shown = EFFECTS.filter(effect => (category === "All effects" || effect.category === category) && `${effect.name} ${effect.description} ${effect.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const currentHero = EFFECTS.find(effect => effect.id === heroEffect)!;
  const pauseLabel = reducedMotion ? "Reduced motion enabled" : paused ? "Play all reveals" : "Pause all reveals";

  return <>
    <a className="skip-link" href="#collection">Skip to reveals</a>
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a className="nav-active" href="#collection" aria-current="page">Image reveals <span className="nav-count">{EFFECTS.length}</span></a>
        <button onClick={() => setSelected(heroEffect)}>Playground</button>
        <a href="https://dotlab.grantpedersen.com/" target="_blank" rel="noreferrer">Dotlab <Icon name="external" size={11} /></a>
      </nav>
      <a className="header-source" href="https://github.com/grant-atl/image-lab" target="_blank" rel="noreferrer" aria-label="View source on GitHub">
        <Icon name="code" size={17} /><span>GitHub</span><Icon name="external" size={13} />
      </a>
      <MobileNav onPlayground={() => setSelected(heroEffect)} reducedMotion={reducedMotion} effectCount={EFFECTS.length} />
    </header>

    <motion.main
      className="image-page"
      initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] } }}
    >
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <h1 id="hero-heading">Image reveals<br />for React</h1>
          <p>Loaders for image generation. Choose an effect, adjust the motion, then copy the React component.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#collection">Browse library <Icon name="down" size={17} /></a>
            <button className="text-button" onClick={() => setSelected(heroEffect)}>Open playground <Icon name="arrow" size={17} /></button>
          </div>
          <div className="hero-facts">
            <span><Icon name="check" size={13} />12 effects</span>
            <span><Icon name="check" size={13} />React ready</span>
            <span><Icon name="check" size={13} />MIT licensed</span>
          </div>
        </div>
        <div className="hero-art image-hero-art">
          <div className="hero-image-frame">
            <ImageReveal key={`${heroEffect}-${replay}`} src={SAMPLES[0].src} alt={SAMPLES[0].alt} effect={heroEffect} loop duration={3.8} paused={stopMotion} />
          </div>
          <div className="hero-art-footer">
            <span><i />{currentHero.name}</span>
            <div className="hero-art-actions">
              <button className="icon-button" disabled={reducedMotion} onClick={() => { setReplay(value => value + 1); setPaused(false); }} aria-label="Replay hero reveal" title="Replay reveal"><Icon name="reset" size={15} /></button>
              <button className="icon-button" disabled={reducedMotion} onClick={() => setPaused(!paused)} aria-label={pauseLabel} title={pauseLabel}><Icon name={paused || reducedMotion ? "play" : "pause"} size={16} /></button>
              <button className="icon-button" onClick={() => setSelected(heroEffect)} aria-label={`Customize ${currentHero.name}`}><Icon name="external" size={16} /></button>
            </div>
          </div>
          <div className="hero-selector" aria-label="Hero reveal">
            {HERO_EFFECTS.map(effect => <button key={effect} className={effect === heroEffect ? "selected" : ""} aria-label={`Show ${EFFECTS.find(item => item.id === effect)!.name}`} aria-pressed={effect === heroEffect} onClick={() => setHeroEffect(effect)} />)}
          </div>
        </div>
      </section>

      <div className="collection-intro" id="collection"><h2>Library</h2><p>Select an effect to customize it.</p></div>
      <section className="collection" aria-label="Image reveal library">
        <div className="collection-toolbar">
          <div className="filters" aria-label="Filter effects">
            {["All effects", "Pixel", "Organic", "Geometric"].map(item => <button key={item} className={category === item ? "filter active" : "filter"} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}{item === "All effects" && <span>{EFFECTS.length}</span>}</button>)}
          </div>
          <div className="collection-tools">
            <label className="search-field"><Icon name="search" size={15} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an effect" aria-label="Search effects" /><kbd>/</kbd></label>
            <button className={`icon-button pause-all ${paused ? "is-paused" : ""}`} disabled={reducedMotion} onClick={() => setPaused(!paused)} aria-label={pauseLabel} title={pauseLabel}><Icon name={paused || reducedMotion ? "play" : "pause"} size={16} /></button>
          </div>
        </div>
        <div className="animation-grid">
          {shown.map(effect => {
            const index = EFFECTS.indexOf(effect);
            const sample = SAMPLES[index % SAMPLES.length];
            return <button className="animation-card image-card" key={effect.id} onClick={() => setSelected(effect.id)} aria-label={`Customize ${effect.name}: ${effect.description}`}>
              <div className="card-stage">
                <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="card-image-frame"><ImageReveal src={sample.src} alt="" effect={effect.id} loop duration={3 + (index % 3) * 0.6} paused={stopMotion} /></div>
                <span className="card-use">Customize <Icon name="arrow" size={15} /></span>
              </div>
              <div className="card-info"><div><h3>{effect.name}</h3><p>{effect.description}</p></div><span className="category-label">{effect.category}</span></div>
            </button>;
          })}
        </div>
        {!shown.length && <div className="empty-state"><h3>No matching effects.</h3><p>Try another name or clear the filters.</p><button className="button button-secondary" onClick={() => { setCategory("All effects"); setQuery(""); }}>Clear filters <Icon name="reset" size={16} /></button></div>}
        <p className="image-library-note">Show the loader while an image is generating. Reveal the image when it is ready.</p>
      </section>
    </motion.main>

    <footer className="site-footer"><Brand /><div><a href="https://dotlab.grantpedersen.com/" target="_blank" rel="noreferrer">More at Dotlab <Icon name="external" size={12} /></a><span>FREE TO USE · MIT LICENSE</span></div></footer>
    {selected && <RevealPlayground key={selected} initialEffect={selected} reducedMotion={reducedMotion} message={toast} onClose={() => setSelected(null)} onCopy={copy} />}
    {!selected && <Toast message={toast} />}
  </>;
}
