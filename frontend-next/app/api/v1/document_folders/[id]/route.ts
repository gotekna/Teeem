import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://teeem-backend-39604ccca45a.herokuapp.com";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = `${BACKEND_URL}/api/v1/document_folders/${id}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch document folder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch document folder" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const url = `${BACKEND_URL}/api/v1/document_folders/${id}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to update document folder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update document folder" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = `${BACKEND_URL}/api/v1/document_folders/${id}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to delete document folder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete document folder" },
      { status: 500 }
    );
  }
}
