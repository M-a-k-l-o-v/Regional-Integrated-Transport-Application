# Project Context

- Goal: Build a regional integrated transport backend for rail and bus ingestion.
- Current focus: Implement rail parser coverage and persist parsed timetable data.
- Constraints: Keep schema normalized, keep ingestion resilient, and track job runs.
- Data sources: NaPTAN/NPTG CSV feeds and rail timetable feed.
- Priority: Reliable incremental ingestion with payload-hash based change detection.
- Next milestone: Replace placeholder rail parser output with real parsed records.
