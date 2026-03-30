import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "compound", "isolation", "cardio"
    muscle_group: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "chest", "back", "legs"
    equipment: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "barbell", "dumbbell", "cable", "bodyweight"
    cues: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    pt = relationship("User", back_populates="exercises")
    plan_exercises = relationship("PlanExercise", back_populates="exercise")

    def __repr__(self) -> str:
        return f"<Exercise {self.name}>"