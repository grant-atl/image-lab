import { useEffect, useRef } from "react";
import { closeDialog } from "../lib/dialog";

type IconName =
  | "arrow"
  | "down"
  | "code"
  | "copy"
  | "check"
  | "pause"
  | "play"
  | "close"
  | "search"
  | "sun"
  | "moon"
  | "reset"
  | "external";
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    down: <path d="M12 4v15m-6-6 6 6 6-6" />,
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    pause: (
      <>
        <path d="M9 5v14M15 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />,
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div
      className={`toast ${message ? "visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message && (
        <>
          <Icon
            name={message.startsWith("Clipboard") ? "copy" : "check"}
            size={17}
          />
          {message}
        </>
      )}
    </div>
  );
}

export function useDialog(onClose: () => void, reducedMotion: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
      dialog?.getAnimations().forEach((animation) => animation.cancel());
      dialog?.close();
    };
  }, []);
  const close = () => closeDialog(dialogRef.current, onClose, reducedMotion);
  return {
    close,
    props: {
      ref: dialogRef,
      onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => {
        event.preventDefault();
        close();
      },
      onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
        if (event.target === event.currentTarget) close();
      },
    },
  };
}

export type CopyHandler = (text: string, message?: string) => Promise<void>;

export const COLORS = ["#baff66", "#e8ece3", "#9bc8ff", "#c5a3ff", "#ffab86"];
