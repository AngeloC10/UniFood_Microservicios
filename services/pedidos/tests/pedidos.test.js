const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { once } = require('node:events');

let BASE_URL;
let server;
let db;
let app;

describe('Pruebas del Microservicio de Pedidos (SQLite temporal)', () => {

  before(async () => {
    process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'unifood-pedidos-test-')), 'pedidos.sqlite');
    app = require('../index.js');
    await app.ready;
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    BASE_URL = `http://127.0.0.1:${server.address().port}`;
    db = new sqlite3.Database(process.env.DB_PATH);
    await new Promise((resolve, reject) => {
      const sql = `INSERT OR IGNORE INTO pedidos (id, estudianteId, menuId, estado) VALUES (1, 100, 200, 'PENDIENTE'), (2, 101, 201, 'PENDIENTE')`;
      db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  after(async () => {
    // Apagar servidor y base de datos al terminar
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
    if (app) await app.closeDb();
  });

  test('GET /health - Debe retornar HTTP 200 y status ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { status: 'ok' });
  });

  test('GET /pedidos/1 - Debe consultar un pedido existente', async () => {
    const res = await fetch(`${BASE_URL}/pedidos/1`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, 1);
    assert.ok(data.estudianteId);
    assert.ok(data.menuId);
  });

  test('GET /pedidos/9999 - Debe retornar 404 para ID inexistente', async () => {
    const res = await fetch(`${BASE_URL}/pedidos/9999`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, 'NOT_FOUND');
  });

  test('PATCH /pedidos/1 - Transición válida PENDIENTE -> LISTO', async () => {
    const res = await fetch(`${BASE_URL}/pedidos/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'LISTO' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.estado, 'LISTO');
  });

  test('PATCH /pedidos/2 - Regla de negocio: Rechazar salto directo de PENDIENTE a ENTREGADO', async () => {
    const res = await fetch(`${BASE_URL}/pedidos/2`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'ENTREGADO' })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'VAL_ERROR');
  });

  test('POST /pedidos - Rechazar payload incompleto', async () => {
    const res = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudianteId: 1 }) // Falta menuId
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'VAL_ERROR');
  });

  test('PATCH concurrentes aceptan una sola transición del pedido 2', async () => {
    const respuestas = await Promise.all(Array.from({ length: 8 }, () => fetch(`${BASE_URL}/pedidos/2`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'LISTO' })
    })));
    assert.strictEqual(respuestas.filter(res => res.status === 200).length, 1);
    assert.ok(respuestas.every(res => [200, 400, 409].includes(res.status)));
    for (const respuesta of respuestas) await respuesta.json();
    const consulta = await fetch(`${BASE_URL}/pedidos/2`);
    assert.strictEqual((await consulta.json()).estado, 'LISTO');
  });

});
