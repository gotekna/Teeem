import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api";

const BACKEND_URL = getApiBaseUrl();

// GET /api/v1/gold_standard_table - List all gold standard items
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);

    const url = new URL(`${BACKEND_URL}/api/v1/gold_standard_table`);
    searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch gold standard table:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch gold standard table" },
      { status: 500 }
    );
  }
}

// POST /api/v1/gold_standard_table - Create a new gold standard item
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/gold_standard_table`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to create gold standard item:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create gold standard item" },
      { status: 500 }
    );
  }
}
