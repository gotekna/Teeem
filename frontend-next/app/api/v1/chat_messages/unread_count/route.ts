import { NextResponse } from "next/server";

export async function GET() {
  try {
    // TODO: Implement unread count tracking (user sessions, per-channel read timestamps)
    return NextResponse.json({ unread_count: 0 });
  } catch (error) {
    console.error("Failed to fetch unread count:", error);
    return NextResponse.json({ unread_count: 0 });
  }
}
