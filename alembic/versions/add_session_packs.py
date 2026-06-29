"""add session_packs and update invoices

Revision ID: c9f2b4a1d8e7
Revises: b7f3a1c2d9e0
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c9f2b4a1d8e7'
down_revision = 'b7f3a1c2d9e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'session_packs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('client_profiles.id'), nullable=False),
        sa.Column('pt_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('pack_name', sa.String(100), nullable=False),
        sa.Column('total_sessions', sa.Integer(), nullable=False),
        sa.Column('sessions_remaining', sa.Integer(), nullable=False),
        sa.Column('price_paid_pence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='gbp'),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('purchased_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Drop old invoices table and recreate with new schema
    op.drop_table('invoices')
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('client_profiles.id'), nullable=False),
        sa.Column('pack_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('session_packs.id'), nullable=True),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('amount_pence', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='gbp'),
        sa.Column('status', sa.String(20), nullable=False, server_default='paid'),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Drop old subscriptions table (no longer used)
    op.drop_table('subscriptions')


def downgrade() -> None:
    op.drop_table('session_packs')
    op.drop_table('invoices')