"""
Supply Chain Visualization API Routes
REST API endpoints for supply chain management.
"""
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool

from app.core.session_deps import get_current_user_id_from_session
from app.schemas.supply_chain import (
    SupplyChainJourney,
    SupplyChainNode,
    SupplyChainNodeCreate,
    SupplyChainNodeUpdate,
    SupplyChainStats,
    SupplyChainStep,
    SupplyChainStepCreate,
    SupplyChainStepUpdate,
)

logger = logging.getLogger(__name__)

# Public routes (for viewing supply chains)
public_router = APIRouter(prefix='/api/supply-chain', tags=['supply-chain'])

# Authenticated routes (for managing supply chains)
router = APIRouter(prefix='/api/supply-chain', tags=['supply-chain'])


# ==================== Public Routes ====================

@public_router.get('/product/{product_id}', response_model=SupplyChainJourney)
async def get_product_supply_chain(product_id: str) -> SupplyChainJourney:
    """
    Get the complete supply chain journey for a product.

    This is the main endpoint for displaying the supply chain visualization.
    Returns all nodes and steps in order, along with verification status.

    Public access - no authentication required.
    """
    from app.services.supply_chain import get_product_journey

    return await run_in_threadpool(get_product_journey, product_id)


@public_router.get('/journey/{product_id}', response_model=SupplyChainJourney)
async def get_supply_chain_journey(product_id: str) -> SupplyChainJourney:
    """
    Alias for /product/{product_id} - get the supply chain journey.

    Returns the complete supply chain journey for a product.
    """
    from app.services.supply_chain import get_product_journey

    return await run_in_threadpool(get_product_journey, product_id)


@public_router.get('/product/{product_id}/stats', response_model=SupplyChainStats)
async def get_product_supply_chain_stats(product_id: str) -> SupplyChainStats:
    """
    Get statistics about a product's supply chain.

    Returns:
    - Total and verified counts for nodes and steps
    - Total distance and duration
    - Verification percentage
    """
    from app.services.supply_chain import get_supply_chain_stats

    return await run_in_threadpool(get_supply_chain_stats, product_id)


@public_router.get('/product/{product_id}/nodes', response_model=List[SupplyChainNode])
async def get_product_nodes(product_id: str) -> List[SupplyChainNode]:
    """
    Get all supply chain nodes for a product.
    Returns nodes ordered by order_index.
    """
    from app.services.supply_chain import get_nodes_for_product

    return await run_in_threadpool(get_nodes_for_product, product_id)


@public_router.get('/product/{product_id}/steps', response_model=List[SupplyChainStep])
async def get_product_steps(product_id: str) -> List[SupplyChainStep]:
    """
    Get all supply chain steps for a product.
    Returns steps ordered by timestamp.
    """
    from app.services.supply_chain import get_steps_for_product

    return await run_in_threadpool(get_steps_for_product, product_id)


@public_router.get('/product/{product_id}/carbon')
async def get_product_carbon_footprint(
    product_id: str,
    weight_kg: float = Query(default=1.0, ge=0.01, le=10000),
):
    """
    Get carbon footprint calculation for a product's supply chain.

    Returns CO2 emissions breakdown by transport method,
    comparisons to relatable metrics, and an environmental rating.
    """
    from app.services.supply_chain import calculate_carbon_footprint

    return await run_in_threadpool(calculate_carbon_footprint, product_id, weight_kg)


@public_router.get('/product/{product_id}/journey-enhanced')
async def get_enhanced_journey(
    product_id: str,
    weight_kg: float = Query(default=1.0, ge=0.01, le=10000),
):
    """
    Get the complete supply chain journey with carbon footprint data.

    This enhanced endpoint includes:
    - Full journey with all nodes and steps
    - Carbon footprint calculation and breakdown
    - Environmental score and grade
    """
    from app.services.supply_chain import get_journey_with_carbon

    return await run_in_threadpool(get_journey_with_carbon, product_id, weight_kg)


# ==================== Authenticated Routes - Nodes ====================

@router.post('/nodes', response_model=SupplyChainNode)
async def create_supply_chain_node(
    organization_id: str,
    payload: SupplyChainNodeCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainNode:
    """
    Create a new supply chain node.

    Requires authentication and organization editor role.

    Args:
        organization_id: Organization that owns this node
        payload: Node details including type, name, location, etc.

    Returns:
        Created supply chain node
    """
    from app.services.supply_chain import create_node

    try:
        return await run_in_threadpool(
            create_node,
            organization_id,
            current_user_id,
            payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error creating supply chain node: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create supply chain node: {str(e)}'
        )


@router.get('/nodes/{node_id}', response_model=SupplyChainNode)
async def get_supply_chain_node(node_id: str) -> SupplyChainNode:
    """Get a single supply chain node by ID."""
    from app.services.supply_chain import get_node_by_id

    return await run_in_threadpool(get_node_by_id, node_id)


@router.put('/nodes/{node_id}', response_model=SupplyChainNode)
async def update_supply_chain_node(
    node_id: str,
    payload: SupplyChainNodeUpdate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainNode:
    """
    Update a supply chain node.

    Requires authentication and organization editor role.
    """
    from app.services.supply_chain import update_node

    try:
        return await run_in_threadpool(
            update_node,
            node_id,
            current_user_id,
            payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error updating supply chain node: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to update supply chain node: {str(e)}'
        )


@router.delete('/nodes/{node_id}')
async def delete_supply_chain_node(
    node_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Delete a supply chain node.

    Requires authentication and organization editor role.
    Note: This will also delete any steps connected to this node.
    """
    from app.services.supply_chain import delete_node

    try:
        await run_in_threadpool(delete_node, node_id, current_user_id)
        return {"deleted": True, "node_id": node_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error deleting supply chain node: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to delete supply chain node: {str(e)}'
        )


# ==================== Authenticated Routes - Steps ====================

@router.post('/product/{product_id}/steps', response_model=SupplyChainStep)
async def create_supply_chain_step(
    product_id: str,
    payload: SupplyChainStepCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainStep:
    """
    Create a new supply chain step (transition between nodes).

    Requires authentication and product editor role.

    Args:
        product_id: Product this step belongs to
        payload: Step details including from_node, to_node, transport info, etc.

    Returns:
        Created supply chain step
    """
    from app.services.supply_chain import create_step

    try:
        return await run_in_threadpool(
            create_step,
            product_id,
            current_user_id,
            payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error creating supply chain step: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to create supply chain step: {str(e)}'
        )


@router.get('/steps/{step_id}', response_model=SupplyChainStep)
async def get_supply_chain_step(step_id: str) -> SupplyChainStep:
    """Get a single supply chain step by ID."""
    from app.services.supply_chain import get_step_by_id

    return await run_in_threadpool(get_step_by_id, step_id)


@router.put('/steps/{step_id}', response_model=SupplyChainStep)
async def update_supply_chain_step(
    step_id: str,
    payload: SupplyChainStepUpdate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainStep:
    """
    Update a supply chain step.

    Requires authentication and product editor role.
    """
    from app.services.supply_chain import update_step

    try:
        return await run_in_threadpool(
            update_step,
            step_id,
            current_user_id,
            payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error updating supply chain step: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to update supply chain step: {str(e)}'
        )


@router.delete('/steps/{step_id}')
async def delete_supply_chain_step(
    step_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> dict:
    """
    Delete a supply chain step.

    Requires authentication and product editor role.
    """
    from app.services.supply_chain import delete_step

    try:
        await run_in_threadpool(delete_step, step_id, current_user_id)
        return {"deleted": True, "step_id": step_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error deleting supply chain step: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to delete supply chain step: {str(e)}'
        )


# ==================== Verification Routes ====================

@router.post('/nodes/{node_id}/verify', response_model=SupplyChainNode)
async def verify_supply_chain_node(
    node_id: str,
    request: Request,
    notes: Optional[str] = Query(None, max_length=2000),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainNode:
    """
    Mark a supply chain node as verified.

    Requires authentication and appropriate permissions.
    """
    from app.services.supply_chain import verify_node

    try:
        return await run_in_threadpool(verify_node, node_id, current_user_id, notes)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error verifying supply chain node: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to verify supply chain node: {str(e)}'
        )


@router.post('/steps/{step_id}/verify', response_model=SupplyChainStep)
async def verify_supply_chain_step(
    step_id: str,
    request: Request,
    notes: Optional[str] = Query(None, max_length=2000),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> SupplyChainStep:
    """
    Mark a supply chain step as verified.

    Requires authentication and appropriate permissions.
    """
    from app.services.supply_chain import verify_step

    try:
        return await run_in_threadpool(verify_step, step_id, current_user_id, notes)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error verifying supply chain step: {e}', exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to verify supply chain step: {str(e)}'
        )


# ==================== Organization Routes ====================

@router.get('/organization/{organization_id}/nodes', response_model=List[SupplyChainNode])
async def get_organization_nodes(
    organization_id: str,
    product_id: Optional[str] = Query(None),
    current_user_id: str = Depends(get_current_user_id_from_session),
) -> List[SupplyChainNode]:
    """
    Get all supply chain nodes for an organization.

    Optionally filter by product_id.
    Requires authentication (org member).
    """
    from app.services.supply_chain import get_nodes_for_organization

    return await run_in_threadpool(get_nodes_for_organization, organization_id, product_id)
