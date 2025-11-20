#!/usr/bin/env python3
"""
Settings initialization utilities for Research Automation
Ensures required directory structure and files exist
"""

import os
import json
from pathlib import Path
from typing import Dict, Any

from ...core.logging import get_logger
from ...core.config import get_settings

logger = get_logger(__name__)


def initialize_settings_system() -> bool:
    """
    Initialize the settings management system.
    Creates required directories and default config files.

    Returns:
        True if initialization successful, False otherwise
    """
    try:
        # Create required directories
        directories = [
            Path("config"),
            Path("backups"),
            Path("data"),
            Path("data/database"),
            Path("data/exports"),
            Path("data/logs"),
            Path("data/cache")
        ]

        for directory in directories:
            directory.mkdir(exist_ok=True, parents=True)
            logger.debug(f"Ensured directory exists: {directory}")

        # Initialize RSS feeds config if it doesn't exist
        rss_config_path = Path("config/rss_feeds.json")
        if not rss_config_path.exists():
            with open(rss_config_path, 'w') as f:
                json.dump({}, f, indent=2)
            logger.info("Created empty RSS feeds configuration")

        # Initialize processing config if it doesn't exist
        processing_config_path = Path("config/processing.json")
        if not processing_config_path.exists():
            default_processing_config = {
                "max_articles_per_run": 20,
                "enable_link_enrichment": True,
                "max_links_to_enrich": 10,
                "claude_model": "claude-3-5-sonnet-20241022"
            }
            with open(processing_config_path, 'w') as f:
                json.dump(default_processing_config, f, indent=2)
            logger.info("Created default processing configuration")

        # Ensure .env.example exists for reference
        env_example_path = Path(".env.example")
        if not env_example_path.exists():
            create_env_example()

        logger.info("Settings system initialization completed successfully")
        return True

    except Exception as e:
        logger.error(f"Error initializing settings system: {e}")
        return False


def create_env_example() -> None:
    """Create .env.example file with all required variables"""
    env_example_content = """# Research Automation Configuration
# Copy this file to .env and fill in your values

# Email Configuration
EMAIL_SERVER=imap.gmail.com
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FOLDER=INBOX
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

# API Keys
CLAUDE_API_KEY=your-claude-api-key-here
LINKPREVIEW_API_KEY=your-linkpreview-api-key-here

# Application Settings
APP_ENV=development
LOG_LEVEL=INFO
DATA_DIR=/app/data
FRONTEND_URL=http://localhost:3000
BACKEND_PORT=8000

# Database
DATABASE_URL=sqlite:///app/data/database/insights.db
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault

# Optional: Processing Settings (can also be configured via web interface)
MAX_ARTICLES_PER_RUN=20
ENABLE_LINK_ENRICHMENT=true
MAX_LINKS_TO_ENRICH=10
CLAUDE_MODEL=claude-3-5-sonnet-20241022
"""

    with open(".env.example", 'w') as f:
        f.write(env_example_content)

    logger.info("Created .env.example file")


def verify_settings_system() -> Dict[str, Any]:
    """
    Verify that the settings system is properly configured.

    Returns:
        Dictionary with verification results
    """
    results = {
        "directories": {},
        "config_files": {},
        "env_file": {},
        "permissions": {},
        "overall_status": "unknown"
    }

    try:
        # Check directories
        required_dirs = ["config", "backups", "data", "data/database", "data/exports"]
        for dir_name in required_dirs:
            dir_path = Path(dir_name)
            results["directories"][dir_name] = {
                "exists": dir_path.exists(),
                "writable": os.access(dir_path, os.W_OK) if dir_path.exists() else False
            }

        # Check config files
        config_files = ["config/rss_feeds.json", "config/processing.json"]
        for file_name in config_files:
            file_path = Path(file_name)
            results["config_files"][file_name] = {
                "exists": file_path.exists(),
                "readable": os.access(file_path, os.R_OK) if file_path.exists() else False,
                "writable": os.access(file_path, os.W_OK) if file_path.exists() else False
            }

        # Check .env file
        env_path = Path(".env")
        results["env_file"] = {
            "exists": env_path.exists(),
            "readable": os.access(env_path, os.R_OK) if env_path.exists() else False,
            "writable": os.access(env_path, os.W_OK) if env_path.exists() else False
        }

        # Check overall permissions
        results["permissions"] = {
            "can_create_files": os.access(".", os.W_OK),
            "can_create_directories": os.access(".", os.W_OK)
        }

        # Determine overall status
        all_dirs_ok = all(
            dir_info["exists"] and dir_info["writable"]
            for dir_info in results["directories"].values()
        )

        all_configs_ok = all(
            file_info["exists"] and file_info["readable"] and file_info["writable"]
            for file_info in results["config_files"].values()
        )

        env_ok = results["env_file"]["exists"] and results["env_file"]["writable"]
        perms_ok = results["permissions"]["can_create_files"]

        if all_dirs_ok and all_configs_ok and env_ok and perms_ok:
            results["overall_status"] = "healthy"
        elif all_dirs_ok and perms_ok:
            results["overall_status"] = "needs_setup"
        else:
            results["overall_status"] = "unhealthy"

        logger.info(f"Settings system verification completed: {results['overall_status']}")
        return results

    except Exception as e:
        logger.error(f"Error verifying settings system: {e}")
        results["overall_status"] = "error"
        results["error"] = str(e)
        return results


def repair_settings_system() -> bool:
    """
    Attempt to repair common settings system issues.

    Returns:
        True if repair successful, False otherwise
    """
    try:
        logger.info("Attempting to repair settings system...")

        # Re-run initialization
        if not initialize_settings_system():
            return False

        # Fix file permissions if possible
        try:
            config_files = ["config/rss_feeds.json", "config/processing.json"]
            for file_name in config_files:
                file_path = Path(file_name)
                if file_path.exists():
                    file_path.chmod(0o644)  # rw-r--r--

            # Ensure config directory is writable
            Path("config").chmod(0o755)  # rwxr-xr-x

        except Exception as e:
            logger.warning(f"Could not fix file permissions: {e}")

        # Verify repair was successful
        verification = verify_settings_system()
        success = verification["overall_status"] in ["healthy", "needs_setup"]

        if success:
            logger.info("Settings system repair completed successfully")
        else:
            logger.error("Settings system repair failed")

        return success

    except Exception as e:
        logger.error(f"Error during settings system repair: {e}")
        return False


# Initialize settings system when module is imported
if __name__ != "__main__":
    try:
        initialize_settings_system()
    except Exception as e:
        logger.warning(f"Failed to auto-initialize settings system: {e}")