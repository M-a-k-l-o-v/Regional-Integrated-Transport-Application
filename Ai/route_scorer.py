"""
    .  _   _  ___ ___ _  _ __ __  .
    . | \ / || __| _ \ || |  V  | .
    . `\ V /'| _|| v / \/ | \_/ | .
    .   \_/  |___|_|_\\__/|_| |_| .
  
    Author: Verum | Dc: 9to9
    Description: Prisma Integration - SCC.200 Group Project
    
    NOTE:   AI tools were used to help structure, log the output along with formating and reviewing code.
            All core logic is my own work. EXCEPT : Prisma implementation & Certain parts of the AI that just sped up me reading the API.
"""

import os
import json
import pickle
import numpy as np
from datetime import datetime
from typing import Optional

# import the model loader + predictor from task 1
from delay_predictor import (
    load_model, predict_delay, load_corpus,
    STANOX_TO_CRS, CRS_TO_STANOX, STANOX_TO_NAME,
    MODEL_PATH, ENCODERS_PATH, FEATURE_META_PATH,
)

# ============================================================
#  SINGLETON MODEL CACHE — load once, reuse forever
# ============================================================

_MODEL_CACHE = {
    'model': None,
    'encoders': None,
    'feature_meta': None,
    'loaded': False,
}


def _ensure_model_loaded():
    """Lazy-load the model on first call. Cached after that."""
    if _MODEL_CACHE['loaded']:
        return

    load_corpus()
    model, encoders, feature_meta = load_model()
    _MODEL_CACHE['model'] = model
    _MODEL_CACHE['encoders'] = encoders
    _MODEL_CACHE['feature_meta'] = feature_meta
    _MODEL_CACHE['loaded'] = True
    print("[SCORER] model loaded and cached")


# ============================================================
#  ROUTE TYPES — mirrors the Prisma schema
# ============================================================
#
#  These are plain dicts that match the shape of the Prisma models.
#  In your Next.js/Node app you'd serialise the Prisma objects to JSON
#  and pass them in. Here we just define the expected shape so it's
#  clear what fields we use.
#
#  Route {
#      routeId:    str
#      mode:       'RAIL' | 'BUS' | 'TRAM' | 'METRO' | 'FERRY' | 'OTHER'
#      operatorId: str | None
#      operator:   { operatorId, name } | None
#      routeStops: [{ routeId, stationId, stopOrder, station: { stationId, name, latitude, longitude } }]
#      busRouteStops: [{ routeId, stopId, stopOrder, busStop: { stopId, name, latitude, longitude } }]
#      railSchedules: [{ scheduleId, routeId, stationId, arrivalTime, departureTime }]
#      busSchedules:  [{ scheduleId, routeId, stopId, arrivalTime, departureTime }]
#      serviceStatuses: [{ statusId, routeId, delayMinutes, cancellationFlag, lastUpdated }]
#      disruptions: [{ disruptionId, type, description, startTime, endTime }]
#      reliabilityScores: [{ scoreId, score, confidenceLevel, calculatedAt }]
#      historicalPerf: [{ perfId, delayMinutes, cancelled, serviceDate }]
#  }
#
# ============================================================


# ============================================================
#  MAIN SCORING FUNCTION — this is what you call
# ============================================================

def get_route_reliability_score(
    route: dict,
    scheduled_time: Optional[datetime] = None,
    weather: Optional[dict] = None,
) -> dict:
    """
    Score a route's reliability from 1-100%.

    This is the ONE function you call. Pass in a Route object (as a dict,
    matching the Prisma schema shape) and get back a score.

    Args:
        route:          dict matching the Prisma Route model (with relations loaded).
                        At minimum needs: routeId, mode, operatorId.
                        For best results, include: routeStops/busRouteStops,
                        serviceStatuses, disruptions, historicalPerf.
        scheduled_time: when the service is scheduled (defaults to now).
        weather:        optional weather dict with keys like temp_celsius,
                        humidity, wind_speed, rain_1h, visibility, etc.

    Returns:
        {
            'routeId':         str,
            'score':           int,        # 1-100, higher = more reliable
            'confidence':      str,        # 'HIGH', 'MEDIUM', 'LOW'
            'factors':         dict,       # breakdown of what influenced the score
            'prediction':      str,        # 'ON_TIME' or 'LIKELY_LATE'
            'delay_probability': float,    # 0.0 - 1.0
        }
    """
    _ensure_model_loaded()

    if scheduled_time is None:
        scheduled_time = datetime.now()

    model = _MODEL_CACHE['model']
    encoders = _MODEL_CACHE['encoders']
    feature_meta = _MODEL_CACHE['feature_meta']

    route_id = route.get('routeId', 'unknown')
    mode = route.get('mode', 'OTHER')
    operator_id = route.get('operatorId', 'UNK')

    signals = {
        'ml_score': None,
        'historical_score': None,
        'disruption_penalty': 0.0,
        'status_penalty': 0.0,
        'existing_reliability': None,
    }

    stop_predictions = _predict_stops(
        route, model, encoders, feature_meta,
        scheduled_time, weather
    )

    if stop_predictions:
        avg_late_prob = np.mean([p['probability'] for p in stop_predictions])
        signals['ml_score'] = (1.0 - avg_late_prob) * 100.0
    else:
        generic = predict_delay(
            model, encoders, feature_meta,
            toc_id=operator_id,
            scheduled_time=scheduled_time,
            weather=weather,
        )
        signals['ml_score'] = (1.0 - generic['probability']) * 100.0

    # HISTORICAL
    hist_perf = route.get('historicalPerf', [])
    if hist_perf:
        signals['historical_score'] = _score_from_history(hist_perf)

    # ACTIVE DISRUPTIONS
    disruptions = route.get('disruptions', [])
    signals['disruption_penalty'] = _disruption_penalty(disruptions, scheduled_time)

    # CURRENT STATUS
    statuses = route.get('serviceStatuses', [])
    signals['status_penalty'] = _status_penalty(statuses)

    # OLD RELIABILITY SCORE
    existing_scores = route.get('reliabilityScores', [])
    if existing_scores:
        latest = max(existing_scores, key=lambda s: s.get('calculatedAt', ''))
        signals['existing_reliability'] = latest.get('score', None)

    final_score, confidence = _combine_signals(signals)
    final_score = max(1, min(100, int(round(final_score))))

    prediction = 'ON_TIME' if final_score >= 50 else 'LIKELY_LATE'

    return {
        'routeId': route_id,
        'score': final_score,
        'confidence': confidence,
        'factors': signals,
        'prediction': prediction,
        'delay_probability': round(1.0 - (final_score / 100.0), 4),
    }


# ============================================================
#  INTERNAL HELPERS
# ============================================================

def _predict_stops(route, model, encoders, feature_meta,
                   scheduled_time, weather):
    """
    Run the ML model for each stop in the route.
    Works for both RAIL (routeStops → Station) and BUS (busRouteStops → BusStop).
    """
    mode = route.get('mode', 'OTHER')
    operator_id = route.get('operatorId', 'UNK')
    predictions = []

    if mode == 'RAIL':
        stops = route.get('routeStops', [])
        stops = sorted(stops, key=lambda s: s.get('stopOrder', 0))

        for stop in stops:
            station = stop.get('station', {})
            station_id = station.get('stationId', 'UNK')

            stanox = CRS_TO_STANOX.get(station_id, 'UNK')

            pred = predict_delay(
                model, encoders, feature_meta,
                toc_id=operator_id,
                loc_stanox=stanox,
                event_type='DEPARTURE',
                scheduled_time=scheduled_time,
                weather=weather,
            )
            predictions.append(pred)

    elif mode == 'BUS':
        stops = route.get('busRouteStops', [])
        stops = sorted(stops, key=lambda s: s.get('stopOrder', 0))

        for stop in stops:
            bus_stop = stop.get('busStop', {})
            # for bus, we don't have stanox — use the stop ID as a proxy
            pred = predict_delay(
                model, encoders, feature_meta,
                toc_id=operator_id,
                loc_stanox=bus_stop.get('stopId', 'UNK'),
                event_type='DEPARTURE',
                scheduled_time=scheduled_time,
                weather=weather,
            )
            predictions.append(pred)

    return predictions


def _score_from_history(hist_perf):
    """
    Compute a reliability score (0-100) from historical performance records.
    Weighs recent records more heavily.

    Uses the HistoricalPerformance model from Prisma:
        { delayMinutes, cancelled, serviceDate }
    """
    if not hist_perf:
        return None

    # sort by date, most recent first
    sorted_perf = sorted(
        hist_perf,
        key=lambda p: p.get('serviceDate', ''),
        reverse=True,
    )

    # exponential decay weights — recent data matters more
    n = len(sorted_perf)
    decay = 0.95
    weights = np.array([decay ** i for i in range(n)])
    weights /= weights.sum()

    scores = []
    for perf in sorted_perf:
        cancelled = perf.get('cancelled', False)
        delay = perf.get('delayMinutes', 0) or 0

        if cancelled:
            scores.append(0.0)
        elif delay <= 0:
            scores.append(100.0)
        elif delay <= 5:
            scores.append(85.0)
        elif delay <= 10:
            scores.append(60.0)
        elif delay <= 20:
            scores.append(30.0)
        else:
            scores.append(10.0)

    weighted_score = np.average(scores, weights=weights)
    return float(weighted_score)


def _disruption_penalty(disruptions, scheduled_time):
    """
    Calculate a penalty (0-50) based on active disruptions.
    More disruptions = bigger penalty.

    Uses the Disruption model from Prisma:
        { type, description, startTime, endTime }
    """
    if not disruptions:
        return 0.0

    penalty = 0.0
    now = scheduled_time

    for d in disruptions:
        start = d.get('startTime')
        end = d.get('endTime')

        # parse datetime strings if needed
        if isinstance(start, str):
            try:
                start = datetime.fromisoformat(start.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                start = None
        if isinstance(end, str):
            try:
                end = datetime.fromisoformat(end.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                end = None

        # check if disruption is active
        is_active = True
        if start and hasattr(start, 'replace'):
            # make naive for comparison if needed
            start_naive = start.replace(tzinfo=None) if start.tzinfo else start
            if start_naive > now:
                is_active = False
        if end and hasattr(end, 'replace'):
            end_naive = end.replace(tzinfo=None) if end.tzinfo else end
            if end_naive < now:
                is_active = False

        if not is_active:
            continue

        # penalty based on disruption type
        dtype = (d.get('type') or '').lower()
        if 'cancel' in dtype or 'closure' in dtype:
            penalty += 30.0
        elif 'delay' in dtype or 'slow' in dtype:
            penalty += 15.0
        elif 'strike' in dtype or 'industrial' in dtype:
            penalty += 25.0
        else:
            penalty += 10.0

    return min(penalty, 50.0)


def _status_penalty(statuses):
    """
    Calculate a penalty (0-30) from current service status records.

    Uses the ServiceStatus model from Prisma:
        { delayMinutes, cancellationFlag, lastUpdated }
    """
    if not statuses:
        return 0.0

    # use the most recent status
    sorted_statuses = sorted(
        statuses,
        key=lambda s: s.get('lastUpdated', ''),
        reverse=True,
    )
    latest = sorted_statuses[0]

    penalty = 0.0

    if latest.get('cancellationFlag', False):
        penalty += 30.0
    else:
        delay = latest.get('delayMinutes', 0) or 0
        if delay > 30:
            penalty += 25.0
        elif delay > 15:
            penalty += 15.0
        elif delay > 5:
            penalty += 8.0
        elif delay > 0:
            penalty += 3.0

    return min(penalty, 30.0)


def _combine_signals(signals):
    """
    Weighted combination of all signals into a final 1-100 score.

    Signal weights:
        - ML model prediction:     40%
        - Historical performance:   30%
        - Disruption penalty:       applied as subtraction
        - Status penalty:           applied as subtraction
        - Existing reliability:     10% (prior/anchor)

    Returns:
        (score, confidence)
    """
    components = []
    weights = []
    confidence_signals = []

    # ML score (always available — core signal)
    ml_score = signals.get('ml_score')
    if ml_score is not None:
        components.append(ml_score)
        weights.append(0.45)
        confidence_signals.append('ml')

    # historical score
    hist_score = signals.get('historical_score')
    if hist_score is not None:
        components.append(hist_score)
        weights.append(0.35)
        confidence_signals.append('history')
    else:
        # if no history, give more weight to ML
        if ml_score is not None:
            components.append(ml_score)
            weights.append(0.35)

    # existing reliability (prior)
    existing = signals.get('existing_reliability')
    if existing is not None:
        components.append(existing)
        weights.append(0.10)
        confidence_signals.append('existing')

    # fallback — if somehow we have nothing
    if not components:
        return 50.0, 'LOW'

    # normalise weights
    total_weight = sum(weights)
    norm_weights = [w / total_weight for w in weights]

    # weighted average
    base_score = sum(c * w for c, w in zip(components, norm_weights))

    # apply penalties (subtractive)
    disruption_pen = signals.get('disruption_penalty', 0.0)
    status_pen = signals.get('status_penalty', 0.0)

    final_score = base_score - disruption_pen - status_pen

    # determine confidence
    if len(confidence_signals) >= 3:
        confidence = 'HIGH'
    elif len(confidence_signals) >= 2:
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'

    return final_score, confidence


# ============================================================
#  CONVENIENCE WRAPPERS — dead simple to call
# ============================================================

def score_route(route: dict, scheduled_time=None, weather=None) -> int:
    """
    Simplest possible interface. Pass a route dict, get a score back.

    Returns:
        int: 1-100 reliability percentage
    """
    result = get_route_reliability_score(route, scheduled_time, weather)
    return result['score']


def score_route_detailed(route: dict, scheduled_time=None, weather=None) -> dict:
    """
    Same as score_route but returns the full breakdown.

    Returns:
        dict with score, confidence, factors, prediction, delay_probability
    """
    return get_route_reliability_score(route, scheduled_time, weather)


# ============================================================
#  BATCH SCORING — score many routes at once
# ============================================================

def score_routes_batch(routes: list, scheduled_time=None, weather=None) -> list:
    """
    Score a list of routes. Returns list of result dicts.

    Args:
        routes: list of route dicts (Prisma shape)

    Returns:
        list of score result dicts
    """
    _ensure_model_loaded()

    results = []
    for route in routes:
        try:
            result = get_route_reliability_score(route, scheduled_time, weather)
            results.append(result)
        except Exception as e:
            results.append({
                'routeId': route.get('routeId', 'unknown'),
                'score': 50,
                'confidence': 'LOW',
                'factors': {},
                'prediction': 'UNKNOWN',
                'delay_probability': 0.5,
                'error': str(e),
            })

    return results


# ============================================================
#  EXAMPLE USAGE
# ============================================================

if __name__ == '__main__':
    # Example: score a rail route from Lancaster to Preston
    # In production you'd fetch this from Prisma — here it's a dict
    example_route = {
        'routeId': 'LAN-PRE-001',
        'mode': 'RAIL',
        'operatorId': 'NT',
        'operator': {
            'operatorId': 'NT',
            'name': 'Northern Trains',
        },
        'routeStops': [
            {
                'routeId': 'LAN-PRE-001',
                'stationId': 'LAN',
                'stopOrder': 1,
                'station': {
                    'stationId': 'LAN',
                    'name': 'Lancaster',
                    'latitude': 54.0490,
                    'longitude': -2.8007,
                },
            },
            {
                'routeId': 'LAN-PRE-001',
                'stationId': 'PRE',
                'stopOrder': 2,
                'station': {
                    'stationId': 'PRE',
                    'name': 'Preston',
                    'latitude': 53.7572,
                    'longitude': -2.7024,
                },
            },
        ],
        'busRouteStops': [],
        'railSchedules': [],
        'busSchedules': [],
        'serviceStatuses': [
            {
                'statusId': 'status-001',
                'routeId': 'LAN-PRE-001',
                'delayMinutes': 3,
                'cancellationFlag': False,
                'lastUpdated': datetime.now().isoformat(),
            },
        ],
        'disruptions': [],
        'reliabilityScores': [],
        'historicalPerf': [
            {'perfId': 'p1', 'delayMinutes': 0, 'cancelled': False, 'serviceDate': '2025-01-10'},
            {'perfId': 'p2', 'delayMinutes': 2, 'cancelled': False, 'serviceDate': '2025-01-11'},
            {'perfId': 'p3', 'delayMinutes': 12, 'cancelled': False, 'serviceDate': '2025-01-12'},
            {'perfId': 'p4', 'delayMinutes': 0, 'cancelled': False, 'serviceDate': '2025-01-13'},
            {'perfId': 'p5', 'delayMinutes': 0, 'cancelled': True, 'serviceDate': '2025-01-14'},
            {'perfId': 'p6', 'delayMinutes': 1, 'cancelled': False, 'serviceDate': '2025-01-15'},
        ],
    }

    # THE SIMPLE WAY — one line
    score = score_route(example_route)
    print(f"\n{'=' * 50}")
    print(f"  Route: {example_route['routeId']}")
    print(f"  Reliability Score: {score}%")
    print(f"{'=' * 50}")

    # THE DETAILED WAY — full breakdown
    detailed = score_route_detailed(example_route)
    print(f"\n  Confidence:     {detailed['confidence']}")
    print(f"  Prediction:     {detailed['prediction']}")
    print(f"  Delay Prob:     {detailed['delay_probability']:.1%}")
    print(f"\n  Factor Breakdown:")
    for k, v in detailed['factors'].items():
        if v is not None:
            print(f"    {k:30s} {v}")
    print()