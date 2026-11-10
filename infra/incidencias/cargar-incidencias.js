#!/usr/bin/env node
/*
 * Carga en MantisBT las 15 incidencias reales del proyecto (punto 11).
 *
 *   node infra/incidencias/cargar-incidencias.js [--solo INC-07] [--seco]
 *
 * Antes hay que correr preparar-mantis.sh, que crea el proyecto, las
 * categorias, las cuentas y emite el token de API.
 *
 * Por que un script y no cargarlas a mano: cada incidencia lleva descripcion,
 * pasos para reproducir, informacion adicional, una o dos notas, registro de
 * horas y dos cambios de estado. Son unas 120 operaciones. A mano eso
 * garantiza erratas, lleva una tarde, y no se puede repetir si hay que
 * rehacer el entorno. Asi se repite con un comando.
 *
 * Es idempotente: una incidencia cuyo resumen ya existe no se vuelve a crear.
 */

const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const URL_BASE = process.env.MANTIS_URL || `http://127.0.0.1:${process.env.MANTIS_PORT || 8089}`;
const ARCHIVO_TOKEN = path.join(AQUI, '.token-api');
const PROYECTO = 'RestoYa';

const args = process.argv.slice(2);
const SECO = args.includes('--seco');
const soloIdx = args.indexOf('--solo');
const SOLO = soloIdx >= 0 ? args[soloIdx + 1] : null;

if (!fs.existsSync(ARCHIVO_TOKEN)) {
  console.error(`Falta ${ARCHIVO_TOKEN}. Corre antes preparar-mantis.sh.`);
  process.exit(1);
}
const TOKEN = fs.readFileSync(ARCHIVO_TOKEN, 'utf8').trim();

const datos = JSON.parse(fs.readFileSync(path.join(AQUI, 'incidencias.json'), 'utf8'));

// ---------------------------------------------------------------- utilidades
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`${URL_BASE}/api/rest${ruta}`, {
    method: metodo,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { json = { crudo: texto.slice(0, 400) }; }
  if (!r.ok) {
    const e = new Error(`${metodo} ${ruta} -> ${r.status}: ${json.message || json.crudo}`);
    e.estado = r.status;
    throw e;
  }
  return json;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------------------------------------------------------- carga
async function existentes() {
  // page_size al maximo: con 15 incidencias no hace falta paginar, pero si
  // alguien corre esto dos veces sobre un proyecto ya cargado, si.
  const r = await api('GET', `/issues?project_id=${encodeURIComponent(PROYECTO)}&page_size=200`);
  const lista = Array.isArray(r.issues) ? r.issues : [];
  return new Map(lista.map((i) => [String(i.summary), i.id]));
}

async function crear(inc) {
  const cuerpo = {
    summary: `${inc.ref} — ${inc.resumen}`,
    description: inc.descripcion,
    steps_to_reproduce: inc.pasos || '',
    additional_information: [
      inc.adicional || '',
      '',
      '--- Vinculo con el codigo (punto 11, actividad 5) ---',
      inc.commit ? `Commit que la cierra: ${inc.commit}` : 'Sin commit: la incidencia sigue abierta.',
      inc.archivos ? `Archivos tocados: ${inc.archivos}` : '',
      '',
      '--- Verificacion (actividad 7) ---',
      inc.verificacion || '(sin verificar)',
    ].filter(Boolean).join('\n'),
    category: { name: inc.categoria },
    project: { name: PROYECTO },
    priority: { name: inc.prioridad },
    severity: { name: inc.severidad },
    reproducibility: { name: inc.reproducibilidad },
    tags: (inc.etiquetas || []).map((t) => ({ name: t })),
  };
  const r = await api('POST', '/issues', cuerpo);
  return r.issue.id;
}

async function anotar(id, texto) {
  await api('POST', `/issues/${id}/notes`, { text: texto });
}

async function cambiarEstado(id, estado, resolucion) {
  const cuerpo = { status: { name: estado } };
  if (resolucion) cuerpo.resolution = { name: resolucion };
  await api('PATCH', `/issues/${id}`, cuerpo);
}

// ----------------------------------------------------------------------- main
(async () => {
  console.log(`Mantis: ${URL_BASE}`);
  console.log(`Proyecto: ${PROYECTO}`);
  if (SECO) console.log('MODO SECO: no se escribe nada.\n');

  let yaEstan;
  try {
    yaEstan = await existentes();
  } catch (e) {
    console.error(`No se pudo consultar Mantis: ${e.message}`);
    console.error('Revisa que el token sea valido y que el proyecto exista.');
    process.exit(1);
  }
  console.log(`Incidencias ya cargadas: ${yaEstan.size}\n`);

  const lista = SOLO
    ? datos.incidencias.filter((i) => i.ref === SOLO)
    : datos.incidencias;

  if (lista.length === 0) {
    console.error(SOLO ? `No existe ${SOLO} en el JSON.` : 'El JSON no tiene incidencias.');
    process.exit(1);
  }

  const resumen = { creadas: 0, omitidas: 0, fallidas: 0 };

  for (const inc of lista) {
    const titulo = `${inc.ref} — ${inc.resumen}`;

    if (yaEstan.has(titulo)) {
      console.log(`=  ${inc.ref} ya estaba (#${yaEstan.get(titulo)}).`);
      resumen.omitidas += 1;
      continue;
    }

    if (SECO) {
      console.log(`+  ${inc.ref} se crearia: ${inc.categoria} / ${inc.severidad} / ${inc.prioridad}`);
      resumen.creadas += 1;
      continue;
    }

    try {
      const id = await crear(inc);
      process.stdout.write(`+  ${inc.ref} -> #${id}`);

      for (const nota of inc.notas || []) {
        await anotar(id, nota);
        process.stdout.write(' .');
      }

      // El registro de horas se deja como nota y no por el campo de tiempo:
      // la API REST de Mantis 2.28 no expone el registro de horas, y una nota
      // con el numero es informacion igual de util y no obliga a tocar la
      // base por abajo.
      if (inc.horas) {
        await anotar(id, `Tiempo dedicado: ${inc.horas} h.`);
        process.stdout.write(' .');
      }

      // El ciclo de vida se recorre de verdad: nueva -> asignada -> resuelta
      // -> cerrada. Crear la incidencia ya cerrada dejaria el historial vacio,
      // y el historial es justamente lo que el punto 11 pide mostrar.
      if (inc.estado !== 'new') {
        await cambiarEstado(id, 'assigned');
        process.stdout.write(' >');
      }
      if (['resolved', 'closed'].includes(inc.estado)) {
        await cambiarEstado(id, 'resolved', inc.resolucion || 'fixed');
        process.stdout.write(' >');
      }
      if (inc.estado === 'closed') {
        await cambiarEstado(id, 'closed', inc.resolucion || 'fixed');
        process.stdout.write(' >');
      }
      if (inc.estado === 'acknowledged') {
        await cambiarEstado(id, 'acknowledged');
        process.stdout.write(' >');
      }

      console.log(' listo.');
      resumen.creadas += 1;

      // Mantis es PHP con sesiones: un ritmo demasiado alto le saca errores
      // 500 que no dicen nada. Medio segundo alcanza.
      await esperar(500);
    } catch (e) {
      console.log('');
      console.error(`!  ${inc.ref} fallo: ${e.message}`);
      resumen.fallidas += 1;
    }
  }

  console.log(`\nCreadas: ${resumen.creadas} | ya estaban: ${resumen.omitidas} | fallidas: ${resumen.fallidas}`);
  if (resumen.fallidas > 0) process.exit(1);
  console.log(`Ver: ${URL_BASE}/view_all_bug_page.php`);
})();
