"""
Logging configuration for Research Automation
Provides structured logging with different levels and outputs
"""

import logging
import sys
from pathlib import Path
from typing import Optional
import structlog
import datetime
from structlog.stdlib import LoggerFactory

from .config import get_settings

def setup_logging(log_level: str = "INFO", log_file: Optional[Path] = None) -> None:
    """
    Setup structured logging configuration

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional path to log file
    """
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Add file handler if specified
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, log_level.upper()))
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))

        # Add to root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a logger instance

    Args:
        name: Logger name (usually __name__)

    Returns:
        Configured logger instance
    """
    return structlog.get_logger(name)


class ProcessingLogger:
    """
    Specialized logger for processing operations
    Provides context-aware logging for email/RSS/web processing
    """

    def __init__(self, source_type: str, source_name: str):
        self.logger = get_logger(f"processing.{source_type}")
        self.context = {
            "source_type": source_type,
            "source_name": source_name
        }

    def bind(self, **kwargs):
        """Add context to logger"""
        self.context.update(kwargs)
        return self

    def info(self, message: str, **kwargs):
        """Log info message with context"""
        self.logger.info(message, **{**self.context, **kwargs})

    def warning(self, message: str, **kwargs):
        """Log warning message with context"""
        self.logger.warning(message, **{**self.context, **kwargs})

    def error(self, message: str, **kwargs):
        """Log error message with context"""
        self.logger.error(message, **{**self.context, **kwargs})

    def debug(self, message: str, **kwargs):
        """Log debug message with context"""
        self.logger.debug(message, **{**self.context, **kwargs})


# Initialize logging on module import
try:
    settings = get_settings()
    log_file = settings.logs_dir / "newsletter_summarizer.log"
    setup_logging(settings.log_level, log_file)

    # Create application logger
    app_logger = get_logger("app")
    app_logger.info("Logging system initialized",
                    log_level=settings.log_level,
                    log_file=str(log_file))

except Exception as e:
    # Fallback to basic logging if config fails
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("app")
    logger.warning(f"Failed to initialize advanced logging: {e}")
    logger.info("Using basic logging configuration")