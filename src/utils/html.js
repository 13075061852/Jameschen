// Pure HTML string utilities (escape, detect, convert, measure).
// No dependency on component state. May use DOM for parsing (document.createElement).

export function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function toEditorHtml(value = '') {
  return looksLikeHtml(value) ? value : escapeHtml(value);
}

export function getTextLengthFromHtml(value = '') {
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  return container.textContent?.replace(/\u200b/g, '').length ?? 0;
}

export function getPlainTextFromHtml(value = '') {
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  return (container.textContent ?? '').replace(/\u200b/g, '');
}
