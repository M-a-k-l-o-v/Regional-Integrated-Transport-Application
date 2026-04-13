"use client";

import { useCallback, useState } from "react";
import { VmsSign } from "../lib/transportApi";
import VmsMap from "./VmsMap";
import VmsSignList from "./VmsSignList";

type VmsExplorerProps = {
  signs: VmsSign[];
};

export default function VmsExplorer({ signs }: VmsExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const activeSigns = signs.filter((s) => !s.isBlank);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
      <div className="space-y-6">
        <VmsMap signs={signs} selectedId={selectedId} onSelectSign={handleSelect} />

        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Active message
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            No message
          </span>
          <span className="ml-auto text-xs">
            {activeSigns.length}/{signs.length} signs active
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Active messages</h3>
          <span className="rounded-full bg-[var(--surface-accent)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            {activeSigns.length} sign{activeSigns.length !== 1 ? "s" : ""}
          </span>
        </div>
        <VmsSignList signs={signs} selectedId={selectedId} onSelectSign={handleSelect} />
      </div>
    </div>
  );
}
