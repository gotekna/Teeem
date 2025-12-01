import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const jobs = await query(`
      SELECT
        id,
        title,
        ted_number,
        stage,
        contract_value,
        live_profit,
        profit_percentage,
        start_date,
        location,
        site_supervisor_name,
        site_supervisor_email,
        site_supervisor_phone,
        design_name,
        created_at,
        updated_at
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
