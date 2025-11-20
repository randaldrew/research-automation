#!/usr/bin/env python3
"""
RSS client for Research Automation
Handles RSS/podcast feed fetching and processing

Adapted from existing code with async support
"""

import asyncio
import datetime
import time
from typing import List, Dict, Any, Optional
import feedparser
import httpx

from ..core.config import get_settings
from ..core.logging import ProcessingLogger
from ..processing.content_cleaner import ContentCleaner

logger = ProcessingLogger("rss", "feeds")


class RSSClient:
    """
    RSS/Podcast feed client for fetching and processing episodes.

    Handles feed parsing, content extraction, and transcript processing.
    """

    def __init__(self):
        self.settings = get_settings()
        self.content_cleaner = ContentCleaner()

        # Default feed configurations
        self.default_feeds = {
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

    async def fetch_new_episodes(self) -> List[Dict[str, Any]]:
        """
        Fetch new podcast episodes from all configured RSS feeds.
        Now includes proper feed names for each episode.

        Returns:
            List of episode dictionaries with correct source names
        """
        all_episodes = []
        last_run_datetime = await self._get_last_run_datetime()

        for feed_id, feed_config in self.default_feeds.items():
            try:
                logger.info(f"Processing feed: {feed_config['name']}")
                episodes = await self._process_feed(feed_id, feed_config, last_run_datetime)

                for episode in episodes:
                    episode['source'] = feed_config.get('name', feed_id)
                    episode['source_type'] = 'rss'
                    episode['feed_id'] = feed_id
                    episode['rss_url'] = feed_config['rss_url']

                all_episodes.extend(episodes)

            except Exception as e:
                logger.error(f"Error processing feed {feed_id}: {e}")
                continue

        logger.info(f"Total episodes fetched: {len(all_episodes)}")
        return all_episodes

    async def _get_last_run_datetime(self) -> datetime.datetime:
        """Get the last run datetime for filtering new content."""
        # TODO: This should query the database for actual last run time
        # For now, default to 7 days ago
        return datetime.datetime.now() - datetime.timedelta(days=7)

    async def _process_feed(self, feed_id: str, feed_config: Dict[str, Any],
                            last_run_datetime: datetime.datetime) -> List[Dict[str, Any]]:
        """
        Process a single RSS feed and extract episodes.

        Args:
            feed_id: Identifier for the feed
            feed_config: Feed configuration dictionary
            last_run_datetime: Cutoff time for new episodes

        Returns:
            List of new episode dictionaries
        """
        logger.info(f"Processing RSS feed: {feed_config['name']}")

        try:
            # Fetch RSS feed
            feed_data = await self._fetch_rss_feed(feed_config["rss_url"])

            if not feed_data or not feed_data.entries:
                logger.warning(f"No episodes found for {feed_config['name']}")
                return []

            # Get the latest episodes
            episodes_to_fetch = min(feed_config["episodes_to_fetch"], len(feed_data.entries))
            all_recent_episodes = feed_data.entries[:episodes_to_fetch]

            # Filter episodes by publication date
            new_episodes = []
            for episode in all_recent_episodes:
                if hasattr(episode, 'published_parsed') and episode.published_parsed:
                    pub_date = datetime.datetime.fromtimestamp(time.mktime(episode.published_parsed))
                    if pub_date > last_run_datetime:
                        new_episodes.append(episode)

            if not new_episodes:
                logger.info(f"No new episodes for {feed_config['name']} since last run")
                return []

            logger.info(f"Found {len(new_episodes)} new episode(s) for {feed_config['name']}")

            # Process each new episode
            processed_episodes = []
            for i, episode in enumerate(new_episodes):
                try:
                    processed_episode = await self._process_episode(episode, feed_config, i)
                    if processed_episode:
                        processed_episodes.append(processed_episode)

                except Exception as e:
                    logger.error(f"Error processing episode {episode.get('title', 'unknown')}: {e}")
                    continue

            return processed_episodes

        except Exception as e:
            logger.error(f"Error processing feed {feed_id}: {e}")
            return []

    async def _fetch_rss_feed(self, rss_url: str) -> Optional[Any]:
        """
        Fetch RSS feed data using feedparser.

        Args:
            rss_url: URL of the RSS feed

        Returns:
            Parsed feed data or None if failed
        """
        try:
            # Use asyncio to run feedparser in thread pool since it's blocking
            loop = asyncio.get_event_loop()
            feed_data = await loop.run_in_executor(None, feedparser.parse, rss_url)

            if feed_data.bozo:
                logger.warning(f"RSS feed parse warning for {rss_url}: {feed_data.bozo_exception}")

            return feed_data

        except Exception as e:
            logger.error(f"Error fetching RSS feed {rss_url}: {e}")
            return None

    async def _process_episode(self, episode: Any, feed_config: Dict[str, Any],
                               episode_index: int) -> Optional[Dict[str, Any]]:
        """
        Process a single podcast episode.

        Args:
            episode: Feedparser episode object
            feed_config: Feed configuration
            episode_index: Index of episode in the batch

        Returns:
            Processed episode dictionary or None if failed
        """
        try:
            title = episode.get('title', 'Unknown Episode')

            # Parse publication date
            published_date = datetime.datetime.now().strftime("%Y-%m-%d")
            if hasattr(episode, 'published_parsed') and episode.published_parsed:
                published_date = datetime.datetime.fromtimestamp(
                    time.mktime(episode.published_parsed)
                ).strftime("%Y-%m-%d")

            # Extract content from episode
            content = await self._extract_episode_content(episode)

            if not content:
                logger.warning(f"No content found for episode: {title}")
                return None

            # Clean content for processing
            cleaned_content = self.content_cleaner.clean_email_content(content)

            # Create unique source identifier
            source_id = f"{feed_config['name'].lower().replace(' ', '_')}_episode_{episode_index + 1}"

            episode_data = {
                "id": source_id,
                "title": title,
                "source": f"{feed_config['name']} Podcast",
                "date": published_date,
                "content": cleaned_content,
                "source_type": "podcast",
                "rss_url": feed_config.get("rss_url", ""),
                "episode_url": episode.get("link", ""),
                "duration": episode.get("itunes_duration", ""),
                "author": episode.get("author", ""),
            }

            logger.info(f"Successfully processed episode: {title}")
            return episode_data

        except Exception as e:
            logger.error(f"Error processing episode: {e}")
            return None

    async def _extract_episode_content(self, episode: Any) -> str:
        """
        Extract content from podcast episode.

        Args:
            episode: Feedparser episode object

        Returns:
            Extracted content text
        """
        content = ""

        # Try to get content from description
        if hasattr(episode, 'description') and episode.description:
            content = episode.description

        # Try to get content from summary
        elif hasattr(episode, 'summary') and episode.summary:
            content = episode.summary

        # Try to get content from content field
        elif hasattr(episode, 'content') and episode.content:
            if isinstance(episode.content, list) and len(episode.content) > 0:
                content = episode.content[0].get('value', '')
            else:
                content = str(episode.content)

        # Check for transcript links
        transcript_content = await self._try_fetch_transcript(episode)
        if transcript_content:
            content = transcript_content

        # Clean HTML if present
        if content:
            content = self.content_cleaner.extract_plain_text(content)

        return content

    async def _try_fetch_transcript(self, episode: Any) -> Optional[str]:
        """
        Try to fetch transcript from episode links.

        Args:
            episode: Feedparser episode object

        Returns:
            Transcript content or None if not found
        """
        try:
            if not hasattr(episode, 'links'):
                return None

            # Look for transcript links
            for link in episode.links:
                href = link.get('href', '').lower()
                link_type = link.get('type', '').lower()

                if ('transcript' in href or 'transcript' in link_type):
                    logger.debug(f"Attempting to fetch transcript from: {link['href']}")

                    async with httpx.AsyncClient() as client:
                        response = await client.get(link['href'], timeout=10.0)
                        response.raise_for_status()

                        transcript_content = response.text
                        logger.info(f"Successfully fetched transcript ({len(transcript_content)} chars)")
                        return transcript_content

            return None

        except Exception as e:
            logger.warning(f"Error fetching transcript: {e}")
            return None

    async def test_feed(self, rss_url: str) -> Dict[str, Any]:
        """
        Test an RSS feed URL.

        Args:
            rss_url: URL to test

        Returns:
            Test results dictionary
        """
        try:
            feed_data = await self._fetch_rss_feed(rss_url)

            if not feed_data:
                return {"success": False, "error": "Failed to fetch feed"}

            if feed_data.bozo:
                return {
                    "success": False,
                    "error": f"Feed parse error: {feed_data.bozo_exception}"
                }

            episodes_count = len(feed_data.entries) if feed_data.entries else 0

            return {
                "success": True,
                "feed_title": feed_data.feed.get('title', 'Unknown'),
                "feed_description": feed_data.feed.get('description', 'No description'),
                "episodes_count": episodes_count,
                "latest_episode": {
                    "title": feed_data.entries[0].get('title', 'Unknown') if episodes_count > 0 else None,
                    "published": feed_data.entries[0].get('published', 'Unknown') if episodes_count > 0 else None
                } if episodes_count > 0 else None
            }

        except Exception as e:
            logger.error(f"Error testing RSS feed {rss_url}: {e}")
            return {"success": False, "error": str(e)}

    def get_configured_feeds(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all configured RSS feeds.

        Returns:
            Dictionary of configured feeds
        """
        return self.default_feeds.copy()

    def add_feed(self, feed_id: str, feed_config: Dict[str, Any]) -> bool:
        """
        Add a new RSS feed configuration.

        Args:
            feed_id: Unique identifier for the feed
            feed_config: Feed configuration dictionary

        Returns:
            True if added successfully
        """
        try:
            # Validate required fields
            required_fields = ['name', 'rss_url']
            for field in required_fields:
                if field not in feed_config:
                    logger.error(f"Missing required field '{field}' in feed configuration")
                    return False

            # Set defaults
            if 'episodes_to_fetch' not in feed_config:
                feed_config['episodes_to_fetch'] = 1

            self.default_feeds[feed_id] = feed_config
            logger.info(f"Added RSS feed: {feed_config['name']}")
            return True

        except Exception as e:
            logger.error(f"Error adding RSS feed {feed_id}: {e}")
            return False

    def remove_feed(self, feed_id: str) -> bool:
        """
        Remove an RSS feed configuration.

        Args:
            feed_id: Feed identifier to remove

        Returns:
            True if removed successfully
        """
        try:
            if feed_id in self.default_feeds:
                removed_feed = self.default_feeds.pop(feed_id)
                logger.info(f"Removed RSS feed: {removed_feed['name']}")
                return True
            else:
                logger.warning(f"Feed ID '{feed_id}' not found")
                return False

        except Exception as e:
            logger.error(f"Error removing RSS feed {feed_id}: {e}")
            return False

    async def get_feed_info(self, rss_url: str) -> Dict[str, Any]:
        """
        Get detailed information about an RSS feed without processing episodes.

        Args:
            rss_url: URL of the RSS feed

        Returns:
            Feed information dictionary
        """
        try:
            feed_data = await self._fetch_rss_feed(rss_url)

            if not feed_data:
                return {"error": "Failed to fetch feed"}

            if feed_data.bozo:
                return {"error": f"Feed parse error: {feed_data.bozo_exception}"}

            # Extract feed metadata
            feed_info = {
                "title": feed_data.feed.get('title', 'Unknown'),
                "description": feed_data.feed.get('description', ''),
                "link": feed_data.feed.get('link', ''),
                "language": feed_data.feed.get('language', ''),
                "last_build_date": feed_data.feed.get('updated', ''),
                "total_episodes": len(feed_data.entries),
                "recent_episodes": []
            }

            # Get info about recent episodes (up to 5)
            for episode in feed_data.entries[:5]:
                episode_info = {
                    "title": episode.get('title', 'Unknown'),
                    "published": episode.get('published', ''),
                    "duration": episode.get('itunes_duration', ''),
                    "description": episode.get('summary', '')[:200] + '...' if episode.get('summary', '') else ''
                }
                feed_info["recent_episodes"].append(episode_info)

            return feed_info

        except Exception as e:
            logger.error(f"Error getting feed info for {rss_url}: {e}")
            return {"error": str(e)}