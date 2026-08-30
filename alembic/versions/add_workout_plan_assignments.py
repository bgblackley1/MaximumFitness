"""add workout_plan_assignments junction table

Revision ID: d3e5f7a2c1b0
Revises: c9f2b4a1d8e7
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = 'd3e5f7a2c1b0'
down_revision = 'c9f2b4a1d8e7'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        'workout_plan_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'plan_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('workout_plans.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'client_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('client_profiles.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('visibility', sa.String(20), nullable=False, server_default='client_visible'),
        sa.Column('status',     sa.String(20), nullable=False, server_default='active'),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('plan_id', 'client_id', name='uq_plan_client'),
    )
    op.create_index('ix_wpa_plan_id',   'workout_plan_assignments', ['plan_id'])
    op.create_index('ix_wpa_client_id', 'workout_plan_assignments', ['client_id'])


def downgrade() -> None:
    op.drop_index('ix_wpa_client_id', table_name='workout_plan_assignments')
    op.drop_index('ix_wpa_plan_id',   table_name='workout_plan_assignments')
    op.drop_table('workout_plan_assignments')