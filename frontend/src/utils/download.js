/**
 * Browser download helpers shared by API calls and pages.
 */

/**
 * Extract a filename from a Content-Disposition header.
 * Prefers RFC 5987 `filename*=UTF-8''...` over the plain `filename="..."` form.
 * @param {string|null|undefined} header
 * @param {string} [fallback]
 * @returns {string}
 */
export function filenameFromContentDisposition(header, fallback = 'download') {
  if (!header) return fallback;

  const extended = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (extended) {
    let value = extended[1].trim().replace(/^"(.*)"$/, '$1');
    const parts = /^([^']*)'[^']*'(.*)$/.exec(value);
    if (parts) value = parts[2];
    try {
      const decoded = decodeURIComponent(value);
      if (decoded) return sanitizeFilename(decoded, fallback);
    } catch {
      // Malformed percent-encoding: fall back to the plain filename parameter.
    }
  }

  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  if (plain) {
    const value = (plain[2] ?? plain[1]).trim();
    if (value) return sanitizeFilename(value, fallback);
  }

  return fallback;
}

function sanitizeFilename(name, fallback) {
  // Strip any path components and control characters.
  const cleaned = String(name).split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned || fallback;
}

/**
 * Save a Blob to disk via a temporary object URL and an <a download> link.
 * The blob is never rendered in the app origin.
 * @param {Blob} blob
 * @param {string} filename
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Give the browser time to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

/**
 * MIME types that are safe to open inline in a new tab from the app origin.
 * Anything else (HTML, SVG, XML, JS, unknown) must be downloaded instead.
 */
const SAFE_INLINE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'text/plain',
]);

/**
 * Normalise a content type and return it only when it is safe to render inline.
 * @param {string|null|undefined} contentType
 * @returns {string|null}
 */
export function safeInlineContentType(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  return SAFE_INLINE_TYPES.has(base) ? base : null;
}
