import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransportServerClient } from "../infrastructure/apiClients/TransportServerClient";

const mockGet = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({ get: mockGet })),
  },
}));

describe("TransportServerClient", () => {
  let client: TransportServerClient;

  beforeEach(() => {
    mockGet.mockReset();
    client = new TransportServerClient("http://transport.example.com", 5000);
  });

  describe("getWeather", () => {
    it("maps a well-formed weather response", async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          in_bounds: true,
          weather: {
            name: "Lancaster",
            weather: [{ description: "light rain", icon: "10d" }],
            main: { temp: 12.5, feels_like: 10.2, humidity: 85 },
            wind: { speed: 4.1 },
            dt: 1700000000,
          },
        },
      });

      const result = await client.getWeather(54.04, -2.8);
      expect(result.inBounds).toBe(true);
      expect(result.locationName).toBe("Lancaster");
      expect(result.description).toBe("light rain");
      expect(result.temperatureC).toBe(12.5);
      expect(result.humidity).toBe(85);
      expect(result.updatedAt).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("returns nulls when weather data is missing", async () => {
      mockGet.mockResolvedValueOnce({ data: { in_bounds: false } });

      const result = await client.getWeather(0, 0);
      expect(result.inBounds).toBe(false);
      expect(result.locationName).toBeNull();
      expect(result.temperatureC).toBeNull();
    });
  });

  describe("getRailDepartures", () => {
    it("parses a valid XML board response", async () => {
      const xml = `
        <StationBoardWithDetails>
          <generatedAt>2024-01-15T09:30:00Z</generatedAt>
          <locationName>Lancaster</locationName>
          <crs>LAN</crs>
          <trainServices>
            <service>
              <std>09:45</std>
              <etd>On time</etd>
              <platform>1</platform>
              <operator>Avanti West Coast</operator>
              <operatorCode>VT</operatorCode>
              <serviceType>train</serviceType>
              <serviceID>abc123</serviceID>
              <rsid>VT001</rsid>
              <origin><location><locationName>London Euston</locationName></location></origin>
              <destination><location><locationName>Glasgow Central</locationName></location></destination>
            </service>
          </trainServices>
        </StationBoardWithDetails>
      `;

      mockGet.mockResolvedValueOnce({ data: xml });

      const result = await client.getRailDepartures("LAN");
      expect(result.locationName).toBe("Lancaster");
      expect(result.crs).toBe("LAN");
      expect(result.trainServices).toHaveLength(1);
      expect(result.trainServices[0].std).toBe("09:45");
      expect(result.trainServices[0].etd).toBe("On time");
      expect(result.trainServices[0].platform).toBe("1");
      expect(result.trainServices[0].operator).toBe("Avanti West Coast");
      expect(result.trainServices[0].destinationName).toBe("Glasgow Central");
    });

    it("returns empty arrays when no services are present", async () => {
      const xml = `<StationBoardWithDetails><locationName>Empty</locationName></StationBoardWithDetails>`;
      mockGet.mockResolvedValueOnce({ data: xml });

      const result = await client.getRailDepartures("EMT");
      expect(result.trainServices).toEqual([]);
      expect(result.busServices).toEqual([]);
      expect(result.nrccMessages).toEqual([]);
    });
  });

  describe("getBusLive", () => {
    it("parses a SIRI VehicleMonitoring response", async () => {
      const xml = `
        <Siri>
          <ServiceDelivery>
            <VehicleMonitoringDelivery>
              <ResponseTimestamp>2024-01-15T09:00:00Z</ResponseTimestamp>
              <ValidUntil>2024-01-15T09:05:00Z</ValidUntil>
              <VehicleActivity>
                <RecordedAtTime>2024-01-15T09:00:00Z</RecordedAtTime>
                <MonitoredVehicleJourney>
                  <LineRef>1</LineRef>
                  <PublishedLineName>1</PublishedLineName>
                  <OperatorRef>LNCS</OperatorRef>
                  <DirectionRef>outbound</DirectionRef>
                  <OriginName>Lancaster Bus Station</OriginName>
                  <DestinationName>Morecambe</DestinationName>
                  <OriginAimedDepartureTime>2024-01-15T09:00:00Z</OriginAimedDepartureTime>
                  <Monitored>true</Monitored>
                  <VehicleRef>LNCS-001</VehicleRef>
                  <VehicleLocation>
                    <Latitude>54.0466</Latitude>
                    <Longitude>-2.8007</Longitude>
                  </VehicleLocation>
                  <Bearing>270</Bearing>
                </MonitoredVehicleJourney>
              </VehicleActivity>
            </VehicleMonitoringDelivery>
          </ServiceDelivery>
        </Siri>
      `;

      mockGet.mockResolvedValueOnce({ data: xml });

      const result = await client.getBusLive("LNCS");
      expect(result.vehicles).toHaveLength(1);
      const v = result.vehicles[0];
      expect(v.lineRef).toBe("1");
      expect(v.operatorRef).toBe("LNCS");
      expect(v.latitude).toBe(54.0466);
      expect(v.longitude).toBe(-2.8007);
      expect(v.monitored).toBe(true);
    });

    it("returns empty vehicles array when no activities exist", async () => {
      const xml = `<Siri><ServiceDelivery><VehicleMonitoringDelivery></VehicleMonitoringDelivery></ServiceDelivery></Siri>`;
      mockGet.mockResolvedValueOnce({ data: xml });

      const result = await client.getBusLive("NONE");
      expect(result.vehicles).toEqual([]);
    });
  });
});
