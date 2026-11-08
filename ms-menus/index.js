const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'menus_db',
  port: process.env.DB_PORT || 5432,
});

// Endpoint de estado del servicio
app.get('/health', (req, res) => {
  res.json({ status: 'OK', microservicio: 'ms-menus' });
});

// GET /menus - Consultar menús disponibles
app.get('/menus', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM menus WHERE activo = true');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar los menús del día' });
  }
});

// GET /menus/:id - Consultar menú por ID (para el microservicio de Pedidos)
app.get('/menus/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM menus WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menú no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar el menú' });
  }
});

// POST /menus - Registrar un nuevo menú (Restaurante)
app.post('/menus', async (req, res) => {
  const { nombre, descripcion, precio, cupos_disponibles } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO menus (nombre, descripcion, precio, cupos_disponibles) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, descripcion, precio, cupos_disponibles]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar el menú' });
  }
});

// PATCH /menus/:id/descontar - Descontar cupos (Microservicio de Pedidos)
app.patch('/menus/:id/descontar', async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  try {
    const menuQuery = await pool.query('SELECT cupos_disponibles FROM menus WHERE id = $1', [id]);
    if (menuQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Menú no encontrado' });
    }

    const cuposActuales = menuQuery.rows[0].cupos_disponibles;
    if (cuposActuales < cantidad) {
      return res.status(400).json({ error: 'Cupos insuficientes para esta reserva' });
    }

    const updateQuery = await pool.query(
      'UPDATE menus SET cupos_disponibles = cupos_disponibles - $1 WHERE id = $2 RETURNING *',
      [cantidad, id]
    );

    res.json({ mensaje: 'Cupos actualizados exitosamente', menu: updateQuery.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al descontar cupos' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Microservicio de Menús activo en el puerto ${PORT}`);
});
