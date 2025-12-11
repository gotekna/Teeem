import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://teeemlive-ce8e2660a615.herokuapp.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = `${BACKEND_URL}/api/v1/document_folders/reorder`;

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
    console.error("Failed to reorder document folders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reorder document folders" },
      { status: 500 }
    );
  }
}
