const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.DB_PATH = ':memory:';
const app = require('../src/app');

test('GET /health devuelve 200 y status ok', async () => {
  await app.ready;
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await app.closeDb();
  }
});
