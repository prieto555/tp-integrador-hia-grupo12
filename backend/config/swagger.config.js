const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Gestión de Pedidos - Grupo 13',
      version: '1.0.0',
      description: 'Documentación de la API para el Trabajo Final Integrador de Programación y Servicios Web.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de Desarrollo Local',
      },
      {
        url: 'https://proybackendgrupo13-9bp9.onrender.com',
        description: 'Servidor de Producción (Render)',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Documentamos las rutas clave mediante comentarios JSDoc
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
