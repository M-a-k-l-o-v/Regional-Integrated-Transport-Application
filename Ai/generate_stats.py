"""
    .  _   _  ___ ___ _  _ __ __  .
    . | \ / || __| _ \ || |  V  | .
    . `\ V /'| _|| v / \/ | \_/ | .
    .   \_/  |___|_|_\\__/|_| |_| .
  
    Author: Verum | Dc: 9to9
    Description: Generating certain features based on historical data - SCC.200 Group Project
    
    NOTE:   AI tools were used to help structure, log the output along with formating and reviewing code.
            All core logic is my own work. EXCEPT : Prisma implementation & Certain parts of the AI that just sped up me reading the API.
"""

import os
import json
import gzip
import pandas as pd
from datetime import datetime

# CONFIG
DATA_DIR = 'transport_data'
MODEL_DIR = 'models'
STATS_PATH = os.path.join(MODEL_DIR, 'historical_stats.json')
LATE_THRESHOLD_MINUTES = 5


def _open_csv(filepath):
    if filepath.endswith('.gz'):
        return gzip.open(filepath, 'rt', encoding='utf-8')
    return open(filepath, 'r', encoding='utf-8')


def _find_data_files(category):
    folder = os.path.join(DATA_DIR, category)
    if not os.path.isdir(folder):
        print(f"[DATA] WARNING: folder {folder} not found")
        return []

    files = []
    for fname in sorted(os.listdir(folder)):
        if fname.endswith('.csv') or fname.endswith('.csv.gz'):
            files.append(os.path.join(folder, fname))
    return files


def load_rail_movements():
    files = _find_data_files('rail_movements')
    if not files:
        print("[DATA] no rail_movements files found")
        return pd.DataFrame()

    frames = []
    for fpath in files:
        try:
            with _open_csv(fpath) as f:
                df = pd.read_csv(f, low_memory=False)
                frames.append(df)
        except Exception as e:
            print(f"[DATA] error reading {fpath}: {e}")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    print(f"[DATA] loaded {len(combined):,} rail movement records from {len(files)} files")
    return combined


def _safe_epoch_to_datetime(epoch_ms):
    try:
        if pd.isna(epoch_ms) or epoch_ms == '':
            return pd.NaT
        return pd.to_datetime(int(float(epoch_ms)), unit='ms', utc=True)
    except (ValueError, TypeError, OverflowError):
        return pd.NaT


def generate_stats():
    print(f"\n{'=' * 65}")
    print("  GENERATING HISTORICAL STATISTICS")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 65}\n")
    
    df = load_rail_movements()
    
    if df.empty:
        print("[ERROR] No movement data found")
        return None
    
    print("[STATS] Parsing timestamps...")
    for col in ['planned_timestamp', 'actual_timestamp', 'gbtt_timestamp']:
        df[col] = df[col].apply(_safe_epoch_to_datetime)
    
    df['scheduled'] = df['gbtt_timestamp'].fillna(df['planned_timestamp'])
    df = df.dropna(subset=['actual_timestamp', 'scheduled'])
    
    print("[STATS] Calculating delays...")
    df['timetable_variation'] = pd.to_numeric(df['timetable_variation'], errors='coerce')
    df['delay_mins'] = df['timetable_variation'].fillna(
        (df['actual_timestamp'] - df['scheduled']).dt.total_seconds() / 60.0
    )
    df['is_late'] = (df['delay_mins'] > LATE_THRESHOLD_MINUTES).astype(int)
    
    df['hour'] = df['scheduled'].dt.hour
    df['day_of_week'] = df['scheduled'].dt.dayofweek  # 0=Monday, 6=Sunday
    
    df['toc_id'] = df['toc_id'].fillna('UNK').astype(str)
    df['loc_stanox'] = df['loc_stanox'].fillna('UNK').astype(str)
    
    print(f"[STATS] Processing {len(df):,} records...")
    print(f"[STATS] Overall late ratio: {df['is_late'].mean():.2%}")
    
    # STANOX STATS
    print("[STATS] Calculating STANOX stats...")
    stanox_stats = {}
    stanox_grouped = df.groupby('loc_stanox').agg({
        'delay_mins': ['mean', 'std', 'count'],
        'is_late': 'mean'
    })
    
    for stanox in stanox_grouped.index:
        stanox_stats[stanox] = {
            'mean_delay': round(float(stanox_grouped.loc[stanox, ('delay_mins', 'mean')]), 2),
            'delay_std': round(float(stanox_grouped.loc[stanox, ('delay_mins', 'std')] or 0), 2),
            'late_ratio': round(float(stanox_grouped.loc[stanox, ('is_late', 'mean')]), 4),
            'sample_count': int(stanox_grouped.loc[stanox, ('delay_mins', 'count')]),
        }
    
    print(f"[STATS] Generated stats for {len(stanox_stats)} stations")
    
    # TOC STATS
    print("[STATS] Calculating TOC overall stats...")
    toc_stats = {}
    toc_grouped = df.groupby('toc_id').agg({
        'delay_mins': ['mean', 'count'],
        'is_late': 'mean'
    })
    
    for toc in toc_grouped.index:
        toc_stats[toc] = {
            'mean_delay': round(float(toc_grouped.loc[toc, ('delay_mins', 'mean')]), 2),
            'late_ratio': round(float(toc_grouped.loc[toc, ('is_late', 'mean')]), 4),
            'sample_count': int(toc_grouped.loc[toc, ('delay_mins', 'count')]),
        }
    
    print(f"[STATS] Generated overall stats for {len(toc_stats)} TOCs")
    
    # TOC STATS BY HOUR (0-23)
    print("[STATS] Calculating TOC stats by hour...")
    toc_hour_stats = {}
    toc_hour_grouped = df.groupby(['toc_id', 'hour']).agg({
        'delay_mins': ['mean', 'count'],
        'is_late': 'mean'
    })
    
    for (toc, hour), _ in toc_hour_grouped.iterrows():
        if toc not in toc_hour_stats:
            toc_hour_stats[toc] = {}
        
        toc_hour_stats[toc][str(hour)] = {
            'mean_delay': round(float(toc_hour_grouped.loc[(toc, hour), ('delay_mins', 'mean')]), 2),
            'late_ratio': round(float(toc_hour_grouped.loc[(toc, hour), ('is_late', 'mean')]), 4),
            'sample_count': int(toc_hour_grouped.loc[(toc, hour), ('delay_mins', 'count')]),
        }
    
    print(f"[STATS] Generated hourly stats for {len(toc_hour_stats)} TOCs")
    
    # TOC STATS BY DAY OF WEEK (0=Mon, 6=Sun)
    print("[STATS] Calculating TOC stats by day of week...")
    toc_day_stats = {}
    toc_day_grouped = df.groupby(['toc_id', 'day_of_week']).agg({
        'delay_mins': ['mean', 'count'],
        'is_late': 'mean'
    })
    
    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    for (toc, day), _ in toc_day_grouped.iterrows():
        if toc not in toc_day_stats:
            toc_day_stats[toc] = {}
        
        toc_day_stats[toc][day_names[day]] = {
            'mean_delay': round(float(toc_day_grouped.loc[(toc, day), ('delay_mins', 'mean')]), 2),
            'late_ratio': round(float(toc_day_grouped.loc[(toc, day), ('is_late', 'mean')]), 4),
            'sample_count': int(toc_day_grouped.loc[(toc, day), ('delay_mins', 'count')]),
        }
    
    print(f"[STATS] Generated daily stats for {len(toc_day_stats)} TOCs")
    
    # TOC STATS BY HOUR AND DAY OF WEEK
    print("[STATS] Calculating TOC stats by hour AND day of week...")
    toc_hour_day_stats = {}
    toc_hour_day_grouped = df.groupby(['toc_id', 'day_of_week', 'hour']).agg({
        'delay_mins': ['mean', 'count'],
        'is_late': 'mean'
    })
    
    for (toc, day, hour), _ in toc_hour_day_grouped.iterrows():
        if toc not in toc_hour_day_stats:
            toc_hour_day_stats[toc] = {}
        
        day_name = day_names[day]
        if day_name not in toc_hour_day_stats[toc]:
            toc_hour_day_stats[toc][day_name] = {}
        
        toc_hour_day_stats[toc][day_name][str(hour)] = {
            'mean_delay': round(float(toc_hour_day_grouped.loc[(toc, day, hour), ('delay_mins', 'mean')]), 2),
            'late_ratio': round(float(toc_hour_day_grouped.loc[(toc, day, hour), ('is_late', 'mean')]), 4),
            'sample_count': int(toc_hour_day_grouped.loc[(toc, day, hour), ('delay_mins', 'count')]),
        }
    
    print(f"[STATS] Generated hour+day stats for {len(toc_hour_day_stats)} TOCs")
    
    # HOUR + STANOX STATS
    print("[STATS] Calculating hour+stanox stats...")
    hour_stanox_stats = {}
    hour_stanox_grouped = df.groupby(['hour', 'loc_stanox']).agg({
        'delay_mins': 'mean',
        'is_late': 'mean'
    })
    
    for (hour, stanox), _ in hour_stanox_grouped.iterrows():
        key = f"{hour}_{stanox}"
        hour_stanox_stats[key] = {
            'mean_delay': round(float(hour_stanox_grouped.loc[(hour, stanox), 'delay_mins']), 2),
            'late_ratio': round(float(hour_stanox_grouped.loc[(hour, stanox), 'is_late']), 4),
        }
    
    print(f"[STATS] Generated {len(hour_stanox_stats)} hour+stanox combinations")
    
    # SAVE
    stats = {
        'stanox': stanox_stats,
        'toc': toc_stats,
        'toc_by_hour': toc_hour_stats,
        'toc_by_day': toc_day_stats,
        'toc_by_hour_day': toc_hour_day_stats,
        'hour_stanox': hour_stanox_stats,
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_records': len(df),
            'late_threshold_minutes': LATE_THRESHOLD_MINUTES,
            'overall_late_ratio': round(float(df['is_late'].mean()), 4),
            'date_range': {
                'start': df['scheduled'].min().isoformat() if pd.notna(df['scheduled'].min()) else None,
                'end': df['scheduled'].max().isoformat() if pd.notna(df['scheduled'].max()) else None,
            }
        }
    }
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(STATS_PATH, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\n{'=' * 65}")
    print(f"  STATS GENERATION COMPLETE")
    print(f"{'=' * 65}")
    print(f"  Saved to: {STATS_PATH}")
    print(f"  File size: {os.path.getsize(STATS_PATH) / 1024 / 1024:.2f} MB")
    print(f"")
    print(f"  Stations:        {len(stanox_stats):,}")
    print(f"  TOCs:            {len(toc_stats):,}")
    print(f"  Hour+Stanox:     {len(hour_stanox_stats):,}")
    print(f"  Total records:   {len(df):,}")
    print(f"{'=' * 65}\n")
    
    print("[SAMPLE] Northern (NT) stats by day and hour:")
    if 'NT' in toc_hour_day_stats:
        for day in ['monday', 'friday', 'sunday']:
            if day in toc_hour_day_stats['NT']:
                print(f"\n  {day.upper()}:")
                for hour in ['7', '8', '9', '17', '18']:
                    if hour in toc_hour_day_stats['NT'][day]:
                        h_stats = toc_hour_day_stats['NT'][day][hour]
                        print(f"    {hour:>2}:00 - late_ratio: {h_stats['late_ratio']:.1%}, "
                              f"mean_delay: {h_stats['mean_delay']:.1f}min, "
                              f"samples: {h_stats['sample_count']:,}")
    
    return stats


if __name__ == '__main__':
    generate_stats()