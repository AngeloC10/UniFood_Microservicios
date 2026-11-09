# Informe de integración final de UniFood

Responsable: Angelo Ccama Condori, líder del proyecto. Curso Cloud Computing, Universidad Continental. Revisión del 8 de noviembre de 2026, zona America/Lima; algunas evidencias usan UTC del 9 de noviembre.

`FUNCIONA`: comprobación ejecutada satisfactoriamente. `FALLA`: comprobación con resultado negativo. `NO VERIFICADO`: fuera de la evidencia obtenida o pendiente de ejecución.

## 1. Git y alcance

- Árbol limpio al comenzar; no había bases SQLite locales. No se descartaron cambios.
- La rama `fix/integracion-final-unifood` ya existía y estaba activa. Se trabajó en ella sin modificar `main`.
- Único remoto: `origin`, `https://github.com/AngeloC10/UniFood_Microservicios.git`. GitHub confirmó `fork: false`; es el repositorio principal. No hay otro remoto configurado como fork personal.
- `git fetch origin` ejecutado. `main...origin/main`: cero commits de diferencia en ambos sentidos, en `d98571c5d89c43105ed22adc7a117a11b68a20af` al comenzar.
- Se conservaron rutas, estados, esquemas SQLite, nombres de integrantes y responsabilidades. No se regeneraron servicios ni se eliminaron archivos de compañeros.
- No se realizaron commits, push, merges ni publicación de PR.

## 2. Estado y versiones de los cuatro servicios

| Servicio | Estado funcional | Puerto | Express declarado → instalado | Persistencia verificada |
|---|---|---|---|---|
| Estudiantes | FUNCIONA | 3001 | `^5.1.0` → 5.3.0 | `node:sqlite`, motor 3.53.4 |
| Validación universitaria | FUNCIONA | 3002 | `^5.1.0` → 5.3.0 | `node:sqlite`, motor 3.53.4 |
| Menús | FUNCIONA | 3003 | `^5.1.0` → 5.3.0 | `better-sqlite3` 13.0.3, motor 3.53.4 |
| Pedidos | FUNCIONA | 3004 | `^4.21.2` → 4.22.3 | `sqlite3` 5.1.7, motor 3.44.2 |

Las versiones instaladas coinciden con los lockfiles; no se uniformó Express entre servicios. `npm ls --depth=0` no informó dependencias faltantes. Pedidos también instala `cors` 2.8.6 y `dotenv` 16.6.1; `dotenv` está declarado pero no se invoca.

| Componente | Versión comprobada |
|---|---|
| Node en WSL | 24.21.0 |
| npm en WSL | 11.19.0 |
| Node en los cuatro contenedores | 24.22.2 |
| npm en los cuatro contenedores | 11.19.1 |
| Docker Engine | 29.8.2 |
| Docker Compose | 5.5.1 |
| Lockfiles | formato 3 |

`.nvmrc` fija la rama 24 y los cuatro `engines` son `>=24 <25`; se añadió la restricción faltante en Pedidos. Los Dockerfiles usan `node:24-alpine`, cuyo patch puede variar al volver a construir. La versión `process.versions.sqlite` indica el motor nativo de Node, no el usado por `sqlite3`; los motores de Menús y Pedidos se consultaron directamente mediante SQL.

## 3. Pruebas individuales e instalación

| Servicio | Suite original | Suite final | Resultado |
|---|---|---|---|
| Estudiantes | 6/6 | 6/6 | FUNCIONA |
| Validación | 9/9 | 9/9 | FUNCIONA |
| Menús | 1/1 | 1/1 | FUNCIONA |
| Pedidos | 7/7 | 8/8 | FUNCIONA |
| Total | 23/23 | 24/24 | FUNCIONA |

Se ejecutó `npm ci` en cada servicio. Estudiantes y Validación instalaron directamente; Menús y Pedidos requirieron permiso de red después de `EAI_AGAIN` dentro del sandbox. Las primeras pruebas HTTP dentro del sandbox fallaron con `listen EPERM`; se repitieron fuera de esa restricción y pasaron. Esos fallos del entorno no se clasificaron como errores del código.

La prueba original de Menús solo comprueba salud; su funcionalidad de negocio quedó cubierta por la nueva integración. Las pruebas originales de Validación incluyen respuestas de dependencias inyectadas: sus 9 aprobaciones no prueban por sí solas la comunicación real. La suite nueva sí usa los cuatro servicios reales.

Pedidos se comprobó de nuevo tras `npm ci` y con dos ejecuciones consecutivas de `npm test`, ambas 8/8. Su nueva prueba lanza ocho PATCH concurrentes y exige exactamente una transición aceptada. Las pruebas ya no usan el puerto fijo 3004 ni la base de desarrollo. El pequeño archivo creado por la suite original durante el diagnóstico se conservó en `/tmp/unifood-integracion-JPoCQO/pedidos-pruebas-originales.sqlite`.

## 4. Pruebas de integración reales

Se ejecutó `tests/integration/sistema.test.js` con cuatro procesos Node y después con cuatro contenedores construidos desde este repositorio. No hay mocks de las API en esta suite. Todos los registros son ficticios y se crean en bases nuevas aisladas.

| Caso solicitado | Aserción principal | Procesos Node | Docker |
|---|---|---|---|
| 1. Registrar estudiante | 201 y rechazo de duplicado 409 | FUNCIONA | FUNCIONA |
| 2. Solicitar validación | 201, estudiante correcto, PENDIENTE | FUNCIONA | FUNCIONA |
| 3. Reservar pendiente | 403 y cupos sin cambio | FUNCIONA | FUNCIONA |
| 4. Aprobar y reservar | APROBADO, pedido 201/PENDIENTE | FUNCIONA | FUNCIONA |
| 5. Menú sin cupos | 409 y stock cero | FUNCIONA | FUNCIONA |
| 6. Descontar un cupo | disponibilidad 3 → 2 → 1 con dos pedidos | FUNCIONA | FUNCIONA |
| 7. Consultar/cambiar pedido | PENDIENTE → LISTO → ENTREGADO; saltos/regresiones 400 | FUNCIONA | FUNCIONA |
| 8. Estudiante inexistente | 404 en Estudiantes, Validación y Pedidos | FUNCIONA | FUNCIONA |
| 9. Dependencia caída | detener de verdad cada dependencia y obtener 503 | FUNCIONA | FUNCIONA |
| 10. Persistencia | reiniciar cuatro servicios; conservar estudiante, validación, menú y pedido | FUNCIONA | FUNCIONA |

También pasaron seis escenarios adicionales: salud de los cuatro servicios; registro/listado/disponibilidad de menús; payloads inválidos y JSON mal formado; devolución del cupo ante fallo real de INSERT inducido con un trigger exclusivamente en la base de prueba; cinco pedidos simultáneos por un cupo con resultados `[201,409,409,409,409]`; y rechazo por la solicitud más reciente en estado RECHAZADO.

Resultado por entorno: **16 escenarios aprobados**, cero fallos. El ejecutor Node informa **17 tests** porque incluye el test contenedor. Duración observada: aproximadamente 3,4 segundos en procesos y 118,3 segundos en Docker, incluida construcción, paradas y reinicio.

## 5. Docker Compose

**FUNCIONA:** `docker compose config -q`, construcción de las cuatro imágenes, arranque, comunicación DNS por nombre de servicio, salud, dependencias `service_healthy`, volúmenes y persistencia tras reinicio.

La suite Docker creó `unifood-test-1794188675763-4113`, con puertos temporales y volúmenes propios. Terminó deteniendo exclusivamente sus contenedores; conservó sus volúmenes. La captura de `ps` de esa suite se tomó inmediatamente tras el reinicio, cuando algunos healthchecks aún indicaban `starting`; las comprobaciones HTTP ya respondían correctamente.

Al finalizar se reconstruyó y dejó ejecutándose **`unifood-integracion-20261108` en los puertos 3001–3004**. `up --build -d --wait` finalizó correctamente y una consulta posterior mostró los cuatro contenedores **healthy**. Los cuatro `/health` respondieron `{"status":"ok"}` desde WSL. No hubo errores de arranque en sus logs.

Los volúmenes originales `unifood_microservicios_estudiantes_data`, `unifood_microservicios_validaciones_data`, `unifood_microservicios_menus_data` y `unifood_microservicios_pedidos_data` no se montaron ni modificaron durante las pruebas. No se eliminaron volúmenes ni bases existentes. El comportamiento con los datos históricos de esos volúmenes queda **NO VERIFICADO**.

## 6. GitHub Actions

- **FUNCIONA en GitHub para el código previo:** se consultó la [ejecución 42543613435](https://github.com/AngeloC10/UniFood_Microservicios/actions/runs/42543613435), exitosa para `d98571c5d89c43105ed22adc7a117a11b68a20af`. Sus tareas instalaron/probaron servicios, validaron Compose y construyeron imágenes. No ejecutaron la integración de negocio.
- **FUNCIONA localmente:** el YAML se pudo parsear; se comprobaron triggers de PR hacia `main`, push a `main`, permisos de lectura y pasos. Los comandos de pruebas y construcción/integración se ejecutaron realmente en WSL.
- **NO VERIFICADO en GitHub:** la versión modificada de la pipeline. Requiere un commit/PR autorizado; no se despachó una ejecución remota.

Se conserva `actions/checkout@v6` y `actions/setup-node@v7`; sus repositorios oficiales documentan esas versiones ([checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node)). La pipeline ahora obtiene Node de `.nvmrc`, limita el job a 15 minutos, ejecuta ambas integraciones y muestra resultados/logs incluso tras fallar. Los errores de los comandos hacen fallar el job; no hay `continue-on-error`.

## 7. Problemas detectados y correcciones

| Problema observado en el código integrado | Cambio mínimo realizado |
|---|---|
| Documentación aún describía un esqueleto con solo health | README, arquitectura y contratos reflejan las API reales y sus límites |
| Pedidos tenía app real y app de salud separadas | `src/app.js` delega en la app real de `index.js`; se conserva la lógica existente |
| Importar Pedidos abría el puerto fijo automáticamente | Se exporta la app, se inicia solo como entrada principal y se espera `app.ready` |
| Tests de Pedidos escribían en SQLite de desarrollo y usaban sleep | SQLite temporal, puerto libre, espera de inicialización y cierre explícito |
| Menús health podía crear una base local | Base en memoria para ese test |
| IDs de Pedidos aceptaban valores truthy sin comprobar enteros | Validación de enteros positivos antes de llamar dependencias |
| Cuerpos ausentes y JSON inválido podían devolver errores HTML/500 | Guardas de body y manejo JSON de errores del parser en Estudiantes, Menús y Pedidos |
| Validación aceptaba fechas normalizadas, como febrero 30 | Comprobación contra la fecha ISO de calendario |
| Fetch interno no tenía límite explícito | Timeout de tres segundos en Pedidos y Validación |
| Devolución fallida del cupo se silenciaba | Registro explícito de fallo HTTP o de conexión durante compensación |
| Dos PATCH podían usar el mismo estado leído | UPDATE condicionado por estado previo; prueba concurrente |
| Pedidos usaba `npm install` en Docker y no declaraba engine | `npm ci --omit=dev`, herramientas de compilación y engine Node 24 |
| Compose no esperaba disponibilidad de dependencias | Healthchecks y `condition: service_healthy` |
| CI solo construía imágenes, sin arrancar el sistema | Integración real con procesos y Docker |

## 8. Archivos modificados o añadidos

```text
.env.example
.github/workflows/ci.yml
README.md
docker-compose.yml
docs/arquitectura.md
docs/contratos-api.md
docs/integracion-final.md                 (nuevo)
docs/evidencias-integracion.json          (nuevo)
services/estudiantes/src/app.js
services/menus/src/app.js
services/menus/tests/health.test.js
services/pedidos/Dockerfile
services/pedidos/index.js
services/pedidos/package.json
services/pedidos/package-lock.json
services/pedidos/src/app.js
services/pedidos/src/index.js
services/pedidos/tests/health.test.js
services/pedidos/tests/pedidos.test.js
services/validacion-universitaria/src/app.js
services/validacion-universitaria/src/index.js
tests/integration/sistema.test.js         (nuevo)
```

## 9. Pendientes y límites

- **FALLA — auditoría de dependencias de Pedidos:** `npm audit --json` terminó con código 1 y reportó siete paquetes afectados: dos de severidad baja, cuatro alta y uno crítica. La cadena incluye `sqlite3`, `node-gyp`, `make-fetch-happen`, `cacache`, `http-proxy-agent`, `@tootallnate/once` y `tar`. npm propone `sqlite3` 6.0.1 con cambio mayor. Requiere revisar esa actualización en un cambio separado; no se ejecutó `npm audit fix --force`. Esto no impidió arrancar ni pasar la integración.
- **FALLA respecto al acuerdo general de errores JSON:** rutas inexistentes devuelven 404 `text/html` en los cuatro servicios. Se comprobó `/ruta-inexistente`; los errores de negocio de las rutas del flujo sí tienen JSON.
- **NO VERIFICADO:** ejecución remota de la pipeline modificada, datos históricos, parser con cuerpos sobredimensionados, pruebas prolongadas de carga y dependencias que responden parcialmente o quedan colgadas. El timeout está configurado; el escenario de caída probado fue detener la dependencia.
- La actualización de estudiantes anunciada en el README inicial no está implementada. No se agregó porque no forma parte del contrato ni del flujo solicitado.
- No hay reconciliación automática si también falla la devolución del cupo, ni idempotencia para reintentos o transacción distribuida. La prueba acredita compensación por fallo de INSERT con Menús disponible. Una garantía mayor requeriría acordar lógica adicional con el responsable; no se cambió la arquitectura.

## 10. Comandos de ejecución y verificación

Administrar el sistema que quedó ejecutándose, desde la raíz:

```bash
docker compose -p unifood-integracion-20261108 config -q
docker compose -p unifood-integracion-20261108 up --build -d --wait --wait-timeout 120
docker compose -p unifood-integracion-20261108 ps
docker compose -p unifood-integracion-20261108 logs --tail 50
for port in 3001 3002 3003 3004; do
  curl --fail "http://localhost:$port/health"
done
```

Para usar el proyecto habitual con sus volúmenes existentes, primero liberar los puertos y después iniciar:

```bash
docker compose -p unifood-integracion-20261108 stop
docker compose config -q
docker compose up --build -d --wait --wait-timeout 120
docker compose ps
```

Pruebas reproducibles:

```bash
for service in estudiantes validacion-universitaria menus pedidos; do
  (cd "services/$service" && npm ci && npm test) || exit 1
done
node --test tests/integration/sistema.test.js
UNIFOOD_INTEGRATION_MODE=docker node --test tests/integration/sistema.test.js
```

El modo Docker usa `!override` para los puertos; requiere Compose 2.24.4 o posterior. La ejecución se verificó con 5.5.1. No necesita detener un sistema existente porque usa puertos libres. No ejecutar comandos que borren volúmenes para reiniciar el sistema.

## 11. Evidencias conservadas

- [evidencias-integracion.json](evidencias-integracion.json): resultados generados por la suite y resumen de comprobaciones reales.
- `/tmp/unifood-integracion-JPoCQO`: resultados y logs de procesos Node.
- `/tmp/unifood-integracion-chGnMZ`: resultados, construcción, logs, versiones y capturas de Docker. `estado-final-compose.json` corresponde al proyecto final en puertos oficiales.
- Los directorios de `/tmp` son evidencia local temporal. El JSON dentro de `docs` conserva los resultados para revisión; no contiene bases ni datos reales.

## 12. Preparación para Pull Request

Rama: `fix/integracion-final-unifood`. Cambios presentes en el árbol de trabajo, sin staging, commit ni push.

Título sugerido: **fix: verificar integración UniFood y corregir arranque, pruebas y Compose**.

Descripción sugerida:

> La integración anterior comprobaba pruebas individuales y construcción, pero no el flujo completo entre servicios. Se añade una suite reproducible con HTTP y SQLite reales para procesos Node y Docker, incluidos rechazos, cupos concurrentes, compensación y persistencia. Se corrigen el aislamiento de pruebas y el arranque de Pedidos, validación de payloads/fechas, tiempos de espera y healthchecks, conservando las API y bases existentes.
>
> Validación local: 24 pruebas individuales aprobadas; 16 escenarios de integración aprobados por entorno; Compose válido y cuatro contenedores healthy en 3001–3004. La pipeline se amplía para ejecutar esos escenarios. Su ejecución remota está pendiente. Se documentan las vulnerabilidades de la cadena sqlite3 y los límites restantes.
