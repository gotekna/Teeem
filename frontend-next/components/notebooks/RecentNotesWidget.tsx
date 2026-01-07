"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Clock, Notebook, Pin } from "lucide-react";
import { useRecentPages, type NotebookPage } from "./hooks/useNotebookPage";
import { formatDistanceToNow } from "date-fns";

interface RecentNotesWidgetProps {
  onSelectPage: (pageId: number, notebookId: number) => void;
  className?: string;
}

export function RecentNotesWidget({ onSelectPage, className }: RecentNotesWidgetProps) {
  const { pages, isLoading } = useRecentPages();

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-40", className)}>
        <Spinner />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-40 text-muted-foreground", className)}>
        <Clock className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No recent notes</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Recent Notes</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pages.slice(0, 9).map((page) => (
          <RecentNoteCard
            key={page.id}
            page={page}
            onClick={() => {
              if (page.notebook?.id) {
                onSelectPage(page.id, page.notebook.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface RecentNoteCardProps {
  page: NotebookPage;
  onClick: () => void;
}

function RecentNoteCard({ page, onClick }: RecentNoteCardProps) {
  const timeAgo = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(page.updated_at), { addSuffix: true });
    } catch {
      return "";
    }
  }, [page.updated_at]);

  return (
    <div
      className="group p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {page.is_pinned ? (
            <Pin className="h-5 w-5 text-primary" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {page.title}
          </h4>

          {page.notebook && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Notebook className="h-3 w-3" />
              <span className="truncate">
                {page.notebook.name}
                {page.section && ` / ${page.section.name}`}
              </span>
            </div>
          )}

          {page.preview && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {page.preview}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
            {page.word_count > 0 && (
              <>
                <span>•</span>
                <span>{page.word_count} words</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
