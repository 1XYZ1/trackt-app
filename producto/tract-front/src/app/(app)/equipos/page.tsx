import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function EquiposPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
        <p className="text-muted-foreground">
          Gestión de la flota: maquinaria registrada, estado y operadores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Tabla de equipos con búsqueda, filtros y formulario de alta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta página se conectará a Supabase para listar equipos reales.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
