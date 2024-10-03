# Workout Tracker API

This API provides endpoints for managing workout plans and logs. It's built using Next.js and Vercel Postgres.

## Database Structure

The database consists of the following tables:
- `workout_target`
- `workout`
- `workout_set`
- `workout_plan_item`
- `workout_log`

Note: Only the `workout_log` table can be modified by users. All other tables are managed by personal trainers through their admin app.

## API Endpoints

### 1. Get Workout Plans

- **Endpoint:** `/api/plans`
- **Method:** GET
- **Description:** Retrieves all workout plans with their associated workouts and sets.

### 2. Get Workout Logs for a Specific Plan

- **Endpoint:** `/api/plans/[planId]/workout-logs`
- **Method:** GET
- **Description:** Retrieves workout logs for a specific plan, including all logged sets and their values.

### 3. Add Workout Log

- **Endpoint:** `/api/plans/[planId]/add-log`
- **Method:** POST
- **Description:** Adds a new workout log entry for a specific plan.
- **Request Body:**
  ```json
  {
    "workouts": [
      {
        "id": "string",
        "sets": [
          {
            "id": "string",
            "volume": "number",
            "weight": "number (optional)"
          }
        ],
        "oneRepMax": "number (optional)"
      }
    ]
  }
  ```

## Code References

For detailed implementation of these endpoints, refer to the following files:

1. Get Workout Plans: `app/api/plans/route.ts`
2. Get Workout Logs: `app/api/plans/[planId]/workout-logs/route.ts`
3. Add Workout Log: `app/api/plans/[planId]/add-log/route.ts`

## Setup and Development

The project is deployed on Vercel and can be accessed at https://workout-logger-backend.vercel.app/
