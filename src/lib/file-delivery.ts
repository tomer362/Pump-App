/**
 * Hand a generated file to the user — client only.
 *
 * The delivery path matters more than it looks. `<a download>` on a blob URL is
 * unreliable in an installed iOS PWA — a blob navigation in standalone display
 * mode either renders the file as text in a new context or does nothing, and it
 * can bounce the user out of the app entirely. Since this app is meant to live
 * on a home screen, the native share sheet leads and the anchor is the
 * desktop/Android fallback, with the clipboard behind both.
 */

export type Delivery = "shared" | "downloaded" | "copied";

export async function deliverFile(
  filename: string,
  body: string,
  mime: string,
): Promise<Delivery> {
  const file = new File([body], filename, { type: mime });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch {
      /* Dismissed, or the sheet refused the file — fall through. */
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously races the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return "downloaded";
  } catch {
    await navigator.clipboard.writeText(body);
    return "copied";
  }
}
