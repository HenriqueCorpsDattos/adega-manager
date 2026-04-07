import * as SQLite from 'expo-sqlite';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  image_uri: string | null;
  created_at: string;
}

export interface StockInfo {
  product_id: number;
  product_name: string;
  product_image: string | null;
  total_quantity: number;
  last_purchase_price: number | null;
  last_margin_pct: number | null;
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
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity   REAL    NOT NULL,
      notes      TEXT,
      exit_date  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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

  return database;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
}

export async function createProduct(name: string, imageUri: string | null) {
  const db = await getDatabase();
  return db.runAsync(
    'INSERT INTO products (name, image_uri) VALUES (?, ?)',
    [name, imageUri]
  );
}

export async function updateProduct(id: number, name: string, imageUri: string | null) {
  const db = await getDatabase();
  return db.runAsync(
    'UPDATE products SET name = ?, image_uri = ? WHERE id = ?',
    [name, imageUri, id]
  );
}

export async function deleteProduct(id: number) {
  const db = await getDatabase();
  return db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export async function getStockInfo(): Promise<StockInfo[]> {
  const db = await getDatabase();
  return db.getAllAsync<StockInfo>(`
    SELECT
      p.id         AS product_id,
      p.name       AS product_name,
      p.image_uri  AS product_image,
      COALESCE((SELECT SUM(quantity) FROM stock_entries WHERE product_id = p.id), 0) -
      COALESCE((SELECT SUM(quantity) FROM stock_exits   WHERE product_id = p.id), 0)
                   AS total_quantity,
      (SELECT purchase_price FROM stock_entries
       WHERE product_id = p.id ORDER BY entry_date DESC, id DESC LIMIT 1)
                   AS last_purchase_price,
      (SELECT margin_pct FROM stock_entries
       WHERE product_id = p.id ORDER BY entry_date DESC, id DESC LIMIT 1)
                   AS last_margin_pct
    FROM products p
    ORDER BY p.name ASC
  `);
}

// ─── Shopping List ───────────────────────────────────────────────────────────

export async function getShoppingList(): Promise<ShoppingListItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<ShoppingListItem>(`
    SELECT
      sl.*,
      p.name      AS product_name,
      p.image_uri AS product_image
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
    [productId]
  );
  if (existing) {
    return db.runAsync(
      'UPDATE shopping_list SET quantity_desired = ? WHERE id = ?',
      [quantity, existing.id]
    );
  }
  return db.runAsync(
    'INSERT INTO shopping_list (product_id, quantity_desired) VALUES (?, ?)',
    [productId, quantity]
  );
}

export async function removeFromShoppingList(id: number) {
  const db = await getDatabase();
  return db.runAsync('DELETE FROM shopping_list WHERE id = ?', [id]);
}

export async function markShoppingListDone(id: number) {
  const db = await getDatabase();
  return db.runAsync('UPDATE shopping_list SET done = 1 WHERE id = ?', [id]);
}

// ─── Stock Entry ─────────────────────────────────────────────────────────────

export async function registerEntry(
  productId: number,
  quantity: number,
  purchasePrice: number,
  marginPct: number
) {
  const db = await getDatabase();
  return db.runAsync(
    'INSERT INTO stock_entries (product_id, quantity, purchase_price, margin_pct) VALUES (?, ?, ?, ?)',
    [productId, quantity, purchasePrice, marginPct]
  );
}

// ─── Stock Exit ──────────────────────────────────────────────────────────────

export async function registerExit(productId: number, quantity: number, notes: string) {
  const db = await getDatabase();
  return db.runAsync(
    'INSERT INTO stock_exits (product_id, quantity, notes) VALUES (?, ?, ?)',
    [productId, quantity, notes || null]
  );
}
