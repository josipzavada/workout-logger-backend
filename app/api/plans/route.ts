import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// Define types for the database rows
interface Plan {
  id: string;
  type_name: string;
}

interface WorkoutLogRow {
  plan_id: string;
  workout_id: string;
  workout_name: string;
  volume_unit: string;
  one_rep_max: number | null;
  set_id: string | null;
  target_volume_id: string | null;
  target_weight_id: string | null;
  volume_target_type: string | null;
  volume_percentage_of_maximum: number | null;
  volume_exact_value: number | null;
  volume_interval_start: number | null;
  volume_interval_end: number | null;
  weight_target_type: string | null;
  weight_percentage_of_maximum: number | null;
  weight_exact_value: number | null;
  weight_interval_start: number | null;
  weight_interval_end: number | null;
}

interface Target {
  type: 'maximum' | 'percentageOfMaximum' | 'exact' | 'interval';
  value?: number;
  start?: number;
  end?: number;
}

interface Set {
  id: string | null;
  targetVolume: Target | null;
  targetWeight: Target | null;
}

interface Workout {
  id: string;
  name: string;
  volumeUnit: string;
  oneRepMax: number | null;
  sets: Set[];
}

// Main function to handle GET request
export async function GET() {
  try {
    // Query to get workout plans
    const plansQuery = `
      SELECT id, type_name
      FROM workout_plan_item
    `;
    const plansResult = await sql.query<Plan>(plansQuery);

    if (plansResult.rowCount === 0) {
      return NextResponse.json({ error: 'No workout plans found' }, { status: 404 });
    }

    const plans = plansResult.rows;

    // Query to get workouts and sets associated with the plans
    const workoutsQuery = `
      SELECT w.plan_id, w.id as workout_id, w.name as workout_name, w.volume_unit, w.one_rep_max, 
             ws.id as set_id, ws.target_volume_id, ws.target_weight_id, 
             vt.target_type as volume_target_type, vt.percentage_of_maximum as volume_percentage_of_maximum,
             vt.exact_value as volume_exact_value, vt.interval_start as volume_interval_start, vt.interval_end as volume_interval_end,
             wt.target_type as weight_target_type, wt.percentage_of_maximum as weight_percentage_of_maximum,
             wt.exact_value as weight_exact_value, wt.interval_start as weight_interval_start, wt.interval_end as weight_interval_end
      FROM workout w
      LEFT JOIN workout_set ws ON ws.workout_id = w.id
      LEFT JOIN workout_target vt ON vt.id = ws.target_volume_id
      LEFT JOIN workout_target wt ON wt.id = ws.target_weight_id
    `;

    const { rows } = await sql.query<WorkoutLogRow>(workoutsQuery);

    // Process workout plans and associate workouts and sets
    const workoutPlans = plans.map((plan) => {
      const workouts = rows
        .filter((row) => row.plan_id === plan.id)
        .reduce((acc: Workout[], row: WorkoutLogRow) => {
          const workout = acc.find((w) => w.id === row.workout_id);
          const targetVolume = getTargetObject({
            type: row.volume_target_type,
            percentage_of_maximum: row.volume_percentage_of_maximum,
            exact_value: row.volume_exact_value,
            interval_start: row.volume_interval_start,
            interval_end: row.volume_interval_end,
          });
          const targetWeight = getTargetObject({
            type: row.weight_target_type,
            percentage_of_maximum: row.weight_percentage_of_maximum,
            exact_value: row.weight_exact_value,
            interval_start: row.weight_interval_start,
            interval_end: row.weight_interval_end,
          });

          if (workout) {
            workout.sets.push({
              id: row.set_id,
              targetVolume,
              targetWeight: targetWeight || null,
            });
          } else {
            acc.push({
              id: row.workout_id,
              name: row.workout_name,
              volumeUnit: row.volume_unit,
              oneRepMax: row.one_rep_max || null,
              sets: [
                {
                  id: row.set_id,
                  targetVolume,
                  targetWeight: targetWeight || null,
                },
              ],
            });
          }
          return acc;
        }, []);

      return {
        id: plan.id,
        type: plan.type_name,
        workouts: workouts,
      };
    });

    // Return response as JSON
    return NextResponse.json(workoutPlans);
  } catch (error) {
    console.error('Error fetching workout plans:', error);
    return NextResponse.json({ error: 'Failed to fetch workout plans' }, { status: 500 });
  }
}

// Helper function to create a Target object
function getTargetObject(row: {
  type: string | null;
  percentage_of_maximum: number | null;
  exact_value: number | null;
  interval_start: number | null;
  interval_end: number | null;
}): Target | null {
  if (!row.type) return null;

  switch (row.type) {
    case 'maximum':
      return { type: 'maximum' };
    case 'percentageOfMaximum':
      return { type: 'percentageOfMaximum', value: row.percentage_of_maximum || undefined };
    case 'exact':
      return { type: 'exact', value: row.exact_value || undefined };
    case 'interval':
      return { type: 'interval', start: row.interval_start || undefined, end: row.interval_end || undefined };
    default:
      return null;
  }
}
