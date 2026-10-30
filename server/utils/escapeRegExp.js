/**
 * Escape user input before using it inside a RegExp.
 * Prevents regex injection ("(.+)+" ReDoS / broken filters).
 */
export const escapeRegExp = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export default escapeRegExp;
