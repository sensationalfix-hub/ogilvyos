# Imputación Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline. Steps use checkbox syntax.

**Goal:** Un borrador semanal editable que cierre cada día laborable en 8 horas.
**Architecture:** Motor puro en app/lib/timesheet.ts, componente aislado en components/workos/timesheet.tsx e integración mínima en la navegación existente.
**Tech Stack:** Next.js, React, TypeScript, CSS existente, node:test.
**Spec:** docs/superpowers/specs/2026-10-06-imputacion-design.md

## Global Constraints
- 2 horas de oficina y 6 de cuentas por jornada laborable.
- Redondeo a medias horas; propuestas editables, sin cambios en Notion.
- Roles existentes; editor únicamente en esta primera versión.
- Persistencia local por persona y semana, sin sobrescribir ajustes.

## Review Focus
- Relaciones de tareas sin cuenta: resolver por proyecto inequívoco.
- Estados cerrados, standby, backlog y pausa: no aportan actividad actual.
- Sin cuentas elegibles: 6 horas pendientes, sin imputar arbitrariamente.
- Vacaciones/festivos: cero horas y opción manual para información incompleta.
- Edición y cambio de semana: total válido y persistencia sin cruce entre semanas.

### Task 1: Motor semanal
**Files:** app/lib/timesheet.ts; tests/timesheet.test.mjs.
**Interfaces:** buildTimesheet({projects,tasks,holidays,personName,weekStart}) devuelve cinco días con pesos, horas y motivos; rebalanceDay(hours,account,value) conserva 6 horas; restoreDay valida datos guardados.
- [ ] Escribir pruebas de reglas y ejecutar node --test tests/timesheet.test.mjs (RED).
- [ ] Implementar el motor y ejecutar la misma prueba (GREEN).
- [ ] Revisar relaciones, ausencia de actividad y redondeo.

### Task 2: Vista semanal
**Files:** components/workos/timesheet.tsx; app/page.tsx; app/globals.css.
**Interfaces:** Timesheet consume proyectos, tareas, ausencias, nombre de usuario y estado de carga; usa el motor de Task 1.
- [ ] Añadir tabla, resumen, navegación y copia con errores visibles.
- [ ] Guardar ajustes por persona/semana y recuperar solo datos validados.
- [ ] Integrar entrada de navegación y acceso desde Mi semana en móvil.
- [ ] Verificar tipo, build y flujo con datos representativos.

### Task 3: Publicación
**Files:** los cambios de Task 1 y Task 2.
- [ ] Ejecutar las pruebas del repositorio y npm test (build).
- [ ] Revisar el diff completo, publicar por el repositorio conectado y esperar Vercel READY.
- [ ] Comprobar producción y comunicar funciones y límites relevantes.
