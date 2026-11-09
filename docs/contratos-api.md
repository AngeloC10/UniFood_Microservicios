# Contratos acordados para UniFood

## Acuerdos generales

- APIs HTTP, JSON, host `0.0.0.0`, un puerto por servicio.
- Todos exponen `GET /health` con `200 {"status":"ok"}`.
- Errores: `{"error":"CODIGO","message":"Mensaje"}`.
- Códigos habituales: 400 datos inválidos, 403 estudiante no aprobado, 404 no encontrado, 409 conflicto, 503 dependencia caída.
- Cada microservicio administra su propia SQLite; sin acceso directo a otras bases.

## Estudiantes — 3001 (Jose)

- `POST /estudiantes`: recibe `nombres`, `apellidos`, `universidad`, `codigoUniversitario`; devuelve `201` con `id`.
- `GET /estudiantes/:id`: devuelve `200` con estudiante o `404`.

## Validación universitaria — 3002 (Nahun)

- `POST /validaciones`: recibe `estudianteId`, `numeroCarne`, `fechaVencimiento`, revisa existencia del estudiante y crea estado `PENDIENTE`.
- `GET /validaciones/estudiantes/:estudianteId`: devuelve la validación reciente y su `estado`.
- `PATCH /validaciones/:id`: recibe `{"estado":"APROBADO"}` o `{"estado":"RECHAZADO"}`.
- Validación manual; no hay conexión con SUNEDU ni almacenamiento de imágenes del carné.

## Menús — 3003 (Axel)

- `POST /menus`: recibe `nombre`, `descripcion`, `precio`, `cupos`, `fecha`; devuelve `201`.
- `GET /menus?fecha=AAAA-MM-DD`: devuelve lista para esa fecha.
- `GET /menus/:id`: devuelve el menú o `404`.
- `POST /menus/:id/reservar-cupo`: descuenta **un cupo de forma atómica** o `409` si se agota.
- `POST /menus/:id/devolver-cupo`: compensa un descuento cuando falle el guardado del pedido.

## Pedidos — 3004 (Alexander)

- `POST /pedidos`: recibe `estudianteId`, `menuId`; consulta estudiante y validación aprobada, reserva cupo y guarda pedido con estado `PENDIENTE`.
- `GET /pedidos/:id`: devuelve pedido o `404`.
- `PATCH /pedidos/:id`: permite `PENDIENTE` -> `LISTO` -> `ENTREGADO`.
- Respuestas de rechazo: `403` sin aprobación, `404` si falta estudiante/menú, `409` sin cupo, `503` si una dependencia falla.

## Estado comprobado de la implementación

Las rutas anteriores están implementadas. Se conservaron los nombres de campos, rutas y estados acordados. La integración final usa estos contratos para probar HTTP real, sin sustituir las dependencias por respuestas simuladas.

- Estudiantes devuelve en registro y consulta `id`, `nombres`, `apellidos`, `universidad`, `codigoUniversitario`. Rechaza códigos duplicados con 409 y recorta espacios de los campos.
- Validación devuelve `id`, `estudianteId`, `numeroCarne`, `fechaVencimiento`, `estado`. La consulta por estudiante devuelve la solicitud con mayor `id`; si no existe, 404. La aprobación es manual e interna. Se comprueba que la fecha sea una fecha de calendario válida; no hay una política automática de caducidad implementada.
- Menús exige `descripcion` no vacía, precio numérico positivo, cupos enteros no negativos y fecha válida. POST devuelve `201 {"id":1}`; GET devuelve los campos del menú. GET `/menus` también funciona sin filtro. Reservar/devolver devuelve `200` con `message`, `id`, `cupos`. Un identificador inválido devuelve 400; uno inexistente, 404.
- Pedidos exige `estudianteId` y `menuId` como enteros positivos JSON. POST devuelve `id`, `estudianteId`, `menuId`, `estado`. GET incluye además `created_at`; PATCH devuelve `id`, `estado`. Una transición no permitida devuelve 400; si el estado cambió entre lectura y escritura, 409. La validación ausente, pendiente o rechazada produce 403.
- Si falla el INSERT del pedido se intenta devolver el cupo y se responde 500. Un fallo en esa devolución se registra en los logs; no hay reintento automático.

## Diferencias y límites conservados

Los textos de `error` no son uniformes entre servicios: Estudiantes usa `CAMPOS_INVALIDOS`/`CODIGO_DUPLICADO`, Validación y Menús usan códigos propios, y Pedidos usa `VAL_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `SERVICE_UNAVAILABLE` y `DB_ERROR`. El contrato común fija la forma `{error,message}` y el estado HTTP, no un catálogo único. No se renombraron estos códigos.

Estudiantes devuelve 404 para un ID inválido; Menús y Validación devuelven 400. No se homogeneizó ese comportamiento. Los cuerpos JSON mal formados de las rutas comprobadas devuelven 400 JSON. Las rutas desconocidas siguen usando el 404 HTML por defecto de Express; esa diferencia frente al acuerdo general de errores JSON queda pendiente. Validación solo trata explícitamente JSON mal formado; otros errores del parser, como exceder su tamaño máximo, no se verificaron en la integración.

El README inicial mencionaba actualizar datos del estudiante, pero no existe ese endpoint ni forma parte de las rutas acordadas arriba. No se añadió durante la integración. No hay rutas de listado de estudiantes/pedidos, autenticación o interfaz web en este repositorio.
