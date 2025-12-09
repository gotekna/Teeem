import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folder = await queryOne(
      `
      SELECT
        id,
        name,
        description,
        order_position,
        entity_types,
        active,
        created_at,
        updated_at
      FROM document_folders
      WHERE id = $1
      `,
      [id]
    );

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: folder,
    });
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
    const { folder } = await request.json();

    const result = await query(
      `
      UPDATE document_folders
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        order_position = COALESCE($3, order_position),
        entity_types = COALESCE($4, entity_types),
        active = COALESCE($5, active),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [
        folder.name,
        folder.description,
        folder.order_position,
        folder.entity_types ? JSON.stringify(folder.entity_types) : null,
        folder.active,
        id,
      ]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
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
    const result = await query(
      `DELETE FROM document_folders WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document folder:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete document folder" },
      { status: 500 }
    );
  }
}
