"use client";

import { useEffect } from "react";
import { recordRecentBoard } from "../lib/boardHistory";
import { BoardMode, PlannerLocation } from "../lib/transportApi";

type BoardVisitTrackerProps = {
  mode: BoardMode;
  location: PlannerLocation;
  href: string;
};

export default function BoardVisitTracker({ mode, location, href }: BoardVisitTrackerProps) {
  useEffect(() => {
    recordRecentBoard({ mode, location, href });
  }, [href, location, mode]);

  return null;
}
