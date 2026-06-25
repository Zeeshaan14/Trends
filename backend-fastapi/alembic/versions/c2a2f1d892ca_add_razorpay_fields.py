"""add_razorpay_fields

Revision ID: c2a2f1d892ca
Revises: 82b7c67765a2
Create Date: 2026-06-25 18:00:45.822042

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2a2f1d892ca'
down_revision: Union[str, Sequence[str], None] = '82b7c67765a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Razorpay fields to orders and payments tables."""
    op.add_column('orders', sa.Column('razorpayOrderId', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('razorpayPaymentId', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('razorpaySignature', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove Razorpay fields from orders and payments tables."""
    op.drop_column('payments', 'razorpaySignature')
    op.drop_column('payments', 'razorpayPaymentId')
    op.drop_column('orders', 'razorpayOrderId')
