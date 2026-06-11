import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CornerDownRight,
  Database,
  Download,
  Eraser,
  Expand,
  FileText,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquareText,
  Paintbrush,
  Shrink,
  Plus,
  Redo2,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  Type,
  Underline,
  Undo2,
  Upload,
  UserRound,
  Video,
} from 'lucide-react';

const STORAGE_KEY = 'personal-workflow-manager-v1';
const CUSTOMER_DB_NAME = 'personal-workflow-manager-db';
const CUSTOMER_DB_STORE = 'records';
const CUSTOMER_ASSET_STORE = 'assets';
const LAYOUT_STORAGE_KEY = 'personal-workflow-manager-layout-v1';
const VIEW_STATE_STORAGE_KEY = 'personal-workflow-manager-view-state-v1';
const GLOBAL_FIELD_LABELS_STORAGE_KEY = 'personal-workflow-manager-global-field-labels-v1';
const BACKUP_VERSION = 1;
const CUSTOMER_GRADES = ['A', 'B', 'C', 'D'];
const EDITOR_FONT_SIZES = ['12px', '14px', '16px', '18px', '22px', '28px', '36px'];
const EDITOR_FONTS = [
  { label: 'Calibri', value: 'Calibri, "Open Sans", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '苹方', value: '"PingFang SC", sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
];
const DEFAULT_EDITOR_FONT = EDITOR_FONTS[0]; // Calibri
const EDITOR_TEXT_COLORS = ['#111111', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed'];
const EDITOR_BACKGROUND_COLORS = ['#fff7ad', '#fee2e2', '#dbeafe', '#dcfce7', '#f3e8ff', '#ffffff'];
const DEFAULT_EDITOR_TEXT_COLOR = EDITOR_TEXT_COLORS[0];
const DEFAULT_EDITOR_BACKGROUND_COLOR = EDITOR_BACKGROUND_COLORS[5];
const INLINE_EDITOR_FORMAT_TAGS = new Set(['SPAN', 'FONT', 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'MARK']);
const EDITOR_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EDITOR_VIDEO_ACCEPT = 'video/*';
const EDITOR_IMAGE_MIN_WIDTH = 80;
const DEFAULT_LEFT_PANEL_WIDTH = 360;
const DEFAULT_RIGHT_PANEL_WIDTH = 540;
const COLLAPSED_PANEL_WIDTH = 48;
const RESIZER_WIDTH = 10;
const MIN_LEFT_PANEL_WIDTH = 330;
const MIN_RIGHT_PANEL_WIDTH = 420;
const MIN_CENTER_PANEL_WIDTH = 360;
const LOCAL_STORAGE_SAFE_CUSTOMER_SIZE = 1_500_000;
const CUSTOMER_SAVE_DEBOUNCE_MS = 900;
const INITIAL_CUSTOMER_RENDER_LIMIT = 80;
const CUSTOMER_RENDER_INCREMENT = 80;
const COLLAPSED_CUSTOMER_RENDER_LIMIT = 120;
const STORED_ASSET_PREFIX = 'dbasset:';
const EDITOR_HISTORY_LIMIT = 120;
const EDITOR_DRAGGABLE_OBJECT_SELECTOR = '.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame';

const gradeMap = {
  A: '非常优质',
  B: '优质',
  C: '良好',
  D: '一般',
};

const seedCustomers = [];

const archiveFields = [
  ['company', '名字'],
  ['website', '网址'],
  ['country', '国籍'],
  ['phone', '电话'],
  ['otherContact', 'Whatsapp'],
  ['fax', 'Signal'],
  ['backup1', 'Telegram'],
  ['backup2', 'Wechat'],
  ['grade', '等级'],
  ['lastFollowDate', '最后跟进日期'],
];

function readInitialCustomers() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialCustomers = stored ? JSON.parse(stored) : seedCustomers;
    return initialCustomers.map((customer, index) => ({
      ...customer,
      serialNumber: customer.serialNumber ?? String(index + 1),
      grade: CUSTOMER_GRADES.includes(customer.grade) ? customer.grade : 'D',
      timeline: (customer.timeline ?? []).map((item, index) => ({
        ...item,
        title: item.title ?? '沟通记录',
        documentContent: stripTransientObjectUrlsFromEditorHtml(item.documentContent ?? (index === 0 ? customer.messyNotes || item.content : item.content)),
      })),
    }));
  } catch {
    return seedCustomers.map((customer, index) => ({
      ...customer,
      serialNumber: customer.serialNumber ?? String(index + 1),
      timeline: (customer.timeline ?? []).map((item, index) => ({
        ...item,
        title: item.title ?? '沟通记录',
        documentContent: stripTransientObjectUrlsFromEditorHtml(item.documentContent ?? (index === 0 ? customer.messyNotes || item.content : item.content)),
      })),
    }));
  }
}

function normalizeEditorMediaSourcesInElement(container) {
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

function stripTransientObjectUrlsFromEditorHtml(content) {
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

function stripTransientObjectUrlsFromCustomers(customers) {
  return customers.map((customer) => ({
    ...customer,
    timeline: (customer.timeline ?? []).map((item) => ({
      ...item,
      documentContent: stripTransientObjectUrlsFromEditorHtml(item.documentContent ?? item.content ?? ''),
    })),
  }));
}

function stripAttachmentDataForLocalStorage(customers) {
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

function saveCustomers(customers) {
  if (!Array.isArray(customers)) return;
  const customersForStorage = stripTransientObjectUrlsFromCustomers(customers);

  // Primary: save to IndexedDB (async, handles large data)
  saveCustomersToIndexedDb(customersForStorage).catch((error) => {
    console.error('Failed to save customers to IndexedDB — data may be lost on reload', error);
  });

  // Fallback: save to localStorage for faster cold-start reads.
  // If data is too large, we still keep IndexedDB as the primary store.
  try {
    const serializedCustomers = JSON.stringify(customersForStorage);
    if (serializedCustomers.length <= LOCAL_STORAGE_SAFE_CUSTOMER_SIZE) {
      localStorage.setItem(STORAGE_KEY, serializedCustomers);
      return;
    }
    // Data too large for full save — try stripped version as emergency fallback
    const stripped = stripAttachmentDataForLocalStorage(customersForStorage);
    const serializedStripped = JSON.stringify(stripped);
    if (serializedStripped.length <= LOCAL_STORAGE_SAFE_CUSTOMER_SIZE) {
      localStorage.setItem(STORAGE_KEY, serializedStripped);
      console.warn(
        `Customer data (${formatFileSize(serializedCustomers.length)}) exceeds localStorage limit. ` +
        `Stripped version (${formatFileSize(serializedStripped.length)}) saved as fallback. ` +
        'Full data is stored in IndexedDB.'
      );
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    console.warn(
      `Customer data (${formatFileSize(serializedCustomers.length)}) exceeds localStorage safe limit. ` +
      'Data is stored in IndexedDB only.'
    );
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    console.warn('Failed to save customers to localStorage', error);
  }
}

function cleanupUnusedAssets(customers) {
  if (!Array.isArray(customers)) return;
  deleteUnusedAssetsFromIndexedDb(collectAssetIdsFromCustomers(customers)).catch((error) => {
    console.warn('Failed to clean unused assets', error);
  });
}

function openCustomerDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CUSTOMER_DB_NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CUSTOMER_DB_STORE)) {
        request.result.createObjectStore(CUSTOMER_DB_STORE);
      }
      if (!request.result.objectStoreNames.contains(CUSTOMER_ASSET_STORE)) {
        request.result.createObjectStore(CUSTOMER_ASSET_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('IndexedDB open blocked — another tab may have the database open. Close other tabs and refresh.');
      reject(new Error('Database blocked by another connection'));
    };
  });
}

async function saveCustomersToIndexedDb(customers) {
  const db = await openCustomerDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMER_DB_STORE, 'readwrite');
      transaction.objectStore(CUSTOMER_DB_STORE).put(customers, STORAGE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function readCustomersFromIndexedDb() {
  const db = await openCustomerDb();
  try {
    const customers = await new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMER_DB_STORE, 'readonly');
      const request = transaction.objectStore(CUSTOMER_DB_STORE).get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return Array.isArray(customers) ? normalizeCustomers(customers) : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function normalizeCustomers(customers) {
  if (!Array.isArray(customers)) return [];
  return customers.map((customer, index) => ({
    ...customer,
    id: typeof customer.id === 'string' && customer.id ? customer.id : `c-import-${Date.now()}-${index}`,
    serialNumber: customer.serialNumber ?? String(index + 1),
    pinned: Boolean(customer.pinned),
    grade: CUSTOMER_GRADES.includes(customer.grade) ? customer.grade : 'D',
    timeline: (customer.timeline ?? []).map((item, itemIndex) => ({
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `t-import-${Date.now()}-${index}-${itemIndex}`,
      title: item.title ?? '沟通记录',
      documentContent: item.documentContent ?? (itemIndex === 0 ? customer.messyNotes || item.content : item.content),
    })),
  }));
}

function readInitialLayout() {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) {
      return {
        leftCollapsed: false,
        rightCollapsed: false,
        leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
        rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
      };
    }
    const parsed = JSON.parse(stored);
    return {
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
      leftPanelWidth: Number(parsed.leftPanelWidth) || DEFAULT_LEFT_PANEL_WIDTH,
      rightPanelWidth: Number(parsed.rightPanelWidth) || DEFAULT_RIGHT_PANEL_WIDTH,
    };
  } catch {
    return {
      leftCollapsed: false,
      rightCollapsed: false,
      leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
      rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
    };
  }
}

function saveLayout(layout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

function readInitialViewState() {
  try {
    const stored = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    if (!stored) {
      return {
        selectedId: '',
        selectedWorkflowId: '',
        selectedWorkflowIds: [],
        workflowViewMode: 'single',
      };
    }
    const parsed = JSON.parse(stored);
    return {
      selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : '',
      selectedWorkflowId: typeof parsed.selectedWorkflowId === 'string' ? parsed.selectedWorkflowId : '',
      selectedWorkflowIds: Array.isArray(parsed.selectedWorkflowIds)
        ? parsed.selectedWorkflowIds.filter((item) => typeof item === 'string')
        : [],
      workflowViewMode: parsed.workflowViewMode === 'merged' ? 'merged' : 'single',
    };
  } catch {
    return {
      selectedId: '',
      selectedWorkflowId: '',
      selectedWorkflowIds: [],
      workflowViewMode: 'single',
    };
  }
}

function saveViewState(viewState) {
  localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(viewState));
}

function readInitialGlobalFieldLabels() {
  try {
    const stored = localStorage.getItem(GLOBAL_FIELD_LABELS_STORAGE_KEY);
    if (!stored) return {};
    return normalizeFieldLabels(JSON.parse(stored));
  } catch {
    return {};
  }
}

function saveGlobalFieldLabels(fieldLabels) {
  localStorage.setItem(GLOBAL_FIELD_LABELS_STORAGE_KEY, JSON.stringify(fieldLabels));
}

function makeBackupPayload({ customers, globalFieldLabels, layout, viewState }) {
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

function collectAssetIdsFromHtml(html = '') {
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

function collectAssetIdsFromCustomers(customers) {
  const ids = new Set();
  customers.forEach((customer) => {
    collectAssetIdsFromHtml(customer.messyNotes ?? '').forEach((id) => ids.add(id));
    (customer.timeline ?? []).forEach((item) => {
      collectAssetIdsFromHtml(item.documentContent ?? item.content ?? '').forEach((id) => ids.add(id));
    });
  });
  return Array.from(ids);
}

async function readAssetsForBackup(assetIds) {
  const assets = {};
  for (const assetId of assetIds) {
    const asset = await readAssetFromIndexedDb(assetId);
    if (asset) assets[assetId] = asset;
  }
  return assets;
}

async function importBackupAssets(assets = {}) {
  const entries = Object.entries(assets);
  for (const [id, asset] of entries) {
    if (!asset?.dataUrl) continue;
    await saveAssetToIndexedDb({ ...asset, id: asset.id || id });
  }
}

function getCustomerIdentityKey(customer) {
  const parts = [customer.company, customer.contact, customer.email]
    .map((value) => String(value ?? '').trim().toLowerCase());
  return parts.some(Boolean) ? parts.join('|') : '';
}

function makeCustomerDuplicateKeys(customers) {
  return customers.reduce((keys, customer) => {
    if (customer.id) keys.ids.add(customer.id);
    const identityKey = getCustomerIdentityKey(customer);
    if (identityKey) keys.identities.add(identityKey);
    return keys;
  }, { ids: new Set(), identities: new Set() });
}

function isDuplicateCustomer(customer, duplicateKeys) {
  const identityKey = getCustomerIdentityKey(customer);
  return duplicateKeys.ids.has(customer.id) || (identityKey && duplicateKeys.identities.has(identityKey));
}

function getImportStats(importedCustomers, currentCustomers) {
  const duplicateKeys = makeCustomerDuplicateKeys(currentCustomers);
  const duplicateCount = importedCustomers.filter((customer) => isDuplicateCustomer(customer, duplicateKeys)).length;
  return {
    totalCount: importedCustomers.length,
    duplicateCount,
    newCount: importedCustomers.length - duplicateCount,
  };
}

function formatFileSize(size = 0) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function saveAssetToIndexedDb(asset) {
  const db = await openCustomerDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMER_ASSET_STORE, 'readwrite');
      transaction.objectStore(CUSTOMER_ASSET_STORE).put(asset, asset.id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('IndexedDB asset transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function readAssetFromIndexedDb(assetId) {
  if (!assetId) return null;
  const db = await openCustomerDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMER_ASSET_STORE, 'readonly');
      const request = transaction.objectStore(CUSTOMER_ASSET_STORE).get(assetId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function deleteUnusedAssetsFromIndexedDb(usedAssetIds = []) {
  const usedIds = new Set(usedAssetIds);
  const db = await openCustomerDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMER_ASSET_STORE, 'readwrite');
      const store = transaction.objectStore(CUSTOMER_ASSET_STORE);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        (request.result ?? []).forEach((key) => {
          if (typeof key === 'string' && !usedIds.has(key)) {
            store.delete(key);
          }
        });
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('IndexedDB asset cleanup aborted'));
    });
  } finally {
    db.close();
  }
}

async function saveDataUrlAsset({ dataUrl, name = '', type = '', size = 0, kind = 'file' }) {
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
  return makeStoredAssetUrl(id);
}

function makeStoredAssetUrl(id = '') {
  return `${STORED_ASSET_PREFIX}${id}`;
}

function getStoredAssetId(value = '') {
  return typeof value === 'string' && value.startsWith(STORED_ASSET_PREFIX)
    ? value.slice(STORED_ASSET_PREFIX.length)
    : '';
}

function isStoredAssetUrl(value = '') {
  return Boolean(getStoredAssetId(value));
}

function getAttachmentKind(fileName = '', fileType = '') {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();
  if (lowerType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(lowerName)) return 'video';
  if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerType.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'word';
  if (lowerType.includes('excel') || lowerType.includes('spreadsheet') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'excel';
  return 'file';
}

function dataUrlToArrayBuffer(dataUrl = '') {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function resolveStoredAssetDataUrl(url = '') {
  const assetId = getStoredAssetId(url);
  if (!assetId) return url;
  const asset = await readAssetFromIndexedDb(assetId);
  if (!asset?.dataUrl) {
    throw new Error('资源不存在或已损坏');
  }
  return asset.dataUrl;
}

function dataUrlToBlobUrl(dataUrl = '', fallbackType = 'application/octet-stream') {
  const type = dataUrl.match(/^data:([^;,]+)/)?.[1] || fallbackType;
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  return URL.createObjectURL(new Blob([arrayBuffer], { type }));
}

function dataUrlToBlob(dataUrl = '', fallbackType = 'application/octet-stream') {
  const type = dataUrl.match(/^data:([^;,]+)/)?.[1] || fallbackType;
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  return new Blob([arrayBuffer], { type });
}

function imageDataUrlToPngBlob(dataUrl = '') {
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

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function looksLikeHtml(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toEditorHtml(value = '') {
  return looksLikeHtml(value) ? value : escapeHtml(value);
}

function getTextLengthFromHtml(value = '') {
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  return container.textContent?.replace(/\u200b/g, '').length ?? 0;
}

function getPlainTextFromHtml(value = '') {
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);
  return (container.textContent ?? '').replace(/\u200b/g, '');
}

function trimWorkflowHtmlEdges(value = '') {
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

function normalizeWorkflowDocumentContent(value = '') {
  if (!value || typeof document === 'undefined') return value;
  const container = document.createElement('div');
  container.innerHTML = toEditorHtml(value);

  const nestedBody = container.querySelector('.singleWorkflowSection .mergedWorkflowBody')
    || container.querySelector('.mergedWorkflowSection .mergedWorkflowBody');
  if (nestedBody) {
    return nestedBody.innerHTML;
  }

  container.querySelectorAll('.mergedWorkflowMeta, .workflowTimestamps').forEach((element) => element.remove());
  return container.innerHTML;
}

function getLegacyWorkflowEditHistory(item = {}) {
  return Array.isArray(item.editHistory)
    ? item.editHistory
        .map((entry) => (typeof entry === 'string' ? { at: entry } : entry))
        .filter((entry) => typeof entry?.at === 'string' && entry.at)
    : [];
}

function getWorkflowCreatedAt(item = {}) {
  const legacyHistory = getLegacyWorkflowEditHistory(item);
  return item.createdAt || legacyHistory[0]?.at || item.date || '';
}

function markWorkflowContentEdited(entry, nextContent, now = new Date()) {
  const currentContent = stripTransientObjectUrlsFromEditorHtml(normalizeWorkflowDocumentContent(entry.documentContent ?? entry.content ?? ''));
  const normalizedNextContent = stripTransientObjectUrlsFromEditorHtml(normalizeWorkflowDocumentContent(nextContent));
  if (normalizedNextContent === currentContent) return entry;

  const timestamp = now.toISOString();

  return {
    ...entry,
    documentContent: normalizedNextContent,
    createdAt: getWorkflowCreatedAt(entry) || timestamp,
    lastEditedAt: timestamp,
  };
}

/**
 * Merge two customer arrays by keeping the newest data for each timeline entry
 * based on `lastEditedAt`. This prevents IndexedDB (async, may be stale) from
 * overwriting localStorage data (sync, always latest) on page load.
 *
 * Entries missing from one source are kept; for matching entries, the one with
 * the more recent `lastEditedAt` wins. If neither has `lastEditedAt`, the
 * current (localStorage) entry is preferred.
 */
function mergeCustomersWithLatestData(currentCustomers, storedCustomers) {
  const storedById = new Map();
  for (let i = 0; i < storedCustomers.length; i += 1) {
    const customer = storedCustomers[i];
    if (customer?.id) storedById.set(customer.id, customer);
  }

  return currentCustomers.map((currentCustomer) => {
    const storedCustomer = storedById.get(currentCustomer.id);
    if (!storedCustomer) return currentCustomer;

    // Merge timeline: prefer newer lastEditedAt; keep entries from both sources
    const currentTimeline = currentCustomer.timeline ?? [];
    const storedTimeline = storedCustomer.timeline ?? [];
    const storedTimelineById = new Map();
    for (let i = 0; i < storedTimeline.length; i += 1) {
      const entry = storedTimeline[i];
      if (entry?.id) storedTimelineById.set(entry.id, entry);
    }

    const mergedTimeline = currentTimeline.map((currentEntry) => {
      const storedEntry = storedTimelineById.get(currentEntry.id);
      if (!storedEntry) return currentEntry;

      const currentTime = currentEntry.lastEditedAt
        ? new Date(currentEntry.lastEditedAt).getTime() : 0;
      const storedTime = storedEntry.lastEditedAt
        ? new Date(storedEntry.lastEditedAt).getTime() : 0;

      return storedTime > currentTime ? storedEntry : currentEntry;
    });

    // Append entries that exist only in stored
    const currentEntryIds = new Set();
    for (let i = 0; i < currentTimeline.length; i += 1) {
      if (currentTimeline[i]?.id) currentEntryIds.add(currentTimeline[i].id);
    }
    for (let i = 0; i < storedTimeline.length; i += 1) {
      const entry = storedTimeline[i];
      if (entry?.id && !currentEntryIds.has(entry.id)) {
        mergedTimeline.push(entry);
      }
    }

    return { ...currentCustomer, timeline: mergedTimeline };
  });
}

function normalizeEditorUrl(value = '') {
  const url = value.trim();
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

function makeArchiveDraft(customer, globalFieldLabels = {}) {
  if (!customer) return null;
  const draft = archiveFields.reduce((nextDraft, [key]) => {
    nextDraft[key] = customer[key] ?? '';
    return nextDraft;
  }, { id: customer.id });
  draft.fieldLabels = archiveFields.reduce((labels, [key, defaultLabel]) => {
    labels[key] = customer?.fieldLabels?.[key] ?? globalFieldLabels?.[key] ?? defaultLabel;
    return labels;
  }, {});
  return draft;
}

function getArchiveFieldLabel(customer, globalFieldLabels, fieldKey, defaultLabel) {
  return customer?.fieldLabels?.[fieldKey] || globalFieldLabels?.[fieldKey] || defaultLabel;
}

function normalizeFieldLabels(fieldLabels = {}, fallbackLabels = {}) {
  return archiveFields.reduce((labels, [key, defaultLabel]) => {
    const label = fieldLabels[key]?.trim();
    const fallbackLabel = fallbackLabels[key] ?? defaultLabel;
    if (label && label !== fallbackLabel) {
      labels[key] = label;
    }
    return labels;
  }, {});
}

function App() {
  const initialLayout = readInitialLayout();
  const initialViewState = readInitialViewState();
  const [customers, setCustomers] = useState(readInitialCustomers);
  const customersRef = useRef(customers);
  const userModifiedSinceLoad = useRef(false);
  const [globalFieldLabels, setGlobalFieldLabels] = useState(readInitialGlobalFieldLabels);
  const [selectedId, setSelectedId] = useState(() => initialViewState.selectedId || customers[0]?.id || '');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => initialViewState.selectedWorkflowId || '');
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState(() => initialViewState.selectedWorkflowIds || []);
  const [workflowViewMode, setWorkflowViewMode] = useState(() => initialViewState.workflowViewMode || 'single');
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('全部');
  const [customerRenderLimit, setCustomerRenderLimit] = useState(INITIAL_CUSTOMER_RENDER_LIMIT);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [editingWorkflowTitleId, setEditingWorkflowTitleId] = useState('');
  const [workflowSortOrder, setWorkflowSortOrder] = useState('desc');
  const [archiveEditing, setArchiveEditing] = useState(false);
  const [archiveDraft, setArchiveDraft] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState(new Set());
  const [leftCollapsed, setLeftCollapsed] = useState(initialLayout.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initialLayout.rightCollapsed);
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialLayout.leftPanelWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialLayout.rightPanelWidth);
  const [activeResizer, setActiveResizer] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSelectedIds, setMentionSelectedIds] = useState([]);
  const [mentionWorkflowTitle, setMentionWorkflowTitle] = useState('');
  const [mentionSourceHtml, setMentionSourceHtml] = useState('');
  // Per-customer distribution target: customerId -> workflowId ('' = create new workflow)
  const [mentionTargets, setMentionTargets] = useState({});
  const [mentionFocusedCustomerId, setMentionFocusedCustomerId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeEditorFontSize, setActiveEditorFontSize] = useState('');
  const [activeEditorFontFamily, setActiveEditorFontFamily] = useState('');
  const [activeEditorTextColor, setActiveEditorTextColor] = useState(DEFAULT_EDITOR_TEXT_COLOR);
  const [activeEditorBackgroundColor, setActiveEditorBackgroundColor] = useState(DEFAULT_EDITOR_BACKGROUND_COLOR);
  const [editorHydrationVersion, setEditorHydrationVersion] = useState(0);
  const [customerStoreHydrated, setCustomerStoreHydrated] = useState(false);
  const boardRef = useRef(null);
  const editorRef = useRef(null);
  const editorSelectionRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const imageDragStateRef = useRef(null);
  const imageDragGhostRef = useRef(null);
  const imageDropMarkerRef = useRef(null);
  const imageDragRafRef = useRef(null);
  const imageDragLastEventRef = useRef(null);
  const editorSyncTimerRef = useRef(null);
  const editorDirtyRef = useRef(false);
  const skipNextEditorSelectionSaveRef = useRef(false);
  const editorHistoryRef = useRef({
    undoStack: [],
    redoStack: [],
    lastHtml: '',
    isRestoring: false,
  });
  const workflowSelectionByCustomerRef = useRef(new Map());
  const customerSaveTimerRef = useRef(null);
  const editorObjectUrlsRef = useRef(new Set());
  const formatPainterRef = useRef(null);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const selectedCustomer = customers.find((customer) => customer.id === selectedId) ?? null;
  const archiveCustomer = archiveEditing && archiveDraft?.id === selectedCustomer?.id
    ? archiveDraft
    : selectedCustomer;
  const selectedCustomerTimeline = selectedCustomer?.timeline ?? [];
  const sortedTimeline = useMemo(() => {
    if (workflowSortOrder === 'asc') {
      return [...selectedCustomerTimeline].reverse();
    }
    return selectedCustomerTimeline;
  }, [selectedCustomerTimeline, workflowSortOrder]);
  const focusedWorkflow = selectedCustomer?.timeline?.find((item) => item.id === selectedWorkflowId) ?? null;
  const selectedWorkflow = focusedWorkflow
    ?? selectedCustomerTimeline[0]
    ?? null;
  const mergedWorkflows = selectedCustomerTimeline.filter((item) => selectedWorkflowIds.includes(item.id));
  const isMergedWorkflowView = workflowViewMode === 'merged';
  const activeWorkflowForActions = isMergedWorkflowView
    ? (focusedWorkflow && selectedWorkflowIds.includes(focusedWorkflow.id) ? focusedWorkflow : null)
    : selectedWorkflow;
  const renderWorkflowEditorSection = (item, extraClass = '') => {
    const content = trimWorkflowHtmlEdges(normalizeWorkflowDocumentContent(item.documentContent ?? item.content ?? ''));
    const showMeta = !extraClass.includes('singleWorkflowSection');
    return [
      `<section class="mergedWorkflowSection${extraClass ? ` ${extraClass}` : ''}" data-workflow-id="${item.id}">`,
      showMeta ? `<div class="mergedWorkflowMeta" contenteditable="false">` +
      `<span>${escapeHtml(item.date ?? '')}</span>` +
      `<span>${escapeHtml(item.title ?? item.content ?? '沟通记录')}</span>` +
      `<span class="statusTag status${item.status}">${escapeHtml(item.status ?? '')}</span>` +
      `</div>` : '',
      `<div class="mergedWorkflowBody" contenteditable="true">${toEditorHtml(content)}</div>`,
      `</section>`,
    ].join('');
  };
  const selectedWorkflowContent = selectedWorkflow
    ? selectedWorkflow.documentContent ?? selectedWorkflow.content ?? ''
    : selectedCustomer?.messyNotes ?? '';
  const editorContent = isMergedWorkflowView
    ? mergedWorkflows.map((item) => renderWorkflowEditorSection(item)).join('')
    : selectedWorkflow
      ? renderWorkflowEditorSection(selectedWorkflow, 'singleWorkflowSection')
      : selectedWorkflowContent;
  const mergedWorkflowMetaKey = isMergedWorkflowView
    ? mergedWorkflows.map((item) => [
      item.id,
      item.date ?? '',
      item.title ?? item.content ?? '沟通记录',
      item.status ?? '',
    ].join(':')).join('|')
    : '';
  const singleWorkflowMetaKey = !isMergedWorkflowView && selectedWorkflow
    ? [
      selectedWorkflow.id,
      selectedWorkflow.date ?? '',
      selectedWorkflow.title ?? selectedWorkflow.content ?? '沟通记录',
      selectedWorkflow.status ?? '',
    ].join(':')
    : '';
  const editorKey = isMergedWorkflowView
    ? `merged:${selectedCustomer?.id ?? 'empty'}:${selectedWorkflowIds.join(',')}`
    : selectedWorkflow
      ? selectedWorkflow.id
      : selectedCustomer?.id ?? 'empty-editor';
  const canEditEditor = Boolean(selectedCustomer) && (!isMergedWorkflowView || mergedWorkflows.length > 0);
  const editorWordCount = useMemo(() => getTextLengthFromHtml(selectedWorkflowContent), [selectedWorkflowContent]);
  const selectedCustomerTitle = selectedCustomer
    ? (selectedCustomer.displayTitle || [selectedCustomer.company || '未命名用户', selectedCustomer.country].filter(Boolean).join(' · '))
    : '未命名用户';

  const filteredCustomers = useMemo(() => {
    return customers
      .filter((customer) => {
        const haystack = `${customer.company} ${customer.contact} ${customer.country} ${customer.email}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase()) && (gradeFilter === '全部' || customer.grade === gradeFilter);
      })
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [customers, gradeFilter, query]);
  const visibleCustomers = useMemo(() => (
    filteredCustomers.slice(0, customerRenderLimit)
  ), [customerRenderLimit, filteredCustomers]);
  const collapsedVisibleCustomers = useMemo(() => (
    filteredCustomers.slice(0, COLLAPSED_CUSTOMER_RENDER_LIMIT)
  ), [filteredCustomers]);
  const hasMoreCustomers = filteredCustomers.length > visibleCustomers.length;

  const filteredMentionCustomers = useMemo(() => {
    const base = mentionQuery.trim()
      ? customers.filter((customer) =>
          `${customer.company} ${customer.contact} ${customer.country}`.toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : customers;
    return base;
  }, [customers, mentionQuery]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((customer) => customer.timeline?.[0]?.status !== '暂停').length,
    };
  }, [customers]);

  const editorExpanded = leftCollapsed && rightCollapsed;
  const boardStyle = useMemo(() => ({
    gridTemplateColumns: `${leftCollapsed ? COLLAPSED_PANEL_WIDTH : leftPanelWidth}px ${RESIZER_WIDTH}px minmax(0, 1fr) ${RESIZER_WIDTH}px ${rightCollapsed ? COLLAPSED_PANEL_WIDTH : rightPanelWidth}px`,
  }), [leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    if (!selectedId || !selectedWorkflowId) return;
    const workflows = customers.find((customer) => customer.id === selectedId)?.timeline ?? [];
    if (workflows.some((workflow) => workflow.id === selectedWorkflowId)) {
      workflowSelectionByCustomerRef.current.set(selectedId, selectedWorkflowId);
    }
  }, [customers, selectedId, selectedWorkflowId]);

  useEffect(() => {
    setCustomerRenderLimit(INITIAL_CUSTOMER_RENDER_LIMIT);
    exitBatchMode();
  }, [gradeFilter, query]);

  useEffect(() => {
    if (!editorRef.current || isMergedWorkflowView) return;
    editorRef.current.innerHTML = toEditorHtml(stripStoredAssetSrcBeforeDomInsert(editorContent));
    prepareEditorImages();
    prepareEditorVideos();
    prepareEditorAttachments();
    editorSelectionRef.current = null;
    resetEditorHistory();
  }, [editorKey, isMergedWorkflowView, singleWorkflowMetaKey, editorHydrationVersion]);

  useEffect(() => {
    if (!editorRef.current || !isMergedWorkflowView) return;
    editorRef.current.innerHTML = toEditorHtml(stripStoredAssetSrcBeforeDomInsert(editorContent));
    prepareEditorImages();
    prepareEditorVideos();
    prepareEditorAttachments();
    editorSelectionRef.current = null;
    resetEditorHistory();
  }, [editorKey, isMergedWorkflowView, mergedWorkflowMetaKey, editorHydrationVersion]);

  useEffect(() => () => {
    cancelAnimationFrame(imageDragRafRef.current);
    clearTimeout(editorSyncTimerRef.current);
    clearTimeout(customerSaveTimerRef.current);
    editorObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    editorObjectUrlsRef.current.clear();
    removeCustomImageDragListeners();
    removeImageDragGhost();
    removeImageDropMarker();
    imageDragStateRef.current = null;
    imageDragLastEventRef.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;

    function handleNativeEditorInput() {
      saveCurrentEditorContent();
    }

    editor.addEventListener('input', handleNativeEditorInput);
    return () => editor.removeEventListener('input', handleNativeEditorInput);
  }, [editorKey, isMergedWorkflowView, editorHydrationVersion]);

  // Capture editor selection on every mouseup, even when the mouse is released
  // outside the editor container (e.g. dragging from right to left across the
  // panel boundary). Without this, saveEditorSelection() never fires for
  // out-of-bounds releases and formatting operations silently fail.
  useEffect(() => {
    function handleGlobalMouseUp() {
      if (skipNextEditorSelectionSaveRef.current) {
        skipNextEditorSelectionSaveRef.current = false;
        return;
      }
      saveEditorSelection();
    }
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    function handleSelectionChange() {
      updateEditorRangeSelectionState();
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Emergency flush: save latest data to localStorage before the tab closes.
  // IndexedDB writes are async and may not complete in time, so we also
  // sync to localStorage synchronously on beforeunload as a safety net.
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        flushEditorContentSync();
        flushCustomersSave();
        const currentCustomers = stripTransientObjectUrlsFromCustomers(customersRef.current);
        const serialized = JSON.stringify(currentCustomers);
        if (serialized.length <= LOCAL_STORAGE_SAFE_CUSTOMER_SIZE) {
          localStorage.setItem(STORAGE_KEY, serialized);
        } else {
          const stripped = stripAttachmentDataForLocalStorage(currentCustomers);
          const serializedStripped = JSON.stringify(stripped);
          if (serializedStripped.length <= LOCAL_STORAGE_SAFE_CUSTOMER_SIZE) {
            localStorage.setItem(STORAGE_KEY, serializedStripped);
          }
        }
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
          leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth,
        }));
        localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify({
          selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode,
        }));
        localStorage.setItem(GLOBAL_FIELD_LABELS_STORAGE_KEY, JSON.stringify(globalFieldLabels));
      } catch (error) {
        console.warn('beforeunload save failed', error);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth,
    selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode,
    globalFieldLabels]);

  useEffect(() => {
    let canceled = false;

    readCustomersFromIndexedDb()
      .then((storedCustomers) => {
        if (canceled || !storedCustomers) return;
        // If the user has already modified data before IndexedDB loaded,
        // don't overwrite their changes to prevent data loss.
        if (userModifiedSinceLoad.current) {
          console.warn('Skipped IndexedDB overwrite because user has already modified data');
          return;
        }
        const currentCustomers = customersRef.current;
        const normalizedStoredCustomers = stripTransientObjectUrlsFromCustomers(storedCustomers);
        const selectedExistsInCurrent = currentCustomers.some((customer) => customer.id === selectedId);
        const selectedExistsInStored = normalizedStoredCustomers.some((customer) => customer.id === selectedId);
        if (selectedId && selectedExistsInCurrent && !selectedExistsInStored) {
          saveCustomers(currentCustomers);
          return;
        }
        // Merge: prefer the newest data by lastEditedAt. IndexedDB writes are
        // async and may not have flushed before a page refresh, so IndexedDB
        // data can be stale and must not unconditionally overwrite the sync
        // localStorage data (read in readInitialCustomers).
        const mergedCustomers = mergeCustomersWithLatestData(currentCustomers, normalizedStoredCustomers);
        setCustomers(mergedCustomers);
        customersRef.current = mergedCustomers;
        setEditorHydrationVersion((version) => version + 1);
        if (!mergedCustomers.some((customer) => customer.id === selectedId)) {
          setSelectedId(mergedCustomers[0]?.id ?? '');
          setSelectedWorkflowId('');
          setSelectedWorkflowIds([]);
        }
      })
      .catch((error) => {
        console.warn('Failed to load customers from IndexedDB', error);
      })
      .finally(() => {
        if (!canceled) {
          setCustomerStoreHydrated(true);
        }
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    setArchiveEditing(false);
    setArchiveDraft(null);
  }, [selectedCustomer?.id]);

  useEffect(() => () => {
    if (attachmentPreview?.previewUrl) {
      URL.revokeObjectURL(attachmentPreview.previewUrl);
    }
  }, [attachmentPreview?.previewUrl]);

  useEffect(() => {
    saveLayout({ leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth });
  }, [leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    saveViewState({ selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode });
  }, [selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode]);

  useEffect(() => {
    if (customers.length === 0) {
      if (selectedId) setSelectedId('');
      if (selectedWorkflowId) setSelectedWorkflowId('');
      if (selectedWorkflowIds.length > 0) setSelectedWorkflowIds([]);
      return;
    }

    const hasSelectedCustomer = customers.some((customer) => customer.id === selectedId);
    if (!hasSelectedCustomer) {
      if (!customerStoreHydrated && selectedId) return;
      setSelectedId(customers[0]?.id ?? '');
      setSelectedWorkflowId('');
      setSelectedWorkflowIds([]);
      return;
    }

    const workflows = customers.find((customer) => customer.id === selectedId)?.timeline ?? [];
    if (selectedWorkflowIds.length > 0) {
      const nextSelectedWorkflowIds = selectedWorkflowIds.filter((item) => workflows.some((workflow) => workflow.id === item));
      if (nextSelectedWorkflowIds.length !== selectedWorkflowIds.length) {
        setSelectedWorkflowIds(nextSelectedWorkflowIds);
      }
    }

    if (!selectedWorkflowId) return;

    const hasSelectedWorkflow = workflows.some((item) => item.id === selectedWorkflowId);
    if (!hasSelectedWorkflow) {
      setSelectedWorkflowId('');
    }
  }, [customerStoreHydrated, customers, selectedId, selectedWorkflowId, selectedWorkflowIds]);

  useEffect(() => {
    if (!activeResizer) return undefined;

    const handlePointerMove = (event) => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (!boardRect) return;

      const fixedRightWidth = rightCollapsed ? COLLAPSED_PANEL_WIDTH : rightPanelWidth;
      const fixedLeftWidth = leftCollapsed ? COLLAPSED_PANEL_WIDTH : leftPanelWidth;
      const maxLeftWidth = Math.max(
        MIN_LEFT_PANEL_WIDTH,
        boardRect.width - (RESIZER_WIDTH * 2) - fixedRightWidth - MIN_CENTER_PANEL_WIDTH,
      );
      const maxRightWidth = Math.max(
        MIN_RIGHT_PANEL_WIDTH,
        boardRect.width - (RESIZER_WIDTH * 2) - fixedLeftWidth - MIN_CENTER_PANEL_WIDTH,
      );

      if (activeResizer === 'left' && !leftCollapsed) {
        const nextWidth = Math.min(Math.max(event.clientX - boardRect.left, MIN_LEFT_PANEL_WIDTH), maxLeftWidth);
        setLeftPanelWidth(Math.round(nextWidth));
      }

      if (activeResizer === 'right' && !rightCollapsed) {
        const nextWidth = Math.min(Math.max(boardRect.right - event.clientX, MIN_RIGHT_PANEL_WIDTH), maxRightWidth);
        setRightPanelWidth(Math.round(nextWidth));
      }
    };

    const stopResizing = () => {
      setActiveResizer('');
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [activeResizer, leftCollapsed, leftPanelWidth, rightCollapsed, rightPanelWidth]);

  function commitCustomers(nextCustomers, immediate = false) {
    userModifiedSinceLoad.current = true;
    setCustomers(nextCustomers);
    customersRef.current = nextCustomers;
    scheduleCustomersSave(nextCustomers, immediate);
  }

  function commitCustomersFromUpdater(updater, immediate = false) {
    userModifiedSinceLoad.current = true;
    const nextCustomers = updater(customersRef.current);
    customersRef.current = nextCustomers;
    setCustomers(nextCustomers);
    scheduleCustomersSave(nextCustomers, immediate);
    return nextCustomers;
  }

  function scheduleCustomersSave(nextCustomers, immediate = false) {
    clearTimeout(customerSaveTimerRef.current);
    customerSaveTimerRef.current = null;
    if (immediate) {
      saveCustomers(nextCustomers);
      return;
    }
    customerSaveTimerRef.current = setTimeout(() => {
      customerSaveTimerRef.current = null;
      saveCustomers(customersRef.current);
    }, CUSTOMER_SAVE_DEBOUNCE_MS);
  }

  function flushCustomersSave() {
    if (!customerSaveTimerRef.current) return;
    clearTimeout(customerSaveTimerRef.current);
    customerSaveTimerRef.current = null;
    saveCustomers(customersRef.current);
  }

  function commitGlobalFieldLabels(nextFieldLabels) {
    setGlobalFieldLabels(nextFieldLabels);
    saveGlobalFieldLabels(nextFieldLabels);
  }

  function getCustomersWithCurrentEditorContent(sourceCustomers = customersRef.current) {
    if (!editorRef.current || !selectedCustomer) return sourceCustomers;

    if (isMergedWorkflowView) {
      const sections = Array.from(editorRef.current.querySelectorAll('.mergedWorkflowSection'));
      if (sections.length === 0) return sourceCustomers;

      const contentByWorkflowId = sections.reduce((contentMap, section) => {
        const workflowId = section.getAttribute('data-workflow-id');
        const body = section.querySelector('.mergedWorkflowBody');
        if (workflowId && body) {
          contentMap.set(workflowId, body.innerHTML);
        }
        return contentMap;
      }, new Map());

      if (contentByWorkflowId.size === 0) return sourceCustomers;

      return sourceCustomers.map((customer) => {
        if (customer.id !== selectedCustomer.id) return customer;
        const timeline = (customer.timeline ?? []).map((entry) => (
          contentByWorkflowId.has(entry.id)
            ? markWorkflowContentEdited(entry, contentByWorkflowId.get(entry.id))
            : entry
        ));
        return { ...customer, timeline };
      });
    }

    const contentHtml = getEditorHtmlForSave();
    return sourceCustomers.map((customer) => {
      if (customer.id !== selectedCustomer.id) return customer;
      if (!selectedWorkflow) return { ...customer, messyNotes: contentHtml };

      const timeline = (customer.timeline ?? []).map((entry) => (
        entry.id === selectedWorkflow.id
          ? markWorkflowContentEdited(entry, contentHtml)
          : entry
      ));
      return { ...customer, timeline };
    });
  }

  function readMergedWorkflowContentFromEditor() {
    if (!editorRef.current) return new Map();

    return Array.from(editorRef.current.querySelectorAll('.mergedWorkflowSection')).reduce((contentMap, section) => {
      const workflowId = section.getAttribute('data-workflow-id');
      const body = section.querySelector('.mergedWorkflowBody');
      if (workflowId && body) {
        contentMap.set(workflowId, body.innerHTML);
      }
      return contentMap;
    }, new Map());
  }

  function saveCurrentEditorContent() {
    clearTimeout(editorSyncTimerRef.current);
    editorSyncTimerRef.current = null;
    if (!editorRef.current) {
      flushCustomersSave();
      return customersRef.current;
    }

    const nextCustomers = getCustomersWithCurrentEditorContent(customersRef.current);
    if (nextCustomers !== customersRef.current) {
      commitCustomers(nextCustomers, true);
      editorDirtyRef.current = false;
      editorHistoryRef.current.lastHtml = getEditorHtmlForSave();
      return nextCustomers;
    }

    flushCustomersSave();
    editorDirtyRef.current = false;
    return customersRef.current;
  }

  function getWorkflowIdFromEditorRange(range) {
    if (!range || !editorRef.current) return '';
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const section = element?.closest?.('.mergedWorkflowSection');
    if (!section || !editorRef.current.contains(section)) return '';
    return section.getAttribute('data-workflow-id') ?? '';
  }

  const MAX_EXPORT_SIZE_WARNING = 100 * 1024 * 1024; // 100MB

  async function exportBackupData() {
    const backupCustomers = getCustomersWithCurrentEditorContent();
    const layout = { leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth };
    const viewState = { selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode };
    const assetIds = collectAssetIdsFromCustomers(backupCustomers);
    const assets = await readAssetsForBackup(assetIds);
    const payload = {
      ...makeBackupPayload({ customers: backupCustomers, globalFieldLabels, layout, viewState }),
      assets,
    };
    const jsonString = JSON.stringify(payload, null, 2);

    // Warn if the export is very large (e.g. many base64 attachments)
    if (jsonString.length > MAX_EXPORT_SIZE_WARNING) {
      const proceed = window.confirm(
        `备份文件较大（约 ${formatFileSize(jsonString.length)}），下载可能需要一些时间。是否继续？\n\n` +
        '提示：如果备份文件过大，建议清理编辑器中的大型附件后再导出。'
      );
      if (!proceed) return;
    }

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Delay URL revocation to ensure the download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function applyImportedBackup(payload, mode = 'overwrite', preparedCustomers = null) {
    const importedCustomers = preparedCustomers ?? normalizeCustomers(Array.isArray(payload) ? payload : payload?.customers);
    if (importedCustomers.length === 0) {
      throw new Error('备份文件里没有可导入的客户数据');
    }
    await importBackupAssets(payload?.assets);

    const importedFieldLabels = normalizeFieldLabels(payload?.globalFieldLabels ?? {});
    if (mode === 'append') {
      const baseCustomers = getCustomersWithCurrentEditorContent();
      const duplicateKeys = makeCustomerDuplicateKeys(baseCustomers);
      const newCustomers = importedCustomers.filter((customer) => !isDuplicateCustomer(customer, duplicateKeys));
      const nextCustomers = [...baseCustomers, ...newCustomers];

      commitCustomers(nextCustomers);
      commitGlobalFieldLabels({ ...importedFieldLabels, ...globalFieldLabels });
      setSelectedId(selectedId || nextCustomers[0]?.id || '');
      setArchiveEditing(false);
      setArchiveDraft(null);
      setEditingWorkflowTitleId('');
      setPendingImport(null);
      return;
    }

    const importedLayout = payload?.layout && typeof payload.layout === 'object'
      ? {
        leftCollapsed: Boolean(payload.layout.leftCollapsed),
        rightCollapsed: Boolean(payload.layout.rightCollapsed),
        leftPanelWidth: Number(payload.layout.leftPanelWidth) || DEFAULT_LEFT_PANEL_WIDTH,
        rightPanelWidth: Number(payload.layout.rightPanelWidth) || DEFAULT_RIGHT_PANEL_WIDTH,
      }
      : { leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth };
    const importedViewState = payload?.viewState && typeof payload.viewState === 'object'
      ? {
        selectedId: typeof payload.viewState.selectedId === 'string' ? payload.viewState.selectedId : '',
        selectedWorkflowId: typeof payload.viewState.selectedWorkflowId === 'string' ? payload.viewState.selectedWorkflowId : '',
        selectedWorkflowIds: Array.isArray(payload.viewState.selectedWorkflowIds)
          ? payload.viewState.selectedWorkflowIds.filter((item) => typeof item === 'string')
          : [],
        workflowViewMode: payload.viewState.workflowViewMode === 'merged' ? 'merged' : 'single',
      }
      : { selectedId: importedCustomers[0]?.id ?? '', selectedWorkflowId: '', selectedWorkflowIds: [], workflowViewMode: 'single' };
    const validSelectedId = importedCustomers.some((customer) => customer.id === importedViewState.selectedId)
      ? importedViewState.selectedId
      : importedCustomers[0]?.id ?? '';

    commitCustomers(importedCustomers);
    commitGlobalFieldLabels(importedFieldLabels);
    setLeftCollapsed(importedLayout.leftCollapsed);
    setRightCollapsed(importedLayout.rightCollapsed);
    setLeftPanelWidth(importedLayout.leftPanelWidth);
    setRightPanelWidth(importedLayout.rightPanelWidth);
    saveLayout(importedLayout);
    setSelectedId(validSelectedId);
    setSelectedWorkflowId(importedViewState.selectedWorkflowId);
    setSelectedWorkflowIds(importedViewState.selectedWorkflowIds);
    setWorkflowViewMode(importedViewState.workflowViewMode);
    setEditorHydrationVersion((version) => version + 1);
    saveViewState({ ...importedViewState, selectedId: validSelectedId });
    setArchiveEditing(false);
    setArchiveDraft(null);
    setEditingWorkflowTitleId('');
    setPendingImport(null);
  }

  function importBackupData(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size === 0) {
      window.alert('导入文件为空，请检查备份文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? '');
        if (!raw.trim()) {
          throw new Error('备份文件内容为空');
        }
        const payload = JSON.parse(raw);
        if (payload === null || typeof payload !== 'object') {
          throw new Error('备份文件格式不正确，应为 JSON 对象');
        }
        const importedCustomers = normalizeCustomers(Array.isArray(payload) ? payload : payload?.customers);
        if (importedCustomers.length === 0) {
          throw new Error('备份文件里没有可导入的客户数据');
        }
        // Cap imported customers to prevent memory issues
        if (importedCustomers.length > 100000) {
          throw new Error('导入的客户数量超过上限（100000），请检查备份文件');
        }
        const currentCustomers = getCustomersWithCurrentEditorContent();
        setPendingImport({
          payload,
          importedCustomers,
          stats: getImportStats(importedCustomers, currentCustomers),
        });
      } catch (error) {
        if (error instanceof SyntaxError) {
          window.alert('备份文件格式错误，无法解析 JSON 数据');
          return;
        }
        window.alert(error instanceof Error ? error.message : '导入失败，请检查备份文件');
      }
    };
    reader.onerror = () => window.alert('读取备份文件失败，请重试');
    reader.readAsText(file, 'UTF-8');
  }

  function updateCustomer(id, patch) {
    commitCustomersFromUpdater((currentCustomers) => (
      currentCustomers.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer))
    ));
  }

  function rememberSelectedWorkflowForCustomer(customerId = selectedId, workflowId = selectedWorkflowId) {
    if (customerId && workflowId) {
      workflowSelectionByCustomerRef.current.set(customerId, workflowId);
    }
  }

  function getRememberedWorkflowId(customerId, sourceCustomers = customersRef.current) {
    if (!customerId) return '';
    const workflows = sourceCustomers.find((customer) => customer.id === customerId)?.timeline ?? [];
    if (workflows.length === 0) return '';
    const rememberedWorkflowId = workflowSelectionByCustomerRef.current.get(customerId) || '';
    return workflows.some((workflow) => workflow.id === rememberedWorkflowId)
      ? rememberedWorkflowId
      : workflows[0]?.id ?? '';
  }

  function selectCustomer(id) {
    const nextCustomers = saveCurrentEditorContent();
    rememberSelectedWorkflowForCustomer();
    const nextWorkflowId = getRememberedWorkflowId(id, nextCustomers);
    setSelectedId(id);
    setSelectedWorkflowId(nextWorkflowId);
    setSelectedWorkflowIds([]);
    saveViewState({ selectedId: id, selectedWorkflowId: nextWorkflowId, selectedWorkflowIds: [], workflowViewMode });
    setEditingWorkflowTitleId('');
  }

  function changeWorkflowViewMode(mode) {
    if (mode === workflowViewMode) return;
    const focusedMergedWorkflowId = isMergedWorkflowView
      ? getWorkflowIdFromEditorRange(editorSelectionRef.current)
      : '';
    const nextCustomers = saveCurrentEditorContent();
    if (mode === 'merged') {
      const nextCustomer = nextCustomers.find((customer) => customer.id === selectedCustomer?.id);
      const nextSelectedIds = (nextCustomer?.timeline ?? []).map((workflow) => workflow.id);
      setSelectedWorkflowIds(nextSelectedIds);
    } else {
      const nextCustomer = nextCustomers.find((customer) => customer.id === selectedCustomer?.id);
      const nextWorkflowId = focusedMergedWorkflowId
        || (selectedWorkflowIds.includes(selectedWorkflowId) ? selectedWorkflowId : '')
        || selectedWorkflowIds[0]
        || selectedWorkflowId
        || nextCustomer?.timeline?.[0]?.id
        || '';
      setSelectedWorkflowId(nextWorkflowId);
    }
    setWorkflowViewMode(mode);
    setEditingWorkflowTitleId('');
  }

  function selectSingleWorkflow(workflowId) {
    saveCurrentEditorContent();
    rememberSelectedWorkflowForCustomer(selectedId, workflowId);
    setSelectedWorkflowId(workflowId);
  }

  function focusWorkflow(workflowId) {
    saveCurrentEditorContent();
    rememberSelectedWorkflowForCustomer(selectedId, workflowId);
    setSelectedWorkflowId(workflowId);
  }

  function toggleMergedWorkflow(workflowId) {
    saveCurrentEditorContent();
    rememberSelectedWorkflowForCustomer(selectedId, workflowId);
    setSelectedWorkflowId(workflowId);
    setSelectedWorkflowIds((current) => {
      if (current.includes(workflowId)) {
        const next = current.filter((item) => item !== workflowId);
        return next;
      }
      return [...current, workflowId];
    });
  }

  function updateWorkflow(workflowId, patch) {
    if (!selectedCustomer) return;
    commitCustomersFromUpdater((currentCustomers) => currentCustomers.map((customer) => {
      if (customer.id !== selectedCustomer.id) return customer;
      const timeline = (customer.timeline ?? []).map((entry) =>
        entry.id === workflowId ? { ...entry, ...patch } : entry
      );
      return { ...customer, timeline };
    }));
  }

  function reorderCustomers(activeId, overId) {
    if (!overId || activeId === overId) return;

    saveCurrentEditorContent();
    const currentCustomers = customersRef.current;
    const oldIndex = currentCustomers.findIndex((c) => c.id === activeId);
    const newIndex = currentCustomers.findIndex((c) => c.id === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(currentCustomers, oldIndex, newIndex);
    commitCustomers(reordered);
  }

  function handleCustomerDragEnd(event) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';

    reorderCustomers(activeId, overId);
  }

  function addCustomer() {
    const id = `c-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const companyName = noteTitleDraft.trim() || '新客户';
    const nextCustomer = {
      id,
      serialNumber: String(customers.length + 1),
      pinned: false,
      company: companyName,
      grade: 'C',
      country: '',
      website: '',
      contact: '',
      email: '',
      phone: '',
      fax: '',
      otherContact: '',
      remark: '',
      backup1: '',
      backup2: '',
      backup3: '',
      backup4: '',
      lastFollowDate: today,
      reminderDays: '30',
      messyNotes: '',
      timeline: [],
    };
    const nextCustomers = [nextCustomer, ...customersRef.current];
    commitCustomers(nextCustomers, true);
    setSelectedId(id);
    setSelectedWorkflowId('');
    setSelectedWorkflowIds([]);
    saveViewState({ selectedId: id, selectedWorkflowId: '', selectedWorkflowIds: [], workflowViewMode });
    setArchiveEditing(false);
    setArchiveDraft(null);
    setNoteTitleDraft('');
  }

  function createMentionCustomer(name) {
    const id = `c-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const companyName = name.trim() || '新客户';
    const nextCustomer = {
      id,
      serialNumber: String((customersRef.current?.length ?? 0) + 1),
      pinned: false,
      company: companyName,
      grade: 'C',
      country: '',
      website: '',
      contact: '',
      email: '',
      phone: '',
      fax: '',
      otherContact: '',
      remark: '',
      backup1: '',
      backup2: '',
      backup3: '',
      backup4: '',
      lastFollowDate: today,
      reminderDays: '30',
      messyNotes: '',
      timeline: [],
    };
    const nextCustomers = [nextCustomer, ...(customersRef.current ?? [])];
    commitCustomers(nextCustomers, true);
    // Auto-select the new customer for distribution
    setMentionSelectedIds((current) => [...current, id]);
    setMentionQuery('');
    // Set a brief timeout so the new customer appears in the filtered list before we scroll to it
    setTimeout(() => {
      document.getElementById(`mention-${id}`)?.scrollIntoView?.({ block: 'nearest' });
    }, 60);
    return id;
  }

  function openMentionPopup() {
    // Save current editor content first
    saveCurrentEditorContent();

    // Capture selected HTML from the saved editor selection (survives focus change)
    // editorSelectionRef is a cloned Range saved on mouseup in the editor
    let selectedHtml = '';
    const range = editorSelectionRef.current;
    if (range && !range.collapsed && editorRef.current) {
      const fragment = range.cloneContents();
      const temp = document.createElement('div');
      temp.appendChild(fragment);
      clearTransientEditorSelectionClasses(temp);
      selectedHtml = temp.innerHTML;
    }
    setMentionSourceHtml(selectedHtml);
    setMentionQuery('');
    setMentionSelectedIds([]);
    setMentionWorkflowTitle('');
    setMentionTargets({});
    setMentionFocusedCustomerId(null);
    setMentionOpen(true);
  }

  function handleEditorContextMenu(event) {
    event.preventDefault();
    saveEditorSelection();
    const targetObject = getClosestEditorObject(event.target);
    const selectedRange = getSavedEditorSelectionRange();
    if (targetObject && (!selectedRange || !rangeIntersectsNode(selectedRange, targetObject))) {
      selectEditorObject(targetObject);
    }
    const hasSelection = Boolean(getSavedEditorSelectionRange());
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      hasSelection,
      hasAttachments: getSelectedEditorAttachments().length > 0,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function confirmMentionDistribute() {
    if (mentionSelectedIds.length === 0) return;

    const title = mentionWorkflowTitle.trim() || '沟通记录';
    const contentHtml = mentionSourceHtml;
    const contentText = getPlainTextFromHtml(contentHtml).trim();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const stamp = now.toLocaleString('zh-CN', { hour12: false });
    const timestampHtml = `<div class="editorTimestampBlock" data-undeletable="true" contenteditable="false">${stamp}</div><div>&#x200b;</div>`;

    commitCustomersFromUpdater((currentCustomers) =>
      currentCustomers.map((customer) => {
        if (!mentionSelectedIds.includes(customer.id)) return customer;

        const timeline = customer.timeline ?? [];
        const targetWorkflowId = mentionTargets[customer.id] || '';
        const targetExists = targetWorkflowId
          && timeline.some((entry) => entry.id === targetWorkflowId);

        // Append the distributed content to an existing workflow if one was chosen.
        if (targetExists) {
          return {
            ...customer,
            lastFollowDate: today,
            timeline: timeline.map((entry) => {
              if (entry.id !== targetWorkflowId) return entry;
              const appendedDocument = `${entry.documentContent ?? ''}${timestampHtml}${contentHtml}`;
              const appendedText = [entry.content, contentText].filter(Boolean).join('\n');
              return {
                ...entry,
                content: appendedText || entry.content,
                documentContent: appendedDocument,
                lastEditedAt: now.toISOString(),
              };
            }),
          };
        }

        // Otherwise create a new workflow as before.
        const item = {
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date: today,
          title,
          content: contentText || title,
          documentContent: timestampHtml + contentHtml,
          status: '跟进中',
          createdAt: now.toISOString(),
          lastEditedAt: now.toISOString(),
        };
        return {
          ...customer,
          lastFollowDate: today,
          timeline: [item, ...timeline],
        };
      })
    );

    setMentionOpen(false);
    setMentionQuery('');
    setMentionSelectedIds([]);
    setMentionWorkflowTitle('');
    setMentionSourceHtml('');
    setMentionTargets({});
    setNoteTitleDraft('');
  }

  function updateArchiveDraft(fieldKey, value) {
    setArchiveDraft((draft) => ({
      ...(draft ?? makeArchiveDraft(selectedCustomer, globalFieldLabels)),
      [fieldKey]: value,
    }));
  }

  function updateArchiveFieldLabel(fieldKey, value) {
    setArchiveDraft((draft) => {
      const nextDraft = draft ?? makeArchiveDraft(selectedCustomer, globalFieldLabels);
      return {
        ...nextDraft,
        fieldLabels: {
          ...(nextDraft?.fieldLabels ?? {}),
          [fieldKey]: value,
        },
      };
    });
  }

  function cancelArchiveEditing() {
    setArchiveEditing(false);
    setArchiveDraft(null);
  }

  function toggleArchiveEditing() {
    if (!selectedCustomer) return;

    if (!archiveEditing) {
      setArchiveDraft(makeArchiveDraft(selectedCustomer, globalFieldLabels));
      setArchiveEditing(true);
      return;
    }

    if (archiveDraft?.id === selectedCustomer.id) {
      const { id, fieldLabels, ...patch } = archiveDraft;
      patch.fieldLabels = normalizeFieldLabels(fieldLabels, globalFieldLabels);
      updateCustomer(id, patch);
    }
    setArchiveEditing(false);
    setArchiveDraft(null);
  }

  function saveArchiveAsGlobalFields() {
    if (!selectedCustomer || archiveDraft?.id !== selectedCustomer.id) return;

    const nextGlobalFieldLabels = normalizeFieldLabels(archiveDraft.fieldLabels);
    commitGlobalFieldLabels(nextGlobalFieldLabels);
    setArchiveEditing(false);
    setArchiveDraft(null);
  }

  function requestDeleteCustomer(customer) {
    if (!customer) return;
    setPendingDelete({
      type: 'customer',
      id: customer.id,
      title: '删除客户档案',
      message: `确定删除「${customer.company || '未命名客户'}」吗？删除后无法恢复。`,
    });
  }

  function performDeleteCustomer(customerId) {
    const currentCustomers = getCustomersWithCurrentEditorContent();
    const nextCustomers = currentCustomers.filter((customer) => customer.id !== customerId);
    commitCustomers(nextCustomers);
    cleanupUnusedAssets(nextCustomers);
    if (selectedId === customerId) {
      const nextVisibleCustomer = filteredCustomers.find((customer) => customer.id !== customerId) ?? nextCustomers[0];
      const nextCustomerId = nextVisibleCustomer?.id ?? '';
      const nextWorkflowId = getRememberedWorkflowId(nextCustomerId, nextCustomers);
      setSelectedId(nextCustomerId);
      setSelectedWorkflowId(nextWorkflowId);
      setArchiveEditing(false);
      setArchiveDraft(null);
    }
  }

  function togglePinCustomer(customerId) {
    commitCustomersFromUpdater((currentCustomers) =>
      currentCustomers.map((c) =>
        c.id === customerId ? { ...c, pinned: !c.pinned } : c
      )
    );
  }

  function enterBatchMode() {
    setBatchMode(true);
    setBatchSelectedIds(new Set());
  }

  function exitBatchMode() {
    setBatchMode(false);
    setBatchSelectedIds(new Set());
  }

  function toggleBatchSelectCustomer(customerId) {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  function requestBatchDelete() {
    if (batchSelectedIds.size === 0) return;
    setPendingDelete({
      type: 'batch',
      ids: [...batchSelectedIds],
      title: '批量删除用户',
      message: `确定删除选中的 ${batchSelectedIds.size} 位用户吗？删除后无法恢复。`,
    });
  }

  function performBatchDelete(ids) {
    const idSet = new Set(ids);
    const currentCustomers = getCustomersWithCurrentEditorContent();
    const nextCustomers = currentCustomers.filter((c) => !idSet.has(c.id));
    commitCustomers(nextCustomers);
    cleanupUnusedAssets(nextCustomers);
    if (idSet.has(selectedId)) {
      const nextCustomer = nextCustomers[0];
      const nextCustomerId = nextCustomer?.id ?? '';
      const nextWorkflowId = getRememberedWorkflowId(nextCustomerId, nextCustomers);
      setSelectedId(nextCustomerId);
      setSelectedWorkflowId(nextWorkflowId);
      setArchiveEditing(false);
      setArchiveDraft(null);
    }
    exitBatchMode();
  }

  function toggleLeftCollapsed() {
    setLeftCollapsed((value) => !value);
  }

  function toggleRightCollapsed() {
    setRightCollapsed((value) => !value);
  }

  function toggleMergeView() {
    if (workflowViewMode === 'merged') {
      changeWorkflowViewMode('single');
    } else {
      changeWorkflowViewMode('merged');
    }
  }

  function stripEditorFramesForExport(html) {
    // Create a temp container to process editor-specific wrappers
    if (typeof document === 'undefined') return html;
    const container = document.createElement('div');
    container.innerHTML = toEditorHtml(html);

    // Unwrap image frames — keep just the <img>, copy sizing from frame
    container.querySelectorAll('.editorImageFrame').forEach((frame) => {
      const img = frame.querySelector('img');
      if (img) {
        const frameWidth = frame.style?.width;
        if (frameWidth && !img.getAttribute('width')) {
          img.setAttribute('width', parseInt(frameWidth, 10) || 320);
        }
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '8px 0';
        img.style.borderRadius = '6px';
        frame.replaceWith(img);
      } else {
        frame.remove();
      }
    });

    container.querySelectorAll('.editorVideoFrame, video').forEach((element) => element.remove());

    container.querySelectorAll('.editorAttachmentFrame').forEach((frame) => {
      const name = frame.dataset.attachmentName || '附件';
      const type = frame.dataset.attachmentType || '';
      const size = Number(frame.dataset.attachmentSize || 0);
      const url = frame.dataset.attachmentUrl || '';
      const kind = getAttachmentKind(name, type);
      if (kind === 'video') {
        frame.remove();
        return;
      }
      const link = document.createElement(url ? 'a' : 'span');
      link.className = 'exportAttachmentLink';
      if (url) {
        link.setAttribute('href', url);
        link.setAttribute('download', name);
      }
      link.textContent = `Attachment: ${name}${size ? ` (${formatFileSize(size)})` : ''}`;
      link.style.display = 'inline-block';
      link.style.margin = '6px 0';
      link.style.padding = '8px 10px';
      link.style.border = '1px solid #d4d4d4';
      link.style.borderRadius = '6px';
      link.style.color = '#222222';
      link.style.background = '#f8f8f8';
      link.style.textDecoration = 'none';
      link.style.fontSize = '13px';
      frame.replaceWith(link);
    });

    // Remove resize handles
    container.querySelectorAll('.editorImageResizeHandle').forEach((el) => el.remove());

    // Remove blank lines: empty paragraphs, whitespace-only nodes, stray <br>
    const isEmptyBlock = (el) => {
      if (!el) return true;
      // Keep elements that contain images or attachments
      if (el.querySelector('img, video, .exportAttachmentLink')) return false;
      const text = (el.textContent ?? '').replace(/ /g, ' ').trim();
      // Keep if it has any meaningful text
      if (text) return false;
      // Remove if only has <br> or is empty
      return true;
    };

    // Remove empty <p> and <div> blocks (iterate backwards since we mutate)
    const blocks = container.querySelectorAll('p, div');
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      if (isEmptyBlock(blocks[i])) {
        blocks[i].remove();
      }
    }

    // Remove orphan <br> at the very beginning or end
    const firstChild = container.firstChild;
    if (firstChild?.nodeName === 'BR') firstChild.remove();
    const lastChild = container.lastChild;
    if (lastChild?.nodeName === 'BR') lastChild.remove();

    // Collapse consecutive <br> tags into one
    container.querySelectorAll('br + br').forEach((br) => br.remove());

    return container.innerHTML;
  }

  async function resolveHtmlAssetUrls(html) {
    if (!html || typeof document === 'undefined') return html;
    const container = document.createElement('div');
    container.innerHTML = toEditorHtml(html);

    // Resolve dbasset: URLs in <img> tags
    const images = Array.from(container.querySelectorAll('img[src], img[data-editor-src]'));
    const imgResolutions = images.map(async (img) => {
      const src = img.getAttribute('data-editor-src') || img.getAttribute('src') || '';
      if (!isStoredAssetUrl(src)) return;
      try {
        const dataUrl = await resolveStoredAssetDataUrl(src);
        img.setAttribute('src', dataUrl);
        img.removeAttribute('data-editor-src');
      } catch (error) {
        console.warn('Failed to resolve image asset for export', error);
        img.alt = '图片加载失败';
        img.removeAttribute('src');
      }
    });

    const videos = Array.from(container.querySelectorAll('video[src], video[data-editor-src]'));
    const videoResolutions = videos.map(async (video) => {
      const src = video.getAttribute('data-editor-src') || video.getAttribute('src') || '';
      if (!isStoredAssetUrl(src)) return;
      try {
        const dataUrl = await resolveStoredAssetDataUrl(src);
        video.setAttribute('src', dataUrl);
        video.removeAttribute('data-editor-src');
      } catch (error) {
        console.warn('Failed to resolve video asset for export', error);
        video.removeAttribute('src');
      }
    });

    // Resolve dbasset: URLs in attachment frames
    const attachments = Array.from(container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]'));
    const attachmentResolutions = attachments.map(async (frame) => {
      const url = frame.getAttribute('data-attachment-url') || '';
      if (!isStoredAssetUrl(url)) return;
      try {
        const dataUrl = await resolveStoredAssetDataUrl(url);
        frame.setAttribute('data-attachment-url', dataUrl);
      } catch (error) {
        console.warn('Failed to resolve attachment asset for export', error);
        frame.removeAttribute('data-attachment-url');
      }
    });

    await Promise.all([...imgResolutions, ...videoResolutions, ...attachmentResolutions]);
    return container.innerHTML;
  }

  async function buildExportHtml(workflows, customerName) {
    const title = customerName || '未命名客户';
    const date = new Date().toLocaleString('zh-CN', { hour12: false });
    const sections = (await Promise.all(workflows.map(async (item) => {
      const rawContent = item.documentContent ?? item.content ?? '';
      const resolvedContent = await resolveHtmlAssetUrls(rawContent);
      const content = stripEditorFramesForExport(resolvedContent);
      const statusText = item.status ?? '';
      return [
        '<section style="margin-bottom:24px;page-break-inside:avoid;">',
        `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e5e5;">`,
        `<span style="color:#666;font-size:13px;">${escapeHtml(item.date ?? '')}</span>`,
        `<span style="font-weight:700;font-size:15px;">${escapeHtml(item.title ?? item.content ?? '沟通记录')}</span>`,
        statusText ? `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#087678;border:1px solid rgba(12,139,141,0.44);background:#f0faf9;">${escapeHtml(statusText)}</span>` : '',
        '</div>',
        `<div style="color:#2d3741;line-height:1.7;font-size:14px;white-space:pre-wrap;word-break:break-word;">${content}</div>`,
        '</section>',
      ].join('');
    }))).join('');

    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head><meta charset="UTF-8">',
      `<title>${escapeHtml(title)} - 工作流导出</title>`,
      '<style>',
      'body{max-width:800px;margin:0 auto;padding:40px 32px;font-family:"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;color:#111;background:#fff;}',
      'h1{margin:0 0 8px;font-size:22px;}',
      'h1+p{color:#666;font-size:13px;margin:0 0 28px;}',
      'img{max-width:100%;height:auto;border-radius:6px;}',
      '@media print{body{padding:20px 0;}}',
      '</style>',
      '</head>',
      '<body>',
      `<h1>${escapeHtml(title)}</h1>`,
      `<p>导出时间：${date} ｜ 共 ${workflows.length} 条工作流</p>`,
      sections,
      '</body>',
      '</html>',
    ].join('');
  }

  function getExportWorkflows() {
    const customerTimeline = selectedCustomer?.timeline ?? [];
    if (isMergedWorkflowView) {
      return customerTimeline.filter((item) => selectedWorkflowIds.includes(item.id));
    }
    if (selectedWorkflow) return [selectedWorkflow];
    return [];
  }

  async function handleExportPDF() {
    const workflows = getExportWorkflows();
    if (workflows.length === 0) return;
    setExportDialogOpen(false);

    const html = await buildExportHtml(workflows, selectedCustomerTitle);

    // Render full HTML in a hidden iframe so <style> is applied properly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '794px';  // A4 @ 96dpi ≈ 794px
    iframe.style.zIndex = '-1';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for full render
    await new Promise((resolve) => {
      iframe.onload = resolve;
      if (iframeDoc.readyState === 'complete') resolve();
    });
    await new Promise((r) => setTimeout(r, 800));

    const body = iframeDoc.body;
    // Temporarily make iframe visible at correct dimensions for html2canvas
    iframe.style.opacity = '1';
    iframe.style.height = `${Math.max(body.scrollHeight + 80, 600)}px`;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture the rendered body as a full-page canvas
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        width: 794,
        height: body.scrollHeight,
      });

      // Build PDF: A4 portrait, slice canvas across pages
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;   // A4 width in mm
      const pageHeight = 297;  // A4 height in mm
      const margin = 10;       // mm
      const contentWidth = pageWidth - margin * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageContentHeight = pageHeight - margin * 2;

      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageContentHeight);
        const sourceHeight = (sliceHeight / imgHeight) * canvas.height;

        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sourceHeight);
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

        const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(sliceDataUrl, 'JPEG', margin, margin, imgWidth, sliceHeight);

        sourceY += sourceHeight;
        remainingHeight -= sliceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
        }
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const modeLabel = isMergedWorkflowView ? '合并' : '单独';
      pdf.save(`${selectedCustomer?.company || '客户'}_工作流${modeLabel}_${stamp}.pdf`);
    } catch (error) {
      console.error('PDF export failed', error);
    } finally {
      document.body.removeChild(iframe);
    }
  }

  async function handleExportWord() {
    setExportDialogOpen(false);
    const workflows = getExportWorkflows();
    if (workflows.length === 0) return;

    const title = selectedCustomerTitle || '未命名客户';
    const date = new Date().toLocaleString('zh-CN', { hour12: false });

    const sections = (await Promise.all(workflows.map(async (item) => {
      const rawContent = item.documentContent ?? item.content ?? '';
      const resolvedContent = await resolveHtmlAssetUrls(rawContent);
      const content = stripEditorFramesForExport(resolvedContent);
      const statusText = item.status ?? '';
      return [
        `<h2 style="font-size:14pt;color:#333;margin:18pt 0 6pt 0;border-bottom:1pt solid #ddd;padding-bottom:6pt;">${escapeHtml(item.title ?? item.content ?? '沟通记录')}</h2>`,
        `<p style="color:#666;font-size:10pt;margin:0 0 10pt 0;">`,
        `<span>${escapeHtml(item.date ?? '')}</span>`,
        statusText ? ` &middot; <span style="color:#087678;">${escapeHtml(statusText)}</span>` : '',
        '</p>',
        `<div style="font-size:11pt;line-height:1.8;color:#222;">${content}</div>`,
        workflows.indexOf(item) < workflows.length - 1 ? '<hr style="margin:18pt 0;border:0;border-top:1px dashed #ccc;" />' : '',
      ].join('');
    }))).join('');

    const wordDoc = [
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
      '      xmlns:w="urn:schemas-microsoft-com:office:word"',
      '      xmlns="http://www.w3.org/TR/REC-html40">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->',
      '<style>',
      '@page { size: A4; margin: 2cm 2.5cm; }',
      'body { font-family: "PingFang SC","Microsoft YaHei",sans-serif; color: #111; }',
      'img { max-width: 100%; height: auto; }',
      'table { border-collapse: collapse; width: 100%; }',
      'td, th { border: 1px solid #ccc; padding: 4px 8px; }',
      '</style>',
      '</head>',
      '<body>',
      `<h1 style="font-size:18pt;color:#111;margin:0 0 4pt 0;">${escapeHtml(title)}</h1>`,
      `<p style="color:#888;font-size:9pt;margin:0 0 20pt 0;">导出时间：${date} ｜ 共 ${workflows.length} 条工作流</p>`,
      sections,
      '</body>',
      '</html>',
    ].join('\n');

    const bom = '﻿';
    const blob = new Blob([bom + wordDoc], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    const modeLabelWord = isMergedWorkflowView ? '合并' : '单独';
    link.download = `${selectedCustomer?.company || '客户'}_工作流${modeLabelWord}_${stamp}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function toggleEditorExpanded() {
    const nextExpanded = !editorExpanded;
    setLeftCollapsed(nextExpanded);
    setRightCollapsed(nextExpanded);
  }

  function startResize(side) {
    if ((side === 'left' && leftCollapsed) || (side === 'right' && rightCollapsed)) return;
    setActiveResizer(side);
  }

  function addMessyNote() {
    if (!selectedCustomer) return;
    const contentHtml = getEditorHtmlForSave().trim();
    const contentText = getPlainTextFromHtml(contentHtml).trim();
    const title = noteTitleDraft.trim() || '沟通记录';
    const hasEditorObject = /<(img|table|video|iframe)\b|editor(Image|Attachment)Frame/.test(contentHtml);
    if (!noteTitleDraft.trim() && !contentText && !hasEditorObject) return;
    clearTimeout(editorSyncTimerRef.current);
    editorSyncTimerRef.current = null;
    editorDirtyRef.current = false;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const stamp = now.toLocaleString('zh-CN', { hour12: false });
    const content = contentText || title;
    const shouldMoveDraftIntoNewWorkflow = !selectedWorkflow && !isMergedWorkflowView;
    // Prepend an undeletable timestamp to every new workflow so content
    // typed after it is always properly persisted.
    const timestampHtml = `<div class="editorTimestampBlock" data-undeletable="true" contenteditable="false">${stamp}</div><div>&#x200b;</div>`;
    const documentContent = shouldMoveDraftIntoNewWorkflow
      ? timestampHtml + contentHtml
      : timestampHtml;
    const item = {
      id: `t-${Date.now()}`,
      date,
      title,
      content,
      documentContent,
      status: '跟进中',
      createdAt: now.toISOString(),
      lastEditedAt: now.toISOString(),
    };
    const nextNote = `${selectedCustomer.messyNotes ? `${selectedCustomer.messyNotes}\n\n` : ''}[${stamp}] ${title}\n${content}`;
    updateCustomer(selectedCustomer.id, {
      lastFollowDate: date,
      messyNotes: nextNote,
      timeline: [item, ...(selectedCustomer.timeline ?? [])],
    });
    setSelectedWorkflowId(item.id);
    if (workflowViewMode === 'merged') {
      setSelectedWorkflowIds((current) => [item.id, ...current.filter((entryId) => entryId !== item.id)]);
    }
    setEditingWorkflowTitleId('');
    setNoteTitleDraft('');
    // Force persist the new workflow data immediately so subsequent edits
    // have a stable base to save against, preventing content loss on refresh.
    flushCustomersSave();
  }

  function updateEditorContent(value) {
    if (!selectedCustomer) return;
    if (isMergedWorkflowView) {
      updateMergedWorkflowContent();
      return;
    }
    if (!selectedWorkflow) {
      updateCustomer(selectedCustomer.id, { messyNotes: value });
      return;
    }

    commitCustomersFromUpdater((currentCustomers) => currentCustomers.map((customer) => {
      if (customer.id !== selectedCustomer.id) return customer;
      const timeline = (customer.timeline ?? []).map((entry) => (
        entry.id === selectedWorkflow.id
          ? markWorkflowContentEdited(entry, value)
          : entry
      ));
      return { ...customer, timeline };
    }));
  }

  function updateMergedWorkflowContent() {
    if (!selectedCustomer || !editorRef.current) return;

    const contentByWorkflowId = readMergedWorkflowContentFromEditor();
    if (contentByWorkflowId.size === 0) return;

    commitCustomersFromUpdater((currentCustomers) => currentCustomers.map((customer) => {
      if (customer.id !== selectedCustomer.id) return customer;
      const timeline = (customer.timeline ?? []).map((entry) => (
        contentByWorkflowId.has(entry.id)
          ? markWorkflowContentEdited(entry, contentByWorkflowId.get(entry.id))
          : entry
      ));
      return { ...customer, timeline };
    }));
  }

  function getEditorHtmlForSave() {
    if (!editorRef.current) return '';
    const clonedEditor = editorRef.current.cloneNode(true);
    normalizeEditorMediaSourcesInElement(clonedEditor);
    clearTransientEditorSelectionClasses(clonedEditor);
    return clonedEditor.innerHTML;
  }

  function trimEditorHistoryStack(stack) {
    if (stack.length > EDITOR_HISTORY_LIMIT) {
      stack.splice(0, stack.length - EDITOR_HISTORY_LIMIT);
    }
  }

  function resetEditorHistory() {
    editorHistoryRef.current = {
      undoStack: [],
      redoStack: [],
      lastHtml: getEditorHtmlForSave(),
      isRestoring: false,
    };
  }

  function recordEditorHistorySnapshot(nextHtml = getEditorHtmlForSave()) {
    const history = editorHistoryRef.current;
    if (history.isRestoring || nextHtml === history.lastHtml) return false;
    history.undoStack.push(history.lastHtml);
    trimEditorHistoryStack(history.undoStack);
    history.redoStack = [];
    history.lastHtml = nextHtml;
    return true;
  }

  function placeEditorCursorAtEnd() {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorSelectionRef.current = range.cloneRange();
  }

  function restoreEditorHtmlFromHistory(html) {
    const editor = editorRef.current;
    if (!editor) return;
    editorHistoryRef.current.isRestoring = true;
    clearTimeout(editorSyncTimerRef.current);
    editorSyncTimerRef.current = null;
    editorDirtyRef.current = false;

    const nextHtml = !isMergedWorkflowView && selectedWorkflow
      ? renderWorkflowEditorSection({ ...selectedWorkflow, documentContent: html }, 'singleWorkflowSection')
      : html;
    editor.innerHTML = toEditorHtml(stripStoredAssetSrcBeforeDomInsert(nextHtml));
    prepareEditorImages();
    prepareEditorVideos();
    prepareEditorAttachments();
    clearActiveEditorObjects();
    clearEditorRangeSelectionState();
    placeEditorCursorAtEnd();
    updateEditorContent(getEditorHtmlForSave());
    editorHistoryRef.current.lastHtml = getEditorHtmlForSave();
    editorHistoryRef.current.isRestoring = false;
  }

  function commitPendingEditorHistory() {
    clearTimeout(editorSyncTimerRef.current);
    editorSyncTimerRef.current = null;
    if (!editorRef.current) return '';
    const nextHtml = getEditorHtmlForSave();
    const changed = recordEditorHistorySnapshot(nextHtml);
    if (changed || editorDirtyRef.current) {
      updateEditorContent(nextHtml);
    }
    editorDirtyRef.current = false;
    return nextHtml;
  }

  function undoEditorChange() {
    if (!editorRef.current) return false;
    const currentHtml = commitPendingEditorHistory();
    const history = editorHistoryRef.current;
    const previousHtml = history.undoStack.pop();
    if (typeof previousHtml !== 'string') {
      restoreEditorSelection();
      const usedNativeUndo = document.execCommand('undo');
      syncEditorContent();
      return usedNativeUndo;
    }
    history.redoStack.push(currentHtml);
    trimEditorHistoryStack(history.redoStack);
    restoreEditorHtmlFromHistory(previousHtml);
    return true;
  }

  function redoEditorChange() {
    if (!editorRef.current) return false;
    const currentHtml = commitPendingEditorHistory();
    const history = editorHistoryRef.current;
    const nextHtml = history.redoStack.pop();
    if (typeof nextHtml !== 'string') {
      restoreEditorSelection();
      const usedNativeRedo = document.execCommand('redo');
      syncEditorContent();
      return usedNativeRedo;
    }
    history.undoStack.push(currentHtml);
    trimEditorHistoryStack(history.undoStack);
    restoreEditorHtmlFromHistory(nextHtml);
    return true;
  }

  function syncEditorContent() {
    clearTimeout(editorSyncTimerRef.current);
    editorSyncTimerRef.current = null;
    if (!editorRef.current) return;
    const nextHtml = getEditorHtmlForSave();
    recordEditorHistorySnapshot(nextHtml);
    const currentSavedContent = isMergedWorkflowView ? editorContent : selectedWorkflowContent;
    // Normalize the editor HTML to body content for fair comparison with saved content.
    // getEditorHtmlForSave() now returns the full editor innerHTML (including the
    // section wrapper), while currentSavedContent is just the body content. Without
    // normalization the two would never match, causing unnecessary saves.
    const normalizedEditorHtml = normalizeWorkflowDocumentContent(nextHtml);
    if (normalizedEditorHtml === currentSavedContent) {
      editorDirtyRef.current = false;
      return;
    }
    updateEditorContent(nextHtml);
    editorDirtyRef.current = false;
  }

  function syncEditorContentAndFlushSave() {
    syncEditorContent();
    flushCustomersSave();
  }

  function flushEditorContentSync() {
    if (editorSyncTimerRef.current) {
      clearTimeout(editorSyncTimerRef.current);
      editorSyncTimerRef.current = null;
    }
    syncEditorContent();
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    const editor = editorRef.current;
    if (!editor.contains(range.commonAncestorContainer)) return;
    if (!isRangeSelectingSingleEditorObject(range)) {
      clearActiveEditorObjects();
    }
    editorSelectionRef.current = range.cloneRange();
    const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const computed = element ? window.getComputedStyle(element) : null;
    if (computed?.fontSize) {
      setActiveEditorFontSize(computed.fontSize);
    }
    if (computed?.fontFamily) {
      setActiveEditorFontFamily(computed.fontFamily);
    }

    // Format painter: if active and new non-empty selection, apply & deactivate
    if (formatPainterRef.current && !range.collapsed) {
      const paintedStyle = { ...formatPainterRef.current };
      formatPainterRef.current = null;
      document.body.style.removeProperty('cursor');
      setTimeout(() => applyFormatPainterStyle(paintedStyle), 0);
    }
  }

  function clearEditorRangeSelectionState() {
    editorRef.current?.querySelectorAll('.rangeSelected').forEach((element) => {
      element.classList.remove('rangeSelected');
    });
  }

  function clearTransientEditorSelectionClasses(container) {
    container.querySelectorAll('.editorImageFrame.active, .editorVideoFrame.active, .editorAttachmentFrame.active, .rangeSelected').forEach((element) => {
      element.classList.remove('active', 'rangeSelected');
    });
  }

  function rangeIntersectsNode(range, node) {
    try {
      return range.intersectsNode(node);
    } catch {
      return false;
    }
  }

  function updateEditorRangeSelectionState() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    clearEditorRangeSelectionState();
    if (!editor || !selection?.rangeCount || selection.isCollapsed) return;

    const ranges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index));
    if (!ranges.some((range) => rangeIntersectsNode(range, editor))) return;

    editor.querySelectorAll('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame').forEach((frame) => {
      if (ranges.some((range) => rangeIntersectsNode(range, frame))) {
        frame.classList.add('rangeSelected');
      }
    });
  }

  function restoreEditorSelection() {
    const selection = window.getSelection();
    const range = editorSelectionRef.current;
    if (!selection || !range || !editorRef.current) return false;
    editorRef.current.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function getSavedEditorSelectionRange() {
    const range = editorSelectionRef.current;
    const editor = editorRef.current;
    if (!range || !editor || range.collapsed) return null;
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range;
  }

  function getSelectedEditorAttachments() {
    const range = getSavedEditorSelectionRange();
    if (!range) return [];

    const fragment = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);
    return Array.from(container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]'))
      .map((frame) => {
        const name = frame.getAttribute('data-attachment-name') || frame.dataset.attachmentName || '附件';
        const type = frame.getAttribute('data-attachment-type') || frame.dataset.attachmentType || 'application/octet-stream';
        const url = frame.getAttribute('data-attachment-url') || frame.dataset.attachmentUrl || '';
        const size = Number(frame.getAttribute('data-attachment-size') || frame.dataset.attachmentSize || 0);
        const kind = getAttachmentKind(name, type);
        return { name, type, url, size, kind };
      })
      .filter((attachment) => attachment.url && ['pdf', 'word', 'excel'].includes(attachment.kind));
  }

  function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || '附件';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadSelectedEditorAttachments() {
    const attachments = getSelectedEditorAttachments();
    if (attachments.length === 0) {
      window.alert('请先选中 PDF、Word 或 Excel 文档');
      return;
    }

    for (const attachment of attachments) {
      try {
        const dataUrl = await resolveStoredAssetDataUrl(attachment.url);
        triggerBlobDownload(dataUrlToBlob(dataUrl, attachment.type), attachment.name);
        await new Promise((resolve) => setTimeout(resolve, 180));
      } catch (error) {
        console.warn('Failed to download selected attachment', error);
        window.alert(`文档「${attachment.name}」下载失败`);
      }
    }
  }

  async function resolveClipboardImageSources(container) {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(async (image) => {
      const editorSrc = image.getAttribute('data-editor-src') || '';
      const currentSrc = image.getAttribute('src') || '';
      const source = editorSrc || currentSrc;
      if (!source) return;

      try {
        const dataUrl = isStoredAssetUrl(source)
          ? await resolveStoredAssetDataUrl(source)
          : source;
        if (dataUrl.startsWith('data:image/')) {
          image.setAttribute('src', dataUrl);
        } else if (!isStoredAssetUrl(dataUrl)) {
          image.setAttribute('src', dataUrl);
        }
      } catch (error) {
        console.warn('Failed to resolve clipboard image source', error);
      }
      image.removeAttribute('data-object-url');
    }));
  }

  async function resolveClipboardAttachmentUrls(container) {
    const frames = Array.from(container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]'));
    await Promise.all(frames.map(async (frame) => {
      const url = frame.getAttribute('data-attachment-url') || '';
      if (!isStoredAssetUrl(url)) return;
      try {
        frame.setAttribute('data-attachment-url', await resolveStoredAssetDataUrl(url));
      } catch (error) {
        console.warn('Failed to resolve clipboard attachment source', error);
      }
    }));
  }

  function getEditorClipboardPlainText(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll('.editorAttachmentFrame').forEach((frame) => {
      const name = frame.getAttribute('data-attachment-name') || frame.dataset.attachmentName || '附件';
      const type = frame.getAttribute('data-attachment-type') || frame.dataset.attachmentType || '';
      const size = Number(frame.getAttribute('data-attachment-size') || frame.dataset.attachmentSize || 0);
      const kind = getAttachmentKind(name, type);
      const label = kind === 'pdf' ? 'PDF' : kind === 'word' ? 'Word' : kind === 'excel' ? 'Excel' : kind === 'video' ? 'Video' : '文件';
      frame.replaceWith(document.createTextNode(`\n[${label}] ${name}${size ? ` (${formatFileSize(size)})` : ''}\n`));
    });
    clone.querySelectorAll('img').forEach((image) => {
      const alt = image.getAttribute('alt') || '图片';
      image.replaceWith(document.createTextNode(`\n[${alt}]\n`));
    });
    return (clone.textContent || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function getEditorSelectionClipboardPayload(range) {
    const fragment = range.cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);
    container.querySelectorAll('.editorImageResizeHandle').forEach((element) => element.remove());
    clearTransientEditorSelectionClasses(container);
    container.querySelectorAll('video[data-editor-src]').forEach((element) => {
      const editorSrc = element.getAttribute('data-editor-src');
      if (editorSrc && !isStoredAssetUrl(editorSrc)) {
        element.setAttribute('src', editorSrc);
      }
      element.removeAttribute('data-object-url');
    });
    await resolveClipboardImageSources(container);
    await resolveClipboardAttachmentUrls(container);

    const imageSources = Array.from(container.querySelectorAll('img[src]'))
      .map((image) => image.getAttribute('src') || '')
      .filter((src) => src.startsWith('data:image/'));
    const imageBlob = imageSources.length === 1
      ? await imageDataUrlToPngBlob(imageSources[0]).catch(() => null)
      : null;

    return {
      html: container.innerHTML,
      text: getEditorClipboardPlainText(container),
      imageBlob,
    };
  }

  function isInternalEditorClipboardHtml(html = '') {
    return /(?:editorImageFrame|editorVideoFrame|editorAttachmentFrame|data-editor-src|data-attachment-url)/.test(html);
  }

  function normalizeInternalEditorClipboardHtml(html = '') {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('script, style, link, meta').forEach((element) => element.remove());
    container.querySelectorAll('.editorImageResizeHandle').forEach((element) => element.remove());
    clearTransientEditorSelectionClasses(container);
    container.querySelectorAll('[contenteditable]').forEach((element) => {
      if (element.matches('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame')) {
        element.setAttribute('contenteditable', 'false');
      }
    });
    return container.innerHTML;
  }

  function insertEditorHtmlAtSelection(html) {
    if (!editorRef.current) return false;
    const range = ensureEditorInsertionRange();
    if (!range) return false;

    const container = document.createElement('div');
    container.innerHTML = normalizeInternalEditorClipboardHtml(html);
    const fragment = document.createDocumentFragment();
    let lastInsertedNode = null;
    while (container.firstChild) {
      lastInsertedNode = container.firstChild;
      fragment.appendChild(container.firstChild);
    }
    if (!lastInsertedNode) return false;

    range.deleteContents();
    range.insertNode(fragment);
    prepareEditorImages();
    prepareEditorVideos();
    prepareEditorAttachments();

    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.setStartAfter(lastInsertedNode);
    nextRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    editorSelectionRef.current = nextRange.cloneRange();
    syncEditorContent();
    return true;
  }

  async function copyEditorSelection({ silent = false } = {}) {
    const range = getSavedEditorSelectionRange();
    if (!range) {
      if (!silent) {
        window.alert('请先选中要复制的内容');
      }
      return false;
    }

    const selection = window.getSelection();
    try {
      editorRef.current?.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const { html, text, imageBlob } = await getEditorSelectionClipboardPayload(range);
      if (navigator.clipboard?.write && window.ClipboardItem && html) {
        const clipboardPayload = {
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        };
        if (imageBlob) {
          clipboardPayload['image/png'] = imageBlob;
        }
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem(clipboardPayload),
          ]);
        } catch (writeError) {
          if (!imageBlob) throw writeError;
          await navigator.clipboard.write([
            new window.ClipboardItem({
              'text/html': clipboardPayload['text/html'],
              'text/plain': clipboardPayload['text/plain'],
            }),
          ]);
        }
        return true;
      }

      if (navigator.clipboard?.writeText && text) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      if (document.execCommand('copy')) {
        return true;
      }
    } catch (error) {
      console.warn('Failed to copy editor selection', error);
      try {
        if (document.execCommand('copy')) {
          return true;
        }
      } catch (fallbackError) {
        console.warn('Fallback editor copy failed', fallbackError);
      }
    } finally {
      saveEditorSelection();
    }

    window.alert('复制失败，请使用 Ctrl+C 复制选中内容');
    return false;
  }

  function ensureEditorInsertionRange() {
    if (!editorRef.current) return null;

    restoreEditorSelection();
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        return range;
      }
    }

    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorSelectionRef.current = range.cloneRange();
    return range;
  }

  function applyEditorCommand(command, value = null) {
    if (command === 'undo') {
      undoEditorChange();
      return;
    }
    if (command === 'redo') {
      redoEditorChange();
      return;
    }
    restoreEditorSelection();
    document.execCommand(command, false, value);
    syncEditorContent();
    saveEditorSelection();
  }

  function clearEditorFormatting() {
    if (!restoreEditorSelection()) return;
    document.execCommand('removeFormat', false, null);
    document.execCommand('unlink', false, null);

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const plainText = fragment.textContent ?? '';
    if (!plainText) {
      syncEditorContent();
      saveEditorSelection();
      return;
    }

    range.deleteContents();
    const textNode = document.createTextNode(plainText);
    range.insertNode(textNode);
    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(textNode);
    selection.addRange(nextRange);
    syncEditorContent();
    saveEditorSelection();
  }

  function clearActiveEditorImage() {
    editorRef.current?.querySelectorAll('.editorImageFrame.active').forEach((element) => {
      element.classList.remove('active');
    });
  }

  function clearActiveEditorAttachment() {
    editorRef.current?.querySelectorAll('.editorAttachmentFrame.active').forEach((element) => {
      element.classList.remove('active');
    });
  }

  function clearActiveEditorVideo() {
    editorRef.current?.querySelectorAll('.editorVideoFrame.active').forEach((element) => {
      element.classList.remove('active');
    });
  }

  function clearActiveEditorObjects() {
    clearActiveEditorImage();
    clearActiveEditorAttachment();
    clearActiveEditorVideo();
  }

  function getClosestEditorObject(target) {
    const frame = target?.closest?.('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame');
    return frame && editorRef.current?.contains(frame) ? frame : null;
  }

  function isEditorObjectElement(element) {
    return element instanceof HTMLElement
      && element.matches('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame');
  }

  function isRangeSelectingSingleEditorObject(range) {
    if (!range || range.collapsed) return false;
    const fragment = range.cloneContents();
    const meaningfulNodes = Array.from(fragment.childNodes).filter((node) => (
      node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim())
    ));
    return meaningfulNodes.length === 1 && isEditorObjectElement(meaningfulNodes[0]);
  }

  function selectEditorObject(frame) {
    if (!frame || !editorRef.current?.contains(frame)) return false;
    clearActiveEditorObjects();
    frame.classList.add('active');

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(frame);
    editorSelectionRef.current = range.cloneRange();

    if (frame.classList.contains('editorAttachmentFrame')) {
      const caretRange = document.createRange();
      caretRange.setStartAfter(frame);
      caretRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(caretRange);
      skipNextEditorSelectionSaveRef.current = true;
      return true;
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }

  function makeImageNonDraggable(image) {
    image.draggable = false;
    image.setAttribute('draggable', 'false');
  }

  function prepareImageFrame(frame) {
    frame.contentEditable = 'false';
    frame.draggable = false;
    frame.setAttribute('draggable', 'false');
  }

  function prepareAttachmentFrame(frame) {
    frame.contentEditable = 'false';
    frame.draggable = false;
    frame.setAttribute('draggable', 'false');
    clearAttachmentBackground(frame);
    const kind = getAttachmentKind(frame.dataset.attachmentName ?? '', frame.dataset.attachmentType ?? '');
    frame.classList.remove('attachmentPdf', 'attachmentWord', 'attachmentExcel', 'attachmentVideo', 'attachmentFile');
    frame.classList.add(`attachment${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
  }

  function clearAttachmentBackground(frame) {
    if (!(frame instanceof HTMLElement)) return;
    frame.style.background = '';
    frame.style.backgroundColor = '';

    const editor = editorRef.current;
    let current = frame.parentElement;
    while (current && current !== editor) {
      if (current instanceof HTMLElement && current.querySelector?.('.editorAttachmentFrame')) {
        current.style.background = '';
        current.style.backgroundColor = '';
      }
      current = current.parentElement;
    }
  }

  function stripStoredAssetSrcBeforeDomInsert(html) {
    // Remove dbasset: URLs from img[src] before innerHTML insertion so the
    // browser doesn't attempt to fetch the unknown scheme and flood the console
    // with ERR_UNKNOWN_URL_SCHEME errors. The real src is kept in
    // data-editor-src so prepareEditorImages can resolve it asynchronously.
    if (!html || typeof document === 'undefined') return html;
    const container = document.createElement('div');
    container.innerHTML = html;
    normalizeEditorMediaSourcesInElement(container);
    container.querySelectorAll('.editorAttachmentFrame[data-attachment-url]').forEach((frame) => {
      const url = frame.getAttribute('data-attachment-url') || '';
      if (isStoredAssetUrl(url)) {
        // Keep the attribute – attachment frames don't trigger network requests.
        // prepareEditorAttachments handles them synchronously.
      }
    });
    return container.innerHTML;
  }

  function prepareEditorVideos() {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('video').forEach((video) => {
      if (video.closest('.editorAttachmentFrame')) return;
      const existingFrame = video.closest('.editorVideoFrame');
      const rawSrc = video.getAttribute('src') || '';
      if (isStoredAssetUrl(rawSrc)) {
        video.dataset.editorSrc = rawSrc;
        video.removeAttribute('src');
      }
      const url = video.dataset.editorSrc || video.getAttribute('src') || '';
      if (url) {
        const frame = createAttachmentFrame({
          name: existingFrame?.dataset.videoName || video.getAttribute('aria-label') || '视频',
          type: video.dataset.editorType || existingFrame?.dataset.videoType || 'video/mp4',
          size: Number(existingFrame?.dataset.videoSize || 0),
          url,
        });
        (existingFrame || video).replaceWith(frame);
        return;
      }

      video.controls = true;
      video.preload = 'metadata';
      video.draggable = false;
      video.setAttribute('draggable', 'false');
      const storedSrc = video.dataset.editorSrc || video.getAttribute('src') || '';
      if (isStoredAssetUrl(storedSrc)) {
        video.dataset.editorSrc = storedSrc;
        if (!video.dataset.objectUrl || video.getAttribute('src') === storedSrc) {
          resolveStoredAssetDataUrl(storedSrc)
            .then((dataUrl) => {
              if (!editorRef.current?.contains(video)) return;
              if (video.dataset.objectUrl) {
                URL.revokeObjectURL(video.dataset.objectUrl);
                editorObjectUrlsRef.current.delete(video.dataset.objectUrl);
              }
              const objectUrl = dataUrlToBlobUrl(dataUrl, video.dataset.editorType || 'video/mp4');
              editorObjectUrlsRef.current.add(objectUrl);
              video.dataset.objectUrl = objectUrl;
              video.src = objectUrl;
            })
            .catch((error) => {
              console.warn('Failed to load stored video asset', error);
              video.removeAttribute('src');
            });
        }
      }
      if (existingFrame) {
        existingFrame.contentEditable = 'false';
        existingFrame.draggable = false;
        existingFrame.setAttribute('draggable', 'false');
        return;
      }

      const frame = document.createElement('span');
      frame.className = 'editorVideoFrame';
      frame.contentEditable = 'false';
      frame.draggable = false;
      frame.setAttribute('draggable', 'false');
      video.parentNode?.insertBefore(frame, video);
      frame.appendChild(video);
    });
  }

  function prepareEditorImages() {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('img').forEach((image) => {
      makeImageNonDraggable(image);
      image.loading = 'lazy';
      image.decoding = 'async';
      const rawSrc = image.getAttribute('src') || '';
      if (isStoredAssetUrl(rawSrc)) {
        image.dataset.editorSrc = rawSrc;
        image.removeAttribute('src');
      }
      const storedSrc = image.dataset.editorSrc || image.getAttribute('src') || '';
      if (isStoredAssetUrl(storedSrc)) {
        image.dataset.editorSrc = storedSrc;
        if (!image.dataset.objectUrl || image.getAttribute('src') === storedSrc) {
          resolveStoredAssetDataUrl(storedSrc)
            .then((dataUrl) => {
              if (!editorRef.current?.contains(image)) return;
              if (image.dataset.objectUrl) {
                URL.revokeObjectURL(image.dataset.objectUrl);
                editorObjectUrlsRef.current.delete(image.dataset.objectUrl);
              }
              const objectUrl = dataUrlToBlobUrl(dataUrl, 'image/jpeg');
              editorObjectUrlsRef.current.add(objectUrl);
              image.dataset.objectUrl = objectUrl;
              image.src = objectUrl;
            })
            .catch((error) => {
              console.warn('Failed to load stored image asset', error);
              image.alt = '图片资源加载失败';
            });
        }
      }
      const existingFrame = image.closest('.editorImageFrame');
      if (existingFrame) {
        prepareImageFrame(existingFrame);
        return;
      }

      const frame = document.createElement('span');
      frame.className = 'editorImageFrame';
      prepareImageFrame(frame);
      frame.style.width = image.style.width || '320px';

      const handle = document.createElement('span');
      handle.className = 'editorImageResizeHandle';

      image.parentNode?.insertBefore(frame, image);
      frame.appendChild(image);
      frame.appendChild(handle);
    });
  }

  function prepareEditorAttachments() {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('.editorAttachmentFrame').forEach((frame) => {
      prepareAttachmentFrame(frame);
    });
  }

  function prepareEditorStoredAssetSources() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('img[src], video[src]').forEach((element) => {
      const src = element.getAttribute('src') || '';
      if (isStoredAssetUrl(src)) {
        element.setAttribute('data-editor-src', src);
        element.removeAttribute('src');
      }
    });
    prepareEditorImages();
    prepareEditorVideos();
    prepareEditorAttachments();
  }

  function clearNestedEditorStyles(container, styleKeys) {
    container.querySelectorAll('[style]').forEach((element) => {
      styleKeys.forEach((key) => {
        element.style[key] = '';
      });
      if (!element.getAttribute('style')?.trim()) {
        element.removeAttribute('style');
      }
    });
  }

  function applyStyleToNestedEditorElements(container, style) {
    container.querySelectorAll('span, font, b, strong, i, em, u, a').forEach((element) => {
      if (element.closest('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame')) return;
      Object.assign(element.style, style);
    });
  }

  function selectionContainsEditorObject(range) {
    if (!range || range.collapsed) return false;
    const fragment = range.cloneContents();
    return Boolean(fragment.querySelector?.('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame'));
  }

  function stripInlineFormatting(container) {
    // Unwrap formatting tags, preserving their text content
    const formattingTags = ['B', 'STRONG', 'I', 'EM', 'U', 'FONT'];
    formattingTags.forEach((tag) => {
      const elements = Array.from(container.querySelectorAll(tag));
      elements.forEach((el) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      });
    });

    // Strip style attributes from spans, but preserve editor frame elements
    container.querySelectorAll('span').forEach((el) => {
      if (el.classList.contains('editorImageFrame') ||
          el.classList.contains('editorVideoFrame') ||
          el.classList.contains('editorAttachmentFrame') ||
          el.classList.contains('editorImageResizeHandle') ||
          el.classList.contains('editorImageDropMarker') ||
          el.classList.contains('editorAttachmentIcon') ||
          el.classList.contains('editorAttachmentText')) {
        return;
      }
      if (el.classList.contains('editorItalic')) {
        el.classList.remove('editorItalic');
      }
      el.removeAttribute('style');
    });
  }

  function applyFormatStyleToTextNodes(container, style) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      if (!textNode.nodeValue) return;
      const parent = textNode.parentNode;
      if (!parent) return;
      const fragment = document.createDocumentFragment();
      const lines = textNode.nodeValue.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        if (!line) return;
        const span = document.createElement('span');
        Object.assign(span.style, style);
        span.textContent = line;
        fragment.appendChild(span);
      });
      parent.replaceChild(fragment, textNode);
    });
  }

  function collectFormattingFromElement(el, defaults, style) {
    const computed = window.getComputedStyle(el);
    const tag = el.tagName;
    const inlineStyle = el instanceof HTMLElement ? el.style : null;
    const canProvideInlineBackground = INLINE_EDITOR_FORMAT_TAGS.has(tag) || Boolean(inlineStyle?.backgroundColor);

    // Bold: from <b>/<strong> tag or computed font-weight
    if (!style.fontWeight) {
      if (tag === 'B' || tag === 'STRONG') {
        style.fontWeight = 'bold';
      } else {
        const w = computed.fontWeight;
        if (w && w !== '400' && w !== 'normal') {
          style.fontWeight = w;
        }
      }
    }

    // Italic: from <i>/<em> tag, .editorItalic class, or computed font-style
    if (!style.fontStyle) {
      if (tag === 'I' || tag === 'EM' || el.classList?.contains('editorItalic')) {
        style.fontStyle = 'italic';
      } else if (computed.fontStyle === 'italic' || computed.fontStyle === 'oblique') {
        style.fontStyle = 'italic';
      }
    }

    // Underline / line-through: from <u> tag or computed text-decoration
    if (!style.textDecoration) {
      if (tag === 'U') {
        style.textDecoration = 'underline';
      } else {
        const deco = computed.textDecorationLine;
        if (deco && deco !== 'none') {
          if (deco.includes('underline')) {
            style.textDecoration = 'underline';
          } else if (deco.includes('line-through')) {
            style.textDecoration = 'line-through';
          }
        }
      }
    }

    // Text color
    if (!style.color) {
      const defaultColor = defaults?.color || 'rgb(17, 17, 17)';
      if (computed.color && computed.color !== defaultColor) {
        style.color = computed.color;
      }
    }

    // Background color
    if (!style.backgroundColor && canProvideInlineBackground) {
      const bg = computed.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== (defaults?.backgroundColor || '')) {
        style.backgroundColor = bg;
      }
    }

    // Font size
    if (!style.fontSize) {
      const defaultFontSize = defaults?.fontSize || '14px';
      if (computed.fontSize && computed.fontSize !== defaultFontSize) {
        style.fontSize = computed.fontSize;
      }
    }

    // Font family
    if (!style.fontFamily) {
      const defaultFontFamily = defaults?.fontFamily || '';
      if (computed.fontFamily && computed.fontFamily !== defaultFontFamily) {
        style.fontFamily = computed.fontFamily;
      }
    }
  }

  function applyEditorStyle(style) {
    if (!restoreEditorSelection()) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (selectionContainsEditorObject(range)) {
      window.alert('请只选中文字后再使用文字颜色或背景高亮');
      prepareEditorStoredAssetSources();
      saveEditorSelection();
      return;
    }
    const styleKeys = Object.keys(style);
    const canUseNativeInlineCommand = styleKeys.length > 0
      && styleKeys.every((key) => key === 'color' || key === 'backgroundColor');

    if (range.collapsed || canUseNativeInlineCommand) {
      document.execCommand('styleWithCSS', false, true);
      if (style.color) {
        document.execCommand('foreColor', false, style.color);
      }
      if (style.backgroundColor) {
        const appliedHighlight = document.execCommand('hiliteColor', false, style.backgroundColor);
        if (!appliedHighlight) {
          document.execCommand('backColor', false, style.backgroundColor);
        }
      }
      prepareEditorStoredAssetSources();
      saveEditorSelection();
      syncEditorContent();
      return;
    }
    const styledSpan = document.createElement('span');
    Object.assign(styledSpan.style, style);
    styledSpan.appendChild(range.extractContents());
    clearNestedEditorStyles(styledSpan, styleKeys);
    applyStyleToNestedEditorElements(styledSpan, style);
    range.insertNode(styledSpan);

    // Unwrap redundant ancestor spans that became empty after extractContents().
    // Without this, a leftover <span style="font-size:22px"> around a newly
    // restyled <span style="font-size:12px"> would keep the line box tall.
    let ancestor = styledSpan.parentElement;
    while (ancestor && ancestor.tagName === 'SPAN' && editorRef.current?.contains(ancestor)) {
      const ancestorText = (ancestor.textContent || '').replace(/ /g, ' ').trim();
      const styledText = (styledSpan.textContent || '').replace(/ /g, ' ').trim();
      if (ancestorText === styledText) {
        ancestor.replaceWith(styledSpan);
        ancestor = styledSpan.parentElement;
      } else {
        break;
      }
    }

    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(styledSpan);
    selection.addRange(nextRange);
    prepareEditorStoredAssetSources();
    saveEditorSelection();
    syncEditorContent();
  }

  function applyFormatPainterStyle(style) {
    // Use saved selection (set synchronously by saveEditorSelection), not
    // window.getSelection() which can shift during the setTimeout deferral.
    if (!editorRef.current) return;
    if (!restoreEditorSelection()) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    // Extract selected content and strip all existing inline formatting
    const fragment = range.extractContents();
    const tempContainer = document.createElement('span');
    tempContainer.appendChild(fragment);
    stripInlineFormatting(tempContainer);
    applyFormatStyleToTextNodes(tempContainer, style);

    const styledFragment = document.createDocumentFragment();
    let lastInsertedNode = null;
    while (tempContainer.firstChild) {
      lastInsertedNode = tempContainer.firstChild;
      styledFragment.appendChild(tempContainer.firstChild);
    }
    if (!lastInsertedNode) return;

    range.insertNode(styledFragment);
    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.setStartAfter(lastInsertedNode);
    nextRange.collapse(true);
    selection.addRange(nextRange);
    syncEditorContent();
    editorSelectionRef.current = nextRange.cloneRange();
  }

  function handleFormatPainter() {
    // Deactivate if already active
    if (formatPainterRef.current) {
      formatPainterRef.current = null;
      document.body.style.removeProperty('cursor');
      return;
    }

    // Need a non-empty selection to copy formatting
    if (!restoreEditorSelection()) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const defaults = editorRef.current ? window.getComputedStyle(editorRef.current) : null;
    const style = {};

    // Walk up from the selection start through all ancestor elements,
    // collecting tag-based and inline formatting at each level.
    // The innermost element's styles take priority (checked first).
    let el = range.startContainer;
    if (el.nodeType === Node.TEXT_NODE) {
      el = el.parentElement;
    }
    while (el && el !== editorRef.current && el.nodeType === Node.ELEMENT_NODE) {
      collectFormattingFromElement(el, defaults, style);
      el = el.parentElement;
    }

    if (Object.keys(style).length === 0) return;

    formatPainterRef.current = style;
    document.body.style.cursor = 'copy';
  }

  function applyEditorTextColor(color) {
    setActiveEditorTextColor(color);
    applyEditorStyle({ color });
  }

  function applyEditorBackgroundColor(backgroundColor) {
    setActiveEditorBackgroundColor(backgroundColor);
    applyEditorStyle({ backgroundColor });
  }

  function getClosestStyledItalic(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const match = element?.closest?.('.editorItalic, i, em, span');
    if (!match || !editorRef.current?.contains(match)) return null;
    const style = match instanceof HTMLElement ? match.style : null;
    const hasInlineItalic = style?.fontStyle === 'italic' && style?.transform.includes('skewX');
    return match.classList.contains('editorItalic') || match.tagName === 'I' || match.tagName === 'EM' || hasInlineItalic
      ? match
      : null;
  }

  function unwrapElement(element) {
    const parent = element.parentNode;
    if (!parent) return null;
    const firstChild = element.firstChild;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
    return firstChild ?? parent;
  }

  function toggleEditorItalic() {
    if (!restoreEditorSelection()) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const italicElement = getClosestStyledItalic(range.commonAncestorContainer)
      ?? getClosestStyledItalic(range.startContainer);

    if (italicElement) {
      const selectionTarget = unwrapElement(italicElement);
      selection.removeAllRanges();
      if (selectionTarget) {
        const nextRange = document.createRange();
        nextRange.selectNodeContents(selectionTarget);
        selection.addRange(nextRange);
      }
      syncEditorContent();
      saveEditorSelection();
      return;
    }

    const italicSpan = document.createElement('span');
    italicSpan.className = 'editorItalic';
    italicSpan.appendChild(range.extractContents());
    range.insertNode(italicSpan);
    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(italicSpan);
    selection.addRange(nextRange);
    syncEditorContent();
    saveEditorSelection();
  }

  function addEditorLink() {
    const url = window.prompt('请输入链接地址');
    if (url) applyEditorCommand('createLink', normalizeEditorUrl(url));
  }

  function getEditorEditableInsertionRange() {
    const editor = editorRef.current;
    if (!editor) return null;

    const restoredRange = ensureEditorInsertionRange();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : restoredRange;
    if (range && isRangeSelectingSingleEditorObject(range)) {
      const activeObject = editor.querySelector('.editorImageFrame.active, .editorVideoFrame.active, .editorAttachmentFrame.active');
      if (activeObject) {
        const objectRange = document.createRange();
        objectRange.setStartAfter(activeObject);
        objectRange.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(objectRange);
        editorSelectionRef.current = objectRange.cloneRange();
        return objectRange;
      }
    }
    const node = range?.commonAncestorContainer;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const currentBody = element?.closest?.('.mergedWorkflowBody');
    if (currentBody && editor.contains(currentBody)) {
      if (currentBody.contains(range.startContainer) && currentBody.contains(range.endContainer)) {
        return range;
      }
    }

    const fallbackBody = !isMergedWorkflowView
      ? editor.querySelector('.singleWorkflowSection .mergedWorkflowBody')
      : editor.querySelector('.mergedWorkflowBody');
    const target = fallbackBody || editor;
    const nextRange = document.createRange();
    nextRange.selectNodeContents(target);
    nextRange.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    editorSelectionRef.current = nextRange.cloneRange();
    return nextRange;
  }

  function insertEditorTimestamp() {
    const range = getEditorEditableInsertionRange();
    if (!range) return;
    const selection = window.getSelection();
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });

    const timestampBlock = document.createElement('div');
    timestampBlock.className = 'editorTimestampBlock';
    timestampBlock.contentEditable = 'false';
    timestampBlock.textContent = timestamp;

    const nextLine = document.createElement('div');
    const cursorText = document.createTextNode('\u200b');
    nextLine.appendChild(cursorText);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(timestampBlock);
    fragment.appendChild(nextLine);

    range.deleteContents();
    range.insertNode(fragment);

    const nextRange = document.createRange();
    nextRange.setStart(cursorText, cursorText.length);
    nextRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    editorSelectionRef.current = nextRange.cloneRange();
    syncEditorContentAndFlushSave();
  }

  function addEditorImage() {
    imageInputRef.current?.click();
  }

  function addEditorVideo() {
    videoInputRef.current?.click();
  }

  function addEditorAttachment() {
    attachmentInputRef.current?.click();
  }

  function createAttachmentFrame({ name, type, size, url }) {
    const kind = getAttachmentKind(name, type);
    const frame = document.createElement('span');
    frame.className = `editorAttachmentFrame attachment${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
    frame.dataset.attachmentName = name;
    frame.dataset.attachmentType = type;
    frame.dataset.attachmentSize = String(size);
    frame.dataset.attachmentUrl = url;
    prepareAttachmentFrame(frame);

    const label = kind === 'pdf' ? 'PDF' : kind === 'word' ? 'Word' : kind === 'excel' ? 'Excel' : '文件';
    frame.innerHTML = [
      `<span class="editorAttachmentIcon">${escapeHtml(label)}</span>`,
      '<span class="editorAttachmentText">',
      `<strong>${escapeHtml(name)}</strong>`,
      `<small>${escapeHtml(formatFileSize(size))}</small>`,
      '</span>',
    ].join('');
    if (kind === 'video') {
      frame.querySelector('.editorAttachmentIcon').textContent = 'Video';
    }
    return frame;
  }

  function insertEditorAttachment(file, url, { sync = true, selectInserted = true } = {}) {
    if (!editorRef.current) return;
    const range = ensureEditorInsertionRange();
    if (!range) return;
    const selection = window.getSelection();

    const frame = createAttachmentFrame({
      name: file.name,
      type: file.type,
      size: file.size,
      url,
    });

    range.deleteContents();
    range.insertNode(frame);
    clearAttachmentBackground(frame);
    range.setStartAfter(frame);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (selectInserted) {
      selectEditorObject(frame);
    } else {
      clearActiveEditorObjects();
      editorSelectionRef.current = range.cloneRange();
    }
    if (sync) syncEditorContent();
    if (!selectInserted) saveEditorSelection();
  }

  const MAX_IMAGE_DIMENSION = 1200;
  const IMAGE_EXPORT_QUALITY = 0.78;

  async function readImageAsResizedDataUrl(file) {
    const originalUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });

    if (typeof originalUrl !== 'string' || !originalUrl) {
      throw new Error('读取图片失败');
    }

    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const { naturalWidth, naturalHeight } = img;
            const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(naturalWidth * scale);
            canvas.height = Math.round(naturalHeight * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', IMAGE_EXPORT_QUALITY));
          } catch {
            resolve(originalUrl);
          }
        };
        img.onerror = () => resolve(originalUrl);
        img.src = originalUrl;
      });
    } catch {
      return originalUrl;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('读取附件失败'));
      reader.readAsDataURL(file);
    });
  }

  function isVideoFile(file) {
    return file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name);
  }

  function insertEditorVideo(file, src, { sync = true, selectInserted = true } = {}) {
    insertEditorAttachment(
      {
        name: file.name,
        type: file.type || 'video/mp4',
        size: file.size,
      },
      src,
      { sync, selectInserted },
    );
    return;

    if (!editorRef.current) return;
    const range = ensureEditorInsertionRange();
    if (!range) return;
    const selection = window.getSelection();

    const frame = document.createElement('span');
    frame.className = 'editorVideoFrame';
    frame.contentEditable = 'false';
    frame.draggable = false;
    frame.setAttribute('draggable', 'false');
    frame.dataset.videoName = file.name;
    frame.dataset.videoType = file.type;
    frame.dataset.videoSize = String(file.size);

    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    video.dataset.editorSrc = src;
    video.dataset.editorType = file.type || 'video/mp4';
    video.setAttribute('aria-label', file.name || '上传视频');
    video.draggable = false;
    video.setAttribute('draggable', 'false');

    if (isStoredAssetUrl(src)) {
      resolveStoredAssetDataUrl(src)
        .then((dataUrl) => {
          if (!editorRef.current?.contains(video)) return;
          const objectUrl = dataUrlToBlobUrl(dataUrl, file.type || 'video/mp4');
          editorObjectUrlsRef.current.add(objectUrl);
          video.dataset.objectUrl = objectUrl;
          video.src = objectUrl;
        })
        .catch((error) => {
          console.warn('Failed to load inserted video asset', error);
        });
    } else {
      video.src = src;
    }

    const caption = document.createElement('span');
    caption.className = 'editorVideoCaption';
    caption.textContent = `${file.name || '上传视频'}${file.size ? ` · ${formatFileSize(file.size)}` : ''}`;

    frame.appendChild(video);
    frame.appendChild(caption);

    range.deleteContents();
    range.insertNode(frame);
    range.setStartAfter(frame);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    selectEditorObject(frame);
    if (sync) syncEditorContent();
    saveEditorSelection();
  }

  async function handleEditorVideoSelected(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const MAX_TOTAL_VIDEO_SIZE = 300 * 1024 * 1024;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_VIDEO_SIZE) {
      window.alert(`视频总大小（${formatFileSize(totalSize)}）超过上限 ${formatFileSize(MAX_TOTAL_VIDEO_SIZE)}，请分批上传`);
      return;
    }

    for (const file of files) {
      if (!isVideoFile(file)) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const videoUrl = dataUrl
          ? await saveDataUrlAsset({
            dataUrl,
            name: file.name,
            type: file.type || 'video/mp4',
            size: file.size,
            kind: 'video',
          })
          : '';
        if (videoUrl) insertEditorVideo(file, videoUrl, { sync: false, selectInserted: files.length === 1 });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } catch (error) {
        console.error('Failed to insert video', file.name, error);
        window.alert(`视频「${file.name}」读取失败，已跳过`);
      }
    }
    syncEditorContentAndFlushSave();
  }

  async function handleEditorAttachmentSelected(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    // Limit total attachment size to prevent memory issues
    const MAX_TOTAL_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      window.alert(`附件总大小（${formatFileSize(totalSize)}）超过上限 ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE)}，请分批上传`);
      return;
    }

    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const url = dataUrl
          ? await saveDataUrlAsset({
            dataUrl,
            name: file.name,
            type: file.type,
            size: file.size,
            kind: getAttachmentKind(file.name, file.type),
          })
          : '';
        if (url) insertEditorAttachment(file, url, { sync: false, selectInserted: files.length === 1 });
      } catch (error) {
        console.error('Failed to attach file', file.name, error);
        window.alert(`附件「${file.name}」读取失败，已跳过`);
      }
    }
    syncEditorContentAndFlushSave();
  }

  async function openEditorAttachmentPreview(frame) {
    const name = frame.dataset.attachmentName ?? '附件';
    const type = frame.dataset.attachmentType ?? '';
    const size = Number(frame.dataset.attachmentSize ?? 0);
    const url = frame.dataset.attachmentUrl ?? '';
    const kind = getAttachmentKind(name, type);
    setAttachmentPreview({ name, type, size, url, kind, status: 'loading' });

    try {
      const previewDataUrl = await resolveStoredAssetDataUrl(url);
      if (kind === 'pdf') {
        const previewUrl = dataUrlToBlobUrl(previewDataUrl, type || 'application/pdf');
        setAttachmentPreview({ name, type, size, url: previewDataUrl, previewUrl, kind, status: 'ready' });
        return;
      }

      if (kind === 'video') {
        const previewUrl = dataUrlToBlobUrl(previewDataUrl, type || 'video/mp4');
        setAttachmentPreview({ name, type, size, url: previewDataUrl, previewUrl, kind, status: 'ready' });
        return;
      }

      const arrayBuffer = dataUrlToArrayBuffer(previewDataUrl);
      if (kind === 'word' && name.toLowerCase().endsWith('.docx')) {
        setAttachmentPreview({ name, type, size, url: previewDataUrl, kind, status: 'ready', docxBuffer: arrayBuffer });
        return;
      }

      if (kind === 'excel') {
        setAttachmentPreview({ name, type, size, url: previewDataUrl, kind, status: 'ready', excelBuffer: arrayBuffer });
        return;
      }

      setAttachmentPreview({ name, type, size, url: previewDataUrl, kind, status: 'unsupported' });
    } catch (error) {
      setAttachmentPreview({ name, type, size, url, kind, status: 'error', message: error instanceof Error ? error.message : '预览失败' });
    }
  }

  async function openEditorImagePreview(frame) {
    const image = frame?.querySelector?.('img');
    if (!image) return;

    const source = image.dataset.editorSrc || image.getAttribute('src') || '';
    if (!source) return;

    setAttachmentPreview({ name: image.alt || '图片预览', kind: 'image', url: source, status: 'loading' });

    try {
      const imageUrl = await resolveStoredAssetDataUrl(source);
      setAttachmentPreview({
        name: image.alt || '图片预览',
        kind: 'image',
        url: imageUrl,
        status: 'ready',
      });
    } catch (error) {
      setAttachmentPreview({
        name: image.alt || '图片预览',
        kind: 'image',
        url: source,
        status: 'error',
        message: error instanceof Error ? error.message : '图片预览失败',
      });
    }
  }

  function getActiveEditorImageFrame() {
    const frame = editorRef.current?.querySelector('.editorImageFrame.active');
    return frame instanceof HTMLElement ? frame : null;
  }

  function getMaxEditorImageWidth() {
    return Math.max(EDITOR_IMAGE_MIN_WIDTH, (editorRef.current?.clientWidth ?? 0) - 26);
  }

  function setEditorImageWidth(frame, width) {
    const nextWidth = Math.max(EDITOR_IMAGE_MIN_WIDTH, Math.min(getMaxEditorImageWidth(), width));
    frame.style.width = `${Math.round(nextWidth)}px`;
  }

  function alignEditorImage(alignment) {
    const frame = getActiveEditorImageFrame();
    if (!frame) return;

    frame.style.display = 'block';
    frame.style.marginLeft = alignment === 'right' || alignment === 'center' ? 'auto' : '0';
    frame.style.marginRight = alignment === 'left' || alignment === 'center' ? 'auto' : '0';
    syncEditorContent();
  }

  function insertEditorImage(src, { sync = true, selectInserted = true } = {}) {
    if (!editorRef.current) return;
    const range = ensureEditorInsertionRange();
    if (!range) return;
    const selection = window.getSelection();

    const frame = document.createElement('span');
    frame.className = 'editorImageFrame';
    prepareImageFrame(frame);
    frame.style.width = '320px';

    const image = document.createElement('img');
    image.dataset.editorSrc = src;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (isStoredAssetUrl(src)) {
      resolveStoredAssetDataUrl(src)
        .then((dataUrl) => {
          if (!editorRef.current?.contains(image)) return;
          const objectUrl = dataUrlToBlobUrl(dataUrl, 'image/jpeg');
          editorObjectUrlsRef.current.add(objectUrl);
          image.dataset.objectUrl = objectUrl;
          image.src = objectUrl;
        })
        .catch((error) => {
          console.warn('Failed to load inserted image asset', error);
          image.alt = '图片资源加载失败';
        });
    } else {
      image.src = src;
    }
    image.alt = '上传图片';
    image.addEventListener('error', function onImageError() {
      if (this.dataset.editorSrc && isStoredAssetUrl(this.dataset.editorSrc)) {
        resolveStoredAssetDataUrl(this.dataset.editorSrc)
          .then((dataUrl) => {
            if (!editorRef.current?.contains(this)) return;
            const objectUrl = dataUrlToBlobUrl(dataUrl, 'image/jpeg');
            editorObjectUrlsRef.current.add(objectUrl);
            this.dataset.objectUrl = objectUrl;
            this.src = objectUrl;
          })
          .catch(() => {
            this.alt = '图片加载失败';
          });
      }
    });
    makeImageNonDraggable(image);

    const handle = document.createElement('span');
    handle.className = 'editorImageResizeHandle';

    frame.appendChild(image);
    frame.appendChild(handle);

    range.deleteContents();
    range.insertNode(frame);
    range.setStartAfter(frame);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (selectInserted) {
      selectEditorObject(frame);
    } else {
      clearActiveEditorObjects();
      editorSelectionRef.current = range.cloneRange();
    }
    if (sync) syncEditorContent();
    saveEditorSelection();
  }

  async function handleEditorImageSelected(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const MAX_TOTAL_IMAGE_SIZE = 100 * 1024 * 1024;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
      window.alert(`图片总大小（${formatFileSize(totalSize)}）超过上限 ${formatFileSize(MAX_TOTAL_IMAGE_SIZE)}，请分批上传`);
      return;
    }

    for (const file of files) {
      try {
        const imageDataUrl = await readImageAsResizedDataUrl(file);
        const imageUrl = imageDataUrl
          ? await saveDataUrlAsset({
            dataUrl: imageDataUrl,
            name: file.name,
            type: 'image/jpeg',
            size: imageDataUrl.length,
            kind: 'image',
          })
          : '';
        if (imageUrl) insertEditorImage(imageUrl, { sync: false, selectInserted: files.length === 1 });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } catch (error) {
        console.error('Failed to insert image', file.name, error);
        window.alert(`图片「${file.name}」读取失败，已跳过`);
      }
    }
    syncEditorContentAndFlushSave();
  }

  function handleEditorClick(event) {
    const attachmentFrame = event.target.closest?.('.editorAttachmentFrame');
    if (attachmentFrame && editorRef.current?.contains(attachmentFrame)) {
      event.preventDefault();
      selectEditorObject(attachmentFrame);
      return;
    }

    const imageFrame = event.target.closest?.('.editorImageFrame');
    if (imageFrame && editorRef.current?.contains(imageFrame)) {
      event.preventDefault();
      selectEditorObject(imageFrame);
      return;
    }

    const videoFrame = event.target.closest?.('.editorVideoFrame');
    if (videoFrame && editorRef.current?.contains(videoFrame)) {
      event.preventDefault();
      selectEditorObject(videoFrame);
      return;
    }
    clearActiveEditorObjects();

    const link = event.target.closest?.('a');
    if (!link || !editorRef.current?.contains(link)) return;
    const href = link.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    window.open(normalizeEditorUrl(href), '_blank', 'noopener,noreferrer');
  }

  function handleEditorDoubleClick(event) {
    const imageFrame = event.target.closest?.('.editorImageFrame');
    if (imageFrame && editorRef.current?.contains(imageFrame)) {
      event.preventDefault();
      openEditorImagePreview(imageFrame);
      return;
    }

    const attachmentFrame = event.target.closest?.('.editorAttachmentFrame');
    if (!attachmentFrame || !editorRef.current?.contains(attachmentFrame)) return;
    event.preventDefault();
    openEditorAttachmentPreview(attachmentFrame);
  }

  function getEditorDropRange(clientX, clientY) {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(clientX, clientY);
    }

    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(clientX, clientY);
      if (!position) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }

    return null;
  }

  function removeImageDropMarker() {
    imageDropMarkerRef.current?.remove();
    imageDropMarkerRef.current = null;
  }

  function removeImageDragGhost() {
    imageDragGhostRef.current?.remove();
    imageDragGhostRef.current = null;
  }

  function removeCustomImageDragListeners() {
    cancelAnimationFrame(imageDragRafRef.current);
    imageDragRafRef.current = null;
    imageDragLastEventRef.current = null;
    document.removeEventListener('mousemove', handleCustomImageDragMove, true);
    document.removeEventListener('mouseup', stopCustomImageDrag, true);
    window.removeEventListener('blur', stopCustomImageDrag);
    document.removeEventListener('visibilitychange', stopCustomImageDrag);
  }

  function updateImageDragGhost(clientX, clientY) {
    const dragState = imageDragStateRef.current;
    const ghost = imageDragGhostRef.current;
    if (!dragState || !ghost) return;

    const left = clientX - dragState.pointerOffsetX;
    const top = clientY - dragState.pointerOffsetY;
    ghost.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  }

  function ensureImageDropMarker(frame) {
    if (imageDropMarkerRef.current) return imageDropMarkerRef.current;
    const marker = document.createElement('span');
    marker.className = 'editorImageDropMarker';
    marker.style.width = frame.style.width || `${Math.round(frame.getBoundingClientRect().width)}px`;
    marker.style.height = `${Math.round(frame.getBoundingClientRect().height)}px`;
    marker.style.display = frame.style.display || 'inline-block';
    marker.style.marginLeft = frame.style.marginLeft;
    marker.style.marginRight = frame.style.marginRight;
    imageDropMarkerRef.current = marker;
    return marker;
  }

  function placeImageDropMarker(frame, clientX, clientY) {
    const editor = editorRef.current;
    if (!editor) return false;

    const range = getEditorDropRange(clientX, clientY);
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      return false;
    }

    const marker = ensureImageDropMarker(frame);
    if (marker.contains(range.commonAncestorContainer)) {
      return true;
    }
    const targetFrame = range.startContainer?.nodeType === Node.ELEMENT_NODE
      ? range.startContainer.closest?.(EDITOR_DRAGGABLE_OBJECT_SELECTOR)
      : range.startContainer?.parentElement?.closest?.(EDITOR_DRAGGABLE_OBJECT_SELECTOR);

    if (targetFrame && targetFrame !== frame) {
      const targetRect = targetFrame.getBoundingClientRect();
      if (clientY > targetRect.top + targetRect.height / 2) {
        targetFrame.parentNode?.insertBefore(marker, targetFrame.nextSibling);
      } else {
        targetFrame.parentNode?.insertBefore(marker, targetFrame);
      }
      return true;
    }

    range.insertNode(marker);
    return true;
  }

  function finishImageDrop(frame) {
    const marker = imageDropMarkerRef.current;
    if (!marker?.parentNode || !editorRef.current) return false;

    marker.replaceWith(frame);
    imageDropMarkerRef.current = null;

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(frame);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    selectEditorObject(frame);
    syncEditorContentAndFlushSave();
    return true;
  }

  function restoreImageFrameAfterCanceledDrag(dragState) {
    const { frame, originalParent, originalNextSibling } = dragState;
    if (frame.isConnected) return;

    if (originalParent?.isConnected) {
      originalParent.insertBefore(
        frame,
        originalNextSibling?.parentNode === originalParent ? originalNextSibling : null,
      );
      return;
    }

    const marker = imageDropMarkerRef.current;
    if (marker?.parentNode) {
      marker.parentNode.insertBefore(frame, marker);
      return;
    }

    editorRef.current?.appendChild(frame);
  }

  function stopCustomImageDrag(event) {
    const dragState = imageDragStateRef.current;
    if (!dragState) return;

    const { frame, hasMoved } = dragState;
    const lastEvent = imageDragLastEventRef.current;
    removeCustomImageDragListeners();
    frame.classList.remove('dragging');

    if (hasMoved && lastEvent) {
      placeImageDropMarker(frame, lastEvent.clientX, lastEvent.clientY);
    }

    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    const dropped = hasMoved ? finishImageDrop(frame) : false;

    if (!dropped) {
      restoreImageFrameAfterCanceledDrag(dragState);
    }

    imageDragStateRef.current = null;
    removeImageDragGhost();
    removeImageDropMarker();
    event?.preventDefault?.();
  }

  function handleCustomImageDragMove(event) {
    const dragState = imageDragStateRef.current;
    if (!dragState) return;

    event.preventDefault();
    imageDragLastEventRef.current = event;

    if (imageDragRafRef.current) return;
    imageDragRafRef.current = requestAnimationFrame(() => {
      imageDragRafRef.current = null;
      const latestEvent = imageDragLastEventRef.current;
      if (!latestEvent) return;

      const movedX = latestEvent.clientX - dragState.startX;
      const movedY = latestEvent.clientY - dragState.startY;
      if (!dragState.hasMoved && Math.hypot(movedX, movedY) < 6) {
        return;
      }

      dragState.hasMoved = true;
      dragState.frame.classList.add('dragging');
      if (!dragState.placeholderInserted) {
        const marker = ensureImageDropMarker(dragState.frame);
        dragState.frame.parentNode?.replaceChild(marker, dragState.frame);
        dragState.placeholderInserted = true;
      }
      updateImageDragGhost(latestEvent.clientX, latestEvent.clientY);
      placeImageDropMarker(dragState.frame, latestEvent.clientX, latestEvent.clientY);
    });
  }

  function beginCustomImageDrag(frame, startEvent) {
    startEvent.preventDefault();
    const frameRect = frame.getBoundingClientRect();
    const ghost = frame.cloneNode(true);
    ghost.classList.remove('active');
    ghost.classList.add('dragGhost');
    ghost.style.width = `${Math.round(frameRect.width)}px`;
    ghost.style.height = `${Math.round(frameRect.height)}px`;
    ghost.style.marginLeft = '0';
    ghost.style.marginRight = '0';
    document.body.appendChild(ghost);
    imageDragGhostRef.current = ghost;

    imageDragStateRef.current = {
      frame,
      startX: startEvent.clientX,
      startY: startEvent.clientY,
      hasMoved: false,
      placeholderInserted: false,
      originalParent: frame.parentNode,
      originalNextSibling: frame.nextSibling,
      pointerOffsetX: startEvent.clientX - frameRect.left,
      pointerOffsetY: startEvent.clientY - frameRect.top,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    updateImageDragGhost(startEvent.clientX, startEvent.clientY);
    document.addEventListener('mousemove', handleCustomImageDragMove, true);
    document.addEventListener('mouseup', stopCustomImageDrag, true);
    window.addEventListener('blur', stopCustomImageDrag);
    document.addEventListener('visibilitychange', stopCustomImageDrag);
  }

  const fontSizeProbeThrottleRef = useRef(0);

  function handleEditorMouseMove(event) {
    const now = performance.now();
    if (now - fontSizeProbeThrottleRef.current < 120) return;
    fontSizeProbeThrottleRef.current = now;

    const editor = editorRef.current;
    if (!editor) return;

    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || !editor.contains(el) || el.closest?.('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame')) {
      return;
    }

    const fontSize = window.getComputedStyle(el).fontSize;
    if (fontSize) {
      setActiveEditorFontSize((current) => (current === fontSize ? current : fontSize));
    }
  }

  function handleEditorMouseDown(event) {
    const handle = event.target.closest?.('.editorImageResizeHandle');
    if (handle && editorRef.current?.contains(handle)) {
      const frame = handle.closest('.editorImageFrame');
      if (!frame) return;

      event.preventDefault();
      selectEditorObject(frame);

      const startX = event.clientX;
      const startWidth = frame.getBoundingClientRect().width;
      const maxWidth = getMaxEditorImageWidth();
      let resizeRafId = null;
      let lastResizeEvent = null;
      frame.style.willChange = 'width';

      function resizeImage(moveEvent) {
        moveEvent.preventDefault();
        lastResizeEvent = moveEvent;
        if (resizeRafId) return;
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          if (lastResizeEvent) {
            const nextWidth = startWidth + lastResizeEvent.clientX - startX;
            frame.style.width = `${Math.round(Math.max(EDITOR_IMAGE_MIN_WIDTH, Math.min(maxWidth, nextWidth)))}px`;
          }
        });
      }

      function finishResize() {
        cancelAnimationFrame(resizeRafId);
        frame.style.willChange = '';
        window.removeEventListener('mousemove', resizeImage);
        window.removeEventListener('mouseup', finishResize);
        syncEditorContent();
      }

      window.addEventListener('mousemove', resizeImage);
      window.addEventListener('mouseup', finishResize);
      return;
    }

    const frame = event.target.closest?.(EDITOR_DRAGGABLE_OBJECT_SELECTOR);
    if (!frame || !editorRef.current?.contains(frame)) return;

    event.preventDefault();
    selectEditorObject(frame);
    beginCustomImageDrag(frame, event);
  }

  const URL_LINKIFY_REGEX = /https?:\/\/[^\s<>"'`，。；：！？、（）：""''【】《》…]+$/i;

  function autoLinkifyAtCursor() {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;
    if (!editor.contains(range.commonAncestorContainer)) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (node.parentElement?.closest('a')) return;

    const text = node.textContent;
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(URL_LINKIFY_REGEX);
    if (!match) return;

    const url = match[0];
    const urlStart = match.index;

    // Build replacement fragments
    const parent = node.parentNode;
    const fragment = document.createDocumentFragment();
    if (urlStart > 0) fragment.appendChild(document.createTextNode(text.slice(0, urlStart)));

    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'autoLink';
    fragment.appendChild(link);

    if (cursorPos < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursorPos)));
    }

    parent.replaceChild(fragment, node);

    // Place cursor after the link
    const newRange = document.createRange();
    newRange.setStartAfter(link);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    editorSelectionRef.current = newRange.cloneRange();
    syncEditorContent();
  }

  function linkifyAllEditorContent() {
    const editor = editorRef.current;
    if (!editor) return;

    const URL_REGEX = /https?:\/\/[^\s<>"'`，。；：！？、（）：""''【】《》…]+/gi;

    // Save cursor
    const selection = window.getSelection();
    let cursorKey = null;
    if (selection?.rangeCount) {
      const r = selection.getRangeAt(0);
      if (editor.contains(r.commonAncestorContainer)) {
        cursorKey = { node: r.startContainer, offset: r.startOffset };
      }
    }

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (node.parentElement?.closest('a')) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame, .mergedWorkflowMeta')) return NodeFilter.FILTER_REJECT;
        if (!URL_REGEX.test(node.textContent)) return NodeFilter.FILTER_REJECT;
        URL_REGEX.lastIndex = 0;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodesToProcess = [];
    while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

    for (const textNode of nodesToProcess) {
      URL_REGEX.lastIndex = 0;
      const text = textNode.textContent;
      const parent = textNode.parentNode;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = URL_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const link = document.createElement('a');
        link.href = match[0];
        link.textContent = match[0];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'autoLink';
        fragment.appendChild(link);
        lastIndex = URL_REGEX.lastIndex;
      }
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      if (fragment.childNodes.length > 0) {
        parent.replaceChild(fragment, textNode);
      }
    }

    // Restore cursor (best-effort)
    if (cursorKey) {
      try {
        const newRange = document.createRange();
        const targetNode = cursorKey.node.parentNode?.isConnected ? cursorKey.node : editor;
        const offset = Math.min(cursorKey.offset, targetNode.textContent?.length ?? 0);
        newRange.setStart(targetNode, offset);
        newRange.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
        editorSelectionRef.current = newRange.cloneRange();
      } catch { /* ignore */ }
    }

    syncEditorContent();
  }

  async function handleEditorPaste(event) {
    event.preventDefault();

    // Check for image in clipboard first
    const items = event.clipboardData?.items;
    const files = event.clipboardData?.files;
    const imageBlobs = [];
    const videoFiles = [];

    // Collect image/video blobs from clipboard items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/') || item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob && blob.type.startsWith('image/')) {
            imageBlobs.push(blob);
          } else if (blob && isVideoFile(blob)) {
            videoFiles.push(blob);
          }
        }
      }
    }

    // Also check clipboard files (Safari may expose media only here)
    if (files && imageBlobs.length === 0 && videoFiles.length === 0) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          imageBlobs.push(file);
        } else if (isVideoFile(file)) {
          videoFiles.push(file);
        }
      }
    }

    if (imageBlobs.length > 0) {
      for (const blob of imageBlobs) {
        try {
          const imageDataUrl = await readImageAsResizedDataUrl(blob);
          const imageUrl = imageDataUrl
            ? await saveDataUrlAsset({
                dataUrl: imageDataUrl,
                name: blob.name || 'pasted-image.png',
                type: 'image/jpeg',
                size: imageDataUrl.length,
                kind: 'image',
              })
            : '';
          if (imageUrl) {
            insertEditorImage(imageUrl, { sync: false });
          }
        } catch (error) {
          console.warn('Failed to paste image', error);
        }
      }
      syncEditorContentAndFlushSave();
      return;
    }

    if (videoFiles.length > 0) {
      const MAX_TOTAL_PASTED_VIDEO_SIZE = 300 * 1024 * 1024;
      const totalSize = videoFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > MAX_TOTAL_PASTED_VIDEO_SIZE) {
        window.alert(`视频总大小（${formatFileSize(totalSize)}）超过上限 ${formatFileSize(MAX_TOTAL_PASTED_VIDEO_SIZE)}，请分批粘贴`);
        return;
      }

      for (const file of videoFiles) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const videoUrl = dataUrl
            ? await saveDataUrlAsset({
                dataUrl,
                name: file.name || 'pasted-video.mp4',
                type: file.type || 'video/mp4',
                size: file.size,
                kind: 'video',
              })
            : '';
          if (videoUrl) {
            insertEditorVideo(
              {
                name: file.name || 'pasted-video.mp4',
                type: file.type || 'video/mp4',
                size: file.size,
              },
              videoUrl,
              { sync: false },
            );
          }
        } catch (error) {
          console.warn('Failed to paste video', error);
        }
      }
      syncEditorContentAndFlushSave();
      return;
    }

    const clipboardHtml = event.clipboardData?.getData('text/html') || '';
    if (clipboardHtml && isInternalEditorClipboardHtml(clipboardHtml)) {
      if (insertEditorHtmlAtSelection(clipboardHtml)) {
        return;
      }
    }

    // Fallback: paste as text
    const clipboardText = event.clipboardData?.getData('text/plain');
    if (!clipboardText || !editorRef.current) return;

    const range = ensureEditorInsertionRange();
    if (!range) return;

    // Delete any currently selected content
    range.deleteContents();

    // Insert pasted text
    const textNode = document.createTextNode(clipboardText);
    range.insertNode(textNode);

    // Move cursor AFTER the inserted text
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(newRange);
    editorSelectionRef.current = newRange.cloneRange();

    syncEditorContent();
    // Auto-linkify URLs in the pasted content
    setTimeout(() => linkifyAllEditorContent(), 0);
  }

  function handleEditorDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  async function handleEditorDrop(event) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0 || !editorRef.current) return;

    const imageFiles = [];
    const videoFiles = [];
    const otherFiles = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else if (isVideoFile(file)) {
        videoFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    // Process images
    for (const file of imageFiles) {
      try {
        const imageDataUrl = await readImageAsResizedDataUrl(file);
        const imageUrl = imageDataUrl
          ? await saveDataUrlAsset({
              dataUrl: imageDataUrl,
              name: file.name,
              type: 'image/jpeg',
              size: imageDataUrl.length,
              kind: 'image',
            })
          : '';
        if (imageUrl) insertEditorImage(imageUrl, { sync: false });
      } catch (error) {
        console.error('Failed to drop image', file.name, error);
      }
    }

    for (const file of videoFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const videoUrl = dataUrl
          ? await saveDataUrlAsset({
              dataUrl,
              name: file.name,
              type: file.type || 'video/mp4',
              size: file.size,
              kind: 'video',
            })
          : '';
        if (videoUrl) insertEditorVideo(file, videoUrl, { sync: false });
      } catch (error) {
        console.error('Failed to drop video', file.name, error);
      }
    }

    // Process attachments (Excel, Word, PDF, etc.)
    for (const file of otherFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const url = dataUrl
          ? await saveDataUrlAsset({
              dataUrl,
              name: file.name,
              type: file.type,
              size: file.size,
              kind: getAttachmentKind(file.name, file.type),
            })
          : '';
        if (url) insertEditorAttachment(file, url);
      } catch (error) {
        console.error('Failed to drop attachment', file.name, error);
      }
    }

    syncEditorContentAndFlushSave();
  }

  function handleEditorKeyDown(event) {
    const isEditorCopy = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c';
    if (isEditorCopy) {
      saveEditorSelection();
      if (getSavedEditorSelectionRange()) {
        event.preventDefault();
        copyEditorSelection({ silent: true });
      }
      return;
    }

    const isEditorUndo = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z';
    const isEditorRedo = (event.ctrlKey || event.metaKey) && !event.altKey
      && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    if (isEditorUndo || isEditorRedo) {
      event.preventDefault();
      if (isEditorRedo) {
        redoEditorChange();
      } else {
        undoEditorChange();
      }
      return;
    }

    // Escape cancels format painter
    if (event.key === 'Escape' && formatPainterRef.current) {
      formatPainterRef.current = null;
      document.body.style.removeProperty('cursor');
      return;
    }

    // Auto-linkify after the browser inserts the character/new line.
    if (event.key === ' ' || event.key === 'Enter') {
      setTimeout(() => {
        autoLinkifyAtCursor();
      }, 0);
      if (event.key === 'Enter') {
        // Force a full save cycle on Enter (same path as insertEditorTimestamp)
        // to ensure multi-line content is always persisted.
        setTimeout(() => {
          syncEditorContentAndFlushSave();
        }, 0);
      }
    }

    // Prevent deletion of the automatic first timestamp block.
    if ((event.key === 'Backspace' || event.key === 'Delete') && editorRef.current) {
      const undeletableTs = editorRef.current.querySelector('[data-undeletable="true"]');
      if (undeletableTs && editorRef.current.contains(undeletableTs)) {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          const range = sel.getRangeAt(0);
          if (range.collapsed) {
            const container = range.commonAncestorContainer;
            // Backspace at start of the element right after the timestamp
            if (event.key === 'Backspace') {
              const next = undeletableTs.nextSibling;
              if (next && (container === next || container.parentNode === next) && range.startOffset === 0) {
                event.preventDefault();
                return;
              }
            }
            // Delete at end of the element right before the timestamp
            if (event.key === 'Delete') {
              const prev = undeletableTs.previousSibling;
              if (prev && (container === prev || container.parentNode === prev) && range.startOffset === (container.textContent?.length ?? 0)) {
                event.preventDefault();
                return;
              }
            }
          } else {
            // Non-collapsed selection that includes the timestamp
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(range.cloneContents());
            if (tempDiv.querySelector('[data-undeletable="true"]')) {
              event.preventDefault();
              return;
            }
          }
        }
      }
    }

    if (event.key !== 'Delete' && event.key !== 'Backspace') return;

    const activeObject = editorRef.current?.querySelector('.editorImageFrame.active, .editorVideoFrame.active, .editorAttachmentFrame.active');
    if (!activeObject) return;

    event.preventDefault();
    activeObject.remove();
    syncEditorContent();
    cleanupUnusedAssets(customersRef.current);
    editorRef.current?.focus();
  }

  function deleteWorkflow(workflowId) {
    if (!selectedCustomer) return;
    const timeline = selectedCustomer.timeline ?? [];
    const target = timeline.find((item) => item.id === workflowId);
    setPendingDelete({
      type: 'workflow',
      id: workflowId,
      title: '删除工作流',
      message: `确定删除「${target?.title ?? '沟通记录'}」这个工作流吗？对应文档内容也会一起删除。`,
    });
  }

  function performDeleteWorkflow(workflowId) {
    if (!selectedCustomer) return;
    const currentCustomers = saveCurrentEditorContent();
    const currentCustomer = currentCustomers.find((customer) => customer.id === selectedCustomer.id) ?? selectedCustomer;
    const timeline = currentCustomer.timeline ?? [];
    const nextTimeline = timeline.filter((item) => item.id !== workflowId);
    const nextSelectedWorkflow = nextTimeline[0]?.id ?? '';
    // Only update timeline and lastFollowDate — never overwrite messyNotes
    // when deleting a workflow, as they are separate data fields.
    updateCustomer(selectedCustomer.id, {
      timeline: nextTimeline,
      lastFollowDate: nextTimeline[0]?.date ?? currentCustomer.lastFollowDate,
    });
    cleanupUnusedAssets(customersRef.current);
    setSelectedWorkflowId(nextSelectedWorkflow);
    setSelectedWorkflowIds((current) => current.filter((item) => item !== workflowId));
    if (editingWorkflowTitleId === workflowId) {
      setEditingWorkflowTitleId('');
    }
  }

  function performDeleteWorkflows(workflowIds) {
    if (!selectedCustomer) return;
    const idSet = new Set(workflowIds);
    const currentCustomers = saveCurrentEditorContent();
    const currentCustomer = currentCustomers.find((customer) => customer.id === selectedCustomer.id) ?? selectedCustomer;
    const timeline = currentCustomer.timeline ?? [];
    const nextTimeline = timeline.filter((item) => !idSet.has(item.id));
    const nextSelectedWorkflow = nextTimeline[0]?.id ?? '';
    updateCustomer(selectedCustomer.id, {
      timeline: nextTimeline,
      lastFollowDate: nextTimeline[0]?.date ?? currentCustomer.lastFollowDate,
    });
    cleanupUnusedAssets(customersRef.current);
    setSelectedWorkflowId(nextSelectedWorkflow);
    setSelectedWorkflowIds([]);
    if (editingWorkflowTitleId && idSet.has(editingWorkflowTitleId)) {
      setEditingWorkflowTitleId('');
    }
  }

  function confirmPendingDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === 'customer') {
      performDeleteCustomer(pendingDelete.id);
    }
    if (pendingDelete.type === 'batch') {
      performBatchDelete(pendingDelete.ids);
    }
    if (pendingDelete.type === 'workflows') {
      performDeleteWorkflows(pendingDelete.ids);
    }
    if (pendingDelete.type === 'workflow') {
      performDeleteWorkflow(pendingDelete.id);
    }
    setPendingDelete(null);
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">
            <Database size={24} />
          </div>
          <div>
            <h1>James CHEN</h1>
          </div>
        </div>
        <div className="topActions">
          <button type="button" className="topTextButton" title="导出工作流内容" onClick={() => setExportDialogOpen(true)}>
            <Download size={19} />
            <span>导出</span>
          </button>
          <button
            type="button"
            className="topTextButton"
            title="备份数据"
            onClick={() => exportBackupData().catch((error) => window.alert(error instanceof Error ? error.message : '导出失败，请重试'))}
          >
            <Download size={19} />
            <span>备份数据</span>
          </button>
          <button type="button" className="topTextButton" title="导入数据" onClick={() => backupInputRef.current?.click()}>
            <Upload size={19} />
            <span>导入数据</span>
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importBackupData}
          />
          <button type="button" className="topIconButton" title="设置">
            <Settings size={19} />
          </button>
        </div>
      </header>

      <section
        ref={boardRef}
        style={boardStyle}
        className={`board ${leftCollapsed ? 'leftCollapsed' : ''} ${rightCollapsed ? 'rightCollapsed' : ''} ${activeResizer ? 'isResizing' : ''}`}
      >
        <aside className={`panel sourcePanel ${leftCollapsed ? 'collapsedPanel' : ''}`}>
          <PanelTitle
            title="用户列表"
            icon={<UserRound size={18} />}
            meta={`${stats.total} 位用户`}
            collapsed={leftCollapsed}
            onToggle={toggleLeftCollapsed}
            toggleTitle={leftCollapsed ? '展开用户列表' : '收起用户列表'}
            toggleIcon={leftCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          />
          {leftCollapsed ? (
            <CollapsedCustomerRail
              customers={collapsedVisibleCustomers}
              selectedId={selectedCustomer?.id}
              onSelect={selectCustomer}
            />
          ) : (
            <>
          <div className="searchBox">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、联系人、国家或邮箱" />
          </div>
          <div className="gradeTabs">
            {['全部', ...CUSTOMER_GRADES].map((grade) => (
              <button key={grade} className={gradeFilter === grade ? 'active' : ''} onClick={() => setGradeFilter(grade)}>
                {grade}
              </button>
            ))}
            <button
              className={`batchToggleButton ${batchMode ? 'active' : ''}`}
              onClick={batchMode ? exitBatchMode : enterBatchMode}
              title={batchMode ? '退出批量模式' : '批量管理用户'}
            >
              {batchMode ? '取消' : '批量'}
            </button>
          </div>
          {batchMode && (
            <div className="batchToolbar">
              <button
                className="batchSelectAllButton"
                onClick={() => {
                  const visibleIds = visibleCustomers.map((c) => c.id);
                  const allSelected = visibleIds.every((id) => batchSelectedIds.has(id));
                  if (allSelected) {
                    setBatchSelectedIds(new Set());
                  } else {
                    setBatchSelectedIds(new Set(visibleIds));
                  }
                }}
              >
                {visibleCustomers.every((c) => batchSelectedIds.has(c.id)) ? '取消全选' : '全选'}
              </button>
              <span>已选 {batchSelectedIds.size} 位用户</span>
              <button
                className="batchDeleteButton"
                disabled={batchSelectedIds.size === 0}
                onClick={requestBatchDelete}
              >
                <Trash2 size={14} />
                批量删除
              </button>
            </div>
          )}
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCustomerDragEnd}
          >
            <SortableContext items={visibleCustomers.map((customer) => customer.id)} strategy={verticalListSortingStrategy}>
              <div className="customerList">
                {visibleCustomers.map((customer) => (
                  <SortableCustomerRow
                    key={customer.id}
                    customer={customer}
                    isSelected={selectedCustomer?.id === customer.id}
                    onSelect={selectCustomer}
                    onDelete={requestDeleteCustomer}
                    batchMode={batchMode}
                    isBatchSelected={batchSelectedIds.has(customer.id)}
                    onToggleBatchSelect={toggleBatchSelectCustomer}
                    onTogglePin={togglePinCustomer}
                  />
                ))}
                {hasMoreCustomers && (
                  <button
                    type="button"
                    className="loadMoreCustomersButton"
                    onClick={() => setCustomerRenderLimit((limit) => limit + CUSTOMER_RENDER_INCREMENT)}
                  >
                    加载更多（{filteredCustomers.length - visibleCustomers.length}）
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
          <div className="listFooter">
            <span>共 {filteredCustomers.length} 条</span>
            <div className="pager">
              <button><ChevronLeft size={16} /></button>
              <button className="pageActive">1</button>
              <button><ChevronRight size={16} /></button>
            </div>
          </div>
            </>
          )}
        </aside>

        <div
          className={`panelResizer ${leftCollapsed ? 'disabled' : ''}`}
          onPointerDown={() => startResize('left')}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整用户列表宽度"
        />

        <section className="panel conversationPanel">
          <PanelTitle
            title={selectedCustomerTitle}
            icon={<MessageSquareText size={18} />}
            editable
            onTitleChange={(newTitle) => {
              if (selectedCustomer) {
                updateCustomer(selectedCustomer.id, { displayTitle: newTitle });
              }
            }}
            action={(
              <div className="panelHeaderActions">
                <button
                  type="button"
                  className="panelGhostButton"
                  onClick={toggleEditorExpanded}
                  title={editorExpanded ? '恢复两侧栏' : '展开编辑区'}
                  aria-label={editorExpanded ? '恢复两侧栏' : '展开编辑区'}
                >
                  {editorExpanded ? <Shrink size={16} /> : <Expand size={16} />}
                </button>
              </div>
            )}
          />
          {selectedCustomer ? (
            <div className="conversationBody">
              <div className="editorShell">
                <div className="editorToolbar">
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={undoEditorChange} title="撤销">
                    <Undo2 size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={redoEditorChange} title="重做">
                    <Redo2 size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={copyEditorSelection} title="复制选中内容">
                    <Copy size={16} />
                  </button>
                  <span />
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('bold')} title="加粗">
                    <Bold size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={toggleEditorItalic} title="斜体">
                    <Italic size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('underline')} title="下划线">
                    <Underline size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={clearEditorFormatting} title="清空格式">
                    <Eraser size={16} />
                  </button>
                  <button
                    type="button"
                    className={`toolbarIconButton ${formatPainterRef.current ? 'active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleFormatPainter}
                    title={formatPainterRef.current ? '格式刷已激活（点击或按 Esc 取消）' : '格式刷：复制选中文字格式，再选中其他文字即可应用'}
                  >
                    <Paintbrush size={16} />
                  </button>
                  <span />
                  <EditorSizePicker
                    sizes={EDITOR_FONT_SIZES}
                    currentSize={activeEditorFontSize}
                    onPick={(fontSize) => {
                      setActiveEditorFontSize(fontSize);
                      applyEditorStyle({ fontSize });
                    }}
                  />
                  <EditorFontPicker
                    fonts={EDITOR_FONTS}
                    currentFont={activeEditorFontFamily}
                    onPick={(fontFamily) => {
                      setActiveEditorFontFamily(fontFamily);
                      applyEditorStyle({ fontFamily });
                    }}
                  />
                  <EditorColorPicker
                    label="文字颜色"
                    trigger={<Type size={15} strokeWidth={2.2} />}
                    colors={EDITOR_TEXT_COLORS}
                    currentColor={activeEditorTextColor}
                    swatchClassName="textSwatch"
                    onPick={applyEditorTextColor}
                  />
                  <EditorColorPicker
                    label="背景色"
                    trigger={<Highlighter size={15} strokeWidth={2.2} />}
                    colors={EDITOR_BACKGROUND_COLORS}
                    currentColor={activeEditorBackgroundColor}
                    swatchClassName="backgroundSwatch"
                    onPick={applyEditorBackgroundColor}
                  />
                  <span />
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('insertUnorderedList')} title="圆点列表">
                    <List size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('insertOrderedList')} title="数字列表">
                    <ListOrdered size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={addEditorLink} title="插入链接">
                    <Link size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={insertEditorTimestamp} title="插入时间戳">
                    <Clock3 size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={addEditorImage} title="插入图片">
                    <Image size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={addEditorVideo} title="上传视频">
                    <Video size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={addEditorAttachment} title="上传附件">
                    <FileText size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => alignEditorImage('left')} title="图片左对齐">
                    <AlignLeft size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => alignEditorImage('center')} title="图片居中对齐">
                    <AlignCenter size={16} />
                  </button>
                  <button type="button" className="toolbarIconButton" onMouseDown={(event) => event.preventDefault()} onClick={() => alignEditorImage('right')} title="图片右对齐">
                    <AlignRight size={16} />
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleEditorImageSelected}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept={EDITOR_VIDEO_ACCEPT}
                    multiple
                    hidden
                    onChange={handleEditorVideoSelected}
                  />
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept={EDITOR_ATTACHMENT_ACCEPT}
                    multiple
                    hidden
                    onChange={handleEditorAttachmentSelected}
                  />
                </div>
                {isMergedWorkflowView && (
                  <style>{`.mergedViewContent [data-undeletable="true"] { display: none !important; }`}</style>
                )}
                <div
                  key={editorKey}
                  ref={editorRef}
                  className={`messyContent ${isMergedWorkflowView ? 'mergedViewContent' : ''}`}
                  contentEditable={!isMergedWorkflowView && canEditEditor}
                  suppressContentEditableWarning
                  onBlur={flushEditorContentSync}
                  onPaste={handleEditorPaste}
                  onDragOver={handleEditorDragOver}
                  onDrop={handleEditorDrop}
                  onMouseDown={handleEditorMouseDown}
                  onMouseUp={saveEditorSelection}
                  onMouseMove={handleEditorMouseMove}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={saveEditorSelection}
                  onFocus={saveEditorSelection}
                  onContextMenu={handleEditorContextMenu}
                  onClick={handleEditorClick}
                  onDoubleClick={handleEditorDoubleClick}
                  data-placeholder={isMergedWorkflowView
                    ? '请选择至少一个工作流进行合并查看。'
                    : selectedWorkflow
                      ? '编辑当前工作流对应的文档内容。'
                      : '请先添加或选择一个工作流。'}
                />
                <div className="wordCount">字数 · {editorWordCount}</div>
              </div>

              <div className="composer">
                <MessageSquareText size={18} />
                <input
                  className="composerTitle"
                  value={noteTitleDraft}
                  onChange={(event) => {
                    setNoteTitleDraft(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addMessyNote();
                  }}
                  placeholder="输入标题或用户名称，选中内容后右键分发到多个客户"
                />
                <div className="composerActions">
                  <button type="button" className="composerIconButton" onClick={addMessyNote}>
                    <Send size={19} />
                  </button>
                  <button type="button" className="composerAddButton" onClick={addCustomer}>
                    <Plus size={16} />
                    添加用户
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="emptyStateWithAction">
              <div className="emptyStateIcon">
                <UserRound size={48} />
              </div>
              <p className="emptyStateTitle">暂无用户</p>
              <p className="emptyStateHint">点击下方按钮创建第一位用户</p>
              <button type="button" className="emptyStateAddButton" onClick={addCustomer}>
                <Plus size={18} />
                添加用户
              </button>
            </div>
          )}
        </section>

        <div
          className={`panelResizer ${rightCollapsed ? 'disabled' : ''}`}
          onPointerDown={() => startResize('right')}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整用户档案宽度"
        />

        <aside className={`panel studioPanel ${rightCollapsed ? 'collapsedPanel' : ''}`}>
          <PanelTitle
            title="用户档案"
            icon={<FileText size={18} />}
            action={selectedCustomer && (
              <div className="archiveTitleActions">
                {archiveEditing && (
                  <>
                    <button className="archiveCancelButton" onClick={cancelArchiveEditing}>
                      取消
                    </button>
                    <button className="archiveGlobalSaveButton" onClick={saveArchiveAsGlobalFields}>
                      全局保存
                    </button>
                  </>
                )}
                <button className={`archiveEditButton ${archiveEditing ? 'savingMode' : ''}`} onClick={toggleArchiveEditing}>
                  {archiveEditing ? '当前保存' : '编辑档案'}
                </button>
              </div>
            )}
            collapsed={rightCollapsed}
            onToggle={toggleRightCollapsed}
            toggleTitle={rightCollapsed ? '展开用户档案' : '收起用户档案'}
            toggleIcon={rightCollapsed ? <ChevronsLeft size={17} /> : <ChevronsRight size={17} />}
          />
          {rightCollapsed ? (
            <CollapsedWorkflowRail
              workflows={selectedCustomer?.timeline ?? []}
              selectedWorkflowId={selectedWorkflow?.id}
              onSelect={selectSingleWorkflow}
              onMergeView={toggleMergeView}
              isMerged={isMergedWorkflowView}
            />
          ) : selectedCustomer ? (
            <div className="archiveScroll">
              <div className="archiveCard">
                <div className="archiveHero">
                  <BrandLogo company={archiveCustomer.company} large />
                  <div className="archiveIdentity">
                    <div className="archiveNameLine">
                      <input
                        style={{
                          width: `${Math.max(
                            ((archiveCustomer.company || '未命名公司').trim().length || 2) * 1.15 + 0.35,
                            2.7,
                          )}em`,
                        }}
                        value={archiveCustomer.company ?? ''}
                        onChange={(event) => updateArchiveDraft('company', event.target.value)}
                        disabled={!archiveEditing}
                        placeholder="未命名公司"
                      />
                    </div>
                    <span>{gradeMap[archiveCustomer.grade] ? `${gradeMap[archiveCustomer.grade]} · ` : ''}{archiveCustomer.country || '未填写国家'}</span>
                  </div>
                </div>

                <div className="archiveInfoGrid">
                  {archiveFields.map(([key, label]) => (
                    <ArchiveField
                      key={key}
                      label={getArchiveFieldLabel(archiveCustomer, globalFieldLabels, key, label)}
                      defaultLabel={label}
                      fieldKey={key}
                      archiveCustomer={archiveCustomer}
                      editing={archiveEditing}
                      editingLabel={archiveDraft?.fieldLabels?.[key] ?? getArchiveFieldLabel(selectedCustomer, globalFieldLabels, key, label)}
                      updateArchiveDraft={updateArchiveDraft}
                      updateArchiveFieldLabel={updateArchiveFieldLabel}
                    />
                  ))}
                </div>

                <div className="archiveWorkflowBlock">
                  <div className="archiveWorkflowHeader">
                    <div className="archiveWorkflowHeading">
                      <h3>最近工作流</h3>
                    </div>
                    <div className="archiveWorkflowActions">
                      <button
                        type="button"
                        className="workflowViewToggle"
                        onClick={toggleMergeView}
                        title={workflowViewMode === 'single' ? '当前：单独查看，点击切换合并' : '当前：合并查看，点击切换单独'}
                      >
                        {workflowViewMode === 'single' ? '单独查看' : '合并查看'}
                      </button>
                      <button
                        type="button"
                        className="workflowSortToggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkflowSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                        }}
                        title={workflowSortOrder === 'desc' ? '当前：最新在前，点击切换' : '当前：最早在前，点击切换'}
                      >
                        {workflowSortOrder === 'desc' ? '正序' : '反序'}
                      </button>
                      <button
                        type="button"
                        className="archiveDeleteWorkflowButton"
                        onClick={() => {
                          if (isMergedWorkflowView && mergedWorkflows.length > 0) {
                            const ids = mergedWorkflows.map((w) => w.id);
                            const titles = mergedWorkflows.map((w) => w.title ?? '沟通记录').join('、');
                            setPendingDelete({
                              type: 'workflows',
                              ids,
                              title: '批量删除工作流',
                              message: `确定删除选中的 ${ids.length} 个工作流（${titles}）吗？对应文档内容也会一起删除。`,
                            });
                          } else if (selectedWorkflow) {
                            deleteWorkflow(selectedWorkflow.id);
                          }
                        }}
                        disabled={isMergedWorkflowView ? mergedWorkflows.length === 0 : !selectedWorkflow}
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  </div>

                  <div className={`archiveTimeline ${sortedTimeline.length === 0 ? 'emptyTimeline' : ''}`}>
                  {sortedTimeline.map((item) => {
                    const editingTitle = editingWorkflowTitleId === item.id;
                    const isSelected = isMergedWorkflowView
                      ? selectedWorkflowIds.includes(item.id)
                      : selectedWorkflow?.id === item.id;

                    return (
                      <div
                        className={`archiveTimelineRow ${isSelected ? 'selectedWorkflow' : ''}`}
                        key={item.id}
                        onClick={() => {
                          if (isMergedWorkflowView) {
                            toggleMergedWorkflow(item.id);
                            return;
                          }
                          selectSingleWorkflow(item.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Delete' || event.key === 'Backspace') {
                            event.preventDefault();
                            deleteWorkflow(item.id);
                            return;
                          }
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            if (isMergedWorkflowView) {
                              toggleMergedWorkflow(item.id);
                              return;
                            }
                            selectSingleWorkflow(item.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="archiveTimelineDate">{item.date}</div>
                        <div className="timelineRail">
                          <span className={`statusDot status${item.status}`} />
                        </div>
                        <div className="archiveTimelineContent">
                          <input
                            className={`workflowContentInput ${editingTitle ? 'editingTitle' : ''}`}
                            value={item.title ?? '沟通记录'}
                            readOnly={!editingTitle}
                            title={editingTitle ? '编辑标题，按回车完成' : '双击修改标题'}
                            onFocus={() => focusWorkflow(item.id)}
                            onClick={(event) => {
                              if (isMergedWorkflowView) {
                                event.stopPropagation();
                                toggleMergedWorkflow(item.id);
                                return;
                              }
                              event.stopPropagation();
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              focusWorkflow(item.id);
                              setEditingWorkflowTitleId(item.id);
                              requestAnimationFrame(() => {
                                event.currentTarget.focus();
                                event.currentTarget.select();
                              });
                            }}
                            onBlur={() => setEditingWorkflowTitleId('')}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === 'Enter') {
                                event.currentTarget.blur();
                              }
                              if (event.key === 'Escape') {
                                setEditingWorkflowTitleId('');
                                event.currentTarget.blur();
                              }
                            }}
                            onChange={(event) => {
                              if (!editingTitle) return;
                              updateWorkflow(item.id, { title: event.target.value });
                            }}
                          />
                        </div>
                        <label className="workflowPick" onClick={(event) => event.stopPropagation()}>
                          <input
                            type={isMergedWorkflowView ? 'checkbox' : 'radio'}
                            name={isMergedWorkflowView ? undefined : 'selectedWorkflow'}
                            checked={isSelected}
                            onChange={() => {
                              if (isMergedWorkflowView) {
                                toggleMergedWorkflow(item.id);
                                return;
                              }
                              selectSingleWorkflow(item.id);
                            }}
                            aria-label={`${isMergedWorkflowView ? '合并选择' : '选择'} ${item.title ?? item.content ?? '工作流'}`}
                          />
                          <span />
                        </label>
                        <div className="workflowControls">
                          <select
                            value={item.status}
                            className={`statusSelect status${item.status}`}
                            onFocus={() => focusWorkflow(item.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => updateWorkflow(item.id, { status: event.target.value })}
                          >
                            {['跟进中', '待确认', '已完成', '暂停'].map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {(selectedCustomer.timeline ?? []).length === 0 && (
                    <div className="workflowEmpty">暂无跟进记录</div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState text="请选择一个用户查看档案。" />
          )}
        </aside>
      </section>
      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.title}
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmPendingDelete}
        />
      )}
      {exportDialogOpen && (
        <div className="confirmOverlay" role="presentation" onMouseDown={() => setExportDialogOpen(false)}>
          <div className="confirmDialog exportDialog" role="dialog" aria-modal="true" aria-labelledby="exportDialogTitle" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirmIcon exportDialogIcon">
              <Download size={20} />
            </div>
            <div className="confirmContent">
              <h3 id="exportDialogTitle">{isMergedWorkflowView ? '导出合并内容' : '导出工作流内容'}</h3>
              <p>请选择导出格式</p>
            </div>
            <div className="confirmActions exportDialogActions">
              <button className="confirmCancel" onClick={handleExportPDF}>
                <FileText size={15} />
                导出 PDF
              </button>
              <button className="confirmCancel" onClick={handleExportWord}>
                <FileText size={15} />
                导出 Word
              </button>
              <button className="confirmDanger" onClick={() => setExportDialogOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {pendingImport && (
        <ImportBackupDialog
          stats={pendingImport.stats}
          onCancel={() => setPendingImport(null)}
          onOverwrite={() => applyImportedBackup(pendingImport.payload, 'overwrite', pendingImport.importedCustomers)
            .catch((error) => window.alert(error instanceof Error ? error.message : '导入失败，请检查备份文件'))}
          onAppend={() => applyImportedBackup(pendingImport.payload, 'append', pendingImport.importedCustomers)
            .catch((error) => window.alert(error instanceof Error ? error.message : '导入失败，请检查备份文件'))}
        />
      )}
      {attachmentPreview && (
        <AttachmentPreviewDialog
          preview={attachmentPreview}
          onClose={() => {
            if (attachmentPreview.previewUrl) {
              URL.revokeObjectURL(attachmentPreview.previewUrl);
            }
            setAttachmentPreview(null);
          }}
        />
      )}
      {mentionOpen && (
        <div className="confirmOverlay" role="presentation" onMouseDown={() => setMentionOpen(false)}>
          <div className="mentionDialog" role="dialog" aria-modal="true" aria-labelledby="mentionDialogTitle" onMouseDown={(event) => event.stopPropagation()}>
              <div className="mentionHeader">
                <h3 id="mentionDialogTitle">分发到多个客户</h3>
                {mentionSourceHtml ? (
                  <div className="mentionSourcePreview">
                    <span className="mentionSourceLabel">选中内容预览</span>
                    <div className="mentionSourceContent" dangerouslySetInnerHTML={{ __html: mentionSourceHtml }} />
                  </div>
                ) : (
                  <span className="mentionSourceHint mentionNoSelection">未选中任何文本，将仅创建空工作流</span>
                )}
              </div>
              <div className="mentionSearch">
                <Search size={16} />
                <input
                  value={mentionQuery}
                  onChange={(event) => setMentionQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && mentionQuery.trim() && filteredMentionCustomers.length === 0) {
                      createMentionCustomer(mentionQuery.trim());
                    }
                  }}
                  placeholder="搜索客户..."
                  autoFocus
                />
              </div>
              <div className="mentionCustomerList">
                {filteredMentionCustomers.length === 0 ? (
                  mentionQuery.trim() ? (
                    <div className="mentionEmpty">
                      没有匹配的客户
                      <button
                        className="mentionCreateButton"
                        onClick={() => createMentionCustomer(mentionQuery.trim())}
                      >
                        <Plus size={14} />
                        创建「{mentionQuery.trim()}」
                      </button>
                    </div>
                  ) : (
                    <div className="mentionEmpty">没有客户数据</div>
                  )
                ) : (
                  filteredMentionCustomers.map((customer) => {
                    const isChecked = mentionSelectedIds.includes(customer.id);
                    const targetWorkflowId = mentionTargets[customer.id] || '';
                    const targetWorkflow = targetWorkflowId
                      ? (customer.timeline ?? []).find((w) => w.id === targetWorkflowId)
                      : null;
                    const toggleCheck = () => {
                      setMentionSelectedIds((current) =>
                        current.includes(customer.id)
                          ? current.filter((id) => id !== customer.id)
                          : [...current, customer.id]
                      );
                    };
                    return (
                      <div key={customer.id} id={`mention-${customer.id}`} className={`mentionCustomerRow ${isChecked ? 'checked' : ''} ${customer.id === selectedCustomer?.id ? 'isSelf' : ''}`}>
                        <div className="mentionCustomerMain" onClick={toggleCheck}>
                          <input type="checkbox" checked={isChecked} readOnly />
                          <BrandLogo company={customer.company} />
                          <div className="mentionCustomerInfo">
                            <strong>{customer.company || '未命名客户'}</strong>
                            <span>{[customer.contact, customer.country].filter(Boolean).join(' · ') || '无详细信息'}</span>
                          </div>
                          <GradeBadge grade={customer.grade} />
                          {customer.id === selectedCustomer?.id && <span className="selfBadge">我</span>}
                        </div>
                        {isChecked && (
                          <button
                            type="button"
                            className="mentionWorkflowTargetBtn"
                            onClick={(e) => { e.stopPropagation(); setMentionFocusedCustomerId(customer.id); }}
                          >
                            <CornerDownRight size={13} />
                            <span>
                              {targetWorkflow
                                ? `${targetWorkflow.title || '未命名'}${targetWorkflow.date ? ` · ${targetWorkflow.date}` : ''}`
                                : '新建工作流'}
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mentionWorkflowInput">
                <input
                  value={mentionWorkflowTitle}
                  onChange={(event) => setMentionWorkflowTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && mentionSelectedIds.length > 0) {
                      confirmMentionDistribute();
                    }
                  }}
                  placeholder={mentionSourceHtml ? '输入工作流名称（选填）' : '输入工作流名称'}
                />
              </div>
              <div className="mentionActions">
                <button className="confirmCancel" onClick={() => setMentionOpen(false)}>取消</button>
                <button
                  className="confirmDanger"
                  onClick={confirmMentionDistribute}
                  disabled={mentionSelectedIds.length === 0}
                >
                  分发到 {mentionSelectedIds.length} 个客户
                </button>
              </div>
          </div>
        </div>
      )}

      {/* 右侧弹窗：为该客户选择追加到哪个工作流 */}
      {mentionOpen && mentionFocusedCustomerId && (() => {
        const focusedCustomer = customers.find((c) => c.id === mentionFocusedCustomerId);
        if (!focusedCustomer) return null;
        const focusedTargetId = mentionTargets[mentionFocusedCustomerId] || '';
        const focusedWorkflows = focusedCustomer.timeline ?? [];

        return (
        <div className="mentionWorkflowPickerOverlay" role="presentation" onMouseDown={() => setMentionFocusedCustomerId(null)}>
          <div className="mentionWorkflowPickerDialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mentionWorkflowPickerHeader">
              <button type="button" className="mentionWorkflowPickerBack" onClick={() => setMentionFocusedCustomerId(null)}>
                <ChevronLeft size={16} />
              </button>
              <div className="mentionWorkflowPickerCustomer">
                <BrandLogo company={focusedCustomer.company} />
                <strong>{focusedCustomer.company || '未命名客户'}</strong>
              </div>
            </div>
            <div className="mentionWorkflowPickerList">
              <button
                type="button"
                className={`mentionWorkflowPickerItem${focusedTargetId === '' ? ' selected' : ''}`}
                onClick={() => { setMentionTargets((current) => ({ ...current, [focusedCustomer.id]: '' })); setMentionFocusedCustomerId(null); }}
              >
                <div className="mentionWorkflowPickerItemDot" />
                <div className="mentionWorkflowPickerItemText">
                  <strong>新建工作流</strong>
                  <span>为此客户创建一条新的工作流记录</span>
                </div>
                {focusedTargetId === '' && <Check size={16} className="mentionWorkflowPickerCheck" />}
              </button>
              {focusedWorkflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  className={`mentionWorkflowPickerItem${focusedTargetId === workflow.id ? ' selected' : ''}`}
                  onClick={() => { setMentionTargets((current) => ({ ...current, [focusedCustomer.id]: workflow.id })); setMentionFocusedCustomerId(null); }}
                >
                  <div className="mentionWorkflowPickerItemDot" />
                  <div className="mentionWorkflowPickerItemText">
                    <strong>{workflow.title || '未命名工作流'}</strong>
                    <span>{[workflow.date, workflow.status].filter(Boolean).join(' · ') || '暂无信息'}</span>
                  </div>
                  {focusedTargetId === workflow.id && <Check size={16} className="mentionWorkflowPickerCheck" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        );
      })()}

      {contextMenu && (
        <div className="contextMenuOverlay" onClick={closeContextMenu} onContextMenu={(event) => { event.preventDefault(); closeContextMenu(); }}>
          <div
            className="contextMenuPanel"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="contextMenuItem"
              onClick={() => {
                closeContextMenu();
                saveEditorSelection();
                openMentionPopup();
              }}
            >
              <Send size={15} />
              分发到其他客户
            </button>
            {contextMenu.hasSelection && (
              <button
                className="contextMenuItem"
                onClick={() => {
                  closeContextMenu();
                  copyEditorSelection();
                }}
              >
                <Copy size={15} />
                复制选中内容
              </button>
            )}
            {contextMenu.hasAttachments && (
              <button
                className="contextMenuItem"
                onClick={() => {
                  closeContextMenu();
                  downloadSelectedEditorAttachments();
                }}
              >
                <Download size={15} />
                下载选中文档
              </button>
            )}
            {!contextMenu.hasSelection && (
              <div className="contextMenuHint">未选中文本，将仅创建空工作流</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function PanelTitle({ title, icon, meta, action, collapsed = false, onToggle, toggleIcon, toggleTitle, editable = false, onTitleChange }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  function commitTitleChange() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    } else {
      setTitleDraft(title);
    }
    setEditingTitle(false);
  }

  function cancelTitleEdit() {
    setTitleDraft(title);
    setEditingTitle(false);
  }

  return (
    <div className="panelTitle">
      <div>
        {icon}
        {!collapsed && (editingTitle ? (
          <input
            className="panelTitleInput"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitleChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitleChange();
              if (event.key === 'Escape') cancelTitleEdit();
            }}
            autoFocus
          />
        ) : (
          <h2
            onClick={editable ? () => { setTitleDraft(title); setEditingTitle(true); } : undefined}
            style={editable ? { cursor: 'pointer' } : undefined}
            title={editable ? '点击修改标题' : undefined}
          >
            {title}
          </h2>
        ))}
      </div>
      {!collapsed && <span>{meta}</span>}
      {!collapsed && action}
      {onToggle && (
        <button className="collapseButton" onClick={onToggle} title={toggleTitle}>
          {toggleIcon}
        </button>
      )}
    </div>
  );
}

function EditorFontPicker({ fonts, currentFont, onPick }) {
  const activeFont = fonts.find((f) => f.value === currentFont);
  return (
    <div className="toolbarFontPicker" title="设置字体">
      <button
        type="button"
        className="toolbarFontTrigger"
        onMouseDown={(event) => event.preventDefault()}
        aria-label="设置字体"
      >
        <span>{activeFont?.label || '字体'}</span>
        <ChevronDown size={10} />
      </button>
      <div className="toolbarFontPopover" role="menu" aria-label="设置字体">
        {fonts.map((font) => (
          <button
            key={font.label}
            type="button"
            className="toolbarFontOption"
            style={{ fontFamily: font.value }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(font.value)}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditorColorPicker({ label, trigger, colors, currentColor, swatchClassName, onPick }) {
  return (
    <div className="toolbarColorPicker" title={label}>
      <button
        type="button"
        className={`toolbarColorTrigger ${swatchClassName}`}
        style={{ '--active-color': currentColor }}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={label}
      >
        {trigger}
        <ChevronDown size={10} />
      </button>
      <div className="toolbarColorPopover" role="menu" aria-label={label}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`toolbarSwatch ${swatchClassName}`}
            style={{ '--swatch-color': color }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(color)}
            aria-label={`${label} ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

function EditorSizePicker({ sizes, currentSize, onPick }) {
  return (
    <div className="toolbarSizePicker" title="设置字号">
      <button
        type="button"
        className="toolbarSizeTrigger"
        onMouseDown={(event) => event.preventDefault()}
        aria-label="设置字号"
      >
        <span>{currentSize || '字号'}</span>
        <ChevronDown size={10} />
      </button>
      <div className="toolbarSizePopover" role="menu" aria-label="设置字号">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className="toolbarSizeOption"
            style={{ fontSize: size }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(size)}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

function CollapsedWorkflowRail({ workflows, selectedWorkflowId, onSelect, onMergeView, isMerged }) {
  return (
    <div className="collapsedRail" title="最近工作流" aria-label="最近工作流">
      {workflows.length > 1 && onMergeView && (
        <button
          className={`collapsedMergeButton ${isMerged ? 'active' : ''}`}
          onClick={onMergeView}
          title={isMerged ? '切换为单个查看' : '合并查看所有工作流'}
          aria-label={isMerged ? '切换为单个查看' : '合并查看所有工作流'}
        >
          合并
        </button>
      )}
      <div className="collapsedWorkflowList">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            className={`collapsedWorkflowButton ${workflow.id === selectedWorkflowId ? 'active' : ''}`}
            onClick={() => onSelect(workflow.id)}
            title={`${workflow.date} · ${workflow.title ?? workflow.content ?? '沟通记录'} · ${workflow.status}`}
            aria-label={`${workflow.date} ${workflow.title ?? workflow.content ?? '沟通记录'} ${workflow.status}`}
          >
            <span className={`statusDot status${workflow.status}`} />
            <small>{workflow.date?.slice(5).replace('-', '/')}</small>
          </button>
        ))}
        {workflows.length === 0 && (
          <div className="collapsedWorkflowEmpty" title="暂无工作流">空</div>
        )}
      </div>
      <strong>{workflows.length}</strong>
    </div>
  );
}

function CollapsedCustomerRail({ customers, selectedId, onSelect }) {
  return (
    <div className="collapsedCustomerRail">
      <div className="collapsedCustomerList">
        {customers.map((customer) => (
          <button
            key={customer.id}
            className={`collapsedCustomerButton ${customer.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(customer.id)}
            title={`${customer.company || '未命名客户'} · ${customer.country || '未知国家'}`}
          >
            <BrandLogo company={customer.company} />
          </button>
        ))}
      </div>
      <strong>{customers.length}</strong>
    </div>
  );
}

function SortableCustomerRow({ customer, isSelected, onSelect, onDelete, batchMode, isBatchSelected, onToggleBatchSelect, onTogglePin }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ id: customer.id, disabled: batchMode });

  return (
    <div
      className="sortableCustomerRow"
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
        transition,
      }}
    >
      <CustomerRowCard
        customer={customer}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        className={isDragging ? 'dragging' : isSorting ? 'sorting' : ''}
        dragAttributes={attributes}
        dragListeners={listeners}
        batchMode={batchMode}
        isBatchSelected={isBatchSelected}
        onToggleBatchSelect={onToggleBatchSelect}
        onTogglePin={onTogglePin}
      />
    </div>
  );
}

function CustomerRowCard({
  customer,
  isSelected,
  onSelect,
  onDelete,
  className = '',
  dragAttributes,
  dragListeners,
  dragging = false,
  overlay = false,
  batchMode = false,
  isBatchSelected = false,
  onToggleBatchSelect,
  onTogglePin,
}) {
  const handleClick = (event) => {
    if (batchMode) {
      onToggleBatchSelect(customer.id);
      return;
    }
    onSelect(customer.id);
  };

  return (
    <div
      className={`customerRow ${isSelected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${overlay ? 'overlay' : ''} ${customer.pinned ? 'pinned' : ''} ${isBatchSelected ? 'batchSelected' : ''} ${batchMode ? 'batchSelectable' : ''} ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          onDelete(customer);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          if (batchMode) {
            onToggleBatchSelect(customer.id);
          } else {
            onSelect(customer.id);
          }
        }
      }}
      role="button"
      tabIndex={0}
      {...(batchMode ? {} : dragAttributes)}
      {...(batchMode ? {} : dragListeners)}
    >
      {batchMode && (
        <div
          className={`batchCheckbox ${isBatchSelected ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleBatchSelect(customer.id); }}
        >
          {isBatchSelected && <span className="batchCheckmark" />}
        </div>
      )}
      <BrandLogo company={customer.company} />
      <div className="customerText">
        <strong>{customer.company || '未命名公司'}</strong>
        <span>{customer.country || '未知国家'}</span>
      </div>
      <div className="customerBadges">
        <button
          type="button"
          className={`pinButton ${customer.pinned ? 'isPinned' : ''}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(customer.id);
          }}
          title={customer.pinned ? '取消置顶' : '置顶'}
          aria-label={customer.pinned ? '取消置顶' : '置顶'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={customer.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
        <button
          type="button"
          className="customerDeleteButton"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(customer);
          }}
          title="删除用户"
          aria-label={`删除 ${customer.company || '未命名客户'}`}
        >
          <Trash2 size={13} />
        </button>
        <GradeBadge grade={customer.grade} />
      </div>
    </div>
  );
}

function BrandLogo({ company, large = false }) {
  const lower = company?.toLowerCase() ?? '';
  const cls = lower.includes('华为') ? 'huawei' : lower.includes('小米') ? 'xiaomi' : lower.includes('三星') ? 'samsung' : 'generic';
  const text = lower.includes('华为') ? '✹' : lower.includes('小米') ? 'mi' : lower.includes('三星') ? 'SAMSUNG' : company?.slice(0, 1) || '新';
  const palette = getLogoPalette(company);
  const style = cls === 'generic'
    ? { '--logo-from': palette[0], '--logo-to': palette[1], '--logo-text': palette[2] }
    : undefined;
  return <div className={`brandLogo ${cls} ${large ? 'large' : ''}`} style={style}>{text}</div>;
}

function getLogoPalette(value = '') {
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

function GradeBadge({ grade, compact = false }) {
  return (
    <span className={`gradeBadge grade${grade} ${compact ? 'compactGradeBadge' : ''}`}>
      <Star size={13} />
      {grade}
    </span>
  );
}

function normalizeWebsiteUrl(value = '') {
  const url = value.trim();
  if (!url) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

function normalizeEmailHref(value = '') {
  const email = value.trim();
  if (!email) return '';
  return `mailto:${email}`;
}

function ArchiveField({ label, defaultLabel, fieldKey, archiveCustomer, editing, editingLabel, updateArchiveDraft, updateArchiveFieldLabel }) {
  const isGrade = fieldKey === 'grade';
  const fieldValue = archiveCustomer[fieldKey] ?? '';
  const linkHref = fieldKey === 'website'
    ? normalizeWebsiteUrl(fieldValue)
    : fieldKey === 'email'
      ? normalizeEmailHref(fieldValue)
      : '';

  return (
    <div className={`archiveField ${isGrade ? 'selectInput' : ''} ${editing ? 'editingField' : ''}`}>
      <span className="archiveFieldLabel">
        {editing ? (
          <span
            className="archiveFieldLabelText"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={`修改字段名：${defaultLabel}`}
            onBlur={(event) => updateArchiveFieldLabel(fieldKey, event.currentTarget.textContent?.trim() || defaultLabel)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          >
            {editingLabel}
          </span>
        ) : (
          label
        )}
      </span>
      {isGrade ? (
        <select
          value={archiveCustomer.grade}
          disabled={!editing}
          onChange={(event) => updateArchiveDraft('grade', event.target.value)}
        >
          {CUSTOMER_GRADES.map((grade) => (
            <option key={grade} value={grade}>{grade} - {gradeMap[grade]}</option>
          ))}
        </select>
      ) : linkHref && !editing ? (
        <a
          className="archiveFieldValueLink"
          href={linkHref}
          target={fieldKey === 'website' ? '_blank' : undefined}
          rel={fieldKey === 'website' ? 'noopener noreferrer' : undefined}
          title={fieldValue}
        >
          {fieldValue}
        </a>
      ) : (
        <input
          value={fieldValue}
          disabled={!editing}
          onChange={(event) => updateArchiveDraft(fieldKey, event.target.value)}
          placeholder="未填写"
        />
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="emptyState">{text}</div>;
}

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="confirmOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirmIcon">
          <Trash2 size={20} />
        </div>
        <div className="confirmContent">
          <h3 id="confirmTitle">{title}</h3>
          <p>{message}</p>
        </div>
        <div className="confirmActions">
          <button className="confirmCancel" onClick={onCancel}>取消</button>
          <button className="confirmDanger" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

function ImportBackupDialog({ stats, onCancel, onOverwrite, onAppend }) {
  return (
    <div className="confirmOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="confirmDialog importDialog" role="dialog" aria-modal="true" aria-labelledby="importTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirmIcon importIcon">
          <Upload size={20} />
        </div>
        <div className="confirmContent">
          <h3 id="importTitle">导入数据</h3>
          <p>备份文件中共有 {stats.totalCount} 条客户数据，新增 {stats.newCount} 条，重复 {stats.duplicateCount} 条。</p>
        </div>
        <div className="importStats">
          <div>
            <span>新增</span>
            <strong>{stats.newCount}</strong>
          </div>
          <div>
            <span>重复</span>
            <strong>{stats.duplicateCount}</strong>
          </div>
        </div>
        <div className="confirmActions importActions">
          <button className="confirmCancel" onClick={onCancel}>取消</button>
          <button className="confirmCancel" onClick={onAppend} disabled={stats.newCount === 0}>追加新增数据</button>
          <button className="confirmDanger" onClick={onOverwrite}>覆盖当前数据</button>
        </div>
      </div>
    </div>
  );
}

function AttachmentPreviewDialog({ preview, onClose }) {
  const downloadName = preview.name || '附件';
  const wordPreviewRef = useRef(null);
  const excelPreviewRef = useRef(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [excelActiveSheet, setExcelActiveSheet] = useState('');

  useEffect(() => {
    if (preview.status !== 'ready' || preview.kind !== 'word' || !preview.docxBuffer || !wordPreviewRef.current) return;

    let canceled = false;
    const container = wordPreviewRef.current;
    container.innerHTML = '';

    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(preview.docxBuffer, container, null, {
        className: 'docxRenderedDocument',
        ignoreFonts: false,
        ignoreHeight: false,
        ignoreWidth: false,
        inWrapper: false,
        renderChanges: false,
        renderFooters: true,
        renderHeaders: true,
      }))
      .catch((error) => {
        if (!canceled) {
          container.innerHTML = `<div class="attachmentPreviewEmpty">${escapeHtml(error instanceof Error ? error.message : 'Word 预览失败')}</div>`;
        }
      });

    return () => {
      canceled = true;
      container.innerHTML = '';
    };
  }, [preview.docxBuffer, preview.kind, preview.status]);

  useEffect(() => {
    if (preview.status !== 'ready' || preview.kind !== 'excel' || !preview.excelBuffer) return;

    let canceled = false;

    import('xlsx')
      .then((XLSX) => {
        if (canceled) return;
        const workbook = XLSX.read(new Uint8Array(preview.excelBuffer), { type: 'array' });
        const sheets = workbook.SheetNames.map((name) => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name], { id: '', editable: false }),
        }));
        if (!canceled) {
          setExcelSheets(sheets);
          setExcelActiveSheet((current) => current || workbook.SheetNames[0] || '');
        }
      })
      .catch((error) => {
        if (!canceled) {
          setExcelSheets([]);
          setExcelActiveSheet('');
        }
      });

    return () => {
      canceled = true;
    };
  }, [preview.excelBuffer, preview.kind, preview.status]);

  const activeExcelHtml = excelSheets.find((sheet) => sheet.name === excelActiveSheet)?.html ?? '';

  return (
    <div className="confirmOverlay attachmentPreviewOverlay" role="presentation" onMouseDown={onClose}>
      <div className={`attachmentPreviewDialog ${preview.status === 'unsupported' ? 'compactPreviewDialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="attachmentPreviewTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="attachmentPreviewHeader">
          <div>
            <h3 id="attachmentPreviewTitle">{preview.name}</h3>
          </div>
          <div className="attachmentPreviewActions">
            <a href={preview.url} download={downloadName}>下载</a>
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
        <div className="attachmentPreviewBody">
          {preview.status === 'loading' && <div className="attachmentPreviewEmpty">正在加载预览</div>}
          {preview.status === 'error' && <div className="attachmentPreviewEmpty">{preview.message || '预览失败'}</div>}
          {preview.status === 'unsupported' && <div className="attachmentPreviewEmpty">当前格式暂不支持网页预览，请下载后查看。</div>}
          {preview.status === 'ready' && preview.kind === 'pdf' && (
            <iframe src={preview.previewUrl || preview.url} title={preview.name} />
          )}
          {preview.status === 'ready' && preview.kind === 'video' && (
            <div className="attachmentVideoPreview">
              <video src={preview.previewUrl || preview.url} controls autoPlay />
            </div>
          )}
          {preview.status === 'ready' && preview.kind === 'image' && (
            <div className="attachmentImagePreview">
              <img src={preview.url} alt={preview.name || '图片预览'} />
            </div>
          )}
          {preview.status === 'ready' && preview.kind === 'word' && (
            <div className="attachmentWordPreview" ref={wordPreviewRef} />
          )}
          {preview.status === 'ready' && preview.kind === 'excel' && (
            <div className="attachmentExcelPreview">
              {excelSheets.length > 1 && (
                <div className="excelSheetTabs">
                  {excelSheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={`excelSheetTab ${sheet.name === excelActiveSheet ? 'active' : ''}`}
                      onClick={() => setExcelActiveSheet(sheet.name)}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="excelTableWrapper"
                ref={excelPreviewRef}
                dangerouslySetInnerHTML={{ __html: activeExcelHtml }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
