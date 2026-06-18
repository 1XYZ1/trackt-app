"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventoCalendario } from "@/lib/api/programaciones";
import { cn } from "@/lib/utils";
import { ESTADO_CHIP_CLASS } from "./programacion-badges";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export type CalendarioMesProps = {
  year: number;
  month: number; // 0-11
  events: EventoCalendario[];
  onPrev: () => void;
  onNext: () => void;
  onSelectEvent: (eventId: string) => void;
};

export function CalendarioMes({
  events,
  month,
  onNext,
  onPrev,
  onSelectEvent,
  year,
}: CalendarioMesProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lunes primero: (getDay()+6)%7.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  // Agrupar eventos por día del mes.
  const byDay = new Map<number, EventoCalendario[]>();
  for (const ev of events) {
    const d = new Date(ev.start);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const list = byDay.get(day) ?? [];
      list.push(ev);
      byDay.set(day, list);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          {MESES[month]} {year}
        </h2>
        <div className="flex gap-1">
          <Button onClick={onPrev} size="icon" variant="outline">
            <ChevronLeft />
          </Button>
          <Button onClick={onNext} size="icon" variant="outline">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {DIAS.map((dia) => (
          <div
            className="bg-secondary/40 px-2 py-1.5 text-center font-medium text-[11px] text-muted-foreground uppercase"
            key={dia}
          >
            {dia}
          </div>
        ))}
        {cells.map((day, idx) => (
          <div
            className="min-h-24 bg-background p-1.5"
            key={day === null ? `blank-${idx}` : `day-${day}`}
          >
            {day !== null && (
              <>
                <div className="mb-1 text-right text-muted-foreground text-xs">
                  {day}
                </div>
                <div className="space-y-1">
                  {(byDay.get(day) ?? []).map((ev) => (
                    <button
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80",
                        ESTADO_CHIP_CLASS[ev.estado],
                      )}
                      key={ev.id}
                      onClick={() => onSelectEvent(ev.id)}
                      title={`${ev.title} — ${ev.equipo.codigo}`}
                      type="button"
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
