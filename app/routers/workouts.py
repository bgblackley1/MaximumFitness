import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete as sqla_delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.workout import WorkoutPlan, WorkoutPlanAssignment, PlanWeek, PlanDay, PlanExercise
from app.models.client import ClientProfile
from app.middleware.auth import get_current_user, get_current_pt
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutPlanCreate,
    AssignPlanRequest,
    SetClientWorkoutsRequest,
    AssignedClientBasic,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _eager_load():
    return [
        selectinload(WorkoutPlan.weeks)
            .selectinload(PlanWeek.days)
            .selectinload(PlanDay.exercises)
            .selectinload(PlanExercise.exercise),
        selectinload(WorkoutPlan.assignments)
            .selectinload(WorkoutPlanAssignment.client)
            .selectinload(ClientProfile.user),
    ]


def _flat_exercises(plan: WorkoutPlan) -> list[dict]:
    """Extract all exercises across all weeks/days into a flat ordered list."""
    result = []
    for w in sorted(plan.weeks, key=lambda x: x.week_number):
        for d in sorted(w.days, key=lambda x: x.day_order):
            for e in sorted(d.exercises, key=lambda x: x.order):
                result.append({
                    "id":           str(e.id),
                    "exercise_id":  str(e.exercise_id),
                    "name":         e.exercise.name         if e.exercise else "Unknown",
                    "muscle_group": e.exercise.muscle_group if e.exercise else None,
                    "image_url":    e.exercise.image_url    if e.exercise else None,
                    "order":        e.order,
                    "sets":         e.sets,
                    "reps":         e.reps,
                    "rest_seconds": e.rest_seconds,
                    "notes":        e.notes,
                })
    return result


def _assigned_clients(plan: WorkoutPlan) -> list[dict]:
    return [
        {"id": str(a.client_id), "name": a.client.user.name}
        for a in plan.assignments
        if a.client and a.client.user
    ]


async def _create_flat_structure(
    db: AsyncSession,
    plan: WorkoutPlan,
    exercises: list,
):
    """Create a single week + single day with the provided exercise list."""
    # Delete existing structure
    for w in plan.weeks:
        for d in w.days:
            for e in d.exercises:
                await db.delete(e)
            await db.delete(d)
        await db.delete(w)
    await db.flush()

    week = PlanWeek(plan_id=plan.id, week_number=1)
    db.add(week)
    await db.flush()
    day = PlanDay(week_id=week.id, day_label="Workout", day_order=1)
    db.add(day)
    await db.flush()
    for i, ex in enumerate(exercises):
        db.add(PlanExercise(
            day_id=day.id,
            exercise_id=ex.exercise_id,
            order=i + 1,
            sets=ex.sets,
            reps=ex.reps,
            rest_seconds=ex.rest_seconds,
            notes=ex.notes,
            progression_rule=getattr(ex, "progression_rule", None),
        ))
    await db.flush()


def _plan_to_dict(plan: WorkoutPlan) -> dict:
    exercises = _flat_exercises(plan)
    return {
        "id":               str(plan.id),
        "title":            plan.title,
        "focus":            plan.goal_focus,
        "description":      None,
        "visibility":       plan.visibility,
        "status":           plan.status,
        "created_at":       plan.created_at.isoformat(),
        "exercise_count":   len(exercises),
        "exercises":        exercises,
        "assigned_clients": _assigned_clients(plan),
    }


# ── List workouts ─────────────────────────────────────────────────────────────

@router.get("")
async def list_workouts(
    client_id:   uuid.UUID | None = Query(None),
    plan_status: str | None       = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db:   AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        q = (
            select(WorkoutPlan)
            .where(WorkoutPlan.pt_id == user.id)
            .options(*_eager_load())
            .order_by(WorkoutPlan.created_at.desc())
        )
        if plan_status:
            q = q.where(WorkoutPlan.status == plan_status)
        if client_id:
            q = q.join(
                WorkoutPlanAssignment,
                and_(
                    WorkoutPlanAssignment.plan_id   == WorkoutPlan.id,
                    WorkoutPlanAssignment.client_id == client_id,
                ),
            )
        result = await db.execute(q)
        return [_plan_to_dict(p) for p in result.scalars().all()]

    # Client view
    cp = (await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == user.id)
    )).scalar_one_or_none()
    if not cp:
        raise HTTPException(404, "Client profile not found")

    plan_ids = [
        row[0] for row in (
            await db.execute(
                select(WorkoutPlanAssignment.plan_id).where(
                    WorkoutPlanAssignment.client_id  == cp.id,
                    WorkoutPlanAssignment.status     == "active",
                    WorkoutPlanAssignment.visibility == "client_visible",
                )
            )
        ).fetchall()
    ]
    q = (
        select(WorkoutPlan)
        .where(WorkoutPlan.id.in_(plan_ids), WorkoutPlan.status == "active")
        .options(*_eager_load())
        .order_by(WorkoutPlan.created_at.desc())
    )
    result = await db.execute(q)
    return [_plan_to_dict(p) for p in result.scalars().all()]


# ── Create workout (flat) ─────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workout(
    body: WorkoutCreate,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    plan = WorkoutPlan(
        pt_id=pt.id,
        title=body.title,
        goal_focus=body.focus,
        visibility=body.visibility,
        status="active",
    )
    db.add(plan)
    await db.flush()
    await _create_flat_structure(db, plan, body.exercises)
    return {"message": "Workout created", "plan_id": str(plan.id)}


# ── Get single workout ────────────────────────────────────────────────────────

@router.get("/{plan_id}")
async def get_workout(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db:   AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id).options(*_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Workout not found")

    if user.role == "pt" and plan.pt_id != user.id:
        raise HTTPException(403, "Not your workout")

    if user.role == "client":
        cp = (await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )).scalar_one_or_none()
        if not cp or cp.id not in [a.client_id for a in plan.assignments]:
            raise HTTPException(403, "Not your workout")

    return _plan_to_dict(plan)


# ── Update workout ────────────────────────────────────────────────────────────

@router.put("/{plan_id}")
async def update_workout(
    plan_id: uuid.UUID,
    body: WorkoutCreate,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Workout not found")

    plan.title      = body.title
    plan.goal_focus = body.focus
    old_vis         = plan.visibility
    plan.visibility = body.visibility

    if plan.visibility != old_vis:
        for asgn in plan.assignments:
            asgn.visibility = plan.visibility

    await _create_flat_structure(db, plan, body.exercises)
    return {"message": "Workout updated"}


# ── Archive workout ───────────────────────────────────────────────────────────

@router.delete("/{plan_id}")
async def archive_workout(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Workout not found")
    plan.status = "archived"
    await db.flush()
    return {"message": "Workout archived"}


# ── Duplicate workout ─────────────────────────────────────────────────────────

@router.post("/{plan_id}/duplicate")
async def duplicate_workout(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Workout not found")

    exercises = _flat_exercises(plan)
    new_plan = WorkoutPlan(
        pt_id=pt.id,
        title=f"{plan.title} (Copy)",
        goal_focus=plan.goal_focus,
        visibility="draft",
        status="active",
    )
    db.add(new_plan)
    await db.flush()

    week = PlanWeek(plan_id=new_plan.id, week_number=1)
    db.add(week)
    await db.flush()
    day = PlanDay(week_id=week.id, day_label="Workout", day_order=1)
    db.add(day)
    await db.flush()
    for ex in exercises:
        db.add(PlanExercise(
            day_id=day.id, exercise_id=uuid.UUID(ex["exercise_id"]),
            order=ex["order"], sets=ex["sets"], reps=ex["reps"],
            rest_seconds=ex["rest_seconds"], notes=ex["notes"],
        ))
    await db.flush()
    return {"message": "Workout duplicated", "plan_id": str(new_plan.id)}


# ── Assign workout to multiple clients ───────────────────────────────────────

@router.post("/{plan_id}/assign")
async def assign_workout(
    plan_id: uuid.UUID,
    body: AssignPlanRequest,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(404, "Workout not found")

    valid_ids = []
    for cid in body.client_ids:
        if (await db.execute(
            select(ClientProfile).where(ClientProfile.id == cid, ClientProfile.pt_id == pt.id)
        )).scalar_one_or_none():
            valid_ids.append(cid)

    await db.execute(
        sqla_delete(WorkoutPlanAssignment).where(WorkoutPlanAssignment.plan_id == plan_id)
    )
    await db.flush()

    for cid in valid_ids:
        db.add(WorkoutPlanAssignment(
            plan_id=plan_id, client_id=cid,
            visibility=plan.visibility, status="active",
        ))
    await db.flush()

    return {
        "message":             f"Assigned to {len(valid_ids)} client(s)",
        "assigned_client_ids": [str(c) for c in valid_ids],
    }


# ── Set all workouts for one client (from client-detail) ─────────────────────

@router.put("/assignments/by-client/{client_id}")
async def set_workouts_for_client(
    client_id: uuid.UUID,
    body: SetClientWorkoutsRequest,
    pt: User = Depends(get_current_pt),
    db:  AsyncSession = Depends(get_db),
):
    # Verify client belongs to PT
    cp = (await db.execute(
        select(ClientProfile).where(
            ClientProfile.id == client_id, ClientProfile.pt_id == pt.id
        )
    )).scalar_one_or_none()
    if not cp:
        raise HTTPException(404, "Client not found")

    # Verify workout_ids belong to this PT and are active
    valid_ids = []
    for wid in body.workout_ids:
        if (await db.execute(
            select(WorkoutPlan).where(
                WorkoutPlan.id == wid,
                WorkoutPlan.pt_id == pt.id,
                WorkoutPlan.status == "active",
            )
        )).scalar_one_or_none():
            valid_ids.append(wid)

    # Get all plan IDs for this PT (to know which assignments to touch)
    pt_plan_ids = [
        row[0] for row in (
            await db.execute(select(WorkoutPlan.id).where(WorkoutPlan.pt_id == pt.id))
        ).fetchall()
    ]

    # Replace assignments for this client (only for this PT's plans)
    await db.execute(
        sqla_delete(WorkoutPlanAssignment).where(
            WorkoutPlanAssignment.client_id == client_id,
            WorkoutPlanAssignment.plan_id.in_(pt_plan_ids),
        )
    )
    await db.flush()

    for wid in valid_ids:
        plan_res = await db.execute(select(WorkoutPlan).where(WorkoutPlan.id == wid))
        plan = plan_res.scalar_one_or_none()
        if plan:
            db.add(WorkoutPlanAssignment(
                plan_id=wid, client_id=client_id,
                visibility=plan.visibility, status="active",
            ))
    await db.flush()

    return {
        "message":     f"{len(valid_ids)} workout(s) assigned to client",
        "workout_ids": [str(w) for w in valid_ids],
    }