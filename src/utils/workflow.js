// Workflow metadata utilities: edit timeline, creation time, content richness,
// merge/compare logic.
// Dependencies: utils/date.js (parseActivityDate), utils/html.js (toEditorHtml),
//               utils/editorDom.js (stripTransientObjectUrlsFromEditorHtml, normalizeWorkflowDocumentContent)

import { parseActivityDate } from './date.js';
import { toEditorHtml } from './html.js';
import {
  normalizeWorkflowDocumentContent,
  stripTransientObjectUrlsFromEditorHtml,
} from './editorDom.js';

export function getLegacyWorkflowEditHistory(item = {}) {
  return Array.isArray(item.editHistory)
    ? item.editHistory
        .map((entry) => (typeof entry === 'string' ? { at: entry } : entry))
        .filter((entry) => typeof entry?.at === 'string' && entry.at)
    : [];
}

export function getWorkflowEditTimeline(item = {}) {
  const content = item.documentContent ?? item.content ?? '';
  if (!content) return [];

  const readTimestampText = (value = '') => value.replace(/\s+/g, ' ').trim();
  let timestamps = [];

  if (typeof document === 'undefined') {
    timestamps = Array.from(String(content).matchAll(/<div[^>]*class=(["'])[^"']*editorTimestampBlock[^"']*\1[^>]*>([\s\S]*?)<\/div>/gi))
      .map((match) => readTimestampText(match[2].replace(/<[^>]*>/g, '')));
  } else {
    const container = document.createElement('div');
    container.innerHTML = toEditorHtml(content);
    timestamps = Array.from(container.querySelectorAll('.editorTimestampBlock'))
      .map((element) => readTimestampText(element.textContent ?? ''));
  }

  const seen = new Set();
  return timestamps
    .slice(1)
    .map((at) => ({ at }))
    .filter((entry) => parseActivityDate(entry.at))
    .filter((entry) => {
      const key = entry.at;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getWorkflowCreatedAt(item = {}) {
  const legacyHistory = getLegacyWorkflowEditHistory(item);
  return item.createdAt || legacyHistory[0]?.at || item.date || '';
}

export function getWorkflowContentRichness(entry = {}) {
  const content = String(entry.documentContent ?? entry.content ?? '');
  const hasCompressedAttachment = content.includes('[附件-大数据已压缩]');
  const mediaCount = (content.match(/editor(Image|Attachment|Video)Frame|<img\b|<video\b/gi) ?? []).length;
  return {
    length: content.length,
    mediaCount,
    hasCompressedAttachment,
  };
}

export function shouldPreferStoredWorkflowEntry(currentEntry = {}, storedEntry = {}) {
  const currentTime = currentEntry.lastEditedAt
    ? new Date(currentEntry.lastEditedAt).getTime() : 0;
  const storedTime = storedEntry.lastEditedAt
    ? new Date(storedEntry.lastEditedAt).getTime() : 0;

  if (storedTime > currentTime) return true;
  if (storedTime < currentTime) return false;

  const currentRichness = getWorkflowContentRichness(currentEntry);
  const storedRichness = getWorkflowContentRichness(storedEntry);
  if (currentRichness.hasCompressedAttachment && !storedRichness.hasCompressedAttachment) return true;
  if (!currentRichness.hasCompressedAttachment && storedRichness.hasCompressedAttachment) return false;
  if (storedRichness.mediaCount > currentRichness.mediaCount) return true;
  if (storedRichness.mediaCount < currentRichness.mediaCount) return false;
  return storedRichness.length > currentRichness.length;
}

export function markWorkflowContentEdited(entry, nextContent, now = new Date()) {
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
 */
export function mergeCustomersWithLatestData(currentCustomers, storedCustomers) {
  const storedById = new Map();
  for (let i = 0; i < storedCustomers.length; i += 1) {
    const customer = storedCustomers[i];
    if (customer?.id) storedById.set(customer.id, customer);
  }

  return currentCustomers.map((currentCustomer) => {
    const storedCustomer = storedById.get(currentCustomer.id);
    if (!storedCustomer) return currentCustomer;

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

      return shouldPreferStoredWorkflowEntry(currentEntry, storedEntry) ? storedEntry : currentEntry;
    });

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
