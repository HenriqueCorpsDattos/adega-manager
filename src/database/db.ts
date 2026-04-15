import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  image_uri: string | null;
  renews_stock: number; // 0 | 1
  created_at: string;
}

export interface StockLot {
  entry_id: number;
  product_id: number;
  product_name: string;
  product_image: string | null;
  original_quantity: number;
  remaining_quantity: number;
  purchase_price: number;
  margin_pct: number;
  sale_price: number;
  entry_date: string;
}

export interface StockSummary {
  product_id: number;
  product_name: string;
  product_image: string | null;
  total_quantity: number;
  total_investment: number;
}

export interface ShoppingListItem {
  id: number;
  product_id: number;
  quantity_desired: number;
  done: number;
  created_at: string;
  product_name: string;
  product_image: string | null;
}

export interface PaymentMethod {
  id: number;
  name: string;
  fee_pct: number;
  created_at: string;
}

export interface Order {
  id: number;
  payment_method_id: number | null;
  payment_method_name: string | null;
  fee_pct: number;
  period_id: number | null;
  total_value: number;
  fee_value: number;
  net_value: number;
  notes: string | null;
  created_at: string;
  item_count: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_image: string | null;
  entry_id: number | null;
  quantity: number;
  unit_sale_price: number;
  notes: string | null;
  total: number;
}

export interface ReportPeriod {
  id: number;
  started_at: string;
  closed_at: string | null;
  total_value: number | null;
  total_cost: number | null;
  profit: number | null;
}

// ─── Cart item (local state only) ────────────────────────────────────────────

export interface CartItem {
  product_id:      number;
  product_name:    string;
  product_image:   string | null;
  entry_id:        number;
  lot_date:        string;
  quantity:        number;
  unit_sale_price: number;
  purchase_price:  number;
  margin_pct:      number;
  notes:           string;
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  database = await SQLite.openDatabaseAsync('adega.db');

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      image_uri     TEXT,
      renews_stock  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id     INTEGER NOT NULL,
      quantity       REAL    NOT NULL,
      purchase_price REAL    NOT NULL,
      margin_pct     REAL    NOT NULL,
      entry_date     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      fee_pct    REAL    NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS report_periods (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      closed_at   TEXT,
      total_value REAL,
      total_cost  REAL,
      profit      REAL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER,
      period_id         INTEGER,
      total_value       REAL    NOT NULL DEFAULT 0,
      fee_value         REAL    NOT NULL DEFAULT 0,
      net_value         REAL    NOT NULL DEFAULT 0,
      notes             TEXT,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY (period_id)         REFERENCES report_periods(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER NOT NULL,
      product_id      INTEGER NOT NULL,
      entry_id        INTEGER,
      quantity        REAL    NOT NULL,
      unit_sale_price REAL    NOT NULL,
      purchase_price  REAL    NOT NULL DEFAULT 0,
      notes           TEXT,
      FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (entry_id)   REFERENCES stock_entries(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_list (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id       INTEGER NOT NULL,
      quantity_desired REAL    NOT NULL,
      done             INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for existing DBs
  const migrations = [
    'ALTER TABLE products ADD COLUMN renews_stock INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE report_periods ADD COLUMN total_cost REAL',
    'ALTER TABLE report_periods ADD COLUMN profit REAL',
  ];
  for (const sql of migrations) {
    try { await database.execAsync(sql); } catch (_) { /* already exists */ }
  }

  await runSeed(database);

  return database;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function copyAssetToDocuments(module: number, filename: string): Promise<string> {
  const dest = FileSystem.documentDirectory + filename;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (asset.localUri) {
    await FileSystem.copyAsync({ from: asset.localUri, to: dest });
  }
  return dest;
}

async function runSeed(db: SQLite.SQLiteDatabase) {
  const seeded = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_config WHERE key = 'seeded'",
  );
  if (seeded) return;

  try {
    const cocaUri     = await copyAssetToDocuments(require('../../assets/seed/coca-350ml.jpg'), 'seed-coca.jpg');
    const guaranaUri  = await copyAssetToDocuments(require('../../assets/seed/guarana-350ml.jpg'), 'seed-guarana.jpg');

    await db.runAsync(
      'INSERT OR IGNORE INTO products (name, image_uri, renews_stock) VALUES (?, ?, ?)',
      ['Coca 350ml', cocaUri, 0],
    );
    await db.runAsync(
      'INSERT OR IGNORE INTO products (name, image_uri, renews_stock) VALUES (?, ?, ?)',
      ['Guaraná 350ml', guaranaUri, 0],
    );
  } catch (_) { /* seed images unavailable, skip */ }

  await db.runAsync("INSERT INTO app_config (key, value) VALUES ('seeded', '1')");
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
}

export async function createProduct(name: string, imageUri: string | null, renewsStock: boolean) {
  const db = await getDatabase();
  return db.runAsync(
    'INSERT INTO products (name, image_uri, renews_stock) VALUES (?, ?, ?)',
    [name, imageUri, renewsStock ? 1 : 0],
  );
}

export async function updateProduct(id: number, name: string, imageUri: string | null, renewsStock: boolean) {
  const db = await getDatabase();
  return db.runAsync(
    'UPDATE products SET name = ?, image_uri = ?, renews_stock = ? WHERE id = ?',
    [name, imageUri, renewsStock ? 1 : 0, id],
  );
}

export async function deleteProduct(id: number) {
  const db = await getDatabase();
  return db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

// ─── Stock Lots ───────────────────────────────────────────────────────────────

export async function getStockLots(): Promise<StockLot[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Omit<StockLot, 'sale_price'>>(`
    SELECT
      se.id                AS entry_id,
      se.product_id,
      p.name               AS product_name,
      p.image_uri          AS product_image,
      se.quantity          AS original_quantity,
      (se.quantity - COALESCE(
        (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id), 0
      ))                   AS remaining_quantity,
      se.purchase_price,
      se.margin_pct,
      se.entry_date
    FROM stock_entries se
    JOIN products p ON p.id = se.product_id
    ORDER BY p.name ASC, se.entry_date ASC
  `);
  return rows
    .filter(r => r.remaining_quantity > 0)
    .map(r => ({ ...r, sale_price: r.purchase_price * (1 + r.margin_pct / 100) }));
}

export async function getStockSummary(): Promise<StockSummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<StockSummary>(`
    SELECT
      p.id                                        AS product_id,
      p.name                                      AS product_name,
      p.image_uri                                 AS product_image,
      COALESCE(SUM(
        se.quantity - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id
        ), 0)
      ), 0)                                       AS total_quantity,
      COALESCE(SUM(
        (se.quantity - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.entry_id = se.id
        ), 0)) * se.purchase_price
      ), 0)                                       AS total_investment
    FROM products p
    LEFT JOIN stock_entries se ON se.product_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `);
}

// ─── Stock Entry ─────────────────────────────────────────────────────────────

export async function registerEntry(
  productId: number,
  quantity: number,
  purchasePrice: number,
  marginPct: number,
) {
  const db = await getDatabase();
  return db.runAsync(
    'INSERT INTO stock_entries (product_id, quantity, purchase_price, margin_pct) VALUES (?, ?, ?, ?)',
    [productId, quantity, purchasePrice, marginPct],
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function confirmOrder(
  items: CartItem[],
  paymentMethodId: number | null,
  notes: string,
): Promise<number> {
  const db = await getDatabase();

  const periodId = await getOrCreateCurrentPeriod();
  let feePct = 0;
  if (paymentMethodId) {
    const pm = await db.getFirstAsync<{ fee_pct: number }>(
      'SELECT fee_pct FROM payment_methods WHERE id = ?', [paymentMethodId],
    );
    feePct = pm?.fee_pct ?? 0;
  }

  const totalValue = items.reduce((s, i) => s + i.unit_sale_price * i.quantity, 0);
  const feeValue   = totalValue * (feePct / 100);
  const netValue   = totalValue - feeValue;

  const orderResult = await db.runAsync(
    'INSERT INTO orders (payment_method_id, period_id, total_value, fee_value, net_value, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [paymentMethodId, periodId, totalValue, feeValue, netValue, notes || null],
  );
  const orderId = orderResult.lastInsertRowId;

  for (const item of items) {
    await db.runAsync(
      'INSERT INTO order_items (order_id, product_id, entry_id, quantity, unit_sale_price, purchase_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, item.product_id, item.entry_id, item.quantity, item.unit_sale_price, item.purchase_price, item.notes || null],
    );
  }

  // Auto-add to shopping list for products with renews_stock = 1 (immediately, any quantity)
  for (const item of items) {
    const product = await db.getFirstAsync<{ renews_stock: number }>(
      'SELECT renews_stock FROM products WHERE id = ?', [item.product_id],
    );
    if (product?.renews_stock === 1) {
      await addToShoppingList(item.product_id, item.quantity);
    }
  }

  return orderId;
}


export async function getOrders(): Promise<Order[]> {
  const db = await getDatabase();
  return db.getAllAsync<Order>(`
    SELECT
      o.id,
      o.payment_method_id,
      pm.name          AS payment_method_name,
      COALESCE(pm.fee_pct, 0) AS fee_pct,
      o.period_id,
      o.total_value,
      o.fee_value,
      o.net_value,
      o.notes,
      o.created_at,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
    ORDER BY o.created_at DESC
  `);
}

export async function getOrdersForPeriod(periodId: number): Promise<Order[]> {
  const db = await getDatabase();
  return db.getAllAsync<Order>(`
    SELECT
      o.id,
      o.payment_method_id,
      pm.name          AS payment_method_name,
      COALESCE(pm.fee_pct, 0) AS fee_pct,
      o.period_id,
      o.total_value,
      o.fee_value,
      o.net_value,
      o.notes,
      o.created_at,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
    WHERE o.period_id = ?
    ORDER BY o.created_at DESC
  `, [periodId]);
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<OrderItem>(`
    SELECT
      oi.id,
      oi.order_id,
      oi.product_id,
      p.name       AS product_name,
      p.image_uri  AS product_image,
      oi.entry_id,
      oi.quantity,
      oi.unit_sale_price,
      oi.notes,
      oi.quantity * oi.unit_sale_price AS total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `, [orderId]);
}

// ─── Shopping List ────────────────────────────────────────────────────────────

export async function getShoppingList(): Promise<ShoppingListItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<ShoppingListItem>(`
    SELECT sl.*, p.name AS product_name, p.image_uri AS product_image
    FROM shopping_list sl
    JOIN products p ON p.id = sl.product_id
    WHERE sl.done = 0
    ORDER BY sl.created_at DESC
  `);
}

export async function addToShoppingList(productId: number, quantity: number) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM shopping_list WHERE product_id = ? AND done = 0', [productId],
  );
  if (existing) {
    return db.runAsync('UPDATE shopping_list SET quantity_desired = ? WHERE id = ?', [quantity, existing.id]);
  }
  return db.runAsync('INSERT INTO shopping_list (product_id, quantity_desired) VALUES (?, ?)', [productId, quantity]);
}

export async function removeFromShoppingList(id: number) {
  const db = await getDatabase();
  return db.runAsync('DELETE FROM shopping_list WHERE id = ?', [id]);
}

export async function markShoppingListDone(id: number) {
  const db = await getDatabase();
  return db.runAsync('UPDATE shopping_list SET done = 1 WHERE id = ?', [id]);
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const db = await getDatabase();
  return db.getAllAsync<PaymentMethod>('SELECT * FROM payment_methods ORDER BY name ASC');
}

export async function createPaymentMethod(name: string, feePct: number) {
  const db = await getDatabase();
  return db.runAsync('INSERT INTO payment_methods (name, fee_pct) VALUES (?, ?)', [name, feePct]);
}

export async function updatePaymentMethod(id: number, name: string, feePct: number) {
  const db = await getDatabase();
  return db.runAsync('UPDATE payment_methods SET name = ?, fee_pct = ? WHERE id = ?', [name, feePct, id]);
}

export async function deletePaymentMethod(id: number) {
  const db = await getDatabase();
  return db.runAsync('DELETE FROM payment_methods WHERE id = ?', [id]);
}

// ─── Report Periods ───────────────────────────────────────────────────────────

export async function getOrCreateCurrentPeriod(): Promise<number> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM report_periods WHERE closed_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    "INSERT INTO report_periods (started_at) VALUES (datetime('now','localtime'))",
  );
  return result.lastInsertRowId;
}

export async function getCurrentPeriod(): Promise<ReportPeriod | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ReportPeriod>(
    'SELECT * FROM report_periods WHERE closed_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
}

export async function closePeriod(periodId: number) {
  const db = await getDatabase();

  const totals = await db.getFirstAsync<{ total_value: number; total_cost: number }>(`
    SELECT
      COALESCE(SUM(o.total_value), 0) AS total_value,
      COALESCE(SUM(oi.quantity * oi.purchase_price), 0) AS total_cost
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.period_id = ?
  `, [periodId]);

  const totalValue = totals?.total_value ?? 0;
  const totalCost  = totals?.total_cost ?? 0;
  const profit     = totalValue - totalCost;

  await db.runAsync(
    "UPDATE report_periods SET closed_at = datetime('now','localtime'), total_value = ?, total_cost = ?, profit = ? WHERE id = ?",
    [totalValue, totalCost, profit, periodId],
  );
  await db.runAsync("INSERT INTO report_periods (started_at) VALUES (datetime('now','localtime'))");
}

export async function getClosedPeriods(): Promise<ReportPeriod[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReportPeriod>(
    'SELECT * FROM report_periods WHERE closed_at IS NOT NULL ORDER BY closed_at DESC',
  );
}

export async function getClosedPeriodsByMonth(year: number, month: number): Promise<ReportPeriod[]> {
  const db = await getDatabase();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return db.getAllAsync<ReportPeriod>(
    "SELECT * FROM report_periods WHERE closed_at IS NOT NULL AND strftime('%Y-%m', closed_at) = ? ORDER BY closed_at DESC",
    [prefix],
  );
}
