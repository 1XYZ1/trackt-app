-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrdenTrabajoEstado" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'CERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TicketEstado" AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_EJECUCION', 'EJECUTADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "NotificacionTipo" AS ENUM ('TICKET_ASIGNADO', 'TICKET_INICIADO', 'TICKET_FINALIZADO', 'TICKET_VALIDADO', 'TICKET_RECHAZADO', 'TICKET_CERRADO', 'OT_CREADA', 'OT_CERRADA');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "ubicacion" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "equipo_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "estado" "OrdenTrabajoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "creado_por_id" TEXT NOT NULL,
    "metadata" JSONB,
    "fecha_cierre" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ot_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "TicketEstado" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "mecanico_id" TEXT,
    "jefe_id" TEXT,
    "metadata" JSONB,
    "fecha_asignacion" TIMESTAMP(3),
    "fecha_inicio_ejecucion" TIMESTAMP(3),
    "fecha_fin_ejecucion" TIMESTAMP(3),
    "fecha_validacion" TIMESTAMP(3),
    "fecha_cierre" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_estado_ticket" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "estado_anterior" "TicketEstado",
    "estado_nuevo" "TicketEstado" NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "observacion" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_estado_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "descripcion" TEXT,
    "subido_por_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "NotificacionTipo" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipos_tenant_id_idx" ON "equipos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_tenant_id_codigo_key" ON "equipos"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_tenant_id_estado_idx" ON "ordenes_trabajo"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_equipo_id_idx" ON "ordenes_trabajo"("equipo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_tenant_id_codigo_key" ON "ordenes_trabajo"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_estado_idx" ON "tickets"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "tickets_ot_id_idx" ON "tickets"("ot_id");

-- CreateIndex
CREATE INDEX "tickets_mecanico_id_idx" ON "tickets"("mecanico_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_tenant_id_codigo_key" ON "tickets"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "eventos_estado_ticket_ticket_id_created_at_idx" ON "eventos_estado_ticket"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "evidencias_ticket_id_idx" ON "evidencias"("ticket_id");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_idx" ON "notificaciones"("usuario_id", "leida");

-- CreateIndex
CREATE INDEX "notificaciones_tenant_id_idx" ON "notificaciones"("tenant_id");

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ot_id_fkey" FOREIGN KEY ("ot_id") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_estado_ticket" ADD CONSTRAINT "eventos_estado_ticket_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

