export interface ParsedRailStop {
  stationId: string;
  arrival?: Date;
  departure?: Date;
  stopOrder: number;
}

export interface ParsedRailRoute {
  routeId: string;
  operatorId?: string;
  stops: ParsedRailStop[];
}