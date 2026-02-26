import { ParsedRailRoute } from "./types";
import { RailRecordDispatcher } from "./RailRecordDispatcher";

export class RailTimetableParser {
  parse(raw: string): ParsedRailRoute[] {
    const lines = raw.split("\n");

    const dispatcher = new RailRecordDispatcher();

    for (const line of lines) {
      dispatcher.handleLine(line);
    }

    return dispatcher.buildRoutes();
  }
}