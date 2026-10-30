export const pickLang = (obj, lang = 'en') => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    return obj[lang] || obj.en || obj.hi || '';
  }
  return '';
};

export const formatINR = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

export const formatDate = (d) => {
  if (!d) return '—';
  const str = String(d).trim();
  // Agmarknet dates may already be DD/MM/YYYY strings — pass them through.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  try {
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return str;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return str;
  }
};

export const cx = (...parts) => parts.filter(Boolean).join(' ');
