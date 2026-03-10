"""
    .  _   _  ___ ___ _  _ __ __  .
    . | \ / || __| _ \ || |  V  | .
    . `\ V /'| _|| v / \/ | \_/ | .
    .   \_/  |___|_|_\\__/|_| |_| .
  
    Author: Verum | Dc: 9to9
    Description: Short example on how to predict trains - SCC.200 Group Project
    
    NOTE:   AI tools were used to help structure, log the output along with formating and reviewing code.
            All core logic is my own work. EXCEPT : Prisma implementation & Certain parts of the AI that just sped up me reading the API.
"""

import os
import sys
from datetime import datetime

# Add parent directory to path if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from delay_predictor import load_model, predict_delay

def predict_1Y92():
    """
    Predict delay for train 1Y92 (Barrow-in-Furness to Manchester Airport)
    Operated by Northern, departing 06:50
    """
    
    # Load the trained model
    try:
        model, encoders, feature_meta = load_model()
    except FileNotFoundError as e:
        print(f"[ERROR] {e}")
        print("[ERROR] Run delay_predictor.py first to train the model")
        return None

    # Train details from the schedule
    train_info = {
        'train_uid': 'L07210',
        'train_id': '1Y92',
        'headcode': '9115',
        'toc': 'Northern',
        'toc_id': 'NT',  # Northern Trains TOC code
        'origin': 'Barrow-in-Furness',
        'destination': 'Manchester Airport',
        'trust_id': '111Y92M610',
    }

    # Key stations along the route with their STANOX codes
    # You may need to adjust these based on your corpus data
    stations = [
        {'name': 'Barrow-in-Furness', 'crs': 'BIF', 'stanox': '24673', 'platform': '2', 'scheduled': '06:50', 'event': 'DEPARTURE'},
        {'name': 'Roose', 'crs': 'ROO', 'stanox': '24667', 'platform': '1', 'scheduled': '06:54', 'event': 'DEPARTURE'},
        {'name': 'Dalton', 'crs': 'DLT', 'stanox': '24659', 'platform': '1', 'scheduled': '07:00', 'event': 'DEPARTURE'},
        {'name': 'Ulverston', 'crs': 'ULV', 'stanox': '24643', 'platform': '', 'scheduled': '07:09', 'event': 'DEPARTURE'},
        {'name': 'Cark', 'crs': 'CAK', 'stanox': '24631', 'platform': '2', 'scheduled': '07:16', 'event': 'DEPARTURE'},
        {'name': 'Kents Bank', 'crs': 'KBK', 'stanox': '24625', 'platform': '1', 'scheduled': '07:20', 'event': 'DEPARTURE'},
        {'name': 'Grange-over-Sands', 'crs': 'GOS', 'stanox': '24619', 'platform': '1', 'scheduled': '07:24', 'event': 'DEPARTURE'},
        {'name': 'Arnside', 'crs': 'ARN', 'stanox': '24613', 'platform': '', 'scheduled': '07:29', 'event': 'DEPARTURE'},
        {'name': 'Silverdale', 'crs': 'SVR', 'stanox': '24607', 'platform': '2', 'scheduled': '07:34', 'event': 'DEPARTURE'},
        {'name': 'Carnforth', 'crs': 'CNF', 'stanox': '24181', 'platform': '1', 'scheduled': '07:43', 'event': 'DEPARTURE'},
        {'name': 'Lancaster', 'crs': 'LAN', 'stanox': '24155', 'platform': '4', 'scheduled': '07:51', 'event': 'DEPARTURE'},
        {'name': 'Preston', 'crs': 'PRE', 'stanox': '24081', 'platform': '4', 'scheduled': '08:11', 'event': 'DEPARTURE'},
        {'name': 'Chorley', 'crs': 'CRL', 'stanox': '23973', 'platform': '', 'scheduled': '08:22', 'event': 'DEPARTURE'},
        {'name': 'Horwich Parkway', 'crs': 'HWI', 'stanox': '23911', 'platform': '', 'scheduled': '08:29', 'event': 'DEPARTURE'},
        {'name': 'Bolton', 'crs': 'BON', 'stanox': '23887', 'platform': '3', 'scheduled': '08:37', 'event': 'DEPARTURE'},
        {'name': 'Deansgate', 'crs': 'DGT', 'stanox': '18481', 'platform': '1', 'scheduled': '08:52', 'event': 'DEPARTURE'},
        {'name': 'Manchester Oxford Road', 'crs': 'MCO', 'stanox': '18477', 'platform': '4', 'scheduled': '08:56', 'event': 'DEPARTURE'},
        {'name': 'Manchester Piccadilly', 'crs': 'MAN', 'stanox': '18471', 'platform': '13', 'scheduled': '09:00', 'event': 'ARRIVAL'},
        {'name': 'Gatley', 'crs': 'GTY', 'stanox': '18369', 'platform': '', 'scheduled': '09:09', 'event': 'DEPARTURE'},
        {'name': 'Manchester Airport', 'crs': 'MIA', 'stanox': '18351', 'platform': '2A', 'scheduled': '09:15', 'event': 'ARRIVAL'},
    ]

    # Get today's date for scheduling
    today = datetime.now().date()

    print(f"\n{'=' * 70}")
    print(f"  DELAY PREDICTION FOR TRAIN {train_info['train_id']}")
    print(f"  {train_info['origin']} → {train_info['destination']}")
    print(f"  Operated by: {train_info['toc']} | UID: {train_info['train_uid']}")
    print(f"  Date: {today.strftime('%Y-%m-%d')}")
    print(f"{'=' * 70}\n")

    predictions = []

    for station in stations:
        # Parse scheduled time
        hour, minute = map(int, station['scheduled'].split(':'))
        scheduled_time = datetime(today.year, today.month, today.day, hour, minute)

        # Make prediction
        result = predict_delay(
            model=model,
            encoders=encoders,
            feature_meta=feature_meta,
            toc_id=train_info['toc_id'],
            loc_stanox=station['stanox'],
            event_type=station['event'],
            direction='DOWN',  # Southbound from Barrow to Manchester
            platform=station['platform'] if station['platform'] else 'UNK',
            route='UNK',
            line_ind='UNK',
            event_source='AUTOMATIC',
            scheduled_time=scheduled_time,
            weather=None,  # Could add weather data here
            stanox_history=None,
            toc_history=None,
        )

        predictions.append({
            'station': station['name'],
            'crs': station['crs'],
            'scheduled': station['scheduled'],
            'event': station['event'],
            'is_late': result['is_late'],
            'probability': result['probability'],
            'confidence': result['confidence'],
        })

        # Print result
        status = '⚠️  LATE' if result['is_late'] else '✓ ON TIME'
        prob_bar = '█' * int(result['probability'] * 20) + '░' * (20 - int(result['probability'] * 20))
        print(f"  {station['scheduled']} {station['name']:30s} {station['event']:9s} | {status:12s} | {prob_bar} {result['probability']:.1%} [{result['confidence']}]")

    # Summary
    late_count = sum(1 for p in predictions if p['is_late'])
    avg_probability = sum(p['probability'] for p in predictions) / len(predictions)

    print(f"\n{'=' * 70}")
    print(f"  SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Stations predicted late: {late_count}/{len(predictions)}")
    print(f"  Average delay probability: {avg_probability:.1%}")
    
    # Overall journey prediction
    if avg_probability > 0.5:
        overall = "LIKELY DELAYED"
    elif avg_probability > 0.3:
        overall = "POSSIBLE DELAYS"
    else:
        overall = "LIKELY ON TIME"
    
    print(f"  Overall journey prediction: {overall}")
    print(f"{'=' * 70}\n")

    return {
        'train_info': train_info,
        'predictions': predictions,
        'summary': {
            'late_count': late_count,
            'total_stations': len(predictions),
            'avg_probability': avg_probability,
            'overall': overall,
        }
    }


def predict_single_station(stanox, toc_id='NT', event_type='DEPARTURE', 
                           scheduled_time=None, platform='UNK'):
    """
    Predict delay for a single station.
    
    Args:
        stanox: STANOX code for the station
        toc_id: Train operating company code (default: NT for Northern)
        event_type: 'ARRIVAL' or 'DEPARTURE'
        scheduled_time: datetime object (default: now)
        platform: Platform number/string
    
    Returns:
        dict with prediction results
    """
    model, encoders, feature_meta = load_model()
    
    if scheduled_time is None:
        scheduled_time = datetime.now()
    
    result = predict_delay(
        model=model,
        encoders=encoders,
        feature_meta=feature_meta,
        toc_id=toc_id,
        loc_stanox=stanox,
        event_type=event_type,
        direction='DOWN',
        platform=platform,
        scheduled_time=scheduled_time,
    )
    
    return result


if __name__ == '__main__':
    # Run the prediction for 1Y92
    result = predict_1Y92()
    
    if result:
        print("\n[JSON OUTPUT]")
        import json
        print(json.dumps(result, indent=2, default=str))