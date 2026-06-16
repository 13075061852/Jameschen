// IndexedDB connection management and customer record CRUD.
// Dependencies: config/constants.js, utils/editorDom.js

import {
  CUSTOMER_DB_NAME,
  CUSTOMER_DB_STORE,
  CUSTOMER_ASSET_STORE,
  STORAGE_KEY,
  CUSTOMER_GRADES,
  seedCustomers,
} from '../config/constants.js';
import { stripTransientObjectUrlsFromEditorHtml } from '../utils/editorDom.js';

export function openCustomerDb() {
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

export async function saveCustomersToIndexedDb(customers) {
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

export async function readCustomersFromIndexedDb() {
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

// --- Asset store operations ---

export async function saveAssetToIndexedDb(asset) {
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

export async function readAssetFromIndexedDb(assetId) {
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

export async function deleteUnusedAssetsFromIndexedDb(usedAssetIds = []) {
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

// --- Normalize customers (used after reading from IndexedDB) ---

export function normalizeCustomers(customers) {
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
