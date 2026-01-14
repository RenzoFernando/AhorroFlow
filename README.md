# AhorroFlow

Pequeña aplicación web para generar y seguir un plan de ahorro diario incremental. Interfaz moderna con estilo glassmorphism, generación dinámica de días hábiles y progreso visual.

## Características
- Genera un plan de ahorro incremental hasta una meta.
- Selección de días hábiles (Lunes a Domingo).
- Marcado de días completados (persistencia en `localStorage`).
- Barra de progreso y confetti al completar.
- UI responsiva y animaciones suaves.

## Configuración por defecto
Los valores por defecto se definen en `script.js` dentro de `DEFAULT_CONFIG`:
- `startDate`: fecha inicial
- `baseAmount`: monto del primer día
- `increment`: incremento diario
- `target`: meta total
- `activeDays`: array con días activos (0 = Domingo, 1 = Lunes, ...)

## Archivos principales
- `index.html` — estructura y plantilla principal.
- `style.css` — estilos personalizados (glassmorphism, animaciones, scrollbar).
- `script.js` — lógica de generación del plan, renderizado, persistencia y UI.

## Notas de desarrollo
- Los objetos `Date` se serializan a `localStorage`; al cargar se reconvierten a `Date`.
- El generador usa un contador de seguridad para evitar loops infinitos.
- La interfaz usa Tailwind CDN y FontAwesome (incluir conexión a Internet para CDN).

