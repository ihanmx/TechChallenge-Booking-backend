import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // closes DB connections on Ctrl+C / SIGTERM

  setupSwagger(app);

  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`API: http://localhost:${port}  |  Docs: http://localhost:${port}/docs`, 'Bootstrap');
}
await bootstrap();
