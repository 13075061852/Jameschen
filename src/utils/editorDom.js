// Editor DOM manipulation utilities: normalize media sources, strip transient URLs,
// normalize workflow content, timestamp protection, etc.
// Dependencies: utils/html.js (toEditorHtml), utils/asset.js (isStoredAssetUrl)

import { toEditorHtml } from './html.js';
import { isStoredAssetUrl } from './asset.js';

export function normalizeEditorMediaSourcesInElement(container) {
  container.querySelectorAll('img[src], img[data-editor-src], video[src], video[data-editor-src]').forEach((element) => {
    const editorSrc = element.getAttribute('data-editor-src') || '';
    const src = element.getAttribute('src') || '';
    const persistentSrc = editorSrc && !editorSrc.startsWith('blob:') ? editorSrc : '';

    if (isStoredAssetUrl(persistentSrc)) {
      element.removeAttribute('src');
      element.setAttribute('data-editor-src', persistentSrc);
    } else if (persistentSrc) {
      element.setAttribute('src', persistentSrc);
      element.setAttribute('data-editor-src', persistentSrc);
    } else if (src.startsWith('blob:')) {
      element.removeAttribute('src');
      element.removeAttribute('data-editor-src');
    }

    element.removeAttribute('data-object-url');
  });
}

export function stripTransientObjectUrlsFromEditorHtml(content) {
  if (!content) return content;
  if (typeof document === 'undefined') {
    return content
      .replace(/\sdata-object-url=(["'])[\s\S]*?\1/g, '')
      .replace(/\ssrc=(["'])blob:[\s\S]*?\1/g, '')
      .replace(/\sdata-editor-src=(["'])blob:[\s\S]*?\1/g, '');
  }

  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(content);
  normalizeEditorMediaSourcesInElement(container);
  return container.innerHTML;
}

export function stripTransientObjectUrlsFromCustomers(customers) {
  return customers.map((customer) => ({
    ...customer,
    timeline: (customer.timeline ?? []).map((item) => ({
      ...item,
      documentContent: stripTransientObjectUrlsFromEditorHtml(item.documentContent ?? item.content ?? ''),
    })),
  }));
}

export function stripAttachmentDataForLocalStorage(customers) {
  // Remove large attachment payloads from the localStorage fallback only.
  // Inline editor images must keep their data URLs so they survive refreshes.
  const stripDocumentContent = (content) => {
    if (!content) return content;
    if (typeof document === 'undefined') {
      return content.replace(
        /(data-attachment-url=(["']))data:[\s\S]*?\2/g,
        '$1[附件-大数据已压缩]$2'
      );
    }

    const container = document.createElement('div');
    container.innerHTML = toEditorHtml(content);
    container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]').forEach((frame) => {
      const url = frame.getAttribute('data-attachment-url') || '';
      if (url.startsWith('data:')) {
        frame.setAttribute('data-attachment-url', '[附件-大数据已压缩]');
      }
    });
    return container.innerHTML;
  };

  return customers.map((customer) => ({
    ...customer,
    timeline: (customer.timeline ?? []).map((item) => {
      if (!item.documentContent) return item;
      return { ...item, documentContent: stripDocumentContent(item.documentContent) };
    }),
  }));
}

export function trimWorkflowHtmlEdges(value = '') {
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);

  const isEmptyNode = (node) => {
    if (!node) return true;
    if (node.nodeType === Node.TEXT_NODE) {
      return !(node.textContent ?? '').trim();
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return true;

    const element = node;
    const mediaTags = ['IMG', 'VIDEO', 'IFRAME', 'TABLE', 'UL', 'OL', 'BLOCKQUOTE', 'HR'];
    if (mediaTags.includes(element.tagName)) return false;

    const text = (element.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    const hasMedia = element.querySelector('img,video,iframe,table,ul,ol,blockquote,hr');
    if (hasMedia) return false;

    return !text && !element.children.length;
  };

  while (container.firstChild && isEmptyNode(container.firstChild)) {
    container.removeChild(container.firstChild);
  }

  while (container.lastChild && isEmptyNode(container.lastChild)) {
    container.removeChild(container.lastChild);
  }

  return container.innerHTML;
}

export function normalizeWorkflowDocumentContent(value = '') {
  if (!value || typeof document === 'undefined') return value;
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  container.querySelectorAll('.mergedFirstTimestampHidden').forEach((element) => {
    element.classList.remove('mergedFirstTimestampHidden');
  });

  const nestedBody = container.querySelector('.singleWorkflowSection .mergedWorkflowBody')
    || container.querySelector('.mergedWorkflowSection .mergedWorkflowBody');
  if (nestedBody) {
    return nestedBody.innerHTML;
  }

  container.querySelectorAll('.mergedWorkflowMeta, .workflowTimestamps').forEach((element) => element.remove());
  return container.innerHTML;
}

export function hideFirstWorkflowTimestampForMergedView(value = '') {
  if (!value || typeof document === 'undefined') return value;
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  container.querySelectorAll('.mergedFirstTimestampHidden').forEach((element) => {
    element.classList.remove('mergedFirstTimestampHidden');
  });
  const firstTimestamp = container.querySelector('.editorTimestampBlock');
  firstTimestamp?.classList.add('mergedFirstTimestampHidden');
  return container.innerHTML;
}
