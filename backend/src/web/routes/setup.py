#!/usr/bin/env python3
"""
Setup and configuration API routes for Research Automation
Handles initial configuration, testing, and validation
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import json
from datetime import datetime
from pathlib import Path

from ...core.config import get_settings, config_manager
from ...core.logging import get_logger
from ...sources.email_client import EmailClient
from ...sources.rss_client import RSSClient
from ...processing.ai_summarizer import AISummarizer
from ...processing.link_enricher import LinkEnricher

logger = get_logger(__name__)
router = APIRouter()


class EmailConfig(BaseModel):
    """Email configuration model"""
    server: str = "imap.gmail.com"
    username: EmailStr
    password: str
    folder: str = "INBOX"
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    notification_email: EmailStr


class APIKeysConfig(BaseModel):
    """API keys configuration model"""
    claude_api_key: str
    linkpreview_api_key: Optional[str] = None


class RSSFeedConfig(BaseModel):
    """RSS feed configuration model"""
    name: str
    rss_url: str
    episodes_to_fetch: int = 1


class ProcessingConfig(BaseModel):
    """Processing configuration model"""
    max_articles_per_run: int = 20
    enable_link_enrichment: bool = True
    max_links_to_enrich: int = 10
    claude_model: str = "claude-sonnet-4-5"
    auto_generate_weekly_summary: bool = True
    weekly_summary_min_days: int = 3

class SystemConfig(BaseModel):
    """System configuration model"""
    enabled: bool = True
    obsidian_vault_path: str = ""
    obsidian_summaries_folder: str = "Newsletter Summaries"

class CompleteSetupConfig(BaseModel):
    """Complete setup configuration"""
    email: EmailConfig
    api_keys: APIKeysConfig
    rss_feeds: Dict[str, RSSFeedConfig] = {}
    processing: ProcessingConfig
    system: Optional[SystemConfig] = None

@router.get("/status")
async def get_setup_status():
    """
    Get current setup and configuration status.

    Returns:
        Setup status information
    """
    try:
        settings = get_settings()

        # Check configuration completeness
        missing_requirements = config_manager.get_missing_requirements()
        is_configured = config_manager.is_fully_configured()

        # Validate API keys
        api_validation = config_manager.validate_api_keys()

        status = {
            "is_configured": is_configured,
            "missing_requirements": missing_requirements,
            "api_keys_valid": api_validation,
            "configuration": {
                "email_configured": bool(settings.email_username and settings.email_password),
                "claude_configured": bool(settings.claude_api_key),
                "linkpreview_configured": bool(settings.linkpreview_api_key),
                "obsidian_path_set": bool(settings.obsidian_vault_path),
            },
            "paths": {
                "data_directory": str(settings.data_dir),
                "database_path": str(settings.database_path),
                "obsidian_vault": str(settings.obsidian_vault_path),
                "exports_directory": str(settings.exports_dir),
            }
        }

        return status

    except Exception as e:
        logger.error(f"Error getting setup status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get setup status: {str(e)}")


@router.post("/test/email")
async def test_email_connection(config: EmailConfig):
    """
    Test email configuration.

    Args:
        config: Email configuration to test

    Returns:
        Test results
    """
    try:
        # Temporarily create an email client with the provided config
        # Note: This would require modifying EmailClient to accept config
        # For now, we'll test the format and basic validation

        test_results = {
            "server_reachable": False,
            "authentication_successful": False,
            "folder_accessible": False,
            "smtp_working": False,
            "error_message": None
        }

        # Basic validation
        if not config.username or not config.password:
            test_results["error_message"] = "Username and password are required"
            return {"success": False, "results": test_results}

        # TODO: Implement actual email testing with provided config
        # This would involve creating a temporary EmailClient instance
        # with the test configuration

        return {
            "success": True,
            "message": "Email configuration validation passed",
            "results": test_results,
            "note": "Actual connection testing will be implemented in next iteration"
        }

    except Exception as e:
        logger.error(f"Error testing email configuration: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": {"error_message": str(e)}
        }


# Update backend/src/web/routes/setup.py

@router.post("/test/claude")
async def test_claude_api(config: APIKeysConfig):
    """
    Test Claude API key with real API call.

    Args:
        config: API configuration containing Claude key

    Returns:
        Test results from actual Claude API
    """
    try:
        # Basic validation first
        if not config.claude_api_key or len(config.claude_api_key.strip()) < 10:
            return {
                "success": False,
                "error": "Invalid Claude API key format"
            }

        # Create temporary AISummarizer with the provided API key
        # We need to temporarily override the settings
        original_settings = get_settings()

        # Create a test AISummarizer instance with the provided key
        from anthropic import AsyncAnthropic
        test_client = AsyncAnthropic(api_key=config.claude_api_key.strip())

        # Perform the actual API test
        try:
            response = await test_client.messages.create(
                model=original_settings.claude_model,  # Use default model
                max_tokens=50,
                messages=[{"role": "user", "content": "Hello, please respond with 'API test successful'"}]
            )

            result = response.content[0].text.strip()
            if "API test successful" in result:
                logger.info("Claude API test successful")
                return {
                    "success": True,
                    "message": "Claude API connection successful",
                    "response": result
                }
            else:
                logger.warning(f"Claude API test returned unexpected response: {result}")
                return {
                    "success": False,
                    "error": f"Unexpected response from Claude API: {result}"
                }

        except Exception as api_error:
            logger.error(f"Claude API test failed: {api_error}")
            return {
                "success": False,
                "error": f"Claude API connection failed: {str(api_error)}"
            }

    except Exception as e:
        logger.error(f"Error testing Claude API: {e}")
        return {
            "success": False,
            "error": f"Test configuration error: {str(e)}"
        }

@router.post("/test/linkpreview")
async def test_linkpreview_api(api_key: str):
    """
    Test LinkPreview API key.

    Args:
        api_key: LinkPreview API key to test

    Returns:
        Test results
    """
    try:
        if not api_key:
            return {
                "success": False,
                "error": "API key is required"
            }

        # Create temporary link enricher with the provided key
        enricher = LinkEnricher(api_key=api_key)

        # Test the API
        test_result = await enricher.test_api()

        return {
            "success": test_result,
            "message": "LinkPreview API test successful" if test_result else "LinkPreview API test failed"
        }

    except Exception as e:
        logger.error(f"Error testing LinkPreview API: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/test/rss")
async def test_rss_feed(feed_config: RSSFeedConfig):
    """
    Test RSS feed configuration.

    Args:
        feed_config: RSS feed configuration to test

    Returns:
        Test results
    """
    try:
        rss_client = RSSClient()

        # Test the RSS feed
        test_result = await rss_client.test_feed(feed_config.rss_url)

        return {
            "success": test_result.get("success", False),
            "feed_info": test_result,
            "message": "RSS feed test completed"
        }

    except Exception as e:
        logger.error(f"Error testing RSS feed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/rss/feeds")
async def get_configured_rss_feeds():
    """
    Get all configured RSS feeds.

    Returns:
        List of configured RSS feeds
    """
    try:
        rss_client = RSSClient()
        configured_feeds = rss_client.get_configured_feeds()

        return {
            "feeds": configured_feeds,
            "total": len(configured_feeds)
        }

    except Exception as e:
        logger.error(f"Error getting RSS feeds: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get RSS feeds: {str(e)}")


@router.post("/rss/feeds")
async def add_rss_feed(feed_id: str, feed_config: RSSFeedConfig):
    """
    Add a new RSS feed configuration.

    Args:
        feed_id: Unique identifier for the feed
        feed_config: Feed configuration

    Returns:
        Success confirmation
    """
    try:
        rss_client = RSSClient()

        # Convert Pydantic model to dict
        feed_dict = feed_config.dict()

        # Add the feed
        success = rss_client.add_feed(feed_id, feed_dict)

        if success:
            return {
                "success": True,
                "message": f"RSS feed '{feed_config.name}' added successfully",
                "feed_id": feed_id
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to add RSS feed")

    except Exception as e:
        logger.error(f"Error adding RSS feed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add RSS feed: {str(e)}")


@router.delete("/rss/feeds/{feed_id}")
async def remove_rss_feed(feed_id: str):
    """
    Remove an RSS feed configuration.

    Args:
        feed_id: Feed identifier to remove

    Returns:
        Success confirmation
    """
    try:
        rss_client = RSSClient()

        success = rss_client.remove_feed(feed_id)

        if success:
            return {
                "success": True,
                "message": f"RSS feed '{feed_id}' removed successfully"
            }
        else:
            raise HTTPException(status_code=404, detail=f"RSS feed '{feed_id}' not found")

    except Exception as e:
        logger.error(f"Error removing RSS feed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove RSS feed: {str(e)}")


@router.get("/rss/info")
async def get_rss_feed_info(rss_url: str):
    """
    Get detailed information about an RSS feed.

    Args:
        rss_url: URL of the RSS feed

    Returns:
        Feed information
    """
    try:
        rss_client = RSSClient()

        feed_info = await rss_client.get_feed_info(rss_url)

        return {
            "success": "error" not in feed_info,
            "feed_info": feed_info
        }

    except Exception as e:
        logger.error(f"Error getting RSS feed info: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/export/formats")
async def get_export_formats():
    """
    Get available export formats.

    Returns:
        List of export format options
    """
    try:
        from ...storage.export_manager import ExportManager

        export_manager = ExportManager()
        formats = export_manager.get_export_formats()

        return {
            "formats": formats,
            "total": len(formats)
        }

    except Exception as e:
        logger.error(f"Error getting export formats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get export formats: {str(e)}")


@router.post("/complete")
async def complete_setup(config: CompleteSetupConfig):
    """
    Complete the initial setup with full configuration.
    Updated to actually save RSS feeds as sources and configuration.

    Args:
        config: Complete setup configuration

    Returns:
        Setup completion status
    """
    try:
        # Validation (existing logic)
        validation_results = {}

        # Validate email config
        if not config.email.username or not config.email.password:
            validation_results["email"] = "Email username and password are required"

        # Validate API keys
        if not config.api_keys.claude_api_key:
            validation_results["claude_api"] = "Claude API key is required"

        # If there are validation errors, return them
        if validation_results:
            return {
                "success": False,
                "message": "Configuration validation failed",
                "errors": validation_results
            }

        # Actually save the configuration
        from ...web.routes.sources import get_source_manager

        # Simple .env file saving (inline to avoid complex imports)
        def save_env_variables(env_updates: dict) -> bool:
            """Save environment variables to .env file"""
            try:
                env_path = Path(".env")

                # Load existing variables
                existing_vars = {}
                if env_path.exists():
                    with open(env_path, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                key, value = line.split('=', 1)
                                existing_vars[key] = value.strip('"\'')

                # Update with new values
                existing_vars.update(env_updates)

                # Write back to file
                with open(env_path, 'w') as f:
                    f.write("# Research Automation Configuration\n")
                    f.write(f"# Updated during setup: {datetime.now().isoformat()}\n\n")

                    # Email section
                    f.write("# Email Configuration\n")
                    email_keys = ["EMAIL_SERVER", "EMAIL_USERNAME", "EMAIL_PASSWORD",
                                  "EMAIL_FOLDER", "SMTP_SERVER", "SMTP_PORT"]
                    for key in email_keys:
                        if key in existing_vars:
                            f.write(f'{key}="{existing_vars[key]}"\n')
                    f.write("\n")

                    # API Keys section
                    f.write("# API Keys\n")
                    api_keys = ["CLAUDE_API_KEY", "LINKPREVIEW_API_KEY"]
                    for key in api_keys:
                        if key in existing_vars:
                            f.write(f'{key}="{existing_vars[key]}"\n')
                    f.write("\n")

                    # System Configuration
                    f.write("# System Configuration\n")
                    system_keys = ["OBSIDIAN_VAULT_PATH", "OBSIDIAN_SUMMARIES_FOLDER",
                                   "DATA_DIR", "LOG_LEVEL", "BACKEND_PORT"]
                    for key in system_keys:
                        if key in existing_vars:
                            f.write(f'{key}="{existing_vars[key]}"\n')
                    f.write("\n")

                    all_known_keys = email_keys + api_keys + system_keys

                    # Other variables
                    f.write("# Other Configuration\n")
                    for key, value in existing_vars.items():
                        if key not in all_known_keys:
                            f.write(f'{key}="{value}"\n')

                return True
            except Exception as e:
                logger.error(f"Failed to save environment variables: {e}")
                return False

        # Get source manager instance (may not be available during initial setup)
        try:
            source_manager = await get_source_manager()
        except HTTPException:
            # Source manager not available during setup - this is OK
            # We'll create a basic configuration that can be migrated later
            source_manager = None
            logger.info("Source manager not available during setup - RSS feeds will need manual migration")

        # 1. Save environment variables to .env file
        env_updates = {
            # Email configuration
            "EMAIL_SERVER": config.email.server,
            "EMAIL_USERNAME": config.email.username,
            "EMAIL_PASSWORD": config.email.password,
            "EMAIL_FOLDER": config.email.folder,
            "SMTP_SERVER": config.email.smtp_server,
            "SMTP_PORT": str(config.email.smtp_port),

            # API Keys
            "CLAUDE_API_KEY": config.api_keys.claude_api_key,
        }

        # Optional API key
        if config.api_keys.linkpreview_api_key:
            env_updates["LINKPREVIEW_API_KEY"] = config.api_keys.linkpreview_api_key

        # Obsidian configuration
        if config.system and config.system.enabled:
            if config.system.obsidian_vault_path:
                env_updates["OBSIDIAN_VAULT_PATH"] = config.system.obsidian_vault_path
            if config.system.obsidian_summaries_folder:
                env_updates["OBSIDIAN_SUMMARIES_FOLDER"] = config.system.obsidian_summaries_folder
            logger.info(
                f"Configured Obsidian: vault={config.system.obsidian_vault_path}, folder={config.system.obsidian_summaries_folder}")

        # Save environment variables
        env_save_success = save_env_variables(env_updates)
        if not env_save_success:
            logger.warning("Failed to save environment variables, but continuing setup")

        # 2. Save processing configuration to JSON file
        processing_config = {
            "max_articles_per_run": config.processing.max_articles_per_run,
            "enable_link_enrichment": config.processing.enable_link_enrichment,
            "max_links_to_enrich": config.processing.max_links_to_enrich,
            "claude_model": config.processing.claude_model
        }

        processing_path = Path("config/processing.json")
        processing_path.parent.mkdir(exist_ok=True)
        with open(processing_path, 'w') as f:
            json.dump(processing_config, f, indent=2)

        # 3. Convert RSS feeds to individual sources (if source manager available)
        rss_sources_created = []
        if source_manager:
            for feed_id, feed_config in config.rss_feeds.items():
                source_id = f"setup_rss_{feed_id}"

                # Create RSS source configuration
                source_config = {
                    "rss_url": feed_config.rss_url,
                    "episodes_to_fetch": feed_config.episodes_to_fetch
                }

                # Add the source
                success = source_manager.add_source(
                    source_id=source_id,
                    source_type="rss",
                    config=source_config,
                    name=feed_config.name,
                    enabled=True
                )

                if success:
                    rss_sources_created.append(source_id)
                    logger.info(f"Created RSS source: {source_id} ({feed_config.name})")
                else:
                    logger.warning(f"Failed to create RSS source: {source_id}")
        else:
            # Save RSS feeds to legacy format for later migration
            rss_config_path = Path("config/rss_feeds.json")
            rss_config_path.parent.mkdir(exist_ok=True)
            with open(rss_config_path, 'w') as f:
                json.dump(config.rss_feeds, f, indent=2)
            logger.info("Saved RSS feeds to legacy format - will need migration to sources")

        # 4. Create default email source (if source manager and email configured)
        email_success = False
        if source_manager and config.email.username and config.email.password:
            email_source_config = {
                "server": config.email.server,
                "username": config.email.username,
                "password": config.email.password,
                "folder": config.email.folder
            }

            email_success = source_manager.add_source(
                source_id="setup_email_inbox",
                source_type="email",
                config=email_source_config,
                name=f"Email Inbox ({config.email.username})",
                enabled=True
            )

            if email_success:
                logger.info("Created email source: setup_email_inbox")

        return {
            "success": True,
            "message": "Setup completed successfully",
            "details": {
                "env_variables_saved": env_save_success,
                "processing_config_saved": True,
                "rss_sources_created": len(rss_sources_created) if source_manager else 0,
                "rss_feeds_saved_legacy": len(config.rss_feeds) if not source_manager else 0,
                "email_source_created": email_success,
                "source_manager_available": source_manager is not None
            },
            "next_steps": [
                "Configuration has been saved to files",
                "RSS feeds converted to individual sources" if source_manager else "RSS feeds saved (will need manual migration to sources)",
                "Email source created for processing" if email_success else "Email configuration saved",
                "Restart the application to load new environment variables",
                "You can now start processing newsletters",
                "Visit the dashboard to monitor processing"
            ]
        }

    except Exception as e:
        logger.error(f"Error completing setup: {e}")
        raise HTTPException(status_code=500, detail=f"Setup completion failed: {str(e)}")

@router.get("/defaults")
async def get_default_configuration():
    """
    Get default configuration values for setup forms.

    Returns:
        Default configuration values
    """
    try:
        return {
            "email": {
                "server": "imap.gmail.com",
                "folder": "INBOX",
                "smtp_server": "smtp.gmail.com",
                "smtp_port": 587
            },
            "processing": {
                "max_articles_per_run": 20,
                "enable_link_enrichment": True,
                "max_links_to_enrich": 10,
                "claude_model": "claude-sonnet-4-5"
            },
            "rss_feeds": {
                "0x_research": {
                    "name": "0x Research",
                    "rss_url": "https://feeds.megaphone.fm/0xresearch",
                    "episodes_to_fetch": 1
                },
                "peter_attia": {
                    "name": "Peter Attia MD",
                    "rss_url": "https://peterattiamd.com/feed/",
                    "episodes_to_fetch": 2
                }
            }
        }

    except Exception as e:
        logger.error(f"Error getting default configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get defaults: {str(e)}")


@router.post("/validate")
async def validate_complete_configuration(config: CompleteSetupConfig):
    """
    Validate complete configuration without saving.

    Args:
        config: Configuration to validate

    Returns:
        Validation results
    """
    try:
        validation_results = {
            "valid": True,
            "errors": {},
            "warnings": {},
            "tests_performed": []
        }

        # Test email configuration
        try:
            # Basic email validation
            if not config.email.username or not config.email.password:
                validation_results["errors"]["email"] = "Username and password required"
                validation_results["valid"] = False
            else:
                validation_results["tests_performed"].append("email_format")
        except Exception as e:
            validation_results["errors"]["email"] = str(e)
            validation_results["valid"] = False

        # Test Claude API key format
        try:
            if not config.api_keys.claude_api_key or len(config.api_keys.claude_api_key.strip()) < 10:
                validation_results["errors"]["claude_api"] = "Invalid Claude API key format"
                validation_results["valid"] = False
            else:
                validation_results["tests_performed"].append("claude_api_format")
        except Exception as e:
            validation_results["errors"]["claude_api"] = str(e)
            validation_results["valid"] = False

        # Validate RSS feeds
        try:
            rss_errors = []
            for feed_id, feed_config in config.rss_feeds.items():
                if not feed_config.rss_url:
                    rss_errors.append(f"RSS URL required for {feed_id}")

            if rss_errors:
                validation_results["errors"]["rss_feeds"] = rss_errors
                validation_results["valid"] = False
            else:
                validation_results["tests_performed"].append("rss_feeds_format")
        except Exception as e:
            validation_results["errors"]["rss_feeds"] = str(e)
            validation_results["valid"] = False

        # Add warnings for optional components
        if not config.api_keys.linkpreview_api_key:
            validation_results["warnings"][
                "linkpreview"] = "Link enrichment will be disabled without LinkPreview API key"

        return validation_results

    except Exception as e:
        logger.error(f"Error validating configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Configuration validation failed: {str(e)}")

