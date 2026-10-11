"""Database schema definitions, table creation, and index migrations."""

import sqlite3
from config.logging_config import get_logger

logger = get_logger("database.migrations")

# Schema Version Management
SCHEMA_VERSION_TABLE = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
"""

# Phase 1 Schema Definitions
PHASE_1_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'India',
        phone TEXT,
        email TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS donors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        blood_group TEXT NOT NULL,
        organ TEXT NOT NULL,
        hospital_id INTEGER,
        location TEXT NOT NULL,
        availability TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        registration_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        blood_group TEXT NOT NULL,
        organ_needed TEXT NOT NULL,
        hospital_id INTEGER,
        location TEXT NOT NULL,
        urgency TEXT NOT NULL,
        waiting_time_days INTEGER NOT NULL DEFAULT 0,
        phone TEXT,
        email TEXT,
        registration_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    );
    """,
]

PHASE_1_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_donor_blood_group ON donors(blood_group);",
    "CREATE INDEX IF NOT EXISTS idx_donor_organ ON donors(organ);",
    "CREATE INDEX IF NOT EXISTS idx_donor_hospital ON donors(hospital_id);",
    "CREATE INDEX IF NOT EXISTS idx_donor_availability ON donors(availability);",
    "CREATE INDEX IF NOT EXISTS idx_recipient_blood_group ON recipients(blood_group);",
    "CREATE INDEX IF NOT EXISTS idx_recipient_organ ON recipients(organ_needed);",
    "CREATE INDEX IF NOT EXISTS idx_recipient_hospital ON recipients(hospital_id);",
    "CREATE INDEX IF NOT EXISTS idx_recipient_urgency ON recipients(urgency);",
]

# Phase 2 Schema Definitions: Medical Intelligence & Health Profiles
PHASE_2_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS medical_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        assessment_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS vital_signs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        systolic_bp REAL,
        diastolic_bp REAL,
        heart_rate REAL,
        respiratory_rate REAL,
        temperature REAL,
        spo2 REAL,
        height_cm REAL,
        weight_kg REAL,
        bmi REAL,
        recorded_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS laboratory_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        blood_glucose REAL,
        hba1c REAL,
        hemoglobin REAL,
        wbc REAL,
        platelets REAL,
        creatinine REAL,
        egfr REAL,
        bun REAL,
        sodium REAL,
        potassium REAL,
        calcium REAL,
        ast REAL,
        alt REAL,
        bilirubin REAL,
        albumin REAL,
        inr REAL,
        test_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS cardiac_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        ecg_status TEXT,
        ecg_findings TEXT,
        heart_rate REAL,
        pr_interval REAL,
        qrs_duration REAL,
        qt_interval REAL,
        qtc REAL,
        echocardiogram_available INTEGER DEFAULT 0,
        ejection_fraction REAL,
        assessment_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS medical_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        diabetes INTEGER DEFAULT 0,
        hypertension INTEGER DEFAULT 0,
        heart_disease INTEGER DEFAULT 0,
        kidney_disease INTEGER DEFAULT 0,
        liver_disease INTEGER DEFAULT 0,
        lung_disease INTEGER DEFAULT 0,
        cancer_history INTEGER DEFAULT 0,
        infectious_disease_status TEXT,
        smoking_status TEXT,
        medication_history TEXT,
        previous_surgery TEXT,
        notes TEXT,
        assessment_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS hla_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        hla_a TEXT,
        hla_b TEXT,
        hla_c TEXT,
        hla_dr TEXT,
        hla_dq TEXT,
        antibody_information TEXT,
        test_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS crossmatch_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        result TEXT,
        antibody_information TEXT,
        test_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (donor_id) REFERENCES donors(id),
        FOREIGN KEY (recipient_id) REFERENCES recipients(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS organ_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        organ TEXT NOT NULL,
        assessment_status TEXT NOT NULL,
        assessment_notes TEXT,
        assessment_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (donor_id) REFERENCES donors(id)
    );
    """,
]

PHASE_2_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_medical_profile_entity ON medical_profiles(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_vital_signs_entity ON vital_signs(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_laboratory_entity ON laboratory_results(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_cardiac_entity ON cardiac_assessments(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_history_entity ON medical_history(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_hla_entity ON hla_profiles(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_crossmatch_donor ON crossmatch_results(donor_id);",
    "CREATE INDEX IF NOT EXISTS idx_crossmatch_recipient ON crossmatch_results(recipient_id);",
    "CREATE INDEX IF NOT EXISTS idx_organ_assessment_donor ON organ_assessments(donor_id);",
]

PHASE_3_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS compatibility_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        score REAL,
        blood_score REAL,
        organ_score REAL,
        clinical_score REAL,
        urgency_score REAL,
        waiting_time_score REAL,
        hla_score REAL,
        geographic_score REAL,
        data_quality_score REAL,
        hard_failures TEXT,
        warnings TEXT,
        explanations TEXT,
        rule_version TEXT NOT NULL,
        source_updated_at TEXT,
        evaluated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE
    );
    """
]

PHASE_3_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_compatibility_donor ON compatibility_results(donor_id);",
    "CREATE INDEX IF NOT EXISTS idx_compatibility_recipient ON compatibility_results(recipient_id);",
    "CREATE INDEX IF NOT EXISTS idx_compatibility_status ON compatibility_results(status);",
    "CREATE INDEX IF NOT EXISTS idx_compatibility_score ON compatibility_results(score);",
    "CREATE INDEX IF NOT EXISTS idx_compatibility_pair ON compatibility_results(donor_id, recipient_id);",
]

# Phase 4 Schema Definitions (Bipartite Graph & Matching Engine)
PHASE_4_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS matching_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        algorithm TEXT NOT NULL,
        graph_nodes INTEGER NOT NULL,
        graph_edges INTEGER NOT NULL,
        matched_pairs INTEGER NOT NULL,
        total_score REAL,
        average_score REAL,
        execution_time_ms REAL,
        rule_version TEXT,
        created_at TEXT NOT NULL
    );
    """,
]

PHASE_4_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_matching_runs_algorithm ON matching_runs(algorithm);",
    "CREATE INDEX IF NOT EXISTS idx_matching_runs_created_at ON matching_runs(created_at);",
]

# Legacy alias for backwards compatibility
SCHEMA_TABLES = PHASE_1_TABLES + PHASE_2_TABLES + PHASE_3_TABLES + PHASE_4_TABLES
SCHEMA_INDEXES = PHASE_1_INDEXES + PHASE_2_INDEXES + PHASE_3_INDEXES + PHASE_4_INDEXES



def get_schema_version(conn: sqlite3.Connection) -> int:
    """Retrieve the current database schema migration version."""
    cursor = conn.cursor()
    # Check if schema_version table exists
    cursor.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='schema_version';"
    )
    if cursor.fetchone()[0] == 0:
        return 0
    
    cursor.execute("SELECT version FROM schema_version ORDER BY ROWID DESC LIMIT 1;")
    row = cursor.fetchone()
    return int(row[0]) if row else 0


def set_schema_version(conn: sqlite3.Connection, version: int) -> None:
    """Update or record the database schema version."""
    cursor = conn.cursor()
    cursor.execute(SCHEMA_VERSION_TABLE)
    cursor.execute("DELETE FROM schema_version;")
    cursor.execute("INSERT INTO schema_version (version) VALUES (?);", (version,))
    conn.commit()


def run_migrations(conn: sqlite3.Connection) -> int:
    """Execute versioned schema migrations ensuring existing data preservation."""
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    current_version = get_schema_version(conn)
    logger.info("Current database schema version: %d", current_version)
    
    # Phase 1: Core Foundation (Tables + Indexes)
    if current_version < 1:
        logger.info("Applying Phase 1 migrations...")
        cursor.execute(SCHEMA_VERSION_TABLE)
        for table_sql in PHASE_1_TABLES:
            cursor.execute(table_sql)
        for index_sql in PHASE_1_INDEXES:
            cursor.execute(index_sql)
        set_schema_version(conn, 1)
        current_version = 1
        logger.info("Phase 1 migrations applied successfully.")

    # Phase 2: Medical Intelligence & Health Profiles
    if current_version < 2:
        logger.info("Applying Phase 2 migrations (Medical Intelligence & Health Profiles)...")
        for table_sql in PHASE_2_TABLES:
            cursor.execute(table_sql)
        for index_sql in PHASE_2_INDEXES:
            cursor.execute(index_sql)
        set_schema_version(conn, 2)
        current_version = 2
        logger.info("Phase 2 migrations applied successfully.")

    # Phase 3: Compatibility & Clinical Rule Engine
    if current_version < 3:
        logger.info("Applying Phase 3 migrations (Compatibility & Clinical Rule Engine)...")
        for table_sql in PHASE_3_TABLES:
            cursor.execute(table_sql)
        for index_sql in PHASE_3_INDEXES:
            cursor.execute(index_sql)
        set_schema_version(conn, 3)
        current_version = 3
        logger.info("Phase 3 migrations applied successfully.")

    # Phase 4: Graph Algorithms & Bipartite Matching Engine
    if current_version < 4:
        logger.info("Applying Phase 4 migrations (Graph Algorithms & Matching Engine)...")
        for table_sql in PHASE_4_TABLES:
            cursor.execute(table_sql)
        for index_sql in PHASE_4_INDEXES:
            cursor.execute(index_sql)
        set_schema_version(conn, 4)
        current_version = 4
        logger.info("Phase 4 migrations applied successfully.")
        
    conn.commit()
    return current_version


def apply_migrations(conn: sqlite3.Connection) -> None:
    """Execute migrations lifecycle handler."""
    logger.info("Verifying and applying database schema migrations...")
    run_migrations(conn)
    logger.info("Database schema migrations verified and up to date.")

