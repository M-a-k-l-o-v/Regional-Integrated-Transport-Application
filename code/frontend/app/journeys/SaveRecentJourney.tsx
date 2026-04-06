"use client";

import { useEffect } from "react";
import { saveRecentJourney, type RecentJourney } from "./RecentJourneyStrip";

type SaveRecentJourneyProps = Omit<RecentJourney, "timestamp">;

export default function SaveRecentJourney(props: SaveRecentJourneyProps) {
  useEffect(() => {
    saveRecentJourney(props);
  }, [props.originName, props.destinationName, props.href]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
