// Backup payload creation and asset collection utilities.
// Dependencies: config/constants.js, utils/html.js, utils/asset.js, utils/editorDom.js

import { BACKUP_VERSION } from '../config/constants.js';
import { toEditorHtml } from './html.js';
import { getStoredAssetId } from './asset.js';
import { stripTransientObjectUrlsFromEditorHtml } from './editorDom.js';

export function makeBackupPayload({ customers, globalFieldLabels, layout, viewState }) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'personal-workflow-manager',
    customers,
    globalFieldLabels,
    layout,
    viewState,
  };
}

export function collectAssetIdsFromHtml(html = '') {
  if (!html || typeof document === 'undefined') return [];
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(html);
  const ids = new Set();
  container.querySelectorAll('img[src], img[data-editor-src]').forEach((image) => {
    const id = getStoredAssetId(image.getAttribute('data-editor-src') || image.getAttribute('src') || '');
    if (id) ids.add(id);
  });
  container.querySelectorAll('video[src], video[data-editor-src]').forEach((video) => {
    const id = getStoredAssetId(video.getAttribute('data-editor-src') || video.getAttribute('src') || '');
    if (id) ids.add(id);
  });
  container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]').forEach((frame) => {
    const id = getStoredAssetId(frame.getAttribute('data-attachment-url') || '');
    if (id) ids.add(id);
  });
  return Array.from(ids);
}

export function collectAssetIdsFromCustomers(customers) {
  const ids = new Set();
  customers.forEach((customer) => {
    collectAssetIdsFromHtml(customer.messyNotes ?? '').forEach((id) => ids.add(id));
    (customer.timeline ?? []).forEach((item) => {
      collectAssetIdsFromHtml(item.documentContent ?? item.content ?? '').forEach((id) => ids.add(id));
    });
  });
  return Array.from(ids);
}

// Note: readAssetsForBackup and importBackupAssets are async and depend on
// db/assetStore.js. They are re-exported here for convenience but defined in db/assetStore.js.
export { readAssetsForBackup, importBackupAssets } from '../db/assetStore.js';
