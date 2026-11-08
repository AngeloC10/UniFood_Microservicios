const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3004;
const ESTUDIANTES_URL = process.env.ESTUDIANTES_URL || 'http://localhost:3001';
const VALIDACIONES_URL = process.env.VALIDACIONES_URL || 'http://localhost:3002';
const MENUS_URL = process.env.MENUS_URL || 'http://localhost:3003';

const dbPath = process.env.DB_PATH || path.join(__dirname, 'pedidos.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error al conectar a SQLite:', err.message);
  else console.log(`Conectado a BD SQLite en ${dbPath}`);
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudianteId INTEGER NOT NULL,
      menuId INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('PENDIENTE', 'LISTO', 'ENTREGADO')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/pedidos', async (req, res) => {
  const { estudianteId, menuId } = req.body;

  if (!estudianteId || !menuId) {
    return res.status(400).json({ error: 'VAL_ERROR', message: 'estudianteId y menuId son obligatorios' });
  }

  try {
    const resEstudiante = await fetch(`${ESTUDIANTES_URL}/estudiantes/${estudianteId}`);
    if (resEstudiante.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'El estudiante no existe' });
    }
    if (!resEstudiante.ok) {
      return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Error en servicio de estudiantes' });
    }

    const resValidacion = await fetch(`${VALIDACIONES_URL}/validaciones/estudiantes/${estudianteId}`);
    if (resValidacion.status === 404) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Estudiante no tiene solicitud de validación' });
    }
    if (resValidacion.ok) {
      const validacion = await resValidacion.json();
      if (validacion.estado !== 'APROBADO') {
        return res.status(403).json({ error: 'FORBIDDEN', message: `Validación no aprobada (Estado: ${validacion.estado})` });
      }
    } else {
      return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Error en servicio de validación' });
    }

    const resCupo = await fetch(`${MENUS_URL}/menus/${menuId}/reservar-cupo`, { method: 'POST' });
    if (resCupo.status === 409) {
      return res.status(409).json({ error: 'CONFLICT', message: 'El menú no cuenta con cupos disponibles' });
    }
    if (resCupo.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'El menú no existe' });
    }
    if (!resCupo.ok) {
      return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Error al reservar cupo' });
    }

    const sql = `INSERT INTO pedidos (estudianteId, menuId, estado) VALUES (?, ?, 'PENDIENTE')`;
    db.run(sql, [estudianteId, menuId], async function (err) {
      if (err) {
        await fetch(`${MENUS_URL}/menus/${menuId}/devolver-cupo`, { method: 'POST' }).catch(() => {});
        return res.status(500).json({ error: 'DB_ERROR', message: 'Error al guardar el pedido' });
      }

      res.status(201).json({
        id: this.lastID,
        estudianteId,
        menuId,
        estado: 'PENDIENTE'
      });
    });

  } catch (error) {
    res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'Error de conexión interna' });
  }
});

app.get('/pedidos/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM pedidos WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Pedido no encontrado' });
    res.json(row);
  });
});

app.patch('/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!['LISTO', 'ENTREGADO'].includes(estado)) {
    return res.status(400).json({ error: 'VAL_ERROR', message: 'El estado solo puede cambiar a LISTO o ENTREGADO' });
  }

  db.get(`SELECT estado FROM pedidos WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Pedido no encontrado' });

    const estadoActual = row.estado;
    if (estadoActual === 'PENDIENTE' && estado !== 'LISTO') {
      return res.status(400).json({ error: 'VAL_ERROR', message: 'Un pedido PENDIENTE solo puede pasar a LISTO' });
    }
    if (estadoActual === 'LISTO' && estado !== 'ENTREGADO') {
      return res.status(400).json({ error: 'VAL_ERROR', message: 'Un pedido LISTO solo puede pasar a ENTREGADO' });
    }
    if (estadoActual === 'ENTREGADO') {
      return res.status(400).json({ error: 'VAL_ERROR', message: 'El pedido ya fue entregado' });
    }

    db.run(`UPDATE pedidos SET estado = ? WHERE id = ?`, [estado, id], function (err) {
      if (err) return res.status(500).json({ error: 'DB_ERROR', message: err.message });
      res.json({ id: Number(id), estado });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Microservicio de Pedidos corriendo en el puerto ${PORT}`);
});
