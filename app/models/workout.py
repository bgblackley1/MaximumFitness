import uuid
from datetime import date, datetime
from sqlalchemy import (
    String, Integer, Text, Date, DateTime, ForeignKey, func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class WorkoutPlan(Base):
    __tablename__ = "workout_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # kept for backward-compat; new assignments use the junction table
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_profiles.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    goal_focus: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="draft"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    pt      = relationship("User", foreign_keys=[pt_id])
    client  = relationship("ClientProfile", back_populates="workout_plans", foreign_keys=[client_id])
    weeks   = relationship(
        "PlanWeek", back_populates="plan", cascade="all, delete-orphan",
        order_by="PlanWeek.week_number",
    )
    assignments = relationship(
        "WorkoutPlanAssignment", back_populates="plan", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<WorkoutPlan {self.title}>"


class WorkoutPlanAssignment(Base):
    """Junction table: one plan assigned to many clients."""
    __tablename__ = "workout_plan_assignments"
    __table_args__ = (
        UniqueConstraint("plan_id", "client_id", name="uq_plan_client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_plans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_profiles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default="client_visible", server_default="client_visible"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    plan   = relationship("WorkoutPlan", back_populates="assignments")
    client = relationship("ClientProfile")

    def __repr__(self) -> str:
        return f"<WorkoutPlanAssignment plan={self.plan_id} client={self.client_id}>"


class PlanWeek(Base):
    __tablename__ = "plan_weeks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_plans.id", ondelete="CASCADE"), nullable=False
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)

    plan = relationship("WorkoutPlan", back_populates="weeks")
    days = relationship(
        "PlanDay", back_populates="week", cascade="all, delete-orphan",
        order_by="PlanDay.day_order",
    )

    def __repr__(self) -> str:
        return f"<PlanWeek {self.week_number}>"


class PlanDay(Base):
    __tablename__ = "plan_days"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    week_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_weeks.id", ondelete="CASCADE"), nullable=False
    )
    day_label: Mapped[str] = mapped_column(String(100), nullable=False)
    day_order: Mapped[int] = mapped_column(Integer, nullable=False)

    week     = relationship("PlanWeek", back_populates="days")
    exercises = relationship(
        "PlanExercise", back_populates="day", cascade="all, delete-orphan",
        order_by="PlanExercise.order",
    )
    workout_logs = relationship("WorkoutLog", back_populates="plan_day")

    def __repr__(self) -> str:
        return f"<PlanDay {self.day_label}>"


class PlanExercise(Base):
    __tablename__ = "plan_exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_days.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[str] = mapped_column(String(20), nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    progression_rule: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    day      = relationship("PlanDay", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="plan_exercises")
    log_sets = relationship("WorkoutLogSet", back_populates="plan_exercise")

    def __repr__(self) -> str:
        return f"<PlanExercise order={self.order}>"