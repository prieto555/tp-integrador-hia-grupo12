import { EstadoMesa } from './enums/estado-mesa.enum';
export interface Mesa {
 idMesa: number; 
 numMesa: number;
 capacidad: number;
 estado: EstadoMesa;
}
