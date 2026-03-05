import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NAPTAN_API_BASE_URL: requireEnv("NAPTAN_API_BASE_URL"),
  RAIL_TIMETABLE_PATH: requireEnv("RAIL_TIMETABLE_PATH"),
  TRANSPORT_SERVER_BASE_URL:
    process.env.TRANSPORT_SERVER_BASE_URL ?? "http://transport.scc.lancs.ac.uk",
};
