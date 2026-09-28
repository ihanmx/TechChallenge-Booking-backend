import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const description = `
Book fixed appointment slots. JSON request/response bodies, UUID string IDs, ISO 8601 UTC timestamps.

**Authentication:** none. All endpoints are public; no API keys, tokens or cookies are required.

**Errors** always use this shape (codes are listed per endpoint):
\`{"error":{"code":"SLOT_UNAVAILABLE","message":"This slot already has an active booking."}}\`

**Real-time:** Socket.IO on the same server (namespace \`/\`, path \`/socket.io\`) broadcasts
\`slot.booked\` and \`slot.released\`. See the README - they are not HTTP operations.
`.trim();

// Swagger UI at /docs, raw OpenAPI document at /openapi.json.
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Appointment Booking API')
    .setDescription(description)
    .setVersion('1.0.0')
    .addServer('/', 'This server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.security = []; // explicit: no authentication on any operation

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });
}
