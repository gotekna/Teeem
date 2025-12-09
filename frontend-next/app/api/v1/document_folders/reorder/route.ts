import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { folders } = await request.json();

    if (!Array.isArray(folders)) {
      return NextResponse.json(
        { success: false, error: "Invalid request: folders must be an array" },
        { status: 400 }
      );
    }

    // Update each folder's order_position
    for (const folder of folders) {
      await query(
        `UPDATE document_folders SET order_position = $1, updated_at = NOW() WHERE id = $2`,
        [folder.order_position, folder.id]
      );
    }

    // Fetch and return all folders in new order
    const updatedFolders = await query(
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
      ORDER BY order_position ASC
      `
    );

    return NextResponse.json({
      success: true,
      data: updatedFolders,
    });
  } catch (error) {
    console.error("Failed to reorder document folders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reorder document folders" },
      { status: 500 }
    );
  }
}
