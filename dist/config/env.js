"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env var: ${name}`);
    return v;
}
exports.env = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    PORT: parseInt(process.env.PORT ?? "3000", 10),
    DATABASE_URL: requireEnv("DATABASE_URL"),
};
