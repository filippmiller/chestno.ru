from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse

from app.services.social_login import handle_yandex_callback, start_yandex_login

router = APIRouter(prefix='/api/auth', tags=['auth'])


@router.get('/yandex/start')
async def yandex_start(redirect_to: str | None = Query(default=None)):
    url = start_yandex_login(redirect_to)
    return JSONResponse({'redirect_url': url})


@router.get('/yandex/callback')
async def yandex_callback(code: str, state: str):
    session, redirect_to = handle_yandex_callback(code, state)
    access_token = session.get('access_token')
    refresh_token = session.get('refresh_token')
    expires_in = session.get('expires_in')
    if not access_token or not refresh_token:
        raise HTTPException(status_code=500, detail='Supabase session missing tokens')
    params = urlencode(
        {
            'provider': 'yandex',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': expires_in,
        }
    )
    separator = '&' if '?' in redirect_to else '?'
    return RedirectResponse(f'{redirect_to}{separator}{params}')

