import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MantencionesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mantenciones</h1>
        <p className="text-muted-foreground">
          Registro de mantenciones programadas, pendientes y completadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Calendario de mantenciones y formulario de programación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conexión con Supabase pendiente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
