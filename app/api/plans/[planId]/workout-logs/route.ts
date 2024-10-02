import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// Define types for the data returned from the database
interface Plan {
  id: string;
  logDate: string;
  type: string;
  workouts: Workout[];
}

interface PlanRow {
  id: string;
  type_name: string;
}

interface WorkoutLogRow {
  log_id: string;
  log_time: string;
  value: number | null;
  weight: number | null;
  one_rep_max: number | null;
  workout_id: string;
  workout_name: string;
  volume_unit: string;
  workout_one_rep_max: number | null;
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

interface Workout {
  id: string;
  name: string;
  volumeUnit: string;
  oneRepMax: number | null;
  logDate: string | null;
  sets: Set[];
}

interface Set {
  id: string;
  targetVolume: Target | null;
  targetWeight: Target | null;
  volume: number | null;
  weight: number | null;
}

export async function GET(req: Request, { params }: { params: { planId: string } }) {
  const { planId } = params;

  try {
    const planQuery = `
      SELECT id, type_name
      FROM workout_plan_item
      WHERE id = $1
    `;
    const planResult = await sql.query<PlanRow>(planQuery, [planId]);

    if (planResult.rowCount === 0) {
      return NextResponse.json({ error: 'Workout plan not found' }, { status: 404 });
    }

    const firstPlanRow = planResult.rows[0];

    const logsQuery = `
      SELECT wl.id as log_id, wl.log_time, wl.value, wl.weight, wl.one_rep_max, 
             w.id as workout_id, w.name as workout_name, w.volume_unit, w.one_rep_max as workout_one_rep_max,
             ws.id as set_id, ws.target_volume_id, ws.target_weight_id,
             vt.target_type as volume_target_type, vt.percentage_of_maximum as volume_percentage_of_maximum,
             vt.exact_value as volume_exact_value, vt.interval_start as volume_interval_start, vt.interval_end as volume_interval_end,
             wt.target_type as weight_target_type, wt.percentage_of_maximum as weight_percentage_of_maximum,
             wt.exact_value as weight_exact_value, wt.interval_start as weight_interval_start, wt.interval_end as weight_interval_end
      FROM workout_log wl
      JOIN workout w ON wl.workout_id = w.id
      LEFT JOIN workout_set ws ON ws.id = wl.workout_set_id
      LEFT JOIN workout_target vt ON vt.id = ws.target_volume_id
      LEFT JOIN workout_target wt ON wt.id = ws.target_weight_id
      WHERE wl.plan_id = $1
      ORDER BY wl.id
    `;

    const { rows } = await sql.query<WorkoutLogRow>(logsQuery, [planId]);

    // Group the workout logs by their log_time
    const plansByDate = rows.reduce((acc: { [date: string]: Plan }, row: WorkoutLogRow) => {
      const logDate = row.log_time; // Group by date only (without time)

      // If there's no plan for this log date yet, create one
      if (!acc[logDate]) {
        acc[logDate] = {
          id: firstPlanRow.id,
          logDate: logDate,
          type: firstPlanRow.type_name,
          workouts: []
        };
      }

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

      // Find or create the workout within this plan
      const workout = acc[logDate].workouts.find((w) => w.id === row.workout_id);
      if (workout) {
        workout.sets.push({
          id: row.set_id!,
          targetVolume,
          targetWeight: targetWeight || null,
          volume: row.value || null,
          weight: row.weight || null,
        });
      } else {
        acc[logDate].workouts.push({
          id: row.workout_id,
          name: row.workout_name,
          volumeUnit: row.volume_unit,
          oneRepMax: row.one_rep_max || null,
          logDate: row.log_time || null,
          sets: [
            {
              id: row.set_id!,
              targetVolume,
              targetWeight: targetWeight || null,
              volume: row.value || null,
              weight: row.weight || null,
            },
          ],
        });
      }

      return acc;
    }, {});

    // Convert the plansByDate object to an array of Plan objects
    const plansArray: Plan[] = Object.values(plansByDate);

    return NextResponse.json(plansArray);
  } catch (error) {
    console.error('Error fetching workout logs:', error);
    return NextResponse.json({ error: 'Failed to fetch workout logs' }, { status: 500 });
  }
}

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
