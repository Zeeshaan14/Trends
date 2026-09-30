from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.dependencies.auth import get_superadmin_user
from app.schemas.common import ApiResponse
from app.services import pinterest_service

router = APIRouter()


@router.get("/status", response_model=ApiResponse)
async def pinterest_status(db: AsyncSession = Depends(get_db), admin=Depends(get_superadmin_user)):
    return ApiResponse(success=True, data=await pinterest_service.get_status(db))


class SetExportBoardRequest(BaseModel):
    boardName: str


@router.post("/export-board", response_model=ApiResponse)
async def pinterest_set_export_board(
    body: SetExportBoardRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_superadmin_user),
):
    """Sets the board name used for the CSV bulk-upload export — this must
    match a board's exact name on Pinterest, since the Business Hub importer
    takes a literal name, not an API board id."""
    await pinterest_service.set_export_board_name(db, body.boardName)
    return ApiResponse(success=True, message="Export board updated")


@router.get("/export-csv")
async def pinterest_export_csv(
    includeExported: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_superadmin_user),
):
    """Downloads a Pinterest bulk-upload CSV (Settings → Import content) of
    jerseys not yet exported, and marks them exported. Use includeExported=true
    to redo a failed upload (re-includes everything)."""
    csv_text, count, skipped = await pinterest_service.generate_export_csv(db, include_exported=includeExported)
    filename = f"pinterest-pins-{count}.csv"
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Exported-Count": str(count),
            "X-Skipped-Count": str(skipped),
            # Browsers hide custom headers from JS fetch() unless explicitly exposed.
            "Access-Control-Expose-Headers": "Content-Disposition, X-Exported-Count, X-Skipped-Count",
        },
    )
