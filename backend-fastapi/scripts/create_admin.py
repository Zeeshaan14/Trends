"""Create or update an admin user with a bcrypt-hashed password."""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db import async_session_maker, engine
from app.models.enums import Role
from app.models.user import User
from app.security.passwords import get_password_hash


async def create_admin(
    email: str,
    password: str,
    company_name: str,
    phone: str,
    update_existing: bool,
) -> None:
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            if not update_existing:
                print(f"User already exists: {email}")
                print("Re-run with --update to promote them to admin and reset the password.")
                return

            user.role = Role.ADMIN
            user.company_name = company_name
            user.phone = phone
            user.password = get_password_hash(password)
            await db.commit()
            print(f"Updated existing user to admin: {email}")
            return

        user = User(
            email=email,
            company_name=company_name,
            phone=phone,
            role=Role.ADMIN,
            password=get_password_hash(password),
        )
        db.add(user)
        await db.commit()
        print(f"Created admin user: {email}")


async def main_async(args: argparse.Namespace) -> None:
    await create_admin(
        email=args.email,
        password=args.password,
        company_name=args.company_name,
        phone=args.phone,
        update_existing=args.update,
    )
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin user with a bcrypt password hash.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--company-name", default="NU Jerseys Admin")
    parser.add_argument("--phone", default="0000000000")
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update an existing user to admin and reset their password.",
    )
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
