#!/usr/bin/env python3
"""
Settings management routes for Research Automation
Handles loading, saving, and updating configuration after initial setup
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, EmailStr
from typing import Dict, Any, Optional, List
import os
import json
from pathlib import Path
import shutil
from datetime import datetime

from ...core.config import get_settings, config_manager
from ...core.logging import get_logger
from .setup import EmailConfig, APIKeysConfig, RSSFeedConfig, ProcessingConfig
from .settings_init import initialize_settings_system, verify_settings_system, repair_settings_system

logger = get_logger(__name__)
router = APIRouter()


class SystemConfig(BaseModel):
    """System configuration settings"""
    data_directory: str
    database_path: str
    obsidian_vault_path: str = ""
    obsidian_summaries_folder: str = "Newsletter Summaries"
    exports_directory: str
    log_level: str = "INFO"
    frontend_url: str = "http://localhost:3000"
    backend_port: int = 8000


class CurrentSettings(BaseModel):
    """Current settings response with sensitive data masked"""
    email: EmailConfig
    api_keys: APIKeysConfig
    rss_feeds: Dict[str, RSSFeedConfig]
    processing: ProcessingConfig
    system: SystemConfig


class SettingsUpdate(BaseModel):
    """Settings update request"""
    email: Optional[EmailConfig] = None
    api_keys: Optional[APIKeysConfig] = None
    rss_feeds: Optional[Dict[str, RSSFeedConfig]] = None
    processing: Optional[ProcessingConfig] = None
    system: Optional[SystemConfig] = None


class ConfigurationManager:
    """Manages configuration file operations"""

    def __init__(self):
        # Ensure settings system is initialized
        initialize_settings_system()

        self.env_path = Path(".env")
        self.config_dir = Path("config")
        self.rss_config_path = self.config_dir / "rss_feeds.json"
        self.processing_config_path = self.config_dir / "processing.json"

    def load_env_vars(self) -> Dict[str, str]:
        """Load current environment variables from .env file"""
        env_vars = {}
        if self.env_path.exists():
            try:
                with open(self.env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            # Remove quotes if present
                            value = value.strip('"\'')
                            env_vars[key] = value
            except Exception as e:
                logger.error(f"Error reading .env file: {e}")
        return env_vars

    def save_env_vars(self, updates: Dict[str, str]) -> bool:
        """Update .env file with new values"""
        try:
            # Create backup
            if self.env_path.exists():
                backup_path = self.env_path.with_suffix('.env.backup')
                shutil.copy2(self.env_path, backup_path)
                logger.info(f"Created .env backup at {backup_path}")

            # Load current env vars
            current_vars = self.load_env_vars()

            # Update with new values
            current_vars.update(updates)

            # Write back to .env file
            with open(self.env_path, 'w') as f:
                f.write(f"# Research Automation Configuration\n")
                f.write(f"# Updated: {datetime.now().isoformat()}\n\n")

                # Write in organized sections
                sections = {
                    "# Email Configuration": [
                        "EMAIL_SERVER", "EMAIL_USERNAME", "EMAIL_PASSWORD",
                        "EMAIL_FOLDER", "SMTP_SERVER", "SMTP_PORT"
                    ],
                    "# API Keys": [
                        "CLAUDE_API_KEY", "LINKPREVIEW_API_KEY"
                    ],
                    "# Application Settings": [
                        "APP_ENV", "LOG_LEVEL", "DATA_DIR", "FRONTEND_URL", "BACKEND_PORT"
                    ],
                    "# Database": [
                        "DATABASE_URL", "OBSIDIAN_VAULT_PATH"
                    ]
                }

                written_keys = set()

                for section_name, keys in sections.items():
                    f.write(f"\n{section_name}\n")
                    for key in keys:
                        if key in current_vars:
                            value = current_vars[key]
                            # Quote values that contain spaces or special characters
                            if ' ' in value or any(c in value for c in ['$', '&', '|', '>', '<']):
                                value = f'"{value}"'
                            f.write(f"{key}={value}\n")
                            written_keys.add(key)

                # Write any remaining variables
                remaining = set(current_vars.keys()) - written_keys
                if remaining:
                    f.write(f"\n# Other Settings\n")
                    for key in sorted(remaining):
                        value = current_vars[key]
                        if ' ' in value or any(c in value for c in ['$', '&', '|', '>', '<']):
                            value = f'"{value}"'
                        f.write(f"{key}={value}\n")

            logger.info(f"Updated .env file with {len(updates)} changes: {list(updates.keys())}")
            return True

        except Exception as e:
            logger.error(f"Error updating .env file: {e}")
            return False

    def load_rss_feeds(self) -> Dict[str, RSSFeedConfig]:
        """Load RSS feeds configuration from JSON file"""
        if not self.rss_config_path.exists():
            return {}

        try:
            with open(self.rss_config_path, 'r') as f:
                data = json.load(f)
                return {
                    feed_id: RSSFeedConfig(**feed_data)
                    for feed_id, feed_data in data.items()
                }
        except Exception as e:
            logger.error(f"Error loading RSS feeds config: {e}")
            return {}

    def save_rss_feeds(self, feeds: Dict[str, RSSFeedConfig]) -> bool:
        """Save RSS feeds configuration to JSON file"""
        try:
            # Create backup
            if self.rss_config_path.exists():
                backup_path = self.rss_config_path.with_suffix('.json.backup')
                shutil.copy2(self.rss_config_path, backup_path)

            # Convert to dict for JSON serialization
            feeds_data = {
                feed_id: feed.dict()
                for feed_id, feed in feeds.items()
            }

            with open(self.rss_config_path, 'w') as f:
                json.dump(feeds_data, f, indent=2)

            logger.info(f"Saved {len(feeds)} RSS feeds to {self.rss_config_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving RSS feeds config: {e}")
            return False

    def load_processing_config(self) -> ProcessingConfig:
        """Load processing configuration from JSON file"""
        if not self.processing_config_path.exists():
            # Return defaults
            return ProcessingConfig(
                max_articles_per_run=20,
                enable_link_enrichment=True,
                max_links_to_enrich=10,
                claude_model="claude-3-5-sonnet-20241022",
                auto_generate_weekly_summary = True,
                weekly_summary_min_days = 3
            )

        try:
            with open(self.processing_config_path, 'r') as f:
                data = json.load(f)

            # Handle missing fields gracefully with defaults
            return ProcessingConfig(
                max_articles_per_run=data.get('max_articles_per_run', 20),
                enable_link_enrichment=data.get('enable_link_enrichment', True),
                max_links_to_enrich=data.get('max_links_to_enrich', 10),
                claude_model=data.get('claude_model', 'claude-3-5-sonnet-20241022'),
                auto_generate_weekly_summary=data.get('auto_generate_weekly_summary', True),
                weekly_summary_min_days=data.get('weekly_summary_min_days', 3)
            )

        except Exception as e:
            logger.error(f"Error loading processing config: {e}")
            # Return defaults on error
            return ProcessingConfig(
                max_articles_per_run=20,
                enable_link_enrichment=True,
                max_links_to_enrich=10,
                claude_model="claude-3-5-sonnet-20241022",
                auto_generate_weekly_summary=True,
                weekly_summary_min_days=3
            )

    def save_processing_config(self, config: ProcessingConfig) -> bool:
        """Save processing configuration to JSON file"""
        try:
            # Create backup
            if self.processing_config_path.exists():
                backup_path = self.processing_config_path.with_suffix('.json.backup')
                shutil.copy2(self.processing_config_path, backup_path)

            with open(self.processing_config_path, 'w') as f:
                json.dump(config.dict(), f, indent=2)

            logger.info(f"Saved processing config to {self.processing_config_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving processing config: {e}")
            return False


# Initialize configuration manager
config_mgr = ConfigurationManager()


@router.get("/current", response_model=Dict[str, Any])
async def get_current_settings():
    """
    Get current configuration settings with sensitive data masked.

    Returns:
        Current configuration with passwords/keys masked
    """
    try:
        settings = get_settings()
        env_vars = config_mgr.load_env_vars()
        rss_feeds = config_mgr.load_rss_feeds()
        processing_config = config_mgr.load_processing_config()

        # Build current settings with proper masking
        current_settings = {
            "email": {
                "server": settings.email_server,
                "username": settings.email_username,
                "password": "***MASKED***" if settings.email_password else "",
                "folder": settings.email_folder,
                "smtp_server": settings.smtp_server,
                "smtp_port": settings.smtp_port,
                "notification_email": getattr(settings, 'notification_email', settings.email_username)
            },
            "api_keys": {
                "claude_api_key": "***MASKED***" if settings.claude_api_key else "",
                "linkpreview_api_key": "***MASKED***" if settings.linkpreview_api_key else ""
            },
            "rss_feeds": {
                feed_id: {
                    "name": feed.name,
                    "rss_url": feed.rss_url,
                    "episodes_to_fetch": feed.episodes_to_fetch
                }
                for feed_id, feed in rss_feeds.items()
            },
            "processing": {
                "max_articles_per_run": processing_config.max_articles_per_run,
                "enable_link_enrichment": processing_config.enable_link_enrichment,
                "max_links_to_enrich": processing_config.max_links_to_enrich,
                "claude_model": processing_config.claude_model,
                "auto_generate_weekly_summary": getattr(settings, 'auto_generate_weekly_summary', True),
                "weekly_summary_min_days": processing_config.weekly_summary_min_days
            },
            "system": {
                "data_directory": str(settings.data_dir),
                "database_path": str(settings.database_path),
                "obsidian_vault_path": str(getattr(settings, 'obsidian_vault_path', '')),
                "obsidian_summaries_folder": str(getattr(settings, 'obsidian_summaries_folder', 'Newsletter Summaries')),  # ADD THIS
                "exports_directory": str(settings.exports_dir),
                "log_level": settings.log_level,
                "frontend_url": getattr(settings, 'frontend_url', 'http://localhost:3000'),
                "backend_port": getattr(settings, 'backend_port', 8000)
            }
        }

        return {
            "success": True,
            "settings": current_settings
        }

    except Exception as e:
        logger.error(f"Error getting current settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get current settings: {str(e)}")


@router.put("/save")
async def save_settings(update: SettingsUpdate):
    """
    Save updated configuration settings.

    Args:
        update: Settings to update

    Returns:
        Save operation status
    """
    try:
        env_updates = {}
        updated_sections = []

        # Process email settings
        if update.email:
            env_updates.update({
                "EMAIL_SERVER": update.email.server,
                "EMAIL_USERNAME": update.email.username,
                "EMAIL_FOLDER": update.email.folder,
                "SMTP_SERVER": update.email.smtp_server,
                "SMTP_PORT": str(update.email.smtp_port)
            })

            # Only update password if it's not the masked value
            if update.email.password and update.email.password != "***MASKED***":
                env_updates["EMAIL_PASSWORD"] = update.email.password

            if update.email.notification_email:
                env_updates["NOTIFICATION_EMAIL"] = update.email.notification_email

            updated_sections.append("email")
            logger.info("Updated email configuration")

        # Process API keys
        if update.api_keys:
            if update.api_keys.claude_api_key and update.api_keys.claude_api_key != "***MASKED***":
                env_updates["CLAUDE_API_KEY"] = update.api_keys.claude_api_key

            if update.api_keys.linkpreview_api_key:
                if update.api_keys.linkpreview_api_key == "":
                    # Remove the key
                    env_updates["LINKPREVIEW_API_KEY"] = ""
                elif update.api_keys.linkpreview_api_key != "***MASKED***":
                    env_updates["LINKPREVIEW_API_KEY"] = update.api_keys.linkpreview_api_key

            updated_sections.append("api_keys")
            logger.info("Updated API keys configuration")

        # Process RSS feeds
        if update.rss_feeds is not None:
            success = config_mgr.save_rss_feeds(update.rss_feeds)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save RSS feeds configuration")
            updated_sections.append("rss_feeds")
            logger.info(f"Updated RSS feeds configuration: {len(update.rss_feeds)} feeds")

        # Process processing settings
        if update.processing:
            success = config_mgr.save_processing_config(update.processing)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save processing configuration")

            # Update environment variables for ALL processing settings
            if update.processing.claude_model:
                env_updates["CLAUDE_MODEL"] = update.processing.claude_model

            if hasattr(update.processing, 'auto_generate_weekly_summary'):
                env_updates["AUTO_GENERATE_WEEKLY_SUMMARY"] = str(
                    update.processing.auto_generate_weekly_summary).lower()

            if hasattr(update.processing, 'weekly_summary_min_days'):
                env_updates["WEEKLY_SUMMARY_MIN_DAYS"] = str(update.processing.weekly_summary_min_days)

            # Add the missing ones for container restart persistence:
            if hasattr(update.processing, 'max_articles_per_run'):
                env_updates["MAX_ARTICLES_PER_RUN"] = str(update.processing.max_articles_per_run)

            if hasattr(update.processing, 'enable_link_enrichment'):
                env_updates["ENABLE_LINK_ENRICHMENT"] = str(update.processing.enable_link_enrichment).lower()

            if hasattr(update.processing, 'max_links_to_enrich'):
                env_updates["MAX_LINKS_TO_ENRICH"] = str(update.processing.max_links_to_enrich)

            updated_sections.append("processing")
            logger.info("Updated processing configuration")

        # Process system settings
        if update.system:
            system_updates = update.system.dict(exclude_unset=True)
            if system_updates:
                # Update environment variables for system settings
                if 'obsidian_vault_path' in system_updates:
                    env_updates["OBSIDIAN_VAULT_PATH"] = system_updates['obsidian_vault_path']

                if 'obsidian_summaries_folder' in system_updates:
                    env_updates["OBSIDIAN_SUMMARIES_FOLDER"] = system_updates['obsidian_summaries_folder']

                if 'data_directory' in system_updates:
                    env_updates["DATA_DIR"] = system_updates['data_directory']

                if 'log_level' in system_updates:
                    env_updates["LOG_LEVEL"] = system_updates['log_level']

                if 'backend_port' in system_updates:
                    env_updates["BACKEND_PORT"] = str(system_updates['backend_port'])

                if 'frontend_url' in system_updates:
                    env_updates["FRONTEND_URL"] = system_updates['frontend_url']

                updated_sections.append("system")
                logger.info("Updated system configuration")

        # Update .env file if needed
        if env_updates:
            success = config_mgr.save_env_vars(env_updates)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update environment configuration")

        # Reload configuration to pick up changes
        try:
            # Force reload environment variables before loading settings
            import os
            from pathlib import Path

            env_path = Path("/app/.env")  # ← Absolute path to root .env
            if env_path.exists():
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            try:
                                key, value = line.split('=', 1)
                                os.environ[key.strip()] = value.strip().strip('"\'')
                            except ValueError:
                                continue

            config_manager.load_settings()
            logger.info("Configuration reloaded successfully with fresh environment variables")
        except Exception as e:
            logger.warning(f"Failed to reload configuration: {e}")

        return {
            "success": True,
            "message": "Settings saved successfully",
            "updated_sections": updated_sections,
            "env_updates": list(env_updates.keys()) if env_updates else []
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

@router.post("/reset")
async def reset_to_defaults():
    """
    Reset configuration to default values.

    Returns:
        Reset operation status
    """
    try:
        # Reset RSS feeds
        config_mgr.save_rss_feeds({})

        # Reset processing config to defaults
        default_processing = ProcessingConfig()
        config_mgr.save_processing_config(default_processing)

        # Note: We don't reset email/API keys as those are user-specific
        # and losing them would break the application

        logger.info("Settings reset to defaults (preserved email/API keys)")

        return {
            "success": True,
            "message": "Settings reset to defaults",
            "note": "Email and API key settings were preserved"
        }

    except Exception as e:
        logger.error(f"Error resetting settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")


@router.get("/backup")
async def create_settings_backup():
    """
    Create a backup of current settings.

    Returns:
        Backup creation status
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path("backups") / f"settings_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)

        # Backup .env file
        if config_mgr.env_path.exists():
            shutil.copy2(config_mgr.env_path, backup_dir / ".env")

        # Backup config files
        if config_mgr.rss_config_path.exists():
            shutil.copy2(config_mgr.rss_config_path, backup_dir / "rss_feeds.json")

        if config_mgr.processing_config_path.exists():
            shutil.copy2(config_mgr.processing_config_path, backup_dir / "processing.json")

        # Create backup manifest
        manifest = {
            "timestamp": timestamp,
            "files": [
                f.name for f in backup_dir.iterdir() if f.is_file()
            ],
            "created_by": "settings_backup_endpoint"
        }

        with open(backup_dir / "manifest.json", 'w') as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"Created settings backup in {backup_dir}")

        return {
            "success": True,
            "message": "Settings backup created successfully",
            "backup_path": str(backup_dir),
            "files": manifest["files"]
        }

    except Exception as e:
        logger.error(f"Error creating settings backup: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create settings backup: {str(e)}")


@router.get("/validate")
async def validate_current_settings():
    """
    Validate current settings configuration.

    Returns:
        Validation results
    """
    try:
        # Use existing validation from config manager
        api_validation = config_manager.validate_api_keys()
        missing_requirements = config_manager.get_missing_requirements()

        validation_result = {
            "valid": len(missing_requirements) == 0,
            "api_keys_valid": api_validation,
            "missing_requirements": missing_requirements,
            "warnings": []
        }

        # Add warnings for optional configurations
        if not api_validation.get("linkpreview", True):
            validation_result["warnings"].append(
                "LinkPreview API key not configured (link enrichment will be disabled)")

        settings = get_settings()
        if not hasattr(settings, 'obsidian_vault_path') or not settings.obsidian_vault_path:
            validation_result["warnings"].append("Obsidian vault path not set (Obsidian export will be unavailable)")

        return {
            "success": True,
            "validation": validation_result
        }

    except Exception as e:
        logger.error(f"Error validating settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate settings: {str(e)}")


# Health check for settings system
@router.get("/health")
async def settings_health_check():
    """Check health of settings management system using comprehensive verification"""
    try:
        verification = verify_settings_system()

        return {
            "status": verification["overall_status"],
            "details": verification,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Settings health check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.post("/repair")
async def repair_settings():
    """Attempt to repair settings system issues"""
    try:
        logger.info("Settings repair requested")
        success = repair_settings_system()

        if success:
            # Re-run health check
            verification = verify_settings_system()
            return {
                "success": True,
                "message": "Settings system repair completed",
                "status": verification["overall_status"],
                "details": verification
            }
        else:
            return {
                "success": False,
                "message": "Settings system repair failed",
                "recommendation": "Check file permissions and disk space"
            }

    except Exception as e:
        logger.error(f"Error during settings repair: {e}")
        raise HTTPException(status_code=500, detail=f"Settings repair failed: {str(e)}")

