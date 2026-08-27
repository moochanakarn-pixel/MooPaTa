import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const SEXES = ["MALE", "FEMALE"];
const ACTIVITY_LEVELS = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"];
const GOALS = ["LOSE", "MAINTAIN", "GAIN"];

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  const heightCm = Number(body.heightCm);
  const age = Number(body.age);
  const sex = body.sex;
  const activityLevel = body.activityLevel;
  const nutritionGoal = body.nutritionGoal;
  const goalRateKgPerWeek = body.goalRateKgPerWeek === null || body.goalRateKgPerWeek === undefined ? null : Number(body.goalRateKgPerWeek);

  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) {
    return NextResponse.json({ error: "invalid_weight" }, { status: 400 });
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0 || heightCm > 300) {
    return NextResponse.json({ error: "invalid_height" }, { status: 400 });
  }
  if (!Number.isInteger(age) || age <= 0 || age > 120) {
    return NextResponse.json({ error: "invalid_age" }, { status: 400 });
  }
  if (!SEXES.includes(sex)) {
    return NextResponse.json({ error: "invalid_sex" }, { status: 400 });
  }
  if (!ACTIVITY_LEVELS.includes(activityLevel)) {
    return NextResponse.json({ error: "invalid_activity_level" }, { status: 400 });
  }
  if (!GOALS.includes(nutritionGoal)) {
    return NextResponse.json({ error: "invalid_goal" }, { status: 400 });
  }
  if (goalRateKgPerWeek !== null && (!Number.isFinite(goalRateKgPerWeek) || goalRateKgPerWeek < 0 || goalRateKgPerWeek > 1.5)) {
    return NextResponse.json({ error: "invalid_goal_rate" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { weightKg, heightCm, age, sex, activityLevel, nutritionGoal, goalRateKgPerWeek },
  });
  return NextResponse.json({ ok: true });
}
