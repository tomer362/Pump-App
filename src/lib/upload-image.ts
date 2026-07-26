"use client";

import { upload } from "@vercel/blob/client";

/**
 * Downscale in the browser, then upload straight to Blob storage.
 *
 * The resize is the important half: a modern phone camera produces 4-12 MB
 * per shot, and someone finishing a workout is on gym wifi with one bar. A
 * 1280px JPEG at q0.82 lands around 150-300 KB, uploads in a second, and is
 * larger than anywhere the image is ever displayed.
 */
export async function uploadImage(
  file: File,
  { prefix, maxEdge = 1280 }: { prefix: string; maxEdge?: number },
): Promise<string> {
  const resized = await downscale(file, maxEdge);
  const blob = await upload(`${prefix}/${Date.now()}.jpg`, resized, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: "image/jpeg",
  });
  return blob.url;
}

async function downscale(file: File, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    // No 2D context is vanishingly rare, but sending the original beats
    // failing outright — the route caps the size regardless.
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  return out ?? file;
}
