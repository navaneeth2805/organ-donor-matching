"""Structured logging configuration for the Organ Donor Matching Network."""

import logging
import sys
from pathlib import Path
from config.settings import LOG_FILE, LOG_LEVEL


def setup_logging() -> None:
    """Initialize application-wide logging handlers and formatters."""
    numeric_level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    
    # Ensure log directory exists
    log_path = Path(LOG_FILE)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Avoid duplicate handlers if already configured
    if not root_logger.handlers:
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # File handler
        try:
            file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception as ex:
            console_handler.setLevel(numeric_level)
            logging.warning("Could not initialize file log handler: %s", ex)


def get_logger(name: str) -> logging.Logger:
    """Retrieve a namespaced logger instance."""
    setup_logging()
    return logging.getLogger(name)
