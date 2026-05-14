# Gitflow Trackt — Guía rápida

Flujo mínimo para trabajar en el monorepo (`producto/trackt-api` + `producto/tract-front`) con Linear conectado.

> Regla de oro: **una rama = un ticket de Linear = un PR**.

---

## 1. Ramas base

Solo dos ramas permanentes:

- `main` → producción (protegida, solo se actualiza por PR).
- `production` → espejo opcional para release controlado. Si no se usa, se elimina y queda solo `main`.

Todo lo demás son **ramas temporales**: nacen de `main`, viven el tiempo del ticket, mueren al mergear.

---

## 2. Naming de ramas (Conventional Branch + Linear)

Formato:

```
<tipo>/<LINEAR-ID>-<descripcion-corta-kebab>
```

Tipos permitidos: `feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `style`

Ejemplos:

```
feat/TRA-12-login-google
fix/TRA-45-token-expira-mal
chore/TRA-7-update-deps
docs/TRA-9-readme-api
refactor/TRA-22-extraer-auth-service
```

**Importante:** el ID de Linear (`TRA-12`) en el nombre de la rama es lo que permite a Linear asociar el trabajo al ticket automáticamente. Sin ID, no se vincula.

---

## 3. Commits (Conventional Commits + scope del monorepo)

Formato:

```
<tipo>(<scope>): <mensaje corto> (TRA-12)
```

### Scopes obligatorios

- `api` → cambios en `producto/trackt-api`
- `front` → cambios en `producto/tract-front`
- `repo` → cambios en la raíz, configs, docs globales

### Ejemplos

```
feat(api): agregar endpoint POST /auth/login (TRA-12)
fix(front): corregir redirect tras logout (TRA-45)
chore(repo): actualizar .gitignore (TRA-7)
refactor(api): mover guards a modulo compartido (TRA-22)
docs(repo): agregar guia de gitflow (TRA-9)
```

### Reglas del mensaje

- Subject en **imperativo** ("agregar", no "agregado").
- Máximo **70 caracteres** en el subject.
- ID de Linear al final, entre paréntesis.
- Si necesitas explicar el "por qué", agrega cuerpo separado por una línea en blanco.

---

## 4. Flujo paso a paso

Cada ticket de Linear → una rama → un PR.

```bash
# 1. Parado en main actualizado
git checkout main
git pull origin main

# 2. Crear rama desde el ID de Linear
git checkout -b feat/TRA-12-login-google

# 3. Trabajar y commitear chico y seguido
git add producto/trackt-api/src/auth
git commit -m "feat(api): agregar AuthService base (TRA-12)"

git add producto/tract-front/src/pages/login
git commit -m "feat(front): formulario login con react-hook-form (TRA-12)"

# 4. Subir la rama
git push -u origin feat/TRA-12-login-google

# 5. Abrir Pull Request en GitHub hacia main
#    Título sugerido: "feat: login con Google (TRA-12)"
#    Linear detecta el ID y mueve el ticket a "In Review"

# 6. Esperar review → mergear con SQUASH → borrar rama (local y remota)
```

---

## 5. Reglas mínimas (no negociables)

1. **Nunca commit directo a `main`.** Siempre vía PR.
2. **Una rama = un ticket de Linear.** Si no hay ticket, créalo antes.
3. **ID de Linear en la rama Y en los commits.** Doble vínculo asegura que Linear nunca falle el match.
4. **Scope obligatorio** (`api`, `front` o `repo`) para identificar el área tocada.
5. **Squash merge en PRs** → historial de `main` limpio (un commit por ticket).
6. **Borrar la rama tras mergear**, en local y remoto.
7. **Pull antes de empezar** una rama nueva (`git pull origin main`).
8. **PRs chicos** mejor que PRs gigantes. Si el ticket crece, dividirlo en Linear.

---

## 6. Cheat sheet de comandos

| Acción | Comando |
|---|---|
| Actualizar `main` | `git checkout main && git pull` |
| Crear rama nueva | `git checkout -b feat/TRA-XX-descripcion` |
| Ver cambios | `git status` |
| Stagear archivos | `git add <ruta>` |
| Commit | `git commit -m "feat(api): mensaje (TRA-XX)"` |
| Subir rama | `git push -u origin <rama>` |
| Cambiar de rama | `git checkout <rama>` |
| Traer cambios de main a tu rama | `git pull origin main` |
| Borrar rama local | `git branch -d <rama>` |
| Borrar rama remota | `git push origin --delete <rama>` |
| Limpiar ramas mergeadas locales | `git branch --merged main \| grep -v main \| xargs git branch -d` |

---

## 7. Cómo Linear asocia los cambios

Linear vincula automáticamente cuando detecta el ID del ticket (`TRA-12`) en:

- Nombre de la rama ✅ (lo usamos siempre)
- Mensajes de commit ✅ (lo usamos siempre)
- Título o descripción del PR ✅ (recomendado)

Con los tres puntos cubiertos, el estado del ticket en Linear se mueve solo:

- Al abrir la rama → `In Progress`
- Al abrir el PR → `In Review`
- Al mergear → `Done`

---

## 8. Ejemplo completo de ciclo

Ticket en Linear: **TRA-30 — Agregar paginación al listado de usuarios**.

```bash
# Empezar
git checkout main
git pull origin main
git checkout -b feat/TRA-30-paginacion-usuarios

# Trabajar en la API
git add producto/trackt-api/src/users
git commit -m "feat(api): agregar query params page y limit en /users (TRA-30)"

# Trabajar en el front
git add producto/tract-front/src/features/users
git commit -m "feat(front): componente Pagination en tabla de usuarios (TRA-30)"

# Subir
git push -u origin feat/TRA-30-paginacion-usuarios

# Abrir PR en GitHub:
#   Título: "feat: paginacion en listado de usuarios (TRA-30)"
#   Base: main  ←  Compare: feat/TRA-30-paginacion-usuarios
#   Asignar reviewer

# Tras aprobación:
#   - Squash and merge
#   - Delete branch (botón en GitHub)

# Local:
git checkout main
git pull origin main
git branch -d feat/TRA-30-paginacion-usuarios
```

---

## 9. Errores comunes a evitar

- ❌ `git commit -m "cambios"` → sin tipo, sin scope, sin ID.
- ❌ `feature/login` → falta ID de Linear, tipo incorrecto (`feature` no es válido, es `feat`).
- ❌ Mergear con merge commit en lugar de squash → ensucia el historial.
- ❌ Trabajar varios tickets en la misma rama → imposible de revisar y trackear.
- ❌ Hacer push directo a `main` → bloqueado por protección de rama.
- ❌ Olvidar el `git pull` antes de crear rama → conflictos innecesarios.

---

## 10. Resumen en 3 líneas

1. `git checkout -b <tipo>/<LINEAR-ID>-<desc>` desde `main` actualizado.
2. Commits con `<tipo>(<scope>): mensaje (LINEAR-ID)`.
3. PR a `main` → squash merge → borrar rama.
