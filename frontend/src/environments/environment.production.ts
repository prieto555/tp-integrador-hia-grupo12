// Configuracion de DESPLIEGUE.
//
// La URL es relativa a proposito. En contenedores, nginx sirve el frontend
// y hace de proxy de /api hacia el backend por la red interna de Docker.
//
// Eso tiene tres consecuencias buenas:
//   - la imagen del frontend no lleva ninguna direccion adentro, asi que la
//     misma imagen sirve en cualquier entorno;
//   - el navegador habla con un solo origen, asi que no hay CORS que
//     configurar en produccion;
//   - el backend no necesita puerto publicado hacia afuera.

export const environment = {
  production: true,
  apiUrl: '/api',
};
