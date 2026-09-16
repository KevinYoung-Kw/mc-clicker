const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const units = ['', '', 'M', 'B', 'T', 'Qa', 'Qi'];

// Keep early gains visible. Large values use a stable three-decimal mantissa;
// truncation never advertises a balance the player does not yet have.
export function formatHudNumber(value, fractional = false) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (fractional && value < 10) return value.toFixed(1).replace(/\.0$/, '');
  if (value < 1e6) return integer.format(Math.floor(value));
  let group = Math.floor(Math.log10(value) / 3);
  let base = 10 ** (group * 3);
  // Math.log10 may round up immediately below a large unit boundary.
  if (value < base) { group--; base /= 1000; }
  const scaled = Math.floor(value / base * 1000) / 1000;
  return scaled.toFixed(3) + (units[group] || `e${group * 3}`);
}

export function exactBalance(value) {
  return integer.format(Math.floor(Math.max(0, Number.isFinite(value) ? value : 0)));
}
