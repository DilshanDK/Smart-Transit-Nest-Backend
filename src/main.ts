import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enable CORS so Flutter apps and Next.js can connect
  app.enableCors();

  // Enable global validation (DTOs will auto-reject bad requests)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip any properties not in the DTO
      forbidNonWhitelisted: true, // Throw error if extra properties are sent
      transform: true, // Auto-transform payloads to DTO instances
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 NestJS Backend running at: http://localhost:3000`);
}
bootstrap().catch((err) => {
  console.error('Failed to start server', err);
});
