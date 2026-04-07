import * as SQLite from 'expo-sqlite';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  image_uri: string | null;
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

export interface ReportPeriod {
  id: number;
  started_at: string;
  closed_at: string | null;
  total_value: number | null;
}

export interface ReportExitRow {
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_sale_price: number;
  total: number;
  exit_date: string;
  notes: string | null;
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  database = await SQLite.openDatabaseAsync('adega.db');

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      image_uri  TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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

    CREATE TABLE IF NOT EXISTS stock_exits (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL,
      entry_id        INTEGER,
      quantity        REAL    NOT NULL,
      unit_sale_price REAL,
      notes           TEXT,
      exit_date       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      period_id       INTEGER,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id)   REFERENCES stock_entries(id) ON DELETE SET NULL,
      FOREIGN KEY (period_id)  REFERENCES report_periods(id)
    );

    CREATE TABLE IF NOT EXISTS report_periods (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      closed_at   TEXT,
      total_value REAL
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
    'ALTER TABLE stock_exits ADD COLUMN entry_id INTEGER',
    'ALTER TABLE stock_exits ADD COLUMN unit_sale_price REAL',
    'ALTER TABLE stock_exits ADD COLUMN period_id INTEGER',
  ];
  for (const sql of migrations) {
    try { await database.execAsync(sql); } catch (_) { /* column already exists */ }
  }

  return database;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
}

export async function createProduct(name: string, imageUri: string | null) {
  const db = await getDatabase();
  return db.runAsync('INSERT INTO products (name, image_uri) VALUES (?, ?)', [name, imageUri]);
}

export async function updateProduct(id: number, name: string, imageUri: string | null) {
  const db = await getDatabase();
  return db.runAsync('UPDATE products SET name = ?, image_uri = ? WHERE id = ?', [name, imageUri, id]);
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
        (SELECT SUM(sx.quantity) FROM stock_exits sx WHERE sx.entry_id = se.id), 0
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
      p.id          AS product_id,
      p.name        AS product_name,
      p.image_uri   AS product_image,
      COALESCE((
        SELECT SUM(se.quantity) - COALESCE((
          SELECT SUM(sx.quantity) FROM stock_exits sx
          WHERE sx.product_id = p.id
        ), 0)
        FROM stock_entries se WHERE se.product_id = p.id
      ), 0)         AS total_quantity
    FROM products p
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

// ─── Stock Exit (per lot) ─────────────────────────────────────────────────────

export async function registerExitFromLot(
  entryId: number,
  productId: number,
  quantity: number,
  notes: string,
) {
  const db = await getDatabase();

  const lot = await db.getFirstAsync<{ purchase_price: number; margin_pct: number }>(
    'SELECT purchase_price, margin_pct FROM stock_entries WHERE id = ?',
    [entryId],
  );
  if (!lot) throw new Error('Lote não encontrado.');

  const unitSalePrice = lot.purchase_price * (1 + lot.margin_pct / 100);
  const periodId = await getOrCreateCurrentPeriod();

  return db.runAsync(
    'INSERT INTO stock_exits (product_id, entry_id, quantity, unit_sale_price, notes, period_id) VALUES (?, ?, ?, ?, ?, ?)',
    [productId, entryId, quantity, unitSalePrice, notes || null, periodId],
  );
}

// ─── Shopping List ───────────────────────────────────────────────────────────

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
    'SELECT id FROM shopping_list WHERE product_id = ? AND done = 0',
    [productId],
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

// ─── Report Periods ───────────────────────────────────────────────────────────

export async function getOrCreateCurrentPeriod(): Promise<number> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM report_periods WHERE closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
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
    "SELECT * FROM report_periods WHERE closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
  );
}

export async function closePeriod(periodId: number) {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(quantity * unit_sale_price), 0) AS total FROM stock_exits WHERE period_id = ?',
    [periodId],
  );
  await db.runAsync(
    "UPDATE report_periods SET closed_at = datetime('now','localtime'), total_value = ? WHERE id = ?",
    [result?.total ?? 0, periodId],
  );
  // Create new period
  await db.runAsync("INSERT INTO report_periods (started_at) VALUES (datetime('now','localtime'))");
}

export async function getReportForPeriod(periodId: number): Promise<ReportExitRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReportExitRow>(`
    SELECT
      p.name               AS product_name,
      p.image_uri          AS product_image,
      sx.quantity,
      COALESCE(sx.unit_sale_price, 0) AS unit_sale_price,
      sx.quantity * COALESCE(sx.unit_sale_price, 0) AS total,
      sx.exit_date,
      sx.notes
    FROM stock_exits sx
    JOIN products p ON p.id = sx.product_id
    WHERE sx.period_id = ?
    ORDER BY sx.exit_date DESC
  `, [periodId]);
}

export async function getClosedPeriods(): Promise<ReportPeriod[]> {
  const db = await getDatabase();
  return db.getAllAsync<ReportPeriod>(
    "SELECT * FROM report_periods WHERE closed_at IS NOT NULL ORDER BY closed_at DESC",
  );
}
