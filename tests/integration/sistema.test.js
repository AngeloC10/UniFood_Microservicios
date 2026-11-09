const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '../..');
const services = ['estudiantes', 'validacion-universitaria', 'menus', 'pedidos'];
const entries = ['src/index.js', 'src/index.js', 'src/index.js', 'index.js'];
const docker = process.env.UNIFOOD_INTEGRATION_MODE === 'docker';
const runFile = promisify(execFile);

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test(`Sistema completo: HTTP real y SQLite (${docker ? 'Docker' : 'procesos Node'})`, { timeout: 600000 }, async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'unifood-integracion-'));
  const reportDir = process.env.UNIFOOD_REPORT_DIR ? path.resolve(process.env.UNIFOOD_REPORT_DIR) : dir;
  mkdirSync(reportDir, { recursive: true });
  const ports = [];
  for (const _service of services) ports.push(await freePort());
  const urls = ports.map(port => `http://127.0.0.1:${port}`);
  const project = `unifood-test-${Date.now()}-${process.pid}`;
  const children = new Map();
  const logs = Object.fromEntries(services.map(s => [s, '']));
  const results = [];
  let startedDocker = false;
  const composeArgs = ['compose', '-p', project, '-f', path.join(root, 'docker-compose.yml'), '-f', path.join(dir, 'compose.test.yml')];
  // Mantener activo el event loop mientras Docker trabaja permite a fetch
  // procesar el cierre de conexiones keep-alive antes de la siguiente petición.
  const compose = async (...args) => {
    const command = runFile('docker', [...composeArgs, ...args], {
      cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 10 * 1024 * 1024
    });
    command.child.stderr.on('data', chunk => process.stderr.write(chunk));
    return (await command).stdout;
  };

  async function request(service, route, method = 'GET', body) {
    const response = await fetch(urls[service] + route, {
      method, signal: AbortSignal.timeout(15000),
      // La suite detiene/reinicia contenedores: no reutilizar sockets que
      // puedan haber sido cerrados durante esas operaciones.
      headers: { connection: 'close', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { assert.fail(`Respuesta no JSON: ${response.status} ${text.slice(0, 200)}`); }
    return { status: response.status, data };
  }

  async function expect(service, route, status, method = 'GET', body) {
    const result = await request(service, route, method, body);
    assert.equal(result.status, status, `${method} ${route}: ${JSON.stringify(result.data)}`);
    if (status >= 400) {
      assert.equal(typeof result.data.error, 'string');
      assert.equal(typeof result.data.message, 'string');
    }
    return result.data;
  }

  async function healthy(index) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const child = children.get(index);
      if (child && child.exitCode !== null) assert.fail(`${services[index]} terminó: ${logs[services[index]]}`);
      try {
        const result = await request(index, '/health');
        if (result.status === 200 && result.data.status === 'ok') return;
      } catch {}
      await delay(100);
    }
    assert.fail(`No arrancó ${services[index]}: ${logs[services[index]]}`);
  }

  async function start(index) {
    const child = spawn(process.execPath, [entries[index]], {
      cwd: path.join(root, 'services', services[index]),
      env: { ...process.env, PORT: String(ports[index]), DB_PATH: path.join(dir, `${services[index]}.sqlite`),
        ESTUDIANTES_URL: urls[0], VALIDACIONES_URL: urls[1], MENUS_URL: urls[2] },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.on('error', err => { logs[services[index]] += err.stack; });
    child.stdout.on('data', chunk => { logs[services[index]] += chunk; });
    child.stderr.on('data', chunk => { logs[services[index]] += chunk; });
    children.set(index, child);
    await healthy(index);
  }

  async function stop(index) {
    const child = children.get(index);
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, 'exit');
    child.kill('SIGTERM');
    await exit;
  }

  async function step(name, fn) {
    await t.test(name, async () => {
      try { await fn(); results.push({ caso: name, estado: 'FUNCIONA' }); }
      catch (err) { results.push({ caso: name, estado: 'FALLA', error: err.message }); throw err; }
    });
  }

  // Solo la SQLite creada por esta prueba recibe un trigger temporal de fallo.
  async function sqlPedidos(sql) {
    const code = `const sqlite3=require('sqlite3'); const db=new sqlite3.Database(process.env.DB_PATH); db.exec(${JSON.stringify(sql)},err=>db.close(()=>{if(err){console.error(err);process.exitCode=1}}));`;
    if (docker) await compose('exec', '-T', 'pedidos', 'node', '-e', code);
    else await runFile(process.execPath, ['-e', code], {
      cwd: path.join(root, 'services/pedidos'), env: { ...process.env, DB_PATH: path.join(dir, 'pedidos.sqlite') }
    });
  }

  t.after(async () => {
    if (docker && startedDocker) {
      try { writeFileSync(path.join(reportDir, 'docker-ps.txt'), await compose('ps', '-a')); } catch {}
      try { writeFileSync(path.join(reportDir, 'docker.log'), await compose('logs', '--no-color')); } catch {}
      try { await compose('stop'); } catch (err) { t.diagnostic(`No se pudo detener ${project}: ${err.message}`); }
    }
    for (let i = 3; i >= 0; i--) await stop(i);
    for (const service of services) writeFileSync(path.join(reportDir, `${service}.log`), logs[service]);
    writeFileSync(path.join(reportDir, 'resultados.json'), JSON.stringify({
      modo: docker ? 'docker' : 'node', nodeHost: process.version,
      proyectoDocker: docker ? project : undefined, puertos: ports, datos: dir, resultados: results
    }, null, 2));
    t.diagnostic(`Evidencias: ${reportDir}`);
    if (docker) t.diagnostic(`Volúmenes de prueba conservados. Proyecto: ${project}`);
  });

  if (docker) {
    writeFileSync(path.join(dir, 'compose.test.yml'), 'services:\n' + services.map((service, i) =>
      `  ${service}:\n    ports: !override\n      - "127.0.0.1:${ports[i]}:${3001 + i}"\n`).join(''));
    startedDocker = true;
    writeFileSync(path.join(reportDir, 'docker-build.txt'), await compose('up', '--build', '-d', '--wait', '--wait-timeout', '120'));
    const versions = [];
    for (const service of services) {
      versions.push(`${service}\n${await compose('exec', '-T', service, 'node', '-p', 'JSON.stringify({node:process.version,npm:require("child_process").execSync("npm --version").toString().trim(),express:require("express/package.json").version,sqlite:process.versions.sqlite})')}`);
    }
    writeFileSync(path.join(reportDir, 'versiones.txt'), versions.join('\n'));
  } else {
    for (let i = 0; i < services.length; i++) await start(i);
  }

  let estudiante, validacion, menu, pedido;
  const estudianteBody = { nombres: 'Estudiante Ficticio', apellidos: 'Prueba Integración', universidad: 'Universidad Continental', codigoUniversitario: `TEST-${Date.now()}` };
  const menuBody = { nombre: 'Menú ficticio', descripcion: 'Solo pruebas', precio: 10, cupos: 3, fecha: '2026-11-08' };
  await step('Salud: cuatro servicios reales', async () => {
    for (let i = 0; i < 4; i++) assert.deepEqual(await expect(i, '/health', 200), { status: 'ok' });
  });
  await step('Caso 1: registrar estudiante y rechazar duplicado', async () => {
    estudiante = await expect(0, '/estudiantes', 201, 'POST', estudianteBody);
    assert.ok(estudiante.id > 0);
    await expect(0, '/estudiantes', 409, 'POST', estudianteBody);
  });
  await step('Caso 2: solicitar validación manual PENDIENTE', async () => {
    validacion = await expect(1, '/validaciones', 201, 'POST', { estudianteId: estudiante.id, numeroCarne: 'TEST-CARNE', fechaVencimiento: '2027-12-31' });
    assert.equal(validacion.estado, 'PENDIENTE');
    assert.equal(validacion.estudianteId, estudiante.id);
  });
  await step('Registrar menú y consultar disponibilidad por fecha', async () => {
    const creado = await expect(2, '/menus', 201, 'POST', menuBody);
    menu = await expect(2, `/menus/${creado.id}`, 200);
    assert.equal(menu.cupos, 3);
    const lista = await expect(2, '/menus?fecha=2026-11-08', 200);
    assert.ok(lista.some(item => item.id === menu.id));
  });
  await step('Caso 3: validación pendiente rechaza pedido (403) sin descontar', async () => {
    await expect(3, '/pedidos', 403, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 3);
  });
  await step('Caso 4: aprobar manualmente y reservar (201)', async () => {
    const aprobada = await expect(1, `/validaciones/${validacion.id}`, 200, 'PATCH', { estado: 'APROBADO' });
    assert.equal(aprobada.estado, 'APROBADO');
    pedido = await expect(3, '/pedidos', 201, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
    assert.equal(pedido.estado, 'PENDIENTE');
    assert.equal(pedido.estudianteId, estudiante.id);
    assert.equal(pedido.menuId, menu.id);
  });
  await step('Caso 5: menú sin cupos rechaza pedido (409)', async () => {
    const agotado = await expect(2, '/menus', 201, 'POST', { ...menuBody, cupos: 0 });
    await expect(3, '/pedidos', 409, 'POST', { estudianteId: estudiante.id, menuId: agotado.id });
    assert.equal((await expect(2, `/menus/${agotado.id}`, 200)).cupos, 0);
  });
  await step('Caso 6: pedido válido descuenta exactamente un cupo', async () => {
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 2);
    await expect(3, '/pedidos', 201, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 1);
  });
  await step('Caso 7: consultar y actualizar PENDIENTE → LISTO → ENTREGADO', async () => {
    assert.equal((await expect(3, `/pedidos/${pedido.id}`, 200)).estado, 'PENDIENTE');
    await expect(3, `/pedidos/${pedido.id}`, 400, 'PATCH', { estado: 'ENTREGADO' });
    await expect(3, `/pedidos/${pedido.id}`, 200, 'PATCH', { estado: 'LISTO' });
    await expect(3, `/pedidos/${pedido.id}`, 200, 'PATCH', { estado: 'ENTREGADO' });
    await expect(3, `/pedidos/${pedido.id}`, 400, 'PATCH', { estado: 'LISTO' });
  });
  await step('Caso 8: estudiante inexistente (404) en tres APIs', async () => {
    await expect(0, '/estudiantes/999999999', 404);
    await expect(1, '/validaciones', 404, 'POST', { estudianteId: 999999999, numeroCarne: 'TEST', fechaVencimiento: '2027-12-31' });
    await expect(3, '/pedidos', 404, 'POST', { estudianteId: 999999999, menuId: menu.id });
    await expect(3, '/pedidos', 404, 'POST', { estudianteId: estudiante.id, menuId: 999999999 });
    await expect(3, '/pedidos/999999999', 404);
  });
  await step('Validación de payload, fecha y JSON mal formado', async () => {
    await expect(0, '/estudiantes', 400, 'POST', {});
    await expect(1, '/validaciones', 400, 'POST', { estudianteId: estudiante.id, numeroCarne: 'TEST', fechaVencimiento: '2027-02-30' });
    await expect(2, '/menus', 400, 'POST', { ...menuBody, cupos: -1 });
    await expect(2, '/menus?fecha=2026-02-30', 400);
    for (const id of [-1, 0, 1.5, '1', {}, true]) {
      await expect(3, '/pedidos', 400, 'POST', { estudianteId: id, menuId: menu.id });
      await expect(3, '/pedidos', 400, 'POST', { estudianteId: estudiante.id, menuId: id });
    }
    for (let i = 0; i < 4; i++) {
      const response = await fetch(urls[i] + ['/estudiantes', '/validaciones', '/menus', '/pedidos'][i], {
        method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body: '{', signal: AbortSignal.timeout(5000)
      });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, 'string');
      await expect(i, ['/estudiantes', '/validaciones', '/menus', '/pedidos'][i], 400, 'POST', null);
    }
  });
  await step('Caso 9: dependencias realmente detenidas responden 503', async () => {
    for (const index of [0, 1, 2]) {
      // Pedidos debe estar disponible antes de detener su dependencia.
      await expect(3, '/health', 200);
      try {
        if (docker) await compose('stop', services[index]); else await stop(index);
        await expect(3, '/pedidos', 503, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
        if (index === 0) await expect(1, '/validaciones', 503, 'POST', { estudianteId: estudiante.id, numeroCarne: 'TEST', fechaVencimiento: '2027-12-31' });
      } finally {
        if (docker) await compose('start', services[index]); else await start(index);
        await healthy(index);
      }
    }
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 1);
  });
  await step('Compensación: fallo real de INSERT devuelve el cupo (500)', async () => {
    await sqlPedidos(`CREATE TRIGGER fallo_integracion BEFORE INSERT ON pedidos WHEN NEW.menuId = ${menu.id} BEGIN SELECT RAISE(FAIL, 'Fallo de prueba'); END;`);
    try {
      await expect(3, '/pedidos', 500, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
      assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 1);
    } finally { await sqlPedidos('DROP TRIGGER fallo_integracion;'); }
  });
  await step('Concurrencia: cinco reservas para un cupo, solo una aceptada', async () => {
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => request(3, '/pedidos', 'POST', { estudianteId: estudiante.id, menuId: menu.id })));
    assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409, 409, 409, 409]);
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 0);
  });
  await step('Solicitud reciente RECHAZADA impide reservar (403)', async () => {
    const nueva = await expect(1, '/validaciones', 201, 'POST', { estudianteId: estudiante.id, numeroCarne: 'TEST-NUEVO', fechaVencimiento: '2027-12-31' });
    await expect(1, `/validaciones/${nueva.id}`, 200, 'PATCH', { estado: 'RECHAZADO' });
    await expect(3, '/pedidos', 403, 'POST', { estudianteId: estudiante.id, menuId: menu.id });
    validacion = nueva;
  });
  await step('Caso 10: reiniciar los cuatro servicios conserva las cuatro SQLite', async () => {
    if (docker) await compose('restart');
    else {
      for (let i = 3; i >= 0; i--) await stop(i);
      for (let i = 0; i < 4; i++) await start(i);
    }
    for (let i = 0; i < 4; i++) await healthy(i);
    assert.equal((await expect(0, `/estudiantes/${estudiante.id}`, 200)).codigoUniversitario, estudianteBody.codigoUniversitario);
    const ultima = await expect(1, `/validaciones/estudiantes/${estudiante.id}`, 200);
    assert.equal(ultima.id, validacion.id);
    assert.equal(ultima.estado, 'RECHAZADO');
    assert.equal((await expect(2, `/menus/${menu.id}`, 200)).cupos, 0);
    assert.equal((await expect(3, `/pedidos/${pedido.id}`, 200)).estado, 'ENTREGADO');
  });
});
