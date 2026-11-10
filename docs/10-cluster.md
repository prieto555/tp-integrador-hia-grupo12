# Clúster y replicación de la base de datos (punto 6)

> Qué hay acá: qué arquitectura de replicación se eligió y **por qué esa**,
> qué rol cumple cada nodo, qué se midió, qué pasa cuando se cae el primario,
> y —la parte que más importa— **qué NO resuelve esto**.

---

## 1. La conclusión primero

**Esta arquitectura NO tiene *failover* automático.**

La consigna lo pide explícitamente: *«La replicación por sí sola no garantiza
alta disponibilidad automática. Si el equipo afirma contar con failover
automático, deberá demostrar cómo se detecta la falla, cómo se promueve otro
nodo y cómo se evita la pérdida o corrupción de datos»*.

No lo afirmamos. Lo que hay es **replicación por *streaming* asincrónica**,
que resuelve tres cosas —copia en caliente, lecturas escalables y recuperación
sin restaurar un *dump*— y **no resuelve** que el servicio siga funcionando
solo cuando el primario se cae. Cuando eso pasa, alguien tiene que darse
cuenta y alguien tiene que promover la réplica.

La sección 7 explica qué haría falta para tener *failover* automático de
verdad, y por qué no se hizo acá.

---

## 2. Qué se eligió y por qué

PostgreSQL ofrece varias formas de replicar. Se evaluaron tres:

| Opción | Qué hace | Por qué sí / por qué no |
|---|---|---|
| **Replicación física por *streaming*** | El primario envía su WAL a la réplica, que lo aplica bloque por bloque | **Elegida.** Es la del motor, no necesita nada instalado, replica *todo* (tablas, índices, vistas materializadas, secuencias) y la réplica queda lista para leer |
| Replicación lógica (`CREATE PUBLICATION`) | Replica cambios por tabla | Descartada: no replica DDL ni secuencias, hay que mantener la lista de tablas a mano, y **no replica las vistas materializadas del punto 5**, que son la mitad del tablero |
| Patroni + etcd + HAProxy | Lo anterior más elección de líder y balanceo | Descartada **para este punto**; ver sección 7 |

### Sincrónica o asincrónica

Se eligió **asincrónica**, que es el valor por defecto. La diferencia:

- **Sincrónica**: el primario no confirma un `COMMIT` hasta que la réplica
  avisa que lo recibió. Garantiza cero pérdida, pero **si la réplica se cae,
  el primario deja de aceptar escrituras**. O sea: agregar una réplica
  empeoraría la disponibilidad del sistema entero.
- **Asincrónica**: el primario confirma y sigue. Si se cae justo en el medio,
  se pierde lo que todavía no había viajado.

Para un sistema de pedidos de restaurante la elección es clara: que la caída
de la réplica deje a la aplicación sin poder tomar pedidos es peor que perder
los últimos milisegundos de WAL en un escenario que además es raro. El retraso
medido es de **3,1 ms** (sección 5), así que la ventana de pérdida real es
esa.

---

## 3. Los nodos

```
                   ┌──────────────────────────────────────────────┐
                   │  red interna de Docker (restoya_interna)     │
                   │                                              │
   escrituras ──►  │  ┌────────────────┐                          │
   y lecturas      │  │   restoya_db   │  PRIMARIO                │
   de hoy          │  │  PostgreSQL 16 │  acepta lectura+escritura│
                   │  │  :5432         │  volumen restoya_pgdata  │
                   │  └───────┬────────┘                          │
                   │          │                                   │
                   │          │  WAL por streaming                │
                   │          │  (ranura replica_1, asincronica)  │
                   │          ▼                                   │
   lecturas     ──►│  ┌────────────────────┐                      │
   historicas      │  │ restoya_db_replica │  REPLICA             │
   (tablero)       │  │   PostgreSQL 16    │  SOLO LECTURA        │
                   │  │   :5432            │  vol. pgdata_replica │
                   │  └────────────────────┘                      │
                   │                                              │
                   │  ┌──────────────────┐  ┌──────────────────┐  │
                   │  │ postgres-exporter│  │ postgres-exporter│  │
                   │  │   nodo=primario  │  │   nodo=replica   │  │
                   │  └────────┬─────────┘  └────────┬─────────┘  │
                   └───────────┼─────────────────────┼────────────┘
                               └──────► Prometheus ◄─┘
```

| Nodo | Rol | Acepta escrituras | Puerto en el *host* | Volumen |
|---|---|---|---|---|
| `restoya_db` | Primario | Sí | `127.0.0.1:5433` | `restoya_pgdata` |
| `restoya_db_replica` | Réplica en espera, en caliente | **No** | `127.0.0.1:5434` | `restoya_pgdata_replica` |

Los dos publican puerto sólo en `127.0.0.1`: desde fuera de la máquina no son
alcanzables.

### Los roles de base de datos

| Rol | Para qué | Qué puede hacer |
|---|---|---|
| `restoya` | La aplicación | Leer y escribir sus tablas |
| `replicador` | La réplica | **Sólo** el atributo `REPLICATION`. **No puede leer ni escribir datos** |

Eso último es deliberado y conviene decirlo en la defensa: si la contraseña de
`replicador` se filtra, alcanza para **copiarse la base entera** —que ya es
bastante— pero **no** para conectarse a `restoyadb` y mirar una tabla.

### `pg_hba.conf` sale del repositorio

Antes lo generaba la imagen adentro del volumen de datos. Eso tiene dos
problemas: no estaba versionado, y para cambiarlo había que entrar al
contenedor y editarlo a mano, con lo cual el cambio existía **en una máquina y
en ninguna otra**. Ahora se monta desde
[`infra/postgres/pg_hba.conf`](../infra/postgres/pg_hba.conf) y el servicio
arranca con `-c hba_file=/etc/postgresql/pg_hba.conf`.

La regla de replicación es específica:

```
host    replication     replicador      samenet      scram-sha-256
```

`samenet` son las subredes a las que el servidor está conectado: en la
práctica, la red interna de Docker. Se prefiere a escribir `172.x.0.0/16` a
mano porque esa subred la elige Docker y cambia.

---

## 4. Cómo se construye la réplica

Una réplica no se «configura»: se **clona**. PostgreSQL no replica tabla por
tabla sino bloque por bloque del archivo, así que la réplica tiene que empezar
siendo una copia binaria exacta del primario.

Eso lo hace [`infra/postgres/iniciar-replica.sh`](../infra/postgres/iniciar-replica.sh),
que corre una sola vez (es idempotente: si el directorio ya tiene datos, no
vuelve a copiar 4,4 GB).

```sh
pg_basebackup -h db -p 5432 -U replicador -D "$PGDATA" -Fp -Xs -R -P -S replica_1 -c fast
```

| Opción | Para qué | Qué pasa sin ella |
|---|---|---|
| `-Fp` | Formato plano | El directorio no quedaría listo para arrancar |
| `-Xs` | Trae el WAL **mientras** copia | En una base grande, el WAL generado durante la copia se recicla antes de terminar y **la copia queda inservible** |
| `-R` | Escribe `standby.signal` y `primary_conninfo` | El directorio copiado sería otra base suelta, no una réplica |
| `-S replica_1` | Usa la ranura de replicación | El primario podría borrar WAL que la réplica todavía no aplicó |
| `-c fast` | Fuerza un *checkpoint* ya | Habría que esperar al próximo |

### La ranura de replicación

Es lo que impide que el primario recicle WAL que la réplica todavía no
aplicó. Tiene una contrapartida que hay que saber: **si la réplica se queda
caída, el primario acumula WAL indefinidamente hasta llenar el disco**. Es un
problema real, no teórico, y la mitigación es vigilar
`pg_replication_slots.active` — está en el tablero de Grafana.

> **Aviso de seguridad.** `pg_basebackup -R` deja la contraseña escrita en
> `primary_conninfo`, dentro de `postgresql.auto.conf`, en el volumen. Es como
> funciona la herramienta. No está en el repositorio, pero conviene saberlo
> antes de copiar ese volumen a otro lado.

---

## 5. Lo que se midió

Corrido el **10/11/2026** contra la base real del punto 4, con **30.000.000 de
filas** en total y 6.000.000 de pedidos.

### Clonado

| Qué | Cuánto |
|---|---|
| Tamaño copiado | 4,4 GB |
| Tiempo | **48 segundos** |

```
2026-11-10 04:56:01.992 UTC [1]  LOG:  database system is ready to accept read-only connections
2026-11-10 04:56:02.041 UTC [93] LOG:  started streaming WAL from primary at 3/45000000 on timeline 1
```

### Verificación (actividades 4 y 6)

```
=== 1. la replica ES replica? ===
    pg_is_in_recovery = true

=== 2. LEE? ===
    pedidos = 6000000

=== 3. RECHAZA escrituras? ===
    ERROR:  cannot execute INSERT in a read-only transaction

=== 4. una escritura en el primario aparece en la replica? ===
    insertada mesa 901  →  en la replica: mesa 901 estado LIBRE

=== 5. retraso ===
    walreceiver | streaming | async | 0 bytes
    write_lag  00:00:00.000567
    replay_lag 00:00:00.003140

=== 6. la ranura ===
    replica_1 | physical | active = t | 0 bytes de WAL retenido
```

| Medida | Valor | Qué significa |
|---|---|---|
| Bytes atrasados | **0** | La réplica está al día |
| `write_lag` | 0,57 ms | Lo que tarda en recibir y escribir el WAL |
| `replay_lag` | **3,1 ms** | Lo que tarda en **aplicarlo** y que la consulta ya lo vea |

**Los 3,1 ms son la ventana de inconsistencia.** Una consulta a la réplica
puede no ver algo que se escribió en el primario hace menos de eso. Esa cifra
es la que justifica la decisión de la sección siguiente.

---

## 6. Qué lee la aplicación de la réplica (actividad 5)

**Decisión: sólo las consultas históricas del tablero. Nada más.**

Las cuatro consultas que leen vistas materializadas (`mv_ventas_por_dia`,
`mv_ventas_por_metodo`, `mv_ventas_por_producto`, `mv_resumen_historico`) van
a la réplica. Las cifras de **hoy** del mismo tablero —ventas de hoy, pedidos
de hoy, mesas ocupadas— siguen yendo al primario.

El razonamiento:

> Una vista materializada **ya muestra datos viejos**: son los del último
> refresco, no los de este segundo. Agregarle 3,1 ms de retraso de replicación
> no cambia nada, porque el error que ya tenía es mucho mayor. En cambio, «las
> mesas ocupadas ahora» con 3,1 ms de atraso sí puede mostrar una mesa como
> libre justo después de que alguien la ocupó.

### Por qué no se usó la lista `read`/`write` de Sequelize

Sequelize permite declarar réplicas y repartir las lecturas solo. **No se
usó.** Esa lista reparte **todas** las lecturas, incluidas las que ocurren
justo después de una escritura. Resultado típico con replicación asincrónica:
el mozo carga un pedido, la aplicación lo relee para mostrarlo, la lectura
cae en la réplica que va 3 ms atrás, y el pedido «no aparece». Es un error
intermitente, imposible de reproducir a pedido, y de los peores de
diagnosticar.

Elegir a mano cuáles consultas toleran datos de hace un rato es más trabajo y
es lo correcto.

### Si la réplica no responde

[`backend/config/database-lectura.js`](../backend/config/database-lectura.js)
distingue dos cosas:

- **Error de conexión** (la réplica está caída) → se reintenta contra el
  primario, se deja anotado, y durante 30 segundos las consultas siguientes
  van directo al primario sin pagar el tiempo de espera.
- **Error de SQL** (una vista que no existe) → se propaga. Mandarlo al
  primario daría el mismo error y sólo escondería el problema.

Levantar el proyecto **sin** el perfil `replica` sigue funcionando: el nombre
`db-replica` no resuelve, la aplicación cae sola al primario y lo dice en el
registro.

---

## 7. La caída del primario (actividades 7 y 8)

El procedimiento completo está automatizado en
[`infra/postgres/simular-caida.sh`](../infra/postgres/simular-caida.sh), que
mide cada paso.

### Cómo se detecta la falla

Tres formas, y **ninguna de las tres reacciona sola**:

| Vía | Qué muestra | Cuánto tarda |
|---|---|---|
| La aplicación | Deja de poder escribir. El tablero histórico **sigue andando**, porque lee de la réplica | Inmediato |
| El registro de la réplica | `could not receive data from WAL stream` | Segundos |
| Prometheus | El destino `postgres/primario` pasa a `up = 0` y la regla de servicio caído se dispara | 90 s (medido en el punto 10) |

Las tres **avisan**. Ninguna **promueve**. Esa es, literalmente, la diferencia
entre lo que hay y *failover* automático.

### Cómo se promueve

```bash
docker exec restoya_db_replica pg_ctl promote -D /var/lib/postgresql/data
```

La prueba de que fue una promoción real y no un reinicio es que **la línea de
tiempo pasa de 1 a 2**. PostgreSQL abre una línea nueva para que los WAL del
nodo viejo y los del nuevo no se puedan mezclar.

### Cómo se evita perder o corromper datos

| Riesgo | Qué lo evita |
|---|---|
| Perder transacciones confirmadas | Nada, del todo: la replicación es asincrónica. La ventana es el `replay_lag`, **3,1 ms** |
| Que la réplica no tenga el WAL | La ranura `replica_1`: el primario no recicla WAL que la réplica no aplicó |
| Mezclar historias de WAL | La línea de tiempo nueva, que PostgreSQL crea al promover |
| **Cerebro dividido** | **Nada automático.** Ver abajo |

### El cerebro dividido, dicho con todas las letras

Después de promover la réplica, **si alguien levanta el primario viejo quedan
dos nodos que se creen primarios**, los dos aceptando escrituras, con datos
que divergen desde el momento del corte. Reconciliar eso después es, en el
mejor de los casos, trabajo manual con `pg_rewind`, y en el peor, pérdida de
datos.

Lo único que lo impide hoy es **que nadie levante el nodo viejo**. Eso es un
procedimiento, no un control. Un sistema con `etcd` lo impediría por diseño:
un nodo que no puede confirmar con el almacén de consenso que es el líder, se
niega a aceptar escrituras.

### Qué *no* hace la promoción

- **No cambia a dónde apunta la aplicación.** El backend sigue con
  `DB_HOST=db`, que es el nodo caído. Hay que cambiar esa variable y recrear
  el contenedor.
- **No recrea la ranura.** La ranura `replica_1` quedó en el nodo caído.
- **No deja un par replicado.** Queda un nodo solo, sin copia en caliente,
  hasta que se clone una réplica nueva.

---

## 8. Por qué no se usó Patroni acá

El grupo **ya hizo** un clúster con Patroni + etcd + HAProxy en el TP de
Clúster de Bases de Datos de esta misma materia (septiembre de 2026), con
*failover* automático medido en **5 segundos** y HAProxy confirmando el cambio
en 16. O sea: no es que no sepamos hacerlo.

No se usó acá por tres razones, en orden de peso:

1. **La consigna del punto 6 pide «al menos un nodo principal y un nodo
   réplica»** y «documentar las limitaciones y el procedimiento de
   recuperación». Pide exactamente esto, y pide que si uno dice tener
   *failover* automático lo demuestre. Montar Patroni para después tener que
   demostrar la detección, la promoción y la prevención de pérdida de datos
   en un sistema con seis millones de filas es mucho más trabajo del que el
   punto pide, y el trabajo ya hecho en el otro TP no se puede presentar dos
   veces.
2. **Patroni administra el `postgresql.conf` él mismo.** Eso choca con el
   punto 5, donde los parámetros del motor se ajustaron y se documentaron uno
   por uno. Habría que mover toda esa configuración al archivo de Patroni y
   volver a medir.
3. **etcd agrega un tercer servicio con estado** al compose, que ya tiene
   trece. Para una demostración en una notebook, eso es costo sin beneficio
   visible.

**Qué haría falta para tener *failover* automático**, si se quisiera:

| Pieza | Para qué |
|---|---|
| `etcd` (o Consul) | Almacén de consenso: garantiza que haya **un solo** primario a la vez. Es lo que evita el cerebro dividido |
| Patroni en cada nodo | Vigila su PostgreSQL, compite por el liderazgo, promueve y reconfigura |
| HAProxy adelante | Punto de acceso único: puerto al primario, puerto a las réplicas. **La aplicación no cambia de dirección cuando cambia el primario** |

Sin la tercera pieza, el *failover* automático sirve de poco: el nodo nuevo
estaría listo y la aplicación seguiría hablándole al viejo.

---

## 9. Lo que Prometheus ve de todo esto

El punto 10 tenía una tarea abierta (E10-04): el panel de replicación siempre
decía 0. La causa era que Prometheus sólo consultaba al primario, que por
definición responde `pg_replication_is_replica = 0`.

Ahora hay **dos exportadores**, uno por nodo, con la etiqueta `nodo`:

```yaml
- job_name: postgres
  static_configs:
    - targets: ["postgres-exporter:9187"]
      labels: { nodo: primario }
    - targets: ["postgres-exporter-replica:9187"]
      labels: { nodo: replica }
```

El de la réplica vive en el perfil `replica`: si ese perfil no está
levantado, Prometheus lo muestra caído, que es exactamente lo que queremos que
diga.

---

## 10. Cómo levantarlo y cómo verificarlo

```bash
cd infra/compose && docker compose --profile app --profile replica up -d
```

La primera vez clona 4,4 GB (unos 50 s). Las siguientes arranca directo.

```bash
docker exec restoya_db_replica psql -U restoya -d restoyadb -c "SELECT pg_is_in_recovery();"
```

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c "SELECT client_addr, state, sync_state, pg_wal_lsn_diff(sent_lsn, replay_lsn) AS bytes_atras, replay_lag FROM pg_stat_replication;"
```

Para la prueba de caída (**promueve la réplica**, después hay que volver a
clonarla):

```bash
./infra/postgres/simular-caida.sh
```

---

## 11. Limitaciones conocidas

Sin maquillar:

1. **No hay *failover* automático.** Es la limitación principal y está
   explicada arriba. La detección existe (Prometheus avisa a los 90 s); la
   promoción es manual.
2. **No hay protección contra el cerebro dividido.** Lo único que lo impide es
   que nadie levante el nodo viejo después de promover.
3. **La aplicación no se reconfigura sola.** Hace falta cambiar `DB_HOST` y
   recrear el contenedor del backend.
4. **La ranura de replicación puede llenar el disco** si la réplica queda
   caída mucho tiempo. Se vigila en Grafana; no hay corte automático.
5. **Los dos nodos están en la misma máquina.** Esto protege contra que
   PostgreSQL se caiga o se corrompa un archivo de datos. **No protege contra
   que se rompa el disco, se incendie el edificio o alguien se lleve la
   notebook.** Una réplica en el mismo equipo es alta disponibilidad de
   proceso, no recuperación ante desastres. Lo mismo vale para las copias de
   seguridad del punto 4, que viven en el mismo disco.
6. **La contraseña de replicación queda en `postgresql.auto.conf`**, dentro
   del volumen (sección 4).
7. **La réplica no sirve para descargar escrituras.** Sólo lecturas. Si el
   cuello de botella fueran las escrituras, esto no ayudaría en nada: haría
   falta particionar o fragmentar, que es otro problema.
8. **La prueba de caída todavía no se corrió de punta a punta** con los
   números medidos: el entorno de Docker de la máquina dejó de arrancar
   después de cerrar el punto E6-01. El procedimiento está escrito y
   automatizado en `simular-caida.sh`; lo que falta es la corrida y pegar acá
   su salida. **Esto no está hecho y no se presenta como si lo estuviera.**
