// Asset URL helpers and data-URL conversion utilities.
// Dependencies: config/constants.js (STORED_ASSET_PREFIX)

import { STORED_ASSET_PREFIX } from '../config/constants.js';

export function makeStoredAssetUrl(id = '') {
  return `${STORED_ASSET_PREFIX}${id}`;
}

export function getStoredAssetId(value = '') {
  return typeof value === 'string' && value.startsWith(STORED_ASSET_PREFIX)
    ? value.slice(STORED_ASSET_PREFIX.length)
    : '';
}

export function isStoredAssetUrl(value = '') {
  return Boolean(getStoredAssetId(value));
}

export function getAttachmentKind(fileName = '', fileType = '') {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();
  if (lowerType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(lowerName)) return 'video';
  if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerType.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'word';
  if (lowerType.includes('excel') || lowerType.includes('spreadsheet') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'excel';
  return 'file';
}

export function dataUrlToArrayBuffer(dataUrl = '') {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export function dataUrlToBlobUrl(dataUrl = '', fallbackType = 'application/octet-stream') {
  const type = dataUrl.match(/^data:([^;,]+)/)?.[1] || fallbackType;
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  return URL.createObjectURL(new Blob([arrayBuffer], { type }));
}

export function dataUrlToBlob(dataUrl = '', fallbackType = 'application/octet-stream') {
  const type = dataUrl.match(/^data:([^;,]+)/)?.[1] || fallbackType;
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  return new Blob([arrayBuffer], { type });
}

export function imageDataUrlToPngBlob(dataUrl = '') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(dataUrlToBlob(dataUrl, 'image/png'));
          }
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('图片转换失败'));
    image.src = dataUrl;
  });
}

export function formatFileSize(size = 0) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
