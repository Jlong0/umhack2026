from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime_service import realtime_dashboard_manager


router = APIRouter(tags=["realtime"])


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await realtime_dashboard_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and support simple ping payloads.
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_dashboard_manager.disconnect(websocket)
    except Exception:
        realtime_dashboard_manager.disconnect(websocket)
