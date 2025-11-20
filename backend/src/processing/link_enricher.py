#!/usr/bin/env python3
"""
Link enricher module for Research Automation
Enhanced version with async support and improved caching

This module handles enriching links with metadata from LinkPreviewAPI
and implements caching to minimize API usage while improving link quality.
"""

import asyncio
import json
import time
from typing import List, Dict, Any, Optional
from pathlib import Path
from urllib.parse import urlparse
import datetime
import re

import httpx

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)


class LinkEnricher:
    """
    A class for enriching links with metadata from LinkPreviewAPI.

    This class provides methods to improve link titles and descriptions
    using the LinkPreviewAPI service with local caching to minimize API calls.
    """

    def __init__(self, api_key: Optional[str] = None, cache_path: Optional[Path] = None):
        """
        Initialize the link enricher with optional API key and cache.

        Args:
            api_key (str, optional): API key for LinkPreviewAPI. If None, will get from settings.
            cache_path (Path, optional): Path to store the cache. If None, uses default path.
        """
        self.settings = get_settings()

        # Get API key from settings if not provided
        self.api_key = api_key or self.settings.linkpreview_api_key

        # Setup cache
        self.cache_path = cache_path or (self.settings.cache_dir / "link_cache.json")
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache = self._load_cache()

        # Track API usage to stay within limits
        self.hour_requests = 0
        self.last_request_hour = datetime.datetime.now().hour
        self.rate_limit_per_hour = 60  # Free tier limit

    def _load_cache(self) -> Dict[str, Any]:
        """Load the link preview cache from disk."""
        try:
            if self.cache_path.exists():
                with open(self.cache_path, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.warning(f"Error loading link cache: {e}")
            return {}

    def _save_cache(self):
        """Save the link preview cache to disk."""
        try:
            with open(self.cache_path, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving link cache: {e}")

    def prioritize_links(self, links: List[Dict[str, Any]], source_type: str = "newsletter") -> List[Dict[str, Any]]:
        """
        Prioritize which links should be enriched based on source type.

        Args:
            links (list): List of link dictionaries
            source_type (str): Type of source ("newsletter" or "podcast")

        Returns:
            list: Prioritized and filtered list of links
        """
        high_priority = []
        medium_priority = []
        low_priority = []

        for link in links:
            url = link['url']
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            path = parsed.path.lower()

            # Skip obvious admin/utility links
            if re.search(r'/(unsubscribe|login|signup|account|profile|subscribe|email-preferences)($|/)', path):
                continue

            # Skip tracking and image links
            if re.search(r'\.(gif|jpe?g|png|svg)($|\?)', path) or '/track/' in path or '/pixel/' in path:
                continue

            # Skip common newsletter infrastructure
            if any(d in domain for d in ['passport.online', 'mailchimp.com', 'list-manage.com']):
                continue

            # High priority: Likely substantive content
            if (re.search(r'/(article|post|blog|news|story|report|research)/', path) or
                    'arxiv.org' in domain or
                    'github.com' in domain or
                    '.gov' in domain or
                    '.edu' in domain):
                high_priority.append(link)

            # Medium priority: Might be substantive
            elif (len(path.split('/')) >= 3 or
                  any(d in domain for d in ['wsj.com', 'nytimes.com', 'bloomberg.com', 'reuters.com'])):
                medium_priority.append(link)

            # Low priority: Everything else that wasn't filtered
            else:
                low_priority.append(link)

        # Return with high priority first, then medium, then low
        return high_priority + medium_priority + low_priority

    async def enrich_links(self, links: List[Dict[str, Any]], max_links: int = 20) -> List[Dict[str, Any]]:
        """
        Enrich links with metadata from LinkPreviewAPI.

        Args:
            links (list): List of link dictionaries
            max_links (int): Maximum number of links to enrich

        Returns:
            list: List of enriched link dictionaries
        """
        if not self.api_key:
            logger.info("No LinkPreview API key available. Skipping enrichment.")
            return links

        # Reset API usage counter if we're in a new hour
        current_hour = datetime.datetime.now().hour
        if current_hour != self.last_request_hour:
            self.hour_requests = 0
            self.last_request_hour = current_hour

        # Skip if we're at the API limit
        if self.hour_requests >= self.rate_limit_per_hour:
            logger.warning("LinkPreview API hourly limit reached. Skipping further enrichment.")
            return links

        enriched_links = []
        api_calls = 0

        # Process prioritized links up to max_links limit
        for link in links[:max_links]:
            url = link['url']
            cache_key = url

            # Check if we already have this URL in cache
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]

                # Check if cache entry is still valid (less than 30 days old)
                try:
                    cache_date = datetime.datetime.fromisoformat(cached_data.get('date_fetched', '2000-01-01'))
                    cache_age = (datetime.datetime.now() - cache_date).days

                    if cache_age < 30:
                        # Update link with cached data
                        if 'title' in cached_data and cached_data['title']:
                            link['title'] = cached_data['title']
                        if 'description' in cached_data:
                            link['description'] = cached_data['description']
                        enriched_links.append(link)
                        continue
                except ValueError:
                    # Invalid date format in cache, proceed with API call
                    pass

            # Skip API call if we're near limit
            if self.hour_requests + api_calls >= self.rate_limit_per_hour:
                enriched_links.append(link)
                continue

            # Call API for this link
            try:
                logger.debug(f"Enriching link: {url}")
                enriched_link = await self._enrich_single_link(link)
                enriched_links.append(enriched_link)
                api_calls += 1

                # Brief pause to be nice to the API
                await asyncio.sleep(1)

            except Exception as e:
                logger.warning(f"Error enriching link {url}: {e}")
                enriched_links.append(link)  # Keep original link

        # Update API usage counter
        self.hour_requests += api_calls

        # Save updated cache
        if api_calls > 0:
            self._save_cache()
            logger.info(f"Enriched {api_calls} links, {self.hour_requests} API calls used this hour")

        return enriched_links

    async def _enrich_single_link(self, link: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a single link with metadata from LinkPreviewAPI.

        Args:
            link: Link dictionary with 'url' and 'title' keys

        Returns:
            Enhanced link dictionary
        """
        url = link['url']

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://api.linkpreview.net",
                    params={
                        "key": self.api_key,
                        "q": url
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()

                    # Update link with API data
                    enhanced_link = link.copy()

                    if 'title' in data and data['title'] and len(data['title'].strip()) > 0:
                        enhanced_link['title'] = data['title'].strip()

                    if 'description' in data and data['description']:
                        enhanced_link['description'] = data['description'].strip()

                    if 'image' in data and data['image']:
                        enhanced_link['image_url'] = data['image']

                    # Cache the result
                    self.cache[url] = {
                        'title': data.get('title', '').strip(),
                        'description': data.get('description', '').strip(),
                        'image': data.get('image', ''),
                        'date_fetched': datetime.datetime.now().isoformat()
                    }

                    return enhanced_link

                else:
                    logger.warning(f"LinkPreview API error for {url}: {response.status_code}")
                    return link

            except httpx.TimeoutException:
                logger.warning(f"LinkPreview API timeout for {url}")
                return link
            except Exception as e:
                logger.warning(f"LinkPreview API error for {url}: {e}")
                return link

    async def test_api(self) -> bool:
        """
        Test the LinkPreview API connection.

        Returns:
            bool: True if API is working, False otherwise
        """
        if not self.api_key:
            return False

        test_url = "https://example.com"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.linkpreview.net",
                    params={
                        "key": self.api_key,
                        "q": test_url
                    },
                    timeout=5.0
                )

                if response.status_code == 200:
                    logger.info("LinkPreview API test successful")
                    return True
                else:
                    logger.error(f"LinkPreview API test failed: {response.status_code}")
                    return False

        except Exception as e:
            logger.error(f"LinkPreview API test failed: {e}")
            return False

    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        cache_size = len(self.cache)

        # Calculate cache age distribution
        now = datetime.datetime.now()
        age_distribution = {"recent": 0, "week": 0, "month": 0, "old": 0}

        for cached_item in self.cache.values():
            try:
                cache_date = datetime.datetime.fromisoformat(cached_item.get('date_fetched', '2000-01-01'))
                age_days = (now - cache_date).days

                if age_days <= 1:
                    age_distribution["recent"] += 1
                elif age_days <= 7:
                    age_distribution["week"] += 1
                elif age_days <= 30:
                    age_distribution["month"] += 1
                else:
                    age_distribution["old"] += 1
            except ValueError:
                age_distribution["old"] += 1

        return {
            "total_entries": cache_size,
            "api_calls_this_hour": self.hour_requests,
            "hourly_limit": self.rate_limit_per_hour,
            "cache_file": str(self.cache_path),
            "age_distribution": age_distribution
        }

    def clear_old_cache_entries(self, max_age_days: int = 60):
        """
        Clear cache entries older than specified days.

        Args:
            max_age_days: Maximum age in days for cache entries
        """
        now = datetime.datetime.now()
        initial_count = len(self.cache)

        keys_to_remove = []
        for key, cached_item in self.cache.items():
            try:
                cache_date = datetime.datetime.fromisoformat(cached_item.get('date_fetched', '2000-01-01'))
                age_days = (now - cache_date).days

                if age_days > max_age_days:
                    keys_to_remove.append(key)
            except ValueError:
                # Invalid date format, remove entry
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self.cache[key]

        removed_count = len(keys_to_remove)
        if removed_count > 0:
            self._save_cache()
            logger.info(f"Removed {removed_count} old cache entries (older than {max_age_days} days)")

        return removed_count