import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Props {
  /** Ruta del listado padre (ej. "/tickets"). */
  parentHref: string;
  /** Label del listado padre (ej. "Tickets"). */
  parentLabel: string;
  /** Página actual (código o título de la entidad). */
  current: string;
}

/**
 * Breadcrumb estándar para páginas de detalle: `Padre › Actual`. El link padre
 * cumple el rol de "volver". Reemplaza los back-links manuales dispersos.
 */
export function DetailBreadcrumb({ parentHref, parentLabel, current }: Props) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={parentHref} />}>
            {parentLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
