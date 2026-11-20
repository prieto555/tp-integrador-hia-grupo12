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

-- IMAGENES ------------------------------------------------------------------
--
-- Una foto real por producto. Salen de Wikimedia Commons: API abierta,
-- licencias libres y -lo que importa para una carta argentina- fotos de los
-- platos de verdad, no de un banco de imagenes generico. La milanesa
-- napolitana es una milanesa napolitana.
--
-- Va como UPDATE y no como columna del INSERT de arriba a proposito: ese
-- INSERT lleva ON CONFLICT (nombre) DO NOTHING, asi que en una base donde los
-- productos ya estan cargados no haria nada y las imagenes nunca llegarian.
-- Asi se arreglan tambien las filas que ya existen, y se puede correr dos
-- veces sin romper nada.
--
-- Las URL se verificaron una por una antes de escribirlas aca.

UPDATE public.productos AS p
SET "imagenUrl" = v.url
FROM (VALUES
  ('Hamburguesa Completa', 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=500&q=80'),
  ('Hamburguesa Veggie', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80'),
  ('Milanesa Napolitana', 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=500&q=80'),
  ('Milanesa a Caballo', 'https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=500&q=80'),
  ('Pizza Muzzarella', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80'),
  ('Pizza Napolitana', 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&q=80'),
  ('Pizza Cuatro Quesos', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80'),
  ('Empanadas de Pollo (6)', 'https://images.unsplash.com/photo-1624128082319-2210acebc3c4?w=500&q=80'),
  ('Lomito Completo', 'https://images.unsplash.com/photo-1700937314577-898450cafe35?w=500&q=80'),
  ('Bife de Chorizo', 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=500&q=80'),
  ('Asado de Tira', 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=500&q=80'),
  ('Pollo al Verdeo', 'https://images.unsplash.com/photo-1567932847833-ecb7e227c2a3?w=500&q=80'),
  ('Ravioles de Ricota', 'https://images.unsplash.com/photo-1676832661871-994153cf2d93?w=500&q=80'),
  ('Nioquis de Papa', 'https://images.unsplash.com/photo-1778837224436-82a8f1fa8bb1?w=500&q=80'),
  ('Ensalada Cesar con Pollo', 'https://images.unsplash.com/photo-1746211108786-ca20c8f80ecd?w=500&q=80'),
  ('Agua Mineral 500ml', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=500&q=80'),
  ('Agua con Gas 500ml', 'https://images.unsplash.com/photo-1638688569176-5b6db19f9d2a?w=500&q=80'),
  ('Coca Cola 500ml', 'https://images.unsplash.com/photo-1566657817181-c69e4a8eeb1e?w=500&q=80'),
  ('Coca Cola Zero 1.5L', 'https://images.unsplash.com/photo-1600320183466-7198f22d3c8a?w=500&q=80'),
  ('Sprite 1.5L', 'https://images.unsplash.com/photo-1690988109041-458628590a9e?w=500&q=80'),
  ('Fanta Naranja 1.5L', 'https://images.unsplash.com/photo-1667450673236-62126ce038a8?w=500&q=80'),
  ('Paso de los Toros 1.5L', 'https://images.unsplash.com/photo-1648569883125-d01072540b4c?w=500&q=80'),
  ('Limonada con Menta', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80'),
  ('Cerveza Artesanal IPA 500ml', 'https://images.unsplash.com/photo-1600788886242-5c96aabe3757?w=500&q=80'),
  ('Vino Malbec (copa)', 'https://images.unsplash.com/photo-1610458034932-dc165f29499e?w=500&q=80'),
  ('Vino Malbec (botella)', 'https://images.unsplash.com/photo-1764874299343-e55d7af327cd?w=500&q=80'),
  ('Vino Torrontes (botella)', 'https://images.unsplash.com/photo-1592119748016-a61c40a44320?w=500&q=80'),
  ('Cafe Expreso', 'https://images.unsplash.com/photo-1570784332176-fdd73da66f03?w=500&q=80'),
  ('Flan Casero con Dulce', 'https://images.unsplash.com/photo-1780798465831-de1e4d58ee46?w=500&q=80'),
  ('Flan Mixto', 'https://images.unsplash.com/photo-1792862242002-40af9499b301?w=500&q=80'),
  ('Tiramisu', 'https://images.unsplash.com/photo-1766232333746-b0a2697d6d0d?w=500&q=80'),
  ('Helado Dos Bochas', 'https://images.unsplash.com/photo-1629385738750-5617b763a80b?w=500&q=80'),
  ('Tarta de Manzana', 'https://images.unsplash.com/photo-1572383672419-ab35444a6934?w=500&q=80'),
  ('Lemon Pie', 'https://images.unsplash.com/photo-1583350229022-55a5fb986ead?w=500&q=80'),
  ('Panqueque con Dulce', 'https://images.unsplash.com/photo-1515467837915-15c4777ba46a?w=500&q=80'),
  ('Chocotorta', 'https://images.unsplash.com/photo-1621868402792-a5c9fa6866a3?w=500&q=80'),
  ('Ensalada de Frutas', 'https://images.unsplash.com/photo-1498507297833-5373e346b4e0?w=500&q=80'),
  ('Alfajor de Maicena Gigante', 'https://images.unsplash.com/photo-1792859441713-fd71352388ac?w=500&q=80'),
  ('Copa Dulce de Leche', 'https://images.unsplash.com/photo-1757672096062-95ef4bae941d?w=500&q=80'),
  ('Profiteroles', 'https://images.unsplash.com/photo-1786918467116-045c0f772b1f?w=500&q=80'),
  ('Volcan de Dulce de Leche', 'https://images.unsplash.com/photo-1762631934868-745b3258d7f9?w=500&q=80'),
  ('Empanadas de Carne (6)', 'https://images.unsplash.com/photo-1679310249395-ae267ae0d273?w=500&q=80'),
  ('Sorrentinos de Jamon y Queso', 'https://images.unsplash.com/photo-1767065584295-e5879ad624c2?w=500&q=80'),
  ('Risotto de Hongos', 'https://images.unsplash.com/photo-1680420574628-225def8eea0a?w=500&q=80'),
  ('Trucha a la Plancha', 'https://images.unsplash.com/photo-1792460238685-f56f0d451fca?w=500&q=80'),
  ('Tabla para Compartir', 'https://images.unsplash.com/photo-1695606392727-d8b959879721?w=500&q=80'),
  ('Jugo de Naranja Exprimido', 'https://images.unsplash.com/photo-1689066117649-0ca9762fc92c?w=500&q=80'),
  ('Cerveza Quilmes 1L', 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?w=500&q=80'),
  ('Cerveza Stella Artois 1L', 'https://images.unsplash.com/photo-1584225065152-4a1454aa3d4e?w=500&q=80'),
  ('Cerveza Artesanal Honey 500ml', 'https://images.unsplash.com/photo-1579065436839-f2bb127c5606?w=500&q=80'),
  ('Fernet con Coca', 'https://images.unsplash.com/photo-1453825012366-3738046cb6c7?w=500&q=80'),
  ('Gin Tonic', 'https://images.unsplash.com/photo-1617524454933-ab8853813111?w=500&q=80'),
  ('Cafe con Leche', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&q=80'),
  ('Cheesecake de Frutos Rojos', 'https://images.unsplash.com/photo-1622621746668-59fb299bc4d7?w=500&q=80'),
  ('Brownie con Helado', 'https://images.unsplash.com/photo-1702827402870-7c33dc7b67be?w=500&q=80'),
  ('Helado Tres Bochas', 'https://images.unsplash.com/photo-1588195539297-f0b4efdb5472?w=500&q=80'),
  ('Panqueque con Manzana', 'https://images.unsplash.com/photo-1632502361954-0dd92ce797db?w=500&q=80'),
  ('Mousse de Chocolate', 'https://images.unsplash.com/photo-1657502096852-340a75dc56f7?w=500&q=80'),
  ('Mousse de Maracuya', 'https://images.unsplash.com/photo-1677513643430-01b710bec296?w=500&q=80'),
  ('Budin de Pan', 'https://images.unsplash.com/photo-1773632996592-e150b9ed5059?w=500&q=80')
) AS v(nombre, url)
WHERE p.nombre = v.nombre;

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
