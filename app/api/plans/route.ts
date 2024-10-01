import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const plansQuery = `
      SELECT id, type_name
      FROM workout_plan_item
    `;
    const plansResult = await sql.query(plansQuery);

    if (plansResult.rowCount === 0) {
      return NextResponse.json({ error: 'No workout plans found' }, { status: 404 });
    }

    const plans = plansResult.rows;

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

    const { rows } = await sql.query(workoutsQuery);

    const workoutPlans = plans.map((plan: any) => {
      const workouts = rows
        .filter((row: any) => row.plan_id === plan.id)
        .reduce((acc: any[], row: any) => {
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

    return NextResponse.json(workoutPlans);
  } catch (error) {
    console.error('Error fetching workout plans:', error);
    return NextResponse.json({ error: 'Failed to fetch workout plans' }, { status: 500 });
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
