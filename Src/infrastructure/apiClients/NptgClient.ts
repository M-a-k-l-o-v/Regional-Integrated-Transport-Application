import axios from "axios";

export class NptgClient {
  constructor(private readonly baseUrl: string) {}

  async fetchLocalitiesCsv(): Promise<string> {
    const url = `${this.baseUrl}/v1/nptg/localities`;

    const res = await axios.get(url, {
      timeout: 30000,
      responseType: "text",
      headers: { Accept: "text/csv" },
    });

    return res.data as string;
  }
}