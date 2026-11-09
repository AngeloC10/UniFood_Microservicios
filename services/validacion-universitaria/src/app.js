const express = require('express');
const { openDb } = require('./db');

const ESTADOS_EVALUACION = ['APROBADO', 'RECHAZADO'];

const enviarError = (res, status, error, message) =>
  res.status(status).json({ error, message });

const aDto = (r) => ({
  id: Number(r.id),
  estudianteId: Number(r.estudiante_id),
  numeroCarne: r.numero_carne,
  fechaVencimiento: r.fecha_vencimiento,
  estado: r.estado,
});

const fechaValida = (f) =>
  typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) &&
  Number.isFinite(Date.parse(f)) && new Date(f).toISOString().slice(0, 10) === f;

function createApp({ db, estudiantesUrl = process.env.ESTUDIANTES_URL || 'http://localhost:3001', fetchFn = fetch }) {
  const app = express();
  let conexion = db;
  const getDb = () => (conexion ??= openDb());
  app.use(express.json());

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.post('/validaciones', async (req, res) => {
    const { estudianteId, numeroCarne, fechaVencimiento } = req.body ?? {};
    if (
      !Number.isInteger(estudianteId) || estudianteId <= 0 ||
      typeof numeroCarne !== 'string' || numeroCarne.trim() === '' ||
      !fechaValida(fechaVencimiento)
    ) {
      return enviarError(res, 400, 'DATOS_INVALIDOS',
        'Se requiere estudianteId (entero), numeroCarne y fechaVencimiento (AAAA-MM-DD).');
    }

    let respuesta;
    try {
      respuesta = await fetchFn(`${estudiantesUrl}/estudiantes/${estudianteId}`, {
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      return enviarError(res, 503, 'ESTUDIANTES_NO_DISPONIBLE',
        'No se pudo consultar el servicio de estudiantes.');
    }
    if (respuesta.status === 404) {
      return enviarError(res, 404, 'ESTUDIANTE_NO_ENCONTRADO', 'El estudiante no existe.');
    }
    if (!respuesta.ok) {
      return enviarError(res, 503, 'ESTUDIANTES_NO_DISPONIBLE',
        'El servicio de estudiantes respondió con error.');
    }

    const info = getDb()
      .prepare('INSERT INTO validaciones (estudiante_id, numero_carne, fecha_vencimiento) VALUES (?, ?, ?)')
      .run(estudianteId, numeroCarne.trim(), fechaVencimiento);
    const fila = getDb().prepare('SELECT * FROM validaciones WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json(aDto(fila));
  });

  app.get('/validaciones/estudiantes/:estudianteId', (req, res) => {
    const estudianteId = Number(req.params.estudianteId);
    if (!Number.isInteger(estudianteId) || estudianteId <= 0) {
      return enviarError(res, 400, 'DATOS_INVALIDOS', 'estudianteId inválido.');
    }
    const fila = getDb()
      .prepare('SELECT * FROM validaciones WHERE estudiante_id = ? ORDER BY id DESC LIMIT 1')
      .get(estudianteId);
    if (!fila) {
      return enviarError(res, 404, 'VALIDACION_NO_ENCONTRADA', 'El estudiante no tiene solicitud de validación.');
    }
    return res.status(200).json(aDto(fila));
  });

  app.patch('/validaciones/:id', (req, res) => {
    const id = Number(req.params.id);
    const estado = req.body?.estado;
    if (!Number.isInteger(id) || id <= 0 || !ESTADOS_EVALUACION.includes(estado)) {
      return enviarError(res, 400, 'DATOS_INVALIDOS', 'El estado debe ser APROBADO o RECHAZADO.');
    }
    const existe = getDb().prepare('SELECT id FROM validaciones WHERE id = ?').get(id);
    if (!existe) {
      return enviarError(res, 404, 'VALIDACION_NO_ENCONTRADA', 'La validación no existe.');
    }
    getDb().prepare('UPDATE validaciones SET estado = ? WHERE id = ?').run(estado, id);
    const fila = getDb().prepare('SELECT * FROM validaciones WHERE id = ?').get(id);
    return res.status(200).json(aDto(fila));
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return enviarError(res, 400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es JSON válido.');
    }
    return enviarError(res, 500, 'ERROR_INTERNO', 'Error interno del servidor.');
  });

  return app;
}

const app = createApp({});
app.createApp = createApp;
module.exports = app;
