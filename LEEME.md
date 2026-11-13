# Ciudad RP · Los Ángeles — cómo subirla

Hay 2 partes: **Supabase** (la base de datos gratis: cuentas, dinero, fotos) y **Netlify** (donde vive la página).

## 1. Supabase (10 min, una sola vez)
1. Entra a https://supabase.com → New project (plan Free). Guarda la contraseña.
2. Ve a **SQL Editor** → New query → pega TODO el archivo `supabase.sql` → **Run**. (Córrelo una sola vez.)
3. Ve a **Authentication → Sign In / Providers → Email** y APAGA **"Confirm email"**. (El login es con usuario, no con correo.)
4. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**
5. Abre `web/config.js` y pégalos:
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_KEY = 'eyJ...';
   ```

## 2. Netlify
1. Entra a https://app.netlify.com/drop
2. Arrastra la carpeta **`web`** (solo esa).
3. Listo, te da tu link. En Site settings puedes cambiarle el nombre o ponerle tu dominio.

Cada vez que cambies algo, vuelve a arrastrar la carpeta `web` en Deploys → "Drag and drop".

## 3. Primer arranque
1. **Tú regístrate primero**: el primer usuario queda como **Owner** y verificado.
2. Abre **Panel Staff → Configuración → "Cargar datos base"**. Esto carga quién aprueba cada trámite, las pagas, los rangos de robos, y autos, casas y trabajos de ejemplo.
3. Crea tu vida en **Mi Vida** y apruébala tú mismo en **Panel Staff → Aprobaciones**.
4. Da rangos de staff en **Panel Staff → Usuarios** (Helper, Mod, Admin, Co-Owner).

## Quién aprueba qué
| Trámite | Lo aprueba |
|---|---|
| Cuentas nuevas, vidas (second role), visas, empresas, robos, armas, herramientas, influencers | Admin+ |
| CK | Mod+ |
| DNI, licencia de conducir | DMV / Policía / Mod+ |
| Licencia de armas, placas | Policía / Mod+ (desde LAPD MDT) |
| Demandas | Jueces |
| Partidos y campañas | FEC |
| Servicio militar | Ejército / Seals |
| Postulaciones de empleo | Quien publicó la vacante (gobierno: ese departamento) |

Cuando apruebas algo, la web te dice **qué rol ponerle en Discord**. Los roles de la web (Policía, FEC, Juez…) se asignan en **Panel Staff → Usuarios → Roles / estado**.

## Si no pones las llaves
La web corre en **modo demo**: funciona igual, pero los datos se guardan solo en el navegador de quien la abra. Sirve para probarla.

## Nómina automática
- Los sueldos se pagan solos cada día desde la Tesorería de la ciudad (empieza con $13,950,000,000, el presupuesto real de LA 2025-26).
- Para que corra a la misma hora aunque nadie abra la web: en Supabase ve a **Database → Extensions**, activa **pg_cron** y vuelve a correr solo el último bloque de `supabase.sql` (el que dice `pg_cron`). Si no lo activas, la nómina corre la primera vez que alguien abre la web cada día.
- Sueldos por rango: Panel Staff → Economía. Los mandos (Teniente+, Capitán, Jefes…) contratan, ascienden, despiden y aprueban vacaciones desde la app **Workday → Mi equipo**.
- El Presidente puede imprimir dinero y fijar la tasa de la Reserva Federal desde **LA City → Finanzas** (imprimir genera inflación y todo sube de precio).
