import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorDto } from './response.dto';

export function createApiDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('ProView API').setVersion('1.0').addBearerAuth().build(),
    { extraModels: [ApiErrorDto] },
  );
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = path?.[method];
      if (!operation) continue;
      for (const status of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
        operation.responses[status] ??= {
          description: 'Structured error (when applicable to this operation)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorDto' } } },
        };
      }
    }
  }
  return document;
}
