import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api";

const BACKEND_URL = getApiBaseUrl();

// GET /api/v1/gold_standard_table/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${BACKEND_URL}/api/v1/gold_standard_table/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch gold standard item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch gold standard item" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/gold_standard_table/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authHeader = request.headers.get("authorization");
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/gold_standard_table/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to update gold standard item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update gold standard item" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/gold_standard_table/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${BACKEND_URL}/api/v1/gold_standard_table/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to delete gold standard item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete gold standard item" },
      { status: 500 }
    );
  }
}
