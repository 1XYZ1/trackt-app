'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const data = [
  { name: 'Ene', total: 4 },
  { name: 'Feb', total: 7 },
  { name: 'Mar', total: 5 },
  { name: 'Abr', total: 9 },
  { name: 'May', total: 6 },
  { name: 'Jun', total: 8 },
  { name: 'Jul', total: 11 },
  { name: 'Ago', total: 7 },
  { name: 'Sep', total: 9 },
  { name: 'Oct', total: 12 },
  { name: 'Nov', total: 8 },
  { name: 'Dic', total: 10 },
];

export function OverviewChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="currentColor"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          stroke="currentColor"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
          tickFormatter={(v) => `${v}`}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
