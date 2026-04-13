/**
 * k6 load test — verifies NFR-05 (50 concurrent users).
 *
 * Install k6:  brew install k6  (macOS)  or  https://k6.io/docs/get-started/installation/
 * Run:         k6 run Src/__tests__/load/k6-load-test.js
 *
 * The test ramps to 50 virtual users over 30 seconds, holds for 2 minutes,
 * then ramps down. Thresholds enforce p95 < 4000ms (NFR-01) and
 * error rate < 5%.
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // ramp to 50 users
    { duration: "2m", target: 50 },  // hold at 50
    { duration: "15s", target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<4000"], // NFR-01: 95th percentile under 4s
    http_req_failed: ["rate<0.05"],    // less than 5% errors
  },
};

// Endpoints that mirror real user behaviour
const ENDPOINTS = [
  { path: "/health", tag: "health" },
  { path: "/search?q=lancaster&limit=10", tag: "search" },
  { path: "/weather/current?lat=54.047&lon=-2.801", tag: "weather" },
  { path: "/rail/departures/LAN?from=2026-05-04T08:00&windowMinutes=120&limit=10", tag: "rail_departures" },
  { path: "/rail/live/departures/LAN", tag: "rail_live" },
  { path: "/rail/stations/LAN/facilities", tag: "station_facilities" },
  { path: "/road/vms?road=M6", tag: "vms" },
];

export default function () {
  // Each virtual user hits a random endpoint per iteration
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const url = `${BASE_URL}${endpoint.path}`;

  const response = http.get(url, {
    tags: { name: endpoint.tag },
    timeout: "10s",
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 4s": (r) => r.timings.duration < 4000,
    "has body": (r) => r.body && r.body.length > 0,
  });

  // Simulate realistic think time between requests
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const passed =
    data.metrics.http_req_duration.values["p(95)"] < 4000 &&
    (data.metrics.http_req_failed.values.rate || 0) < 0.05;

  console.log("\n" + "=".repeat(60));
  console.log(passed ? "PASS — NFR-05 verified: 50 concurrent users supported" : "FAIL — Thresholds not met");
  console.log("=".repeat(60));
  console.log(`  p95 response time: ${data.metrics.http_req_duration.values["p(95)"].toFixed(0)}ms (threshold: <4000ms)`);
  console.log(`  Error rate: ${((data.metrics.http_req_failed.values.rate || 0) * 100).toFixed(2)}% (threshold: <5%)`);
  console.log(`  Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log("=".repeat(60) + "\n");

  return {};
}
