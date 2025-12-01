import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface TaskTemplate {
  id: number;
  name: string;
  task_type: string;
  category: string;
  default_duration_days: number;
  sequence_order: number | null;
  predecessor_template_codes: string[];
  description: string | null;
  is_milestone: boolean;
  requires_photo: boolean;
  is_standard: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const taskType = searchParams.get('task_type');
    const search = searchParams.get('search');

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (taskType) {
      params.push(taskType);
      whereClause += ` AND task_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    const templates = await query<TaskTemplate>(`
      SELECT
        id, name, task_type, category, default_duration_days,
        sequence_order, predecessor_template_codes, description,
        is_milestone, requires_photo, is_standard
      FROM task_templates
      ${whereClause}
      ORDER BY sequence_order NULLS LAST, name
    `, params.length > 0 ? params : undefined);

    return NextResponse.json({
      task_templates: templates,
      total: templates.length,
    });
  } catch (error) {
    console.error('Task templates API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task templates' },
      { status: 500 }
    );
  }
}
