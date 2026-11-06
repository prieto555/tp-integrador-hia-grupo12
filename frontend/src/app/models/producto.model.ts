export interface Producto {
    idProducto: number;
    nombre: string;
    descripcion?: string; // agregado para la vista premium
    precio: number;
    imagenUrl: string; // falta en el diagrama
    categoria: string;
}
