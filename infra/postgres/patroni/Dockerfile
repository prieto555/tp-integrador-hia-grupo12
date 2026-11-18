# Nodo del cluster con failover automatico (punto 6, modo alta disponibilidad).
#
# Es la misma imagen de PostgreSQL 16 que usa el nodo primario de la
# arquitectura simple, con Patroni encima. Mantener la MISMA version mayor no
# es un detalle: los datos se cargan con el mismo esquema y los mismos indices,
# asi que las mediciones del punto 5 siguen siendo comparables.
FROM postgres:16

# patroni[etcd3] trae el cliente de la version 3 de la API de etcd. Con
# "patroni[etcd]" a secas se instala el cliente de la v2, que etcd 3.5 ya no
# expone por omision: Patroni arranca, no encuentra el almacen y se queda en
# bucle sin decir por que.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3-pip python3-dev gcc libpq-dev curl \
    && pip3 install --break-system-packages "patroni[etcd3]" psycopg2-binary \
    && rm -rf /var/lib/apt/lists/*

# La imagen postgres:16 corre initdb bajando privilegios en su propio
# entrypoint. Aca ese entrypoint se reemplaza por el de Patroni, asi que hay
# que bajar privilegios a mano o initdb se niega a correr como root.
USER postgres

ENTRYPOINT ["patroni", "/etc/patroni.yml"]
