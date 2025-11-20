#!/usr/bin/env python3
"""
AI Summarizer for Research Automation
Handles Claude API integration and content summarization

Enhanced with async support, better prompt templates, and improved parsing
"""

import asyncio
import re
from typing import Dict, Any, List, Optional
from anthropic import AsyncAnthropic

from ..core.config import get_settings
from ..core.logging import get_logger
from ..processing.content_cleaner import ContentCleaner

logger = get_logger(__name__)


class AISummarizer:
    """
    AI-powered content summarizer using Claude API.

    Handles content chunking, summarization, and insight extraction.
    """

    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncAnthropic(api_key=self.settings.claude_api_key)
        self.content_cleaner = ContentCleaner()

        # Chunk size for large content (characters)
        self.chunk_size = 10000

        # Priority tags for better summarization
        self.priority_tags = [
            "ai", "blockchain", "crypto", "finance", "markets",
            "business", "strategy", "longevity", "health", "policy",
            "gaming", "china", "geopolitics", "technology", "programming"
        ]

    async def test_api(self) -> bool:
        """
        Test Claude API connection.

        Returns:
            bool: True if API is working, False otherwise
        """
        try:
            response = await self.client.messages.create(
                model=self.settings.claude_model,
                max_tokens=50,
                messages=[{"role": "user", "content": "Hello, please respond with 'API test successful'"}]
            )

            result = response.content[0].text.strip()
            if "API test successful" in result:
                logger.info("Claude API test successful")
                return True
            else:
                logger.warning(f"Claude API test returned unexpected response: {result}")
                return False

        except Exception as e:
            logger.error(f"Claude API test failed: {e}")
            return False

    async def summarize_content(self, content_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Summarize a content item using Claude API.

        Args:
            content_item: Dictionary with content information

        Returns:
            Dictionary with summary, insights, questions, and tags
        """
        content = content_item.get("content", "")
        if not content:
            logger.warning(f"No content to summarize for {content_item.get('title', 'unknown')}")
            return self._create_empty_summary(content_item)

        # Clean content for AI processing
        cleaned_content = self.content_cleaner.clean_for_ai_processing(content)

        # Determine content type for appropriate prompt
        source_type = content_item.get("source_type", "newsletter")
        is_podcast = "podcast" in source_type.lower() or "podcast" in content_item.get("source", "").lower()

        try:
            # Break content into chunks if needed
            chunks = self._chunk_content(cleaned_content)

            if len(chunks) == 1:
                # Single chunk processing
                summary_data = await self._summarize_single_chunk(chunks[0], content_item, is_podcast)
            else:
                # Multi-chunk processing
                summary_data = await self._summarize_multiple_chunks(chunks, content_item, is_podcast)

            # Add metadata
            summary_data.update({
                "title": content_item.get("title", "Unknown"),
                "source": content_item.get("source", "Unknown"),
                "date": content_item.get("date", ""),
                "source_type": source_type,
                "content_length": len(content),
                "chunks_processed": len(chunks)
            })

            logger.info(f"Successfully summarized {content_item.get('source', 'unknown')}")
            return summary_data

        except Exception as e:
            logger.error(f"Error summarizing content from {content_item.get('source', 'unknown')}: {e}")
            return self._create_error_summary(content_item, str(e))

    def _chunk_content(self, content: str) -> List[str]:
        """Break content into manageable chunks."""
        if len(content) <= self.chunk_size:
            return [content]

        chunks = []
        for i in range(0, len(content), self.chunk_size):
            chunks.append(content[i:i + self.chunk_size])

        return chunks

    async def _summarize_single_chunk(self, content: str, content_item: Dict[str, Any], is_podcast: bool) -> Dict[str, Any]:
        """Summarize a single chunk of content."""
        prompt = self._build_prompt(content, content_item, is_podcast, is_final=True)

        response = await self.client.messages.create(
            model=self.settings.claude_model,
            max_tokens=self.settings.max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )

        full_response = response.content[0].text
        return self._parse_claude_response(full_response)

    async def _summarize_multiple_chunks(self, chunks: List[str], content_item: Dict[str, Any], is_podcast: bool) -> Dict[str, Any]:
        """Summarize multiple chunks and merge the results."""
        partial_summaries = []

        # Process each chunk
        for idx, chunk in enumerate(chunks, start=1):
            prompt = self._build_prompt(chunk, content_item, is_podcast, is_final=False, chunk_info=(idx, len(chunks)))

            response = await self.client.messages.create(
                model=self.settings.claude_model,
                max_tokens=1500,  # Smaller for partial summaries
                messages=[{"role": "user", "content": prompt}]
            )

            partial_response = response.content[0].text
            partial_summaries.append(partial_response)

            # Brief pause between API calls
            await asyncio.sleep(1)

        # Merge partial summaries
        return await self._merge_partial_summaries(partial_summaries, content_item, is_podcast)

    async def _merge_partial_summaries(self, partial_summaries: List[str], content_item: Dict[str, Any], is_podcast: bool) -> Dict[str, Any]:
        """Merge multiple partial summaries into a final summary."""
        combined_text = "\n\n---CHUNK BREAK---\n\n".join(partial_summaries)

        merge_prompt = self._build_merge_prompt(combined_text, content_item, is_podcast)

        response = await self.client.messages.create(
            model=self.settings.claude_model,
            max_tokens=self.settings.max_tokens,
            messages=[{"role": "user", "content": merge_prompt}]
        )

        full_response = response.content[0].text
        return self._parse_claude_response(full_response)

    def _build_prompt(self, content: str, content_item: Dict[str, Any], is_podcast: bool,
                      is_final: bool = True, chunk_info: Optional[tuple] = None) -> str:
        """Build appropriate prompt based on content type and processing stage."""
        source = content_item.get("source", "Unknown")
        title = content_item.get("title", "Unknown")
        priority_tags_formatted = ", ".join(self.priority_tags)

        if is_podcast:
            if is_final:
                return self._build_podcast_prompt(content, source, title, priority_tags_formatted)
            else:
                return self._build_podcast_chunk_prompt(content, source, title, priority_tags_formatted, chunk_info)
        else:
            if is_final:
                return self._build_newsletter_prompt(content, source, title, priority_tags_formatted)
            else:
                return self._build_newsletter_chunk_prompt(content, source, title, priority_tags_formatted, chunk_info)

    # Enhanced Prompt Methods for ai_summarizer.py

    def _build_newsletter_prompt(self, content: str, source: str, title: str, priority_tags: str) -> str:
        """Enhanced newsletter prompt for strategic analysis across all domains."""
        return f"""
    You are an expert analyst extracting actionable intelligence from content across all domains.

    Analyze this article from {source}: "{title}"

    CRITICAL: Focus on SPECIFIC INSIGHTS with concrete data points, not general descriptions.

    EXAMPLES OF SPECIFIC EXTRACTION:
    ✅ GOOD: "Nvidia's data center revenue grew 427% year-over-year to $47.5B, with AI inference workloads representing 40% of total compute demand"
    ✅ GOOD: "Suburban voter turnout increased 23% in midterms, with college-educated demographics driving 31% of swing state results"
    ✅ GOOD: "NAD+ levels decline 50% by age 50, with supplementation showing 20-30% cellular energy improvement in 18-month trials"
    ✅ GOOD: "European GDPR fines increased 345% in 2024, averaging €12M per violation across 15 major enforcement actions"
    ❌ BAD: "Article discusses technology developments and market trends"
    ❌ BAD: "Coverage of aging research and longevity interventions"

    EXTRACTION REQUIREMENTS:
    - Extract specific metrics, growth rates, and quantified results
    - Include organization names, key figures, and concrete details
    - Capture significant findings with supporting evidence and timeframes
    - Focus on information valuable for informed decision-making in any domain
    - Identify trends with measurable implications and specific outcomes

    Your response MUST follow these exact formatting guidelines:

    1. Begin with "SUMMARY:" followed by 4-6 bullet points (use asterisks * for bullets)
       - Each bullet should contain specific findings with numbers, percentages, or concrete details
       - Include organization names, key figures, technologies, and measurable outcomes
       - Focus on actionable intelligence valuable for informed decision-making
       - Extract meaningful data points and significant revelations across any domain

    2. Then include "QUESTIONS FOR EXPERTS:" followed by 2-3 numbered questions (use simple 1. 2. 3. format)
       - Probe deeper implications of specific findings
       - Frame for domain experts who could validate or challenge the insights
       - Focus on implications valuable for researchers, analysts, or practitioners in the relevant field

    3. End with "TAGS:" followed by 3-5 relevant tags
       - Priority categories: {priority_tags}
       - Include specific technologies, organizations, research areas, or key concepts mentioned

    Do not include standalone "#" symbols, markdown headers, or other formatting elements.

    Here's the content to analyze:

    {content[:15000]}
    """

    def _build_podcast_prompt(self, content: str, source: str, title: str, priority_tags: str) -> str:
        """Enhanced podcast prompt for specific insights and predictions."""
        return f"""
    You are an expert analyst extracting actionable intelligence from podcast content for business professionals.

    Extract specific insights from this podcast: {source}: "{title}"

    CRITICAL: Focus on SPECIFIC CLAIMS, PREDICTIONS, and DATA POINTS, not general discussion topics.

    EXAMPLES OF SPECIFIC INSIGHT EXTRACTION:
    ✅ GOOD: "Inflation expected to decline to 2.3% by Q3 2025 according to Federal Reserve projections, with energy costs driving 60% of current inflationary pressure"
    ✅ GOOD: "Figure generated $1B+ trading volume but platform appears to be shrinking based on 40% decline in daily active users over 6 months"
    ✅ GOOD: "Longevity research shows NAD+ levels decline 50% by age 50, with supplementation showing 20-30% cellular energy improvement in 18-month trials"
    ❌ BAD: "Hosts discussed inflation trends and economic outlook"
    ❌ BAD: "Conversation covered technology developments in AI sector"

    EXTRACTION REQUIREMENTS:
    - Specific predictions with timeframes and numbers
    - Financial metrics, growth rates, and quantified claims
    - Company-specific developments with concrete details
    - Technology trends with adoption rates or market sizes
    - Strategic moves with business rationale and expected outcomes

    Your response MUST follow these exact formatting guidelines:

    1. Begin with "SUMMARY:" followed by 4-6 bullet points (use asterisks * for bullets)
       - Each bullet should contain specific claims, predictions, or quantified insights
       - Include exact numbers, percentages, organization names, and timeframes
       - Focus on information valuable for informed decision-making across any domain
       - Extract actual facts and claims, not discussion topics

    2. Then include "QUESTIONS FOR EXPERTS:" followed by 2-3 numbered questions (use simple 1. 2. 3. format)
       - Probe deeper into implications of specific claims or predictions
       - Frame for domain experts who could validate or challenge the insights
       - Focus on research depth, methodological questions, or practical implications

    3. End with "TAGS:" followed by 3-5 relevant tags
       - Priority categories: {priority_tags}
       - Include specific technologies, organizations, research areas, or key concepts mentioned

    Do not include standalone "#" symbols, markdown headers, or other formatting elements.

    Here's the content to analyze:

    {content[:15000]}
    """

    def _build_merge_prompt(self, combined_text: str, content_item: Dict[str, Any], is_podcast: bool) -> str:
        """Enhanced merge prompt maintaining strategic depth across all domains."""
        source = content_item.get("source", "Unknown")
        title = content_item.get("title", "Unknown")
        content_type = "podcast episode" if is_podcast else "article"
        priority_tags_formatted = ", ".join(self.priority_tags)

        return f"""
    You are an expert analyst synthesizing strategic insights from multiple content chunks across all domains.

    Combine these partial analyses from {source}: "{title}" into comprehensive strategic intelligence.

    SYNTHESIS REQUIREMENTS:
    - Merge related insights across chunks into comprehensive strategic points
    - Eliminate redundancy while preserving concrete details and numbers
    - Maintain analytical depth and informational value
    - Focus on insights valuable for researchers, analysts, and informed practitioners
    - Preserve all specific metrics, organization names, and quantified data

    Your response MUST follow these exact formatting guidelines:

    1. Begin with "SUMMARY:" followed by 5-6 bullet points (use asterisks * for bullets)
       - Synthesize the most significant insights across all chunks
       - Preserve concrete numbers, organization names, and specific details
       - Each bullet should provide substantial informational value
       - Connect developments to broader implications within the relevant domain

    2. Then include "QUESTIONS FOR EXPERTS:" followed by 2-3 numbered questions (use simple 1. 2. 3. format)
       - Combine and refine questions into the most substantive inquiries
       - Focus on implications valuable to domain experts and researchers

    3. End with "TAGS:" followed by 3-5 relevant tags
       - Synthesize tags representing overall themes
       - Priority categories: {priority_tags_formatted}

    Do not include standalone "#" symbols, markdown headers, or other formatting elements.

    Here are the partial summaries to synthesize:
    {combined_text}
    """

    # Also update the chunk prompts to maintain consistency:

    def _build_newsletter_chunk_prompt(self, content: str, source: str, title: str, priority_tags: str,
                                       chunk_info: tuple) -> str:
        """Enhanced newsletter chunk prompt for strategic analysis across all domains."""
        idx, total = chunk_info
        return f"""
    You are an expert analyst creating strategic summaries across all domains.

    Analyze chunk #{idx} of {total} from {source}: "{title}".

    FOCUS: Extract specific insights with concrete data points, not general descriptions.

    Your response MUST follow these exact formatting guidelines:

    1. Begin with "SUMMARY:" followed by 2-4 bullet points (use asterisks * for bullets)
       - Focus on specific findings with numbers, percentages, or concrete details
       - Include organization names and significant implications where present
    2. Then include "QUESTIONS FOR EXPERTS:" followed by 1-2 numbered questions (use simple 1. 2. format)
    3. End with "TAGS:" followed by 2-3 relevant tags.

    For tags, consider these priority categories: {priority_tags}

    Do not include standalone "#" symbols, markdown headers, or other formatting elements.

    Chunk #{idx} of {total}:
    {content}
    """

    def _build_podcast_chunk_prompt(self, content: str, source: str, title: str, priority_tags: str,
                                    chunk_info: tuple) -> str:
        """Enhanced podcast chunk prompt for specific insights across all domains."""
        idx, total = chunk_info
        return f"""
    You are an expert analyst extracting specific insights from podcast content across all domains.

    Extract specific claims and data points from chunk #{idx} of {total} from {source}: "{title}".

    FOCUS: Specific insights, claims, and actionable takeaways with concrete details.

    Your response MUST follow these exact formatting guidelines:

    1. Begin with "SUMMARY:" followed by 2-4 bullet points (use asterisks * for bullets)
       - Each bullet should contain specific claims, facts, or quantified insights
       - Include exact numbers, percentages, and concrete details where mentioned
    2. Then include "QUESTIONS FOR EXPERTS:" followed by 1-2 numbered questions (use simple 1. 2. format)
    3. End with "TAGS:" followed by 2-3 relevant tags.

    For tags, consider these priority categories: {priority_tags}

    Do not include standalone "#" symbols, markdown headers, or other formatting elements.

    Chunk #{idx} of {total}:
    {content}
    """


    def _parse_claude_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse Claude's response and extract summary, questions, and tags.

        Args:
            response_text: Raw response from Claude

        Returns:
            Dictionary with parsed components
        """
        try:
            # Extract sections (case-insensitive)
            summary_match = re.search(
                r'(?:SUMMARY|Summary)\s*[:.\-]\s*(.*?)(?=(?:QUESTIONS(?: FOR EXPERTS)?|Tags?|$))',
                response_text, re.DOTALL | re.IGNORECASE
            )
            questions_match = re.search(
                r'(?:QUESTIONS(?: FOR EXPERTS)?|Questions(?: for Experts)?)\s*[:.\-]\s*(.*?)(?=(?:Tags?|$))',
                response_text, re.DOTALL | re.IGNORECASE
            )
            tags_match = re.search(
                r'(?:TAGS|Tags)\s*[:.\-]\s*(.*)$',
                response_text, re.DOTALL | re.IGNORECASE
            )

            summary = (summary_match.group(1).strip() if summary_match else "No summary available.")
            # Normalize markdown noise
            summary = re.sub(r'(?m)^\s*#+\s*', '', summary).strip()

            # Questions: split by line, strip numbering/bullets
            questions: List[str] = []
            if questions_match:
                for line in questions_match.group(1).splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    q = re.sub(r'^\s*[-•*]?\s*(\d+\.|\(\d+\))?\s*', '', line).strip()
                    if q:
                        questions.append(q)

            # Tags: accept '#tag' or words separated by commas/spaces
            tags: List[str] = []
            if tags_match:
                raw = re.sub(r'(?m)^\s*#+\s*', '', tags_match.group(1)).strip()
                pieces = re.findall(r'#?[A-Za-z0-9][A-Za-z0-9_\-]+', raw)
                tags = self._process_tags([p.lstrip('#') for p in pieces])

            return {
                "summary": summary,
                "questions": questions,
                "tags": tags,
                "insights": self._extract_insights_from_summary(summary),
                "raw_response": response_text
            }

        except Exception as e:
            logger.error(f"Error parsing Claude response: {e}")
            return {
                "summary": "Error parsing summary",
                "questions": [],
                "tags": [],
                "insights": [],
                "raw_response": response_text,
                "error": str(e)
            }

    def _process_tags(self, tags_list: List[str]) -> List[str]:
        """Process tags to improve quality and remove redundancy."""
        tags_list = [t.lower() for t in tags_list if len(t) > 1]
        # De-dup while preserving order
        seen = set()
        unique = [t for t in tags_list if not (t in seen or seen.add(t))]
        # Prefer priority tags
        priorities = {t.lower() for t in self.priority_tags}
        final = [t for t in unique if t in priorities]
        # Fill up to 3–5 tags
        other = [t for t in unique if t not in priorities]
        while len(final) < 3 and other:
            final.append(other.pop(0))
        return final[:5]

    def _extract_insights_from_summary(self, summary_text: str) -> List[str]:
        """Extract individual insights from the summary text."""
        insights: List[str] = []
        for line in summary_text.splitlines():
            line = line.strip()
            if (line.startswith(('*', '-', '•')) or re.match(r'^\d+\.', line)) and len(line) > 3:
                insights.append(re.sub(r'^\s*[-•*]?\s*(\d+\.|\(\d+\))?\s*', '', line).strip())
        return insights

    async def extract_insights(self, summary_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract structured insights from summary data for database storage.

        Args:
            summary_data: Dictionary with summary information

        Returns:
            List of insight dictionaries
        """
        insights_out: List[Dict[str, Any]] = []
        for insight in summary_data.get("insights", []):
            insights_out.append({
                "source": summary_data.get("source", "Unknown"),
                "topic": ", ".join(summary_data.get("tags", [])[:3]),
                "insight": insight,
                "tags": summary_data.get("tags", []),
                "date": summary_data.get("date", ""),
            })
        return insights_out

    def _create_empty_summary(self, content_item: Dict[str, Any]) -> Dict[str, Any]:
        """Create an empty summary structure for content with no text."""
        return {
            "title": content_item.get("title", "Unknown"),
            "source": content_item.get("source", "Unknown"),
            "date": content_item.get("date", ""),
            "source_type": content_item.get("source_type", "unknown"),
            "summary": "No content available for summarization.",
            "questions": [],
            "tags": [],
            "insights": [],
            "content_length": 0,
            "chunks_processed": 0,
            "error": "No content provided"
        }

    def _create_error_summary(self, content_item: Dict[str, Any], error_message: str) -> Dict[str, Any]:
        """Create an error summary structure when processing fails."""
        return {
            "title": content_item.get("title", "Unknown"),
            "source": content_item.get("source", "Unknown"),
            "date": content_item.get("date", ""),
            "source_type": content_item.get("source_type", "unknown"),
            "summary": f"Summarization failed: {error_message}",
            "questions": [],
            "tags": ["error"],
            "insights": [],
            "content_length": len(content_item.get("content", "")),
            "chunks_processed": 0,
            "error": error_message
        }