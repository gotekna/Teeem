import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api";

const BACKEND_URL = getApiBaseUrl();

// Fallback quote when API fails
const FALLBACK_QUOTE = {
  success: true,
  data: {
    quote: "Every day is a new opportunity to build something great.",
    author: "TEEEM Team",
  },
};

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    const response = await fetch(`${BACKEND_URL}/api/v1/inspiring_quotes/daily`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!response.ok) {
      // Return fallback on API error
      return NextResponse.json(FALLBACK_QUOTE);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch daily quote:", error);
    // Return fallback on network error
    return NextResponse.json(FALLBACK_QUOTE);
  }
}
