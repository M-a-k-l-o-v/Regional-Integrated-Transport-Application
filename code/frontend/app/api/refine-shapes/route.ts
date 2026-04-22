import { NextResponse } from "next/server";
import { routeGeometryService } from "../../journeys/RouteGeometryService";
import { JourneyRouteShape } from "../../journeys/types";

export const runtime = "nodejs";

type RefineShapesBody = {
  routeShapes?: JourneyRouteShape[];
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: RefineShapesBody;
  try {
    body = (await request.json()) as RefineShapesBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.routeShapes)) {
    return NextResponse.json({ error: "routeShapes must be an array" }, { status: 400 });
  }

  const refined = await routeGeometryService.refineShapes(body.routeShapes);
  return NextResponse.json({ routeShapes: refined });
}
