"""
Configuration management for Research Automation
Handles environment variables, validation, and settings hierarchy
"""

import os
from typing import Optional, List, Dict, Any
from pathlib import Path

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings


class EmailSettings(BaseModel):
    """Email configuration"""
    server: str = Field(default="imap.gmail.com", description="IMAP server")
    username: str = Field(..., description="Email username")
    password: str = Field(..., description="Email password/app password")
    folder: str = Field(default="INBOX", description="Email folder to monitor")

    # SMTP settings
    smtp_server: str = Field(default="smtp.gmail.com", description="SMTP server")
    smtp_port: int = Field(default=587, description="SMTP port")
    notification_email: str = Field(..., description="Email to receive notifications")


class ClaudeSettings(BaseModel):
    """Claude API configuration"""
    api_key: str = Field(..., description="Anthropic API key")
    model: str = Field(default="claude-3-5-sonnet-20241022", description="Claude model to use")
    max_tokens: int = Field(default=8000, description="Maximum tokens per request")


class ProcessingSettings(BaseModel):
    """Processing configuration"""
    max_articles_per_run: int = Field(default=20, description="Maximum articles to process per run")
    enable_link_enrichment: bool = Field(default=True, description="Enable link enrichment via API")
    max_links_to_enrich: int = Field(default=10, description="Maximum links to enrich per article")
    linkpreview_api_key: Optional[str] = Field(None, description="LinkPreview API key")


class Settings(BaseSettings):
    """Main application settings"""

    # Application
    app_env: str = Field(default="development", description="Application environment")
    log_level: str = Field(default="INFO", description="Logging level")
    data_dir: Path = Field(default=Path("/app/data"), description="Data directory")

    # Web Interface
    frontend_url: str = Field(default="http://localhost:3000", description="Frontend URL")
    backend_port: int = Field(default=8000, description="Backend port")
    enable_cors: bool = Field(default=True, description="Enable CORS")

    # API Keys (loaded from environment)
    claude_api_key: str = Field(..., env="CLAUDE_API_KEY")
    linkpreview_api_key: Optional[str] = Field(None, env="LINKPREVIEW_API_KEY")

    # Email settings
    email_server: str = Field(default="imap.gmail.com", env="EMAIL_SERVER")
    email_username: str = Field(..., env="EMAIL_USERNAME")
    email_password: str = Field(..., env="EMAIL_PASSWORD")
    email_folder: str = Field(default="INBOX", env="EMAIL_FOLDER")
    smtp_server: str = Field(default="smtp.gmail.com", env="SMTP_SERVER")
    smtp_port: int = Field(default=587, env="SMTP_PORT")
    notification_email: str = Field(..., env="NOTIFICATION_EMAIL")

    # Claude settings
    claude_model: str = Field(default="claude-sonnet-4-5", env="CLAUDE_MODEL")
    max_tokens: int = Field(default=2000, env="MAX_TOKENS")

    # Processing settings
    max_articles_per_run: int = Field(default=20, env="MAX_ARTICLES_PER_RUN")
    enable_link_enrichment: bool = Field(default=True, env="ENABLE_LINK_ENRICHMENT")
    max_links_to_enrich: int = Field(default=10, env="MAX_LINKS_TO_ENRICH")

    # Weekly summary settings (ADD THESE)
    auto_generate_weekly_summary: bool = Field(
        default=True,
        env="AUTO_GENERATE_WEEKLY_SUMMARY",
        description="Automatically generate weekly summaries during processing"
    )
    weekly_summary_min_days: int = Field(
        default=3,
        env="WEEKLY_SUMMARY_MIN_DAYS",
        description="Minimum days between auto-generated weekly summaries"
    )

    # Export settings
    default_output_format: str = Field(default="obsidian", env="DEFAULT_OUTPUT_FORMAT")
    obsidian_vault_path: Path = Field(default=Path("/app/data/obsidian"), env="OBSIDIAN_VAULT_PATH")
    obsidian_summaries_folder: str = Field(default="Newsletter Summaries", env="OBSIDIAN_SUMMARIES_FOLDER")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @field_validator("data_dir", mode="before")
    def ensure_data_dir_exists(cls, v):
        """Ensure data directory exists"""
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)

        # Create subdirectories
        (path / "database").mkdir(exist_ok=True)
        (path / "cache").mkdir(exist_ok=True)
        (path / "exports").mkdir(exist_ok=True)
        (path / "logs").mkdir(exist_ok=True)

        return path

    @field_validator("obsidian_vault_path", mode="before")
    def ensure_vault_path_exists(cls, v):
        """Ensure Obsidian vault path exists (if possible)"""
        try:
            path = Path(v)
            # Only try to create if we have permission and it doesn't exist
            if not path.exists():
                path.mkdir(parents=True, exist_ok=True)
            return path
        except (PermissionError, OSError) as e:
            # If we can't access the path, log a warning but don't crash
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Cannot access Obsidian vault path {v}: {e}")
            logger.warning("Obsidian export will work if path is mounted or accessible")
            # Return the path anyway - it might be mounted
            return Path(v)

    def get_email_settings(self) -> EmailSettings:
        """Get email settings as separate object"""
        return EmailSettings(
            server=self.email_server,
            username=self.email_username,
            password=self.email_password,
            folder=self.email_folder,
            smtp_server=self.smtp_server,
            smtp_port=self.smtp_port,
            notification_email=self.notification_email
        )

    def get_claude_settings(self) -> ClaudeSettings:
        """Get Claude settings as separate object"""
        return ClaudeSettings(
            api_key=self.claude_api_key,
            model=self.claude_model,
            max_tokens=self.max_tokens
        )

    def get_processing_settings(self) -> ProcessingSettings:
        """Get processing settings as separate object"""
        return ProcessingSettings(
            max_articles_per_run=self.max_articles_per_run,
            enable_link_enrichment=self.enable_link_enrichment,
            max_links_to_enrich=self.max_links_to_enrich,
            linkpreview_api_key=self.linkpreview_api_key
        )

    @property
    def database_path(self) -> Path:
        """Get database file path"""
        return self.data_dir / "database" / "insights.db"

    @property
    def cache_dir(self) -> Path:
        """Get cache directory path"""
        return self.data_dir / "cache"

    @property
    def exports_dir(self) -> Path:
        """Get exports directory path"""
        return self.data_dir / "exports"

    @property
    def logs_dir(self) -> Path:
        """Get logs directory path"""
        return self.data_dir / "logs"


class ConfigManager:
    """Configuration manager with validation and loading"""

    def __init__(self):
        self._settings: Optional[Settings] = None

    def load_settings(self, env_file: Optional[str] = None) -> Settings:
        """Load and validate settings"""
        # Always force reload from .env file
        env_file_path = env_file if env_file and os.path.exists(env_file) else ".env"

        # Force reload environment variables from .env file
        self._force_reload_env_vars(env_file_path)

        # Clear any cached settings to force reload
        self._settings = None

        # Load with explicit env file to pick up changes
        self._settings = Settings(_env_file=env_file_path)

        return self._settings

    def _force_reload_env_vars(self, env_file_path: str) -> None:
        """Force reload environment variables from .env file into os.environ"""
        import os
        from pathlib import Path

        try:
            env_path = Path(env_file_path)
            if not env_path.exists():
                return

            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()

                    # Skip empty lines and comments
                    if not line or line.startswith('#'):
                        continue

                    # Parse key=value lines
                    if '=' not in line:
                        continue

                    try:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip().strip('"\'')  # Remove surrounding quotes

                        # Update os.environ (this forces reload)
                        os.environ[key] = value

                    except ValueError:
                        continue

        except Exception:
            # Don't let environment loading errors break the application
            pass

    @property
    def settings(self) -> Settings:
        """Get current settings (load if not already loaded)"""
        if self._settings is None:
            self._settings = self.load_settings()
        return self._settings

    def validate_api_keys(self) -> Dict[str, bool]:
        """Validate that required API keys are present"""
        validation_results = {}

        # Check Claude API key
        validation_results["claude"] = bool(self.settings.claude_api_key and
                                            len(self.settings.claude_api_key.strip()) > 10)

        # Check LinkPreview API key (optional)
        validation_results["linkpreview"] = (
                not self.settings.enable_link_enrichment or
                bool(self.settings.linkpreview_api_key and len(self.settings.linkpreview_api_key.strip()) > 5)
        )

        # Check email credentials
        validation_results["email"] = bool(
            self.settings.email_username and
            self.settings.email_password and
            len(self.settings.email_password.strip()) > 5
        )

        return validation_results

    def get_missing_requirements(self) -> List[str]:
        """Get list of missing configuration requirements"""
        validation = self.validate_api_keys()
        missing = []

        if not validation["claude"]:
            missing.append("CLAUDE_API_KEY")

        if not validation["email"]:
            missing.extend(["EMAIL_USERNAME", "EMAIL_PASSWORD"])

        if self.settings.enable_link_enrichment and not validation["linkpreview"]:
            missing.append("LINKPREVIEW_API_KEY")

        return missing

    def is_fully_configured(self) -> bool:
        """Check if application is fully configured"""
        return len(self.get_missing_requirements()) == 0


# Global configuration manager instance
config_manager = ConfigManager()


def get_settings() -> Settings:
    """Get application settings"""
    return config_manager.settings