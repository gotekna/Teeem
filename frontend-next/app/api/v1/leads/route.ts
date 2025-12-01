import { NextResponse } from "next/server";

export async function GET() {
  // No leads table exists in database yet
  return NextResponse.json({ leads: [], total: 0 });
}
