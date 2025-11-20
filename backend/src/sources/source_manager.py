#!/usr/bin/env python3
"""
Source manager for Research Automation
Manages different content sources in a plugin-style architecture
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Type
from ..core.logging import get_logger
from ..core.config import get_settings
from .base_plugin import BaseSourcePlugin, SourcePluginError

logger = get_logger(__name__)


class SourceManager:
    """
    Manages different content sources using a plugin architecture.

    Handles plugin registration, source configuration, and content fetching
    from all configured sources.
    """

    def __init__(self):
        """Initialize the source manager"""
        self.settings = get_settings()
        self.registered_plugins: Dict[str, Type[BaseSourcePlugin]] = {}
        self.configured_sources: Dict[str, Dict[str, Any]] = {}

        # Initialize
        self._load_default_plugins()
        self._load_source_configurations()

    def _load_default_plugins(self):
        """
        Register default plugin types.
        Now loads actual implemented plugins instead of placeholders.
        """
        logger.info("Registering implemented plugin types")

        try:
            from .plugins import AVAILABLE_PLUGINS

            # Register all available plugins
            for plugin_type, plugin_class in AVAILABLE_PLUGINS.items():
                success = self.register_plugin(plugin_type, plugin_class)
                if success:
                    logger.info(f"Registered {plugin_type} plugin: {plugin_class.__name__}")
                else:
                    logger.warning(f"Failed to register {plugin_type} plugin")

            # Log summary
            registered_count = len(self.registered_plugins)
            available_count = len(AVAILABLE_PLUGINS)

            if registered_count == available_count:
                logger.info(f"Successfully registered all {registered_count} available plugins")
            else:
                logger.warning(f"Registered {registered_count}/{available_count} plugins")

        except ImportError as e:
            logger.error(f"Failed to import plugins module: {e}")
            logger.info("Plugin system will not be functional until plugins are properly implemented")

        except Exception as e:
            logger.error(f"Error loading default plugins: {e}")

        # Fallback message if no plugins registered
        if not self.registered_plugins:
            logger.warning("No plugins registered - will fallback to legacy clients")

    def _load_source_configurations(self):
        """
        Load source configurations from file.
        Creates default configuration if none exists.
        """
        sources_config_path = self.settings.data_dir / "config" / "sources.json"

        try:
            if sources_config_path.exists():
                with open(sources_config_path, 'r') as f:
                    self.configured_sources = json.load(f)
                logger.info(f"Loaded {len(self.configured_sources)} source configurations")
            else:
                # Create default configuration
                self._create_default_source_config()
                logger.info("Created default source configuration")

        except Exception as e:
            logger.error(f"Error loading source configurations: {e}")
            self._create_default_source_config()

        self._migrate_rss_meta_source()

    def _create_default_source_config(self):
        """
        Create default source configuration that mirrors current setup.
        This ensures backward compatibility with existing email/RSS setup.
        """
        default_config = {
            "default_email": {
                "type": "email",
                "enabled": True,
                "name": "Default Email Source",
                "config": {
                    "server": "${EMAIL_SERVER}",
                    "username": "${EMAIL_USERNAME}",
                    "password": "${EMAIL_PASSWORD}",
                    "folder": "${EMAIL_FOLDER}",
                    "smtp_server": "${SMTP_SERVER}",
                    "smtp_port": "${SMTP_PORT}",
                    "notification_email": "${NOTIFICATION_EMAIL}"
                }
            },
            "default_rss": {
                "type": "rss",
                "enabled": True,
                "name": "Default RSS Sources",
                "config": {
                    "use_rss_feeds_config": True,
                    "config_file": "rss_feeds.json"
                }
            }
        }

        self.configured_sources = default_config
        self._save_source_configurations()

    def _save_source_configurations(self):
        """Save current source configurations to file"""
        sources_config_path = self.settings.data_dir / "config" / "sources.json"

        try:
            # Ensure config directory exists
            sources_config_path.parent.mkdir(parents=True, exist_ok=True)

            # Save the configuration
            with open(sources_config_path, 'w') as f:
                json.dump(self.configured_sources, f, indent=2)

            logger.info(f"Saved {len(self.configured_sources)} source configurations to {sources_config_path}")

        except Exception as e:
            logger.error(f"Error saving source configurations to {sources_config_path}: {e}")
            raise  # Re-raise so API calls fail instead of silently succeeding

    def _migrate_rss_meta_source(self):
        """Convert RSS meta-source to individual feed sources"""
        if "default_rss" not in self.configured_sources:
            return  # Nothing to migrate

        logger.info("Migrating RSS meta-source to individual RSS sources")

        # Load existing RSS feeds from file
        rss_feeds = self._load_existing_rss_feeds()

        if not rss_feeds:
            logger.info("No RSS feeds found to migrate")
            # Remove the meta-source anyway since it has no feeds
            del self.configured_sources["default_rss"]
            self._save_source_configurations()
            return

        # Create individual sources for each RSS feed
        migrated_count = 0
        for feed_id, feed_config in rss_feeds.items():
            source_id = f"rss_{feed_id}"

            # Skip if this source already exists (avoid duplicates)
            if source_id in self.configured_sources:
                logger.info(f"RSS source {source_id} already exists, skipping")
                continue

            success = self.add_source(
                source_id=source_id,
                source_type="rss",
                config={
                    "rss_url": feed_config['rss_url'],
                    "episodes_to_fetch": feed_config.get('episodes_to_fetch', 1)
                },
                name=feed_config.get('name', f"RSS Feed {feed_id}"),
                enabled=True
            )

            if success:
                migrated_count += 1
                logger.info(f"Migrated RSS feed: {feed_config.get('name', feed_id)}")

        # Remove legacy meta-source
        del self.configured_sources["default_rss"]
        self._save_source_configurations()

        logger.info(f"RSS meta-source migration completed: {migrated_count} feeds migrated")

    def _load_existing_rss_feeds(self) -> Dict[str, Dict[str, Any]]:
        """Load RSS feeds from existing rss_feeds.json file"""
        try:
            # Look for rss_feeds.json in config directory
            rss_feeds_path = self.settings.data_dir / "config" / "rss_feeds.json"

            if rss_feeds_path.exists():
                with open(rss_feeds_path, 'r') as f:
                    rss_feeds = json.load(f)
                    logger.info(f"Found {len(rss_feeds)} RSS feeds in rss_feeds.json")
                    return rss_feeds
            else:
                logger.info("No rss_feeds.json file found - no RSS feeds to migrate")
                return {}

        except Exception as e:
            logger.warning(f"Could not load RSS feeds for migration: {e}")
            return {}

    def register_plugin(self, plugin_type: str, plugin_class: Type[BaseSourcePlugin]) -> bool:
        """
        Register a new source plugin type.

        Args:
            plugin_type: Type identifier (e.g., 'email', 'rss', 'web')
            plugin_class: Class that implements BaseSourcePlugin

        Returns:
            True if registration successful
        """
        if not issubclass(plugin_class, BaseSourcePlugin):
            logger.error(f"Plugin class {plugin_class} must inherit from BaseSourcePlugin")
            return False

        self.registered_plugins[plugin_type] = plugin_class
        logger.info(f"Registered plugin type: {plugin_type}")
        return True

    def get_available_plugin_types(self) -> List[str]:
        """Get list of registered plugin types"""
        return list(self.registered_plugins.keys())

    def get_configured_sources(self) -> Dict[str, Dict[str, Any]]:
        """Get all configured sources with resolved environment variables"""
        resolved_sources = {}

        for source_id, source_config in self.configured_sources.items():
            resolved_config = source_config.copy()
            # Resolve environment variables in the config
            resolved_config['config'] = self._resolve_config_variables(source_config['config'])
            resolved_sources[source_id] = resolved_config

        return resolved_sources

    def add_source(self, source_id: str, source_type: str, config: Dict[str, Any],
                   name: str = None, enabled: bool = True) -> bool:
        """
        Add a new source configuration.

        Args:
            source_id: Unique identifier for this source
            source_type: Type of source plugin
            config: Source-specific configuration
            name: Human-readable name
            enabled: Whether source is enabled

        Returns:
            True if added successfully
        """
        if source_type not in self.registered_plugins:
            logger.warning(f"Unknown plugin type: {source_type}")
            return False

        # Validate configuration
        plugin_class = self.registered_plugins[source_type]
        temp_plugin = plugin_class(source_id, config)
        validation = temp_plugin.validate_config(config)

        if not validation.get('valid', False):
            logger.error(f"Invalid configuration for {source_id}: {validation.get('errors', [])}")
            return False

        self.configured_sources[source_id] = {
            "type": source_type,
            "enabled": enabled,
            "name": name or f"{source_type.title()} Source",
            "config": config
        }

        self._save_source_configurations()
        logger.info(f"Added source {source_id} of type {source_type}")
        return True

    def remove_source(self, source_id: str) -> bool:
        """Remove a source configuration"""
        if source_id in self.configured_sources:
            del self.configured_sources[source_id]
            self._save_source_configurations()
            logger.info(f"Removed source {source_id}")
            return True
        else:
            logger.warning(f"Source {source_id} not found")
            return False

    async def fetch_from_all_sources(self) -> List[Dict[str, Any]]:
        """
        Fetch content from all enabled sources.

        This is the main method that ProcessingEngine will call.

        Returns:
            List of content items from all sources
        """
        all_content = []

        logger.info(f"Fetching content from {len(self.configured_sources)} configured sources")

        for source_id, source_config in self.configured_sources.items():
            # Skip disabled sources
            if not source_config.get('enabled', True):
                logger.info(f"Skipping disabled source: {source_id}")
                continue

            try:
                content = await self._fetch_from_source(source_id, source_config)

                # Add source metadata to each content item
                for item in content:
                    item['source_id'] = source_id
                    item['source_type'] = source_config['type']
                    if 'source' not in item:
                        item['source'] = source_config.get('name', source_id)

                all_content.extend(content)
                logger.info(f"Fetched {len(content)} items from {source_id}")

            except Exception as e:
                logger.error(f"Error fetching from {source_id}: {e}")
                continue

        logger.info(f"Total content items fetched: {len(all_content)}")
        return all_content

    async def _fetch_from_source(self, source_id: str, source_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Fetch content from a single source.

        Args:
            source_id: Source identifier
            source_config: Source configuration

        Returns:
            List of content items from this source
        """
        source_type = source_config['type']

        if source_type not in self.registered_plugins:
            raise SourcePluginError(f"Unknown plugin type: {source_type}", source_id, source_type)

        plugin_class = self.registered_plugins[source_type]
        plugin = plugin_class(source_id, source_config['config'])

        return await plugin.fetch_content()

    async def test_source(self, source_id: str) -> Dict[str, Any]:
        """
        Test connection to a specific source.

        Args:
            source_id: Source identifier

        Returns:
            Test result dictionary
        """
        if source_id not in self.configured_sources:
            return {
                'success': False,
                'error': f'Source {source_id} not found'
            }

        source_config = self.configured_sources[source_id]
        source_type = source_config['type']

        try:
            if source_type not in self.registered_plugins:
                return {
                    'success': False,
                    'error': f'Plugin type {source_type} not registered'
                }

            plugin_class = self.registered_plugins[source_type]
            plugin = plugin_class(source_id, source_config['config'])

            result = await plugin.test_connection()
            logger.info(f"Test result for {source_id}: {result}")
            return result

        except Exception as e:
            logger.error(f"Error testing source {source_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_source_info(self, source_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a source"""
        if source_id not in self.configured_sources:
            return None

        source_config = self.configured_sources[source_id]

        return {
            'source_id': source_id,
            'type': source_config['type'],
            'enabled': source_config.get('enabled', True),
            'name': source_config.get('name', source_id),
            'config_keys': list(source_config.get('config', {}).keys()),
            'plugin_available': source_config['type'] in self.registered_plugins
        }

    def _resolve_config_variables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve environment variable references in configuration.

        Args:
            config: Configuration dict that may contain ${VAR_NAME} references

        Returns:
            Configuration with variables resolved
        """
        resolved_config = {}

        for key, value in config.items():
            if isinstance(value, str) and value.startswith('${') and value.endswith('}'):
                # Extract variable name
                var_name = value[2:-1]
                # Get from environment or settings
                resolved_value = getattr(self.settings, var_name.lower(), None)
                if resolved_value is None:
                    resolved_value = os.getenv(var_name, value)  # Keep original if not found
                resolved_config[key] = resolved_value
            elif isinstance(value, dict):
                resolved_config[key] = self._resolve_config_variables(value)
            else:
                resolved_config[key] = value

        return resolved_config
