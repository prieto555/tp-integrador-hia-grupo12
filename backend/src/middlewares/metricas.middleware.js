// Metricas de la aplicacion para Prometheus (punto 10, tarea E10-03).
//
// Expone /metrics con tres cosas:
//
//   1. las metricas por defecto de prom-client: memoria del proceso, tamano
//      del monticulo de V8, retraso del bucle de eventos, descriptores de
//      archivo abiertos;
//   2. un contador de peticiones por metodo, ruta y codigo de respuesta;
//   3. un histograma de la duracion de cada peticion.
//
// Por que un histograma y no un promedio: el promedio esconde justamente lo
// que interesa. Si una de cada veinte peticiones tarda diez segundos y el
// resto un milisegundo, el promedio da medio segundo y parece que esta todo
// bien. Con el histograma se puede preguntar por el percentil 95, que es la
// que tarda de verdad.

const client = require("prom-client");

// Un registro propio en lugar del global: deja claro que se publica y evita
// que una libreria registre metricas sin que nadie se entere.
const registro = new client.Registry();

registro.setDefaultLabels({ servicio: "restoya-backend" });

// Memoria, CPU del proceso, monticulo de V8 y retraso del bucle de eventos.
client.collectDefaultMetrics({ register: registro });

// El techo de memoria de V8, que prom-client NO publica.
//
// Sin esto no se puede escribir la alerta de memoria. La relacion que parece
// obvia, usado/total, no sirve: V8 mantiene el monticulo reservado casi lleno
// a proposito y lo agranda cuando hace falta, asi que al arranque ya da 0,92
// con 41 MB usados. Avisaria siempre.
//
// Lo que importa es cuanto falta para el TECHO, que es donde el proceso muere
// con "JavaScript heap out of memory". En este contenedor son 2240 MB, y
// coincide con los 2 GB a los que murio de verdad en el punto 5.
//
// Es un gauge y no una constante porque el techo depende de la memoria de la
// maquina: en otra maquina da otro numero, y la alerta tiene que seguir
// valiendo sin tocar nada.
new client.Gauge({
  name: "nodejs_heap_size_limit_bytes",
  help: "Techo del monticulo de V8 en bytes; pasarlo mata el proceso",
  registers: [registro],
  collect() {
    this.set(require("v8").getHeapStatistics().heap_size_limit);
  },
});

const peticiones = new client.Counter({
  name: "http_requests_total",
  help: "Peticiones HTTP atendidas, por metodo, ruta y codigo de respuesta",
  labelNames: ["method", "route", "status_code"],
  registers: [registro],
});

const duracion = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duracion de las peticiones HTTP en segundos",
  labelNames: ["method", "route", "status_code"],
  // Los limites no son los que vienen por defecto. Se eligieron con los
  // numeros medidos en el punto 5: despues de los indices, los nueve
  // endpoints responden entre 7 y 23 ms. Con los limites por defecto
  // (0,005 / 0,01 / 0,025 / 0,05 ...) casi todo cae en los dos primeros
  // cajones y el percentil 95 queda sin resolucion justo donde vive la
  // aplicacion. Estos reparten mejor la zona de los milisegundos y siguen
  // llegando a los diez segundos para los casos feos.
  buckets: [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registro],
});

// Cuantas series distintas puede crear la etiqueta "route". Express da la
// plantilla de la ruta (/api/pedidos/:id), no la URL concreta, asi que no
// explota; pero las peticiones que no coinciden con ninguna ruta (404, sondas,
// escaneos) no tienen plantilla, y usar su URL crearia una serie nueva por
// cada intento. Esas van todas a la misma etiqueta.
const RUTA_DESCONOCIDA = "desconocida";

const nombreDeRuta = (req) => {
  if (req.route && req.route.path) {
    // baseUrl es donde esta montado el enrutador: "/api/pedidos".
    // route.path es lo que agrega el manejador: "/:id".
    return `${req.baseUrl || ""}${req.route.path}`;
  }
  return RUTA_DESCONOCIDA;
};

// Middleware. Se registra ANTES que las rutas, pero mide al terminar, porque
// recien ahi se sabe que ruta matcheo y con que codigo se respondio.
const medirPeticiones = (req, res, next) => {
  // No se mide a si mismo: /metrics lo consulta Prometheus cada quince
  // segundos y ensuciaria todos los graficos con trafico que no es de nadie.
  if (req.path === "/metrics") {
    return next();
  }

  const fin = duracion.startTimer();

  res.on("finish", () => {
    const etiquetas = {
      method: req.method,
      route: nombreDeRuta(req),
      status_code: res.statusCode,
    };
    fin(etiquetas);
    peticiones.inc(etiquetas);
  });

  next();
};

// El manejador de /metrics.
//
// NO se monta bajo /api. nginx solo hace de proxy de /api/, asi que esta ruta
// no es alcanzable desde el navegador: solo la ve Prometheus, por la red
// interna de Docker. /metrics cuenta rutas, codigos de error y versiones; es
// un mapa del sistema para quien lo quiera atacar, y publicarlo "para poder
// verlo" es el error clasico.
const servirMetricas = async (_req, res) => {
  try {
    res.set("Content-Type", registro.contentType);
    res.end(await registro.metrics());
  } catch (error) {
    console.error("Error al generar las metricas:", error);
    res.status(500).end();
  }
};

module.exports = { medirPeticiones, servirMetricas, registro };
