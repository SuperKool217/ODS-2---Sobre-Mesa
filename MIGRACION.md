# Información de instalación y migración de Sobre-Mesa

Esta versión utiliza Node.js, Express, PostgreSQL y PayU Latam WebCheckout en Sandbox. La confirmación del pago se procesa en el backend mediante la notificación de PayU; el retorno del navegador no modifica por sí solo el estado financiero.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL.
- npm.

## Instalación local

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` a `.env`.
3. Configura `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET` y las variables `PAYU_*`.
4. Usa secretos JWT y QR diferentes, de al menos 32 caracteres.
5. Ejecuta `npm run db:migrate` para crear las tablas.
6. Ejecuta `npm run db:seed` para cargar los datos de demostración.
7. Inicia el servidor con `npm run dev`.

No subas archivos `.env`, contraseñas, cadenas de conexión reales ni secretos privados a GitHub.

## Base de datos

El esquema está definido en `db/schema.sql`. El comando `npm run db:migrate` aplica ese archivo. Si ya existe una base con información que deba conservarse, crea primero un respaldo y revisa las diferencias antes de aplicar cambios.

## PayU Latam Sandbox

El proyecto utiliza WebCheckout en el entorno de pruebas:

- Checkout: [https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/](https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/)
- URL de confirmación: `https://cerohambre-web.onrender.com/api/pagos/payu/confirmacion`
- URL de respuesta: `https://cerohambre-web.onrender.com/pago-resultado.html`

Las credenciales compartidas de prueba publicadas por PayU solo sirven para Sandbox. No son credenciales de producción. La firma del formulario y la firma de la notificación se calculan y validan por separado en el backend.

El endpoint de confirmación requiere una URL pública HTTPS para recibir notificaciones de PayU. En una instalación local, las pruebas unitarias pueden ejecutarse sin exponer el servidor a Internet.

## Despliegue

La aplicación está desplegada en [https://cerohambre-web.onrender.com](https://cerohambre-web.onrender.com). El archivo `render.yaml` contiene la configuración del servicio web y PostgreSQL.

La marca pública de la plataforma es Sobre-Mesa. El subdominio actual conserva el nombre técnico anterior para mantener funcionando los enlaces de confirmación y retorno.

En Render, mantén como variables privadas los secretos `JWT_SECRET`, `QR_SECRET` y `DEMO_ORG_PASSWORD`. No sustituyas las credenciales de Sandbox por credenciales reales para las pruebas académicas.

## Pruebas

```bash
npm test
```

## Alcance del entorno

Esta versión está configurada para pruebas de pago en PayU Sandbox. No está habilitada para procesar pagos reales. No almacena números de tarjeta ni códigos de seguridad.
