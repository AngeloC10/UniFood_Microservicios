const express = require('express');
const db = require('./db');

const app = express();

app.use(express.json());

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const fechaISO = new Date(`${fecha}T00:00:00Z`);

  return Number.isFinite(fechaISO.getTime()) &&
    fechaISO.toISOString().slice(0, 10) === fecha;
}

function idValido(id) {
  const numero = Number(id);
  return Number.isSafeInteger(numero) && numero > 0;
}

// Estado del microservicio.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Consultar menús, opcionalmente filtrados por fecha.
app.get('/menus', (req, res) => {
  const { fecha } = req.query;

  if (fecha !== undefined && !fechaValida(fecha)) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      message: 'La fecha debe tener el formato AAAA-MM-DD.'
    });
  }

  try {
    const menus = fecha
      ? db.prepare('SELECT * FROM menus WHERE fecha = ? ORDER BY id').all(fecha)
      : db.prepare('SELECT * FROM menus ORDER BY id').all();

    return res.status(200).json(menus);
  } catch (error) {
    console.error('Error al consultar menús:', error.message);

    return res.status(500).json({
      error: 'ERROR_INTERNO',
      message: 'No se pudieron consultar los menús.'
    });
  }
});

// Consultar un menú por su identificador.
app.get('/menus/:id', (req, res) => {
  if (!idValido(req.params.id)) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      message: 'El identificador debe ser un número entero positivo.'
    });
  }

  try {
    const menu = db.prepare('SELECT * FROM menus WHERE id = ?').get(Number(req.params.id));

    if (!menu) {
      return res.status(404).json({
        error: 'NO_ENCONTRADO',
        message: 'El menú no existe.'
      });
    }

    return res.status(200).json(menu);
  } catch (error) {
    console.error('Error al consultar menú:', error.message);

    return res.status(500).json({
      error: 'ERROR_INTERNO',
      message: 'No se pudo consultar el menú.'
    });
  }
});

// Registrar un menú.
app.post('/menus', (req, res) => {
  const { nombre, descripcion, precio, cupos, fecha } = req.body;

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim() ||
    typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0 ||
    !Number.isInteger(cupos) || cupos < 0 ||
    !fechaValida(fecha)
  ) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      message: 'Verifique nombre, descripcion, precio, cupos y fecha (AAAA-MM-DD).'
    });
  }

  try {
    const resultado = db.prepare(`
      INSERT INTO menus (nombre, descripcion, precio, cupos, fecha)
      VALUES (?, ?, ?, ?, ?)
    `).run(nombre.trim(), descripcion.trim(), precio, cupos, fecha);

    return res.status(201).json({
      id: Number(resultado.lastInsertRowid)
    });
  } catch (error) {
    console.error('Error al registrar menú:', error.message);

    return res.status(500).json({
      error: 'ERROR_INTERNO',
      message: 'No se pudo registrar el menú.'
    });
  }
});

// Reservar un cupo de forma atómica.
app.post('/menus/:id/reservar-cupo', (req, res) => {
  if (!idValido(req.params.id)) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      message: 'El identificador debe ser un número entero positivo.'
    });
  }

  const id = Number(req.params.id);

  try {
    const resultado = db.prepare(`
      UPDATE menus
      SET cupos = cupos - 1
      WHERE id = ? AND cupos > 0
    `).run(id);

    if (resultado.changes === 0) {
      const menu = db.prepare('SELECT id, cupos FROM menus WHERE id = ?').get(id);

      if (!menu) {
        return res.status(404).json({
          error: 'NO_ENCONTRADO',
          message: 'El menú no existe.'
        });
      }

      return res.status(409).json({
        error: 'SIN_CUPOS',
        message: 'No hay cupos disponibles para este menú.'
      });
    }

    const menuActualizado = db.prepare(
      'SELECT id, cupos FROM menus WHERE id = ?'
    ).get(id);

    return res.status(200).json({
      message: 'Cupo reservado correctamente.',
      id: menuActualizado.id,
      cupos: menuActualizado.cupos
    });
  } catch (error) {
    console.error('Error al reservar cupo:', error.message);

    return res.status(500).json({
      error: 'ERROR_INTERNO',
      message: 'No se pudo reservar el cupo.'
    });
  }
});

// Devolver un cupo cuando falla el registro del pedido.
app.post('/menus/:id/devolver-cupo', (req, res) => {
  if (!idValido(req.params.id)) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      message: 'El identificador debe ser un número entero positivo.'
    });
  }

  const id = Number(req.params.id);

  try {
    const resultado = db.prepare(`
      UPDATE menus
      SET cupos = cupos + 1
      WHERE id = ?
    `).run(id);

    if (resultado.changes === 0) {
      return res.status(404).json({
        error: 'NO_ENCONTRADO',
        message: 'El menú no existe.'
      });
    }

    const menuActualizado = db.prepare(
      'SELECT id, cupos FROM menus WHERE id = ?'
    ).get(id);

    return res.status(200).json({
      message: 'Cupo devuelto correctamente.',
      id: menuActualizado.id,
      cupos: menuActualizado.cupos
    });
  } catch (error) {
    console.error('Error al devolver cupo:', error.message);

    return res.status(500).json({
      error: 'ERROR_INTERNO',
      message: 'No se pudo devolver el cupo.'
    });
  }
});

module.exports = app;
