# alembic/versions/add_is_blocked_to_availability_slots.py
"""add is_blocked to availability_slots

Revision ID: b7f3a1c2d9e0
Revises: <replace_with_your_last_revision_id>
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision     = 'b7f3a1c2d9e0'
down_revision = None   # ← open alembic/versions/, find the most recent file,
                        #   copy its `revision` value here
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column(
        'availability_slots',
        sa.Column(
            'is_blocked',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        )
    )


def downgrade() -> None:
    op.drop_column('availability_slots', 'is_blocked')