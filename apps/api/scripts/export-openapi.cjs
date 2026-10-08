require('reflect-metadata');
const { writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { loadEnvironment } = require('../dist/infrastructure/environment');
const { createApiDocument } = require('../dist/common/openapi');

// Creating the dependency graph without app.init/listen avoids database connections,
// workers and sockets. Runtime and export share the exact document factory.
(async () => {
  loadEnvironment();
  const { AppModule } = require('../dist/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  try {
    await writeFile(resolve(process.argv[2]), JSON.stringify(createApiDocument(app), null, 2));
  } finally {
    await app.close();
  }
})().catch(() => {
  console.error('OpenAPI export failed; check the built API and configuration.');
  process.exitCode = 1;
});
