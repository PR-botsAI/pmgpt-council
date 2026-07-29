// Every string that reaches the DOM passes through here.
// Model output and tool output are untrusted by default.

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// Returns '' for anything we will not put in an href.
export const safeUrl = (value) => {
  if (!value) return '';
  try {
    const url = new URL(String(value), window.location.origin);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return '';
    return url.href;
  } catch {
    return '';
  }
};

export const hostOf = (value) => {
  const url = safeUrl(value);
  if (!url) return 'unverified source';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unverified source';
  }
};

// Deliberately tiny: bold and inline code only, applied AFTER escaping.
// No raw HTML from a model ever reaches innerHTML.
export const richText = (value) => escapeHtml(value)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

export const truncate = (value, max = 140) => {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
