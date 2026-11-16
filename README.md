# CeroHambre — ODS 2: Hambre Cero

CeroHambre es una plataforma académica orientada a apoyar iniciativas de seguridad alimentaria mediante campañas, donaciones y seguimiento verificable de entregas.

**Aplicación desplegada:** [https://cerohambre-web.onrender.com](https://cerohambre-web.onrender.com)

> La integración de pagos está configurada exclusivamente para PayU Latam Sandbox. No procesa pagos reales.

## Tecnologías

- Node.js 22 y Express.
- PostgreSQL.
- HTML, CSS y JavaScript.
- PayU Latam WebCheckout en Sandbox.
- JSON Web Tokens para sesiones y códigos QR firmados.
- Cámara, geolocalización y fotografía de evidencia desde el navegador.
- Render para el despliegue con HTTPS.

## Funcionalidades

1. Registro e inicio de sesión para donantes y organizaciones.
2. Publicación y consulta de campañas alimentarias.
3. Creación de donaciones y redirección al checkout de PayU Sandbox.
4. Confirmación de pagos mediante notificaciones servidor a servidor validadas en el backend.
5. Solicitud, aceptación y seguimiento de entregas.
6. Generación de códigos QR dinámicos con tokens firmados y vigencia limitada.
7. Confirmación de entrega desde el teléfono del donante, con ubicación y fotografía.
8. Historial de eventos para consultar la trazabilidad de las donaciones.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL.
- npm.
- Para probar el flujo QR: un navegador móvil con permisos de cámara y ubicación.
- Para recibir notificaciones de PayU: una URL pública HTTPS.

## Instalación local

Clona el repositorio e instala las dependencias:

```bash
npm install
```

Crea el archivo de variables de entorno:

```bash
cp .env.example .env
```

Edita `.env` y configura `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET` y las variables `PAYU_*`. Los secretos `JWT_SECRET` y `QR_SECRET` deben ser diferentes y tener al menos 32 caracteres. No reutilices los valores de ejemplo en un entorno real.

Prepara la base de datos y ejecuta la aplicación:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Aplicación desplegada

La versión alojada en Render está disponible en:

[https://cerohambre-web.onrender.com](https://cerohambre-web.onrender.com)

La comprobación de estado del servidor está disponible en [https://cerohambre-web.onrender.com/api/health](https://cerohambre-web.onrender.com/api/health).

## Integración de PayU Latam Sandbox

La aplicación utiliza WebCheckout. El backend crea una referencia de pago y calcula la firma; el navegador envía el formulario al checkout de pruebas de PayU.

### Configuración de pruebas para Colombia

| Variable | Valor de prueba |
|---|---|
| `PAYU_ENVIRONMENT` | `sandbox` |
| `PAYU_MERCHANT_ID` | `508029` |
| `PAYU_ACCOUNT_ID` | `512321` |
| `PAYU_API_KEY` | Clave compartida de pruebas publicada por PayU |
| `PAYU_SIGNATURE_ALGORITHM` | `SHA256` |
| `PAYU_CONFIRMATION_SIGNATURE_ALGORITHM` | `MD5` |

Los valores de prueba compartidos por PayU sirven únicamente para Sandbox. No deben confundirse con las credenciales privadas de un comercio ni utilizarse para pagos reales.

- Checkout Sandbox: [https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/](https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/)
- Notificación de confirmación: `https://cerohambre-web.onrender.com/api/pagos/payu/confirmacion`
- Retorno del comprador: `https://cerohambre-web.onrender.com/pago-resultado.html`

El retorno del navegador no cambia por sí solo el estado del pago. La actualización se realiza cuando el backend recibe y valida la notificación de PayU.

## Variables de entorno

| Variable | Uso |
|---|---|
| `NODE_ENV` | Entorno de ejecución. |
| `PORT` | Puerto local del servidor. Render asigna el puerto en despliegue. |
| `APP_BASE_URL` | URL base pública de la aplicación. |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. |
| `JWT_SECRET` | Secreto para firmar sesiones; mínimo 32 caracteres. |
| `QR_SECRET` | Secreto independiente para firmar tokens QR; mínimo 32 caracteres. |
| `JWT_EXPIRES_IN` | Duración de la sesión. |
| `QR_TOKEN_TTL_SECONDS` | Vigencia del token QR. |
| `QR_RENEW_SECONDS` | Intervalo de renovación del QR. |
| `MAX_PHOTO_SIZE_MB` | Tamaño máximo permitido para la fotografía de evidencia. |
| `DEMO_ORG_PASSWORD` | Contraseña para crear la cuenta de demostración local. |
| `PAYU_ENVIRONMENT` | Debe ser `sandbox` en esta versión. |
| `PAYU_MERCHANT_ID` | Identificador de comercio de pruebas. |
| `PAYU_ACCOUNT_ID` | Identificador de cuenta de pruebas. |
| `PAYU_API_KEY` | Clave compartida de PayU Sandbox. |
| `PAYU_SIGNATURE_ALGORITHM` | Algoritmo de firma del formulario. |
| `PAYU_CONFIRMATION_SIGNATURE_ALGORITHM` | Algoritmo para validar la notificación de confirmación. |
| `PAYU_SIGNATURE_SECRET` | Secreto opcional si se configura una firma HMAC-SHA256 personalizada. |

## Pruebas automáticas

Ejecuta:

```bash
npm test
```

Las pruebas cubren funciones de firma, formato y conversión de valores, validación de notificaciones y traducción de estados de PayU.

## Despliegue en Render

El archivo `render.yaml` describe el servicio web y la base de datos PostgreSQL.

1. Conecta el repositorio a Render mediante un Blueprint.
2. Comprueba que el servicio utilice Node.js 22.
3. Verifica que `DATABASE_URL` apunte a la base PostgreSQL del proyecto.
4. Mantén `JWT_SECRET`, `QR_SECRET` y `DEMO_ORG_PASSWORD` como variables privadas generadas por Render.
5. Conserva `PAYU_ENVIRONMENT=sandbox` y las credenciales de prueba correspondientes.
6. Comprueba el servicio en `/api/health`.

No publiques archivos `.env`, cadenas de conexión reales, contraseñas ni secretos privados. No sustituyas las credenciales Sandbox por credenciales de producción durante las pruebas académicas.

## Estructura del proyecto

```text
src/
  app.js
  server.js
  db/
  middleware/
  routes/
  services/
  utils/
public/
  *.html
  css/
  js/
db/
  schema.sql
scripts/
test/
```

## Seguridad y alcance

- Las contraseñas de usuario se almacenan mediante hashes.
- Las sesiones se mantienen en cookies HttpOnly.
- Los tokens QR se firman y tienen vigencia limitada.
- El backend valida las notificaciones de pago antes de actualizar el estado de una donación.
- No se almacenan números de tarjeta ni códigos de seguridad.
- Los documentos y teléfonos introducidos en el formulario de pago se envían a PayU; esta versión no los persiste en PostgreSQL.
- Los secretos privados deben configurarse como variables de entorno y nunca subirse al repositorio.
- Esta versión utiliza exclusivamente el entorno Sandbox y no está habilitada para recibir pagos reales.

## Documentación oficial

- [PayU Latam — Formulario WebCheckout](https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration/payment-form.html)
- [PayU Latam — URL de Confirmación](https://developers.payulatam.com/latam/es/docs/integrations/confirmation-url.html)
- [PayU Latam — URL de Respuesta](https://developers.payulatam.com/latam/es/docs/integrations/response-url.html)
- [PayU Latam — Probar tu solución](https://developers.payulatam.com/latam/es/docs/getting-started/test-your-solution.html)
