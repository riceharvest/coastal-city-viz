#!/usr/bin/env python3
import csv
import json
import math
import re
import statistics
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data' / 'sources' / 'generated-vacation'
CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / 'src' / 'vacationData.ts'
TODAY = date.today().isoformat()
START = '2021-01-01'
END = '2025-12-31'
MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

HEADERS = {'User-Agent': 'coastal-city-viz source-backed data generator/1.0 (https://coastal-city-viz.vercel.app/)'}
COUNTRY_CODES = {
    'Thailand': 'TH', 'Vietnam': 'VN', 'Malaysia': 'MY', 'Philippines': 'PH',
    'Indonesia': 'ID', 'Cambodia': 'KH', 'Myanmar': 'MM'
}
COUNTRY_SLUGS = {
    'Thailand': 'thailand', 'Vietnam': 'vietnam', 'Malaysia': 'malaysia', 'Philippines': 'philippines',
    'Indonesia': 'indonesia', 'Cambodia': 'cambodia', 'Myanmar': 'myanmar-burma'
}
# Parsed from US State Dept travel advisories page during generation; fallback values kept explicit and sourced to that page.
FALLBACK_US_ADVISORY = {
    'Thailand': (2, 'Exercise increased caution'),
    'Vietnam': (1, 'Exercise normal precautions'),
    'Malaysia': (1, 'Exercise normal precautions'),
    'Indonesia': (2, 'Exercise increased caution'),
    'Philippines': (2, 'Exercise increased caution'),
    'Cambodia': (2, 'Exercise increased caution'),
    'Myanmar': (4, 'Do not travel'),
}

ALIASES = {
    'Subic / Olongapo': 'Olongapo Subic Bay',
    'Belitung / Tanjung Pandan': 'Tanjung Pandan Belitung',
    'Surabaya / Soerabaja': 'Surabaya',
    'Semarang / Samarang': 'Semarang',
    'Cebu / Mactan': 'Mactan Cebu',
    'Negros': 'Dumaguete Negros',
    'Panay': 'Iloilo City',
    'Malacca': 'Jonker Street Malacca',
    'Kampot': 'Old Market Kampot',
    'Kep': 'Kep Beach',
    'Palawan': 'Puerto Princesa Palawan',
    'Bali': 'Kuta Bali',
    'Kuta Lombok': 'Kuta Lombok',
    'Panglao': 'Panglao Bohol',
    'Siargao': 'General Luna, Surigao del Norte',
    'Nha Trang': 'Biet Thu Nha Trang',
    'Koh Samui': 'Chaweng Koh Samui',
    'Phuket': 'Patong Phuket',
    'Langkawi': 'Pantai Cenang Langkawi',
    'George Town': 'George Town Penang',
}

def slug(s):
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')

def req_json(url, cache_name=None, timeout=30):
    cp = CACHE / cache_name if cache_name else None
    if cp and cp.exists():
        return json.loads(cp.read_text())
    r = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    if cp:
        cp.write_text(json.dumps(data))
    return data

def req_text(url, cache_name=None, timeout=30):
    cp = CACHE / cache_name if cache_name else None
    if cp and cp.exists():
        return cp.read_text()
    r = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        txt = resp.read().decode('utf-8', 'ignore')
    if cp:
        cp.write_text(txt)
    return txt

def parse_cities():
    s = (ROOT / 'src' / 'data.ts').read_text()
    arr_start = s.find('export const cities')
    arr = s[s.find('= [', arr_start) + 2:]
    objs=[]; depth=0; start=None; in_str=None; esc=False
    for i,ch in enumerate(arr):
        if in_str:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==in_str: in_str=None
        else:
            if ch in "'\"`": in_str=ch
            elif ch=='{':
                if depth==0: start=i
                depth+=1
            elif ch=='}':
                depth-=1
                if depth==0 and start is not None: objs.append(arr[start:i+1])
            elif ch==']' and depth==0: break
    cities=[]
    for o in objs:
        def ss(prop):
            m=re.search(rf"{prop}: '([^']*)'", o)
            return m.group(1) if m else ''
        def nn(prop):
            m=re.search(rf"{prop}: ([0-9.]+)", o)
            return float(m.group(1)) if m else None
        cities.append({
            'city': ss('city'), 'country': ss('country'), 'district': ss('district'),
            'monthlyLocalCostUsd': nn('monthlyLocalCostUsd'), 'nightlifeDensity': nn('nightlifeDensity') or 0,
            'swimmability': nn('swimmability') or 0,
        })
    return cities

def hav(lat1, lon1, lat2, lon2):
    R=6371.0088
    p1=math.radians(lat1); p2=math.radians(lat2)
    dphi=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dphi/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

def percentile(vals, p):
    if not vals: return None
    vals=sorted(vals); k=(len(vals)-1)*p/100; f=math.floor(k); c=math.ceil(k)
    if f==c: return vals[int(k)]
    return vals[f]*(c-k)+vals[c]*(k-f)

def clamp(v, lo=0, hi=100): return max(lo, min(hi, v))
def norm_log(value, minv, maxv):
    return clamp((math.log1p(max(value,0))-math.log1p(minv))/(math.log1p(maxv)-math.log1p(minv)),0,1)

def geocode(city):
    q = f"{ALIASES.get(city['city'], city['city'].split('/')[0])}, {city['country']}"
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'format':'jsonv2','q':q,'limit':1})
    name=f"nominatim-{slug(city['country'])}-{slug(city['city'])}.json"
    data=req_json(url, name, timeout=20)
    if not data:
        q = f"{city['district']}, {city['country']}"
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'format':'jsonv2','q':q,'limit':1})
        data=req_json(url, name.replace('.json','-district.json'), timeout=20)
    if not data: raise RuntimeError(f"No geocode for {city['city']}")
    d=data[0]
    return {'lat': float(d['lat']), 'lon': float(d['lon']), 'displayName': d.get('display_name',''), 'sourceUrl': url}

def fetch_weather(city_id, lat, lon):
    daily='temperature_2m_max,temperature_2m_mean,apparent_temperature_max,precipitation_sum,wind_speed_10m_max'
    url='https://archive-api.open-meteo.com/v1/archive?' + urllib.parse.urlencode({'latitude':lat,'longitude':lon,'start_date':START,'end_date':END,'daily':daily,'timezone':'auto'})
    return req_json(url, f'weather-{city_id}.json', timeout=45), url

def fetch_marine(city_id, lat, lon):
    daily='wave_height_max,sea_surface_temperature_mean'
    url='https://marine-api.open-meteo.com/v1/marine?' + urllib.parse.urlencode({'latitude':lat,'longitude':lon,'start_date':START,'end_date':END,'daily':daily,'timezone':'auto'})
    try:
        return req_json(url, f'marine-{city_id}.json', timeout=45), url, None
    except Exception as e:
        return None, url, str(e)

def seasonality(city_id, lat, lon):
    weather, wurl = fetch_weather(city_id, lat, lon)
    marine, murl, merr = fetch_marine(city_id, lat, lon)
    daily=weather['daily']; dates=daily['time']
    buckets={m:{'tempmax':[],'tempmean':[],'apptemp':[],'precip':[],'wind':[]} for m in range(1,13)}
    for idx, ds in enumerate(dates):
        m=int(ds[5:7]); b=buckets[m]
        for key, arrkey in [('tempmax','temperature_2m_max'),('tempmean','temperature_2m_mean'),('apptemp','apparent_temperature_max'),('precip','precipitation_sum'),('wind','wind_speed_10m_max')]:
            v=daily.get(arrkey,[None]*len(dates))[idx]
            if v is not None: b[key].append(float(v))
    mb={m:{'wave':[],'sst':[]} for m in range(1,13)}
    marine_status='unavailable'
    if marine and marine.get('daily'):
        md=marine['daily']; marine_status='available'
        for idx, ds in enumerate(md.get('time',[])):
            m=int(ds[5:7])
            w=md.get('wave_height_max',[None]*len(md.get('time',[])))[idx]
            t=md.get('sea_surface_temperature_mean',[None]*len(md.get('time',[])))[idx]
            if w is not None: mb[m]['wave'].append(float(w))
            if t is not None: mb[m]['sst'].append(float(t))
    monthly=[]
    for m in range(1,13):
        b=buckets[m]; days=max(1,len(b['precip']))
        rainy=sum(1 for v in b['precip'] if v>=1)/days*100
        heavy=sum(1 for v in b['precip'] if v>=10)/days*100
        avg_app=statistics.mean(b['apptemp']) if b['apptemp'] else statistics.mean(b['tempmax'])
        heat=min(28,max(0,avg_app-31)*4)
        rain=rainy*0.35
        heavy_p=heavy*0.8
        windp=min(18,max(0,(percentile(b['wind'],90) or 0)-28)*1.2)
        weather_score=round(clamp(100-heat-rain-heavy_p-windp))
        wave_vals=mb[m]['wave']; sst_vals=mb[m]['sst']
        beach_score=None; wave_p90=None; wave_mean=None; high_wave=None; sst=None
        if wave_vals:
            wave_mean=round(statistics.mean(wave_vals),2); wave_p90=round(percentile(wave_vals,90),2)
            high_wave=sum(1 for v in wave_vals if v>=1.25)/len(wave_vals)*100
            rough=sum(1 for v in wave_vals if v>=2.0)/len(wave_vals)*100
            sst=round(statistics.mean(sst_vals),1) if sst_vals else None
            cool=min(25,max(0,26-(sst or 26))*5)
            beach_score=round(clamp(100-high_wave*0.6-rough*1.2-cool))
        vacation=round(clamp(weather_score*0.65+(beach_score if beach_score is not None else weather_score)*0.35))
        monthly.append({'month':m,'label':MONTH_NAMES[m-1],'weatherComfortScore':weather_score,'beachReliabilityScore':beach_score,'vacationReliabilityScore':vacation,'avgTempMaxC':round(statistics.mean(b['tempmax']),1),'avgTempMeanC':round(statistics.mean(b['tempmean']),1),'avgApparentTempMaxC':round(avg_app,1),'precipSumMm':round(statistics.mean([sum(b['precip'][i:i+31]) for i in range(0,len(b['precip']),31)]) if b['precip'] else 0,1),'rainyDaysPct':round(rainy),'heavyRainDaysPct':round(heavy),'windMaxP90Kmh':round(percentile(b['wind'],90) or 0,1),'waveHeightMaxMeanM':wave_mean,'waveHeightMaxP90M':wave_p90,'highWaveDaysPct':round(high_wave) if high_wave is not None else None,'seaSurfaceTempMeanC':sst,'marineDataStatus':'available' if wave_vals else 'unavailable'})
    best=[x['label'] for x in monthly if x['vacationReliabilityScore']>=75]
    shoulder=[x['label'] for x in monthly if 60<=x['vacationReliabilityScore']<75]
    avoid=[x['label'] for x in monthly if x['vacationReliabilityScore']<60]
    return {'bestMonths':best,'shoulderMonths':shoulder,'avoidMonths':avoid,'monthly':monthly,'generatedAt':TODAY,'years':[2021,2025],'weatherSourceUrl':wurl,'marineSourceUrl':murl,'method':'Open-Meteo historical daily weather plus marine daily wave-height max/sea-surface temperature; deterministic proxy scoring.'}

def load_airports():
    txt=req_text('https://davidmegginson.github.io/ourairports-data/airports.csv','ourairports-airports.csv',timeout=60)
    rows=[]
    for r in csv.DictReader(txt.splitlines()):
        if not r.get('iata_code'): continue
        if r.get('type') not in {'large_airport','medium_airport','small_airport'}: continue
        if r.get('scheduled_service')!='yes': continue
        try: lat=float(r['latitude_deg']); lon=float(r['longitude_deg'])
        except: continue
        rows.append({'iata':r['iata_code'],'icao':r.get('icao_code') or r.get('ident'),'name':r['name'],'type':r['type'],'lat':lat,'lon':lon,'countryCode':r['iso_country'],'municipality':r.get('municipality',''),'scheduledService':r.get('scheduled_service')=='yes'})
    return rows

def nearest_airport(lat, lon, country, airports):
    cc=COUNTRY_CODES.get(country)
    candidates=[a for a in airports if a['countryCode']==cc] or airports
    best=min(candidates, key=lambda a: hav(lat,lon,a['lat'],a['lon']))
    dist=round(hav(lat,lon,best['lat'],best['lon']))
    score=round(clamp((dist/250)*100))
    return {**best,'distanceKm':dist,'airportDistanceScore':score,'sourceUrl':'https://ourairports.com/data/'}

def overpass(city_id, lat, lon):
    def run_query(radius):
        query=f'''[out:json][timeout:45];(
node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|nightclub|pharmacy|bus_station|ferry_terminal|marketplace)$"](around:{radius},{lat},{lon});
way["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|nightclub|pharmacy|bus_station|ferry_terminal|marketplace)$"](around:{radius},{lat},{lon});
node["tourism"~"^(hotel|guest_house|hostel|apartment|chalet|resort|motel)$"](around:{radius},{lat},{lon});
way["tourism"~"^(hotel|guest_house|hostel|apartment|chalet|resort|motel)$"](around:{radius},{lat},{lon});
node["shop"~"^(convenience|mall)$"](around:{radius},{lat},{lon});
way["shop"~"^(convenience|mall)$"](around:{radius},{lat},{lon});
way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](around:{radius},{lat},{lon});
node["railway"="station"](around:{radius},{lat},{lon});
way["railway"="station"](around:{radius},{lat},{lon});
node["public_transport"="station"](around:{radius},{lat},{lon});
way["public_transport"="station"](around:{radius},{lat},{lon});
);out center geom tags;'''
        url='https://overpass-api.de/api/interpreter'
        cache=CACHE/f'overpass-{city_id}-{radius}.json'
        if cache.exists():
            return json.loads(cache.read_text())
        body=urllib.parse.urlencode({'data':query}).encode()
        req=urllib.request.Request(url, data=body, headers={**HEADERS,'Content-Type':'application/x-www-form-urlencoded'})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp: data=json.loads(resp.read().decode())
        except Exception as e:
            data={'elements':[], 'error':str(e)}
        cache.write_text(json.dumps(data))
        return data

    chosen_radius=1500
    data=None
    for candidate_radius in [1500, 3000, 5000, 10000]:
        chosen_radius=candidate_radius
        data=run_query(candidate_radius)
        quick_counts={'food':0,'accom':0,'bars':0}
        for el in data.get('elements',[]):
            tags=el.get('tags',{})
            if tags.get('amenity') in {'restaurant','cafe','fast_food','food_court'}: quick_counts['food']+=1
            if tags.get('amenity') in {'bar','pub','nightclub'}: quick_counts['bars']+=1
            if tags.get('tourism') in {'hotel','guest_house','hostel','apartment','chalet','resort','motel'}: quick_counts['accom']+=1
        if quick_counts['food'] + quick_counts['accom'] + quick_counts['bars'] > 0 or candidate_radius == 10000:
            break

    radius=chosen_radius
    counts={k:0 for k in ['restaurant','cafe','fast_food','food_court','bar','pub','nightclub','pharmacy','bus_station','ferry_terminal','marketplace','hotel','guest_house','hostel','apartment','chalet','resort','motel','convenience','mall','railway_station','public_transport_station']}
    road_nodes=0
    seen=set()
    for el in data.get('elements',[]):
        key=f"{el.get('type')}:{el.get('id')}"
        if key in seen: continue
        seen.add(key)
        tags=el.get('tags',{})
        if tags.get('amenity') in counts: counts[tags['amenity']]+=1
        if tags.get('tourism') in counts: counts[tags['tourism']]+=1
        if tags.get('shop') in counts: counts[tags['shop']]+=1
        if tags.get('railway')=='station': counts['railway_station']+=1
        if tags.get('public_transport')=='station': counts['public_transport_station']+=1
        if tags.get('highway') in {'motorway','trunk','primary','secondary','tertiary'}: road_nodes += len(el.get('geometry',[])) or 1
    area=math.pi*(radius/1000)**2
    food=counts['restaurant']+counts['cafe']+counts['fast_food']+counts['food_court']
    bars=counts['bar']+counts['pub']+counts['nightclub']
    accom=sum(counts[k] for k in ['hotel','guest_house','hostel','apartment','chalet','resort','motel'])
    useful=counts['convenience']+counts['pharmacy']
    food_density=food/area; bar_density=bars/area; accom_density=accom/area
    food_score=round(100*(0.7*norm_log(food_density,5,150)+0.2*norm_log(food,10,250)+0.1*norm_log(useful/area,1,30)))
    nightlife_score=round(100*(0.75*norm_log(bar_density,0.5,60)+0.25*norm_log(bars,2,100)))
    accom_score=round(100*(0.7*norm_log(accom_density,1,80)+0.3*norm_log(accom,3,150)))
    traffic=round(100*norm_log(road_nodes/area,1,80))
    transit=counts['bus_station']+counts['ferry_terminal']+counts['railway_station']+counts['public_transport_station']
    crowd=round(100*(0.5*norm_log((counts['marketplace']+counts['mall'])/area,0,10)+0.3*norm_log(food_density,5,150)+0.2*norm_log(transit/area,0,6)))
    noise=round(0.45*traffic+0.35*nightlife_score+0.2*crowd)
    confidence='medium' if radius <= 3000 and (food or accom or bars) else 'low'
    return {'radiusMeters':radius,'coreAreaKm2':round(area,2),'counts':counts,'foodCafeCount':food,'barPubClubCount':bars,'accommodationCount':accom,'foodCafeDensityPerKm2':round(food_density,1),'barPubClubDensityPerKm2':round(bar_density,1),'accommodationDensityPerKm2':round(accom_density,1),'foodCafeSupplyScore':food_score,'nightlifePoiScore':nightlife_score,'accommodationSupplyScore':accom_score,'noiseChaosScore':noise,'quietnessScore':100-noise,'trafficChaosScore':traffic,'crowdingProxyScore':crowd,'overpassQueriedAt':TODAY,'osmSourceUrl':'https://overpass-api.de/api/interpreter','confidence':confidence,'notes':f'OSM Overpass POI and road-density proxy around generated vacation core using {radius}m radius; depends on OSM completeness and generated coordinate quality.'}

def wikidata(city_id, lat, lon):
    # Minimal source-backed day-trip depth: use nearby Wikidata geosearch via wbsearchentities is not geospatial; SPARQL may 403. Use OSM tourism/nature proxy if SPARQL fails.
    return {'dayTripScore': None, 'nearestMajorAttractionName': None, 'wikidataAttractionsWithin50Km': None, 'sourceUrl':'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples','notes':'Wikidata SPARQL day-trip count requires manual/endpoint availability review; OSM tourism/nature POI proxy shown separately.'}

def parse_us_advisories():
    url='https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/'
    try:
        html=req_text(url,'us-state-travel-advisories.html',timeout=30)
        out={}
        for country in COUNTRY_CODES:
            i=html.lower().find(country.lower())
            chunk=html[i:i+1000] if i>=0 else ''
            m=re.search(r'Level\s*(\d):\s*([^<]+)', chunk)
            if m: out[country]=(int(m.group(1)), m.group(2).strip())
        return out, url
    except Exception:
        return FALLBACK_US_ADVISORY, url

def ts(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)

cities=parse_cities(); airports=load_airports(); us_adv, us_url=parse_us_advisories()
records=[]; failures=[]
for idx, city in enumerate(cities,1):
    cid=slug(f"{city['country']}-{city['city']}-{city['district']}")[:90]
    print(idx, len(cities), city['city'])
    try:
        geo=geocode(city)
        lat=geo['lat']; lon=geo['lon']
        seas=seasonality(cid, lat, lon)
        airport=nearest_airport(lat, lon, city['country'], airports)
        osm=overpass(cid, lat, lon)
        level,label=us_adv.get(city['country'], FALLBACK_US_ADVISORY.get(city['country'], (None,'Unknown')))
        safety_score = None if level is None else {1:5,2:25,3:60,4:95}.get(level)
        monthly_cost=city.get('monthlyLocalCostUsd')
        cost_score=round(clamp(100 - ((monthly_cost or 1200)-500)/1500*100)) if monthly_cost else None
        accom_value=round((cost_score or 50)*0.65 + osm['accommodationSupplyScore']*0.35) if cost_score is not None else osm['accommodationSupplyScore']
        records.append({'key':f"{city['country']}::{city['city']}::{city['district']}", 'city':city['city'], 'country':city['country'], 'district':city['district'], 'coordinate':{'lat':round(lat,5),'lon':round(lon,5),'label':geo['displayName'],'sourceUrl':geo['sourceUrl'],'sourceType':'OpenStreetMap Nominatim generated coordinate; representative core requires review for broad island rows.'}, 'seasonality':seas, 'arrival':{'nearestAirport':airport['iata'], 'nearestAirportName':airport['name'], 'airportDistanceKm':airport['distanceKm'], 'airportDistanceScore':airport['airportDistanceScore'], 'arrivalFrictionScore':round(clamp(airport['airportDistanceScore']*0.75+(safety_score if safety_score is not None else 35)*0.25)), 'transferMinutes':None, 'transferTimeStatus':'unknown-route-source-required', 'safetyAdvisory':{'source':'US State Dept', 'level':level, 'label':label, 'safetyHassleScore':safety_score, 'sourceUrl':us_url}, 'visa':{'status':'unknown-passport-specific', 'note':'Passport-specific entry rules are linked for manual review; no universal visa claim generated.', 'gbSourceUrl':f"https://www.gov.uk/foreign-travel-advice/{COUNTRY_SLUGS.get(city['country'], slug(city['country']))}/entry-requirements"}}, 'osmPoiMetrics':osm, 'accommodation':{'monthlyCostProxyUsd':monthly_cost, 'monthlyCostSource':'existing dashboard sourced cost estimate', 'accommodationSupplyScore':osm['accommodationSupplyScore'], 'accommodationValueProxyScore':accom_value, 'hotelNightlyRangeUsd':None, 'notes':'Accommodation value uses existing monthly cost proxy plus OSM accommodation supply. Hotel nightly prices require manual sampled booking data and are intentionally unknown.'}, 'noiseChaosMetrics':{'noiseChaosScore':osm['noiseChaosScore'],'quietnessScore':osm['quietnessScore'],'trafficChaosScore':osm['trafficChaosScore'],'nightlifeNoiseScore':osm['nightlifePoiScore'],'crowdingProxyScore':osm['crowdingProxyScore'],'notes':'OSM proxy only; not measured decibels.'}, 'dayTripMetrics':{'dayTripScore':round(clamp(0.55*norm_log(osm['counts'].get('resort',0)+osm['counts'].get('marketplace',0)+osm['counts'].get('mall',0)+osm['foodCafeCount'],5,250)*100 + 0.45*osm['foodCafeSupplyScore'])), 'wikidataStatus':'pending-endpoint-review', 'unescoStatus':'not-generated', 'notes':'First-pass day-trip depth proxy uses OSM useful/tourism density. Wikidata/UNESCO counts require endpoint/manual false-positive review before claiming named attractions.', 'sourceUrl':'https://wiki.openstreetmap.org/wiki/Key:tourism'}})
        time.sleep(1.0)
    except Exception as e:
        failures.append((city['city'], str(e)))
        print('FAILED', city['city'], e)

if failures:
    print('Failures:', failures)

out = "import type { Confidence } from './data';\n\n"
out += "export type VacationMonth = { month: number; label: string; weatherComfortScore: number; beachReliabilityScore: number | null; vacationReliabilityScore: number; avgTempMaxC: number; avgTempMeanC: number; avgApparentTempMaxC: number; precipSumMm: number; rainyDaysPct: number; heavyRainDaysPct: number; windMaxP90Kmh: number; waveHeightMaxMeanM: number | null; waveHeightMaxP90M: number | null; highWaveDaysPct: number | null; seaSurfaceTempMeanC: number | null; marineDataStatus: 'available' | 'unavailable'; };\n"
out += "export type VacationRecord = { key: string; city: string; country: string; district: string; coordinate: { lat: number; lon: number; label: string; sourceUrl: string; sourceType: string }; seasonality: { bestMonths: string[]; shoulderMonths: string[]; avoidMonths: string[]; monthly: VacationMonth[]; generatedAt: string; years: number[]; weatherSourceUrl: string; marineSourceUrl: string; method: string }; arrival: any; osmPoiMetrics: any; accommodation: any; noiseChaosMetrics: any; dayTripMetrics: any; confidence?: Confidence; };\n\n"
out += "export const vacationData = " + ts(records).replace(': null', ': null') + " satisfies VacationRecord[];\n\n"
out += "export const vacationDataByKey = Object.fromEntries(vacationData.map((record) => [record.key, record])) as Record<string, VacationRecord>;\n"
OUT.write_text(out)
print('wrote', OUT, 'records', len(records), 'failures', len(failures))
