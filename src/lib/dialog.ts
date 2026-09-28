export function closeDialog(
  dialog: HTMLDialogElement | null,
  onClose: () => void,
  reducedMotion: boolean,
): void {
  if (!dialog || dialog.dataset.closing) return;
  dialog.dataset.closing = "true";
  const finish = () => {
    dialog.close();
    onClose();
  };
  if (reducedMotion) {
    finish();
    return;
  }
  dialog
    .animate([{ opacity: 0, transform: "translateY(10px) scale(0.985)" }], {
      duration: 180,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards",
    })
    .finished.then(finish, () => {});
}
