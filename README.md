# Backend - Sistema de Gestión de Pedidos y Delivery

Este es el backend del sistema de restaurante y delivery desarrollado con **Node.js, Express y PostgreSQL (Sequelize)**. Implementa el patrón arquitectónico MVC, protecciones de seguridad, validaciones de servidor y consumo de APIs de terceros (MercadoPago y Google Auth).

## 🚀 Requisitos de Instalación

1. Clonar el repositorio.
2. Ejecutar `npm install` para instalar las dependencias.
3. Crear una base de datos PostgreSQL local (o en la nube).
4. Configurar el archivo `.env` en la raíz del proyecto basándose en `.env.example`.
5. Ejecutar `npm run dev` para iniciar en modo desarrollo o `npm start` para producción.

### Variables de Entorno (`.env`)
```env
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=proybackendgrupo13final
DB_DIALECT=postgres
JWT_SECRET=tu_secreto_muy_seguro
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=admin
FRONTEND_URL=http://localhost:4200
```

---

## 🛡️ Seguridad Implementada
- **Helmet:** Protección contra vulnerabilidades de cabeceras HTTP.
- **Express-Rate-Limit:** Prevención de ataques de fuerza bruta en el endpoint de Login.
- **Express-Validator:** Validaciones estrictas del lado del servidor.
- **CORS:** Configurado para aceptar peticiones seguras del frontend.
- **JWT (JSON Web Tokens):** Autenticación sin estado para proteger endpoints privados.

---

## 📍 Rutas de la API (Endpoints)

La documentación interactiva completa puede probarse levantando el servidor e ingresando a: **`http://localhost:3000/api-docs`** (Swagger).

### Autenticación (`/api/auth`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/login` | Inicia sesión y devuelve JWT | Público |
| POST | `/google` | Inicia sesión con token de Google OAuth | Público |

### Usuarios (`/api/usuarios`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Lista todos los usuarios | Gerente |
| POST | `/` | Crea un nuevo usuario | Gerente |
| PUT | `/:id` | Modifica un usuario existente | Gerente |
| DELETE | `/:id` | Elimina un usuario | Gerente |

### Productos (`/api/productos`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Lista el menú | Público |
| GET | `/:id` | Obtiene un producto por ID | Público |
| POST | `/` | Agrega un nuevo producto | Gerente |
| PUT | `/:id` | Edita precio/datos del producto | Gerente |
| DELETE | `/:id` | Borra un producto del menú | Gerente |

### Mesas (`/api/mesas`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Lista las mesas y sus estados | Gerente, Mozo |
| PUT | `/:id/estado` | Cambia el estado (LIBRE/OCUPADA) | Gerente, Mozo |

### Pedidos (`/api/pedidos`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/` | Crea un pedido (Local o Delivery) | Mozo, Cliente |
| GET | `/` | Lista los pedidos | Gerente, Cajero |
| PUT | `/:id/estado` | Cambia el estado del pedido | Gerente, Cocina |

### Cocina (`/api/cocina`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/items-pendientes` | Lista platos/bebidas por preparar | Cocina, Gerente |
| PUT | `/marcar-listo/:id` | Cambia a "LISTO" un item | Cocina, Gerente |

---
*Desarrollado para la cátedra Programación y Servicios Web - UNJu*
