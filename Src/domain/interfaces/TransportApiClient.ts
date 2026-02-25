export type Json = unknown;

export interface TransportApiClient {
  fetchStations(query?: string): Promise<Json>;
  fetchRoutes(query?: string): Promise<Json>;
  fetchLiveStatus(query?: string): Promise<Json>;
}