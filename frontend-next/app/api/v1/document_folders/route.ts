import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api";

const BACKEND_URL = getApiBaseUrl();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/v1/document_folders${queryString ? `?${queryString}` : ""}`;

    // Forward authorization header from client request
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(url, {
      headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch document folders:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch document folders",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = `${BACKEND_URL}/api/v1/document_folders`;

    // Forward authorization header from client request
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to create document folder:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create document folder",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
