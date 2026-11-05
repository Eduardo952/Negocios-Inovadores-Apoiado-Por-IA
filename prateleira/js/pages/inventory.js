import * as products from './products.js';
export const render = (data, params, fresh) => products.render(data, params, fresh, true);
export const mount = products.mount;
