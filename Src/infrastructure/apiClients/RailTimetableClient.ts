import axios from "axios";

export class RailTimetableClient {
  constructor(private readonly baseUrl: string) {}

  async fetchDailyTimetable(): Promise<string> {
    const res = await axios.get(`${this.baseUrl}/rail/timetable`, {
      responseType: "text",
      timeout: 30000,
    });

    return res.data;
  }
}