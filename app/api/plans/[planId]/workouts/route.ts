import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: Request, { params }: { params: { planId: string } }) {
  const { planId } = params;

  try {
    const planQuery = `
      SELECT id, type_name
      FROM workout_plan_item
      WHERE id = $1
    `;
    const planResult = await sql.query(planQuery, [planId]);

    if (planResult.rowCount === 0) {
      return NextResponse.json({ error: 'Workout plan not found' }, { status: 404 });
    }

    const plan = planResult.rows[0];

    const workoutQuery = `
      SELECT w.id as workout_id, w.name as workout_name, w.volume_unit, w.one_rep_max, 
             ws.id as set_id, ws.target_volume_id, ws.target_weight_id, 
             vt.target_type as volume_target_type, vt.percentage_of_maximum as volume_percentage_of_maximum,
             vt.exact_value as volume_exact_value, vt.interval_start as volume_interval_start, vt.interval_end as volume_interval_end,
             wt.target_type as weight_target_type, wt.percentage_of_maximum as weight_percentage_of_maximum,
             wt.exact_value as weight_exact_value, wt.interval_start as weight_interval_start, wt.interval_end as weight_interval_end
      FROM workout w
      LEFT JOIN workout_set ws ON ws.workout_id = w.id
      LEFT JOIN workout_target vt ON vt.id = ws.target_volume_id
      LEFT JOIN workout_target wt ON wt.id = ws.target_weight_id
      WHERE w.plan_id = $1
    `;

    const { rows } = await sql.query(workoutQuery, [planId]);

    const workouts = rows.reduce((acc: any[], row: any) => {
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
              targetVolume,
              targetWeight: targetWeight || null,
            },
          ],
        });
      }
      return acc;
    }, []);

    const workoutPlan = {
      id: plan.id,
      typeName: plan.type_name,
      workouts: workouts,
    };

    return NextResponse.json({ workoutPlan });
  } catch (error) {
    console.error('Error fetching workouts and plan:', error);
    return NextResponse.json({ error: 'Failed to fetch workout plan and workouts' }, { status: 500 });
  }
}

function getTargetObject(row: any) {
  if (!row.type) return null;

  switch (row.type) {
    case 'maximum':
      return { type: 'maximum' };
    case 'percentageOfMaximum':
      return { type: 'percentageOfMaximum', value: row.percentage_of_maximum };
    case 'exact':
      return { type: 'exact', value: row.exact_value };
    case 'interval':
      return { type: 'interval', start: row.interval_start, end: row.interval_end };
    default:
      return null;
  }
}
