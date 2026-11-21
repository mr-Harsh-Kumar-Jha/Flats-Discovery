"""
Pipeline Configuration for Pune-Flats Discovery Engine
Configures target cities (Pune, Mumbai, Gurgaon, Noida), geographic bounding boxes,
Overpass API endpoints, employment hubs, transit query patterns, and real-estate valuation benchmarks.
"""

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "cache"
OUT_DIR = BASE_DIR / "out"
FRONTEND_DATA_DIR = BASE_DIR.parent / "frontend" / "public" / "data"

# Ensure directories exist
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)
FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Overpass API Mirror Endpoints (with automatic fallback)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Database Connection Settings (Docker container default)
DB_CONFIG = {
    "container": "puneflats-postgres",
    "user": "puneflats",
    "db": "puneflats",
    "port": 5432,
}

# City Definitions: Bounding Boxes (min_lat, min_lon, max_lat, max_lon)
CITIES = {
    "pune": {
        "id": "22a633a6-afdd-447c-b017-760cc0a9b1d2",
        "name": "Pune",
        "slug": "pune",
        "state": "Maharashtra",
        "country": "IN",
        "center": {"lat": 18.5204, "lng": 73.8567},
        "default_zoom": 12,
        # Bounding box covering Hinjewadi, Baner, Kothrud, Shivajinagar, Kharadi, Magarpatta, PCMC
        "bbox": [18.4200, 73.7000, 18.6600, 74.0200],
        "rera_prefix": "P521000",
        "employment_hubs": {
            "hinjewadi": {"name": "Hinjewadi IT Park (Phases 1-3)", "lat": 18.5913, "lng": 73.7389},
            "magarpatta": {"name": "Magarpatta Cybercity", "lat": 18.5158, "lng": 73.9272},
            "kharadi": {"name": "Kharadi EON IT Park", "lat": 18.5516, "lng": 73.9515},
            "baner": {"name": "Baner-Balewadi High Street", "lat": 18.5679, "lng": 73.7769},
            "shivajinagar": {"name": "Senapati Bapat Rd / Shivajinagar", "lat": 18.5314, "lng": 73.8296},
        },
        "metro_lines": {
            "PURPLE": {"name": "Purple Line (Line 1: PCMC - Swargate)", "color": "#7c3aed"},
            "AQUA": {"name": "Aqua Line (Line 2: Vanaz - Ramwadi)", "color": "#06b6d4"},
            "LINE3": {"name": "Line 3 (Hinjewadi - Shivajinagar)", "color": "#ec4899"},
        },
        "price_benchmarks": {
            "avg_rent_1bhk": 16000,
            "avg_rent_2bhk": 27000,
            "avg_rent_3bhk": 42000,
            "avg_price_per_sqft": 7800,
            "target_yield": 3.6,
        },
    },
    "mumbai": {
        "id": "11111111-2222-3333-4444-555555555555",
        "name": "Mumbai",
        "slug": "mumbai",
        "state": "Maharashtra",
        "country": "IN",
        "center": {"lat": 19.0760, "lng": 72.8777},
        "default_zoom": 11,
        # Bounding box covering South Mumbai, Bandra, Andheri, Powai, Borivali, Thane, Navi Mumbai
        "bbox": [18.8900, 72.7500, 19.2800, 73.0500],
        "rera_prefix": "P518000",
        "employment_hubs": {
            "bkc": {"name": "Bandra Kurla Complex (BKC)", "lat": 19.0657, "lng": 72.8687},
            "lower_parel": {"name": "Lower Parel / Worli Financial Dist", "lat": 18.9953, "lng": 72.8258},
            "andheri_east": {"name": "Andheri East / MIDC / SEEPZ", "lat": 19.1197, "lng": 72.8797},
            "powai": {"name": "Powai Hiranandani Tech Hub", "lat": 19.1197, "lng": 72.9051},
            "malad": {"name": "Malad Mindspace Corridor", "lat": 19.1860, "lng": 72.8362},
            "navi_mumbai": {"name": "Navi Mumbai Airoli Mindspace", "lat": 19.1551, "lng": 72.9986},
        },
        "metro_lines": {
            "LINE1": {"name": "Line 1 (Versova - Andheri - Ghatkopar)", "color": "#3b82f6"},
            "LINE2A": {"name": "Line 2A (Dahisar - DN Nagar)", "color": "#eab308"},
            "LINE7": {"name": "Line 7 (Dahisar E - Andheri E)", "color": "#ef4444"},
            "LINE3": {"name": "Line 3 Aqua (Colaba - BKC - SEEPZ)", "color": "#06b6d4"},
        },
        "price_benchmarks": {
            "avg_rent_1bhk": 34000,
            "avg_rent_2bhk": 58000,
            "avg_rent_3bhk": 92000,
            "avg_price_per_sqft": 21500,
            "target_yield": 2.9,
        },
    },
    "gurgaon": {
        "id": "d29a52ff-9821-40bc-9761-36ad9ea1580a",
        "name": "Gurgaon",
        "slug": "gurgaon",
        "state": "Haryana",
        "country": "IN",
        "center": {"lat": 28.4595, "lng": 77.0266},
        "default_zoom": 12,
        # Bounding box covering Cyber City, Golf Course Road, Sohna Road, Udyog Vihar, Manesar
        "bbox": [28.3600, 76.9200, 28.5300, 77.1400],
        "rera_prefix": "HRERA-GGM-",
        "employment_hubs": {
            "cyber_city": {"name": "DLF Cyber City / Cyber Hub", "lat": 28.4950, "lng": 77.0895},
            "golf_course_rd": {"name": "Golf Course Road (Horizon Centre)", "lat": 28.4732, "lng": 77.0987},
            "golf_course_ext": {"name": "Golf Course Extension Road", "lat": 28.4111, "lng": 77.0712},
            "udyog_vihar": {"name": "Udyog Vihar (Phases 1-5)", "lat": 28.5085, "lng": 77.0815},
            "sohna_road": {"name": "Sohna Road Commercial Tech Zone", "lat": 28.4239, "lng": 77.0392},
        },
        "metro_lines": {
            "YELLOW": {"name": "Yellow Line (DMRC Millennium City Centre)", "color": "#eab308"},
            "RAPID": {"name": "Rapid Metro Gurgaon", "color": "#3b82f6"},
        },
        "price_benchmarks": {
            "avg_rent_1bhk": 24000,
            "avg_rent_2bhk": 42000,
            "avg_rent_3bhk": 68000,
            "avg_price_per_sqft": 12200,
            "target_yield": 3.4,
        },
    },
    "noida": {
        "id": "9beb42ec-a567-42b5-bfc4-ed44066cd2a8",
        "name": "Noida",
        "slug": "noida",
        "state": "Uttar Pradesh",
        "country": "IN",
        "center": {"lat": 28.5355, "lng": 77.3910},
        "default_zoom": 12,
        # Bounding box covering Sector 18, Sector 62, Expressway corridor, Greater Noida entry
        "bbox": [28.4500, 77.2800, 28.6400, 77.4800],
        "rera_prefix": "UPRERAPRJ",
        "employment_hubs": {
            "sector_62": {"name": "Sector 62 / 63 IT & Tech Corridor", "lat": 28.6271, "lng": 77.3725},
            "sector_18": {"name": "Sector 18 Commercial Hub / Atta", "lat": 28.5708, "lng": 77.3261},
            "expressway_tech": {"name": "Noida Expressway Tech Zone (Sec 125-135)", "lat": 28.5135, "lng": 77.3758},
            "advant_navis": {"name": "Advant Navis / Sector 142 Tech Hub", "lat": 28.4975, "lng": 77.4172},
            "greater_noida_kp": {"name": "Greater Noida Knowledge Park", "lat": 28.4720, "lng": 77.5020},
        },
        "metro_lines": {
            "BLUE": {"name": "Blue Line (DMRC Noida Electronic City)", "color": "#3b82f6"},
            "MAGENTA": {"name": "Magenta Line (Botanical Garden)", "color": "#d946ef"},
            "AQUA_NMRC": {"name": "Aqua Line (NMRC Noida-Greater Noida)", "color": "#06b6d4"},
        },
        "price_benchmarks": {
            "avg_rent_1bhk": 16500,
            "avg_rent_2bhk": 28500,
            "avg_rent_3bhk": 45000,
            "avg_price_per_sqft": 7400,
            "target_yield": 3.7,
        },
    },
}
