"""
Main processing engine for Research Automation
Orchestrates the complete workflow: fetch -> process -> summarize -> export
"""

import asyncio
import datetime
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path

from ..core.config import get_settings
from ..core.logging import get_logger, ProcessingLogger
from ..sources.email_client import EmailClient
from ..sources.rss_client import RSSClient
from ..sources.source_manager import SourceManager
from ..processing.ai_summarizer import AISummarizer
from ..processing.link_extractor import LinkExtractor
from ..processing.link_enricher import LinkEnricher
from ..processing.insights_extractor import EnhancedInsightsExtractor
from ..storage.database import DatabaseManager
from ..storage.export_manager import ExportManager


logger = get_logger(__name__)


class ProcessingState:
    """Tracks the current state of processing"""

    def __init__(self):
        self.status: str = "idle"  # idle, running, completed, error
        self.current_step: str = ""
        self.progress: int = 0
        self.total_steps: int = 0
        self.start_time: Optional[datetime.datetime] = None
        self.end_time: Optional[datetime.datetime] = None
        self.error_message: Optional[str] = None
        self.results: Dict[str, Any] = {}
        self.logs: List[Dict[str, Any]] = []

    def add_log(self, level: str, message: str, **kwargs):
        """Add a log entry"""
        self.logs.append({
            "timestamp": datetime.datetime.now().isoformat(),
            "level": level,
            "message": message,
            **kwargs
        })

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "status": self.status,
            "current_step": self.current_step,
            "progress": self.progress,
            "total_steps": self.total_steps,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "error_message": self.error_message,
            "results": self.results,
            "logs": self.logs[-50:]  # Last 50 log entries
        }


class ProcessingEngine:
    """Main processing engine that orchestrates the entire workflow"""

    def __init__(self):
        self.settings = get_settings()
        self.state = ProcessingState()
        self.source_manager = SourceManager()

        # Initialize components
        self.db_manager = DatabaseManager()
        self.email_client = EmailClient()
        self.rss_client = RSSClient()
        self.ai_summarizer = AISummarizer()
        self.link_extractor = LinkExtractor()
        self.link_enricher = LinkEnricher()
        self.export_manager = ExportManager()
        self.insights_extractor = None

        # Progress tracking
        self._progress_callbacks: List[Callable[[ProcessingState], None]] = []

    def add_progress_callback(self, callback: Callable[[ProcessingState], None]):
        """Add callback for progress updates (for WebSocket updates)"""
        self._progress_callbacks.append(callback)

    def _update_progress(self, step: str, progress: int):
        """Update progress and notify callbacks"""
        self.state.current_step = step
        self.state.progress = progress

        logger.info(f"Progress update: {step} ({progress}/{self.state.total_steps})",
                    step=step, progress=progress, total_steps=self.state.total_steps)

        # Notify callbacks (WebSocket updates)
        for callback in self._progress_callbacks:
            try:
                callback(self.state)
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")

    def _add_log(self, level: str, message: str, **kwargs):
        """Add log entry and notify callbacks"""
        self.state.add_log(level, message, **kwargs)
        getattr(logger, level.lower())(message, **kwargs)

        # Notify callbacks for real-time log updates
        for callback in self._progress_callbacks:
            try:
                callback(self.state)
            except Exception as e:
                logger.warning(f"Log callback failed: {e}")

    async def run_full_processing(self) -> Dict[str, Any]:
        """
        Run the complete processing workflow

        Returns:
            Dictionary with processing results and statistics
        """
        self.state = ProcessingState()  # Reset state
        self.state.status = "running"
        self.state.start_time = datetime.datetime.now()
        self.state.total_steps = 8  # Adjust based on workflow steps
        run_id = None  # Track database run ID

        try:
            self._add_log("info", "Starting newsletter processing workflow")

            # Step 1: Initialize database
            self._update_progress("Initializing database", 1)
            db_manager = self.db_manager
            await db_manager.initialize()

            # Step 2: Fetch content from all sources
            self._update_progress("Fetching content from sources", 2)
            content_items = await self._fetch_all_content()
            self.state.results["content_fetched"] = len(content_items)

            if not content_items:
                self._add_log("warning", "No new content found to process")
                self.state.status = "completed"
                return self.state.results

            # Step 3: Extract and enrich links
            self._update_progress("Processing links", 3)
            await self._process_links(content_items)

            # Step 4: Generate summaries with AI
            self._update_progress("Generating AI summaries", 4)
            summaries = await self._generate_summaries(content_items)
            self.state.results["summaries_generated"] = len(summaries)

            # Step 5: Extract insights and questions
            self._update_progress("Extracting insights", 5)
            insights = await self._extract_insights(summaries)
            self.state.results["insights_extracted"] = len(insights)

            # Step 6: Store everything in database
            self._update_progress("Storing data", 6)
            await self._store_results(content_items, summaries, insights)

            # Step 7: Generate exports
            self._update_progress("Generating exports", 7)
            exports = await self._generate_exports(summaries)
            self.state.results["exports_generated"] = len(exports)

            # Step 8: Cleanup and finalization
            self._update_progress("Finalizing", 8)
            await self._finalize_processing()

            self.state.status = "completed"
            self.state.end_time = datetime.datetime.now()

            duration = (self.state.end_time - self.state.start_time).total_seconds()
            self._add_log("info", f"Processing completed successfully in {duration:.1f} seconds",
                          duration=duration, **self.state.results)

            # Record successful completion in database
            if run_id:
                await self.db_manager.complete_processing_run(run_id, self.state.results)

            return self.state.results


        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            self.state.end_time = datetime.datetime.now()
            self._add_log("error", f"Processing failed: {e}", error=str(e))
            logger.error("Processing workflow failed", error=str(e), exc_info=True)

            # Record failed run in database
            if run_id:
                try:
                    await self.db_manager.complete_processing_run(run_id, self.state.results, error=str(e))
                except Exception as db_error:
                    logger.error(f"Failed to record error in database: {db_error}")
            raise

    async def _fetch_all_content(self) -> List[Dict[str, Any]]:
        """
        Fetch content from all configured sources using unified SourceManager.
        Enhanced with comprehensive debugging and exception handling.
        """
        try:
            self._add_log("info", "=== DEBUG: Starting content fetch ===")

            # Debug source manager status
            if self.source_manager is None:
                self._add_log("error", "DEBUG: source_manager is None!")
                return []

            self._add_log("info", f"DEBUG: source_manager type: {type(self.source_manager)}")

            # Check configured sources - WRAP IN TRY-CATCH
            try:
                configured_sources = self.source_manager.get_configured_sources()
                self._add_log("info", f"DEBUG: Found {len(configured_sources)} configured sources")
            except Exception as e:
                self._add_log("error", f"DEBUG: Error getting configured sources: {e}")
                return []

            enabled_count = 0
            for source_id, config in configured_sources.items():
                try:
                    enabled = config.get('enabled', True)
                    source_type = config.get('type', 'unknown')
                    if enabled:
                        enabled_count += 1
                    self._add_log("info", f"DEBUG: Source {source_id} - type:{source_type}, enabled:{enabled}")
                except Exception as e:
                    self._add_log("error", f"DEBUG: Error processing source {source_id}: {e}")

            self._add_log("info", f"DEBUG: {enabled_count} sources are enabled")

            if enabled_count == 0:
                self._add_log("warning", "DEBUG: No enabled sources found!")
                return []

            # Now try to fetch content - WRAP IN TRY-CATCH
            try:
                self._add_log("info", "DEBUG: Calling source_manager.fetch_from_all_sources()")
                content_items = await self.source_manager.fetch_from_all_sources()
                self._add_log("info", f"DEBUG: Received {len(content_items)} content items")
            except Exception as e:
                self._add_log("error", f"DEBUG: Error in fetch_from_all_sources(): {e}")
                # Print full exception details
                import traceback
                self._add_log("error", f"DEBUG: Full traceback: {traceback.format_exc()}")
                return []

            if content_items:
                # Log first item structure for debugging
                try:
                    first_item = content_items[0]
                    self._add_log("info", f"DEBUG: First item keys: {list(first_item.keys())}")
                    self._add_log("info", f"DEBUG: First item source: {first_item.get('source', 'N/A')}")
                    self._add_log("info", f"DEBUG: First item title: {first_item.get('title', 'N/A')[:100]}...")
                except Exception as e:
                    self._add_log("error", f"DEBUG: Error examining content items: {e}")
            else:
                self._add_log("warning", "DEBUG: Content fetch returned empty list - no new content found")

            return content_items

        except Exception as e:
            self._add_log("error", f"DEBUG: FATAL ERROR in _fetch_all_content: {e}")
            import traceback
            self._add_log("error", f"DEBUG: Full traceback: {traceback.format_exc()}")

            # Try fallback method
            try:
                self._add_log("info", "DEBUG: Attempting fallback to legacy clients")
                return await self._fetch_via_legacy_clients()
            except Exception as fallback_error:
                self._add_log("error", f"DEBUG: Fallback also failed: {fallback_error}")
                return []

    async def _fetch_via_legacy_clients(self) -> List[Dict[str, Any]]:
        """
        Fallback method using legacy clients.
        Only used when SourceManager is not configured or fails.
        """
        content_items = []

        try:
            # Fetch emails
            self._add_log("info", "Fetching emails (legacy client)")
            email_items = await self.email_client.fetch_new_emails()
            content_items.extend(email_items)
            self._add_log("info", f"Fetched {len(email_items)} emails via legacy client")

            # Fetch RSS feeds
            self._add_log("info", "Fetching RSS feeds (legacy client)")
            rss_items = await self.rss_client.fetch_new_episodes()
            content_items.extend(rss_items)
            self._add_log("info", f"Fetched {len(rss_items)} RSS episodes via legacy client")

            # Note: No web scraping in legacy mode since WebScraper was just a stub

            self._add_log("info", f"Legacy client fallback completed: {len(content_items)} total items")
            return content_items

        except Exception as e:
            self._add_log("error", f"Legacy client fallback error: {e}")
            raise

    async def _process_links(self, content_items: List[Dict[str, Any]]):
        """Extract and enrich links from content"""
        total_links = 0

        for item in content_items:
            try:
                # Extract links from content
                links = self.link_extractor.extract_links(item.get("content", ""))

                # Enrich links if enabled
                if self.settings.enable_link_enrichment and links:
                    enriched_links = await self.link_enricher.enrich_links(
                        links[:self.settings.max_links_to_enrich]
                    )
                    item["links"] = enriched_links
                else:
                    item["links"] = links

                total_links += len(item["links"])

            except Exception as e:
                self._add_log("warning", f"Error processing links for {item.get('title', 'unknown')}: {e}")
                item["links"] = []

        self.state.results["links_processed"] = total_links

    async def _generate_summaries(self, content_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate AI summaries for content items"""
        summaries = []

        for item in content_items:
            try:
                self._add_log("info", f"Summarizing: {item.get('title', 'Unknown')}")

                summary = await self.ai_summarizer.summarize_content(item)
                summaries.append(summary)

                # Brief pause to respect API rate limits
                await asyncio.sleep(1)

            except Exception as e:
                self._add_log("error", f"Error summarizing {item.get('title', 'unknown')}: {e}")
                # Add empty summary to maintain data consistency
                summaries.append({
                    "title": item.get("title", "Unknown"),
                    "source": item.get("source", "Unknown"),
                    "summary": "Summary generation failed",
                    "error": str(e)
                })

        return summaries

    async def _extract_insights(self, summaries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extract strategic insights from summaries using enhanced AI extraction.

        Args:
            summaries: List of generated summaries

        Returns:
            List of insight dictionaries for database storage
        """
        insights = []  # Simplified: just "insights" instead of "all_insights"

        try:
            # Initialize enhanced insights extractor if needed
            if self.insights_extractor is None:
                self.insights_extractor = EnhancedInsightsExtractor(self.ai_summarizer)

            self._add_log("info", f"Extracting strategic insights from {len(summaries)} summaries")

            for summary in summaries:
                try:
                    # Extract strategic insights (not bullet points)
                    strategic_insights = await self.insights_extractor.extract_strategic_insights(summary)

                    # Convert to database format
                    for insight_text in strategic_insights:
                        insight_data = {
                            'summary_id': summary.get('id'),
                            'source': summary.get('source', 'Unknown'),
                            'topic': ', '.join(summary.get('tags', [])[:3]),
                            'insight': insight_text,
                            'tags': summary.get('tags', []),
                            'date': summary.get('date', ''),
                            'created_at': datetime.datetime.now().isoformat()
                        }
                        insights.append(insight_data)  # Simplified variable name

                    self._add_log("debug",
                                  f"Extracted {len(strategic_insights)} insights from {summary.get('source', 'unknown')}")

                except Exception as e:
                    self._add_log("warning", f"Failed to extract insights from {summary.get('source', 'unknown')}: {e}")
                    continue

            self._add_log("info", f"Successfully extracted {len(insights)} strategic insights total")
            return insights  # Simplified return

        except Exception as e:
            self._add_log("error", f"Strategic insights extraction failed: {e}")
            # Fallback to simple extraction if needed
            return await self._fallback_extract_insights(summaries)

    async def _fallback_extract_insights(self, summaries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback to basic bullet point extraction if AI extraction fails."""
        insights = []  # Simplified variable name here too

        for summary in summaries:
            # Use the existing simple extraction from ai_summarizer
            simple_insights = await self.ai_summarizer.extract_insights(summary)
            insights.extend(simple_insights)

        self._add_log("info", f"Used fallback extraction for {len(insights)} insights")
        return insights

    async def _store_results(self, content_items: List[Dict[str, Any]],
                             summaries: List[Dict[str, Any]],
                             insights: List[Dict[str, Any]]):
        """Store all results in database"""
        try:
            # Store summaries
            await self.db_manager.store_summaries(summaries)

            # Store insights
            await self.db_manager.store_insights(insights)

            # Store links
            all_links = []
            for item in content_items:
                if item.get("links"):
                    for link in item["links"]:
                        link["source"] = item.get("source", "Unknown")
                        link["date"] = item.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
                    all_links.extend(item["links"])

            await self.db_manager.store_links(all_links)

            self._add_log("info", "Data stored successfully in database")

        except Exception as e:
            self._add_log("error", f"Error storing data: {e}")
            raise

    async def _generate_exports(self, summaries: List[Dict[str, Any]]) -> List[Path]:
        """Generate export files"""
        exports = []

        try:
            # Generate Obsidian markdown
            obsidian_file = await self.export_manager.generate_obsidian_summary(summaries)
            if obsidian_file:
                exports.append(obsidian_file)

            # Generate JSON export
            json_file = await self.export_manager.generate_json_export(summaries)
            if json_file:
                exports.append(json_file)

            self._add_log("info", f"Generated {len(exports)} export files")
            return exports

        except Exception as e:
            self._add_log("error", f"Error generating exports: {e}")
            return []

    async def _finalize_processing(self):
        """Final cleanup and housekeeping"""
        try:
            # Update last run timestamp
            await self.db_manager.update_last_run_timestamp()

            # Clean up temporary files
            await self.export_manager.cleanup_temp_files()

            self._add_log("info", "Processing finalized successfully")

        except Exception as e:
            self._add_log("warning", f"Error during finalization: {e}")

    def get_current_state(self) -> Dict[str, Any]:
        """Get current processing state"""
        return self.state.to_dict()

    async def test_configuration(self) -> Dict[str, Any]:
        """
        Test all configured components including SourceManager.

        Updated for Sprint 2: Now tests SourceManager alongside legacy components.
        """
        test_results = {}

        try:
            # Test SourceManager
            self._add_log("info", "Testing SourceManager configuration")

            configured_sources = self.source_manager.get_configured_sources()
            source_test_results = {}

            for source_id in configured_sources.keys():
                try:
                    result = await self.source_manager.test_source(source_id)
                    source_test_results[source_id] = result['success']
                except Exception as e:
                    self._add_log("warning", f"Failed to test source {source_id}: {e}")
                    source_test_results[source_id] = False

            test_results['source_manager'] = {
                'available': True,
                'configured_sources': len(configured_sources),
                'source_tests': source_test_results,
                'overall_success': all(source_test_results.values()) if source_test_results else False
            }

        except Exception as e:
            self._add_log("error", f"SourceManager test failed: {e}")
            test_results['source_manager'] = {
                'available': False,
                'error': str(e)
            }

        # Test legacy components (still needed for backward compatibility)
        try:
            test_results['email'] = await self.email_client.test_connection()
        except Exception as e:
            test_results['email'] = False

        try:
            # Test RSS with a sample feed
            configured_feeds = self.rss_client.get_configured_feeds()
            if configured_feeds:
                sample_feed = next(iter(configured_feeds.values()))
                result = await self.rss_client.test_rss_feed(sample_feed['rss_url'])
                test_results['rss'] = result.get('success', False)
            else:
                test_results['rss'] = False
        except Exception as e:
            test_results['rss'] = False

        # Test AI components
        try:
            test_results['ai_summarizer'] = await self.ai_summarizer.test_api()
        except Exception as e:
            test_results['ai_summarizer'] = False

        try:
            test_results['link_enricher'] = await self.link_enricher.test_api()
        except Exception as e:
            test_results['link_enricher'] = False

        # Test database
        try:
            await self.db_manager.initialize()
            test_results['database'] = True
        except Exception as e:
            test_results['database'] = False

        return test_results

    def get_source_manager_status(self) -> Dict[str, Any]:
        """
        Get detailed status of SourceManager.
        New method for Sprint 2 diagnostics.
        """
        try:
            return {
                'available_plugin_types': self.source_manager.get_available_plugin_types(),
                'configured_sources': list(self.source_manager.get_configured_sources().keys()),
                'enabled_sources': [
                    source_id for source_id, config in self.source_manager.get_configured_sources().items()
                    if config.get('enabled', True)
                ],
                'plugin_count': len(self.source_manager.registered_plugins),
                'source_count': len(self.source_manager.configured_sources)
            }
        except Exception as e:
            return {
                'error': str(e),
                'available': False
            }

    async def _should_generate_weekly_summary(self) -> bool:
        """
        Determine if we should auto-generate a weekly summary.

        Returns True if:
        1. Auto-generation is enabled in settings
        2. It's been >X days since last weekly summary (configurable)
        3. AND there are new summaries since last weekly summary
        """
        try:
            # Check if auto-generation is enabled
            if not self.settings.auto_generate_weekly_summary:
                self._add_log("info", "Auto-generation of weekly summaries is disabled")
                return False

            # Get the most recent weekly summary
            latest_weekly = await self.db_manager.get_latest_weekly_summary()

            if not latest_weekly:
                # No weekly summary exists - generate one if we have any summaries
                recent_summaries = await self.db_manager.get_summaries_since(
                    datetime.datetime.now() - datetime.timedelta(days=7)
                )
                return len(recent_summaries) > 0

            # Check if it's been >X days since last weekly summary (configurable)
            last_weekly_date = datetime.datetime.fromisoformat(latest_weekly['date'])
            days_since_weekly = (datetime.datetime.now() - last_weekly_date).days
            min_days = self.settings.weekly_summary_min_days

            if days_since_weekly < min_days:
                self._add_log("info",
                              f"Last weekly summary was {days_since_weekly} days ago, minimum is {min_days} days, skipping auto-generation")
                return False

            # Check if there are new summaries since last weekly summary
            summaries_since_weekly = await self.db_manager.get_summaries_since(last_weekly_date)
            # Exclude weekly summaries from the count
            new_summaries = [s for s in summaries_since_weekly if s.get('source_type') != 'weekly_summary']

            if len(new_summaries) == 0:
                self._add_log("info", "No new summaries since last weekly summary, skipping auto-generation")
                return False

            self._add_log("info",
                          f"Found {len(new_summaries)} new summaries since last weekly summary ({days_since_weekly} days ago)")
            return True

        except Exception as e:
            self._add_log("warning", f"Error checking weekly summary conditions: {e}")
            return False

    async def _generate_weekly_summary_v1(self) -> Optional[Dict[str, Any]]:
        """
        Generate and store a V1-format weekly summary from recent individual summaries.

        Returns:
            Weekly summary data if successful, None if failed
        """
        try:
            from datetime import datetime, timedelta

            # Get summaries from the last 7 days (excluding existing weekly summaries)
            since_date = datetime.now() - timedelta(days=7)
            summaries = await self.db_manager.get_summaries_since(since_date)

            if not summaries:
                self._add_log("info", "No summaries found for weekly summary generation")
                return None

            # Generate V1 format markdown content using ExportManager
            markdown_content = self.export_manager._generate_obsidian_content(summaries)

            if not markdown_content:
                self._add_log("error", "Failed to generate weekly summary content")
                return None

            # Create weekly summary record
            today = datetime.now().strftime("%Y-%m-%d")
            weekly_summary = {
                'title': f'Weekly Summary - {today}',
                'source': 'Research Automation',
                'source_type': 'weekly_summary',
                'date': today,
                'summary': markdown_content,
                'questions': [],
                'tags': ['weekly', 'meta-summary'],
                'links': [],
                'content_length': len(markdown_content),
                'chunks_processed': len(summaries),
                'read': False,
                'starred': False
            }

            # Store in database
            weekly_id = await self.db_manager.store_summary(weekly_summary)
            self._add_log("info", f"Stored weekly summary with ID: {weekly_id}")

            # Export to Obsidian (if configured)
            try:
                export_path = await self.export_manager.generate_obsidian_summary([weekly_summary])
                if export_path:
                    self._add_log("info", f"Exported weekly summary to Obsidian: {export_path}")
            except Exception as e:
                self._add_log("warning", f"Failed to export weekly summary to Obsidian: {e}")

            return weekly_summary

        except Exception as e:
            self._add_log("error", f"Error generating weekly summary: {e}")
            return None

    async def run_full_processing(self) -> Dict[str, Any]:
        """
        Run the complete processing workflow with smart weekly summary generation
        """
        self.state = ProcessingState()  # Reset state
        self.state.status = "running"
        self.state.start_time = datetime.datetime.now()
        self.state.total_steps = 9  # UPDATED: was 8, now 9 to include weekly summary step

        try:
            self._add_log("info", "Starting newsletter processing workflow")

            # Step 1: Initialize database
            self._update_progress("Initializing database", 1)
            await self.db_manager.initialize()

            # Step 2: Fetch content from all sources
            self._update_progress("Fetching content from sources", 2)
            content_items = await self._fetch_all_content()
            self.state.results["content_fetched"] = len(content_items)

            if not content_items:
                self._add_log("warning", "No new content found to process")
                self.state.status = "completed"
                return self.state.results

            # Step 3: Extract and enrich links
            self._update_progress("Processing links", 3)
            await self._process_links(content_items)

            # Step 4: Generate summaries with AI
            self._update_progress("Generating AI summaries", 4)
            summaries = await self._generate_summaries(content_items)
            self.state.results["summaries_generated"] = len(summaries)

            # Step 5: Extract insights and questions
            self._update_progress("Extracting insights", 5)
            insights = await self._extract_insights(summaries)
            self.state.results["insights_extracted"] = len(insights)

            # Step 6: Store everything in database
            self._update_progress("Storing data", 6)
            await self._store_results(content_items, summaries, insights)

            # Step 7: Generate exports
            self._update_progress("Generating exports", 7)
            exports = await self._generate_exports(summaries)
            self.state.results["exports_generated"] = len(exports)

            # Step 8: Smart weekly summary generation (ADD THIS STEP)
            self._update_progress("Checking for weekly summary generation", 8)
            should_generate_weekly = await self._should_generate_weekly_summary()

            if should_generate_weekly:
                self._update_progress("Generating weekly summary", 8)
                weekly_summary = await self._generate_weekly_summary_v1()
                if weekly_summary:
                    self.state.results["weekly_summary_generated"] = True
                    self._add_log("info", "✅ Weekly summary auto-generated successfully")
                else:
                    self.state.results["weekly_summary_generated"] = False
                    self._add_log("warning", "⚠️ Weekly summary auto-generation failed")
            else:
                self.state.results["weekly_summary_generated"] = False
                self._add_log("info", "⏭️ Weekly summary auto-generation skipped (conditions not met)")

            # Step 9: Finalize (was Step 8, now Step 9)
            self._update_progress("Finalizing", 9)
            await self._finalize_processing()

            self.state.status = "completed"
            self.state.end_time = datetime.datetime.now()

            # Update completion message to include weekly summary info
            completion_message = (f"Processing completed successfully. " +
                                  f"Created {self.state.results.get('summaries_created', 0)} summaries, " +
                                  f"extracted {self.state.results.get('insights_extracted', 0)} insights, " +
                                  f"generated {self.state.results.get('exports_generated', 0)} exports")

            if self.state.results.get("weekly_summary_generated"):
                completion_message += ", and auto-generated weekly summary"

            self._add_log("info", completion_message)

            return self.state.results

        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            self.state.end_time = datetime.datetime.now()
            self._add_log("error", f"Processing failed: {e}")
            raise