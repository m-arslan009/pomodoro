/*
 * image.js — turning a file the user picked into an avatar the API will accept.
 *
 * Re-encoding through a canvas is what makes the upload safe to send: it drops every piece of
 * metadata the original carried, geotags included, because only pixels survive the redraw. It
 * also means a 12 MP phone photo leaves the browser as a few tens of kilobytes.
 */

const AVATAR_MAX_BYTES = 262_144;
const AVATAR_DIMENSION = 256;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Refuse implausible originals before decoding one — a decode allocates width × height × 4 bytes. */
const SOURCE_MAX_BYTES = 15 * 1024 * 1024;

/** @param {Blob} blob */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/** WebP first for the size, JPEG when the browser will not encode it. */
function encode(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (webp) => {
        if (webp) {
          resolve(webp);
          return;
        }
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      },
      'image/webp',
      0.85
    );
  });
}

/**
 * Validates, centre-crops to a square, and re-encodes at AVATAR_DIMENSION².
 *
 * Rejections throw an Error whose message is written to be shown to the user as-is.
 *
 * @param {File} file
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function prepareAvatar(file) {
  if (!AVATAR_TYPES.includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (file.size > SOURCE_MAX_BYTES) {
    throw new Error('That image is too large. Choose one under 15 MB.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read. Try a different one.');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_DIMENSION;
  canvas.height = AVATAR_DIMENSION;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot prepare images for upload.');
  }

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_DIMENSION,
    AVATAR_DIMENSION
  );
  bitmap.close();

  const blob = await encode(canvas);
  if (!blob) throw new Error('That image could not be prepared. Try a different one.');
  if (blob.size > AVATAR_MAX_BYTES) {
    throw new Error('That image is too detailed to store. Try a different one.');
  }

  return { blob, dataUrl: await blobToDataUrl(blob) };
}
