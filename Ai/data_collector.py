"""
    .  _   _  ___ ___ _  _ __ __  .
    . | \ / || __| _ \ || |  V  | .
    . `\ V /'| _|| v / \/ | \_/ | .
    .   \_/  |___|_|_\\__/|_| |_| .
  
    Author: Verum | Dc: 9to9
    Description: Data collection for SCC.200 Group Project
    
    NOTE:   AI tools were used to help structure logging output, code formatting and a code review.
            All core logic, data models, and collection is my own work.
"""

import stomp
import json
import csv
import os
import time
import requests
import threading
import gzip
import shutil
from datetime import datetime, timedelta
from collections import defaultdict

# CONFIG
DATA_DIR = 'transport_data'
BASE_URL = 'http://transport.scc.lancs.ac.uk'
STOMP_HOST = 'transport.scc.lancs.ac.uk'
STOMP_PORT = 61618

BUS_POLL_INTERVAL = 60
WEATHER_POLL_INTERVAL = 300
DEPARTURES_POLL_INTERVAL = 120
ROAD_POLL_INTERVAL = 120
STATUS_INTERVAL = 30

LANCASHIRE_BUS_OPERATORS = [
    'ARCT', 'BLAC', 'SSTL', 'TRAN', 'CCOA', 'HOSK', 'PRST', 'BNGS'
]

LANCASHIRE_STATIONS = [
    'LAN', 'PRE', 'BPN', 'BPS', 'PFY', 'KKM', 'MBR', 'CNF',
    'BBN', 'DWN', 'ACR', 'BUB', 'BNC', 'NEL', 'CNE', 'CLH',
    'LAY', 'BAI', 'LOT', 'CRL', 'ADS', 'BSV', 'RWC', 'LGO',
    'WHL', 'PLE', 'CHT', 'MIL'
]

WEATHER_POINTS = [
    (54.05, -2.80, 'Lancaster'), (53.76, -2.70, 'Preston'),
    (53.82, -3.05, 'Blackpool'), (53.69, -2.63, 'Blackburn'),
    (53.79, -2.25, 'Burnley'), (53.87, -2.38, 'Clitheroe'),
    (54.07, -2.87, 'Morecambe'), (54.12, -2.77, 'Carnforth'),
    (53.85, -2.17, 'Nelson'), (53.76, -2.49, 'Chorley'),
    (53.76, -2.90, 'Fylde'), (53.65, -2.63, 'Darwen'),
]


# CSV WRITER
class CSVWriter:
    def __init__(self, category, headers):
        self.category = category
        self.headers = headers
        self.lock = threading.Lock()
        self.row_count = 0
        self._current_date = None
        self._current_file = None
        self._current_writer = None
        self._file_handle = None

        folder = os.path.join(DATA_DIR, category)
        os.makedirs(folder, exist_ok=True)

    def _get_filepath(self):
        today = datetime.now().strftime('%Y-%m-%d')
        return os.path.join(
            DATA_DIR, self.category,
            f"{today}_{self.category}.csv"
        )

    def _ensure_file(self):
        today = datetime.now().strftime('%Y-%m-%d')
        if today != self._current_date:
            if self._file_handle:
                self._file_handle.close()

            # compress yesterdays file if is there
            if self._current_date:
                self._compress_old_file()

            self._current_date = today
            filepath = self._get_filepath()
            file_exists = os.path.exists(filepath)

            self._file_handle = open(filepath, 'a', newline='', encoding='utf-8')
            self._current_writer = csv.writer(self._file_handle)

            if not file_exists:
                self._current_writer.writerow(self.headers)
                self._file_handle.flush()

    def _compress_old_file(self):
        try:
            yesterday = (
                datetime.now() - timedelta(days=1)
            ).strftime('%Y-%m-%d')
            old_path = os.path.join(
                DATA_DIR, self.category,
                f"{yesterday}_{self.category}.csv"
            )
            if os.path.exists(old_path):
                with open(old_path, 'rb') as f_in:
                    with gzip.open(old_path + '.gz', 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(old_path)
        except Exception:
            pass

    def write(self, row):
        with self.lock:
            self._ensure_file()
            self._current_writer.writerow(row)
            self._file_handle.flush()
            self.row_count += 1

    def write_many(self, rows):
        with self.lock:
            self._ensure_file()
            for row in rows:
                self._current_writer.writerow(row)
                self.row_count += 1
            self._file_handle.flush()

    def close(self):
        with self.lock:
            if self._file_handle:
                self._file_handle.close()


# ALL THE CSVS, BECAUSE I CBA WITH SQL
writers = {}
def init_writers():
    global writers
    writers = {
        'rail_movements': CSVWriter('rail_movements', [
            'collected_at', 'msg_timestamp', 'train_id', 'train_uid',
            'train_service_code', 'toc_id', 'loc_stanox',
            'next_report_stanox', 'planned_timestamp', 'actual_timestamp',
            'gbtt_timestamp', 'timetable_variation', 'variation_status',
            'delay_monitoring_point', 'event_type', 'event_source',
            'platform', 'route', 'line_ind', 'direction_ind',
            'offroute_ind', 'train_terminated', 'division_code'
        ]),

        'rail_activations': CSVWriter('rail_activations', [
            'collected_at', 'msg_timestamp', 'train_id', 'train_uid',
            'train_service_code', 'toc_id', 'schedule_source',
            'schedule_type', 'schedule_wtt_id', 'schedule_start_date',
            'schedule_end_date', 'origin_stanox', 'origin_timestamp',
            'origin_dep_timestamp', 'sched_origin_stanox',
            'creation_timestamp'
        ]),

        'rail_cancellations': CSVWriter('rail_cancellations', [
            'collected_at', 'msg_timestamp', 'train_id', 'train_uid',
            'train_service_code', 'toc_id', 'canx_timestamp',
            'canx_reason_code', 'canx_type', 'loc_stanox',
            'division_code'
        ]),

        'rail_other': CSVWriter('rail_other', [
            'collected_at', 'msg_type', 'msg_timestamp', 'train_id',
            'train_uid', 'raw_json'
        ]),

        'rail_departures': CSVWriter('rail_departures', [
            'collected_at', 'station_crs', 'service_id', 'destination',
            'scheduled_time', 'estimated_time', 'actual_time',
            'platform', 'operator', 'is_cancelled', 'cancel_reason',
            'delay_reason'
        ]),

        'bus_positions': CSVWriter('bus_positions', [
            'collected_at', 'noc_code', 'vehicle_ref', 'line_ref',
            'direction_ref', 'published_line_name', 'origin_ref',
            'origin_name', 'destination_ref', 'destination_name',
            'latitude', 'longitude', 'bearing', 'recorded_at',
            'valid_until', 'delay_seconds', 'origin_aimed_departure'
        ]),

        'weather': CSVWriter('weather', [
            'collected_at', 'latitude', 'longitude', 'location_name',
            'temp_celsius', 'feels_like', 'humidity', 'pressure',
            'wind_speed', 'wind_deg', 'wind_gust', 'clouds_percent',
            'visibility', 'weather_main', 'weather_description',
            'rain_1h', 'rain_3h', 'snow_1h', 'snow_3h'
        ]),

        'road_vms': CSVWriter('road_vms', [
            'collected_at', 'raw_json'
        ]),

        'errors': CSVWriter('errors', [
            'timestamp', 'source', 'error_message'
        ]),
    }


def log_error(source, message):
    try:
        writers['errors'].write([
            datetime.now().isoformat(), source, str(message)[:500]
        ])
    except Exception:
        pass


# REFERENCE DATA
def load_reference_data():
    ref_dir = os.path.join(DATA_DIR, 'reference')
    os.makedirs(ref_dir, exist_ok=True)

    # CORPUS
    corpus_path = os.path.join(ref_dir, 'corpus.csv')
    if not os.path.exists(corpus_path):
        print("[REF] Downloading...")
        try:
            resp = requests.get(f'{BASE_URL}/rail/corpus', timeout=120)
            data = resp.json()
            entries = data.get('TIPLOCDATA', data if isinstance(data, list) else [])

            with open(corpus_path, 'w', newline='', encoding='utf-8') as f:
                w = csv.writer(f)
                w.writerow([
                    'stanox', 'tiploc', 'crs', 'description'
                ])
                count = 0
                for e in entries:
                    stanox = (e.get('STANOX') or '').strip()
                    if not stanox:
                        continue
                    w.writerow([
                        stanox,
                        (e.get('TIPLOC') or '').strip(),
                        (e.get('3ALPHA') or '').strip(),
                        (e.get('NLCDESC') or '').strip(),
                    ])
                    count += 1
            print(f"[REF] saved {count} locations to corpus.csv")
        except Exception as e:
            print(f"[REF] download failed: {e}")
    else:
        print("[REF] corpus.csv exists")

    # Delay codes
    delay_path = os.path.join(ref_dir, 'delay_codes.json')
    if not os.path.exists(delay_path):
        print("[REF] downloading delay codes...")
        try:
            resp = requests.get(
                f'{BASE_URL}/rail/delay-codes.json', timeout=30
            )
            with open(delay_path, 'w') as f:
                json.dump(resp.json(), f, indent=2)
            print("[REF] saved delay_codes.json")
        except Exception as e:
            print(f"[REF] delay codes failed: {e}")
    else:
        print("[REF] delay_codes exists, skipping")

    # Lancashire stations
    stations_path = os.path.join(ref_dir, 'lancashire_stations.csv')
    if not os.path.exists(stations_path):
        stations = [
            ('LAN', 'Lancaster', 54.0490, -2.8007),
            ('PRE', 'Preston', 53.7572, -2.7024),
            ('BPN', 'Blackpool North', 53.8171, -3.0545),
            ('BPS', 'Blackpool South', 53.7952, -3.0480),
            ('PFY', 'Poulton-le-Fylde', 53.7589, -2.8936),
            ('KKM', 'Kirkham & Wesham', 53.7463, -2.7073),
            ('MBR', 'Morecambe', 54.0726, -2.8676),
            ('CNF', 'Carnforth', 54.1177, -2.7716),
            ('BBN', 'Blackburn', 53.6922, -2.6285),
            ('DWN', 'Darwen', 53.6486, -2.6325),
            ('ACR', 'Accrington', 53.7553, -2.6184),
            ('BUB', 'Burnley Manchester Rd', 53.7896, -2.2475),
            ('BNC', 'Burnley Central', 53.7882, -2.2312),
            ('NEL', 'Nelson', 53.8502, -2.1722),
            ('CNE', 'Colne', 53.8614, -2.1563),
            ('CLH', 'Clitheroe', 53.8708, -2.3816),
            ('LAY', 'Layton', 53.7758, -2.9565),
            ('BAI', 'Bamber Bridge', 53.7350, -2.6630),
            ('LOT', 'Lostock Hall', 53.7265, -2.6885),
            ('CRL', 'Chorley', 53.6530, -2.6320),
        ]
        with open(stations_path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(['crs', 'name', 'latitude', 'longitude'])
            w.writerows(stations)
        print("[REF] saved the lancashire stations")







# STOMP RAIL LISTENER
class RailListener(stomp.ConnectionListener):
    def __init__(self):
        self.connected = False
        self.buffer = []
        self.buffer_lock = threading.Lock()
        self.last_flush = time.time()
        self.stats = defaultdict(int)

    def on_connected(self, frame):
        self.connected = True
        print(f"[RAIL] STOMP connected at {datetime.now().strftime('%H:%M:%S')}")

    def on_message(self, frame):
        try:
            messages = json.loads(frame.body)
            if not isinstance(messages, list):
                messages = [messages]

            now = datetime.now().isoformat()

            for msg in messages:
                body = msg.get('body', msg)
                header = msg.get('header', {})
                msg_type = header.get('msg_type', '')
                ts = header.get('msg_queue_timestamp', '')

                with self.buffer_lock:
                    if msg_type == '0001':
                        self.buffer.append(('activation', [
                            now, ts,
                            body.get('train_id', ''),
                            body.get('train_uid', ''),
                            body.get('train_service_code', ''),
                            body.get('toc_id', ''),
                            body.get('schedule_source', ''),
                            body.get('schedule_type', ''),
                            body.get('schedule_wtt_id', ''),
                            body.get('schedule_start_date', ''),
                            body.get('schedule_end_date', ''),
                            body.get('tp_origin_stanox', ''),
                            body.get('tp_origin_timestamp', ''),
                            body.get('origin_dep_timestamp', ''),
                            body.get('sched_origin_stanox', ''),
                            body.get('creation_timestamp', ''),
                        ]))
                        self.stats['activations'] += 1

                    elif msg_type == '0002':
                        self.buffer.append(('cancellation', [
                            now, ts,
                            body.get('train_id', ''),
                            body.get('train_uid', ''),
                            body.get('train_service_code', ''),
                            body.get('toc_id', ''),
                            body.get('canx_timestamp', ''),
                            body.get('canx_reason_code', ''),
                            body.get('canx_type', ''),
                            body.get('loc_stanox', ''),
                            body.get('division_code', ''),
                        ]))
                        self.stats['cancellations'] += 1

                    elif msg_type == '0003':
                        variation = body.get('timetable_variation', '')
                        try:
                            variation = int(variation) if variation else ''
                        except (ValueError, TypeError):
                            variation = ''

                        self.buffer.append(('movement', [
                            now, ts,
                            body.get('train_id', ''),
                            body.get('train_uid', ''),
                            body.get('train_service_code', ''),
                            body.get('toc_id', ''),
                            body.get('loc_stanox', ''),
                            body.get('next_report_stanox', ''),
                            body.get('planned_timestamp', ''),
                            body.get('actual_timestamp', ''),
                            body.get('gbtt_timestamp', ''),
                            variation,
                            body.get('variation_status', ''),
                            body.get('delay_monitoring_point', ''),
                            body.get('event_type', ''),
                            body.get('event_source', ''),
                            body.get('platform', ''),
                            body.get('route', ''),
                            body.get('line_ind', ''),
                            body.get('direction_ind', ''),
                            body.get('offroute_ind', ''),
                            body.get('train_terminated', ''),
                            body.get('division_code', ''),
                        ]))
                        self.stats['movements'] += 1

                    elif msg_type in ('0005', '0006', '0007', '0008'):
                        self.buffer.append(('other', [
                            now, msg_type, ts,
                            body.get('train_id', ''),
                            body.get('train_uid', ''),
                            json.dumps(body),
                        ]))
                        self.stats['other'] += 1

            # flush every 5s
            if time.time() - self.last_flush > 5:
                self._flush()

        except Exception as e:
            self.stats['errors'] += 1
            log_error('rail_stomp', e)

    def _flush(self):
        with self.buffer_lock:
            if not self.buffer:
                return
            batch = self.buffer.copy()
            self.buffer.clear()

        movements = []
        activations = []
        cancellations = []
        others = []

        for msg_type, row in batch:
            if msg_type == 'movement':
                movements.append(row)
            elif msg_type == 'activation':
                activations.append(row)
            elif msg_type == 'cancellation':
                cancellations.append(row)
            elif msg_type == 'other':
                others.append(row)

        if movements:
            writers['rail_movements'].write_many(movements)
        if activations:
            writers['rail_activations'].write_many(activations)
        if cancellations:
            writers['rail_cancellations'].write_many(cancellations)
        if others:
            writers['rail_other'].write_many(others)

        self.last_flush = time.time()

    def on_error(self, frame):
        print(f"[RAIL] STOMP error: {frame.body}")
        log_error('rail_stomp', frame.body)

    def on_disconnected(self):
        self.connected = False
        self._flush()
        print(f"[RAIL] STOMP disconnected at {datetime.now().strftime('%H:%M:%S')}")

    def flush(self):
        self._flush()


# POLLERS for bus, weather, departures and road
def poll_bus_positions(stop_event):
    import xml.etree.ElementTree as ET

    while not stop_event.is_set():
        now = datetime.now().isoformat()
        total = 0

        for noc in LANCASHIRE_BUS_OPERATORS:
            if stop_event.is_set():
                break
            try:
                resp = requests.get(
                    f'{BASE_URL}/bus/live/{noc}', timeout=30
                )
                if resp.status_code != 200:
                    continue

                positions = []
                content = resp.text.strip()

                # try XML
                if content.startswith('<'):
                    try:
                        root = ET.fromstring(content)
                        for el in root.iter():
                            if el.tag.endswith('VehicleActivity'):
                                pos = _parse_siri_activity(el, noc)
                                if pos:
                                    positions.append(pos)
                    except ET.ParseError:
                        pass

                # try JSON
                if not positions:
                    try:
                        data = json.loads(content)
                        if isinstance(data, list):
                            items = data
                        elif isinstance(data, dict):
                            items = (
                                data.get('VehicleActivity',
                                data.get('vehicles',
                                data.get('body', [])))
                            )
                            if not isinstance(items, list):
                                items = [items]
                        else:
                            items = []

                        for item in items:
                            j = item.get('MonitoredVehicleJourney', item)
                            loc = j.get('VehicleLocation', {})
                            positions.append([
                                now, noc,
                                j.get('VehicleRef', ''),
                                j.get('LineRef', ''),
                                j.get('DirectionRef', ''),
                                j.get('PublishedLineName', ''),
                                j.get('OriginRef', ''),
                                j.get('OriginName', ''),
                                j.get('DestinationRef', ''),
                                j.get('DestinationName', ''),
                                loc.get('Latitude', ''),
                                loc.get('Longitude', ''),
                                j.get('Bearing', ''),
                                item.get('RecordedAtTime', ''),
                                item.get('ValidUntilTime', ''),
                                _parse_delay(j.get('Delay', '')),
                                j.get('OriginAimedDepartureTime', ''),
                            ])
                    except (json.JSONDecodeError, AttributeError):
                        pass

                if positions:
                    writers['bus_positions'].write_many(positions)
                    total += len(positions)

            except Exception as e:
                log_error('bus', f"{noc}: {e}")

            time.sleep(1)

        if total > 0:
            pass

        stop_event.wait(BUS_POLL_INTERVAL)


def _parse_siri_activity(activity_el, noc):
    def find_text(el, local_name):
        for child in el.iter():
            if child.tag.endswith(local_name):
                return (child.text or '').strip()
        return ''

    def find_in(parent, local_name):
        for child in parent.iter():
            if child.tag.endswith(local_name):
                return child
        return None

    now = datetime.now().isoformat()
    journey = find_in(activity_el, 'MonitoredVehicleJourney')
    if journey is None:
        return None

    loc = find_in(journey, 'VehicleLocation')
    lat = find_text(loc, 'Latitude') if loc is not None else ''
    lon = find_text(loc, 'Longitude') if loc is not None else ''

    return [
        now, noc,
        find_text(journey, 'VehicleRef'),
        find_text(journey, 'LineRef'),
        find_text(journey, 'DirectionRef'),
        find_text(journey, 'PublishedLineName'),
        find_text(journey, 'OriginRef'),
        find_text(journey, 'OriginName'),
        find_text(journey, 'DestinationRef'),
        find_text(journey, 'DestinationName'),
        lat, lon,
        find_text(journey, 'Bearing'),
        find_text(activity_el, 'RecordedAtTime'),
        find_text(activity_el, 'ValidUntilTime'),
        _parse_delay(find_text(journey, 'Delay')),
        find_text(journey, 'OriginAimedDepartureTime'),
    ]


def _parse_delay(delay_str):
    if not delay_str:
        return ''
    try:
        return int(delay_str)
    except (ValueError, TypeError):
        pass
    try:
        s = str(delay_str).replace(' ', '')
        negative = s.startswith('-')
        s = s.lstrip('-').replace('PT', '').replace('pt', '')
        seconds = 0
        if 'H' in s:
            parts = s.split('H')
            seconds += int(parts[0]) * 3600
            s = parts[1]
        if 'M' in s:
            parts = s.split('M')
            seconds += int(parts[0]) * 60
            s = parts[1]
        if s.endswith('S'):
            seconds += int(float(s.rstrip('S')))
        return -seconds if negative else seconds
    except Exception:
        return ''


def poll_weather(stop_event):
    while not stop_event.is_set():
        now = datetime.now().isoformat()

        for lat, lon, name in WEATHER_POINTS:
            if stop_event.is_set():
                break
            try:
                resp = requests.get(
                    f'{BASE_URL}/weather?lat={lat}&lon={lon}', timeout=15
                )
                if resp.status_code != 200:
                    continue

                raw = resp.json()

                # actual weather data is under 'weather'
                data = raw.get('weather', raw)
                if not isinstance(data, dict) or 'main' not in data:
                    continue

                main_d = data['main']
                wind = data.get('wind', {})
                rain = data.get('rain', {})
                snow = data.get('snow', {})
                wx = data.get('weather', [{}])
                if isinstance(wx, list) and wx:
                    wx = wx[0]
                else:
                    wx = {}

                writers['weather'].write([
                    now, lat, lon, name,
                    main_d.get('temp', ''),
                    main_d.get('feels_like', ''),
                    main_d.get('humidity', ''),
                    main_d.get('pressure', ''),
                    wind.get('speed', ''),
                    wind.get('deg', ''),
                    wind.get('gust', ''),
                    data.get('clouds', {}).get('all', ''),
                    data.get('visibility', ''),
                    wx.get('main', ''),
                    wx.get('description', ''),
                    rain.get('1h', ''),
                    rain.get('3h', ''),
                    snow.get('1h', ''),
                    snow.get('3h', ''),
                ])

            except json.JSONDecodeError:
                pass
            except Exception as e:
                log_error('weather', f"{name}: {e}")

            time.sleep(1)

        stop_event.wait(WEATHER_POLL_INTERVAL)


def poll_departures(stop_event):
    while not stop_event.is_set():
        now = datetime.now().isoformat()

        for crs in LANCASHIRE_STATIONS:
            if stop_event.is_set():
                break
            try:
                resp = requests.get(
                    f'{BASE_URL}/rail/departures/{crs}', timeout=15
                )

                if resp.status_code != 200:
                    continue
                text = resp.text.strip()
                if not text or text.startswith('<') or text.startswith('<!'):
                    continue

                data = resp.json()

                services = []
                if isinstance(data, list):
                    services = data
                elif isinstance(data, dict):
                    for key in [
                        'trainServices', 'services', 'departures',
                        'GetStationBoardResult'
                    ]:
                        if key in data:
                            val = data[key]
                            if isinstance(val, dict) and 'trainServices' in val:
                                val = val['trainServices']
                            if isinstance(val, dict) and 'service' in val:
                                val = val['service']
                            if isinstance(val, list):
                                services = val
                                break
                            elif isinstance(val, dict):
                                services = [val]
                                break

                for svc in services:
                    if not isinstance(svc, dict):
                        continue

                    dest = svc.get('destination', '')
                    if isinstance(dest, list) and dest:
                        dest = dest[0]
                    if isinstance(dest, dict):
                        dest = dest.get(
                            'locationName',
                            dest.get('name', str(dest))
                        )

                    writers['rail_departures'].write([
                        now, crs,
                        svc.get('serviceID', svc.get('rid', '')),
                        dest,
                        svc.get('std', svc.get('scheduledTime', '')),
                        svc.get('etd', svc.get('estimatedTime', '')),
                        svc.get('atd', svc.get('actualTime', '')),
                        svc.get('platform', ''),
                        svc.get('operator', svc.get('operatorName', '')),
                        1 if svc.get('isCancelled', False) else 0,
                        svc.get('cancelReason', ''),
                        svc.get('delayReason', ''),
                    ])

            except json.JSONDecodeError:
                pass
            except Exception as e:
                log_error('departures', f"{crs}: {e}")

            time.sleep(2)

        stop_event.wait(DEPARTURES_POLL_INTERVAL)


def poll_road_vms(stop_event):
    while not stop_event.is_set():
        now = datetime.now().isoformat()
        try:
            resp = requests.get(f'{BASE_URL}/road/vms', timeout=15)
            if resp.status_code == 200:
                writers['road_vms'].write([now, resp.text[:10000]])
        except Exception as e:
            log_error('road_vms', e)

        stop_event.wait(ROAD_POLL_INTERVAL)


# STOMP CONNECTION MANAGER
class STOMPManager:
    def __init__(self):
        self.listener = RailListener()
        self.conn = None
        self.running = False
        self.thread = None

    def _connect(self):
        try:
            self.conn = stomp.Connection(
                [('transport.scc.lancs.ac.uk', 61613)]
            )
            self.conn.set_listener('rail', self.listener)
            self.conn.connect(
                username='guest',
                passcode='guest',
                wait=True,
                headers={'host': '/'}
            )

            subs = [
                ('/topic/TRAIN_MVT_ALL_TOC', '1'),
                ('/topic/VSTP_ALL', '3'),
                ('/topic/TSR_ALL_ROUTE', '4'),
            ]
            for dest, sid in subs:
                self.conn.subscribe(destination=dest, id=sid, ack='auto')
                print(f"[RAIL] Subscribed: {dest}")

            return True

        except Exception as e:
            print(f"[RAIL] Connection failed: {e}")
            import traceback
            traceback.print_exc()
            log_error('rail_stomp', f"Connection failed: {e}")
            return False

    def _run(self):
        while self.running:
            if not self.listener.connected:
                print("[RAIL] Connecting to STOMP...")
                if not self._connect():
                    time.sleep(30)
                    continue
            time.sleep(5)
            self.listener.flush()

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        self.listener.flush()
        if self.conn:
            try:
                self.conn.disconnect()
            except Exception:
                pass
        if self.thread:
            self.thread.join(timeout=10)


# MAIN
def main():
    # Behold Goofy a AI main function
    print("=" * 65)
    print("  LANCASHIRE TRANSPORT DATA COLLECTOR")
    print(f"  Data directory: {os.path.abspath(DATA_DIR)}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    os.makedirs(DATA_DIR, exist_ok=True)
    init_writers()
    load_reference_data()

    stop_event = threading.Event()

    stomp_mgr = STOMPManager()
    stomp_mgr.start()

    pollers = [
        ('Bus GPS', threading.Thread(
            target=poll_bus_positions, args=(stop_event,), daemon=True
        )),
        ('Weather', threading.Thread(
            target=poll_weather, args=(stop_event,), daemon=True
        )),
        ('Departures', threading.Thread(
            target=poll_departures, args=(stop_event,), daemon=True
        )),
        ('Road VMS', threading.Thread(
            target=poll_road_vms, args=(stop_event,), daemon=True
        )),
    ]

    for name, t in pollers:
        t.start()
        print(f"[POLL] {name} poller started")

    print("\n" + "=" * 65)
    print("  ALL COLLECTORS RUNNING — Ctrl+C to stop")
    print("=" * 65 + "\n")

    start_time = time.time()

    try:
        while True:
            time.sleep(STATUS_INTERVAL)

            elapsed = int(time.time() - start_time)
            h, m, s = elapsed // 3600, (elapsed % 3600) // 60, elapsed % 60

            rail_stats = stomp_mgr.listener.stats
            row_counts = {k: w.row_count for k, w in writers.items()}

            total_rows = sum(row_counts.values())
            data_size = _get_dir_size(DATA_DIR)

            print(
                f"[{h:02d}:{m:02d}:{s:02d}] "
                f"Rail: {rail_stats['movements']}mv "
                f"{rail_stats['activations']}act "
                f"{rail_stats['cancellations']}canx | "
                f"Bus: {row_counts.get('bus_positions', 0)} | "
                f"Wx: {row_counts.get('weather', 0)} | "
                f"Dep: {row_counts.get('rail_departures', 0)} | "
                f"Total: {total_rows:,} rows | "
                f"Size: {data_size}"
            )

    except KeyboardInterrupt:
        print("\n\n[STOP] Shutting down gracefully...")

    stop_event.set()
    stomp_mgr.stop()

    for name, w in writers.items():
        w.close()

    total_rows = sum(w.row_count for w in writers.values())
    elapsed = int(time.time() - start_time)

    print(f"\n{'=' * 65}")
    print(f"  COLLECTION COMPLETE")
    print(f"  Runtime: {elapsed // 3600}h {(elapsed % 3600) // 60}m")
    print(f"  Total rows: {total_rows:,}")
    print(f"  Data: {os.path.abspath(DATA_DIR)}")
    print(f"{'=' * 65}")


def _get_dir_size(path):
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            total += os.path.getsize(os.path.join(dirpath, f))
    if total > 1_000_000_000:
        return f"{total / 1_000_000_000:.1f} GB"
    elif total > 1_000_000:
        return f"{total / 1_000_000:.1f} MB"
    else:
        return f"{total / 1_000:.1f} KB"


if __name__ == '__main__':
    main()