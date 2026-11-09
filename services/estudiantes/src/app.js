const express = require('express');
const {
  crearEstudiante,
  obtenerEstudiantePorId,
  obtenerEstudiantePorCodigo
} = require('./db');

const app = express();
app.use(express.json());

// Endpoint de salud
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Endpoint para registrar un nuevo estudiante
app.post('/estudiantes', (req, res) => {
  const { nombres, apellidos, universidad, codigoUniversitario } = req.body || {};

  // Validación de campos requeridos
  if (
    typeof nombres !== 'string' || !nombres.trim() ||
    typeof apellidos !== 'string' || !apellidos.trim() ||
    typeof universidad !== 'string' || !universidad.trim() ||
    typeof codigoUniversitario !== 'string' || !codigoUniversitario.trim()
  ) {
    return res.status(400).json({
      error: 'CAMPOS_INVALIDOS',
      message: 'Los campos nombres, apellidos, universidad y codigoUniversitario son obligatorios.'
    });
  }

  // Validación de código universitario duplicado
  const existente = obtenerEstudiantePorCodigo(codigoUniversitario);
  if (existente) {
    return res.status(409).json({
      error: 'CODIGO_DUPLICADO',
      message: 'El código universitario ya se encuentra registrado.'
    });
  }

  try {
    const nuevoEstudiante = crearEstudiante({
      nombres,
      apellidos,
      universidad,
      codigoUniversitario
    });

    return res.status(201).json(nuevoEstudiante);
  } catch (error) {
    return res.status(500).json({
      error: 'ERROR_SERVIDOR',
      message: 'Error interno al registrar el estudiante.'
    });
  }
});

// Endpoint para consultar un estudiante por id
app.get('/estudiantes/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({
      error: 'ESTUDIANTE_NO_ENCONTRADO',
      message: 'Estudiante no encontrado.'
    });
  }

  const estudiante = obtenerEstudiantePorId(id);
  if (!estudiante) {
    return res.status(404).json({
      error: 'ESTUDIANTE_NO_ENCONTRADO',
      message: 'Estudiante no encontrado.'
    });
  }

  return res.status(200).json(estudiante);
});

app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'ERROR_SERVIDOR' : 'CAMPOS_INVALIDOS', message: status === 500 ? 'Error interno del servidor.' : 'Cuerpo JSON inválido.' });
});

module.exports = app;
