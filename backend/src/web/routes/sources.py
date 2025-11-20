#!/usr/bin/env python3
"""
Source Management API Routes for Research Automation
Provides CRUD operations for managing content sources via the web interface
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from ...core.logging import get_logger

logger = get_logger(__name__)

# Create router instance
router = APIRouter(tags=["source_management"])
_source_manager = None

# Pydantic models for request/response
class SourceConfigRequest(BaseModel):
    source_id: str
    source_type: str
    name: str
    enabled: bool = True
    config: Dict[str, Any]


class SourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class SourceTestRequest(BaseModel):
    source_type: str
    config: Dict[str, Any]


class SourceResponse(BaseModel):
    source_id: str
    type: str
    name: str
    enabled: bool
    config: Dict[str, Any]
    plugin_available: bool
    last_tested: Optional[str] = None
    test_status: Optional[bool] = None


class PluginMetadataResponse(BaseModel):
    plugin_type: str
    name: str
    description: str
    config_schema: Dict[str, Any]
    examples: Dict[str, Any]

def set_source_manager(source_manager):
    """Set the global source manager instance"""
    global _source_manager
    _source_manager = source_manager
    logger.info("Source manager instance set for API routes")

# Dependency to get source manager
async def get_source_manager():
    """Get the source manager instance"""
    global _source_manager

    if _source_manager is None:
        logger.error("Source manager not initialized")
        raise HTTPException(status_code=500, detail="Source manager not available")

    return _source_manager


@router.get("/", response_model=Dict[str, SourceResponse])
async def get_all_sources(source_manager=Depends(get_source_manager)):
    """Get all configured sources"""
    try:
        configured_sources = source_manager.get_configured_sources()

        response = {}
        for source_id, source_config in configured_sources.items():
            source_info = source_manager.get_source_info(source_id)

            response[source_id] = SourceResponse(
                source_id=source_id,
                type=source_config['type'],
                name=source_config.get('name', source_id),
                enabled=source_config.get('enabled', True),
                config=source_config.get('config', {}),
                plugin_available=source_info.get('plugin_available', False) if source_info else False
            )

        return response

    except Exception as e:
        logger.error(f"Error getting sources: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug")
async def debug_source_manager():
    """Debug endpoint to check source manager status"""
    global _source_manager

    if _source_manager is None:
        return {"status": "source_manager_not_set", "manager": None}

    try:
        available_types = _source_manager.get_available_plugin_types()
        configured_sources = _source_manager.get_configured_sources()

        return {
            "status": "source_manager_available",
            "available_types": available_types,
            "configured_sources_count": len(configured_sources),
            "manager": str(type(_source_manager))
        }
    except Exception as e:
        return {"status": "source_manager_error", "error": str(e)}


@router.get("/simple-debug")
async def simple_debug():
    """Simple debug endpoint without dependencies"""
    global _source_manager

    return {
        "source_manager_set": _source_manager is not None,
        "source_manager_type": str(type(_source_manager)) if _source_manager else None,
        "global_var_status": "set" if _source_manager else "not_set"
    }

@router.get("/available-types", response_model=List[PluginMetadataResponse])
async def get_available_plugin_types(source_manager=Depends(get_source_manager)):
    """Get all available plugin types with their schemas"""
    try:
        available_types = source_manager.get_available_plugin_types()

        response = []
        for plugin_type in available_types:
            # Get plugin metadata
            try:
                plugin_class = source_manager.registered_plugins[plugin_type]

                # Create a temporary instance to get schema
                temp_instance = plugin_class("temp", {})
                config_schema = temp_instance.get_config_schema()

                response.append(PluginMetadataResponse(
                    plugin_type=plugin_type,
                    name=plugin_type.title(),
                    description=f"{plugin_type.title()} content source",
                    config_schema=config_schema,
                    examples={}  # Could be enhanced with examples
                ))

            except Exception as e:
                logger.warning(f"Error getting metadata for {plugin_type}: {e}")
                continue

        return response

    except Exception as e:
        logger.error(f"Error getting plugin types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=Dict[str, Any])
async def create_source(request: SourceConfigRequest, source_manager=Depends(get_source_manager)):
    """Create a new source"""
    try:
        success = source_manager.add_source(
            source_id=request.source_id,
            source_type=request.source_type,
            config=request.config,
            name=request.name,
            enabled=request.enabled
        )

        if success:
            return {"success": True, "message": f"Source {request.source_id} created successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to create source")

    except Exception as e:
        logger.error(f"Error creating source {request.source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{source_id}", response_model=Dict[str, Any])
async def update_source(source_id: str, request: SourceUpdateRequest, source_manager=Depends(get_source_manager)):
    """Update an existing source"""
    try:
        # Directly access the source manager's data, not a copy
        if source_id not in source_manager.configured_sources:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

        current_source = source_manager.configured_sources[source_id]

        # Update fields if provided
        if request.name is not None:
            current_source['name'] = request.name
        if request.enabled is not None:
            current_source['enabled'] = request.enabled
        if request.config is not None:
            current_source['config'] = request.config

        # Save the updated configuration
        source_manager._save_source_configurations()

        return {"success": True, "message": f"Source {source_id} updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{source_id}", response_model=Dict[str, Any])
async def delete_source(source_id: str, source_manager=Depends(get_source_manager)):
    """Delete a source"""
    try:
        success = source_manager.remove_source(source_id)

        if success:
            return {"success": True, "message": f"Source {source_id} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{source_id}/test", response_model=Dict[str, Any])
async def test_source(source_id: str, source_manager=Depends(get_source_manager)):
    """Test a configured source"""
    try:
        result = await source_manager.test_source(source_id)
        return result

    except Exception as e:
        logger.error(f"Error testing source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-config", response_model=Dict[str, Any])
async def test_source_config(request: SourceTestRequest, source_manager=Depends(get_source_manager)):
    """Test a source configuration before saving"""
    try:
        # Create a temporary source for testing
        if request.source_type not in source_manager.registered_plugins:
            raise HTTPException(status_code=400, detail=f"Unknown plugin type: {request.source_type}")

        plugin_class = source_manager.registered_plugins[request.source_type]
        temp_plugin = plugin_class("temp_test", request.config)

        # Validate configuration
        validation = temp_plugin.validate_config(request.config)
        if not validation.get('valid', False):
            return {
                "success": False,
                "error": "Configuration validation failed",
                "details": validation.get('errors', [])
            }

        # Test connection
        result = await temp_plugin.test_connection()
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing config for {request.source_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{source_id}/enable", response_model=Dict[str, Any])
async def enable_source(source_id: str, source_manager=Depends(get_source_manager)):
    """Enable a source"""
    try:
        # Directly access the source manager's data
        if source_id not in source_manager.configured_sources:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

        source_manager.configured_sources[source_id]['enabled'] = True
        source_manager._save_source_configurations()

        return {"success": True, "message": f"Source {source_id} enabled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enabling source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{source_id}/disable", response_model=Dict[str, Any])
async def disable_source(source_id: str, source_manager=Depends(get_source_manager)):
    """Disable a source"""
    try:
        # Directly access the source manager's data
        if source_id not in source_manager.configured_sources:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

        source_manager.configured_sources[source_id]['enabled'] = False
        source_manager._save_source_configurations()

        return {"success": True, "message": f"Source {source_id} disabled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disabling source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{source_id}", response_model=SourceResponse)
async def get_source(source_id: str, source_manager=Depends(get_source_manager)):
    """Get a specific source"""
    try:
        configured_sources = source_manager.get_configured_sources()

        if source_id not in configured_sources:
            raise HTTPException(status_code=404, detail=f"Source {source_id} not found")

        source_config = configured_sources[source_id]
        source_info = source_manager.get_source_info(source_id)

        return SourceResponse(
            source_id=source_id,
            type=source_config['type'],
            name=source_config.get('name', source_id),
            enabled=source_config.get('enabled', True),
            config=source_config.get('config', {}),
            plugin_available=source_info.get('plugin_available', False) if source_info else False
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting source {source_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))