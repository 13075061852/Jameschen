// High-level customer/layout/viewState storage operations.
// Combines localStorage + IndexedDB for persistence.
// Dependencies: config/constants.js, db/customerDb.js, db/assetStore.js,
//               utils/editorDom.js, utils/asset.js, utils/date.js, utils/archive.js

import {
  STORAGE_KEY,
  LAYOUT_STORAGE_KEY,
  VIEW_STATE_STORAGE_KEY,
  GLOBAL_FIELD_LABELS_STORAGE_KEY,
  LOCAL_STORAGE_SAFE_CUSTOMER_SIZE,
  DEFAULT_LEFT_PANEL_WIDTH,
  DEFAULT_RIGHT_PANEL_WIDTH,
  seedCustomers,
  CUSTOMER_GRADES,
} from '../config/constants.js';
import { formatLocalDate } from '../utils/date.js';
import { formatFileSize } from '../utils/asset.js';
import {
  stripTransientObjectUrlsFromEditorHtml,
  stripTransientObjectUrlsFromCustomers,
  stripAttachmentDataForLocalStorage,
} from '../utils/editorDom.js';
import { saveCustomersToIndexedDb, readCustomersFromIndexedDb, deleteUnusedAssetsFromIndexedDb } from './customerDb.js';
import { collectAssetIdsFromCustomers } from '../utils/backup.js';
import { normalizeFieldLabels } from '../utils/archive.js';

function readStorageValue(key) {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Fall through to the reload-only safety copy written during unload.
  }

  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readInitialCustomers() {
  try {
    const stored = readStorageValue(STORAGE_KEY);
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

export function saveCustomers(customers) {
  if (!Array.isArray(customers)) return;
  const customersForStorage = stripTransientObjectUrlsFromCustomers(customers);

  // Primary: save to IndexedDB (async, handles large data)
  saveCustomersToIndexedDb(customersForStorage).catch((error) => {
    console.error('Failed to save customers to IndexedDB — data may be lost on reload', error);
  });

  // Fallback: save to localStorage for faster cold-start reads.
  try {
    const serializedCustomers = JSON.stringify(customersForStorage);
    if (serializedCustomers.length <= LOCAL_STORAGE_SAFE_CUSTOMER_SIZE) {
      localStorage.setItem(STORAGE_KEY, serializedCustomers);
      return;
    }
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

export function cleanupUnusedAssets(customers) {
  if (!Array.isArray(customers)) return;
  deleteUnusedAssetsFromIndexedDb(collectAssetIdsFromCustomers(customers)).catch((error) => {
    console.warn('Failed to clean unused assets', error);
  });
}

export function readInitialLayout() {
  try {
    const stored = readStorageValue(LAYOUT_STORAGE_KEY);
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

export function saveLayout(layout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export function readInitialViewState() {
  try {
    const stored = readStorageValue(VIEW_STATE_STORAGE_KEY);
    if (!stored) {
      return {
        selectedId: '',
        selectedWorkflowId: '',
        selectedWorkflowIds: [],
        workflowViewMode: 'single',
        mainView: 'workspace',
        calendarMonth: formatLocalDate(new Date()).slice(0, 7),
        selectedCalendarDate: formatLocalDate(new Date()),
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
      mainView: parsed.mainView === 'calendar' ? 'calendar' : 'workspace',
      calendarMonth: typeof parsed.calendarMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.calendarMonth)
        ? parsed.calendarMonth
        : formatLocalDate(new Date()).slice(0, 7),
      selectedCalendarDate: typeof parsed.selectedCalendarDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.selectedCalendarDate)
        ? parsed.selectedCalendarDate
        : formatLocalDate(new Date()),
    };
  } catch {
    return {
      selectedId: '',
      selectedWorkflowId: '',
      selectedWorkflowIds: [],
      workflowViewMode: 'single',
      mainView: 'workspace',
      calendarMonth: formatLocalDate(new Date()).slice(0, 7),
      selectedCalendarDate: formatLocalDate(new Date()),
    };
  }
}

export function saveViewState(viewState) {
  const currentViewState = readInitialViewState();
  localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify({ ...currentViewState, ...viewState }));
}

export function readInitialGlobalFieldLabels() {
  try {
    const stored = readStorageValue(GLOBAL_FIELD_LABELS_STORAGE_KEY);
    if (!stored) return {};
    return normalizeFieldLabels(JSON.parse(stored));
  } catch {
    return {};
  }
}

export function saveGlobalFieldLabels(fieldLabels) {
  localStorage.setItem(GLOBAL_FIELD_LABELS_STORAGE_KEY, JSON.stringify(fieldLabels));
}
