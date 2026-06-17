import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: si CORS_ORIGINS está definido (lista separada por comas) se usa como
  // allowlist; si no, refleja cualquier origin (comportamiento previo, útil en dev).
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length ? corsOrigins : true,
  });

  const isProd = process.env.NODE_ENV === 'production';

  // Habilita validación y transformación automática de DTOs.
  // whitelist: true  → elimina propiedades no declaradas en el DTO
  // transform: true  → convierte query params a los tipos declarados (ej. "1" → 1)
  // forbidNonWhitelisted: en prod rechaza props extra (defensa); en dev permisivo.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: isProd,
    }),
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
