-- Carta ampliada de RestoYa: 20 platos principales, 20 bebidas y 20 postres.
--
-- Por que existe este archivo y no se toco la semilla del backend: la semilla
-- de config/seed.js solo corre cuando la tabla esta VACIA (countProductos === 0).
-- En una base que ya tiene datos no se ejecuta nunca, asi que agregar productos
-- ahi no cambiaria nada en esta instalacion. Esto se corre a mano, una vez.
--
--   docker exec -i restoya_db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     < infra/postgres/productos-carta.sql
--
-- Es REEJECUTABLE: el ON CONFLICT sobre el nombre evita duplicados si se corre
-- dos veces. Para eso hace falta un indice unico, que se crea aca abajo si no
-- existe; la tabla no lo traia porque el modelo de Sequelize no lo declara.
--
-- Los precios estan en pesos y siguen la escala de los cuatro productos que ya
-- estaban (hamburguesa 8500, pizza 12000, gaseosa 3000, postre 4500).
-- precioCosto y porcentajeGanancia quedan en NULL igual que los originales:
-- la aplicacion usa "precio" y los otros dos campos hoy no se cargan.

BEGIN;

-- Sin esto el ON CONFLICT no tiene con que inferir el conflicto y falla con
-- "there is no unique or exclusion constraint matching the ON CONFLICT".
CREATE UNIQUE INDEX IF NOT EXISTS productos_nombre_unico
    ON public.productos (nombre);

INSERT INTO public.productos (nombre, descripcion, precio, categoria) VALUES

-- ---------------------------------------------------------------- PLATOS ---
('Hamburguesa Completa',      'Doble carne, cheddar, huevo, jamon, lechuga y tomate',      9800,  'plato_principal'),
('Hamburguesa Veggie',        'Medallon de garbanzo y remolacha, rucula y alioli',         8200,  'plato_principal'),
('Milanesa Napolitana',       'De ternera, con jamon, salsa y mozzarella, con papas',     11500,  'plato_principal'),
('Milanesa a Caballo',        'De ternera con dos huevos fritos y papas rusticas',        11000,  'plato_principal'),
('Pizza Muzzarella',          'Mozzarella, aceitunas verdes y oregano',                   10500,  'plato_principal'),
('Pizza Napolitana',          'Mozzarella, rodajas de tomate y ajo',                      11800,  'plato_principal'),
('Pizza Cuatro Quesos',       'Mozzarella, roquefort, parmesano y provolone',             13500,  'plato_principal'),
('Empanadas de Carne (6)',    'Cortadas a cuchillo, al horno de barro',                    7200,  'plato_principal'),
('Empanadas de Pollo (6)',    'Con cebolla de verdeo y morron',                            7000,  'plato_principal'),
('Lomito Completo',           'Lomo, jamon, queso, huevo y ensalada, con papas',          13900,  'plato_principal'),
('Bife de Chorizo',           'De 400 g a la parrilla, con guarnicion a eleccion',        16500,  'plato_principal'),
('Asado de Tira',             'Tira de asado a la parrilla con chimichurri',              15800,  'plato_principal'),
('Pollo al Verdeo',           'Suprema en salsa de verdeo con pure rustico',              11200,  'plato_principal'),
('Ravioles de Ricota',        'Caseros, con salsa fileto o crema a eleccion',             10800,  'plato_principal'),
('Sorrentinos de Jamon y Queso', 'Con salsa rosa y parmesano rallado',                    11600,  'plato_principal'),
('Nioquis de Papa',           'Caseros, con salsa bolognesa',                              9900,  'plato_principal'),
('Risotto de Hongos',         'Arroz carnaroli con portobellos y parmesano',              12400,  'plato_principal'),
('Trucha a la Plancha',       'Con limon, alcaparras y vegetales salteados',              15200,  'plato_principal'),
('Ensalada Cesar con Pollo',  'Lechuga, croutones, parmesano y aderezo cesar',             8900,  'plato_principal'),
('Tabla para Compartir',      'Picada de fiambres, quesos y encurtidos para dos',         14500,  'plato_principal'),

-- --------------------------------------------------------------- BEBIDAS ---
('Agua Mineral 500ml',        'Sin gas',                                                   1800,  'bebida'),
('Agua con Gas 500ml',        'Con gas',                                                   1800,  'bebida'),
('Coca Cola 500ml',           'Gaseosa linea Coca Cola',                                   2200,  'bebida'),
('Coca Cola Zero 1.5L',       'Gaseosa sin azucar',                                        3000,  'bebida'),
('Sprite 1.5L',               'Gaseosa lima limon',                                        2900,  'bebida'),
('Fanta Naranja 1.5L',        'Gaseosa sabor naranja',                                     2900,  'bebida'),
('Paso de los Toros 1.5L',    'Pomelo amargo',                                             2900,  'bebida'),
('Limonada con Menta',        'Jarra de un litro, con menta y jengibre',                   4800,  'bebida'),
('Jugo de Naranja Exprimido', 'Vaso de 400 ml, recien exprimido',                          3500,  'bebida'),
('Cerveza Quilmes 1L',        'Rubia, en botella retornable',                              4200,  'bebida'),
('Cerveza Stella Artois 1L',  'Rubia, en botella',                                         5200,  'bebida'),
('Cerveza Artesanal IPA 500ml','De la casa, lupulada y amarga',                            5600,  'bebida'),
('Cerveza Artesanal Honey 500ml','De la casa, suave y con miel',                           5400,  'bebida'),
('Vino Malbec (copa)',        'Copa de Malbec de Mendoza',                                 4500,  'bebida'),
('Vino Malbec (botella)',     'Botella de 750 ml, Malbec de Mendoza',                     18000,  'bebida'),
('Vino Torrontes (botella)',  'Botella de 750 ml, blanco de Cafayate',                    16500,  'bebida'),
('Fernet con Coca',           'Medida doble, con hielo',                                   6500,  'bebida'),
('Gin Tonic',                 'Gin nacional, tonica y rodaja de pomelo',                   7200,  'bebida'),
('Cafe Expreso',              'Pocillo',                                                   1900,  'bebida'),
('Cafe con Leche',            'En taza grande, con medialuna',                             2800,  'bebida'),

-- --------------------------------------------------------------- POSTRES ---
('Flan Casero con Dulce',     'Con dulce de leche repostero',                              4200,  'postre'),
('Flan Mixto',                'Con dulce de leche y crema batida',                         4600,  'postre'),
('Tiramisu',                  'Mascarpone, cafe y cacao amargo',                           5200,  'postre'),
('Cheesecake de Frutos Rojos','Base de galleta y coulis de frutos rojos',                  5400,  'postre'),
('Brownie con Helado',        'Brownie tibio de chocolate con helado de crema',            5000,  'postre'),
('Helado Dos Bochas',         'Sabores a eleccion',                                        3800,  'postre'),
('Helado Tres Bochas',        'Sabores a eleccion, con salsa',                             4800,  'postre'),
('Tarta de Manzana',          'Porcion tibia con canela',                                  4400,  'postre'),
('Lemon Pie',                 'Porcion con merengue flameado',                             4600,  'postre'),
('Panqueque con Dulce',       'Dos panqueques con dulce de leche',                         4000,  'postre'),
('Panqueque con Manzana',     'Relleno de manzana y canela, flameado',                     4700,  'postre'),
('Chocotorta',                'Porcion, receta clasica',                                   4900,  'postre'),
('Mousse de Chocolate',       'Con virutas de chocolate semiamargo',                       4300,  'postre'),
('Mousse de Maracuya',        'Con coulis de maracuya',                                    4500,  'postre'),
('Ensalada de Frutas',        'De estacion, con jugo de naranja',                          3600,  'postre'),
('Budin de Pan',              'Casero, con pasas de uva y caramelo',                       3900,  'postre'),
('Alfajor de Maicena Gigante','Con dulce de leche y coco rallado',                         3200,  'postre'),
('Copa Dulce de Leche',       'Helado de dulce de leche, crema y nueces',                  5100,  'postre'),
('Profiteroles',              'Rellenos de crema, con salsa de chocolate',                 5300,  'postre'),
('Volcan de Dulce de Leche',  'Con centro liquido y bocha de helado',                      5500,  'postre')

ON CONFLICT (nombre) DO NOTHING;

-- Imagen de respaldo para todo lo que no tenga una.
--
-- NO es cosmetico: las tres pantallas de la carta hacen <img [src]="p.imagenUrl">
-- sin ninguna alternativa, asi que un producto sin imagen se dibuja como un
-- icono roto. Con sesenta productos nuevos eso serian sesenta iconos rotos.
--
-- Se usa un marcador con el nombre del producto y los colores de la aplicacion
-- (#1a1a1a de fondo, #ffc107 de texto). Los cuatro productos originales ya
-- tienen foto y el WHERE los deja como estan.
UPDATE public.productos
SET "imagenUrl" = 'https://placehold.co/500x300/1a1a1a/ffc107?text='
    || replace(nombre, ' ', '+')
WHERE "imagenUrl" IS NULL OR "imagenUrl" = '';

COMMIT;

-- Control: cuantos quedaron por categoria.
SELECT categoria, count(*) AS productos
FROM public.productos
GROUP BY categoria
ORDER BY categoria;
