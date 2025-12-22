"use client";

/**
 * ActivityTab - Shows activity log for an entity
 *
 * Extracted from corporate page for unified tab system.
 * Currently a placeholder - activity log coming soon.
 */

interface ActivityTabProps {
  entityId?: string;
  companyId?: string;
}

export function ActivityTab(_props: ActivityTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Activity</h3>
      <p className="text-muted-foreground">Activity log coming soon</p>
    </div>
  );
}

export default ActivityTab;
