import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

// GET /api/v1/foundations/:id - Get foundation (table) with columns
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${BACKEND_URL}/api/v1/foundations/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch foundation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch foundation" },
      { status: 500 }
    );
  }
}
