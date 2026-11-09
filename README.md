
# UniFood

Sistema web de reserva anticipada de menús universitarios desarrollado como proyecto académico del curso de Cloud Computing de la Universidad Continental.

## 1. Integrantes y responsabilidades

| Integrante | Responsabilidad |
|---|---|
| Angelo Ccama Condori | Líder del proyecto, administración del repositorio e integración |
| Jose Leonardo Cruz Gonzales | Microservicio de estudiantes |
| Nahun Jose Saldivar Zamora | Microservicio de validación universitaria |
| Axel Rolando Nunez Enriquez | Microservicio de menús |
| Alexander Villa Andia | Microservicio de pedidos |


## 2. Descripción del proyecto

UniFood es una propuesta de aplicación web dirigida a estudiantes universitarios de la ciudad de Cusco.

Las cuatro API implementadas permiten registrar estudiantes, aprobar manualmente su validación universitaria, registrar menús y reservar cupos. El flujo completo se comprobó con HTTP real y SQLite, tanto con procesos Node como en Docker.

La validación universitaria es interna y manual; no existe conexión con SUNEDU. Este repositorio implementa las API, sin una interfaz web de usuario.

## 3. Microservicios

El proyecto contiene cuatro microservicios independientes, cada uno con su propia SQLite.

### Microservicio de estudiantes
- Registrar estudiantes.
- Consultar información de estudiantes.
- La actualización de datos básicos todavía no está implementada.

### Microservicio de validación universitaria
- Registrar los datos del carné universitario.
- Consultar el estado de validación.
- Aprobar o rechazar solicitudes.

La validación es manual y no representa una verificación oficial de SUNEDU.

### Microservicio de menús
- Registrar menús del día.
- Consultar platos y precios.
- Controlar la cantidad disponible.

### Microservicio de pedidos
- Registrar reservas de almuerzos.
- Consultar pedidos.
- Actualizar el estado de las reservas.
- Verificar la validación del estudiante antes de aceptar un pedido.

## 4. Tecnologías y puertos comprobados

| Servicio | Puerto | Express instalado | SQLite |
|---|---|---|---|
| estudiantes | 3001 | 5.3.0 | `node:sqlite`, motor 3.53.4 |
| validacion-universitaria | 3002 | 5.3.0 | `node:sqlite`, motor 3.53.4 |
| menus | 3003 | 5.3.0 | `better-sqlite3` 13.0.3, motor 3.53.4 |
| pedidos | 3004 | 4.22.3 | `sqlite3` 5.1.7, motor 3.44.2 |

Node.js 24 según `.nvmrc` y los cuatro `engines`. Verificación local: Node 24.21.0 y npm 11.19.0. Las imágenes `node:24-alpine` construidas usaron Node 24.22.2 y npm 11.19.1. El tag Docker puede cambiar de versión patch. Docker Engine 29.8.2 y Compose 5.5.1 en la comprobación.

## 5. Ejecutar con Docker

Desde la raíz del repositorio:

```bash
docker compose config -q
docker compose up --build -d --wait --wait-timeout 120
docker compose ps
docker compose logs --tail 50
```

Compose configura las URLs internas por nombre de servicio, healthchecks y volúmenes nombrados. Las bases se guardan en `/app/data`. Para detener conservando datos: `docker compose stop`.

La revisión dejó ejecutándose un proyecto separado de diagnóstico en los mismos puertos, con sus propios volúmenes. Para administrarlo:

```bash
docker compose -p unifood-integracion-20261108 ps
docker compose -p unifood-integracion-20261108 logs --tail 50
docker compose -p unifood-integracion-20261108 stop
```

Detén ese proyecto antes de iniciar otro en los puertos 3001–3004. Los volúmenes originales `unifood_microservicios_*` no se utilizaron en las pruebas.

## 6. Ejecutar sin Docker

Se requiere Node 24 y herramientas de compilación para los módulos nativos (`python3`, `make`, `g++`). Instalar dependencias y probar:

```bash
for service in estudiantes validacion-universitaria menus pedidos; do
  (cd "services/$service" && npm ci && npm test) || exit 1
done
```

En cuatro terminales, ejecutar respectivamente:

```bash
npm --prefix services/estudiantes start
npm --prefix services/validacion-universitaria start
npm --prefix services/menus start
npm --prefix services/pedidos start
```

Los valores locales por defecto usan `localhost` para las dependencias. `PORT` y `DB_PATH` se configuran por proceso; las rutas de las bases están descritas en [arquitectura](docs/arquitectura.md). `.env.example` es una referencia: los servicios no cargan ese archivo automáticamente.

## 7. Pruebas de integración

```bash
# Cuatro procesos reales, puertos libres y bases SQLite temporales
node --test tests/integration/sistema.test.js

# Construcción, salud, flujo, caídas y reinicio de contenedores reales
UNIFOOD_INTEGRATION_MODE=docker node --test tests/integration/sistema.test.js
```

La suite usa datos ficticios, no usa las bases locales de desarrollo y crea un proyecto Docker único con puertos temporales. Detiene sus propios contenedores al terminar y conserva sus volúmenes. El override de puertos de prueba requiere Compose con soporte `!override` ([2.24.4 o posterior](https://docs.docker.com/reference/compose-file/merge/#replace-value)). Imprime la ubicación de los resultados JSON y logs; `UNIFOOD_REPORT_DIR` permite elegir su directorio.

Resultado comprobado: **24 pruebas individuales aprobadas** y **16 escenarios de integración aprobados en cada entorno** (Node informa 17 tests al contar también el contenedor de la suite).

Ver [contratos y endpoints](docs/contratos-api.md), [informe de integración final](docs/integracion-final.md) y [evidencias](docs/evidencias-integracion.json). La pipeline modificada ejecutará también la integración; su ejecución remota está pendiente de un PR autorizado. `npm audit` de Pedidos reporta siete vulnerabilidades pendientes en la cadena de `sqlite3`; el informe detalla su alcance.



