const app = require('./app');
const port = Number(process.env.PORT || 3004);
app.ready.then(() => app.listen(port, '0.0.0.0', () => console.log('pedidos escuchando en puerto ' + port)))
  .catch((err) => { console.error(err); process.exit(1); });
