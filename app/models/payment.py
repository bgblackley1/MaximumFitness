import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SessionPack(Base):
    """
    A block of sessions purchased by a client — e.g. '10 sessions for £500'.
    Sessions are decremented when bookings are marked completed.
    """
    __tablename__ = "session_packs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )
    pt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    pack_name: Mapped[str] = mapped_column(String(100), nullable=False)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    price_paid_pence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="gbp", server_default="gbp"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )  # "active", "exhausted", "expired", "cancelled"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    client = relationship("ClientProfile", back_populates="session_packs")
    pt = relationship("User", foreign_keys=[pt_id])

    def __repr__(self) -> str:
        return f"<SessionPack {self.pack_name} remaining={self.sessions_remaining}>"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )
    pack_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("session_packs.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_pence: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="gbp", server_default="gbp"
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    client = relationship("ClientProfile", back_populates="invoices")
    pack = relationship("SessionPack")

    def __repr__(self) -> str:
        return f"<Invoice {self.description} amount={self.amount_pence}>"