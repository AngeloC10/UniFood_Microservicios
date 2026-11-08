const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/menus.sqlite');

// Crear el directorio si todavía no existe.
if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// Abrir la conexión con SQLite.
const db = new Database(dbPath);

// Crear la tabla de menús si todavía no existe.
db.exec(`
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    precio REAL NOT NULL CHECK (precio > 0),
    cupos INTEGER NOT NULL CHECK (cupos >= 0),
    fecha TEXT NOT NULL
  );
`);

module.exports = db;
