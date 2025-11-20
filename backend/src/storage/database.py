#!/usr/bin/env python3
"""
Database management for Research Automation
Enhanced SQLite operations with async support

Handles all database operations including summaries, insights, links, and metadata
"""

import os
import sqlite3
import aiosqlite
from datetime import datetime, timedelta
import json
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)


class DatabaseManager:
    """
    Enhanced database manager with async support for all data operations.

    Manages summaries, insights, links, questions, and processing metadata.
    """

    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize the database manager.

        Args:
            db_path: Optional path to database file
        """
        self.settings = get_settings()
        self.db_path = db_path or self.settings.database_path

        # Ensure database directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    async def initialize(self):
        """Initialize database with all required tables."""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # Enable foreign keys
                await db.execute("PRAGMA foreign_keys = ON")

                # Create all tables
                await self._create_tables(db)

                # Create indexes for better performance
                await self._create_indexes(db)

                await db.commit()

            logger.info(f"Database initialized at {self.db_path}")

        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise

    async def _create_tables(self, db: aiosqlite.Connection):
        """Create all required database tables."""

        # Summaries table - main content summaries
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS summaries
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             title
                             TEXT
                             NOT
                             NULL,
                             source
                             TEXT
                             NOT
                             NULL,
                             source_type
                             TEXT
                             DEFAULT
                             'newsletter',
                             date
                             TEXT
                             NOT
                             NULL,
                             summary
                             TEXT,
                             content_length
                             INTEGER
                             DEFAULT
                             0,
                             chunks_processed
                             INTEGER
                             DEFAULT
                             1,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP,
                             read
                             BOOLEAN
                             DEFAULT
                             FALSE,
                             starred
                             BOOLEAN
                             DEFAULT
                             FALSE
                         )
                         ''')

        # Insights table - extracted key insights
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS insights
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             summary_id
                             INTEGER,
                             source
                             TEXT
                             NOT
                             NULL,
                             topic
                             TEXT,
                             insight
                             TEXT
                             NOT
                             NULL,
                             tags
                             TEXT,
                             date
                             TEXT
                             NOT
                             NULL,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP,
                             FOREIGN
                             KEY
                         (
                             summary_id
                         ) REFERENCES summaries
                         (
                             id
                         ) ON DELETE CASCADE
                             )
                         ''')

        # Questions table - expert questions extracted from content
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS questions
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             summary_id
                             INTEGER,
                             source
                             TEXT
                             NOT
                             NULL,
                             question
                             TEXT
                             NOT
                             NULL,
                             topic
                             TEXT,
                             date
                             TEXT
                             NOT
                             NULL,
                             answered
                             BOOLEAN
                             DEFAULT
                             FALSE,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP,
                             FOREIGN
                             KEY
                         (
                             summary_id
                         ) REFERENCES summaries
                         (
                             id
                         ) ON DELETE CASCADE
                             )
                         ''')

        # Links table - extracted and enriched links
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS links
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             summary_id
                             INTEGER,
                             url
                             TEXT
                             NOT
                             NULL,
                             title
                             TEXT,
                             description
                             TEXT,
                             image_url
                             TEXT,
                             source
                             TEXT
                             NOT
                             NULL,
                             date
                             TEXT
                             NOT
                             NULL,
                             tags
                             TEXT,
                             enriched
                             BOOLEAN
                             DEFAULT
                             FALSE,
                             visited
                             BOOLEAN
                             DEFAULT
                             FALSE,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP,
                             FOREIGN
                             KEY
                         (
                             summary_id
                         ) REFERENCES summaries
                         (
                             id
                         ) ON DELETE CASCADE
                             )
                         ''')

        # Processing runs table - track processing history
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS processing_runs
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             start_time
                             TEXT
                             NOT
                             NULL,
                             end_time
                             TEXT,
                             status
                             TEXT
                             NOT
                             NULL
                             DEFAULT
                             'running',
                             summaries_created
                             INTEGER
                             DEFAULT
                             0,
                             links_extracted
                             INTEGER
                             DEFAULT
                             0,
                             insights_generated
                             INTEGER
                             DEFAULT
                             0,
                             error_message
                             TEXT,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP
                         )
                         ''')

        # Tags table - for tag management and statistics
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS tags
                         (
                             id
                             INTEGER
                             PRIMARY
                             KEY
                             AUTOINCREMENT,
                             name
                             TEXT
                             UNIQUE
                             NOT
                             NULL,
                             category
                             TEXT
                             DEFAULT
                             'general',
                             usage_count
                             INTEGER
                             DEFAULT
                             0,
                             last_used
                             TEXT,
                             created_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP
                         )
                         ''')

        # Configuration table - store app configuration and metadata
        await db.execute('''
                         CREATE TABLE IF NOT EXISTS configuration
                         (
                             key
                             TEXT
                             PRIMARY
                             KEY,
                             value
                             TEXT,
                             updated_at
                             TEXT
                             DEFAULT
                             CURRENT_TIMESTAMP
                         )
                         ''')

    async def _create_indexes(self, db: aiosqlite.Connection):
        """Create database indexes for better performance."""
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_summaries_date ON summaries (date)",
            "CREATE INDEX IF NOT EXISTS idx_summaries_source ON summaries (source)",
            "CREATE INDEX IF NOT EXISTS idx_summaries_read ON summaries (read)",
            "CREATE INDEX IF NOT EXISTS idx_insights_date ON insights (date)",
            "CREATE INDEX IF NOT EXISTS idx_insights_source ON insights (source)",
            "CREATE INDEX IF NOT EXISTS idx_questions_date ON questions (date)",
            "CREATE INDEX IF NOT EXISTS idx_questions_answered ON questions (answered)",
            "CREATE INDEX IF NOT EXISTS idx_links_url ON links (url)",
            "CREATE INDEX IF NOT EXISTS idx_links_source ON links (source)",
            "CREATE INDEX IF NOT EXISTS idx_links_date ON links (date)",
            "CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name)",
            "CREATE INDEX IF NOT EXISTS idx_processing_runs_date ON processing_runs (start_time)",
        ]

        for index_sql in indexes:
            await db.execute(index_sql)

    async def test_connection(self) -> bool:
        """
        Test database connection.

        Returns:
            bool: True if connection successful
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute("SELECT 1")
                await cursor.fetchone()

            logger.info("Database connection test successful")
            return True

        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

    async def store_summaries(self, summaries: List[Dict[str, Any]]) -> List[int]:
        """
        Store summaries in database.

        Args:
            summaries: List of summary dictionaries

        Returns:
            List of summary IDs
        """
        summary_ids = []

        try:
            async with aiosqlite.connect(self.db_path) as db:
                for summary in summaries:
                    # Insert summary
                    cursor = await db.execute('''
                                              INSERT INTO summaries
                                              (title, source, source_type, date, summary, content_length,
                                               chunks_processed)
                                              VALUES (?, ?, ?, ?, ?, ?, ?)
                                              ''', (
                                                  summary.get("title", ""),
                                                  summary.get("source", ""),
                                                  summary.get("source_type", "newsletter"),
                                                  summary.get("date", ""),
                                                  summary.get("summary", ""),
                                                  summary.get("content_length", 0),
                                                  summary.get("chunks_processed", 1)
                                              ))

                    summary_id = cursor.lastrowid
                    summary_ids.append(summary_id)

                    # Store associated questions
                    await self._store_questions_for_summary(db, summary_id, summary)

                    # Store associated insights
                    await self._store_insights_for_summary(db, summary_id, summary)

                    # Update tag usage
                    await self._update_tag_usage(db, summary.get("tags", []))

                await db.commit()

            logger.info(f"Stored {len(summaries)} summaries in database")
            return summary_ids

        except Exception as e:
            logger.error(f"Error storing summaries: {e}")
            raise

    async def _store_questions_for_summary(self, db: aiosqlite.Connection, summary_id: int, summary: Dict[str, Any]):
        """Store questions associated with a summary."""
        questions = summary.get("questions", [])

        for question in questions:
            await db.execute('''
                             INSERT INTO questions (summary_id, source, question, topic, date)
                             VALUES (?, ?, ?, ?, ?)
                             ''', (
                                 summary_id,
                                 summary.get("source", ""),
                                 question,
                                 ", ".join(summary.get("tags", [])[:3]),
                                 summary.get("date", "")
                             ))

    async def _store_insights_for_summary(self, db: aiosqlite.Connection, summary_id: int, summary: Dict[str, Any]):
        """Store insights associated with a summary."""
        insights = summary.get("insights", [])

        for insight in insights:
            await db.execute('''
                             INSERT INTO insights (summary_id, source, topic, insight, tags, date)
                             VALUES (?, ?, ?, ?, ?, ?)
                             ''', (
                                 summary_id,
                                 summary.get("source", ""),
                                 ", ".join(summary.get("tags", [])[:3]),
                                 insight,
                                 ", ".join(summary.get("tags", [])),
                                 summary.get("date", "")
                             ))

    async def store_links(self, links: List[Dict[str, Any]]) -> int:
        """
        Store links in database.

        Args:
            links: List of link dictionaries

        Returns:
            Number of links stored
        """
        if not links:
            return 0

        try:
            async with aiosqlite.connect(self.db_path) as db:
                count = 0

                for link in links:
                    # Check if link already exists
                    cursor = await db.execute("SELECT id FROM links WHERE url = ?", (link.get("url", ""),))
                    existing = await cursor.fetchone()

                    if existing:
                        continue  # Skip duplicates

                    await db.execute('''
                                     INSERT INTO links
                                         (url, title, description, image_url, source, date, tags, enriched)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                     ''', (
                                         link.get("url", ""),
                                         link.get("title", ""),
                                         link.get("description", ""),
                                         link.get("image_url", ""),
                                         link.get("source", ""),
                                         link.get("date", ""),
                                         ", ".join(link.get("tags", [])),
                                         bool(link.get("description"))  # Assume enriched if has description
                                     ))

                    count += 1

                await db.commit()

            logger.info(f"Stored {count} new links in database")
            return count

        except Exception as e:
            logger.error(f"Error storing links: {e}")
            raise

    async def store_insights(self, insights: List[Dict[str, Any]]) -> int:
        """
        Store standalone insights in database.

        Args:
            insights: List of insight dictionaries

        Returns:
            Number of insights stored
        """
        if not insights:
            return 0

        try:
            async with aiosqlite.connect(self.db_path) as db:
                count = 0

                for insight in insights:
                    await db.execute('''
                                     INSERT INTO insights (source, topic, insight, tags, date)
                                     VALUES (?, ?, ?, ?, ?)
                                     ''', (
                                         insight.get("source", ""),
                                         insight.get("topic", ""),
                                         insight.get("insight", ""),
                                         ", ".join(insight.get("tags", [])),
                                         insight.get("date", "")
                                     ))

                    count += 1

                await db.commit()

            logger.info(f"Stored {count} insights in database")
            return count

        except Exception as e:
            logger.error(f"Error storing insights: {e}")
            raise

    async def _update_tag_usage(self, db: aiosqlite.Connection, tags: List[str]):
        """Update tag usage statistics."""
        for tag in tags:
            if not tag:
                continue

            # Check if tag exists
            cursor = await db.execute("SELECT usage_count FROM tags WHERE name = ?", (tag,))
            existing = await cursor.fetchone()

            if existing:
                # Update existing tag
                await db.execute('''
                                 UPDATE tags
                                 SET usage_count = usage_count + 1,
                                     last_used   = CURRENT_TIMESTAMP
                                 WHERE name = ?
                                 ''', (tag,))
            else:
                # Insert new tag
                await db.execute('''
                                 INSERT INTO tags (name, usage_count, last_used)
                                 VALUES (?, 1, CURRENT_TIMESTAMP)
                                 ''', (tag,))

    async def get_recent_summaries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent summaries from database.

        Args:
            limit: Maximum number of summaries to return

        Returns:
            List of summary dictionaries
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                cursor = await db.execute('''
                                          SELECT *
                                          FROM summaries
                                          ORDER BY date DESC, created_at DESC
                                              LIMIT ?
                                          ''', (limit,))

                rows = await cursor.fetchall()

                summaries = []
                for row in rows:
                    summary = dict(row)

                    # Get associated questions
                    q_cursor = await db.execute(
                        "SELECT question FROM questions WHERE summary_id = ?",
                        (summary["id"],)
                    )
                    questions = [q[0] for q in await q_cursor.fetchall()]
                    summary["questions"] = questions

                    # Get associated tags
                    i_cursor = await db.execute(
                        "SELECT DISTINCT tags FROM insights WHERE summary_id = ?",
                        (summary["id"],)
                    )
                    tag_rows = await i_cursor.fetchall()
                    all_tags = []
                    for tag_row in tag_rows:
                        if tag_row[0]:
                            all_tags.extend([t.strip() for t in tag_row[0].split(",")])
                    summary["tags"] = list(set(all_tags))

                    summaries.append(summary)

                return summaries

        except Exception as e:
            logger.error(f"Error getting recent summaries: {e}")
            return []

    async def search_summaries(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search summaries by text content.

        Args:
            query: Search query
            limit: Maximum results to return

        Returns:
            List of matching summaries
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                search_term = f"%{query}%"
                cursor = await db.execute('''
                                          SELECT *
                                          FROM summaries
                                          WHERE title LIKE ?
                                             OR summary LIKE ?
                                             OR source LIKE ?
                                          ORDER BY date DESC
                                              LIMIT ?
                                          ''', (search_term, search_term, search_term, limit))

                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error searching summaries: {e}")
            return []

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get database statistics.

        Returns:
            Dictionary with various statistics
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                stats = {}

                # Count tables
                for table in ["summaries", "insights", "questions", "links", "processing_runs"]:
                    cursor = await db.execute(f"SELECT COUNT(*) FROM {table}")
                    count = await cursor.fetchone()
                    stats[f"{table}_count"] = count[0] if count else 0

                # Get recent activity
                cursor = await db.execute('''
                                          SELECT COUNT(*)
                                          FROM summaries
                                          WHERE date >= date ('now', '-7 days')
                                          ''')
                recent = await cursor.fetchone()
                stats["summaries_last_week"] = recent[0] if recent else 0

                # Get top sources
                cursor = await db.execute('''
                                          SELECT source, COUNT(*) as count
                                          FROM summaries
                                          GROUP BY source
                                          ORDER BY count DESC
                                              LIMIT 10
                                          ''')
                top_sources = await cursor.fetchall()
                stats["top_sources"] = [{"source": s[0], "count": s[1]} for s in top_sources]

                # Get top tags
                cursor = await db.execute('''
                                          SELECT name, usage_count
                                          FROM tags
                                          ORDER BY usage_count DESC LIMIT 10
                                          ''')
                top_tags = await cursor.fetchall()
                stats["top_tags"] = [{"tag": t[0], "count": t[1]} for t in top_tags]

                return stats

        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return {}

    async def update_last_run_timestamp(self):
        """Update the last run timestamp in configuration."""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute('''
                    INSERT OR REPLACE INTO configuration (key, value, updated_at)
                    VALUES ('last_run', ?, CURRENT_TIMESTAMP)
                ''', (datetime.now().isoformat(),))

                await db.commit()

        except Exception as e:
            logger.error(f"Error updating last run timestamp: {e}")

    async def start_processing_run(self) -> int:
        """
        Start a new processing run and return its ID.

        Returns:
            Processing run ID
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute('''
                                          INSERT INTO processing_runs (start_time, status)
                                          VALUES (?, 'running')
                                          ''', (datetime.now().isoformat(),))

                run_id = cursor.lastrowid
                await db.commit()

                return run_id

        except Exception as e:
            logger.error(f"Error starting processing run: {e}")
            raise

    async def complete_processing_run(self, run_id: int, stats: Dict[str, Any], error: Optional[str] = None):
        """
        Complete a processing run with statistics.

        Args:
            run_id: Processing run ID
            stats: Statistics from the processing run
            error: Optional error message if run failed
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                status = "error" if error else "completed"

                await db.execute('''
                                 UPDATE processing_runs
                                 SET end_time           = ?,
                                     status             = ?,
                                     summaries_created  = ?,
                                     links_extracted    = ?,
                                     insights_generated = ?,
                                     error_message      = ?
                                 WHERE id = ?
                                 ''', (
                                     datetime.now().isoformat(),
                                     status,
                                     stats.get("summaries_generated", 0),
                                     stats.get("links_processed", 0),
                                     stats.get("insights_extracted", 0),
                                     error,
                                     run_id
                                 ))

                await db.commit()

        except Exception as e:
            logger.error(f"Error completing processing run: {e}")

    async def cleanup_old_data(self, days_to_keep: int = 365):
        """
        Clean up old data from database.

        Args:
            days_to_keep: Number of days of data to keep
        """
        try:
            cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).strftime("%Y-%m-%d")

            async with aiosqlite.connect(self.db_path) as db:
                # Delete old processing runs
                await db.execute("DELETE FROM processing_runs WHERE start_time < ?", (cutoff_date,))

                # Clean up unused tags
                await db.execute('''
                                 DELETE
                                 FROM tags
                                 WHERE usage_count = 0
                                   AND last_used < ?
                                 ''', (cutoff_date,))

                await db.commit()

            logger.info(f"Cleaned up data older than {cutoff_date}")

        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")

    async def export_data(self, format: str = "json") -> Dict[str, Any]:
        """
        Export all data from database.

        Args:
            format: Export format (currently only 'json' supported)

        Returns:
            Dictionary with all data
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                export_data = {}

                # Export all tables
                tables = ["summaries", "insights", "questions", "links", "processing_runs", "tags"]

                for table in tables:
                    cursor = await db.execute(f"SELECT * FROM {table}")
                    rows = await cursor.fetchall()
                    export_data[table] = [dict(row) for row in rows]

                export_data["exported_at"] = datetime.now().isoformat()
                export_data["total_records"] = sum(
                    len(records) for records in export_data.values() if isinstance(records, list))

                return export_data

        except Exception as e:
            logger.error(f"Error exporting data: {e}")
            raise

    async def get_links(
            self,
            limit: int = 20,
            offset: int = 0,
            source: Optional[str] = None,
            enriched: Optional[bool] = None,
            visited: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Get links with pagination and filtering.

        Args:
            limit: Number of links to return
            offset: Number of links to skip
            source: Filter by source
            enriched: Filter by enrichment status
            visited: Filter by visited status

        Returns:
            Dictionary with links and metadata
        """
        try:
            # Build conditions for WHERE clause
            conditions = []
            params = []

            if source:
                conditions.append("source = ?")
                params.append(source)

            if enriched is not None:
                conditions.append("enriched = ?")
                params.append(enriched)

            if visited is not None:
                conditions.append("visited = ?")
                params.append(visited)

            where_clause = ""
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)

            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                # Get total count
                count_query = f"SELECT COUNT(*) FROM links {where_clause}"
                async with db.execute(count_query, params) as cursor:
                    total_count = (await cursor.fetchone())[0]

                # Get links with pagination
                query = f"""
                    SELECT id, url, title, description, image_url, source, date, 
                           tags, enriched, visited, created_at
                    FROM links 
                    {where_clause}
                    ORDER BY date DESC, created_at DESC
                    LIMIT ? OFFSET ?
                """

                params.extend([limit, offset])

                async with db.execute(query, params) as cursor:
                    rows = await cursor.fetchall()

                    links = []
                    for row in rows:
                        link = {
                            "id": row["id"],
                            "url": row["url"],
                            "title": row["title"],
                            "description": row["description"],
                            "image_url": row["image_url"],
                            "source": row["source"],
                            "date": row["date"],
                            "tags": row["tags"].split(",") if row["tags"] else [],
                            "enriched": bool(row["enriched"]),
                            "visited": bool(row["visited"]),
                            "created_at": row["created_at"]
                        }
                        links.append(link)

            return {
                "links": links,
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count
            }

        except Exception as e:
            logger.error(f"Error getting links: {e}")
            raise

    async def mark_link_visited(self, link_id: int) -> bool:
        """
        Mark a link as visited.

        Args:
            link_id: ID of the link to mark as visited

        Returns:
            True if successful, False if link not found
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # Update the link
                await db.execute(
                    "UPDATE links SET visited = 1 WHERE id = ?",
                    (link_id,)
                )

                # Check if any rows were affected
                if db.total_changes == 0:
                    return False

                await db.commit()
                logger.info(f"Marked link {link_id} as visited")
                return True

        except Exception as e:
            logger.error(f"Error marking link as visited: {e}")
            raise

    async def get_links_analytics(self) -> Dict[str, Any]:
        """
        Get analytics data for links (domains, sources, etc.)

        Returns:
            Dictionary with analytics data
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                # Get top domains by parsing URLs
                domain_query = """
                               SELECT SUBSTR( \
                                              SUBSTR(url, INSTR(url, '://') + 3), \
                                              1, \
                                              CASE \
                                                  WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0 \
                                                      THEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1 \
                                                  ELSE LENGTH(SUBSTR(url, INSTR(url, '://') + 3)) \
                                                  END \
                                      ) as domain,
                        COUNT(*) as count
                               FROM links
                               WHERE url LIKE 'http%'
                               GROUP BY domain
                               ORDER BY count DESC
                                   LIMIT 10 \
                               """

                async with db.execute(domain_query) as cursor:
                    domain_rows = await cursor.fetchall()
                    domains = [{"domain": row["domain"], "count": row["count"]}
                               for row in domain_rows]

                # Get top sources
                source_query = """
                               SELECT source, COUNT(*) as count
                               FROM links
                               WHERE source != ''
                               GROUP BY source
                               ORDER BY count DESC
                                   LIMIT 10 \
                               """

                async with db.execute(source_query) as cursor:
                    source_rows = await cursor.fetchall()
                    sources = [{"source": row["source"], "count": row["count"]}
                               for row in source_rows]

                # Get enrichment stats
                stats_query = """
                              SELECT COUNT(*)                                      as total_links, \
                                     SUM(CASE WHEN enriched = 1 THEN 1 ELSE 0 END) as enriched_links, \
                                     SUM(CASE WHEN visited = 1 THEN 1 ELSE 0 END)  as visited_links
                              FROM links \
                              """

                async with db.execute(stats_query) as cursor:
                    stats_row = await cursor.fetchone()
                    stats = {
                        "total_links": stats_row["total_links"],
                        "enriched_links": stats_row["enriched_links"],
                        "visited_links": stats_row["visited_links"],
                        "enrichment_rate": (stats_row["enriched_links"] / stats_row["total_links"]) * 100 if stats_row[
                                                                                                                 "total_links"] > 0 else 0
                    }

            return {
                "topDomains": domains,
                "topSources": sources,
                "stats": stats
            }

        except Exception as e:
            logger.error(f"Error getting links analytics: {e}")
            raise

    async def search_links(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search links by title, description, or URL.

        Args:
            query: Search query
            limit: Maximum number of results

        Returns:
            List of matching links
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                search_query = """
                               SELECT id, \
                                      url, \
                                      title, \
                                      description, \
                                      image_url, \
                                      source, date, tags, enriched, visited, created_at
                               FROM links
                               WHERE title LIKE ? OR description LIKE ? OR url LIKE ?
                               ORDER BY
                                   CASE
                                   WHEN title LIKE ? THEN 1
                                   WHEN description LIKE ? THEN 2
                                   ELSE 3
                               END \
                               ,
                        date DESC
                    LIMIT ? \
                               """

                search_term = f"%{query}%"
                params = [search_term, search_term, search_term, search_term, search_term, limit]

                async with db.execute(search_query, params) as cursor:
                    rows = await cursor.fetchall()

                    results = []
                    for row in rows:
                        link = {
                            "id": row["id"],
                            "url": row["url"],
                            "title": row["title"],
                            "description": row["description"],
                            "image_url": row["image_url"],
                            "source": row["source"],
                            "date": row["date"],
                            "tags": row["tags"].split(",") if row["tags"] else [],
                            "enriched": bool(row["enriched"]),
                            "visited": bool(row["visited"]),
                            "created_at": row["created_at"]
                        }
                        results.append(link)

                    return results

        except Exception as e:
            logger.error(f"Error searching links: {e}")
            raise

    async def get_summaries_since(self, since_date: datetime) -> List[Dict[str, Any]]:
        """Get summaries created since a specific date."""
        try:
            query = """
                    SELECT *
                    FROM summaries
                    WHERE date >= ?
                      AND source_type != 'weekly_summary' -- Exclude weekly summaries from aggregation
                    ORDER BY date DESC \
                    """

            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query, (since_date.isoformat(),))
                rows = await cursor.fetchall()

                summaries = []
                for row in rows:
                    summary = dict(row)
                    # Parse JSON fields
                    summary['questions'] = json.loads(summary.get('questions', '[]'))
                    summary['tags'] = json.loads(summary.get('tags', '[]'))
                    summary['links'] = json.loads(summary.get('links', '[]'))
                    summaries.append(summary)

                return summaries

        except Exception as e:
            logger.error(f"Error getting summaries since {since_date}: {e}")
            return []

    async def store_summary(self, summary: Dict[str, Any]) -> int:
        """Store a summary in the database."""
        try:
            query = """
                    INSERT INTO summaries (title, source, source_type, date, summary,
                                           content_length, chunks_processed, created_at, read, starred)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """

            values = (
                summary.get('title', ''),
                summary.get('source', ''),
                summary.get('source_type', ''),
                summary.get('date', ''),
                summary.get('summary', ''),
                summary.get('content_length', 0),
                summary.get('chunks_processed', 0),
                datetime.now().isoformat(),
                summary.get('read', False),
                summary.get('starred', False)
            )

            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(query, values)
                await db.commit()

                summary_id = cursor.lastrowid
                logger.info(f"Stored summary with ID: {summary_id}")
                return summary_id

        except Exception as e:
            logger.error(f"Error storing summary: {e}")
            raise

    async def get_summary_by_id(self, summary_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific summary by ID."""
        try:
            query = "SELECT * FROM summaries WHERE id = ?"

            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query, (summary_id,))
                row = await cursor.fetchone()

                if row:
                    summary = dict(row)
                    # Parse JSON fields
                    summary['questions'] = json.loads(summary.get('questions', '[]'))
                    summary['tags'] = json.loads(summary.get('tags', '[]'))
                    summary['links'] = json.loads(summary.get('links', '[]'))
                    return summary

                return None

        except Exception as e:
            logger.error(f"Error getting summary {summary_id}: {e}")
            return None

    async def get_latest_weekly_summary(self) -> Optional[Dict[str, Any]]:
        """Get the most recent weekly summary."""
        try:
            query = """
                    SELECT *
                    FROM summaries
                    WHERE source_type = 'weekly_summary'
                    ORDER BY date DESC, created_at DESC
                        LIMIT 1 \
                    """

            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query)
                row = await cursor.fetchone()

                if row:
                    summary = dict(row)
                    # Parse JSON fields
                    summary['questions'] = json.loads(summary.get('questions', '[]'))
                    summary['tags'] = json.loads(summary.get('tags', '[]'))
                    summary['links'] = json.loads(summary.get('links', '[]'))
                    return summary

                return None

        except Exception as e:
            logger.error(f"Error getting latest weekly summary: {e}")
            return None

    async def get_weekly_summaries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent weekly summaries."""
        try:
            query = """
                    SELECT *
                    FROM summaries
                    WHERE source_type = 'weekly_summary'
                    ORDER BY date DESC, created_at DESC
                        LIMIT ? \
                    """

            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(query, (limit,))
                rows = await cursor.fetchall()

                summaries = []
                for row in rows:
                    summary = dict(row)
                    # Parse JSON fields
                    summary['questions'] = json.loads(summary.get('questions', '[]'))
                    summary['tags'] = json.loads(summary.get('tags', '[]'))
                    summary['links'] = json.loads(summary.get('links', '[]'))
                    summaries.append(summary)

                return summaries

        except Exception as e:
            logger.error(f"Error getting weekly summaries: {e}")
            return []

    async def get_insights(self, limit: int = 20, offset: int = 0, **filters) -> List[Dict[str, Any]]:
        """
        Get insights with pagination and filtering.

        Args:
            limit: Maximum number of insights to return
            offset: Number of insights to skip
            **filters: Additional filters (source, topic, date_from, date_to)

        Returns:
            List of insight dictionaries
        """
        try:
            query = """
                    SELECT id, \
                           summary_id, \
                           source, \
                           topic, \
                           insight, \
                           tags, date, created_at
                    FROM insights
                    WHERE 1=1 \
                    """
            params = []

            # Add filters
            if 'source' in filters and filters['source']:
                query += " AND source = ?"
                params.append(filters['source'])

            if 'topic' in filters and filters['topic']:
                query += " AND topic LIKE ?"
                params.append(f"%{filters['topic']}%")

            if 'date_from' in filters and filters['date_from']:
                query += " AND date >= ?"
                params.append(filters['date_from'])

            if 'date_to' in filters and filters['date_to']:
                query += " AND date <= ?"
                params.append(filters['date_to'])

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(query, params) as cursor:
                    rows = await cursor.fetchall()

            insights = []
            for row in rows:
                try:
                    # Handle tags safely
                    tags_raw = row[5]  # tags column
                    try:
                        if tags_raw:
                            if isinstance(tags_raw, str):
                                tags = json.loads(tags_raw)
                            else:
                                tags = tags_raw if isinstance(tags_raw, list) else []
                        else:
                            tags = []
                    except (json.JSONDecodeError, TypeError):
                        tags = []

                    insight = {
                        "id": row[0],
                        "summary_id": row[1],
                        "source": row[2] or "Unknown",
                        "topic": row[3] or "",
                        "insight": row[4] or "",
                        "tags": tags,
                        "date": row[6] or "",
                        "created_at": row[7] or ""
                    }
                    insights.append(insight)

                except Exception as row_error:
                    logger.warning(f"Skipping insight row due to processing error: {row_error}")
                    continue

            logger.info(f"Retrieved {len(insights)} insights from database")
            return insights

        except Exception as e:
            logger.error(f"Error getting insights: {e}")
            return []


    async def get_insights_count(self, **filters) -> int:
        """
        Get total count of insights matching filters.

        Args:
            **filters: Filters to apply

        Returns:
            Total count of insights
        """
        try:
            query = "SELECT COUNT(*) FROM insights WHERE 1=1"
            params = []

            # Add same filters as get_insights
            if 'source' in filters:
                query += " AND source = ?"
                params.append(filters['source'])

            if 'topic' in filters:
                query += " AND topic LIKE ?"
                params.append(f"%{filters['topic']}%")

            if 'date_from' in filters:
                query += " AND date >= ?"
                params.append(filters['date_from'])

            if 'date_to' in filters:
                query += " AND date <= ?"
                params.append(filters['date_to'])

            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(query, params) as cursor:
                    result = await cursor.fetchone()

            return result[0] if result else 0

        except Exception as e:
            logger.error(f"Error getting insights count: {e}")
            return 0


    async def search_insights(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search insights by content.

        Args:
            query: Search query string
            limit: Maximum number of results

        Returns:
            List of matching insights
        """
        try:
            search_query = """
            SELECT 
                id, summary_id, source, topic, insight, tags, date, created_at
            FROM insights 
            WHERE 
                insight LIKE ? OR 
                topic LIKE ? OR 
                source LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
            """

            search_term = f"%{query}%"
            params = [search_term, search_term, search_term, limit]

            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(search_query, params) as cursor:
                    rows = await cursor.fetchall()

            insights = []
            for row in rows:
                insight = {
                    "id": row[0],
                    "summary_id": row[1],
                    "source": row[2],
                    "topic": row[3],
                    "insight": row[4],
                    "tags": json.loads(row[5]) if row[5] else [],
                    "date": row[6],
                    "created_at": row[7]
                }
                insights.append(insight)

            return insights

        except Exception as e:
            logger.error(f"Error searching insights: {e}")
            return []


    async def get_insights_analytics(self) -> Dict[str, Any]:
        """
        Get insights analytics data.

        Returns:
            Dictionary with analytics data
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # Total count
                async with db.execute("SELECT COUNT(*) FROM insights") as cursor:
                    total_result = await cursor.fetchone()
                    total_count = total_result[0] if total_result else 0

                # Top sources
                async with db.execute("""
                    SELECT source, COUNT(*) as count 
                    FROM insights 
                    GROUP BY source 
                    ORDER BY count DESC 
                    LIMIT 10
                """) as cursor:
                    source_rows = await cursor.fetchall()
                    top_sources = [{"source": row[0], "count": row[1]} for row in source_rows]

                # Top topics
                async with db.execute("""
                    SELECT topic, COUNT(*) as count 
                    FROM insights 
                    WHERE topic IS NOT NULL AND topic != ''
                    GROUP BY topic 
                    ORDER BY count DESC 
                    LIMIT 10
                """) as cursor:
                    topic_rows = await cursor.fetchall()
                    top_topics = [{"topic": row[0], "count": row[1]} for row in topic_rows]

                # Insights by date (last 30 days)
                async with db.execute("""
                    SELECT date, COUNT(*) as count
                    FROM insights 
                    WHERE date >= date('now', '-30 days')
                    GROUP BY date 
                    ORDER BY date DESC
                """) as cursor:
                    date_rows = await cursor.fetchall()
                    insights_by_date = [{"date": row[0], "count": row[1]} for row in date_rows]

                # Recent insights (last 5)
                async with db.execute("""
                    SELECT id, source, insight, created_at
                    FROM insights
                    ORDER BY created_at DESC 
                    LIMIT 5
                """) as cursor:
                    recent_rows = await cursor.fetchall()
                    recent_insights = [
                        {
                            "id": row[0],
                            "source": row[1],
                            "insight": row[2],
                            "created_at": row[3]
                        }
                        for row in recent_rows
                    ]

            return {
                "total_count": total_count,
                "top_sources": top_sources,
                "top_topics": top_topics,
                "insights_by_date": insights_by_date,
                "recent_insights": recent_insights
            }

        except Exception as e:
            logger.error(f"Error getting insights analytics: {e}")
            return {}


    async def get_insight_by_id(self, insight_id: int) -> Optional[Dict[str, Any]]:
        """
        Get individual insight by ID.

        Args:
            insight_id: ID of the insight

        Returns:
            Insight dictionary or None if not found
        """
        try:
            query = """
            SELECT 
                id, summary_id, source, topic, insight, tags, date, created_at
            FROM insights 
            WHERE id = ?
            """

            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(query, [insight_id]) as cursor:
                    row = await cursor.fetchone()

            if row:
                return {
                    "id": row[0],
                    "summary_id": row[1],
                    "source": row[2],
                    "topic": row[3],
                    "insight": row[4],
                    "tags": json.loads(row[5]) if row[5] else [],
                    "date": row[6],
                    "created_at": row[7]
                }

            return None

        except Exception as e:
            logger.error(f"Error getting insight by ID: {e}")
            return None


    async def store_insights(self, insights: List[Dict[str, Any]]) -> bool:
        """
        Store insights in the database.

        Args:
            insights: List of insight dictionaries

        Returns:
            Success status
        """
        try:
            query = """
            INSERT INTO insights (summary_id, source, topic, insight, tags, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """

            async with aiosqlite.connect(self.db_path) as db:
                for insight in insights:
                    await db.execute(query, [
                        insight.get("summary_id"),  # Can be null for legacy insights
                        insight.get("source", ""),
                        insight.get("topic", ""),
                        insight.get("insight", ""),
                        json.dumps(insight.get("tags", [])),
                        insight.get("date", "")
                    ])

                await db.commit()

            logger.info(f"Stored {len(insights)} insights successfully")
            return True

        except Exception as e:
            logger.error(f"Error storing insights: {e}")
            return False