export const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const number = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const dateTime = value => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const date = value => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
export const status = product => product.quantity === 0 ? 'empty' : product.quantity < product.min ? 'low' : product.quantity > product.max ? 'excess' : 'normal';
export const statusLabels = { empty: 'Esgotado', low: 'Estoque baixo', normal: 'Normal', excess: 'Excesso' };
export const typeLabels = { entry: 'Entrada', exit: 'Saída', adjustment: 'Ajuste' };
