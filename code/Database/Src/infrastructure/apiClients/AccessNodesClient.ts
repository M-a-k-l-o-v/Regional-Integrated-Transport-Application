import axios from "axios";

export class AccessNodesClient {
  constructor(private readonly baseUrl: string) {}

  async fetchAccessNodesCsv(atcoAreaCodes: string[]): Promise<string> {
    const params = new URLSearchParams();
    params.set("dataFormat", "CSV");
    params.set("atcoAreaCodes", atcoAreaCodes.join(","));

    const url = `${this.baseUrl}/v1/access-nodes?${params.toString()}`;

    const res = await axios.get(url, {
      timeout: 60000,
      responseType: "text",
      headers: { Accept: "text/csv" },
    });

    return res.data as string;
  }
}