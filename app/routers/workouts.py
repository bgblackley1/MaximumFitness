import uuid
import copy
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.workout import WorkoutPlan, PlanWeek, PlanDay, PlanExercise
from app.models.workout_log import WorkoutLog, WorkoutLogSet
from app.models.client import ClientProfile
from app.middleware.auth import get_current_user, get_current_pt
from app.schemas.workout import (
    WorkoutPlanCreate,
    WorkoutPlanResponse,
    WorkoutPlanSummary,
    AssignPlanRequest,          # ← ADD
)
from app.schemas.workout_log import WorkoutLogCreate, WorkoutLogSetCreate, WorkoutLogResponse

router = APIRouter()


def load_plan_options():
    return [
        selectinload(WorkoutPlan.weeks)
        .selectinload(PlanWeek.days)
        .selectinload(PlanDay.exercises)
        .selectinload(PlanExercise.exercise),
        selectinload(WorkoutPlan.client).selectinload(ClientProfile.user),
    ]


@router.get("", response_model=list[WorkoutPlanSummary])
async def list_plans(
    client_id: uuid.UUID | None = Query(None),
    plan_status: str | None = Query(None, alias="status"),
    user: User = Depends(get_current_user),        # ← was get_current_pt
    db: AsyncSession = Depends(get_db),
):
    if user.role == "pt":
        query = select(WorkoutPlan).where(WorkoutPlan.pt_id == user.id)
        if client_id:
            query = query.where(WorkoutPlan.client_id == client_id)
        if plan_status:
            query = query.where(WorkoutPlan.status == plan_status)
        query = query.options(
            selectinload(WorkoutPlan.client).selectinload(ClientProfile.user)
        ).order_by(WorkoutPlan.created_at.desc())
    else:
        # Client: only their assigned, client-visible, active plans
        cp_result = await db.execute(
            select(ClientProfile).where(ClientProfile.user_id == user.id)
        )
        cp = cp_result.scalar_one_or_none()
        if not cp:
            raise HTTPException(status_code=404, detail="Client profile not found")
        query = select(WorkoutPlan).where(
            WorkoutPlan.client_id == cp.id,
            WorkoutPlan.visibility == "client_visible",
            WorkoutPlan.status == "active",
        ).order_by(WorkoutPlan.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: WorkoutPlanCreate,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    plan = WorkoutPlan(
        pt_id=pt.id,
        client_id=body.client_id,
        title=body.title,
        goal_focus=body.goal_focus,
        start_date=body.start_date,
        visibility=body.visibility or "draft",
        status="active",
    )
    db.add(plan)
    await db.flush()

    for week_data in body.weeks:
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
                plan_exercise = PlanExercise(
                    day_id=day.id,
                    exercise_id=ex_data.exercise_id,
                    order=ex_data.order,
                    sets=ex_data.sets,
                    reps=ex_data.reps,
                    rest_seconds=ex_data.rest_seconds,
                    notes=ex_data.notes,
                    progression_rule=ex_data.progression_rule,
                )
                db.add(plan_exercise)

    await db.flush()
    return {"message": "Plan created", "plan_id": str(plan.id)}


@router.get("/{plan_id}", response_model=WorkoutPlanResponse)
async def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id)
        .options(*load_plan_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Verify access
    if user.role == "pt" and plan.pt_id != user.id:
        raise HTTPException(status_code=403, detail="Not your plan")
    if user.role == "client":
        if not plan.client or plan.client.user_id != user.id:
            raise HTTPException(status_code=403, detail="Not your plan")

    return plan


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
        .options(*load_plan_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Update plan metadata
    plan.title = body.title
    plan.client_id = body.client_id
    plan.goal_focus = body.goal_focus
    plan.start_date = body.start_date
    plan.visibility = body.visibility or plan.visibility

    # Delete all children and recreate
    for week in plan.weeks:
        for day in week.days:
            for ex in day.exercises:
                await db.delete(ex)
            await db.delete(day)
        await db.delete(week)
    await db.flush()

    # Recreate
    for week_data in body.weeks:
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
                plan_exercise = PlanExercise(
                    day_id=day.id,
                    exercise_id=ex_data.exercise_id,
                    order=ex_data.order,
                    sets=ex_data.sets,
                    reps=ex_data.reps,
                    rest_seconds=ex_data.rest_seconds,
                    notes=ex_data.notes,
                    progression_rule=ex_data.progression_rule,
                )
                db.add(plan_exercise)

    await db.flush()
    return {"message": "Plan updated"}


@router.delete("/{plan_id}")
async def archive_plan(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan).where(
            WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.status = "archived"
    await db.flush()
    return {"message": "Plan archived"}


@router.post("/{plan_id}/duplicate")
async def duplicate_plan(
    plan_id: uuid.UUID,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*load_plan_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    new_plan = WorkoutPlan(
        pt_id=pt.id,
        client_id=None,
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
                new_ex = PlanExercise(
                    day_id=new_day.id,
                    exercise_id=ex.exercise_id,
                    order=ex.order,
                    sets=ex.sets,
                    reps=ex.reps,
                    rest_seconds=ex.rest_seconds,
                    notes=ex.notes,
                    progression_rule=ex.progression_rule,
                )
                db.add(new_ex)

    await db.flush()
    return {"message": "Plan duplicated", "plan_id": str(new_plan.id)}

@router.post("/{plan_id}/assign")
async def assign_plan_to_clients(
    plan_id: uuid.UUID,
    body: AssignPlanRequest,
    pt: User = Depends(get_current_pt),
    db: AsyncSession = Depends(get_db),
):
    """Assign a plan to multiple clients by creating a copy for each."""
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.pt_id == pt.id)
        .options(*load_plan_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    created_ids = []
    skipped = 0

    for client_id in body.client_ids:
        # Verify client belongs to this PT
        cp_result = await db.execute(
            select(ClientProfile).where(
                ClientProfile.id == client_id,
                ClientProfile.pt_id == pt.id,
            )
        )
        if not cp_result.scalar_one_or_none():
            skipped += 1
            continue

        new_plan = WorkoutPlan(
            pt_id=pt.id,
            client_id=client_id,
            title=plan.title,
            goal_focus=plan.goal_focus,
            start_date=plan.start_date,
            visibility=plan.visibility,
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
                    week_id=new_week.id,
                    day_label=day.day_label,
                    day_order=day.day_order,
                )
                db.add(new_day)
                await db.flush()
                for ex in day.exercises:
                    db.add(PlanExercise(
                        day_id=new_day.id,
                        exercise_id=ex.exercise_id,
                        order=ex.order,
                        sets=ex.sets,
                        reps=ex.reps,
                        rest_seconds=ex.rest_seconds,
                        notes=ex.notes,
                        progression_rule=ex.progression_rule,
                    ))
        await db.flush()
        created_ids.append(str(new_plan.id))

    return {
        "message": f"Plan assigned to {len(created_ids)} client(s)",
        "plan_ids": created_ids,
        "skipped": skipped,
    }