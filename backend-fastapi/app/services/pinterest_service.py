import csv
import io
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import ApiException
from app.models.jersey import Jersey
from app.models.pinterest_integration import PinterestIntegration

logger = logging.getLogger(__name__)


def _utc_naive(dt: datetime) -> datetime:
    """Strip tzinfo for storage — the DB column is TIMESTAMP WITHOUT TIME ZONE,
    and asyncpg refuses to encode a tz-aware datetime into it. Values passed in
    here are always already in UTC, so this is a safe truncation."""
    return dt.replace(tzinfo=None)


async def _get_or_create_row(db: AsyncSession) -> PinterestIntegration:
    result = await db.execute(select(PinterestIntegration).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        row = PinterestIntegration()
        db.add(row)
        await db.flush()
    return row


async def get_status(db: AsyncSession) -> dict:
    row = await _get_or_create_row(db)
    pending = await _pending_export_count(db)
    return {
        "exportBoardName": row.export_board_name,
        "pendingExportCount": pending,
    }


async def set_export_board_name(db: AsyncSession, board_name: str) -> None:
    row = await _get_or_create_row(db)
    row.export_board_name = board_name
    await db.commit()


# Formats Pinterest's bulk-CSV importer documents support for the Media URL
# column — notably NOT webp/gif/svg/avif, which the admin upload form otherwise
# allows (see ALLOWED_IMAGE_TYPES in r2_service.py).
_SUPPORTED_EXPORT_EXTENSIONS = (".jpg", ".jpeg", ".png")


def _has_supported_export_image(jersey: Jersey) -> bool:
    return jersey.image.lower().endswith(_SUPPORTED_EXPORT_EXTENSIONS)


def _exportable_jerseys_query(include_exported: bool):
    query = select(Jersey).where(Jersey.image.startswith("http"))
    if not include_exported:
        query = query.where(Jersey.pinterest_exported_at.is_(None))
    return query.order_by(Jersey.id)


async def _pending_export_count(db: AsyncSession) -> int:
    result = await db.execute(_exportable_jerseys_query(include_exported=False))
    return sum(1 for j in result.scalars().all() if _has_supported_export_image(j))


async def generate_export_csv(db: AsyncSession, include_exported: bool = False) -> tuple[str, int, int]:
    """Builds a Pinterest bulk-upload CSV (Settings → Import content) for
    jerseys not yet exported, and marks them exported so the next call only
    picks up new ones. Pass include_exported=True to re-include everything
    (e.g. to redo a failed upload).

    Jerseys whose image isn't a Pinterest-supported format (jpg/png) are
    skipped and left un-exported — they'll keep showing as pending until the
    image is fixed, rather than silently disappearing. Returns
    (csv_text, exported_count, skipped_count).
    """
    row = await _get_or_create_row(db)
    if not row.export_board_name:
        raise ApiException("No export board name set — set one via /admin/pinterest/export-board", 409)

    result = await db.execute(_exportable_jerseys_query(include_exported))
    jerseys = result.scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    # Full 8-column header, matching Pinterest's own sample template exactly
    # (Settings → Import content → sample spreadsheet) — their importer
    # rejected a trimmed-down 5-column version outright, so Thumbnail/Publish
    # date/Keywords are included but left blank for image pins, per their docs.
    writer.writerow(
        ["Title", "Media URL", "Pinterest board", "Thumbnail", "Description", "Link", "Publish date", "Keywords"]
    )
    exported = 0
    skipped = 0
    for jersey in jerseys:
        if not _has_supported_export_image(jersey):
            skipped += 1
            continue
        link = f"{settings.PUBLIC_SITE_URL.rstrip('/')}/jerseys/{jersey.id}"
        # Plain ASCII hyphen, not an em-dash — Pinterest's bulk importer has
        # been observed rejecting the whole file over a single non-ASCII byte
        # without any row-level detail, so we keep this column pure ASCII.
        description = f"{jersey.player} - available now on NU Jerseys."
        writer.writerow(
            [jersey.name[:100], jersey.image, row.export_board_name, "", description, link, "", ""]
        )
        jersey.pinterest_exported_at = _utc_naive(datetime.now(timezone.utc))
        exported += 1

    await db.commit()
    # No BOM: Pinterest's own sample template doesn't use one, and if their
    # parser does a literal string match on headers ("Title" == "Title")
    # without stripping a BOM, prepending one turns "Title" into "﻿Title"
    # and silently fails the whole file's header validation.
    csv_text = buffer.getvalue()
    # Match their sample's exact ending too — no trailing CRLF after the last row.
    if csv_text.endswith("\r\n"):
        csv_text = csv_text[:-2]
    return csv_text, exported, skipped
