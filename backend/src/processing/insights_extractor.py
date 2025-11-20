#!/usr/bin/env python3
"""
Enhanced Insights Extractor for Research Automation
Extracts strategic insights from summaries using AI, not just bullet points

Replaces the basic bullet-point copying from V1 with strategic fact extraction
"""

import re
import datetime
from typing import List, Dict, Any, Optional
from ..core.logging import ProcessingLogger

logger = ProcessingLogger("insights", "extraction")


class EnhancedInsightsExtractor:
    """Extract strategic insights from summaries, not just bullet points."""

    def __init__(self, ai_summarizer):
        self.ai_summarizer = ai_summarizer

    async def extract_strategic_insights(self, summary_data: Dict[str, Any]) -> List[str]:
        """
        Extract 2-3 strategic insights from a completed summary.

        Focus on memorable facts, strategic revelations, and key data points.
        """
        summary_text = summary_data.get('summary', '')
        source = summary_data.get('source', 'Unknown')
        title = summary_data.get('title', 'Unknown')

        if not summary_text:
            logger.warning(f"No summary text found for {source}: {title}")
            return []

        extraction_prompt = self._build_strategic_extraction_prompt(
            summary_text, source, title
        )

        try:
            response = await self.ai_summarizer.client.messages.create(
                model=self.ai_summarizer.settings.claude_model,
                max_tokens=600,  # Focused on key facts
                messages=[{"role": "user", "content": extraction_prompt}]
            )

            insights_text = response.content[0].text
            strategic_insights = self._parse_strategic_insights(insights_text)

            logger.info(f"Extracted {len(strategic_insights)} strategic insights from {source}")
            return strategic_insights

        except Exception as e:
            # Fallback to simple extraction if AI fails
            logger.warning(f"AI insights extraction failed for {source}, using fallback: {e}")
            return self._fallback_insights_extraction(summary_text)

    def _build_strategic_extraction_prompt(self, summary_text: str, source: str, title: str) -> str:
        """Build prompt to extract strategic insights, not bullet points."""
        return f"""
You are an expert at identifying memorable insights and key facts across all domains.

From this analysis of {source}: "{title}", extract 2-3 specific insights that are worth remembering long-term.

WHAT MAKES A MEMORABLE INSIGHT:
✅ Specific findings with numbers, percentages, or quantified results
✅ Strategic revelations about organizations, policies, or systems
✅ Unexpected or counterintuitive discoveries  
✅ Data points useful for future decision-making in the relevant domain
✅ Trends or patterns with broad implications

EXAMPLES OF MEMORABLE INSIGHTS:
✅ "Figure generated $1B+ trading volume but platform appears to be shrinking"
✅ "NAD+ levels decline 50% by age 50, with supplementation showing 20-30% cellular energy improvement"
✅ "Suburban voter turnout increased 23% in midterms, driven by college-educated demographics"
✅ "Meta's AI training costs reached $15B annually, requiring 40% of total R&D budget"
✅ "Metformin reduces age-related muscle loss by 25% over 18 months at 1000mg twice daily"
✅ "Carbon capture technology reached $180/ton efficiency, making renewable transition 15% more cost-effective"

AVOID GENERIC DESCRIPTIONS:
❌ "Discussion focused on cryptocurrency developments"
❌ "Research covered aging and longevity topics" 
❌ "Analysis of political trends and voter behavior"
❌ "Coverage of AI technology announcements"
❌ "Overview of climate policy developments"

CRITICAL: Extract SPECIFIC FACTS and SUBSTANTIAL FINDINGS, not topic descriptions.

Format your response as:

INSIGHTS:
1. [Specific strategic insight with numbers/organizations/concrete details]
2. [Another memorable fact or strategic revelation]
3. [Third strategic insight if applicable]

Here's the summary to extract insights from:

{summary_text}
"""

    def _parse_strategic_insights(self, insights_text: str) -> List[str]:
        """Parse insights response into clean strategic facts."""
        insights = []

        # Extract insights from numbered list
        lines = insights_text.split('\n')
        current_insight = ""

        for line in lines:
            line = line.strip()
            if re.match(r'^\d+\.', line):  # Numbered insight
                if current_insight and len(current_insight.strip()) > 20:
                    insights.append(current_insight.strip())
                current_insight = re.sub(r'^\d+\.\s*', '', line)
            elif line and current_insight and not line.startswith('INSIGHTS:'):
                current_insight += " " + line

        # Add final insight
        if current_insight and len(current_insight.strip()) > 20:
            insights.append(current_insight.strip())

        # Filter out generic insights
        strategic_insights = []
        generic_phrases = [
            "discussion focused on", "analysis of", "coverage of",
            "exploration of", "conversation covered", "hosts discussed"
        ]

        for insight in insights:
            is_strategic = True
            for phrase in generic_phrases:
                if phrase.lower() in insight.lower():
                    is_strategic = False
                    break

            if is_strategic and len(insight) > 30:  # Must be substantial
                strategic_insights.append(insight)

        return strategic_insights[:3]  # Max 3 insights

    def _fallback_insights_extraction(self, summary_text: str) -> List[str]:
        """Fallback method if AI extraction fails - extract meaningful bullet points."""
        insights = []

        lines = summary_text.split('\n')
        for line in lines:
            line = line.strip()
            # Look for bullet points or numbered items
            if (line.startswith('*') or line.startswith('-') or re.match(r'^\d+\.', line)) and len(line) > 20:
                # Clean up the line
                cleaned = re.sub(r'^[-*\d\.]+\s*', '', line).strip()
                if len(cleaned) > 30 and any(char.isdigit() for char in cleaned):  # Prefer lines with numbers
                    insights.append(cleaned)

        logger.info(f"Fallback extraction found {len(insights)} insights")
        return insights[:3]  # Max 3 insights