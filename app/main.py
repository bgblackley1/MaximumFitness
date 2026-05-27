from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
# app/main.py — add import:
from app.routers import (
    auth,
    clients,
    measurements,
    progress_photos,
    goals,
    exercises,
    workouts,
    bookings,
    payments,
    dashboard,
    notifications,
    workout_logs,          # ← ADD
)

# And add router registration (after notifications):

app = FastAPI(
    title="PT App API",
    description="Personal Trainer client management platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(clients.router, prefix="/clients", tags=["Clients"])
app.include_router(measurements.router, prefix="/clients", tags=["Measurements"])
app.include_router(progress_photos.router, prefix="/clients", tags=["Progress Photos"])
app.include_router(goals.router, prefix="/clients", tags=["Goals"])
app.include_router(exercises.router, prefix="/exercises", tags=["Exercises"])
app.include_router(workouts.router, prefix="/workout-plans", tags=["Workouts"])
app.include_router(bookings.router, tags=["Bookings"])
app.include_router(payments.router, prefix="/payments", tags=["Payments"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(workout_logs.router, tags=["Workout Logs"])
