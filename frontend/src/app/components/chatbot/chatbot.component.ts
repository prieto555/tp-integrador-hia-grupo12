import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ChatbotService } from '../../services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent {
  mostrarChat = false;
  nuevoMensaje = '';
  cargando = false;
  mensajes: { texto: string, emisor: 'bot' | 'usuario' }[] = [
    { texto: '¡Hola! Soy el asistente de RestoYa. ¿En qué puedo ayudarte?', emisor: 'bot' }
  ];

  constructor(private chatbotService: ChatbotService) {}

  toggleChat() { this.mostrarChat = !this.mostrarChat; }

  preguntar() {
    if (!this.nuevoMensaje.trim() || this.cargando) return;

    const consulta = this.nuevoMensaje;
    this.mensajes.push({ texto: consulta, emisor: 'usuario' });
    this.nuevoMensaje = '';
    this.cargando = true;

    this.chatbotService.enviarConsulta(consulta).subscribe({
      next: (res) => {
        this.mensajes.push({ texto: res.respuesta, emisor: 'bot' });
        this.cargando = false;
      },
      error: () => {
        this.mensajes.push({ texto: 'Lo siento, hubo un error de conexión.', emisor: 'bot' });
        this.cargando = false;
      }
    });
  }
}