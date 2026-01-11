"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { X, Search, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { getChapterName } from "@/lib/helpMapping";

interface SearchResult {
  chapter: number | null;
  title: string;
  excerpt: string;
}

interface ContextualHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: number | null;
  section?: string;
}

export function ContextualHelpModal({
  isOpen,
  onClose,
  chapter,
  section,
}: ContextualHelpModalProps) {
  const router = useRouter();
  const [helpContent, setHelpContent] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);

  // Load help content for the chapter
  React.useEffect(() => {
    if (isOpen && chapter !== null) {
      loadHelpContent();
    }
     
  }, [isOpen, chapter, section]);

  const loadHelpContent = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: { content: string };
      }>("/api/v1/documentation/user-manual", {
        params: chapter !== null ? { chapter } : {},
      });

      if (response?.success && response?.data) {
        setHelpContent(response.data.content || "No help content available for this page.");
      }
    } catch (error) {
      console.error("Failed to load help content:", error);
      setHelpContent("Unable to load help content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get<{
        success: boolean;
        data: { results: Array<{ doc_type: string; content: string }> };
      }>("/api/v1/documentation/search", {
        params: { q: searchQuery },
      });

      if (response?.success && response?.data) {
        const results = (response.data.results || [])
          .filter((r) => r.doc_type === "user_manual")
          .map((r) => {
            const chapterMatch = r.content.match(/Chapter (\d+):/i);
            return {
              chapter: chapterMatch ? parseInt(chapterMatch[1]) : null,
              title: r.content.substring(0, 100),
              excerpt: r.content,
            };
          })
          .filter((r) => r.chapter !== null);

        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    }
  };

  const handleOpenFullHelp = () => {
    onClose();
    router.push(`/documentation?doc=user-manual&chapter=${chapter}`);
  };

  const handleSearchResultClick = (resultChapter: number | null) => {
    if (resultChapter !== null) {
      onClose();
      router.push(`/documentation?doc=user-manual&chapter=${resultChapter}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-xl font-semibold">
              {chapter !== null
                ? `Chapter ${chapter}: ${getChapterName(chapter)}`
                : "Help"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <div className="p-4 border-b border-border dark:border-border bg-muted dark:bg-gray-900">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search help documentation..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Found {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchResultClick(result.chapter)}
                    className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-border dark:border-border hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground dark:text-white">
                      Chapter {result.chapter}: {result.title}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1 line-clamp-2">
                      {result.excerpt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Help Content */}
        <ScrollArea className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={48} className="text-indigo-600" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {helpContent.split("\n").map((line, i) => (
                <p key={i}>{line || <br />}</p>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border dark:border-border bg-muted dark:bg-gray-900">
          <Button
            variant="link"
            onClick={handleOpenFullHelp}
            className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400"
          >
            <BookOpen className="h-4 w-4" />
            Open Full Help Center
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
