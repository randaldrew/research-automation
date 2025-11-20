#!/usr/bin/env python3
"""
Main API routes for Research Automation
Handles processing, status, and data retrieval endpoints
"""

import asyncio
import aiosqlite
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from pathlib import Path
import tempfile
from fastapi.responses import Response

from ...core.config import get_settings
from ...core.engine import ProcessingEngine
from ...core.logging import get_logger
from ...storage.database import DatabaseManager

logger = get_logger(__name__)
router = APIRouter()

# Global processing engine instance
processing_engine = ProcessingEngine()
db_manager = None  # Will be initialized during app startup

def set_database_manager(initialized_db_manager):
    """Set the global database manager instance"""
    global db_manager
    db_manager = initialized_db_manager
    logger.info("Database manager initialized for API routes")

def get_db_manager():
    """Get the database manager with safety check"""
    if db_manager is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db_manager
# WebSocket connections for real-time updates
websocket_connections: List[WebSocket] = []


class ProcessingRequest(BaseModel):
    """Request model for processing trigger"""
    force_reprocess: Optional[bool] = False
    max_items: Optional[int] = None


class SearchRequest(BaseModel):
    """Request model for search operations"""
    query: str
    limit: Optional[int] = 20
    type: Optional[str] = "summaries"  # summaries, links, insights


# WebSocket endpoint for real-time processing updates
@router.websocket("/ws/processing")
async def websocket_processing_updates(websocket: WebSocket):
    """WebSocket endpoint for real-time processing updates"""
    await websocket.accept()
    websocket_connections.append(websocket)

    logger.info("WebSocket client connected for processing updates")

    try:
        # Send current status immediately
        current_status = processing_engine.get_current_state()
        await websocket.send_json({
            "type": "status_update",
            "data": current_status
        })

        # Keep connection alive
        while True:
            try:
                # Wait for client ping or send periodic status updates
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)

                if data == "ping":
                    await websocket.send_json({"type": "pong"})
                elif data == "status":
                    current_status = processing_engine.get_current_state()
                    await websocket.send_json({
                        "type": "status_update",
                        "data": current_status
                    })

            except asyncio.TimeoutError:
                # Send periodic status update
                current_status = processing_engine.get_current_state()
                await websocket.send_json({
                    "type": "status_update",
                    "data": current_status
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
        websocket_connections.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in websocket_connections:
            websocket_connections.remove(websocket)


async def broadcast_to_websockets(message: Dict[str, Any]):
    """Broadcast message to all connected WebSocket clients"""
    if not websocket_connections:
        return

    disconnected = []
    for websocket in websocket_connections:
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send WebSocket message: {e}")
            disconnected.append(websocket)

    # Remove disconnected websockets
    for ws in disconnected:
        websocket_connections.remove(ws)


def processing_progress_callback(state):
    """Callback for processing progress updates"""
    asyncio.create_task(broadcast_to_websockets({
        "type": "processing_update",
        "data": state.to_dict()
    }))


# Add callback to processing engine
processing_engine.add_progress_callback(processing_progress_callback)


@router.post("/process/start")
async def start_processing(request: ProcessingRequest, background_tasks: BackgroundTasks):
    """
    Start the newsletter processing workflow.

    Args:
        request: Processing configuration
        background_tasks: FastAPI background tasks

    Returns:
        Processing status and run ID
    """
    try:
        # Check if processing is already running
        current_state = processing_engine.get_current_state()
        if current_state["status"] == "running":
            return {
                "message": "Processing is already running",
                "status": current_state["status"],
                "current_step": current_state["current_step"],
                "progress": current_state["progress"]
            }

        # Start processing in background
        background_tasks.add_task(run_processing_workflow)

        return {
            "message": "Processing started successfully",
            "status": "started",
            "websocket_url": "/api/v1/ws/processing"
        }

    except Exception as e:
        logger.error(f"Error starting processing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")


async def run_processing_workflow():
    """Background task for running the complete processing workflow"""
    try:
        await processing_engine.run_full_processing()

        # Broadcast completion
        await broadcast_to_websockets({
            "type": "processing_complete",
            "data": processing_engine.get_current_state()
        })

    except Exception as e:
        logger.error(f"Processing workflow failed: {e}")

        # Broadcast error
        await broadcast_to_websockets({
            "type": "processing_error",
            "data": {
                "error": str(e),
                "state": processing_engine.get_current_state()
            }
        })


@router.get("/process/status")
async def get_processing_status():
    """
    Get current processing status.

    Returns:
        Current processing state
    """
    try:
        return processing_engine.get_current_state()

    except Exception as e:
        logger.error(f"Error getting processing status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get processing status: {str(e)}")


@router.post("/process/stop")
async def stop_processing():
    """
    Stop current processing (if running).

    Returns:
        Stop confirmation
    """
    try:
        # Note: This is a placeholder - actual implementation would need
        # to handle graceful stopping of the processing engine
        current_state = processing_engine.get_current_state()

        if current_state["status"] != "running":
            return {"message": "No processing is currently running"}

        # TODO: Implement graceful stopping mechanism
        return {
            "message": "Stop request received",
            "note": "Graceful stopping will be implemented in next iteration"
        }

    except Exception as e:
        logger.error(f"Error stopping processing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to stop processing: {str(e)}")


@router.get("/summaries")
async def get_summaries(limit: int = 10, offset: int = 0):
    """
    Get recent summaries.

    Args:
        limit: Maximum number of summaries to return
        offset: Number of summaries to skip

    Returns:
        List of summaries with metadata
    """
    try:
        summaries = await get_db_manager().get_recent_summaries(limit=limit)

        # Apply offset manually (SQLite pagination)
        if offset > 0:
            summaries = summaries[offset:]

        return {
            "summaries": summaries,
            "total": len(summaries),
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Error getting summaries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get summaries: {str(e)}")


@router.post("/search")
async def search_content(request: SearchRequest):
    """Enhanced search with links support"""
    try:
        if request.type == "summaries":
            results = await get_db_manager().search_summaries(request.query, request.limit)
            return {
                "type": "summaries",
                "query": request.query,
                "results": results,
                "total": len(results)
            }
        elif request.type == "links":
            results = await get_db_manager().search_links(request.query, request.limit)
            return {
                "type": "links",
                "query": request.query,
                "results": results,
                "total": len(results)
            }
        else:
            return {
                "type": request.type,
                "query": request.query,
                "results": [],
                "total": 0,
                "note": f"Search for {request.type} not yet implemented"
            }

    except Exception as e:
        logger.error(f"Error searching content: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/statistics")
async def get_statistics():
    """
    Get application statistics.

    Returns:
        Various application statistics
    """
    try:
        db_stats = await get_db_manager().get_statistics()

        # Add processing engine stats
        processing_state = processing_engine.get_current_state()

        # Get last run from database
        last_run = None
        try:
            async with aiosqlite.connect(get_db_manager().db_path) as db:
                cursor = await db.execute('''
                                          SELECT end_time
                                          FROM processing_runs
                                          WHERE status = 'completed'
                                          ORDER BY end_time DESC LIMIT 1
                                          ''')
                row = await cursor.fetchone()
                if row and row[0]:
                    last_run = row[0]
        except Exception as e:
            logger.error(f"Error getting last run: {e}")

        stats = {
            "database": db_stats,
            "processing": {
                "current_status": processing_state["status"],
                "last_run": last_run,  # ✅ FROM DATABASE
                "total_processing_runs": db_stats.get("processing_runs_count", 0)
            },
            "system": {
                "websocket_connections": len(websocket_connections),
                "database_path": str(get_db_manager().db_path),
            }
        }
        return stats

    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.get("/export")
async def export_data(format: str = "json"):
    """
    Export all data from the system.

    Args:
        format: Export format (json, csv, etc.)

    Returns:
        Exported data
    """
    try:
        if format.lower() != "json":
            raise HTTPException(status_code=400, detail="Only JSON export is currently supported")

        export_data = await get_db_manager().export_data(format="json")

        return {
            "format": format,
            "exported_at": export_data["exported_at"],
            "total_records": export_data["total_records"],
            "data": export_data
        }

    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")


@router.get("/health")
async def health_check():
    """
    Comprehensive health check for all system components.

    Returns:
        Health status of all components
    """
    try:
        from datetime import datetime, timezone

        health_status = {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),  # Fixed: Real timestamp
            "components": {}
        }

        # Test database connection
        try:
            db_healthy = await get_db_manager().test_connection()
            health_status["components"]["database"] = {
                "status": "healthy" if db_healthy else "unhealthy",
                "details": "Database connection successful" if db_healthy else "Database connection failed"
            }
        except Exception as e:
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "details": f"Database error: {str(e)}"
            }

        # Test Claude API
        try:
            claude_healthy = await processing_engine.ai_summarizer.test_api()
            health_status["components"]["claude_api"] = {
                "status": "healthy" if claude_healthy else "unhealthy",
                "details": "Claude API connection successful" if claude_healthy else "Claude API connection failed"
            }
        except Exception as e:
            health_status["components"]["claude_api"] = {
                "status": "unhealthy",
                "details": f"Claude API error: {str(e)}"
            }

        # Test email connection
        try:
            email_healthy = await processing_engine.email_client.test_connection()
            health_status["components"]["email"] = {
                "status": "healthy" if email_healthy else "unhealthy",
                "details": "Email connection successful" if email_healthy else "Email connection failed"
            }
        except Exception as e:
            health_status["components"]["email"] = {
                "status": "unhealthy",
                "details": f"Email error: {str(e)}"
            }

        # Overall status
        component_statuses = [comp["status"] for comp in health_status["components"].values()]
        if all(status == "healthy" for status in component_statuses):
            health_status["status"] = "healthy"
        elif any(status == "healthy" for status in component_statuses):
            health_status["status"] = "degraded"
        else:
            health_status["status"] = "unhealthy"

        return health_status

    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()  # Fixed: Real timestamp
        }


@router.get("/test")
async def test_all_components():
    """
    Test all system components individually.

    Returns:
        Detailed test results for each component
    """
    try:
        test_results = await processing_engine.test_configuration()

        return {
            "message": "Component tests completed",
            "results": test_results,
            "overall_status": "healthy" if all(test_results.values()) else "issues_detected"
        }

    except Exception as e:
        logger.error(f"Error testing components: {e}")
        raise HTTPException(status_code=500, detail=f"Component testing failed: {str(e)}")


@router.get("/logs")
async def get_recent_logs(lines: int = 100):
    """
    Get recent application logs.

    Args:
        lines: Number of recent log lines to return

    Returns:
        Recent log entries
    """
    try:
        # Get current processing state which includes recent logs
        current_state = processing_engine.get_current_state()

        return {
            "total_lines": len(current_state.get("logs", [])),
            "requested_lines": lines,
            "logs": current_state.get("logs", [])[-lines:]
        }

    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get logs: {str(e)}")


@router.get("/links")
async def get_links(
        limit: int = 20,
        offset: int = 0,
        source: Optional[str] = None,
        enriched: Optional[bool] = None,
        visited: Optional[bool] = None
):
    """
    Get links with pagination and filtering.
    """
    try:
        result = await get_db_manager().get_links(
            limit=limit,
            offset=offset,
            source=source,
            enriched=enriched,
            visited=visited
        )
        return result

    except Exception as e:
        logger.error(f"Error getting links: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get links: {str(e)}")


@router.put("/links/{link_id}/visited")
async def mark_link_visited(link_id: int):
    """
    Mark a link as visited.
    """
    try:
        success = await get_db_manager().mark_link_visited(link_id)

        if not success:
            raise HTTPException(status_code=404, detail="Link not found")

        return {"success": True, "message": "Link marked as visited"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking link as visited: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark link as visited: {str(e)}")


@router.get("/links/analytics")
async def get_links_analytics():
    """
    Get analytics data for links.
    """
    try:
        analytics = await get_db_manager().get_links_analytics()
        return analytics

    except Exception as e:
        logger.error(f"Error getting links analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.post("/search")
async def search_content(request: SearchRequest):
    """Enhanced search with links support"""
    try:
        if request.type == "summaries":
            results = await get_db_manager().search_summaries(request.query, request.limit)
            return {
                "type": "summaries",
                "query": request.query,
                "results": results,
                "total": len(results)
            }
        elif request.type == "links":
            results = await get_db_manager().search_links(request.query, request.limit)
            return {
                "type": "links",
                "query": request.query,
                "results": results,
                "total": len(results)
            }
        else:
            return {
                "type": request.type,
                "query": request.query,
                "results": [],
                "total": 0,
                "note": f"Search for {request.type} not yet implemented"
            }

    except Exception as e:
        logger.error(f"Error searching content: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/processing/generate-weekly-summary")
async def generate_weekly_summary():
    """
    Generate weekly summary in V1 format and export to Obsidian.

    Returns:
        Summary generation status and file path
    """
    try:
        from ...storage.export_manager import ExportManager
        from datetime import datetime, timedelta

        # Get recent summaries from database
        since_date = datetime.now() - timedelta(days=7)
        summaries = await get_db_manager().get_summaries_since(since_date)

        if not summaries:
            return {
                "success": False,
                "message": "No summaries found for the past week"
            }

        # Generate V1 format content using ExportManager
        export_manager = ExportManager()
        markdown_content = export_manager._generate_obsidian_content(summaries)

        # Store weekly summary in database
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
        weekly_id = await get_db_manager().store_summary(weekly_summary)

        # Export to Obsidian file
        file_path = await export_manager.generate_obsidian_summary([weekly_summary])

        if file_path:
            return {
                "success": True,
                "message": f"Weekly summary generated successfully",
                "file_path": str(file_path),
                "summaries_count": len(summaries),
                "weekly_summary_id": weekly_id
            }
        else:
            return {
                "success": False,
                "message": "Failed to generate weekly summary file"
            }

    except Exception as e:
        logger.error(f"Error generating weekly summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate weekly summary: {str(e)}")

@router.get("/summaries/{summary_id}/download")
async def download_summary_markdown(summary_id: int):
    """
    Download individual summary as markdown file.

    Args:
        summary_id: ID of the summary to download

    Returns:
        Markdown file download
    """
    try:
        from ...storage.export_manager import ExportManager

        summary = await get_db_manager().get_summary_by_id(summary_id)

        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")

        # Generate markdown content for individual summary
        export_manager = ExportManager()

        if summary.get("source_type") == "weekly_summary":
            # For weekly summaries, use the stored markdown content
            markdown_content = summary.get("summary", "")
            filename = f"Weekly_Summary_{summary.get('date', 'unknown')}.md"
        else:
            # For individual summaries, format as single section
            markdown_content = export_manager._format_summary_section(summary)
            source = summary.get("source", "Unknown").replace(" ", "_")
            date = summary.get("date", "unknown")
            filename = f"{source}_{date}.md"

        # Return as file download
        return Response(
            content=markdown_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        logger.error(f"Error downloading summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download summary: {str(e)}")


@router.get("/processing/download-weekly-summary")
async def download_latest_weekly_summary():
    """
    Download the most recent weekly summary as markdown.

    Returns:
        Markdown file download of latest weekly summary
    """
    try:
        # Get the most recent weekly summary
        weekly_summary = await get_db_manager().get_latest_weekly_summary()

        if not weekly_summary:
            raise HTTPException(status_code=404, detail="No weekly summary found")

        markdown_content = weekly_summary.get("summary", "")
        date = weekly_summary.get("date", "unknown")
        filename = f"Weekly_Summary_{date}.md"

        return Response(
            content=markdown_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        logger.error(f"Error downloading weekly summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download weekly summary: {str(e)}")


@router.post("/processing/generate-and-download-weekly-summary")
async def generate_and_download_weekly_summary():
    """
    Generate and immediately download weekly summary in V1 format.

    Returns:
        Direct markdown file download
    """
    try:
        # REPLACE WITH:
        from ...storage.export_manager import ExportManager
        from datetime import datetime, timedelta

        # Get recent summaries
        since_date = datetime.now() - timedelta(days=7)
        summaries = await get_db_manager().get_summaries_since(since_date)

        if not summaries:
            raise HTTPException(status_code=404, detail="No summaries found for the past week")

        # Generate V1 format markdown content
        export_manager = ExportManager()
        markdown_content = export_manager._generate_obsidian_content(summaries)

        # Return as immediate download
        today = datetime.now().strftime("%Y-%m-%d")
        filename = f"Weekly_Summary_{today}.md"

        return Response(
            content=markdown_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        logger.error(f"Error generating and downloading weekly summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate and download weekly summary: {str(e)}")

@router.get("/insights")
async def get_insights(
        limit: int = 20,
        offset: int = 0,
        source: Optional[str] = None,
        topic: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
):
    """
    Get insights with pagination and filtering.

    Args:
        limit: Maximum number of insights to return
        offset: Number of insights to skip
        source: Filter by source name
        topic: Filter by topic
        date_from: Filter by date range start (YYYY-MM-DD)
        date_to: Filter by date range end (YYYY-MM-DD)

    Returns:
        List of insights with metadata
    """
    try:
        # Build filters dictionary
        filters = {}
        if source:
            filters['source'] = source
        if topic:
            filters['topic'] = topic
        if date_from:
            filters['date_from'] = date_from
        if date_to:
            filters['date_to'] = date_to

        insights = await get_db_manager().get_insights(
            limit=limit,
            offset=offset,
            **filters
        )

        # Get total count for pagination
        total_count = await get_db_manager().get_insights_count(**filters)

        return {
            "insights": insights,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "filters": filters
        }

    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get insights: {str(e)}")


@router.get("/insights/search")
async def search_insights(query: str, limit: int = 20):
    """
    Search insights by content.

    Args:
        query: Search query string
        limit: Maximum number of results

    Returns:
        Search results
    """
    try:
        results = await get_db_manager().search_insights(query, limit)

        return {
            "type": "insights",
            "query": query,
            "results": results,
            "total": len(results)
        }

    except Exception as e:
        logger.error(f"Error searching insights: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/insights/analytics")
async def get_insights_analytics():
    """
    Get insights analytics data.

    Returns:
        Analytics including top sources, topics, and trends
    """
    try:
        analytics = await get_db_manager().get_insights_analytics()

        return {
            "total_insights": analytics.get("total_count", 0),
            "top_sources": analytics.get("top_sources", []),
            "top_topics": analytics.get("top_topics", []),
            "insights_by_date": analytics.get("insights_by_date", []),
            "recent_insights": analytics.get("recent_insights", [])
        }

    except Exception as e:
        logger.error(f"Error getting insights analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.get("/insights/{insight_id}")
async def get_insight_detail(insight_id: int):
    """
    Get individual insight detail.

    Args:
        insight_id: ID of the insight

    Returns:
        Insight detail with metadata
    """
    try:
        insight = await get_db_manager().get_insight_by_id(insight_id)

        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")

        return insight

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting insight detail: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get insight: {str(e)}")