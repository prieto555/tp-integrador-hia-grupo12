import { EstadoCocina } from './enums/estado-cocina.enum';
export interface Cocina {
    idCocina: number;
    nombre: string;
    estado: EstadoCocina;
}
