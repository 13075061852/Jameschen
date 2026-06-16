// URL normalization utilities.
// No dependency on component state.

export function normalizeEditorUrl(value = '') {
  const url = value.trim();
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

export function normalizeWebsiteUrl(value = '') {
  const url = value.trim();
  if (!url) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

export function normalizeEmailHref(value = '') {
  const email = value.trim();
  if (!email) return '';
  return `mailto:${email}`;
}

export function getLogoPalette(value = '') {
  const palettes = [
    ['#0f766e', '#14b8a6', '#ffffff'],
    ['#7c3aed', '#a78bfa', '#ffffff'],
    ['#be123c', '#fb7185', '#ffffff'],
    ['#0369a1', '#38bdf8', '#ffffff'],
    ['#b45309', '#f59e0b', '#ffffff'],
    ['#166534', '#22c55e', '#ffffff'],
    ['#4338ca', '#818cf8', '#ffffff'],
    ['#475569', '#94a3b8', '#ffffff'],
  ];
  const seed = Array.from(value || '新').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[seed % palettes.length];
}
