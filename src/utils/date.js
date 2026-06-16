// Pure date formatting and parsing utilities.
// No dependency on component state or DOM.

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseActivityDate(value = '') {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);
  const match = String(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return match
    ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`
    : '';
}

export function formatActivityTime(value = '') {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getMonthLabel(monthKey = '') {
  const [year, month] = monthKey.split('-');
  if (!year || !month) return '';
  return `${year}年${Number(month)}月`;
}

export function shiftMonth(monthKey, offset) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1 + offset, 1);
  return formatLocalDate(date).slice(0, 7);
}
