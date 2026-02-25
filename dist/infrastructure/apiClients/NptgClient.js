"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NptgClient = void 0;
const axios_1 = __importDefault(require("axios"));
class NptgClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async fetchLocalitiesCsv() {
        const url = `${this.baseUrl}/v1/nptg/localities`;
        const res = await axios_1.default.get(url, {
            timeout: 30000,
            responseType: "text",
            headers: { Accept: "text/csv" },
        });
        return res.data;
    }
}
exports.NptgClient = NptgClient;
