import type {
  BusLiveSnapshot,
  RailBoardSnapshot,
  WeatherSnapshot,
} from "../../infrastructure/apiClients/TransportServerClient";

/**
 * Abstraction over an upstream transport data provider. New providers can be
 * plugged in by implementing this interface without changing ingestion or
 * verification services (Open-Closed Principle).
 */
export interface TransportApiClient {
  getWeather(lat: number, lon: number): Promise<WeatherSnapshot>;
  getRailDepartures(crs: string): Promise<RailBoardSnapshot>;
  getBusLive(operatorRef: string): Promise<BusLiveSnapshot>;
}
