export class ValidationError extends Error {
  constructor(message, field = '') { super(message); this.name = 'ValidationError'; this.field = field; }
}
export const requireThat = (condition, message, field) => { if (!condition) throw new ValidationError(message, field); };
export function text(value, label, field, max = 120, optional = false) {
  requireThat(typeof value === 'string', `${label} inválido.`, field);
  const cleaned = value.trim();
  requireThat((optional || cleaned.length > 0) && cleaned.length <= max, `${label}: informe ${optional ? 'até' : 'de 1 a'} ${max} caracteres.`, field);
  return cleaned;
}
export function numeric(value, label, field, decimals = 3) {
  requireThat(value !== '' && value !== null && value !== undefined, `Informe ${label.toLowerCase()}.`, field);
  const n = Number(value);
  requireThat(Number.isFinite(n) && n >= 0 && n <= 1e9, `${label} deve ser um número entre 0 e 1 bilhão.`, field);
  requireThat(Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) < .00001, `${label}: use no máximo ${decimals} casas decimais.`, field);
  return n;
}
export function quantity(value, unit, field = 'quantity') { return numeric(value, 'Quantidade', field, ['kg', 'l'].includes(unit) ? 3 : 0); }
