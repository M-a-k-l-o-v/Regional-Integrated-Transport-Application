import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from delay_predictor import _open_csv, _find_data_files, LATE_THRESHOLD_MINUTES

STATS_PATH = os.path.join('models', 'historical_stats.json')

def load_stats():
    with open(STATS_PATH, 'r') as f:
        return json.load(f)

def get_prediction(stats, stanox, toc_id, hour):
    """Predict IS_LATE (bool) based on historical stats."""
    # Logic: If late_ratio > overall_average, predict LATE (True)
    overall_threshold = stats['metadata']['overall_late_ratio']
    
    # Try Hour+Stanox
    key = f"{hour}_{stanox}"
    if key in stats['hour_stanox']:
        return stats['hour_stanox'][key]['late_ratio'] > overall_threshold
    
    # Fallback Stanox
    if str(stanox) in stats['stanox']:
        return stats['stanox'][str(stanox)]['late_ratio'] > overall_threshold
        
    # Fallback TOC
    if str(toc_id) in stats['toc']:
        return stats['toc'][str(toc_id)]['late_ratio'] > overall_threshold
        
    return False

def analyze_stats_model(target_samples=100000):
    print(f"--- Loading Historical Stats Model ---")
    stats = load_stats()
    
    print(f"--- Loading Data for {target_samples} Samples ---")
    files = _find_data_files('rail_movements')
    
    all_rows = []
    for fpath in files:
        with _open_csv(fpath) as f:
            df = pd.read_csv(f, low_memory=False)
            all_rows.append(df)
            total_so_far = sum(len(x) for x in all_rows)
            if total_so_far >= target_samples:
                break
    
    full_df = pd.concat(all_rows).sample(min(target_samples, total_so_far))
    
    print("--- Preprocessing & Predicting ---")
    # Ground Truth
    full_df['planned_timestamp'] = pd.to_datetime(full_df['planned_timestamp'], unit='ms', errors='coerce')
    full_df['actual_timestamp'] = pd.to_datetime(full_df['actual_timestamp'], unit='ms', errors='coerce')
    full_df = full_df.dropna(subset=['planned_timestamp', 'actual_timestamp'])
    
    full_df['delay_mins'] = (full_df['actual_timestamp'] - full_df['planned_timestamp']).dt.total_seconds() / 60.0
    full_df['actual_is_late'] = (full_df['delay_mins'] > LATE_THRESHOLD_MINUTES).astype(int)
    
    # Predictions
    preds = []
    for _, row in full_df.iterrows():
        is_late = get_prediction(
            stats, 
            row.get('loc_stanox'), 
            row.get('toc_id'), 
            row['planned_timestamp'].hour
        )
        preds.append(int(is_late))
    
    full_df['pred_is_late'] = preds
    
    # Metrics
    tp = len(full_df[(full_df['actual_is_late'] == 1) & (full_df['pred_is_late'] == 1)])
    tn = len(full_df[(full_df['actual_is_late'] == 0) & (full_df['pred_is_late'] == 0)])
    fp = len(full_df[(full_df['actual_is_late'] == 0) & (full_df['pred_is_late'] == 1)])
    fn = len(full_df[(full_df['actual_is_late'] == 1) & (full_df['pred_is_late'] == 0)])
    
    accuracy = (tp + tn) / len(full_df)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    print(f"\n{'='*40}")
    print(f"--- MODEL EVALUATION ({len(full_df):,} samples)")
    print(f"{'='*40}")
    print(f"Accuracy:  {accuracy:.2%}")
    print(f"Precision: {precision:.2%}")
    print(f"Recall:    {recall:.2%}")
    print(f"F1 Score:  {f1:.2%}")
    print(f"\n\n\nConfusion Matrix:")
    print(f"  TN={tn:<8} FP={fp}")
    print(f"  FN={fn:<8} TP={tp}")
    
    print(f"\n{'='*21}")
    print(f" PSEUDO-FEATURE WEIGHTS (Influence)")
    print(f"{'='*21}")
    print("Based on data granularity in JSON:")
    print(f"Hour + Stanox Interaction")
    print(f"Stanox Historical Mean")
    print(f"TOC Historical Mean")
    print(f"Late Threshold ({LATE_THRESHOLD_MINUTES} mins)")

if __name__ == "__main__":
    analyze_stats_model(670000)
