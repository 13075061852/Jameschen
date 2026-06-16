// High-level asset read/write operations built on top of customerDb.
// Dependencies: db/customerDb.js, config/constants.js, utils/asset.js

import { STORED_ASSET_PREFIX } from '../config/constants.js';
import { saveAssetToIndexedDb, readAssetFromIndexedDb } from './customerDb.js';
import { getStoredAssetId } from '../utils/asset.js';

export async function saveDataUrlAsset({ dataUrl, name = '', type = '', size = 0, kind = 'file' }) {
  const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await saveAssetToIndexedDb({
    id,
    dataUrl,
    name,
    type,
    size,
    kind,
    createdAt: new Date().toISOString(),
  });
  return `${STORED_ASSET_PREFIX}${id}`;
}

export async function resolveStoredAssetDataUrl(url = '') {
  const assetId = getStoredAssetId(url);
  if (!assetId) return url;
  const asset = await readAssetFromIndexedDb(assetId);
  if (!asset?.dataUrl) {
    throw new Error('资源不存在或已损坏');
  }
  return asset.dataUrl;
}

export async function resolveStoredAssetDataUrlWithRetry(url = '', retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await resolveStoredAssetDataUrl(url);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('资源不存在或已损坏');
}

export async function readAssetsForBackup(assetIds) {
  const assets = {};
  for (const assetId of assetIds) {
    const asset = await readAssetFromIndexedDb(assetId);
    if (asset) assets[assetId] = asset;
  }
  return assets;
}

export async function importBackupAssets(assets = {}) {
  const entries = Object.entries(assets);
  for (const [id, asset] of entries) {
    if (!asset?.dataUrl) continue;
    await saveAssetToIndexedDb({ ...asset, id: asset.id || id });
  }
}
