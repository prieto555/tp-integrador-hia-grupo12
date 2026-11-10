# Plan de sprints

Entregable del punto 2. Los IDs son los de [backlog.md](backlog.md).

> **Pendiente de confirmar con la cátedra:** la consigna dice que la
> presentación es la semana del **16 de noviembre** pero que los grupos se
> definen hasta el **30**. Son fechas incompatibles y el plan cambia según
> cuál valga. Abajo están los dos escenarios; el apretado es el que se asume
> hasta que haya respuesta.

---

## Escenario A — presentación la semana del 16 (el que se asume)

Quedan siete días. Dos sprints cortos. El criterio es que al final del Sprint 1
haya **algo demostrable de punta a punta**, aunque falten puntos enteros: es
preferible una demo que funciona con huecos declarados que diez cosas a medio
hacer.

### Sprint 1 · martes 10 a viernes 13

**Objetivo:** la aplicación entera en contenedores y accesible desde Internet.

| Frente | Tareas |
|---|---|
| 1 · Base de datos | E4-05, E4-06, E4-07, E4-08 |
| 2 · SQL | E5-01, E5-02, E5-03 |
| 3 · App y CI/CD | E7-01, E7-02, E7-03, E7-04, E8-01 |
| 4 · Túnel y monitoreo | E9-01, E9-02, E10-01, E10-02 |
| 5 · Procesos | E2-01, E2-02, E2-03, E3-04, E11-01, E11-02 |

**Condición de salida:** `docker compose up` levanta los tres servicios, la app
responde desde un celular con datos móviles, y el tablero tiene todas las
tarjetas con responsable.

### Sprint 2 · sábado 14 a lunes 16

**Objetivo:** cerrar los puntos que suman nota y ensayar la defensa.

| Frente | Tareas |
|---|---|
| 1 · Base de datos | E4-09, E4-10 |
| 2 · SQL | E5-06, E5-07, E5-09, E6-01, E6-03, E6-05, E6-06 |
| 3 · App y CI/CD | E7-06, E8-02, E8-05, E8-07, E14-01, E14-02, E14-03 |
| 4 · Túnel y monitoreo | E9-03, E9-05, E10-03, E10-05, E10-06 |
| 5 · Procesos | E11-03, E11-04, E13-01, E13-02 |
| Todos | E14-04, E14-05, E15-01, E15-03, E15-04 |

**Condición de salida:** los 16 documentos escritos y la presentación ensayada
con cronómetro.

### Lo que queda afuera en este escenario

Nextcloud (E12 completo), los flujos 2 y 3 de n8n (E13-03, E13-04), el
despliegue a un registro (E8-04) y la conexión de la app a la réplica (E6-04).

Eso **se declara en el documento de limitaciones**, no se esconde. La consigna
valora más decir "esto no lo hicimos y sabemos por qué" que simular que está.

---

## Escenario B — si la fecha se corre a fin de noviembre

Tres sprints de una semana, con el mismo orden pero sin recortes.

| Sprint | Días | Foco |
|---|---|---|
| 1 | 10 al 16 | Puntos 4 y 7: todo en contenedores, más el tablero cargado |
| 2 | 17 al 23 | Puntos 5, 6, 9 y 10: dataset, optimización, replicación, túnel y monitoreo |
| 3 | 24 al 30 | Puntos 8, 11, 12, 13 y 14: CI/CD, incidencias, Nextcloud, n8n y seguridad |

La documentación (E15) no es un sprint aparte: cada tarea se documenta cuando
se termina, o no se termina.

---

## Reuniones de seguimiento

Quince minutos, por videollamada, cada uno responde tres cosas: qué cerré, qué
sigo, qué me traba. **Lo que se traba se anota en el tablero el mismo día**, no
se deja para la reunión siguiente.

El registro de esas reuniones es entregable (E2-05): sin evidencia de
seguimiento, el punto 2 queda incompleto aunque el tablero esté lleno.

## Definición de terminado

Una tarjeta pasa a *Hecho* cuando cumple las cuatro:

1. Lo que hace está **demostrado**, no afirmado: comando y salida, medición
   antes y después, o captura de la prueba.
2. El cambio está en un **pull request revisado por otro integrante**.
3. La documentación de `docs/` quedó al día.
4. No agregó secretos ni datos personales al repositorio.
