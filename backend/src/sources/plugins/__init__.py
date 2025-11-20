#!/usr/bin/env python3
"""
Source plugins for Research Automation

This module contains all source plugins that implement the BaseSourcePlugin interface.
All plugins are now implemented and ready for use.
"""

from .email_plugin import EmailSourcePlugin
from .rss_plugin import RSSSourcePlugin
from .web_plugin import WebSourcePlugin

# Plugin registry for easy discovery
AVAILABLE_PLUGINS = {
    'email': EmailSourcePlugin,
    'rss': RSSSourcePlugin,
    'web': WebSourcePlugin
}

# Plugin metadata for UI and documentation
PLUGIN_METADATA = {
    'email': {
        'name': 'Email Source',
        'description': 'Fetch newsletters and emails via IMAP',
        'icon': '📧',
        'category': 'communication',
        'supports_test': True,
        'supports_multiple_instances': True,
        'example_config': {
            'server': 'imap.gmail.com',
            'username': 'user@gmail.com',
            'password': 'app_password',
            'folder': 'INBOX'
        }
    },
    'rss': {
        'name': 'RSS/Podcast Source',
        'description': 'Fetch episodes from RSS feeds and podcasts',
        'icon': '📡',
        'category': 'syndication',
        'supports_test': True,
        'supports_multiple_instances': True,
        'example_config': {
            'rss_url': 'https://example.com/feed.xml',
            'episodes_to_fetch': 2
        }
    },
    'web': {
        'name': 'Web Scraper',
        'description': 'Extract articles from websites using CSS selectors',
        'icon': '🌐',
        'category': 'scraping',
        'supports_test': True,
        'supports_multiple_instances': True,
        'example_config': {
            'base_url': 'https://example.com',
            'list_selector': '.article-list a',
            'title_selector': 'h1',
            'content_selector': '.content'
        }
    }
}

__all__ = [
    'EmailSourcePlugin',
    'RSSSourcePlugin',
    'WebSourcePlugin',
    'AVAILABLE_PLUGINS',
    'PLUGIN_METADATA'
]


def get_plugin_class(plugin_type: str):
    """
    Get plugin class by type name.

    Args:
        plugin_type: Plugin type identifier

    Returns:
        Plugin class or None if not found
    """
    return AVAILABLE_PLUGINS.get(plugin_type)


def get_available_plugin_types() -> list:
    """Get list of available plugin types"""
    return list(AVAILABLE_PLUGINS.keys())


def get_plugin_metadata(plugin_type: str = None):
    """
    Get plugin metadata.

    Args:
        plugin_type: Specific plugin type, or None for all

    Returns:
        Plugin metadata dict or full metadata dict
    """
    if plugin_type:
        return PLUGIN_METADATA.get(plugin_type)
    return PLUGIN_METADATA


def validate_plugin_type(plugin_type: str) -> bool:
    """Check if a plugin type is valid"""
    return plugin_type in AVAILABLE_PLUGINS


def create_plugin_instance(plugin_type: str, source_id: str, config: dict):
    """
    Create a plugin instance.

    Args:
        plugin_type: Type of plugin to create
        source_id: Unique source identifier
        config: Plugin configuration

    Returns:
        Plugin instance or None if plugin type not found
    """
    plugin_class = get_plugin_class(plugin_type)
    if plugin_class:
        return plugin_class(source_id, config)
    return None