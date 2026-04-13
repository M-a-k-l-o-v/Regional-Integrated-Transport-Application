"""
    .  _   _  ___ ___ _  _ __ __  .
    . | \ / || __| _ \ || |  V  | .
    . `\ V /'| _|| v / \/ | \_/ | .
    .   \_/  |___|_|_\\__/|_| |_| .
  
    Author: Verum | Dc: 9to9
    Description: Random Forest AI for train delay prediction - SCC.200 Group Project
    
    NOTE:   AI tools were used to help structure, log the output along with formating and reviewing code.
            All core logic is my own work. EXCEPT : Prisma implementation & Certain parts of the AI that just sped up me reading the API.
"""

import os
import csv
import gzip
import json
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from collections import defaultdict

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (
    train_test_split, GridSearchCV, StratifiedKFold
)
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, precision_recall_curve, f1_score
)
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight

# CONFIG
DATA_DIR = 'transport_data'
MODEL_DIR = 'models'
MODEL_PATH = os.path.join(MODEL_DIR, 'delay_rf_model.pkl')
ENCODERS_PATH = os.path.join(MODEL_DIR, 'delay_encoders.pkl')
FEATURE_META_PATH = os.path.join(MODEL_DIR, 'feature_meta.json')

# what counts as "late" - anything above this in minutes :)
LATE_THRESHOLD_MINUTES = 5

# stanox -> CRS lookup
STANOX_TO_CRS = {}
STANOX_TO_NAME = {}
CRS_TO_STANOX = {}


# ============================================================
#  DATA LOADING - both .csv and .csv.gz 
# ============================================================

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


def load_corpus():
    global STANOX_TO_CRS, STANOX_TO_NAME, CRS_TO_STANOX

    corpus_path = os.path.join(DATA_DIR, 'reference', 'corpus.csv')
    if not os.path.exists(corpus_path):
        print("[CORPUS] corpus.csv not found - stanox lookups will be empty")
        return

    count = 0
    with open(corpus_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stanox = (row.get('stanox') or '').strip()
            crs = (row.get('crs') or '').strip()
            name = (row.get('description') or '').strip()

            if stanox:
                if crs:
                    STANOX_TO_CRS[stanox] = crs
                    CRS_TO_STANOX[crs] = stanox
                if name:
                    STANOX_TO_NAME[stanox] = name
                count += 1

    print(f"[CORPUS] loaded {count} stanox entries, {len(STANOX_TO_CRS)} with CRS codes")


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


def load_rail_cancellations():
    files = _find_data_files('rail_cancellations')
    if not files:
        return pd.DataFrame()

    frames = []
    for fpath in files:
        try:
            with _open_csv(fpath) as f:
                frames.append(pd.read_csv(f, low_memory=False))
        except Exception as e:
            print(f"[DATA] error reading {fpath}: {e}")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    print(f"[DATA] loaded {len(combined):,} rail cancellation records")
    return combined


def load_weather():
    files = _find_data_files('weather')
    if not files:
        return pd.DataFrame()

    frames = []
    for fpath in files:
        try:
            with _open_csv(fpath) as f:
                frames.append(pd.read_csv(f, low_memory=False))
        except Exception as e:
            print(f"[DATA] error reading {fpath}: {e}")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    print(f"[DATA] loaded {len(combined):,} weather records")
    return combined


def load_departures():
    files = _find_data_files('rail_departures')
    if not files:
        return pd.DataFrame()

    frames = []
    for fpath in files:
        try:
            with _open_csv(fpath) as f:
                frames.append(pd.read_csv(f, low_memory=False))
        except Exception as e:
            print(f"[DATA] error reading {fpath}: {e}")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    print(f"[DATA] loaded {len(combined):,} departure records")
    return combined


# ============================================================
#  FEATURES
# ============================================================

def _safe_epoch_to_datetime(epoch_ms):
    try:
        if pd.isna(epoch_ms) or epoch_ms == '':
            return pd.NaT
        return pd.to_datetime(int(float(epoch_ms)), unit='ms', utc=True)
    except (ValueError, TypeError, OverflowError):
        return pd.NaT


def build_movement_features(movements_df):
    """
    FEATURES!
        - hour_of_day, day_of_week, month, is_weekend, is_rush_hour
        - toc_id, event_type, direction
        - loc_stanox, route
        - platform
        - historical delay stats per stanox (rolling)
        - historical delay stats per toc (rolling)
        - whether this is a delay monitoring point
    """
    if movements_df.empty:
        print("[FEAT] no movement data to process")
        return pd.DataFrame(), pd.Series(dtype=int)

    df = movements_df.copy()

    # ---- TIMESTAMP PARSING ----
    for col in ['planned_timestamp', 'actual_timestamp', 'gbtt_timestamp']:
        df[col] = df[col].apply(_safe_epoch_to_datetime)

    df['collected_at'] = pd.to_datetime(df['collected_at'], errors='coerce')
    df = df.dropna(subset=['actual_timestamp'])
    
    df['scheduled'] = df['gbtt_timestamp'].fillna(df['planned_timestamp'])
    df = df.dropna(subset=['scheduled'])
    
    df['timetable_variation'] = pd.to_numeric(df['timetable_variation'], errors='coerce')
    df['computed_delay_mins'] = ((df['actual_timestamp'] - df['scheduled']).dt.total_seconds() / 60.0)
    df['delay_mins'] = df['timetable_variation'].fillna(df['computed_delay_mins'])
    df = df.dropna(subset=['delay_mins'])
    
    df['is_late'] = (df['delay_mins'] > LATE_THRESHOLD_MINUTES).astype(int)

    print(f"[FEAT] after cleaning: {len(df):,} records")
    print(f"[FEAT] late ratio: {df['is_late'].mean():.2%} "
          f"({df['is_late'].sum():,} late / {len(df):,} total)")

    ref_time = df['scheduled']
    df['hour_of_day'] = ref_time.dt.hour
    df['minute_of_hour'] = ref_time.dt.minute
    df['day_of_week'] = ref_time.dt.dayofweek # Stored as an int tho 0=Monday and 6 is Sunday
    df['month'] = ref_time.dt.month
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

    # rush hour (07-09 and 16-18) (Reference from Google!)
    df['is_rush_hour'] = (
        ((df['hour_of_day'] >= 7) & (df['hour_of_day'] <= 9)) |
        ((df['hour_of_day'] >= 16) & (df['hour_of_day'] <= 18))
    ).astype(int)

    # time-of-day buckets: early_morning / morning / midday / afternoon / evening / night
    df['time_bucket'] = pd.cut(
        df['hour_of_day'],
        bins=[-1, 5, 9, 12, 16, 20, 24],
        labels=['night', 'early_morning', 'morning', 'midday', 'afternoon', 'evening']
    ).astype(str)

    df['toc_id'] = df['toc_id'].fillna('UNK').astype(str)
    df['loc_stanox'] = df['loc_stanox'].fillna('UNK').astype(str)
    df['event_type'] = df['event_type'].fillna('UNK').astype(str)        # ARRIVAL or DEPARTURE
    df['direction_ind'] = df['direction_ind'].fillna('UNK').astype(str)  # UP or DOWN
    df['platform'] = df['platform'].fillna('UNK').astype(str)
    df['route'] = df['route'].fillna('UNK').astype(str)
    df['line_ind'] = df['line_ind'].fillna('UNK').astype(str)

    df['delay_monitoring_point'] = (
        df['delay_monitoring_point'].fillna('false')
        .astype(str).str.lower().map({'true': 1, 'false': 0})
        .fillna(0).astype(int)
    )

    df['offroute_ind'] = (
        df['offroute_ind'].fillna('false')
        .astype(str).str.lower().map({'true': 1, 'false': 0})
        .fillna(0).astype(int)
    )

    df['event_source'] = df['event_source'].fillna('UNK').astype(str)

    df = df.sort_values('scheduled').reset_index(drop=True)

    df['stanox_mean_delay'] = (
        df.groupby('loc_stanox')['delay_mins']
        .transform(lambda x: x.expanding().mean().shift(1))
    )
    df['stanox_late_ratio'] = (
        df.groupby('loc_stanox')['is_late']
        .transform(lambda x: x.expanding().mean().shift(1))
    )
    df['stanox_delay_std'] = (
        df.groupby('loc_stanox')['delay_mins']
        .transform(lambda x: x.expanding().std().shift(1))
    )

    df['toc_mean_delay'] = (
        df.groupby('toc_id')['delay_mins']
        .transform(lambda x: x.expanding().mean().shift(1))
    )
    df['toc_late_ratio'] = (
        df.groupby('toc_id')['is_late']
        .transform(lambda x: x.expanding().mean().shift(1))
    )

    df['hour_stanox_key'] = df['hour_of_day'].astype(str) + '_' + df['loc_stanox']
    df['hour_stanox_late_ratio'] = (
        df.groupby('hour_stanox_key')['is_late']
        .transform(lambda x: x.expanding().mean().shift(1))
    )

    global_mean_delay = df['delay_mins'].mean()
    global_late_ratio = df['is_late'].mean()

    for col in ['stanox_mean_delay', 'stanox_late_ratio', 'stanox_delay_std',
                'toc_mean_delay', 'toc_late_ratio', 'hour_stanox_late_ratio']:
        if 'delay' in col or 'std' in col:
            df[col] = df[col].fillna(global_mean_delay)
        else:
            df[col] = df[col].fillna(global_late_ratio)






    encoders = {}
    categorical_cols = [
        'toc_id', 'loc_stanox', 'event_type', 'direction_ind',
        'platform', 'route', 'line_ind', 'time_bucket', 'event_source'
    ]

    for col in categorical_cols:
        le = LabelEncoder()
        vals = df[col].unique().tolist()
        if 'UNK' not in vals:
            vals.append('UNK')
        le.fit(vals)
        df[col + '_enc'] = le.transform(df[col])
        encoders[col] = le



    feature_cols = [
        'hour_of_day', 'minute_of_hour', 'day_of_week', 'month',
        'is_weekend', 'is_rush_hour',
        'toc_id_enc', 'loc_stanox_enc', 'event_type_enc',
        'direction_ind_enc', 'platform_enc', 'route_enc',
        'line_ind_enc', 'time_bucket_enc', 'event_source_enc',
        'delay_monitoring_point', 'offroute_ind',
        'stanox_mean_delay', 'stanox_late_ratio', 'stanox_delay_std',
        'toc_mean_delay', 'toc_late_ratio',
        'hour_stanox_late_ratio',
    ]

    X = df[feature_cols].copy()
    y = df['is_late'].copy()


    X = X.fillna(0)

    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(ENCODERS_PATH, 'wb') as f:
        pickle.dump(encoders, f)



    with open(FEATURE_META_PATH, 'w') as f:
        json.dump({
            'feature_cols': feature_cols,
            'categorical_cols': categorical_cols,
            'late_threshold_minutes': LATE_THRESHOLD_MINUTES,
        }, f, indent=2)

    print(f"[FEAT] feature matrix shape: {X.shape}")
    print(f"[FEAT] features: {feature_cols}")

    X.index = df.index
    return X, y, encoders


def enrich_with_weather(X, movements_df, weather_df):
    """
    Merge nearest weather observation into leh feature matrix.
    Matches on closest timestamp + nearest location.

    -> temp, humidity, wind_speed, wind_gust, rain_1h, visibility, pressure
    """
    if weather_df.empty:
        print("[FEAT] no weather data - skipping enrichment")
        return X

    wx = weather_df.copy()
    wx['collected_at'] = pd.to_datetime(wx['collected_at'], errors='coerce')
    wx = wx.dropna(subset=['collected_at'])

    mv = movements_df.copy()
    mv['collected_at'] = pd.to_datetime(mv['collected_at'], errors='coerce')
    mv['wx_key'] = mv['collected_at'].dt.round('30min')
    wx['wx_key'] = wx['collected_at'].dt.round('30min')

    wx_agg = wx.groupby('wx_key').agg({
        'temp_celsius': 'mean',
        'humidity': 'mean',
        'wind_speed': 'mean',
        'wind_gust': 'mean',
        'rain_1h': 'max',
        'visibility': 'mean',
        'pressure': 'mean',
    }).reset_index()

    for col in ['temp_celsius', 'humidity', 'wind_speed', 'wind_gust',
                'rain_1h', 'visibility', 'pressure']:
        wx_agg[col] = pd.to_numeric(wx_agg[col], errors='coerce')

    # merge
    mv = mv.reset_index(drop=True)
    mv = mv.merge(wx_agg, on='wx_key', how='left')

    weather_cols = [
        'temp_celsius', 'humidity', 'wind_speed', 'wind_gust',
        'rain_1h', 'visibility', 'pressure'
    ]

    for col in weather_cols:
        if col in mv.columns:
            X[col] = mv.loc[X.index, col].values if len(mv) > len(X) else 0.0
        else:
            X[col] = 0.0

    X[weather_cols] = X[weather_cols].fillna(0.0)

    print(f"[FEAT] weather features added: {weather_cols}")
    return X


def enrich_with_cancellations(X, movements_df, cancellations_df):
    if cancellations_df.empty:
        print("[FEAT] no cancellation data - skipping enrichment")
        X['toc_recent_canx_rate'] = 0.0
        return X

    canx = cancellations_df.copy()
    canx['collected_at'] = pd.to_datetime(canx['collected_at'], errors='coerce')
    canx['toc_id'] = canx['toc_id'].fillna('UNK').astype(str)

    # count cancellations per toc per hour
    canx['hour_bucket'] = canx['collected_at'].dt.round('1h')
    canx_counts = canx.groupby(['toc_id', 'hour_bucket']).size().reset_index(name='canx_count')

    mv = movements_df.copy()
    mv['collected_at'] = pd.to_datetime(mv['collected_at'], errors='coerce')
    mv['toc_id'] = mv['toc_id'].fillna('UNK').astype(str)
    mv['hour_bucket'] = mv['collected_at'].dt.round('1h')

    mv = mv.reset_index(drop=True)
    mv = mv.merge(canx_counts, on=['toc_id', 'hour_bucket'], how='left')
    mv['canx_count'] = mv['canx_count'].fillna(0)

    X['toc_recent_canx_rate'] = mv.loc[X.index, 'canx_count'].values if len(mv) > len(X) else 0.0

    print("[FEAT] cancellation enrichment added")
    return X


# ============================================================
#  MODEL TRAINING
# ============================================================

def train_model(X, y):
    if X.empty or y.empty:
        print("[TRAIN] ERROR: no data to train on")
        return None

    print(f"\n{'=' * 65}")
    print("  TRAINING RANDOM FOREST DELAY PREDICTOR")
    print(f"  samples: {len(X):,}  |  features: {X.shape[1]}")
    print(f"  late ratio: {y.mean():.2%}")
    print(f"{'=' * 65}\n")

    # stratified split - keep class ratios consistent
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"[TRAIN] train set: {len(X_train):,}  |  test set: {len(X_test):,}")

    # compute class weights to handle imbalance
    classes = np.unique(y_train)
    weights = compute_class_weight('balanced', classes=classes, y=y_train)
    class_weight_dict = dict(zip(classes, weights))
    print(f"[TRAIN] class weights: {class_weight_dict}")

    # ---- HYPERPARAMETER SEARCH ----
    # not too crazy - we want this to finish in reasonable time
    param_grid = {
        'n_estimators': [200, 400, 600],
        'max_depth': [15, 25, 35, None],
        'min_samples_split': [2, 5, 10],
        'min_samples_leaf': [1, 2, 4],
        'max_features': ['sqrt', 'log2'],
    }

    base_rf = RandomForestClassifier(
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
        oob_score=True,
    )

    # use stratified k-fold for the grid search
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # if dataset is huge, do a randomised search instead
    if len(X_train) > 100_000:
        from sklearn.model_selection import RandomizedSearchCV
        print("[TRAIN] large dataset - using RandomizedSearchCV (50 iterations)")
        search = RandomizedSearchCV(
            base_rf, param_grid,
            n_iter=50,
            cv=cv,
            scoring='f1',
            n_jobs=-1,
            verbose=1,
            random_state=42,
        )
    else:
        print("[TRAIN] using GridSearchCV")
        search = GridSearchCV(
            base_rf, param_grid,
            cv=cv,
            scoring='f1',
            n_jobs=-1,
            verbose=1,
        )

    print("[TRAIN] searching hyperparameters... (this may take a while)")
    search.fit(X_train, y_train)

    best_rf = search.best_estimator_
    print(f"\n[TRAIN] best params: {search.best_params_}")
    print(f"[TRAIN] best CV F1: {search.best_score_:.4f}")

    if hasattr(best_rf, 'oob_score_'):
        print(f"[TRAIN] OOB score: {best_rf.oob_score_:.4f}")

    # ---- EVALUATION ----
    y_pred = best_rf.predict(X_test)
    y_proba = best_rf.predict_proba(X_test)[:, 1]

    print(f"\n{'=' * 50}")
    print("  TEST SET EVALUATION")
    print(f"{'=' * 50}")
    print(classification_report(y_test, y_pred, target_names=['On Time', 'Late']))

    print(f"ROC AUC: {roc_auc_score(y_test, y_proba):.4f}")
    print(f"\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  TN={cm[0, 0]:,}  FP={cm[0, 1]:,}")
    print(f"  FN={cm[1, 0]:,}  TP={cm[1, 1]:,}")

    # feature importances
    importances = best_rf.feature_importances_
    feat_imp = sorted(
        zip(X.columns, importances),
        key=lambda x: x[1], reverse=True
    )
    print(f"\nTop 15 Feature Importances:")
    for fname, imp in feat_imp[:15]:
        bar = '█' * int(imp * 100)
        print(f"  {fname:35s} {imp:.4f} {bar}")

    # ---- SAVE MODEL ----
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(best_rf, f)
    print(f"\n[TRAIN] model saved to {MODEL_PATH}")

    return best_rf


# ============================================================
#  INFERENCE
# ============================================================

def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train_and_save() first."
        )

    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)

    encoders = {}
    if os.path.exists(ENCODERS_PATH):
        with open(ENCODERS_PATH, 'rb') as f:
            encoders = pickle.load(f)

    feature_meta = {}
    if os.path.exists(FEATURE_META_PATH):
        with open(FEATURE_META_PATH, 'r') as f:
            feature_meta = json.load(f)

    print("[MODEL] loaded model, encoders, and feature metadata")
    return model, encoders, feature_meta


def predict_delay(model, encoders, feature_meta,
                  toc_id='UNK', loc_stanox='UNK', event_type='DEPARTURE',
                  direction='UP', platform='UNK', route='UNK',
                  line_ind='UNK', event_source='AUTOMATIC',
                  scheduled_time=None, weather=None,
                  stanox_history=None, toc_history=None):
    """
    This predicts whether a single train event will be late.

    Arguments -> 
        model:          trained RandomForestClassifier
        encoders:       dict of LabelEncoders from training
        feature_meta:   feature column list + metadata
        toc_id:         train operating company code
        loc_stanox:     STANOX code for the location
        event_type:     'ARRIVAL' or 'DEPARTURE'
        direction:      'UP' or 'DOWN'
        platform:       platform number/string
        route:          route identifier
        line_ind:       line indicator
        event_source:   'AUTOMATIC' or 'MANUAL'
        scheduled_time: datetime of the scheduled event (defaults to now)
        weather:        dict with keys: temp, humidity, wind_speed, etc.
        stanox_history: dict with keys: mean_delay, late_ratio, delay_std
        toc_history:    dict with keys: mean_delay, late_ratio

    Returns ->>>
        dict with 'is_late' (bool), 'probability' (float 0-1),
             'confidence' ('HIGH'/'MEDIUM'/'LOW')
    """
    if scheduled_time is None:
        scheduled_time = datetime.now()

    feature_cols = feature_meta.get('feature_cols', [])

    hour = scheduled_time.hour
    minute = scheduled_time.minute
    dow = scheduled_time.weekday()
    month = scheduled_time.month
    is_weekend = 1 if dow >= 5 else 0
    is_rush = 1 if (7 <= hour <= 9) or (16 <= hour <= 18) else 0

    if hour <= 5:
        time_bucket = 'night'
    elif hour <= 9:
        time_bucket = 'early_morning'
    elif hour <= 12:
        time_bucket = 'morning'
    elif hour <= 16:
        time_bucket = 'midday'
    elif hour <= 20:
        time_bucket = 'afternoon'
    else:
        time_bucket = 'evening'

    def _encode(col, val):
        le = encoders.get(col)
        if le is None:
            return 0
        val = str(val)
        if val in le.classes_:
            return le.transform([val])[0]
        if 'UNK' in le.classes_:
            return le.transform(['UNK'])[0]
        return 0

    sh = stanox_history or {}
    th = toc_history or {}

    features = {
        'hour_of_day': hour,
        'minute_of_hour': minute,
        'day_of_week': dow,
        'month': month,
        'is_weekend': is_weekend,
        'is_rush_hour': is_rush,
        'toc_id_enc': _encode('toc_id', toc_id),
        'loc_stanox_enc': _encode('loc_stanox', loc_stanox),
        'event_type_enc': _encode('event_type', event_type),
        'direction_ind_enc': _encode('direction_ind', direction),
        'platform_enc': _encode('platform', platform),
        'route_enc': _encode('route', route),
        'line_ind_enc': _encode('line_ind', line_ind),
        'time_bucket_enc': _encode('time_bucket', time_bucket),
        'event_source_enc': _encode('event_source', event_source),
        'delay_monitoring_point': 0,
        'offroute_ind': 0,
        'stanox_mean_delay': sh.get('mean_delay', 2.0),
        'stanox_late_ratio': sh.get('late_ratio', 0.15),
        'stanox_delay_std': sh.get('delay_std', 5.0),
        'toc_mean_delay': th.get('mean_delay', 2.0),
        'toc_late_ratio': th.get('late_ratio', 0.15),
        'hour_stanox_late_ratio': sh.get('late_ratio', 0.15),
    }

    wx = weather or {}
    weather_feature_names = [
        'temp_celsius', 'humidity', 'wind_speed', 'wind_gust',
        'rain_1h', 'visibility', 'pressure'
    ]
    for wf in weather_feature_names:
        if wf in feature_cols:
            features[wf] = wx.get(wf, 0.0)

    if 'toc_recent_canx_rate' in feature_cols:
        features['toc_recent_canx_rate'] = 0.0

    X_single = pd.DataFrame([features])

    for col in feature_cols:
        if col not in X_single.columns:
            X_single[col] = 0.0
    X_single = X_single[feature_cols]

    # predict
    proba = model.predict_proba(X_single)[0]
    late_prob = float(proba[1])
    is_late = late_prob > 0.5

    # confidence based on how far from 0.5 the probability is
    margin = abs(late_prob - 0.5)
    if margin > 0.3:
        confidence = 'HIGH'
    elif margin > 0.15:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'

    return {
        'is_late': is_late,
        'probability': late_prob,
        'confidence': confidence,
    }


# ============================================================
#  FULL PIPELINE
# ============================================================

def train_and_save():
    print(f"\n{'=' * 65}")
    print("  DELAY PREDICTION MODEL - TRAINING PIPELINE")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 65}\n")

    load_corpus()

    # load all data sources
    movements = load_rail_movements()
    cancellations = load_rail_cancellations()
    weather = load_weather()

    if movements.empty:
        print("[TRAIN] FATAL: no movement data found. Run the collector first.")
        return None

    # build features from movements
    X, y, encoders = build_movement_features(movements)

    if X.empty:
        print("[TRAIN] FATAL: feature engineering produced empty matrix")
        return None

    # enrich with weather data
    X = enrich_with_weather(X, movements, weather)

    # enrich with cancellation data
    X = enrich_with_cancellations(X, movements, cancellations)

    # update feature meta with enriched columns
    feature_cols = list(X.columns)
    with open(FEATURE_META_PATH, 'w') as f:
        json.dump({
            'feature_cols': feature_cols,
            'late_threshold_minutes': LATE_THRESHOLD_MINUTES,
        }, f, indent=2)

    # train
    model = train_model(X, y)

    if model is not None:
        print(f"\n[DONE] model ready at {MODEL_PATH}")
        print(f"[DONE] encoders at {ENCODERS_PATH}")
        print(f"[DONE] feature meta at {FEATURE_META_PATH}")

    return model


# ============================================================
#  CLI ENTRY POINT
# ============================================================

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == 'predict':
        # quick test prediction
        model, encoders, meta = load_model()
        result = predict_delay(
            model, encoders, meta,
            toc_id='NT',
            loc_stanox='24673',
            event_type='DEPARTURE',
            scheduled_time=datetime.now(),
        )
        print(f"\nPrediction: {'LATE' if result['is_late'] else 'ON TIME'}")
        print(f"Probability: {result['probability']:.1%}")
        print(f"Confidence: {result['confidence']}")
    else:
        train_and_save()