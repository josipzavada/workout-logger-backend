import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

interface WorkoutSet {
  id: string;
  volume: number;
  weight: number;
}

interface Workout {
  id: string;
  sets: WorkoutSet[];
  oneRepMax?: number;
}

interface RequestData {
  workouts: Workout[];
}

export async function POST(req: Request, { params }: { params: { planId: string } }) {
  const { planId } = params;

  try {
    const data: RequestData = await req.json();
    const { workouts } = data;

    const logTime = new Date().toISOString();

    const values = workouts.flatMap(workout => 
      workout.sets.map(set => [
        planId,
        workout.id,
        set.id,
        logTime,
        set.volume,
        set.weight,
        workout.oneRepMax || null
      ])
    );

    const insertLogQuery = `
      INSERT INTO workout_log (plan_id, workout_id, workout_set_id, log_time, value, weight, one_rep_max)
      VALUES ${values.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
    `;

    await sql.query(insertLogQuery, values.flat());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding workout log:', error);
    return NextResponse.json({ error: 'Failed to add workout log' }, { status: 500 });
  }
}
