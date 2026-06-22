"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  /** Fecha en formato "YYYY-MM-DD" (o "" para vacío). */
  value?: string;
  /** Recibe "YYYY-MM-DD"; "" cuando se limpia. */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Límite inferior inclusivo "YYYY-MM-DD". */
  min?: string;
  /** Límite superior inclusivo "YYYY-MM-DD". */
  max?: string;
  className?: string;
  "aria-invalid"?: boolean;
};

// "YYYY-MM-DD" -> Date local (medianoche local). `new Date("YYYY-MM-DD")` parsea
// como UTC y desfasa un día en zonas de offset negativo (Chile), por eso se
// construye por partes.
function parseLocalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return undefined;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Date -> "YYYY-MM-DD" con getters locales (no `toISOString`, que es UTC).
function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

const DISPLAY_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

/**
 * Selector de fecha estilizado (Popover + Calendar) que reemplaza al
 * `<input type="date">` nativo. Controlado por string "YYYY-MM-DD" para calzar
 * con los contratos existentes (forms y filtros). Timezone-safe.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  id,
  min,
  max,
  className,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);
  const minDate = parseLocalDate(min);
  const maxDate = parseLocalDate(max);

  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !selected && "text-muted-foreground",
              ariaInvalid && "border-destructive/60",
              className,
            )}
            disabled={disabled}
            id={id}
            variant="outline"
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 opacity-70" />
        <span className="min-w-0 truncate text-left">
          {selected
            ? selected.toLocaleDateString("es-CL", DISPLAY_OPTS)
            : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <Calendar
          autoFocus
          captionLayout="dropdown"
          defaultMonth={selected ?? maxDate}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          endMonth={maxDate}
          locale={es}
          mode="single"
          onSelect={(date: Date | undefined) => {
            onChange(date ? formatISODate(date) : "");
            setOpen(false);
          }}
          selected={selected}
          startMonth={minDate}
        />
        {selected && (
          <div className="flex justify-end border-border border-t pt-2">
            <Button
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              size="sm"
              variant="ghost"
            >
              Limpiar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
