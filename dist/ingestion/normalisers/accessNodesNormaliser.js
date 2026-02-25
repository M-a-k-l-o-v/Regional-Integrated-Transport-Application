"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseAccessNodes = normaliseAccessNodes;
const sync_1 = require("csv-parse/sync");
function normaliseAccessNodes(csvText) {
    const records = (0, sync_1.parse)(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    return records
        .map((r) => {
        // We’ll confirm exact header names after first fetch, but this is a robust start.
        const atco = r.AtcoCode ?? r.ATCOCode ?? r.atcoCode ?? r["AtcoCode"];
        const name = r.CommonName ?? r.Name ?? r.StopName ?? r.commonName ?? r["CommonName"];
        const latRaw = r.Latitude ?? r.lat ?? r["Latitude"];
        const lonRaw = r.Longitude ?? r.lon ?? r["Longitude"];
        // NPTG locality code is often included on NaPTAN records (sometimes called NptgLocalityCode / LocalityCode)
        const locality = r.NptgLocalityCode ?? r.LocalityCode ?? r.localityId ?? null;
        const stopType = r.StopType ?? r.NodeType ?? r.StopClassification ?? null;
        if (!atco || !name)
            return null;
        return {
            stationId: String(atco),
            name: String(name),
            latitude: latRaw ? Number(latRaw) : null,
            longitude: lonRaw ? Number(lonRaw) : null,
            localityId: locality ? String(locality) : null,
            stopType: stopType ? String(stopType) : null,
        };
    })
        .filter(Boolean);
}
