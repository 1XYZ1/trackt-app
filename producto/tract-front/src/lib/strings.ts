/**
 * Genera un codigo a partir del nombre, en MAYUSCULAS-CON-GUIONES y sin
 * tildes. Pensado para autocompletar el campo "codigo" de un repuesto
 * mientras se escribe el nombre.
 *
 * "Filtro de aceite 2" -> "FILTRO-DE-ACEITE-2"
 * "Bujia NGK (x4)"      -> "BUJIA-NGK-X4"
 */
export function slugCodigo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quitar diacriticos (tildes, dieresis)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-") // todo lo no alfanumerico -> guion
    .replace(/^-+|-+$/g, "") // recortar guiones de los extremos
    .slice(0, 60); // limite del schema
}
