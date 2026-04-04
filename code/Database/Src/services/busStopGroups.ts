export type BusStopGroupDefinition = {
  groupId: string;
  code: string;
  name: string;
  localityName: string;
  latitude: number;
  longitude: number;
  memberStopIds: string[];
  keywords: string[];
};

function getStandCode(stopId: string): string {
  const trailingDigits = stopId.match(/(\d+)$/)?.[1] ?? stopId;
  if (/^\d+$/.test(trailingDigits) && trailingDigits.length > 4) {
    return String(Number.parseInt(trailingDigits.slice(-4), 10));
  }
  return /^\d+$/.test(trailingDigits) ? String(Number.parseInt(trailingDigits, 10)) : trailingDigits;
}

const LANCASTER_BUS_STATION: BusStopGroupDefinition = {
  groupId: "lancaster_bus_station",
  code: "lancaster_bus_station",
  name: "Lancaster Bus Station",
  localityName: "Lancaster City Centre",
  latitude: 54.0505,
  longitude: -2.80075,
  memberStopIds: [
    "250020300",
    "250020301",
    "250020302",
    "250020304",
    "250020311",
    "250020312",
    "250020313",
    "250020314",
    "250020315",
    "250020316",
    "250020317",
    "250020318",
    "2500DCL3104",
    "2500DCL3106",
    "2500IMG1283",
    "2500IMG1287",
    "2500IMG1289",
    "2500IMG1291",
    "2500IMG1293",
  ],
  keywords: ["lancaster", "bus station", "lancaster city centre"],
};

const PRESTON_BUS_STATION: BusStopGroupDefinition = {
  groupId: "preston_bus_station",
  code: "preston_bus_station",
  name: "Preston Bus Station",
  localityName: "Preston City Centre",
  latitude: 53.761,
  longitude: -2.696,
  memberStopIds: [
    "2500JB18",
    "2500LA00028",
    "2500JB24",
    "2500JB16",
    "2500JB80",
    "2500JB23",
    "2500JB66",
    "2500JB141",
    "2500JB115",
    "2500JB20",
    "2500JB19",
    "2500JB140",
    "2500JB33",
    "25003126",
    "2500JB67",
    "2500JB78",
    "2500JB124",
    "25003123",
    "2500JB142",
  ],
  keywords: ["preston", "bus station", "preston city centre"],
};

const CHORLEY_BUS_STATION: BusStopGroupDefinition = {
  groupId: "chorley_bus_station",
  code: "chorley_bus_station",
  name: "Chorley Bus Station",
  localityName: "Chorley Town Centre",
  latitude: 53.6529,
  longitude: -2.6281,
  memberStopIds: [
    "250020913",
    "2500LA00027",
    "250020907",
    "250020908",
    "250020912",
    "250020903",
    "250020915",
  ],
  keywords: ["chorley", "bus station", "chorley town centre"],
};

const MORECAMBE_BUS_STATION: BusStopGroupDefinition = {
  groupId: "morecambe_bus_station",
  code: "morecambe_bus_station",
  name: "Morecambe Bus Station",
  localityName: "Morecambe",
  latitude: 54.0706,
  longitude: -2.8708,
  memberStopIds: [
    "250020023",
    "2500DCL4039",
    "2500966",
    "2500DCL4040",
  ],
  keywords: ["morecambe", "bus station"],
};

const BUS_STOP_GROUPS = [
  LANCASTER_BUS_STATION,
  PRESTON_BUS_STATION,
  CHORLEY_BUS_STATION,
  MORECAMBE_BUS_STATION,
] as const;
const GROUP_BY_ID = new Map(BUS_STOP_GROUPS.map((group) => [group.groupId, group]));
const GROUP_BY_MEMBER_STOP_ID = new Map(
  BUS_STOP_GROUPS.flatMap((group) => group.memberStopIds.map((stopId) => [stopId, group] as const))
);

export function getBusStopGroup(groupId: string): BusStopGroupDefinition | null {
  return GROUP_BY_ID.get(groupId) ?? null;
}

export function getBusStopGroupForStop(stopId: string): BusStopGroupDefinition | null {
  return GROUP_BY_MEMBER_STOP_ID.get(stopId) ?? null;
}

export function formatBusStopGroupMemberName(stopId: string, fallbackName: string): string {
  const group = getBusStopGroupForStop(stopId);
  if (!group) return fallbackName;
  return `${group.name} · Stand ${getStandCode(stopId)}`;
}

export function searchBusStopGroups(query: string): BusStopGroupDefinition[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return BUS_STOP_GROUPS.filter((group) => {
    const haystack = [group.name, group.localityName, ...group.keywords].map((value) => value.toLowerCase());
    return haystack.some((value) => value.includes(q) || q.includes(value));
  });
}
