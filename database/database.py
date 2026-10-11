"""Thread-safe SQLite database manager and connection lifecycle handler."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Sequence

from config.logging_config import get_logger
from config.settings import DATABASE_PATH
from database.migrations import apply_migrations
from utils.exceptions import DatabaseError

logger = get_logger("database.manager")


class DatabaseManager:
    """Manages SQLite database connections, transactions, and schema setup."""

    def __init__(self, db_path: str = DATABASE_PATH) -> None:
        self.db_path = db_path
        self._ensure_directory_exists()

    def _ensure_directory_exists(self) -> None:
        """Ensure the parent directory for the database file exists."""
        p = Path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        """Open a new SQLite connection with foreign keys and row factory enabled."""
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=20.0,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA journal_mode = WAL;")
            return conn
        except sqlite3.Error as err:
            logger.error("Failed to connect to database at '%s': %s", self.db_path, err)
            raise DatabaseError(f"Could not connect to database: {err}") from err

    def initialize(self) -> None:
        """Verify and initialize database tables and indexes."""
        logger.info("Initializing database at '%s'", self.db_path)
        try:
            with self.get_connection() as conn:
                apply_migrations(conn)
            logger.info("Database initialized successfully.")
        except Exception as err:
            logger.error("Database initialization failed: %s", err)
            raise DatabaseError(f"Database initialization failed: {err}") from err

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager for acquiring and closing a database connection."""
        conn = self.connect()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager providing transactional commit and rollback semantics."""
        conn = self.connect()
        try:
            conn.execute("BEGIN TRANSACTION;")
            yield conn
            conn.commit()
        except Exception as err:
            conn.rollback()
            logger.error("Transaction rolled back due to error: %s", err)
            raise
        finally:
            conn.close()

    def execute(self, query: str, params: Sequence[Any] = ()) -> int:
        """Execute a write/mutation statement and return the last row id."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.lastrowid or 0
        except sqlite3.Error as err:
            logger.error("SQL execute error: %s | Query: %s", err, query)
            raise DatabaseError(f"Database operation failed: {err}") from err

    def executemany(self, query: str, params_list: Sequence[Sequence[Any]]) -> int:
        """Execute multiple parameterized mutation statements in batch."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany(query, params_list)
                conn.commit()
                return cursor.rowcount
        except sqlite3.Error as err:
            logger.error("SQL executemany error: %s | Query: %s", err, query)
            raise DatabaseError(f"Database batch operation failed: {err}") from err

    def fetch_one(self, query: str, params: Sequence[Any] = ()) -> sqlite3.Row | None:
        """Execute a query and fetch a single matching row."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                return cursor.fetchone()
        except sqlite3.Error as err:
            logger.error("SQL fetch_one error: %s | Query: %s", err, query)
            raise DatabaseError(f"Database query failed: {err}") from err

    def fetch_all(self, query: str, params: Sequence[Any] = ()) -> list[sqlite3.Row]:
        """Execute a query and fetch all matching rows."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                return cursor.fetchall()
        except sqlite3.Error as err:
            logger.error("SQL fetch_all error: %s | Query: %s", err, query)
            raise DatabaseError(f"Database query failed: {err}") from err
