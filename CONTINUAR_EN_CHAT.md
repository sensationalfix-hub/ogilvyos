# OgilvyOS · handoff para continuar

Este paquete contiene el código fuente completo de la versión publicada el 31 de agosto de 2026.

Sitio actual: https://ogilvy-os.sensationalfix.chatgpt.site

## Qué está funcionando

- Dashboard operativo sin scroll general, con cuentas, tareas, proyectos y roster de equipo.
- Drag & drop de tareas y proyectos entre estados, asignación de personas y cambio de cuenta.
- Calendario cronológico de tareas, proyectos y ausencias.
- Edición de fichas de tareas y proyectos dentro del prototipo.
- Cierre y evaluación rápida de una tarea o proyecto con nota de 1 a 5.
- Rúbrica detallada opcional:
  - Tareas: calidad, timing, colaboración y autonomía.
  - Proyectos: calidad, timing, colaboración e impacto.
- Ajuste opcional de nota por persona cuando el resultado del equipo no fue homogéneo.
- Señales positivas, fricciones y comentario privado opcionales.
- Fichas completas de empleado: índice, tamaño de muestra, carga, tareas/proyectos activos, histórico, distribución de notas, skills, áreas de mejora y rúbrica.

## Datos reales incorporados

La instantánea de `app/notion-snapshot.ts` se generó a partir de las bases reales de Notion:

- 10 cuentas totales; 7 activas en la interfaz.
- 63 proyectos totales; 23 activos.
- 320 tareas totales; 61 activas.
- 20 perfiles activos.
- 73 registros de vacaciones/ausencias; 3 ausencias próximas visibles.
- 149 tareas y 35 proyectos con rating histórico.
- 0 registros todavía en la nueva base detallada de Evaluaciones.

No se han incluido emails ni sueldos.

## Lógica del índice

- Histórico: 60% puntuación de tareas + 40% puntuación de proyectos.
- Si solo existe uno de los dos tipos, se usa la evidencia disponible.
- Nuevos cierres rápidos: la nota general entra directamente en el índice.
- Nuevos cierres detallados: 50% nota general + 50% media de las dimensiones contestadas.
- Cada ficha muestra el tamaño de muestra para evitar que una única nota convierta a alguien en leyenda o villano.
- La carga no entra en el índice de calidad; se muestra como métrica independiente.

## Auditoría: qué falta en Notion

- Esfuerzo sin completar en 320 tareas.
- Complejidad sin completar en 63 proyectos.
- 25 tareas sin equipo relacionado.
- 17 proyectos sin personas relacionadas.
- 13 tareas sin fecha.
- 2 perfiles sin skills.
- 10 perfiles sin áreas de mejora.
- 2 perfiles sin fecha de incorporación.
- La base `Evaluaciones` ya existe y está relacionada, pero aún tiene 0 registros.

## Fuente de verdad

- Cuentas: `collection://2b94f145-f5cf-8086-b7d3-000b725420ca`
- Proyectos: `collection://2b94f145-f5cf-8056-8374-000ba6ff7805`
- Tareas: `collection://2b94f145-f5cf-8047-ae8f-000b0d9c228c`
- Equipo: `collection://2b94f145-f5cf-80d2-9b2d-000ba0a4f1b5`
- Vacaciones: `collection://2b94f145-f5cf-8036-9bea-000bcf72925b`
- Evaluaciones: `collection://dfc07eed-0df1-4ace-87eb-ac682213ee58`

## Limitación actual importante

La interfaz usa datos reales, pero los cambios hechos en la app siguen siendo borradores de sesión. Todavía no escriben en Notion ni persisten al recargar. La siguiente fase debe ser la sincronización bidireccional y la creación de un registro de Evaluación por empleado al cerrar trabajo.

## Cómo arrancarlo

Requiere Node 22 o superior.

```bash
npm install
npm run dev
```

Validación de producción:

```bash
npm run build
```

Archivos principales:

- `app/page.tsx`: producto, estados e interacciones.
- `app/globals.css`: sistema visual Ogilvy.
- `app/notion-snapshot.ts`: instantánea de datos reales.
- `.openai/hosting.json`: identidad del sitio publicado.

## Siguiente prompt recomendado

> Continuemos OgilvyOS desde este ZIP. Lee primero `CONTINUAR_EN_CHAT.md`. Quiero conectar el cierre y las ediciones con Notion de forma bidireccional, conservando Notion como fuente de verdad y evitando guardar emails o sueldos en la interfaz.
