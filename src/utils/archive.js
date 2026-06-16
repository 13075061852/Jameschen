// Archive field definitions and label utilities.
// No dependency on component state.

export const archiveFields = [
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

export function makeArchiveDraft(customer, globalFieldLabels = {}) {
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

export function getArchiveFieldLabel(customer, globalFieldLabels, fieldKey, defaultLabel) {
  return customer?.fieldLabels?.[fieldKey] || globalFieldLabels?.[fieldKey] || defaultLabel;
}

export function normalizeFieldLabels(fieldLabels = {}, fallbackLabels = {}) {
  return archiveFields.reduce((labels, [key, defaultLabel]) => {
    const label = fieldLabels[key]?.trim();
    const fallbackLabel = fallbackLabels[key] ?? defaultLabel;
    if (label && label !== fallbackLabel) {
      labels[key] = label;
    }
    return labels;
  }, {});
}
