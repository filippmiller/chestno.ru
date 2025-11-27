from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.auth import get_current_user_id
from app.services import ai_integrations

router = APIRouter(prefix='/api/admin/ai', tags=['admin-ai'])


@router.get('/integrations')
async def list_integrations(current_user_id: str = Depends(get_current_user_id)):
    return ai_integrations.list_integrations(current_user_id)


@router.post('/integrations')
async def create_integration(payload: dict, current_user_id: str = Depends(get_current_user_id)):
    required = {'provider', 'display_name', 'env_var_name'}
    if not required.issubset(payload):
        missing = required - payload.keys()
        raise HTTPException(status_code=400, detail=f'Missing fields: {", ".join(missing)}')
    return ai_integrations.create_integration(
        current_user_id,
        provider=payload['provider'],
        display_name=payload['display_name'],
        env_var_name=payload['env_var_name'],
        is_enabled=payload.get('is_enabled', True),
    )


@router.patch('/integrations/{integration_id}')
async def update_integration(integration_id: str, payload: dict, current_user_id: str = Depends(get_current_user_id)):
    return ai_integrations.update_integration(current_user_id, integration_id, payload)


@router.post('/integrations/{integration_id}/check')
async def check_integration(integration_id: str, current_user_id: str = Depends(get_current_user_id)):
    return ai_integrations.run_health_check(current_user_id, integration_id)

