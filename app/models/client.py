import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    pt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    starting_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    goals: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    injuries: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    plan_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="client_profile", foreign_keys=[user_id])
    pt = relationship("User", back_populates="pt_clients", foreign_keys=[pt_id])
    measurements = relationship("Measurement", back_populates="client", cascade="all, delete-orphan")
    progress_photos = relationship("ProgressPhoto", back_populates="client", cascade="all, delete-orphan")
    goals_list = relationship("Goal", back_populates="client", cascade="all, delete-orphan")
    workout_plans = relationship("WorkoutPlan", back_populates="client")
    workout_logs = relationship("WorkoutLog", back_populates="client")
    bookings = relationship("Booking", back_populates="client")
    session_packs = relationship("SessionPack", back_populates="client", order_by="SessionPack.created_at.desc()")
    invoices = relationship("Invoice", back_populates="client")

    def __repr__(self) -> str:
        return f"<ClientProfile {self.id} status={self.status}>"