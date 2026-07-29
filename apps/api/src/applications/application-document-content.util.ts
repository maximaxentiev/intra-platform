/** Safe filename for Content-Disposition (no path segments or control chars). */
export function sanitizeDownloadFilename(name: string): string {
  const base = name.replace(/[/\\<>:"|?*\x00-\x1f]/g, '_').trim();
  return (base || 'document').slice(0, 200);
}

/** PDF and common image types support inline browser preview. */
export function isInlinePreviewContentType(contentType: string, filename: string): boolean {
  const fn = filename.toLowerCase();
  if (/\.docx?$/i.test(fn)) return false;

  const ct = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (ct.includes('word') || ct.includes('msword')) return false;
  if (ct === 'application/pdf' || ct.startsWith('image/')) return true;
  return /\.(pdf|png|jpe?g)$/.test(fn);
}

export function buildContentDisposition(filename: string, inline: boolean): string {
  const safe = sanitizeDownloadFilename(filename).replace(/"/g, '');
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${safe}"`;
}
