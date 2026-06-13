import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Mapea errores conocidos de Prisma a códigos HTTP correctos en vez de dejarlos
 * escapar como 500. Cubre la ventana TOCTOU típica (findFirst -> update) donde
 * el registro desaparece o choca con una restricción única entre la lectura y
 * la escritura.
 *
 * - P2025 (registro no encontrado)     -> 404
 * - P2002 (violación de unique)        -> 409
 * - P2003 (violación de foreign key)   -> 400
 *
 * Cualquier otro error se delega al filtro base de Nest (500 por defecto).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    let mapped: HttpException | undefined;

    switch (exception.code) {
      case 'P2025':
        mapped = new NotFoundException('Recurso no encontrado');
        break;
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        mapped = new ConflictException(
          target
            ? `Ya existe un registro con ese valor (${target})`
            : 'Conflicto: el registro ya existe',
        );
        break;
      }
      case 'P2003':
        mapped = new BadRequestException('Referencia inválida');
        break;
    }

    if (mapped) {
      return super.catch(mapped, host);
    }

    this.logger.error(
      `Prisma error no mapeado (${exception.code}): ${exception.message}`,
    );
    return super.catch(exception, host);
  }
}
