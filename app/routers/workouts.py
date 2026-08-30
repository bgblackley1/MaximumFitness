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
    WorkoutPlanCreate,
    WorkoutPlanResponse,
    WorkoutPlanSummary,
    AssignedClientBasic,
    AssignPlanRequest,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _plan_eager_load():
    return [
        selectinload(WorkoutPlan.weeks)
        .selectinload(PlanWeek.days)
        .selectinload(PlanDay.exercises)
        .selectinload(PlanExercise.exercise),
        selectinload(WorkoutPlan.assignments)
        .selectinload(WorkoutPlanAssignment.client)
        .selectinload(ClientProfile.user),
    ]


def _build_assigned_clients(plan: WorkoutPlan) -> list[AssignedClientBasic]:
    result = []
    for asgn in plan.assignments:
        if asgn.client and asgn.client.user:
            result.append(
                AssignedClientBasic(id=asgn.client_id, name=asgn.client.user.name)
            )
    return result


async def _recreate_weeks(db: AsyncSession, plan: WorkoutPlan, weeks_data):
    """Delete all child nodes and recreate from the provided data."""
    for week in plan.weeks:
        for day in week.days:
            for ex in day.exercises:
                await db.delete(ex)
            await db.delete(day)
        await db.delete(week)
    await db.flush()

    for week_data in weeks_data:
        week = PlanWeek(plan_id=plan.id, week_number=week_data.week_number)
        db.add(week)
        await db.flush()
        for day_data in week_data.days:
            day = PlanDay(
                week_id=week.id,
                day_label=day_data.day_label,
                day_order=day_data.day_order,
            )
            db.add(day)
            await db.flush()
            for ex_data in day_data.exercises:
                db.add(PlanExercise(
                    day_id=day.id,
                    exercise_id=ex_data.exercise_id,
                    order=ex_data.order,
                    sets=ex_data.sets,
                    reps=ex_data.reps,
                    rest_seconds=ex_data.rest_seconds,
                    notes=ex_data.notes,
                    progression_rule=ex_data.progression_rule,
                ))
    await db.flush()


# ── List plans ────────────────────────────────────────────────────────────────

@router.get("")
async def list_plans(
    client_id: uuid.UUID | None = Query(None),
    plan_status: str | None = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = (
            select(WorkoutPlan)
            .where(WorkoutPlan.pt_id == user.id)
            .options(*_plan_eager_load())
            .order_by(WorkoutPlan.created_at.desc())
        )
        if plan_status:
            query = query.where(WorkoutPlan.status == plan_status)
        # Filter by assigned client if specified
        if client_id:
            query = query.join(
                WorkoutPlanAssignment,
                and_(
                    WorkoutPlanAssignment.plan_id == WorkoutPlan.id,
                    WorkoutPlanAssignment.client_id == client_id,
                ),
            )

        result = await db.execute(query)
        plans  = list(result.scalars().all())

        return [
            {
                "id":              str(p.id),
                "title":           p.title,
                "goal_focus":      p.goal_focus,
                "start_date":      str(p.start_date) if p.start_date else None,
                "status":          p.status,
                "visibility":      p.visibility,
                "created_at":      p.created_at.isoformat(),
                "assigned_clients": [
                    {"id": str(a.client_id), "name": a.client.user.name}
                    for a in p.assignments
                    if a.client and a.client.user
                ],
            }
            for p in plans
        ]

    # ── Client view: plans assigned via junction table ──
    cp_result = await db.execute(
        select(ClientProfile).where(ClientProfile.user_id == user.id)
    )
    cp = cp_result.scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Client profile not found")

    asgn_result = await db.execute(
        select(WorkoutPlanAssignment.plan_id).where(
            WorkoutPlanAssignment.client_id == cp.id,
            WorkoutPlanAssignment.status == "active",
            WorkoutPlanAssignment.visibility == "client_visible",
        )
    )
    plan_ids = [row[0] for row in asgn_result.fetchall()]

    query = (
        select(WorkoutPlan)
        .where(WorkoutPlan.id.in_(plan_ids), WorkoutPlan.status == "active")
        .order_by(WorkoutPlan.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


# ── Create plan ───────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: WorkoutPlanCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    plan = WorkoutPlan(
        pt_id=pt.id,
        title=body.title,
        goal_focus=body.goal_focus,
        start_date=body.start_date,
        visibility=body.visibility or "draft",
        status="active",
    )
    db.add(plan)
    await db.flush()
    await _recreate_weeks(db, plan, body.weeks)
    return {"message": "Plan created", "plan_id": str(plan.id)}


# ── Get single plan ───────────────────────────────────────────────────────────

@router.get("/{plan_id}")
async def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id)
        .options(*_plan_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if user.role == "pt" and plan.pt_id != user.id:
        raise HTTPException(status_code=403, detail="Not your plan")

    if user.role == "client":
        cp_res = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = cp_res.scalar_one_or_none()
        if not cp:
            raise HTTPException(status_code=403, detail="Not your plan")
        assigned_ids = [a.client_id for a in plan.assignments]
        if cp.id not in assigned_ids:
            raise HTTPException(status_code=403, detail="Not your plan")

    return {
        "id":         str(plan.id),
        "pt_id":      str(plan.pt_id),
        "title":      plan.title,
        "goal_focus": plan.goal_focus,
        "start_date": str(plan.start_date) if plan.start_date else None,
        "visibility": plan.visibility,
        "status":     plan.status,
        "created_at": plan.created_at.isoformat(),
        "updated_at": plan.updated_at.isoformat(),
        "assigned_clients": [
            {"id": str(a.client_id), "name": a.client.user.name}
            for a in plan.assignments
            if a.client and a.client.user
        ],
        "weeks": [
            {
                "id": str(w.id),
                "week_number": w.week_number,
                "days": [
                    {
                        "id": str(d.id),
                        "day_label": d.day_label,
                        "day_order": d.day_order,
                        "exercises": [
                            {
                                "id":          str(e.id),
                                "exercise_id": str(e.exercise_id),
                                "order":       e.order,
                                "sets":        e.sets,
                                "reps":        e.reps,
                                "rest_seconds":e.rest_seconds,
                                "notes":       e.notes,
                                "progression_rule": e.progression_rule,
                                "exercise": {
                                    "id":           str(e.exercise.id),
                                    "name":         e.exercise.name,
                                    "muscle_group": e.exercise.muscle_group,
                                    "image_url":    e.exercise.image_url,
                                    "cues":         e.exercise.cues,
                                } if e.exercise else None,
                            }
                            for e in d.exercises
                        ],
                    }
                    for d in w.days
                ],
            }
            for w in plan.weeks
        ],
    }


# ── Update plan ───────────────────────────────────────────────────────────────

@router.put("/{plan_id}")
async def update_plan(
    plan_id: uuid.UUID,
    body: WorkoutPlanCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*_plan_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan.title      = body.title
    plan.goal_focus = body.goal_focus
    plan.start_date = body.start_date
    old_visibility  = plan.visibility
    plan.visibility = body.visibility or plan.visibility

    # Cascade visibility change to all assignments
    if plan.visibility != old_visibility:
        for asgn in plan.assignments:
            asgn.visibility = plan.visibility

    await _recreate_weeks(db, plan, body.weeks)
    return {"message": "Plan updated"}


# ── Archive plan ──────────────────────────────────────────────────────────────

@router.delete("/{plan_id}")
async def archive_plan(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.status = "archived"
    await db.flush()
    return {"message": "Plan archived"}


# ── Duplicate plan ────────────────────────────────────────────────────────────

@router.post("/{plan_id}/duplicate")
async def duplicate_plan(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*_plan_eager_load())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    new_plan = WorkoutPlan(
        pt_id=pt.id,
        title=f"{plan.title} (Copy)",
        goal_focus=plan.goal_focus,
        visibility="draft",
        status="active",
    )
    db.add(new_plan)
    await db.flush()

    for week in plan.weeks:
        new_week = PlanWeek(plan_id=new_plan.id, week_number=week.week_number)
        db.add(new_week)
        await db.flush()
        for day in week.days:
            new_day = PlanDay(
                week_id=new_week.id, day_label=day.day_label, day_order=day.day_order
            )
            db.add(new_day)
            await db.flush()
            for ex in day.exercises:
                db.add(PlanExercise(
                    day_id=new_day.id, exercise_id=ex.exercise_id,
                    order=ex.order, sets=ex.sets, reps=ex.reps,
                    rest_seconds=ex.rest_seconds, notes=ex.notes,
                    progression_rule=ex.progression_rule,
                ))
    await db.flush()
    return {"message": "Plan duplicated", "plan_id": str(new_plan.id)}


# ── Assign plan to clients (junction table — no copying) ──────────────────────

@router.post("/{plan_id}/assign")
async def assign_plan_to_clients(
    plan_id: uuid.UUID,
    body: AssignPlanRequest,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    """
    Replace the set of clients assigned to this plan.
    Uses a junction table — the plan itself is never copied.
    """
    result = await db.execute(
        select(WorkoutPlan).where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Verify all client_ids belong to this PT
    valid_ids: list[uuid.UUID] = []
    for cid in body.client_ids:
        cp_res = await db.execute(
            select(ClientProfile).where(
                ClientProfile.id == cid, ClientProfile.pt_id == pt.id
            )
        )
        if cp_res.scalar_one_or_none():
            valid_ids.append(cid)

    # Replace all assignments for this plan atomically
    await db.execute(
        sqla_delete(WorkoutPlanAssignment).where(
            WorkoutPlanAssignment.plan_id == plan_id
        )
    )
    await db.flush()

    for cid in valid_ids:
        db.add(WorkoutPlanAssignment(
            plan_id=plan_id,
            client_id=cid,
            visibility=plan.visibility,
            status="active",
        ))
    await db.flush()

    return {
        "message":             f"Plan assigned to {len(valid_ids)} client(s)",
        "assigned_client_ids": [str(cid) for cid in valid_ids],
        "skipped":             len(body.client_ids) - len(valid_ids),
    }