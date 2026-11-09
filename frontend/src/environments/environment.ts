// Configuracion de DESARROLLO.
//
// El backend corre fuera del contenedor, en el puerto 3000 de la propia
// maquina. Angular reemplaza este archivo por environment.production.ts
// al compilar para despliegue (ver fileReplacements en angular.json).

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
