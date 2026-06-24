/**
 * useCustomerStore — manages customer data CRUD, search/filter, batch operations,
 * persistence (localStorage + IndexedDB), and selection memory.
 *
 * Extracted from App.jsx during the Phase-2 refactor. All pure data operations
 * live here; editor-dependent logic stays in App.jsx / useRichEditor.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

import { STORAGE_KEY, LAYOUT_STORAGE_KEY, VIEW_STATE_STORAGE_KEY,
  GLOBAL_FIELD_LABELS_STORAGE_KEY, CUSTOMER_SAVE_DEBOUNCE_MS,
  INITIAL_CUSTOMER_RENDER_LIMIT, COLLAPSED_CUSTOMER_RENDER_LIMIT,
  LOCAL_STORAGE_SAFE_CUSTOMER_SIZE } from '../config/constants.js';
import { buildCalendarActivities } from '../utils/calendar.js';
import { stripTransientObjectUrlsFromCustomers, stripAttachmentDataForLocalStorage } from '../utils/editorDom.js';
import { makeCustomerDuplicateKeys, isDuplicateCustomer, getImportStats } from '../utils/customer.js';
import { mergeCustomersWithLatestData } from '../utils/workflow.js';
import { makeArchiveDraft, normalizeFieldLabels } from '../utils/archive.js';
import { readCustomersFromIndexedDb, normalizeCustomers } from '../db/customerDb.js';
import { readInitialCustomers, saveCustomers, cleanupUnusedAssets,
  readInitialGlobalFieldLabels, saveGlobalFieldLabels } from '../db/storage.js';

/**
 * Generate a collision-resistant customer ID.
 * Bug fix: original used `c-${Date.now()}` which collides when called in
 * rapid succession (e.g. double-click). We now append a random suffix.
 */
export function generateCustomerId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a blank customer object with the given id and company name.
 */
export function makeBlankCustomer(id, company) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    serialNumber: '',
    pinned: false,
    company: company || '新客户',
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
}

function hasLocalStorageCustomerSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * @param {Object} options
 * @param {() => Object} options.getEditorContentFlush - callback that flushes
 *   the current editor HTML into the customers array and returns the updated array.
 *   Used by operations that must persist editor state before mutating customers.
 * @param {Object} options.viewStateCallbacks - callbacks to sync view state
 *   (selectedId, selectedWorkflowId, etc.) when customer store changes.
 * @param {Set} [options._skipHydrate] - internal flag used during tests
 */
export default function useCustomerStore({ getEditorContentFlush, viewStateCallbacks }) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState(readInitialCustomers);
  const customersRef = useRef(customers);
  const userModifiedSinceLoad = useRef(false);
  const [globalFieldLabels, setGlobalFieldLabels] = useState(readInitialGlobalFieldLabels);
  const [customerStoreHydrated, setCustomerStoreHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('全部');
  const [customerRenderLimit, setCustomerRenderLimit] = useState(INITIAL_CUSTOMER_RENDER_LIMIT);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState(new Set());
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const customerSaveTimerRef = useRef(null);

  // ─── Keep customersRef in sync ──────────────────────────────────────────
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  // ─── IndexedDB hydration effect ──────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    const hasLocalStorageSnapshot = hasLocalStorageCustomerSnapshot();

    readCustomersFromIndexedDb()
      .then((storedCustomers) => {
        if (canceled || !storedCustomers) return;
        if (userModifiedSinceLoad.current) {
          if (!hasLocalStorageSnapshot) {
            const mergedCustomers = mergeCustomersWithLatestData(
              customersRef.current,
              stripTransientObjectUrlsFromCustomers(storedCustomers),
              { includeStoredOnlyCustomers: true, includeStoredOnlyTimelineEntries: true }
            );
            setCustomers(mergedCustomers);
            customersRef.current = mergedCustomers;
            saveCustomers(mergedCustomers);
            viewStateCallbacks?.onHydrated?.(mergedCustomers);
            setCustomerStoreHydrated(true);
            return;
          }
          console.warn('Skipped IndexedDB overwrite because user has already modified data');
          return;
        }
        const currentCustomers = customersRef.current;
        const normalizedStoredCustomers = stripTransientObjectUrlsFromCustomers(storedCustomers);
        const selectedId = viewStateCallbacks?.getSelectedId?.() ?? '';
        const selectedExistsInCurrent = currentCustomers.some((c) => c.id === selectedId);
        const selectedExistsInStored = normalizedStoredCustomers.some((c) => c.id === selectedId);
        const shouldRecoverIndexedDbOnlyData = !hasLocalStorageSnapshot;
        const mergedCustomers = mergeCustomersWithLatestData(currentCustomers, normalizedStoredCustomers, {
          includeStoredOnlyCustomers: shouldRecoverIndexedDbOnlyData,
          includeStoredOnlyTimelineEntries: shouldRecoverIndexedDbOnlyData,
        });
        setCustomers(mergedCustomers);
        customersRef.current = mergedCustomers;
        if (shouldRecoverIndexedDbOnlyData || (selectedId && selectedExistsInCurrent && !selectedExistsInStored)) {
          saveCustomers(mergedCustomers);
        }
        viewStateCallbacks?.onHydrated?.(mergedCustomers);
        setCustomerStoreHydrated(true);
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

  // ─── Reset render limit when filter changes ─────────────────────────────
  useEffect(() => {
    setCustomerRenderLimit(INITIAL_CUSTOMER_RENDER_LIMIT);
    exitBatchMode();
  }, [gradeFilter, query]);

  // ─── Core commit helpers ────────────────────────────────────────────────
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

  // ─── Simple CRUD ────────────────────────────────────────────────────────
  function updateCustomer(id, patch) {
    commitCustomersFromUpdater((current) =>
      current.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function addCustomer(editorContentFlush = getEditorContentFlush) {
    const id = generateCustomerId();
    const companyName = noteTitleDraft.trim() || '新客户';
    const nextCustomer = makeBlankCustomer(id, companyName);
    nextCustomer.serialNumber = String(customersRef.current.length + 1);

    const currentCustomers = editorContentFlush ? editorContentFlush() : customersRef.current;
    const nextCustomers = [nextCustomer, ...currentCustomers];
    commitCustomers(nextCustomers, true);
    setNoteTitleDraft('');
    return id;
  }

  function createMentionCustomer(name) {
    const id = generateCustomerId();
    const companyName = name.trim() || '新客户';
    const nextCustomer = makeBlankCustomer(id, companyName);
    nextCustomer.serialNumber = String((customersRef.current?.length ?? 0) + 1);

    const nextCustomers = [nextCustomer, ...(customersRef.current ?? [])];
    commitCustomers(nextCustomers, true);
    return id;
  }

  function reorderCustomers(activeId, overId) {
    if (!overId || activeId === overId) return;
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

  function togglePinCustomer(customerId) {
    commitCustomersFromUpdater((current) =>
      current.map((c) =>
        c.id === customerId ? { ...c, pinned: !c.pinned } : c
      )
    );
  }

  // ─── Batch operations ──────────────────────────────────────────────────
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

  // ─── Delete operations ─────────────────────────────────────────────────
  function performDeleteCustomer(customerId, editorContentFlush = getEditorContentFlush) {
    const currentCustomers = editorContentFlush ? editorContentFlush() : customersRef.current;
    const nextCustomers = currentCustomers.filter((c) => c.id !== customerId);
    commitCustomers(nextCustomers);
    cleanupUnusedAssets(nextCustomers);
    return nextCustomers;
  }

  function performBatchDelete(ids, editorContentFlush = getEditorContentFlush) {
    const idSet = new Set(ids);
    const currentCustomers = editorContentFlush ? editorContentFlush() : customersRef.current;
    const nextCustomers = currentCustomers.filter((c) => !idSet.has(c.id));
    commitCustomers(nextCustomers);
    cleanupUnusedAssets(nextCustomers);
    exitBatchMode();
    return nextCustomers;
  }

  // ─── Archive helpers (state only, UI in App) ───────────────────────────
  function updateArchiveDraft(fieldKey, value, currentDraft, selectedCustomer) {
    const draft = currentDraft ?? makeArchiveDraft(selectedCustomer, globalFieldLabels);
    return { ...draft, [fieldKey]: value };
  }

  function updateArchiveFieldLabelInDraft(fieldKey, value, currentDraft, selectedCustomer) {
    const draft = currentDraft ?? makeArchiveDraft(selectedCustomer, globalFieldLabels);
    return {
      ...draft,
      fieldLabels: { ...(draft?.fieldLabels ?? {}), [fieldKey]: value },
    };
  }

  // ─── Backup helpers (state mutation only, file I/O in App) ───────────────
  function applyImportedCustomers(payload, mode, currentCustomers) {
    const importedCustomers = normalizeCustomers(Array.isArray(payload) ? payload : payload?.customers);
    if (importedCustomers.length === 0) {
      throw new Error('备份文件里没有可导入的客户数据');
    }
    if (importedCustomers.length > 100000) {
      throw new Error('导入的客户数量超过上限（100000），请检查备份文件');
    }
    if (mode === 'append') {
      const duplicateKeys = makeCustomerDuplicateKeys(currentCustomers);
      const newCustomers = importedCustomers.filter((c) => !isDuplicateCustomer(c, duplicateKeys));
      return [...currentCustomers, ...newCustomers];
    }
    return importedCustomers;
  }

  function importStats(importedCustomers, currentCustomers) {
    return getImportStats(importedCustomers, currentCustomers);
  }

  // ─── Emergency flush for beforeunload ──────────────────────────────────
  function flushAllForUnload(viewState) {
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
    if (viewState) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(viewState.layout));
      localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(viewState.viewState));
    }
    localStorage.setItem(GLOBAL_FIELD_LABELS_STORAGE_KEY, JSON.stringify(globalFieldLabels));
  }

  // ─── Computed values ───────────────────────────────────────────────────
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

  /**
   * Filter customers by an arbitrary text query (used by mention dialog).
   * Not a useMemo because the query comes from outside this hook.
   */
  function filterCustomersByText(text) {
    if (!text?.trim()) return customers;
    const lower = text.toLowerCase();
    return customers.filter((c) =>
      `${c.company} ${c.contact} ${c.country}`.toLowerCase().includes(lower)
    );
  }

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => c.timeline?.[0]?.status !== '暂停').length,
  }), [customers]);

  const calendarActivitiesByDate = useMemo(() => buildCalendarActivities(customers), [customers]);

  // ─── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(customerSaveTimerRef.current);
  }, []);

  // ─── Public API ──────────────────────────────────────────────────────────
  return {
    // State
    customers,
    setCustomers,
    customersRef,
    customerStoreHydrated,
    globalFieldLabels,
    query, setQuery,
    gradeFilter, setGradeFilter,
    customerRenderLimit, setCustomerRenderLimit,
    batchMode, setBatchMode,
    batchSelectedIds, setBatchSelectedIds,
    noteTitleDraft, setNoteTitleDraft,

    // Core CRUD
    commitCustomers,
    commitCustomersFromUpdater,
    flushCustomersSave,
    commitGlobalFieldLabels,
    updateCustomer,
    addCustomer,
    createMentionCustomer,
    reorderCustomers,
    handleCustomerDragEnd,
    togglePinCustomer,

    // Batch
    enterBatchMode,
    exitBatchMode,
    toggleBatchSelectCustomer,

    // Delete
    performDeleteCustomer,
    performBatchDelete,

    // Archive
    updateArchiveDraft,
    updateArchiveFieldLabelInDraft,

    // Backup
    applyImportedCustomers,
    importStats,

    // Emergency
    flushAllForUnload,

    // Computed
    filteredCustomers,
    visibleCustomers,
    collapsedVisibleCustomers,
    hasMoreCustomers,
    filterCustomersByText,
    stats,
    calendarActivitiesByDate,
  };
}
