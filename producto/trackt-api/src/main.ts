import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Habilita validación y transformación automática de DTOs.
  // whitelist: true  → elimina propiedades no declaradas en el DTO
  // transform: true  → convierte query params a los tipos declarados (ej. "1" → 1)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // no rechazar params extra (más permisivo en dev)
    }),
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
