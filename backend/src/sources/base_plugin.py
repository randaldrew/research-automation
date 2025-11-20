#!/usr/bin/env python3
"""
Base plugin interface for Research Automation sources
Defines the contract that all source plugins must implement
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from ..core.logging import get_logger

logger = get_logger(__name__)


class BaseSourcePlugin(ABC):
    """
    Abstract base class for all content source plugins.

    All source plugins (email, RSS, web, etc.) must inherit from this class
    and implement the required methods.
    """

    def __init__(self, source_id: str, config: Dict[str, Any]):
        """
        Initialize the plugin with configuration.

        Args:
            source_id: Unique identifier for this source instance
            config: Configuration dictionary for this source
        """
        self.source_id = source_id
        self.config = config
        self.logger = get_logger(f"{__name__}.{self.__class__.__name__}")

    @abstractmethod
    async def fetch_content(self) -> List[Dict[str, Any]]:
        """
        Fetch new content from this source.

        Returns:
            List of content items. Each item should have this structure:
            {
                'title': str,
                'content': str,
                'url': str,
                'date': str (ISO format),
                'source': str,
                'source_type': str,
                'metadata': dict (optional)
            }
        """
        pass

    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test if this source is accessible and properly configured.

        Returns:
            Dict with 'success' bool and optional 'error' message
            {
                'success': bool,
                'message': str (optional),
                'error': str (optional),
                'details': dict (optional)
            }
        """
        pass

    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate configuration for this source type.

        Args:
            config: Configuration to validate

        Returns:
            Validation result dict:
            {
                'valid': bool,
                'errors': List[str],
                'warnings': List[str]
            }
        """
        pass

    def get_config_schema(self) -> Dict[str, Any]:
        """
        Get configuration schema for this plugin type.
        Override in subclasses for plugin-specific schemas.

        Returns:
            Configuration schema dictionary
        """
        return {
            'type': 'object',
            'properties': {},
            'required': []
        }

    def get_source_info(self) -> Dict[str, Any]:
        """
        Get information about this source instance.
        Can be overridden by plugins for additional info.

        Returns:
            Dict with source information
        """
        return {
            'source_id': self.source_id,
            'source_type': self.__class__.__name__.replace('Plugin', '').lower(),
            'config_keys': list(self.config.keys()),
            'enabled': self.config.get('enabled', True)
        }


class SourcePluginError(Exception):
    """Exception raised by source plugins"""

    def __init__(self, message: str, source_id: str, plugin_type: str):
        self.source_id = source_id
        self.plugin_type = plugin_type
        super().__init__(f"{plugin_type} plugin '{source_id}': {message}")