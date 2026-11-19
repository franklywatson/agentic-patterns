import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { pool, redis } from './infra.js';

// Single-shopper demo: one cart and one "last order" for the whole app, so the
// browser tests (which open a new browser context per test) share state.
const CART_KEY = 'cart:default';
const LAST_ORDER_KEY = 'last-order:default';

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function cartItems(): Promise<{ id: number; name: string }[]> {
  const raw = await redis.lRange(CART_KEY, 0, -1);
  return raw.map((r) => JSON.parse(r));
}

async function layout(title: string, body: string): Promise<string> {
  const count = (await redis.lLen(CART_KEY)).toString();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body><header><a href="/products">Products</a> <a href="/cart">Cart</a>
<a href="/orders">Orders</a> <span data-testid="cart-badge">${count}</span></header>
<main>${body}</main></body></html>`;
}

export const pages = Router();

pages.get('/', async (_req, res) => {
  res.type('html').send(await layout('Stack Test Shop', '<h1>Stack Test Shop</h1><p>Browse the <a href="/products">products</a>.</p>'));
});

pages.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

pages.get('/products', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, price_cents FROM products ORDER BY id');
  const cards = rows
    .map(
      (p) => `<div data-testid="product-card"><span>${esc(p.name)}</span>
<span>$${(p.price_cents / 100).toFixed(2)}</span>
<form method="post" action="/cart/add"><input type="hidden" name="productId" value="${p.id}">
<button type="submit" data-testid="add-to-cart">Add to cart</button></form></div>`,
    )
    .join('\n');
  res.type('html').send(await layout('Products', `<h1>Products</h1>${cards}`));
});

pages.post('/cart/add', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM products WHERE id = $1', [Number(req.body.productId)]);
  if (rows.length === 0) {
    res.status(404).type('html').send(await layout('Not found', '<p>Unknown product</p>'));
    return;
  }
  await redis.rPush(CART_KEY, JSON.stringify(rows[0]));
  res.redirect(303, '/products');
});

pages.get('/cart', async (_req, res) => {
  const items = await cartItems();
  const list = items.map((i) => `<li data-testid="cart-item">${esc(i.name)}</li>`).join('\n');
  const body = `<h1>Cart</h1><ul>${list}</ul>` +
    (items.length > 0 ? '<a href="/checkout" data-testid="checkout-button">Checkout</a>' : '<p>Your cart is empty.</p>');
  res.type('html').send(await layout('Cart', body));
});

const FIELDS = [
  ['email', 'Email'],
  ['name', 'Name'],
  ['address', 'Address'],
  ['city', 'City'],
  ['zip', 'ZIP'],
] as const;

async function checkoutForm(values: Record<string, string>, error?: string): Promise<string> {
  const inputs = FIELDS.map(
    ([f, label]) =>
      `<label>${label} <input name="${f}" data-testid="checkout-${f}" value="${esc(values[f] ?? '')}"></label>`,
  ).join('\n');
  const err = error ? `<p data-testid="checkout-error">${esc(error)}</p>` : '';
  return layout(
    'Checkout',
    `<h1>Checkout</h1>${err}<form method="post" action="/checkout">${inputs}
<button type="submit" data-testid="checkout-submit">Place order</button></form>`,
  );
}

pages.get('/checkout', async (_req, res) => {
  res.type('html').send(await checkoutForm({}));
});

pages.post('/checkout', async (req, res) => {
  const values: Record<string, string> = {};
  for (const [f] of FIELDS) values[f] = String(req.body[f] ?? '').trim();
  const missing = FIELDS.filter(([f]) => values[f] === '').map(([, label]) => label);
  if (missing.length > 0) {
    res.status(400).type('html').send(await checkoutForm(values, `Required fields missing: ${missing.join(', ')}`));
    return;
  }
  const items = await cartItems();
  if (items.length === 0) {
    res.status(400).type('html').send(await checkoutForm(values, 'Cart is empty: invalid checkout'));
    return;
  }
  const orderId = `ord_${randomBytes(6).toString('hex')}`;
  await pool.query(
    `INSERT INTO orders (id, email, customer_name, address, city, zip, items, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')`,
    [orderId, values.email, values.name, values.address, values.city, values.zip, JSON.stringify(items)],
  );
  await redis.del(CART_KEY);
  await redis.set(LAST_ORDER_KEY, orderId);
  res.redirect(303, '/order-confirmation');
});

pages.get('/order-confirmation', async (_req, res) => {
  const orderId = await redis.get(LAST_ORDER_KEY);
  if (!orderId) {
    res.status(404).type('html').send(await layout('No order', '<p>No recent order.</p>'));
    return;
  }
  const { rows } = await pool.query('SELECT items FROM orders WHERE id = $1', [orderId]);
  const items: { name: string }[] = rows[0].items;
  res.type('html').send(
    await layout(
      'Order confirmation',
      `<h1>Order confirmed</h1><p>Order <span data-testid="order-id">${esc(orderId)}</span></p>
<p>Items: <span data-testid="order-item-count">${items.length}</span></p>
<ul data-testid="order-summary">${items.map((i) => `<li>${esc(i.name)}</li>`).join('')}</ul>`,
    ),
  );
});

pages.get('/orders', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, status FROM orders ORDER BY created_at');
  const list = rows
    .map((o) => `<tr data-testid="order-row"><td>${esc(o.id)}</td><td data-testid="order-status">${esc(o.status)}</td></tr>`)
    .join('\n');
  res.type('html').send(await layout('Orders', `<h1>Orders</h1><table>${list}</table>`));
});
