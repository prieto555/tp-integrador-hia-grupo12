import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ClimaService {
  private readonly CACHE_KEY = 'weather_jujuy_data';
  private readonly CACHE_TIME_KEY = 'weather_jujuy_time';
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutos

  constructor(private http: HttpClient) { }

  obtenerClimaActual(): Observable<any> {
    const cachedWeather = localStorage.getItem(this.CACHE_KEY);
    const cachedTime = localStorage.getItem(this.CACHE_TIME_KEY);

    if (cachedWeather && cachedTime) {
      const timePassed = new Date().getTime() - parseInt(cachedTime, 10);
      if (timePassed < this.CACHE_DURATION_MS) {
        return of(JSON.parse(cachedWeather));
      }
    }

    const url = 'https://yahoo-weather5.p.rapidapi.com/weather?location=jujuy&format=json&u=c';
    const headers = new HttpHeaders({
      'x-rapidapi-key': '70889bd22bmshb9f83a922241315p1818f0jsn5cd39c90989d',
      'x-rapidapi-host': 'yahoo-weather5.p.rapidapi.com'
    });

    return this.http.get(url, { headers }).pipe(
      tap((data: any) => {
        const observation = data.current_observation;
        const climaData = {
          temperature: observation.condition.temperature,
          code: observation.condition.code
        };
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(climaData));
        localStorage.setItem(this.CACHE_TIME_KEY, new Date().getTime().toString());
      }),
      catchError((error) => {
        console.warn('RapidAPI falló (Posible límite de cuota excedido).');
        
        // 1. Si hay caché vieja, preferimos usar esa (aunque tenga más de 30 min) para no romper la app
        if (cachedWeather) {
          console.warn('Usando caché antigua como salvavidas.');
          return of(JSON.parse(cachedWeather));
        }
        
        // 2. Si NO hay caché, Plan B Extremo: API gratuita Open-Meteo
        console.warn('Activando Plan B: Open-Meteo API...');
        const fallbackUrl = 'https://api.open-meteo.com/v1/forecast?latitude=-24.1833&longitude=-65.3313&current_weather=true';
        
        return this.http.get(fallbackUrl).pipe(
          map((fallbackData: any) => {
            const omCode = fallbackData.current_weather.weathercode;
            const omTemp = fallbackData.current_weather.temperature;
            
            // Traducimos burdamente los códigos de Open-Meteo a la escala de Yahoo
            // para que el componente (interpretarClimaYahoo) lo entienda sin romperse.
            let yahooSimulatedCode = 32; // Por defecto: Soleado
            
            if (omCode >= 51 && omCode <= 67 || omCode >= 80 && omCode <= 82) yahooSimulatedCode = 11; // Lluvia
            else if (omCode >= 71 && omCode <= 77) yahooSimulatedCode = 16; // Nieve
            else if (omCode >= 95 && omCode <= 99) yahooSimulatedCode = 4; // Tormenta
            else if (omCode >= 1 && omCode <= 3) yahooSimulatedCode = 28; // Nublado
            else if (omCode >= 45 && omCode <= 48) yahooSimulatedCode = 20; // Niebla

            return {
              temperature: omTemp,
              code: yahooSimulatedCode
            };
          })
        );
      })
    );
  }
}
