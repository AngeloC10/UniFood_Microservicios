const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const BASE_URL = 'http://localhost:3004';
let server;

describe('Pruebas del Microservicio de Pedidos (Puerto 3004)', () => {

  before(async () => {
    // 1. Iniciar el servidor
    server = require('../index.js');
    // 2. Darle 1 segundo de espera para que el puerto 3004 levante por completo
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(() => {
    // 3. Apagar el servidor al terminar para no bloquear GitHub Actions
    if (server) server.close();
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

});
