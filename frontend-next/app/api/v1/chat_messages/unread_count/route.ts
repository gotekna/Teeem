import { NextResponse } from "next/server";

export async function GET() {
  try {
    // For now, return 0 unread messages
    // TODO: Implement proper unread count tracking with user sessions
    // This would require:
    // 1. Getting the current user from session/token
    // 2. Tracking last read timestamps per user per channel
    // 3. Counting messages after that timestamp
    return NextResponse.json({ unread_count: 0 });
  } catch (error) {
    console.error("Failed to fetch unread count:", error);
    return NextResponse.json({ unread_count: 0 });
  }
}
