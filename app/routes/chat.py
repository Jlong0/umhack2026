from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.services.chat_agent import process_message, execute_tool

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatCommandRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    pending_tool_result: Optional[dict] = None


class ExecuteToolRequest(BaseModel):
    tool_name: str
    args: dict[str, Any] = {}


@router.post("/command")
async def chat_command(request: ChatCommandRequest):
    try:
        result = process_message(
            message=request.message,
            history=[m.model_dump() for m in request.history],
            pending_tool_result=request.pending_tool_result,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {e}")


@router.post("/execute-tool")
async def chat_execute_tool(request: ExecuteToolRequest):
    try:
        result = execute_tool(request.tool_name, request.args)
        return {"tool_name": request.tool_name, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool execution failed: {e}")
