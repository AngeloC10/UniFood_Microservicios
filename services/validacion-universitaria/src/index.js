const { createApp } = require('./app');
const { openDb } = require('./db');
const app = createApp({ db: openDb() });
const port = Number(process.env.PORT || 3002);
app.listen(port, '0.0.0.0', () => console.log('validacion-universitaria escuchando en puerto ' + port));
