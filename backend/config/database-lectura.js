// Conexion de SOLO LECTURA contra la replica (punto 6, actividad 5:
// "configurar la aplicacion para conectarse a la arquitectura implementada").
//
// Por que una conexion aparte y no la lista "read/write" que trae Sequelize:
// esa lista reparte TODAS las lecturas entre las replicas, incluidas las que
// leen algo que se acaba de escribir. Con replicacion asincronica eso produce
// el clasico "cargue el pedido y no aparece": la replica va unos milisegundos
// atras. Preferimos elegir a mano que consultas toleran datos de hace un rato.
//
// Hoy manda aca solamente el tablero historico (vistas materializadas), que
// por definicion ya muestra datos viejos: se refrescan cada tanto, no en vivo,
// asi que el retraso de la replicacion no agrega ningun error nuevo. Las
// cifras de HOY del mismo tablero siguen yendo al primario a proposito.
//
// Si DB_REPLICA_HOST no esta definido, todo va al primario y la aplicacion
// anda igual: levantar el proyecto sin el perfil "replica" tiene que seguir
// funcionando.

const { Sequelize } = require("sequelize");
const primario = require("./database");

const HOST_REPLICA = process.env.DB_REPLICA_HOST;

// Cuanto esperar antes de volver a intentar con la replica despues de que
// fallo. Sin esto, con la replica caida cada visita al tablero pagaria el
// tiempo de espera de la conexion antes de ir al primario.
const ESPERA_REINTENTO_MS = 30000;

let replica = null;
let caidaDesde = 0;

if (HOST_REPLICA) {
  replica = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: HOST_REPLICA,
      port: process.env.DB_REPLICA_PORT || 5432,
      dialect: process.env.DB_DIALECT || "postgres",
      logging: false,
      pool: { max: 5, min: 0, idle: 10000, acquire: 5000 },
      retry: { max: 0 },
    }
  );

  replica
    .authenticate()
    .then(() =>
      console.log(`Lecturas historicas: replica ${HOST_REPLICA}.`)
    )
    .catch((err) =>
      console.error(
        `La replica ${HOST_REPLICA} no responde al arrancar (${err.message}). ` +
          "El tablero historico va a usar el primario."
      )
    );
} else {
  console.log("DB_REPLICA_HOST sin definir: todas las lecturas van al primario.");
}

// Un error de conexion (la replica esta caida) se puede reintentar contra el
// primario. Un error de SQL (una vista que no existe) se propaga, porque
// mandarlo al primario solo esconderia el problema y daria el mismo error.
const esFalloDeConexion = (error) =>
  error instanceof Sequelize.ConnectionError ||
  ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENOTFOUND"].includes(
    error && error.original && error.original.code
  );

/**
 * Corre una consulta de solo lectura. Usa la replica si esta configurada y
 * responde; si no, el primario.
 */
const consultar = async (sql, opciones) => {
  const disponible =
    replica && Date.now() - caidaDesde > ESPERA_REINTENTO_MS;

  if (!disponible) return primario.query(sql, opciones);

  try {
    return await replica.query(sql, opciones);
  } catch (error) {
    if (!esFalloDeConexion(error)) throw error;
    caidaDesde = Date.now();
    console.error(
      `Replica ${HOST_REPLICA} sin responder (${error.message}). ` +
        `Esta consulta y las de los proximos ${ESPERA_REINTENTO_MS / 1000} s ` +
        "van al primario."
    );
    return primario.query(sql, opciones);
  }
};

/** Para /metrics y para el panel de replicacion: 1 si las lecturas van a la replica. */
const leyendoDeLaReplica = () =>
  Boolean(replica) && Date.now() - caidaDesde > ESPERA_REINTENTO_MS;

module.exports = { consultar, leyendoDeLaReplica };
