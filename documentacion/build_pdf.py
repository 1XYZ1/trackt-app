# -*- coding: utf-8 -*-
"""Genera presentacion-infra-seguridad.pdf (16:9) con la identidad de Trackt.
Abre nativo en iPhone/Android/Files. Incluye slides + notas del orador."""
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color

W, H = 960.0, 540.0  # 16:9 en puntos

BG      = HexColor("#0B0B0D")
SURFACE = HexColor("#151518")
SURF2   = HexColor("#1D1D21")
BORDER  = HexColor("#2A2A30")
FG      = HexColor("#F5F5F5")
MUTED   = HexColor("#A0A0A8")
FAINT   = HexColor("#707078")
BRAND   = HexColor("#6152E8")
BRANDLT = HexColor("#9B8FFF")
BRANDDK = HexColor("#3D31B0")
BLUE    = HexColor("#60A5FA")
AMBER   = HexColor("#FBBF24")
GREEN   = HexColor("#4ADE80")
RED     = HexColor("#F87171")
EMER    = HexColor("#34D399")
WHITE   = HexColor("#FFFFFF")

SANS  = "Helvetica"
SANSB = "Helvetica-Bold"
MONO  = "Courier"

c = canvas.Canvas(
    r"C:\Users\danie\Desktop\egenya\trackt-2\trackt-app\documentacion\presentacion-infra-seguridad.pdf",
    pagesize=(W, H))

# ---------- helpers (coordenadas desde arriba) ----------
def rect(x, top, w, h, fill=None, stroke=None, sw=1.0, r=0):
    y = H - top - h
    if fill is not None: c.setFillColor(fill)
    if stroke is not None: c.setStrokeColor(stroke); c.setLineWidth(sw)
    if r > 0:
        c.roundRect(x, y, w, h, r, fill=1 if fill is not None else 0,
                    stroke=1 if stroke is not None else 0)
    else:
        c.rect(x, y, w, h, fill=1 if fill is not None else 0,
               stroke=1 if stroke is not None else 0)

def circle(cx, top, d, fill):
    y = H - top - d
    c.setFillColor(fill); c.circle(cx + d/2, y + d/2, d/2, fill=1, stroke=0)

def tri(x, top, size, color):  # triangulo derecha (marcador)
    y = H - top
    c.setFillColor(color)
    p = c.beginPath(); p.moveTo(x, y); p.lineTo(x, y - size); p.lineTo(x + size*0.9, y - size/2)
    p.close(); c.drawPath(p, fill=1, stroke=0)

def line1(x, top, txt, size, color, font=SANS):
    c.setFont(font, size); c.setFillColor(color)
    c.drawString(x, H - top - size, txt)

def center(x, top, w, txt, size, color, font=SANS):
    c.setFont(font, size); c.setFillColor(color)
    c.drawCentredString(x + w/2, H - top - size, txt)

def right(x_right, top, txt, size, color, font=SANS):
    c.setFont(font, size); c.setFillColor(color)
    c.drawRightString(x_right, H - top - size, txt)

def wrap(txt, font, size, maxw):
    words = txt.split(); lines=[]; cur=""
    for w_ in words:
        t = (cur+" "+w_).strip()
        if c.stringWidth(t, font, size) <= maxw: cur=t
        else:
            if cur: lines.append(cur)
            cur=w_
    if cur: lines.append(cur)
    return lines or [""]

def para(x, top, maxw, txt, size, color, font=SANS, leading=None):
    leading = leading or size*1.32
    for ln in wrap(txt, font, size, maxw):
        line1(x, top, ln, size, color, font); top += leading
    return top

def footer(idx):
    circle(36, 508, 8, BRAND)
    line1(50, 506, "Trackt · Infraestructura & Seguridad", 7, FAINT)
    right(924, 506, f"{idx:02d}", 7, FAINT)

def header(idx, kicker, title, kcolor=BRANDLT):
    rect(0, 0, 10, H, fill=BRAND)
    line1(42, 34, kicker.upper(), 9, kcolor, SANSB)
    line1(42, 52, title, 22, FG, SANSB)
    rect(44, 112, 60, 2.5, fill=BRAND)
    footer(idx)

def bullets(x, top, maxw, items, size=11, gap=7):
    for it in items:
        txt = it[0]; lvl = it[1]; col = it[2] if len(it) > 2 else FG
        if txt == "":
            top += size*0.7; continue
        if lvl == 0:
            tri(x, top + size*0.18, size*0.78, BRAND)
            tx = x + size*1.05
            lines = wrap(txt, SANS, size, maxw - size*1.05)
            for i, ln in enumerate(lines):
                line1(tx, top, ln, size, col, SANS); top += size*1.28
        else:
            line1(x + 14, top, "–", size-1, FAINT, SANS)
            tx = x + 30
            lines = wrap(txt, SANS, size-1, maxw - 30)
            for i, ln in enumerate(lines):
                line1(tx, top, ln, size-1, MUTED, SANS); top += (size-1)*1.28
        top += gap
    return top

def card(x, top, w, h, title, lines, accent=BRAND, tcolor=FG):
    rect(x, top, w, h, fill=SURFACE, stroke=BORDER, sw=1.0, r=10)
    rect(x, top, w, 4, fill=accent)
    line1(x+16, top+16, title, 12.5, tcolor, SANSB)
    ty = top + 44
    for ln in lines:
        if ln == "": ty += 6; continue
        for l in wrap(ln, SANS, 10.5, w-30):
            line1(x+16, ty, l, 10.5, MUTED, SANS); ty += 14
        ty += 2

def chip(x, top, label, dot, w=128, h=30):
    rect(x, top, w, h, fill=SURF2, stroke=BORDER, sw=1.0, r=15)
    circle(x+12, top + h/2 - 5, 10, dot)
    line1(x+28, top + h/2 - 5, label, 8.5, FG, SANS)

def newpage(bg=True):
    if bg:
        c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)

# ============ Slide 1 — Portada ============
newpage()
rect(0, 0, 14, H, fill=BRAND)
rect(58, 70, 44, 44, fill=BRAND, r=12)
center(58, 78, 44, "T", 26, WHITE, SANSB)
line1(116, 74, "Trackt", 30, FG, SANSB)
line1(60, 158, "Infraestructura & Seguridad", 34, FG, SANSB)
rect(62, 210, 84, 3, fill=BRAND)
para(62, 226, 760,
     "Plataforma de mantenimiento industrial — cómo está montado el sistema por dentro",
     12, MUTED)
cx = 62; cy = 300
for lab, dot in [("Pendiente", FAINT), ("Asignado", BLUE), ("En ejecución", AMBER),
                 ("Ejecutado", GREEN), ("Cerrado", EMER)]:
    chip(cx, cy, lab, dot, w=124); cx += 132
line1(62, 360, "Equipo:", 10.5, FAINT, SANS)
line1(108, 360, "Rosio Ametller · Jaime Osorio · Ramón Hernández", 10.5, FG, SANSB)
line1(62, 384, "Duración objetivo:", 10, FAINT, SANS)
line1(168, 384, "~10 minutos", 10, BRANDLT, SANSB)
footer(1)
c.showPage()

# ============ Slide 2 — Agenda ============
newpage(); header(2, "Recorrido", "Agenda")
card(42, 150, 420, 320, "01 · Infraestructura",
     ["Vista general — 3 capas desacopladas",
      "Frontend — Next.js 16 en Vercel",
      "Backend / API — NestJS 11 en Railway",
      "Base de datos — Supabase PostgreSQL",
      "",
      "Qué tecnología usamos y dónde corre cada pieza."], accent=BRAND)
card(484, 150, 434, 320, "02 · Seguridad",
     ["Autenticación — JWT de Supabase",
      "Autorización — roles y mínimo privilegio",
      "Aislamiento multi-tenant",
      "Evidencias — signed URLs",
      "Secretos, red y RLS",
      "Proceso — Gitflow y PRs"], accent=BRANDLT, tcolor=BRANDLT)
c.showPage()

# ============ divider ============
def divider(idx, num, title, sub):
    newpage(); rect(0, 0, 14, H, fill=BRAND)
    c.setFillColor(SURF2); c.setFont(SANSB, 110)
    c.drawString(60, H - 250, num)
    line1(64, 250, title, 36, FG, SANSB)
    rect(66, 318, 84, 3, fill=BRAND)
    para(66, 334, 760, sub, 12, MUTED)
    footer(idx); c.showPage()

divider(3, "01", "Infraestructura",
        "Tres capas independientes: cada una se despliega, escala y falla por separado.")

# ============ Slide 4 — Arquitectura ============
newpage(); header(4, "Infraestructura", "Vista general de la arquitectura")
card(42, 150, 268, 215, "Frontend · SSR",
     ["Next.js 16 (App Router)", "React 19", "TanStack Query", "shadcn/ui + Tailwind 4", "", "Deploy: Vercel"], accent=BLUE)
card(346, 150, 268, 215, "Backend · API REST",
     ["NestJS 11 + TypeScript", "Prisma 6 (ORM)", "Auth JWT (Bearer)", "Validación global de DTOs", "", "Deploy: Railway"], accent=BRAND)
card(650, 150, 268, 215, "Datos · Servicios",
     ["Supabase", "· PostgreSQL", "· Auth (JWT)", "· Storage (evidencias)", "", "Región: East US"], accent=EMER)
for ax in [320, 624]:
    c.setFillColor(BRAND)
    yy = H - (150+107)
    p = c.beginPath(); p.moveTo(ax, yy+8); p.lineTo(ax, yy-8); p.lineTo(ax+16, yy); p.close()
    c.drawPath(p, fill=1, stroke=0)
bullets(44, 395, 870, [
    ("El frontend nunca habla directo con la base: todo pasa por la API.", 0),
    ("Comunicación HTTPS + token JWT en cada request → un único punto de entrada controlado.", 0),
], size=11)
c.showPage()

# ============ Slide 5 — Frontend ============
newpage(); header(5, "Infraestructura", "Frontend — Next.js 16 + Vercel")
bullets(44, 150, 500, [
    ("Next.js 16 (App Router) + React 19, rendering en servidor.", 0),
    ("Protección de rutas en el servidor:", 0),
    ("middleware valida la sesión (supabase.auth.getUser) en cada request", 1),
    ("redirige a /login si no hay sesión, antes de renderizar", 1),
    ("Sesión en cookies vía @supabase/ssr (no localStorage → menos XSS).", 0),
    ("TanStack Query para estado de servidor y caché.", 0),
    ("shadcn + Tailwind 4 · formularios validados con zod.", 0),
    ("authFetch adjunta el token como Bearer (auto-refresh + retry en 401).", 0),
    ("El build de producción falla si faltan las env vars de Supabase.", 0),
], size=11, gap=5)
card(576, 150, 342, 320, "Por qué importa",
     ["Sin lógica de negocio ni llaves secretas en el cliente.",
      "Protección server-side: no depende de 'esconder un botón'.",
      "Cookies > localStorage para la sesión.",
      "Token refrescado de forma transparente.",
      "",
      "producto/tract-front  (paquete trackt-front)"], accent=BLUE)
c.showPage()

# ============ Slide 6 — Backend ============
newpage(); header(6, "Infraestructura", "Backend / API — NestJS 11")
bullets(44, 150, 500, [
    ("NestJS 11 + TypeScript: arquitectura modular (un módulo por dominio).", 0),
    ("Prisma 6 como ORM → PostgreSQL (queries tipadas, anti-inyección).", 0),
    ("Validación global con ValidationPipe:", 0),
    ("whitelist → descarta campos no declarados en el DTO", 1),
    ("transform → convierte y valida tipos antes de la lógica", 1),
    ("Ningún dato entra a la API sin pasar por un filtro.", 0),
    ("Deploy en Railway (Node).", 0),
], size=11.5, gap=7)
card(576, 150, 342, 320, "Módulos de dominio",
     ["auth · tenant", "equipos · usuarios", "ordenes · tickets", "evidencias",
      "inventario", "notificaciones", "", "9 módulos aislados → reglas de seguridad por módulo"], accent=BRAND)
c.showPage()

# ============ Slide 7 — DB ============
newpage(); header(7, "Infraestructura", "Base de datos — Supabase PostgreSQL")
bullets(44, 150, 500, [
    ("PostgreSQL administrada por Supabase (región East US).", 0),
    ("Conexión vía pooler (modo transacción, 6543) en runtime.", 0),
    ("Conexión directa (5432) sólo para migraciones.", 0),
    ("sslmode=require → tráfico a la DB siempre cifrado.", 0),
    ("tenant_id en TODAS las tablas de negocio → multi-tenant desde el diseño.", 0, BRANDLT),
], size=11.5, gap=8)
card(576, 150, 342, 320, "Modelo de datos",
     ["Tenant · Equipo", "OrdenTrabajo · Ticket", "Evidencia", "Repuesto · InventarioStock",
      "ReservaRepuesto", "MovimientoInventario", "Notificacion", "", "Cubre todo el flujo del taller"], accent=EMER)
c.showPage()

# ============ divider Seguridad ============
divider(8, "02", "Seguridad", "Defensa en profundidad: varias capas, no una sola.")

# ============ Slide 9 — Autenticación ============
newpage(); header(9, "Seguridad", "Autenticación — ¿quién eres?")
bullets(44, 150, 490, [
    ("Auth delegada a Supabase Auth (no manejamos passwords).", 0),
    ("Cada request trae Authorization: Bearer <JWT>.", 0),
    ("AuthGuard en la API valida antes de cualquier endpoint:", 0),
    ("extrae el token del header", 1),
    ("lo valida contra Supabase (auth.getUser)", 1),
    ("carga el perfil: rol + tenant desde 'profiles'", 1),
    ("inyecta el usuario en el request", 1),
    ("Sin token válido o sin perfil → 401.", 0, RED),
    ("Caché de perfiles en memoria (TTL 5 min).", 0),
], size=10.5, gap=4)
card(576, 150, 342, 320, "Flujo del token",
     ["1 · Login en Supabase → JWT firmado",
      "2 · Front guarda sesión en cookie",
      "3 · authFetch envía Bearer a la API",
      "4 · AuthGuard valida y resuelve perfil",
      "5 · Endpoint se ejecuta con el usuario",
      "", "No inventamos criptografía propia."], accent=BRAND)
c.showPage()

# ============ Slide 10 — Roles (tabla) ============
newpage(); header(10, "Seguridad", "Autorización — ¿qué puedes hacer?")
bullets(44, 145, 870, [
    ("3 roles: admin · jefe_taller · mechanic. RolesGuard + @Roles(...) por endpoint.", 0),
    ("Modelo de mínimo privilegio — reglas en el código, no en la UI.", 0),
], size=11.5, gap=5)
rows = [
    ("Acción sobre un ticket", "Roles permitidos", True),
    ("Listar / ver", "admin · jefe_taller · mechanic", False),
    ("Asignar / reasignar", "admin · jefe_taller", False),
    ("Iniciar / finalizar", "mechanic (el asignado)", False),
    ("Validar / cerrar", "admin", False),
]
tx, ty, rh, c1, c2 = 44, 225, 44, 380, 480
for i,(a,b,hd) in enumerate(rows):
    yy = ty + rh*i
    fill = BRANDDK if hd else (SURFACE if i % 2 else SURF2)
    rect(tx, yy, c1, rh, fill=fill, stroke=BORDER, sw=0.75)
    rect(tx+c1, yy, c2, rh, fill=fill, stroke=BORDER, sw=0.75)
    line1(tx+14, yy+rh/2-6, a, 12, FG, SANSB if hd else SANS)
    line1(tx+c1+14, yy+rh/2-6, b, 12, (FG if hd else BRANDLT), SANSB if hd else MONO)
c.showPage()

# ============ Slide 11 — Multi-tenant ============
newpage(); header(11, "Seguridad", "Aislamiento multi-tenant")
bullets(44, 155, 490, [
    ("Cada usuario pertenece a un tenant (taller).", 0),
    ("TenantService resuelve el tenant_id desde el TOKEN…", 0),
    ("…nunca desde lo que mande el cliente.", 0, BRANDLT),
    ("Toda consulta filtra por tenant_id.", 0),
    ("Un taller jamás ve datos de otro.", 0, GREEN),
], size=12.5, gap=10)
card(576, 150, 342, 320, "Ataque que cierra",
     ["Cambiar un ID en la URL para ver datos de otro taller.",
      "",
      "Aunque lo intenten, la API siempre filtra por el tenant de la sesión autenticada.",
      "",
      "El tenant no es un parámetro: se deriva del token."], accent=RED, tcolor=RED)
c.showPage()

# ============ Slide 12 — Evidencias ============
newpage(); header(12, "Seguridad", "Evidencias / archivos — signed URLs")
bullets(44, 150, 490, [
    ("El archivo nunca pasa por nuestra API.", 0, BRANDLT),
    ("1 · Cliente pide URL → API valida rol, tamaño y tipo", 0),
    ("genera URL firmada (TTL 60 s)", 1),
    ("2 · Cliente sube directo a Supabase Storage", 0),
    ("3 · Cliente confirma → API verifica que existe y registra", 0),
    ("Descarga con URL firmada temporal (TTL 5 min).", 0),
], size=11.5, gap=6)
card(576, 150, 342, 320, "Controles",
     ["MIME whitelist: jpg · png · webp",
      "Tamaño máximo: 5 MB",
      "Ruta scopeada: tenant_id/ticket_id/uuid.ext",
      "Descarga firmada y temporal (5 min)",
      "Service-role key SÓLO en el servidor",
      "", "Acceso por rol + asignación al ticket"], accent=AMBER, tcolor=AMBER)
c.showPage()

# ============ Slide 13 — Secretos/RLS ============
newpage(); header(13, "Seguridad", "Secretos, red y RLS")
bullets(44, 150, 490, [
    (".env en .gitignore; sólo se versiona .env.example sin valores.", 0),
    ("Service-role key y DB password sólo en el entorno del servidor.", 0),
    ("RLS habilitado en Supabase → segunda capa a nivel de base.", 0),
    ("HTTPS extremo a extremo · SSL obligatorio hacia la DB.", 0),
], size=11.5, gap=9)
card(576, 150, 342, 320, "Defensa en profundidad",
     ["Para que un dato salga indebidamente tendría que fallar TODO:",
      "1 · validación de input",
      "2 · guard de auth (JWT)",
      "3 · guard de roles",
      "4 · filtro de tenant",
      "5 · RLS en la base",
      "", "Varias rejas, no una sola."], accent=BRANDLT, tcolor=BRANDLT)
c.showPage()

# ============ Slide 14 — Gitflow ============
newpage(); header(14, "Seguridad", "Proceso — Gitflow & PRs")
bullets(44, 155, 870, [
    ("main protegida: nada se mergea sin Pull Request revisado.", 0),
    ("Una rama = un ticket de Linear = un PR · squash merge.", 0),
    ("Conventional Commits + Conventional Branches con ID de Linear.", 0),
    ("Trazabilidad automática: la rama mueve el estado del ticket.", 0),
    ("La seguridad también es proceso: reduce el riesgo de código sin revisar en producción.", 0, BRANDLT),
], size=12.5, gap=11)
c.showPage()

# ============ Slide 15 — Cierre ============
newpage(); rect(0, 0, 14, H, fill=BRAND)
line1(64, 60, "En resumen", 30, FG, SANSB)
rect(66, 118, 80, 3, fill=BRAND)
card(64, 150, 396, 250, "Infraestructura",
     ["3 capas desacopladas:",
      "Next.js (Vercel) · NestJS (Railway) · Supabase",
      "Cada una desplegada y escalada aparte.",
      "El front nunca toca la base: todo por la API."], accent=BLUE)
card(484, 150, 414, 250, "Seguridad en capas",
     ["validación → JWT → roles → multi-tenant → signed URLs → RLS",
      "Sin secretos en el repo · HTTPS · mínimo privilegio",
      "Defensa en profundidad de punta a punta."], accent=BRANDLT, tcolor=BRANDLT)
footer(15)
c.showPage()

c.save()
print("OK pdf, paginas:", c.getPageNumber()-1)
