import { ParsedRailRoute } from "./types";

export class RailRecordDispatcher {
  private currentRoute: ParsedRailRoute | null = null;
  private routes: ParsedRailRoute[] = [];

  handleLine(line: string) {
    const recordType = line.substring(0, 2);

    switch (recordType) {
      case "BS":
        this.startService(line);
        break;
      case "LO":
      case "LI":
        this.addStop(line);
        break;
      case "LT":
        this.endService();
        break;
      default:
        break;
    }
  }

  private startService(line: string) {
    // TODO: extract routeId and operatorId from BS record
    this.currentRoute = {
      routeId: "TEMP",
      stops: [],
    };
  }

  private addStop(line: string) {
    if (!this.currentRoute) return;

    // TODO: extract stationId and times
    this.currentRoute.stops.push({
      stationId: "TEMP",
      stopOrder: this.currentRoute.stops.length,
    });
  }

  private endService() {
    if (!this.currentRoute) return;

    this.routes.push(this.currentRoute);
    this.currentRoute = null;
  }

  buildRoutes(): ParsedRailRoute[] {
    return this.routes;
  }
}