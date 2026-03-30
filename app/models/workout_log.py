import uuid
from datetime import date, datetime
from sqlalchemy import Integer, Float, String, Date, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class WorkoutLog(Base):
    __tablename__ = "workout_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=False
    )
    plan_day_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_days.id"), nullable=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    client = relationship("ClientProfile", back_populates="workout_logs")
    plan_day = relationship("PlanDay", back_populates="workout_logs")
    sets = relationship(
        "WorkoutLogSet", back_populates="log", cascade="all, delete-orphan",
        order_by="WorkoutLogSet.set_number"
    )

    def __repr__(self) -> str:
        return f"<WorkoutLog {self.date} client={self.client_id}>"


class WorkoutLogSet(Base):
    __tablename__ = "workout_log_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_logs.id", ondelete="CASCADE"), nullable=False
    )
    plan_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_exercises.id"), nullable=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False
    )
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps_completed: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    rpe: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    log = relationship("WorkoutLog", back_populates="sets")
    plan_exercise = relationship("PlanExercise", back_populates="log_sets")
    exercise = relationship("Exercise")

    def __repr__(self) -> str:
        return f"<WorkoutLogSet set={self.set_number} reps={self.reps_completed}>"