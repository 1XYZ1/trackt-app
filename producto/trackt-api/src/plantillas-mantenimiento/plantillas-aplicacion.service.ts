import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Plantilla cargada con todo lo necesario para "aplicarla" a trabajo real:
// metadata (checklist) + items con su repuesto y stock (para la reserva).
// Lo comparten generarOt (programaciones) y la creación de OT desde plantilla.
export const PLANTILLA_APLICACION_SELECT = {
  id: true,
  nombre: true,
  metadata: true,
  items: {
    select: {
      repuestoId: true,
      cantidad: true,
      obligatorio: true,
      repuesto: {
        select: {
          codigo: true,
          nombre: true,
          unidad: true,
          stock: {
            select: { stockActual: true, stockReservado: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PlantillaMantenimientoSelect;

export type PlantillaAplicacion = Prisma.PlantillaMantenimientoGetPayload<{
  select: typeof PLANTILLA_APLICACION_SELECT;
}>;

// Item de la plantilla resuelto para la reserva (con ajustes aplicados) y
// con la ficha del repuesto para la respuesta SUGERIDA.
export interface ItemReservaResuelto {
  repuestoId: string;
  cantidad: number;
  obligatorio: boolean;
  repuesto: {
    codigo: string;
    nombre: string;
    unidad: string;
    stockDisponible: number;
  };
}

// Forma del checklist embebido en Ticket.metadata.checklist: cada paso de la
// receta (string[] en la plantilla) se materializa con su flag de avance.
export interface ChecklistPaso {
  paso: string;
  hecho: boolean;
}

/**
 * Lógica compartida para "aplicar" una plantilla de mantenimiento a trabajo
 * real (OT/ticket): resolución de insumos para la reserva y materialización
 * del checklist en el metadata del ticket.
 *
 * Una sola fuente de verdad para los dos caminos que generan trabajo desde una
 * plantilla: la generación de OT desde una programación
 * (ProgramacionesMantenimientoService.generarOt) y la creación directa de OT
 * con plantilla (OrdenesService.create con plantillaId). Así no se duplica el
 * include de items ni la resolución de ajustes.
 */
@Injectable()
export class PlantillasAplicacionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carga la plantilla del tenant con items + metadata para aplicarla. No
   * valida `activo`: el caller decide (generarOt acepta plantillas inactivas
   * ya vinculadas; la creación de OT exige activa, ver requireActiva).
   * Devuelve null si no existe o es de otro tenant.
   */
  async loadParaAplicar(
    tx: Prisma.TransactionClient,
    tenantId: string,
    plantillaId: string,
  ): Promise<PlantillaAplicacion | null> {
    return tx.plantillaMantenimiento.findFirst({
      where: { id: plantillaId, tenantId },
      select: PLANTILLA_APLICACION_SELECT,
    });
  }

  /**
   * Resuelve los insumos de la reserva: items de la plantilla con
   * ajustarItems aplicados (cantidad 0 excluye). 400 si se ajusta sin
   * plantilla o se referencia un repuesto que no está en ella.
   *
   * Extraído desde ProgramacionesMantenimientoService para reutilizarlo en la
   * creación de OT desde plantilla sin duplicar la lógica.
   */
  resolverItemsReserva(
    plantilla: Pick<PlantillaAplicacion, 'items'> | null,
    ajustes?: Array<{ repuestoId: string; cantidad: number }>,
  ): ItemReservaResuelto[] {
    if (!plantilla) {
      if (ajustes && ajustes.length > 0) {
        throw new BadRequestException(
          'ajustarItems requiere que la programación tenga plantilla',
        );
      }
      return [];
    }

    const ajustePorRepuesto = new Map(
      (ajustes ?? []).map((a) => [a.repuestoId, a.cantidad]),
    );
    const idsPlantilla = new Set(plantilla.items.map((i) => i.repuestoId));
    for (const repuestoId of ajustePorRepuesto.keys()) {
      if (!idsPlantilla.has(repuestoId)) {
        throw new BadRequestException(
          `ajustarItems referencia el repuesto "${repuestoId}" que no está en la plantilla`,
        );
      }
    }

    return plantilla.items
      .map((item) => ({
        repuestoId: item.repuestoId,
        cantidad: ajustePorRepuesto.get(item.repuestoId) ?? item.cantidad,
        obligatorio: item.obligatorio,
        repuesto: {
          codigo: item.repuesto.codigo,
          nombre: item.repuesto.nombre,
          unidad: item.repuesto.unidad,
          stockDisponible:
            (item.repuesto.stock?.stockActual ?? 0) -
            (item.repuesto.stock?.stockReservado ?? 0),
        },
      }))
      .filter((item) => item.cantidad > 0);
  }

  /**
   * Lee los pasos del checklist desde plantilla.metadata.checklist (string[],
   * mismo formato que escribe el editor de plantillas) y los materializa con
   * hecho:false para arrancar el avance en el ticket. Devuelve [] si no hay
   * checklist (o está malformado), para no inyectar metadata.checklist vacío.
   */
  buildChecklistInicial(
    metadata: Prisma.JsonValue | null | undefined,
  ): ChecklistPaso[] {
    const pasos = readChecklistPasos(metadata);
    return pasos.map((paso) => ({ paso, hecho: false }));
  }
}

/**
 * Extrae el string[] de pasos desde un metadata.checklist de forma defensiva.
 * Espeja getChecklist del frontend (lib/api/plantillas.ts): ignora entradas no
 * string y formatos inesperados.
 */
export function readChecklistPasos(
  metadata: Prisma.JsonValue | null | undefined,
): string[] {
  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    'checklist' in metadata
  ) {
    const value = (metadata as { checklist?: unknown }).checklist;
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
  }
  return [];
}
