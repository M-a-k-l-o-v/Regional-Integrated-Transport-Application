// src/ingestion/coverage/coverageCrs.ts

/** Lancashire stations (from your Wikipedia batch) */
export const LANCASHIRE_CRS = new Set([
  "ACR","ADL","AFV","APB","AUG","BMB","BAR","BES","BBN","BPN","BPB","BPS","BRF","BSV",
  "BUB","BNC","BYM","BCB","BCJ","CNF","CYT","CRL","CTW","CLH","CNE","CSO","DWN","ENT",
  "EBA","HPN","HHB","HSC","HCT","KKM","LAN","LHO","LAY","LEY","LOH","LTM","MLH","MCM",
  "MOS","NEL","NLN","OMS","PBL","PLS","PFY","PRE","RGW","RIS","RSG","RUF","SLW","SVR",
  "SQU","SAS","TWN","UPL","WNN","WHE",
]);

/**
 * Manchester corridor set (KEEP THIS “corridor”, not “every GM station”)
 * Goal: realistic connectivity to Lancashire + Liverpool.
 */
export const MANCHESTER_CORRIDOR_CRS = new Set([
  // Manchester core
  "MAN", // Piccadilly
  "MCV", // Victoria
  "MCO", // Oxford Road
  "DGT", // Deansgate

  // Big interchanges on the corridor network
  "SPT", // Stockport (useful for south services + interchange)
  "MIA", // Manchester Airport (optional realism)

  // Manchester ↔ Lancashire spine (via Bolton/Wigan/Preston/Chorley etc.)
  "BON", // Bolton
  "BLK", // Blackrod
  "HWI", // Horwich Parkway
  "WGN", // Wigan North Western
  "WGW", // Wigan Wallgate

  // Manchester ↔ Southport line corridor nodes (ties into Lancs list stations like APB/PBL etc.)
  "ATN", // Atherton
]);

/** Liverpool / Merseyside corridor (filtered to what actually connects to Lancs) */
export const LIVERPOOL_CORRIDOR_CRS = new Set([
  // Liverpool core
  "LIV", // Lime Street
  "LVC", // Central
  "MRF", // Moorfields
  "LVJ", // James Street
  "LPY", // South Parkway

  // Corridor east of Liverpool (Lime Street ↔ St Helens ↔ Newton-le-Willows ↔ Manchester/Lancs)
  "EDG", // Edge Hill
  "WAV", // Wavertree Technology Park
  "BGE", // Broad Green
  "ROB", // Roby
  "HUY", // Huyton
  "PSC", // Prescot
  "WHN", // Whiston
  "ECL", // Eccleston Park
  "RNH", // Rainhill
  "LEG", // Lea Green  ✅ fixed
  "SNH", // St Helens Central
  "THH", // Thatto Heath
  "GSW", // Garswood
  "SHJ", // St Helens Junction
  "ERL", // Earlestown
  "NLW", // Newton-le-Willows
  "HNX", // Hunts Cross
]);

/** Final coverage set: Lancashire + Manchester corridor + Liverpool corridor */
export const COVERAGE_CRS = new Set<string>([
  ...LANCASHIRE_CRS,
  ...MANCHESTER_CORRIDOR_CRS,
  ...LIVERPOOL_CORRIDOR_CRS,
]);

/** Helper */
export const isInCoverage = (crs?: string | null) => !!crs && COVERAGE_CRS.has(crs);