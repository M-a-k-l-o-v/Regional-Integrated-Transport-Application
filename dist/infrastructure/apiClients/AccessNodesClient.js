"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessNodesClient = void 0;
const axios_1 = __importDefault(require("axios"));
class AccessNodesClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async fetchAccessNodesCsv(atcoAreaCodes) {
        const params = new URLSearchParams();
        params.set("dataFormat", "CSV");
        params.set("atcoAreaCodes", atcoAreaCodes.join(","));
        const url = `${this.baseUrl}/v1/access-nodes?${params.toString()}`;
        const res = await axios_1.default.get(url, {
            timeout: 60000,
            responseType: "text",
            headers: { Accept: "text/csv" },
        });
        return res.data;
    }
}
exports.AccessNodesClient = AccessNodesClient;
