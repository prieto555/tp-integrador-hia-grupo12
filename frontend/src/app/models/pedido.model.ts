import {EstadoPedido} from './enums/estado-pedido.enum';
import {TipoPedido} from './enums/tipo-pedido.enum';
import {Mesa} from './mesa.model';
import {DetallePedido} from './detalle-pedido.model';
import {Usuario} from './usuario.model';
import {Cocina} from './cocina.model';
export interface Pedido {
 idPedido: number;
 estado: EstadoPedido;
 tipoPedido: TipoPedido;
 fechaCreacion: string;
 mesa: Mesa;
//  detalles: DetallePedido[]; // falta en el diagrama
 usuario: Usuario;
 cocina: Cocina;
 
}
