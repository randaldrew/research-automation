#!/usr/bin/env python3
"""
RSS Source Plugin for Research Automation
Wraps the existing RSSClient to work with the plugin architecture
"""

from typing import Dict, Any, List
from ..base_plugin import BaseSourcePlugin, SourcePluginError
from ..rss_client import RSSClient
from ...core.logging import get_logger

logger = get_logger(__name__)


class RSSSourcePlugin(BaseSourcePlugin):
    """
    RSS source plugin that wraps the existing RSSClient.

    This maintains backward compatibility while providing the plugin interface.
    Can handle both single RSS feeds and collections of feeds.
    """

    def __init__(self, source_id: str, config: Dict[str, Any]):
        """
        Initialize RSS plugin.

        Args:
            source_id: Unique identifier for this RSS source
            config: RSS configuration dict
        """
        super().__init__(source_id, config)

        # Create RSSClient instance
        self.rss_client = RSSClient()

        # Apply configuration to RSS client
        self._apply_config_to_client()

    def _apply_config_to_client(self):
        """Apply plugin configuration to the RSSClient instance"""
        try:
            if self.config.get('use_rss_feeds_config', False):
                # Use existing rss_feeds.json configuration (backward compatibility)
                self.logger.debug(f"Using existing RSS feeds config for {self.source_id}")
                return

            # Handle individual RSS feeds or collections
            if 'feeds' in self.config:
                # Multiple feeds configuration
                for feed_id, feed_config in self.config['feeds'].items():
                    success = self.rss_client.add_feed(feed_id, feed_config)
                    if success:
                        self.logger.debug(f"Added RSS feed {feed_id} to {self.source_id}")
                    else:
                        self.logger.warning(f"Failed to add RSS feed {feed_id}")

            elif 'rss_url' in self.config:
                # Single feed configuration
                feed_config = {
                    'name': self.config.get('name', self.source_id),
                    'rss_url': self.config['rss_url'],
                    'episodes_to_fetch': self.config.get('episodes_to_fetch', 1)
                }

                success = self.rss_client.add_feed(self.source_id, feed_config)
                if success:
                    self.logger.debug(f"Added single RSS feed to {self.source_id}")
                else:
                    self.logger.warning(f"Failed to add RSS feed for {self.source_id}")

        except Exception as e:
            self.logger.warning(f"Could not apply RSS config to client: {e}")
            # Continue anyway - RSSClient will use its defaults

    async def fetch_content(self) -> List[Dict[str, Any]]:
        """
        Fetch RSS episodes using the existing RSSClient.

        Returns:
            List of RSS episode content items
        """
        try:
            self.logger.info(f"Fetching RSS content from {self.source_id}")

            # Use existing RSSClient functionality
            rss_items = await self.rss_client.fetch_new_episodes()

            # Ensure each item has proper source metadata
            for item in rss_items:
                # Only override if source is missing or empty
                if 'source' not in item or not item['source']:
                    item['source'] = self.config.get('name', self.source_id)
                item['source_type'] = 'rss'

                # Add plugin-specific metadata
                if 'metadata' not in item:
                    item['metadata'] = {}
                item['metadata']['plugin_source_id'] = self.source_id

                # Add RSS-specific metadata
                if 'feed_info' not in item['metadata']:
                    item['metadata']['feed_info'] = {
                        'episodes_to_fetch': self.config.get('episodes_to_fetch', 1),
                        'config_type': 'plugin'
                    }

            self.logger.info(f"Fetched {len(rss_items)} RSS episodes from {self.source_id}")
            return rss_items

        except Exception as e:
            error_msg = f"Failed to fetch RSS content from {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            raise SourcePluginError(error_msg, self.source_id, 'rss')

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test RSS feeds by attempting to fetch feed information.

        Returns:
            Test result dictionary
        """
        try:
            self.logger.info(f"Testing RSS connection for {self.source_id}")

            # Test based on configuration type
            if self.config.get('use_rss_feeds_config', False):
                # Test existing RSS feeds configuration
                configured_feeds = self.rss_client.get_configured_feeds()

                if not configured_feeds:
                    return {
                        'success': False,
                        'error': 'No RSS feeds configured',
                        'details': {'source_id': self.source_id}
                    }

                # Test a sample feed
                sample_feed = next(iter(configured_feeds.values()))
                test_result = await self.rss_client.test_feed(sample_feed['rss_url'])

                return {
                    'success': test_result.get('success', False),
                    'message': f'RSS feeds test for {self.source_id}',
                    'details': {
                        'feeds_count': len(configured_feeds),
                        'sample_feed': sample_feed.get('name', 'Unknown'),
                        'test_result': test_result,
                        'source_id': self.source_id
                    }
                }

            elif 'rss_url' in self.config:
                # Test single RSS feed
                test_result = await self.rss_client.test_feed(self.config['rss_url'])

                return {
                    'success': test_result.get('success', False),
                    'message': f'RSS feed test for {self.source_id}',
                    'details': {
                        'feed_url': self.config['rss_url'],
                        'feed_title': test_result.get('feed_title', 'Unknown'),
                        'episodes_count': test_result.get('episodes_count', 0),
                        'source_id': self.source_id
                    }
                }

            elif 'feeds' in self.config:
                # Test multiple feeds
                test_results = {}
                overall_success = True

                for feed_id, feed_config in self.config['feeds'].items():
                    if 'rss_url' in feed_config:
                        result = await self.rss_client.test_feed(feed_config['rss_url'])
                        test_results[feed_id] = result
                        if not result.get('success', False):
                            overall_success = False

                return {
                    'success': overall_success,
                    'message': f'Multiple RSS feeds test for {self.source_id}',
                    'details': {
                        'feeds_tested': len(test_results),
                        'test_results': test_results,
                        'source_id': self.source_id
                    }
                }

            else:
                return {
                    'success': False,
                    'error': 'No RSS configuration found',
                    'details': {'source_id': self.source_id}
                }

        except Exception as e:
            error_msg = f"RSS connection test failed for {self.source_id}: {str(e)}"
            self.logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'details': {'source_id': self.source_id}
            }

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate RSS configuration.

        Args:
            config: Configuration to validate

        Returns:
            Validation result
        """
        errors = []
        warnings = []

        # Check for configuration type
        if config.get('use_rss_feeds_config', False):
            # Using existing rss_feeds.json configuration
            if 'config_file' not in config:
                warnings.append("Using RSS feeds config but no config file specified")

            return {
                'valid': True,
                'errors': errors,
                'warnings': warnings
            }

        # Single RSS feed configuration
        elif 'rss_url' in config:
            if not config['rss_url']:
                errors.append("RSS URL cannot be empty")
            elif not config['rss_url'].startswith(('http://', 'https://')):
                errors.append("RSS URL must start with http:// or https://")

            # Validate episodes_to_fetch
            episodes = config.get('episodes_to_fetch', 1)
            if not isinstance(episodes, int) or episodes < 1:
                errors.append("episodes_to_fetch must be a positive integer")
            elif episodes > 10:
                warnings.append("episodes_to_fetch > 10 may slow down processing")

        # Multiple feeds configuration
        elif 'feeds' in config:
            if not isinstance(config['feeds'], dict):
                errors.append("feeds must be a dictionary")
            elif len(config['feeds']) == 0:
                errors.append("feeds dictionary cannot be empty")
            else:
                # Validate each feed
                for feed_id, feed_config in config['feeds'].items():
                    if not isinstance(feed_config, dict):
                        errors.append(f"Feed {feed_id} configuration must be a dictionary")
                        continue

                    if 'rss_url' not in feed_config:
                        errors.append(f"Feed {feed_id} missing rss_url")
                    elif not feed_config['rss_url'].startswith(('http://', 'https://')):
                        errors.append(f"Feed {feed_id} RSS URL must start with http:// or https://")

                    if 'name' not in feed_config:
                        warnings.append(f"Feed {feed_id} missing name, will use feed_id")

        else:
            errors.append("Must specify either 'use_rss_feeds_config', 'rss_url', or 'feeds'")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    def get_source_info(self) -> Dict[str, Any]:
        """Get detailed information about this RSS source"""
        base_info = super().get_source_info()

        # Add RSS-specific information
        if self.config.get('use_rss_feeds_config', False):
            base_info.update({
                'configuration_type': 'legacy_rss_feeds_json',
                'config_file': self.config.get('config_file', 'rss_feeds.json'),
                'feeds_count': len(self.rss_client.get_configured_feeds())
            })
        elif 'rss_url' in self.config:
            base_info.update({
                'configuration_type': 'single_feed',
                'feed_url': self.config['rss_url'],
                'episodes_to_fetch': self.config.get('episodes_to_fetch', 1)
            })
        elif 'feeds' in self.config:
            base_info.update({
                'configuration_type': 'multiple_feeds',
                'feeds_count': len(self.config['feeds']),
                'feed_names': list(self.config['feeds'].keys())
            })

        return base_info

    def get_config_schema(self) -> Dict[str, Any]:
        """Get RSS plugin configuration schema"""
        return {
            'type': 'object',
            'properties': {
                'rss_url': {
                    'type': 'string',
                    'title': 'RSS Feed URL',
                    'description': 'URL of the RSS feed',
                    'format': 'uri',
                    'examples': ['https://example.com/feed.xml']
                },
                'episodes_to_fetch': {
                    'type': 'integer',
                    'title': 'Episodes to Fetch',
                    'description': 'Number of recent episodes to fetch',
                    'default': 1,
                    'minimum': 1,
                    'maximum': 10
                }
            },
            'required': ['rss_url']
        }

    def get_config_template(self) -> Dict[str, Any]:
        """
        Get configuration templates for different RSS configuration types.
        """
        return {
            'single_feed': {
                'rss_url': {
                    'type': 'url',
                    'required': True,
                    'description': 'RSS feed URL',
                    'example': 'https://example.com/feed.xml'
                },
                'episodes_to_fetch': {
                    'type': 'integer',
                    'required': False,
                    'description': 'Number of recent episodes to fetch',
                    'default': 1,
                    'min': 1,
                    'max': 10
                }
            },
            'multiple_feeds': {
                'feeds': {
                    'type': 'object',
                    'required': True,
                    'description': 'Dictionary of feed configurations',
                    'example': {
                        'my_podcast': {
                            'name': 'My Podcast',
                            'rss_url': 'https://example.com/feed.xml',
                            'episodes_to_fetch': 2
                        }
                    }
                }
            },
            'legacy_compatibility': {
                'use_rss_feeds_config': {
                    'type': 'boolean',
                    'required': False,
                    'description': 'Use existing rss_feeds.json configuration',
                    'default': False
                },
                'config_file': {
                    'type': 'string',
                    'required': False,
                    'description': 'RSS feeds configuration file name',
                    'default': 'rss_feeds.json'
                }
            }
        }

    async def get_feed_info(self, feed_url: str) -> Dict[str, Any]:
        """
        Get information about a specific RSS feed.
        Utility method for testing and validation.

        Args:
            feed_url: URL of the RSS feed

        Returns:
            Feed information dictionary
        """
        try:
            return await self.rss_client.get_feed_info(feed_url)
        except Exception as e:
            self.logger.error(f"Error getting feed info for {feed_url}: {e}")
            return {"error": str(e)}