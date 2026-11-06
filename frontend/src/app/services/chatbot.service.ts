import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/chatbot';
  constructor(private http: HttpClient) { }
  enviarConsulta(entrada: string): Observable<any> {
    return this.http.post(this.apiUrl, {prompt: entrada});
  }
}
