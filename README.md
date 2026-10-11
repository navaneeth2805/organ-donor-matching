# Organ Donor Matching Network (Graph Algorithms Platform)

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Streamlit](https://img.shields.io/badge/UI-Streamlit-FF4B4B.svg)](https://streamlit.io/)
[![Database](https://img.shields.io/badge/Database-SQLite3%20(WAL)-lightgrey.svg)](https://sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-pytest%20(25%20passed)-success.svg)](https://pytest.org/)

## Overview

The **Organ Donor Matching Network** is an advanced decision-support and graph algorithms platform designed to solve organ allocation, paired-exchange discovery, and transplant logistics. Originating as an **Advanced Graph Algorithms academic project**, the platform models donors and recipients as bipartite networks to compute optimal matchings (e.g., maximum cardinality bipartite matching, weighted compatibility graphs, and cycle-exchange detection).

**Phase 1 — Core Foundation & Professional UI** establishes the clinical data foundation, repository architecture, domain validation rules, relational SQLite database, interactive Streamlit medical dashboard, and audit logging engine.

---

## Phase 1 Implemented Features

1. **Architecture & Design Patterns**:
   - Clean multi-tier architecture separating Streamlit UI, Service/Domain layer, Repository access layer, and SQLite database.
   - Strict Object-Oriented Programming (OOP) with typed Python `@dataclass` models (`Donor`, `Recipient`, `Hospital`, `AuditLog`).
   - Repository pattern preventing raw SQL string interpolation in UI components.
   - Defensive validation and exception hierarchy (`DuplicateRecordError`, `ValidationError`, `RecordNotFoundError`, `DatabaseError`).

2. **Healthcare Data Management (CRUD)**:
   - **Donor Management**: Add, update, view, search, filter, and delete registered organ donors. Availability states (`Available`, `Pending`, `Unavailable`).
   - **Recipient Waitlist**: Add, update, view, search, filter, and delete recipients. Urgency levels (`Critical`, `High`, `Medium`, `Low`) and waiting duration tracking.
   - **Hospital Network**: Partner facilities and transplant centers directory with active/inactive toggling.

3. **High-Performance Search, Filter & Sort**:
   - Case-insensitive search across IDs, names, cities, and affiliated hospitals.
   - Multi-parameter filtering (blood group, organ, availability/urgency, age range, date ranges).
   - Database-level sorting and pagination options.

4. **Analytics & Visualization Dashboard**:
   - Metric overview cards for live network status (Total Donors, Recipients, Hospitals, Available Donors, Critical Waitlist).
   - Horizontal and vertical distribution charts: Donors by Organ, Recipients by Organ Needed, Blood Group Distributions (ABO/Rh).
   - Recipient Urgency Breakdown and Donor Availability donut chart.
   - Daily registration activity timelines.
   - Real-time recent activity feeds.

5. **Data Export & Audit Trails**:
   - Sanitized CSV export for donors, recipients, hospitals, and analytics summaries using Pandas.
   - Immutable audit logging tracking all creations, modifications, deactivations, and deletions with timestamps.

6. **Synthetic Demo Data**:
   - Controlled demo dataset generation in the Settings panel for demonstration and algorithm benchmarking without exposing real patient identifiers.

---

## Technology Stack

- **Language:** Python 3.11+ / 3.12+
- **User Interface:** Streamlit (Custom Medical UI Design System)
- **Database Engine:** SQLite3 (WAL mode, Foreign Keys enabled)
- **Data Analysis & Processing:** Pandas, NumPy
- **Graph & Network Foundations (Phase 3/4 ready):** NetworkX, PyVis
- **Visualization:** Matplotlib, Streamlit Charting
- **Testing:** Pytest (Unit, Service, Repository, Database, Validation suites)

---

## Installation & Setup

### 1. Clone & Set Up Virtual Environment

```bash
# Clone the repository
git clone <repository-url>
cd OrganMatchingNetwork

# Create Python virtual environment
python3 -m venv .venv

# Activate environment
# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Launch Application

```bash
streamlit run app.py
```

The application will automatically initialize the database at `data/organ_matching.db` on launch.

---

## Project Structure

```text
OrganMatchingNetwork/
├── app.py                      # Main Streamlit application and router
├── requirements.txt            # Python dependencies
├── pytest.ini                  # Pytest test discovery configuration
├── README.md                   # Comprehensive system documentation
├── .gitignore                  # Git ignore rules
│
├── config/
│   ├── __init__.py
│   ├── settings.py             # Central application constants and clinical limits
│   └── logging_config.py       # Namespaced logging configuration
│
├── database/
│   ├── __init__.py
│   ├── database.py             # DatabaseManager with context managers & transactions
│   ├── models.py               # Dataclass models: Donor, Recipient, Hospital, AuditLog
│   ├── repositories.py         # Repository pattern classes for data access
│   └── migrations.py           # DDL table creation and index migrations
│
├── modules/
│   ├── __init__.py
│   ├── donor.py                # DonorService (business logic, validation, audit logs)
│   ├── recipient.py            # RecipientService (waitlist triage, validation, audit logs)
│   ├── hospital.py             # HospitalService (facility directory & status management)
│   └── analytics.py            # AnalyticsService (aggregation & distribution series)
│
├── algorithms/                 # Graph algorithm engine placeholder for Phase 3/4
│   └── __init__.py
│
├── visualization/
│   ├── __init__.py
│   └── dashboard_components.py # Matplotlib visual chart components
│
├── ui/
│   ├── __init__.py
│   ├── components.py           # Reusable UI component library and CSS design system
│   ├── dashboard.py            # Operations overview dashboard
│   ├── donor_page.py           # Donor registry view, registration, search & filters
│   ├── recipient_page.py       # Recipient waitlist view, urgency triage & filters
│   └── hospital_page.py        # Hospital and transplant centers directory
│
├── utils/
│   ├── __init__.py
│   ├── constants.py            # Semantic UI colors, status badge mappings
│   ├── validators.py           # Clinical parameter and input validation utilities
│   ├── helpers.py              # Formatting, pagination, and date helpers
│   ├── export.py               # CSV export generators using Pandas
│   └── exceptions.py           # Domain exception hierarchy
│
├── tests/
│   ├── __init__.py
│   ├── test_database.py        # Database init, transaction, and FK constraint tests
│   ├── test_donor.py           # Donor CRUD, search, filter, and audit tests
│   ├── test_recipient.py       # Recipient CRUD, urgency, and waitlist tests
│   ├── test_hospital.py        # Hospital facility and unique constraint tests
│   └── test_validation.py     # Input boundary, age, email, and blood group tests
│
├── data/
│   └── .gitkeep                # Directory for SQLite database file
└── assets/
    └── .gitkeep                # Directory for static assets
```

---

## Database Schema

The database is built on SQLite with `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`:

1. **`hospitals`**:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `name` (TEXT NOT NULL UNIQUE)
   - `city` (TEXT NOT NULL)
   - `state` (TEXT NOT NULL)
   - `country` (TEXT NOT NULL DEFAULT 'India')
   - `phone` (TEXT), `email` (TEXT)
   - `active` (INTEGER NOT NULL DEFAULT 1)
   - `created_at`, `updated_at` (TEXT NOT NULL)

2. **`donors`**:
   - `id` (INTEGER PRIMARY KEY)
   - `name` (TEXT NOT NULL), `age` (INTEGER NOT NULL)
   - `blood_group` (TEXT NOT NULL), `organ` (TEXT NOT NULL)
   - `hospital_id` (INTEGER REFERENCES hospitals(id))
   - `location` (TEXT NOT NULL), `availability` (TEXT NOT NULL)
   - `phone` (TEXT), `email` (TEXT), `registration_date` (TEXT NOT NULL)
   - `created_at`, `updated_at` (TEXT NOT NULL)

3. **`recipients`**:
   - `id` (INTEGER PRIMARY KEY)
   - `name` (TEXT NOT NULL), `age` (INTEGER NOT NULL)
   - `blood_group` (TEXT NOT NULL), `organ_needed` (TEXT NOT NULL)
   - `hospital_id` (INTEGER REFERENCES hospitals(id))
   - `location` (TEXT NOT NULL), `urgency` (TEXT NOT NULL)
   - `waiting_time_days` (INTEGER NOT NULL DEFAULT 0)
   - `phone` (TEXT), `email` (TEXT), `registration_date` (TEXT NOT NULL)
   - `created_at`, `updated_at` (TEXT NOT NULL)

4. **`audit_logs`**:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `entity_type` (TEXT NOT NULL), `entity_id` (INTEGER)
   - `action` (TEXT NOT NULL), `details` (TEXT), `created_at` (TEXT NOT NULL)

5. **Indexes**:
   - `idx_donor_blood_group`, `idx_donor_organ`, `idx_donor_hospital`, `idx_donor_availability`
   - `idx_recipient_blood_group`, `idx_recipient_organ`, `idx_recipient_hospital`, `idx_recipient_urgency`

---

## Validation Rules

- **Name:** Mandatory, non-empty, 2–100 characters, whitespace stripped.
- **Age:** Numeric integer between 0 and 120.
- **Blood Groups:** Strictly validated against `O-`, `O+`, `A-`, `A+`, `B-`, `B+`, `AB-`, `AB+`.
- **Organs:** Supported types include `Kidney`, `Heart`, `Liver`, `Lung`, `Pancreas`, `Cornea`, `Bone Marrow`.
- **Availability:** Validated to `Available`, `Pending`, `Unavailable`.
- **Urgency Levels:** Validated to `Low`, `Medium`, `High`, `Critical`.
- **Waiting Time:** Non-negative integer.
- **Integrity Enforcement:** Primary key and unique conflicts are caught and converted into user-friendly messages (e.g. `Donor ID 101 already exists. Please use another ID.`).

---

## Automated Testing

Run the full pytest suite with:

```bash
pytest
```

Current test suite contains 25 comprehensive tests:
- **`tests/test_database.py`**: Initialization, schema creation, transaction commit, rollback on error, foreign key enforcement.
- **`tests/test_donor.py`**: Donor registration, retrieval, duplicate ID protection, updates, deletions, searches, filters, audit logs.
- **`tests/test_recipient.py`**: Recipient registration, urgency tracking, duplicate ID prevention, updates, search, filters, audit logs.
- **`tests/test_hospital.py`**: Hospital registration, uniqueness checks, deactivation, search.
- **`tests/test_validation.py`**: Rigorous checks for ages, blood groups, organs, emails, phone numbers, and waiting times.

All tests utilize isolated, temporary databases that are cleaned up automatically after test execution.

---

## Loading Demo Data

To load a realistic test dataset:
1. Open the application sidebar and navigate to **⚙️ Settings**.
2. Click **🧪 Load Demo Dataset**.
3. Realistic synthetic hospitals, donors, and recipients will be created with audit logs.
4. Navigate to **📊 Dashboard** or registry pages to explore the charts and tables.

---

## Future Phases Roadmap

- **Phase 2 — Medical Profile Engine**: Vital signs, BP, ECG, Blood Glucose, HbA1c, Lab Data, HLA typing, panel reactive antibodies (PRA), crossmatching.
- **Phase 3 — Compatibility Engine**: Clinical rule engine, hard immunological constraints, candidate scoring & explainability.
- **Phase 4 — Graph Algorithms**: NetworkX bipartite graph construction, maximum cardinality matching (Hopcroft-Karp), minimum-cost maximum-flow (Edmonds-Karp), cycle detection for kidney paired donations (KPD).
- **Phase 5 — Advanced Analytics & Simulation**: Interactive PyVis graph visualization, Monte Carlo waitlist simulations, geographical transport time optimizations.
- **Phase 6 — Clinical Review & Security**: Role-based access control (RBAC), multi-factor authentication, HIPAA-aligned audit trails, notification alerts.

---

## Disclaimer

This Phase 1 software is an academic and engineering prototype designed for research, algorithm development, and decision-support modeling. It is **not** a certified medical device and must not be used as the sole basis for clinical decisions or organ allocation in real-world patient care without proper regulatory certification.
