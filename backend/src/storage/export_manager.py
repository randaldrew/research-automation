#!/usr/bin/env python3
"""
Export manager for Research Automation
Handles generating various export formats (Obsidian, JSON, CSV, etc.)

Enhanced from existing code with multiple export formats and async support
"""

import json
import csv
import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
import tempfile

from ..core.config import get_settings
from ..core.logging import get_logger

logger = get_logger(__name__)


class ExportManager:
    """
    Handles exporting summaries and data to various formats.

    Supports Obsidian markdown, JSON, CSV, and custom formats.
    """

    def __init__(self):
        self.settings = get_settings()
        self.temp_files: List[Path] = []  # Track temp files for cleanup

    async def generate_obsidian_summary(self, summaries: List[Dict[str, Any]]) -> Optional[Path]:
        """
        Generate Obsidian-compatible markdown summary.

        Args:
            summaries: List of summary dictionaries

        Returns:
            Path to generated file or None if failed
        """
        try:
            if not summaries:
                logger.warning("No summaries provided for Obsidian export")
                return None

            # Generate markdown content
            markdown_content = self._generate_obsidian_content(summaries)

            # Build output directory with summaries subfolder
            vault_path = self.settings.obsidian_vault_path
            summaries_folder = self.settings.obsidian_summaries_folder
            output_dir = vault_path / summaries_folder

            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)

            # Generate filename
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            filename = f"Weekly Summary {today}.md"
            file_path = output_dir / filename

            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            logger.info(f"Generated Obsidian summary: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error generating Obsidian summary: {e}")
            return None

    def _generate_obsidian_content(self, summaries: List[Dict[str, Any]]) -> str:
        """Generate Obsidian markdown content."""
        from datetime import datetime

        # Check if we're exporting a single weekly summary that's already formatted
        if len(summaries) == 1 and summaries[0].get('source_type') == 'weekly_summary':
            # Return the pre-formatted markdown directly without wrapping
            return summaries[0].get('summary', '')

        today = datetime.now().strftime("%Y-%m-%d")

        # Header matching V1 exactly
        markdown = f"# Weekly Content Summary\n\n"
        markdown += f"Generated on: {today}\n\n"

        # Reading progress checkbox
        markdown += "## Reading Progress\n\n"
        markdown += "- [ ] I've read this complete summary\n\n"

        # Sources section - gather all sources with titles
        all_sources = set()
        for summary in summaries:
            source_line = f'"{summary.get("source", "Unknown")}": {summary.get("title", "Untitled")}'
            all_sources.add(source_line)

        markdown += "## Sources\n\n"
        for source_line in sorted(all_sources):
            markdown += f"- {source_line}\n"
        markdown += "\n"

        # Separate newsletters vs podcasts
        newsletters = []
        podcasts = []

        for summary in summaries:
            source_type = summary.get("source_type", "").lower()
            source_name = summary.get("source", "").lower()

            if source_type == "podcast" or "podcast" in source_name:
                podcasts.append(summary)
            else:
                newsletters.append(summary)

        # Sort by source name
        newsletters.sort(key=lambda x: x.get("source", "").lower())
        podcasts.sort(key=lambda x: x.get("source", "").lower())

        # Newsletters section
        if newsletters:
            markdown += "## Newsletters\n\n"
            for summary in newsletters:
                markdown += self._format_v1_summary_section(summary)

        # Podcasts section
        if podcasts:
            markdown += "## Podcasts\n\n"
            for summary in podcasts:
                markdown += self._format_v1_summary_section(summary)

        return markdown

    def _format_v1_summary_section(self, summary: Dict[str, Any]) -> str:
        """Format a single summary section exactly like V1."""
        section = ""

        # Title (source + title)
        source = summary.get("source", "Unknown")
        title = summary.get("title", "Untitled")
        section += f'### "{source}": {title}\n\n'

        # Date
        date = summary.get("date", "Unknown")
        section += f"Date: {date}\n\n"

        # Summary section - use the text directly
        summary_text = summary.get("summary", "")
        if summary_text:
            section += "#### Summary\n\n"
            section += f"{summary_text}\n\n"

        # Questions for Experts section
        questions = summary.get("questions", [])
        if questions and len(questions) > 0:
            section += "#### Questions for Experts\n\n"
            for i, question in enumerate(questions, 1):
                clean_question = question.strip()
                if not clean_question.endswith('?'):
                    clean_question += '?'
                section += f"{i}. {clean_question}\n"
            section += "\n"

        # Links section
        links = summary.get("links", [])
        if links and len(links) > 0:
            section += "#### Links\n\n"
            for link in links:
                title_text = link.get("title", "Linked Article")
                url = link.get("url", "")
                if url:
                    section += f"- [{title_text}]({url})\n"
            section += "\n"

        return section

    def _format_summary_section(self, summary: Dict[str, Any]) -> str:
        """Format a single summary section for Obsidian."""
        try:
            # Extract basic info with safe defaults
            source = summary.get("source", "Unknown Source")
            title = summary.get("title", "Untitled")
            date = summary.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
            summary_text = summary.get("summary", "")
            questions = summary.get("questions", [])
            links = summary.get("links", [])

            # Start building the section
            markdown = f"### {source}: {title}\n\n"
            markdown += f"Date: {date}\n\n"

            # Add summary if present
            if summary_text:
                markdown += "#### Summary\n\n"
                markdown += f"{summary_text}\n\n"

            # Add questions if present
            if questions:
                markdown += "#### Questions\n\n"
                if isinstance(questions, list):
                    for question in questions:
                        markdown += f"- {question}\n"
                else:
                    # Handle case where questions might be a string
                    markdown += f"- {questions}\n"
                markdown += "\n"

            # Add links if present
            if links and len(links) > 0:
                markdown += "#### Links\n\n"
                for link in links:
                    title = link.get("title", "Linked Article")
                    url = link.get("url", "")
                    description = link.get("description", "")

                    # Add the link with title
                    markdown += f"- [{title}]({url})"

                    # Add description if available, keeping it concise
                    if description:
                        short_desc = description[:100] + "..." if len(description) > 100 else description
                        markdown += f" - {short_desc}"

                    markdown += "\n"
                markdown += "\n"

            return markdown

        except Exception as e:
            logger.error(f"Error formatting summary section: {e}")
            # Return basic format if there's an error
            source = summary.get("source", "Unknown Source")
            title = summary.get("title", "Untitled")
            return f"### {source}: {title}\n\n*Error formatting this section*\n\n"

    async def generate_json_export(self, summaries: List[Dict[str, Any]]) -> Optional[Path]:
        """
        Generate JSON export of summaries.

        Args:
            summaries: List of summary dictionaries

        Returns:
            Path to generated JSON file
        """
        try:
            if not summaries:
                logger.warning("No summaries provided for JSON export")
                return None

            # Prepare export data
            export_data = {
                "exported_at": datetime.datetime.now().isoformat(),
                "format": "json",
                "version": "2.0.0",
                "total_summaries": len(summaries),
                "summaries": summaries
            }

            # Generate filename
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            filename = f"newsletter_summaries_{today}.json"
            file_path = self.settings.exports_dir / filename

            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write JSON file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Generated JSON export: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error generating JSON export: {e}")
            return None

    async def generate_csv_export(self, summaries: List[Dict[str, Any]]) -> Optional[Path]:
        """
        Generate CSV export of summaries.

        Args:
            summaries: List of summary dictionaries

        Returns:
            Path to generated CSV file
        """
        try:
            if not summaries:
                logger.warning("No summaries provided for CSV export")
                return None

            # Generate filename
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            filename = f"newsletter_summaries_{today}.csv"
            file_path = self.settings.exports_dir / filename

            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Define CSV columns
            columns = [
                'date', 'source', 'title', 'source_type', 'summary',
                'tags', 'questions', 'content_length', 'chunks_processed'
            ]

            # Write CSV file
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=columns)
                writer.writeheader()

                for summary in summaries:
                    row = {}
                    for col in columns:
                        value = summary.get(col, '')

                        # Convert lists to strings for CSV
                        if isinstance(value, list):
                            value = '; '.join(str(item) for item in value)

                        row[col] = value

                    writer.writerow(row)

            logger.info(f"Generated CSV export: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error generating CSV export: {e}")
            return None

    async def generate_links_export(self, links: List[Dict[str, Any]],
                                    group_by: str = "date") -> Optional[Path]:
        """
        Generate markdown export of links.

        Args:
            links: List of link dictionaries
            group_by: How to group links ("date", "source", "tag")

        Returns:
            Path to generated markdown file
        """
        try:
            if not links:
                logger.warning("No links provided for export")
                return None

            # Generate filename
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            filename = f"Research Links {today}.md"
            file_path = self.settings.exports_dir / filename

            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Generate markdown content
            markdown_content = self._generate_links_markdown(links, group_by)

            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            logger.info(f"Generated links export: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error generating links export: {e}")
            return None

    def _generate_links_markdown(self, links: List[Dict[str, Any]], group_by: str) -> str:
        """Generate markdown content for links export."""
        today = datetime.datetime.now().strftime("%Y-%m-%d")

        markdown = "# Research Link Library\n\n"
        markdown += f"Generated on: {today}\n\n"

        if group_by == "date":
            # Group by date
            dates = {}
            for link in links:
                date = link.get("date", "Unknown")
                if date not in dates:
                    dates[date] = []
                dates[date].append(link)

            # Sort dates in reverse chronological order
            for date in sorted(dates.keys(), reverse=True):
                markdown += f"## {date}\n\n"

                # Group by source within each date
                sources = {}
                for link in dates[date]:
                    source = link.get("source", "Unknown")
                    if source not in sources:
                        sources[source] = []
                    sources[source].append(link)

                # Output links grouped by source
                for source in sorted(sources.keys()):
                    markdown += f"### {source}\n\n"

                    for link in sources[source]:
                        markdown += self._format_link_markdown(link)

                    markdown += "\n"

        elif group_by == "source":
            # Group by source
            sources = {}
            for link in links:
                source = link.get("source", "Unknown")
                if source not in sources:
                    sources[source] = []
                sources[source].append(link)

            # Output links grouped by source
            for source in sorted(sources.keys()):
                markdown += f"## {source}\n\n"

                for link in sources[source]:
                    date = link.get("date", "")
                    markdown += self._format_link_markdown(link, include_date=True)

                markdown += "\n"

        elif group_by == "tag":
            # Group by tags
            tag_groups = {}

            for link in links:
                tags_str = link.get("tags", "")
                if tags_str:
                    for tag in [t.strip() for t in tags_str.split(",")]:
                        if tag:
                            if tag not in tag_groups:
                                tag_groups[tag] = []
                            tag_groups[tag].append(link)

            # Output links grouped by tag
            for tag in sorted(tag_groups.keys()):
                markdown += f"## #{tag}\n\n"

                for link in tag_groups[tag]:
                    markdown += self._format_link_markdown(link, include_source_date=True)

                markdown += "\n"

        return markdown

    def _format_link_markdown(self, link: Dict[str, Any],
                              include_date: bool = False,
                              include_source_date: bool = False) -> str:
        """Format a single link as markdown."""
        title = link.get("title", "Linked Article")
        url = link.get("url", "")

        markdown = f"- [{title}]({url})"

        if include_date:
            date = link.get("date", "")
            markdown += f" *({date})*"

        if include_source_date:
            date = link.get("date", "")
            source = link.get("source", "")
            markdown += f" *({date}, {source})*"

        # Add description if available
        description = link.get("description", "")
        if description:
            short_desc = description[:100] + "..." if len(description) > 100 else description
            markdown += f" - {short_desc}"

        markdown += "\n"
        return markdown

    async def generate_custom_export(self, data: Dict[str, Any],
                                     template: str,
                                     output_filename: str) -> Optional[Path]:
        """
        Generate custom export using a template.

        Args:
            data: Data to export
            template: Template string with placeholders
            output_filename: Name of output file

        Returns:
            Path to generated file
        """
        try:
            # Use Jinja2-style template replacement (simple version)
            content = template

            # Replace basic placeholders
            replacements = {
                "{{ date }}": datetime.datetime.now().strftime("%Y-%m-%d"),
                "{{ timestamp }}": datetime.datetime.now().isoformat(),
                "{{ total_items }}": str(len(data.get("items", []))),
            }

            for placeholder, value in replacements.items():
                content = content.replace(placeholder, value)

            # Generate file path
            file_path = self.settings.exports_dir / output_filename
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            logger.info(f"Generated custom export: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error generating custom export: {e}")
            return None

    async def cleanup_temp_files(self):
        """Clean up temporary files created during export operations."""
        try:
            for temp_file in self.temp_files:
                if temp_file.exists():
                    temp_file.unlink()
                    logger.debug(f"Cleaned up temp file: {temp_file}")

            self.temp_files.clear()
            logger.info("Cleaned up all temporary export files")

        except Exception as e:
            logger.warning(f"Error cleaning up temp files: {e}")

    def get_export_formats(self) -> List[Dict[str, str]]:
        """
        Get list of available export formats.

        Returns:
            List of format dictionaries
        """
        return [
            {
                "name": "Obsidian Markdown",
                "key": "obsidian",
                "description": "Markdown format compatible with Obsidian",
                "file_extension": ".md"
            },
            {
                "name": "JSON",
                "key": "json",
                "description": "Structured JSON format for analysis",
                "file_extension": ".json"
            },
            {
                "name": "CSV",
                "key": "csv",
                "description": "Comma-separated values for spreadsheet analysis",
                "file_extension": ".csv"
            },
            {
                "name": "Links Markdown",
                "key": "links",
                "description": "Organized markdown export of all extracted links",
                "file_extension": ".md"
            }
        ]

    async def export_all_formats(self, summaries: List[Dict[str, Any]]) -> Dict[str, Optional[Path]]:
        """
        Export summaries in all available formats.

        Args:
            summaries: List of summary dictionaries

        Returns:
            Dictionary mapping format names to file paths
        """
        results = {}

        try:
            # Obsidian export
            results["obsidian"] = await self.generate_obsidian_summary(summaries)

            # JSON export
            results["json"] = await self.generate_json_export(summaries)

            # CSV export
            results["csv"] = await self.generate_csv_export(summaries)

            # Extract links from summaries for links export
            all_links = []
            for summary in summaries:
                links = summary.get("links", [])
                for link in links:
                    link_with_metadata = link.copy()
                    link_with_metadata["source"] = summary.get("source", "")
                    link_with_metadata["date"] = summary.get("date", "")
                    all_links.append(link_with_metadata)

            if all_links:
                results["links"] = await self.generate_links_export(all_links)

            successful_exports = sum(1 for path in results.values() if path is not None)
            logger.info(f"Generated {successful_exports} export files successfully")

            return results

        except Exception as e:
            logger.error(f"Error in export_all_formats: {e}")
            return results