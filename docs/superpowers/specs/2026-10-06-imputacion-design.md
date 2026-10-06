# Imputación semanal

## Objetivo autorizado
Añadir a WorkOS un borrador semanal para el director creativo: 2 horas diarias de oficina y 6 repartidas entre cuentas, cerrando cada jornada laborable en 8 horas. El usuario ha indicado «Pues ve montando» después de acordar estas reglas.

## Reparto
Usar proyectos y tareas ya cargados, sin nuevas consultas ni cambios en Notion. Cada cuenta con proyectos abiertos recibe peso base; las tareas en progreso o pendientes añaden peso. Las tareas fechadas en la semana, y especialmente los bloques horarios, pesan más. Excluir proyectos cerrados/en standby y tareas canceladas, en backlog o pausadas. Las tareas terminadas fechadas en la semana también sirven de evidencia. No usar tareas fechadas fuera de esa semana. Resolver una tarea sin cuenta mediante su proyecto cuando sea inequívoco.

Normalizar a 12 unidades de media hora por día, más 2 horas de oficina. Los festivos generales y ausencias personales disponibles se muestran sin horas; permitir marcar un día como no laborable cuando falte esa información. Si no hay cuentas con actividad, mantener 2 horas de oficina y 6 horas pendientes de asignar, visiblemente señaladas. El borrador no acredita horas reales.

## Interacción y persistencia
Sección Imputación junto a Mi semana, inicialmente solo para el rol editor. Navegación semanal, tabla por cuenta/día con totales, resumen visual y copia de la tabla. Las celdas se editan en medias horas; reajustar el resto de cuentas para mantener las 6 horas de cuentas. La oficina permanece fija. Con una sola cuenta, mostrar la limitación para no permitir un total inválido. Guardar los días modificados y las ausencias manuales en localStorage por persona y semana. No sobrescribir ajustes al actualizar datos. Recalcular una semana con ajustes requiere confirmación en la propia interfaz.

## Límites
Sin envío al imputador corporativo, sin automatización externa y sin base de datos nueva. Los ajustes se conservan en este navegador. Semanas anteriores se estiman con los datos actuales, sin inventar un histórico. Mostrar estados de carga/error y no generar horas ficticias mientras no haya datos disponibles.

## Validación
Pruebas del reparto: totales, redondeo, tareas frente a proyectos sin tareas, estados excluidos, fechas fuera de semana, relaciones, ausencias y ajustes. Build de producción y revisión de interacción con datos de prueba, seguida de verificación del despliegue.
