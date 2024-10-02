import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(req: Request, { params }: { params: { planId: string } }) {
  const { planId } = params;

  try {
    const data = await req.json();
    const { workouts, type } = data;

    for (const workout of workouts) {
      for (const set of workout.sets) {
        const { id: workoutSetId, volume, weight, targetVolume, targetWeight } = set;

        const insertLogQuery = `
          INSERT INTO workout_log (plan_id, workout_id, workout_set_id, log_time, value, weight, one_rep_max)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, NULL)
        `;

        await sql.query(insertLogQuery, [
          planId,
          workout.id,
          workoutSetId,
          volume,
          weight,
        ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding workout log:', error);
    return NextResponse.json({ error: 'Failed to add workout log' }, { status: 500 });
  }
}
