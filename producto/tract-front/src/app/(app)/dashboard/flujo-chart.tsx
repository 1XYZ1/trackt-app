"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export type FlujoChartDatum = {
  estado: string;
  label: string;
  value: number;
  color: string;
};

type TooltipPayload = {
  payload: FlujoChartDatum;
  value: number;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md/5">
      <p className="font-medium">{datum.label}</p>
      <p className="text-muted-foreground">
        {datum.value} ticket{datum.value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Distribucion de tickets por estado del workflow. Recibe la data ya calculada
 * (no hace fetching propio) para mantener intacto el contrato de datos del
 * dashboard server-component.
 */
export function FlujoChart({ data }: { data: FlujoChartDatum[] }) {
  const allZero = data.every((d) => d.value === 0);

  if (allZero) {
    return (
      <div className="flex h-48 items-center justify-center text-center text-muted-foreground text-sm">
        Aun no hay tickets para graficar el flujo.
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          accessibilityLayer
          barCategoryGap="22%"
          data={data}
          margin={{ bottom: 0, left: 0, right: 0, top: 16 }}
        >
          <XAxis
            axisLine={false}
            dataKey="label"
            interval={0}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            tickMargin={8}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "var(--accent)", radius: 6 }}
          />
          <Bar dataKey="value" radius={[6, 6, 6, 6]}>
            <LabelList
              className="fill-foreground font-semibold"
              dataKey="value"
              fontSize={12}
              position="top"
            />
            {data.map((entry) => (
              <Cell fill={entry.color} key={entry.estado} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
