from fastapi import APIRouter

router = APIRouter()

@router.get("/workers")
def get_workers():
    return []