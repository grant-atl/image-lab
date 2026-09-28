import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function MobileNav({ onPlayground, onDownload, reducedMotion, effectCount }: {
  onPlayground: () => void;
  onDownload: () => void;
  reducedMotion: boolean;
  effectCount: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.toggleAttribute("inert", !open);
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      toggleRef.current?.focus();
      setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const resize = () => {
      if (window.innerWidth > 1000) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  const select = () => {
    toggleRef.current?.focus();
    setOpen(false);
  };
  const rows = {
    closed: { opacity: 0, y: reducedMotion ? 0 : -4, transition: { duration: reducedMotion ? 0 : 0.12 } },
    open: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0 : 0.18, delay: reducedMotion ? 0 : index * 0.035 },
    }),
  };

  return (
    <div
      className="mobile-nav"
      ref={wrapperRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="mobile-menu-toggle"
        ref={toggleRef}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        Menu
        <span className="mobile-menu-icon" aria-hidden="true">
          <motion.span animate={{ y: open ? 0 : -3, rotate: open ? 45 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} />
          <motion.span animate={{ y: open ? 0 : 3, rotate: open ? -45 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            ref={panelRef}
            className="mobile-menu-panel"
            id="mobile-navigation"
            aria-label="Mobile navigation"
            initial="closed"
            animate="open"
            exit="closed"
            variants={{
              closed: { opacity: 0, y: reducedMotion ? 0 : -8, scale: reducedMotion ? 1 : 0.98, transition: { duration: reducedMotion ? 0 : 0.16 } },
              open: { opacity: 1, y: 0, scale: 1, transition: { duration: reducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <motion.a className="mobile-menu-link" href="#collection" aria-current="page" variants={rows} custom={0} onClick={select}>
              Image reveals <span className="mobile-menu-arrow" aria-hidden="true">{effectCount}</span>
            </motion.a>
            <motion.button type="button" className="mobile-menu-link" variants={rows} custom={1} onClick={() => { select(); onPlayground(); }}>
              Playground <span className="mobile-menu-arrow" aria-hidden="true">→</span>
            </motion.button>
            <motion.a className="mobile-menu-link" href="https://dotlab.grantpedersen.com/" target="_blank" rel="noreferrer" variants={rows} custom={2} onClick={select}>
              Dot Lab <span className="mobile-menu-arrow" aria-hidden="true">↗</span>
            </motion.a>
            <motion.button type="button" className="mobile-menu-link" variants={rows} custom={3} onClick={() => { select(); onDownload(); }}>
              Get the source <span className="mobile-menu-arrow" aria-hidden="true">↓</span>
            </motion.button>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
