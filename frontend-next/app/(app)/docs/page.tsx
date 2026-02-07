"use client";

/**
 * Documentation Page - User Manual & Help Center
 *
 * SSoT: lib/docs/chapters.json contains all chapter content
 * Static loading - no backend API required
 * URL: /docs/5 (path-based chapter selection)
 */

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Search,
  ChevronRight,
  Home,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import chaptersData from "@/lib/docs/chapters.json";
import { getChapterName } from "@/lib/helpMapping";

// Chapter list with icons
const CHAPTERS = [
  { id: 0, name: "Overview", icon: "📚" },
  { id: 1, name: "Authentication & Users", icon: "🔐" },
  { id: 2, name: "System Administration", icon: "⚙️" },
  { id: 3, name: "Contacts & Relationships", icon: "👥" },
  { id: 4, name: "Price Books & Suppliers", icon: "💰" },
  { id: 5, name: "Jobs & Construction", icon: "🏗️" },
  { id: 6, name: "Estimates & Quoting", icon: "📝" },
  { id: 7, name: "AI Plan Review", icon: "🤖" },
  { id: 8, name: "Purchase Orders", icon: "📦" },
  { id: 9, name: "Gantt & Schedule Master", icon: "📊" },
  { id: 10, name: "Tasks & Checklists", icon: "✅" },
  { id: 11, name: "Weather & Holidays", icon: "🌤️" },
  { id: 12, name: "OneDrive Integration", icon: "☁️" },
  { id: 13, name: "Email Integration", icon: "📧" },
  { id: 14, name: "Chat & Communications", icon: "💬" },
  { id: 15, name: "Xero Accounting", icon: "📈" },
  { id: 16, name: "Payments & Financials", icon: "💳" },
  { id: 17, name: "Workflows & Automation", icon: "🔄" },
  { id: 18, name: "Custom Tables", icon: "📋" },
  { id: 19, name: "Corporate Module", icon: "🏢" },
  { id: 20, name: "Corporate Extended", icon: "🏛️" },
  { id: 21, name: "Work Health & Safety", icon: "🦺" },
  { id: 22, name: "Customer Portal", icon: "🌐" },
  { id: 23, name: "File Warehouse", icon: "📁" },
  { id: 24, name: "E-Signatures", icon: "✍️" },
  { id: 25, name: "Data Warehouse", icon: "🗄️" },
];

interface SearchResult {
  chapter: number;
  title: string;
  excerpt: string;
  score: number;
}

export default function DocsPage() {
  const router = useRouter();
  const params = useParams();

  // URL state - path-based: /docs/5 instead of /docs?chapter=5
  const chapterParam = params.chapter as string | undefined;
  const selectedChapter = chapterParam !== undefined ? parseInt(chapterParam) : null;

  // UI state
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);

  // Content state
  const [content, setContent] = React.useState("");

  // Load chapter content from static JSON
  React.useEffect(() => {
    if (selectedChapter !== null) {
      const chapterKey = selectedChapter.toString();
      const chapterContent = (chaptersData.chapters as Record<string, { content: string }>)[chapterKey];
      if (chapterContent) {
        setContent(chapterContent.content);
      } else {
        setContent("Chapter content not yet available.");
      }
    } else {
      setContent("");
    }
  }, [selectedChapter]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search through all chapters in static content
    const chapters = chaptersData.chapters as Record<string, { title: string; content: string }>;
    Object.entries(chapters).forEach(([chapterId, chapter]) => {
      const chapterNum = parseInt(chapterId);
      const chapterContent = chapter.content.toLowerCase();
      const title = chapter.title.toLowerCase();

      if (chapterContent.includes(query) || title.includes(query)) {
        // Find the matching line for excerpt
        const lines = chapter.content.split('\n');
        let excerpt = '';
        for (const line of lines) {
          if (line.toLowerCase().includes(query)) {
            excerpt = line.substring(0, 200);
            break;
          }
        }
        if (!excerpt) {
          excerpt = chapter.content.substring(0, 200);
        }

        results.push({
          chapter: chapterNum,
          title: chapter.title,
          excerpt,
          score: title.includes(query) ? 100 : 50,
        });
      }
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);
    setSearchResults(results.slice(0, 10));
  };

  const navigateToChapter = (chapter: number) => {
    router.push(`/docs/${chapter}`);
    setSearchResults([]);
    setSearchQuery("");
  };

  // Helper to format inline markdown (bold, code, etc.)
  const formatInlineMarkdown = (text: string): React.ReactNode => {
    // Handle inline code first
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      // Handle bold
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`${i}-${j}`} className="text-foreground font-medium">{bp.slice(2, -2)}</strong>;
        }
        return bp;
      });
    });
  };

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r bg-muted/30 transition-all duration-300",
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h1 className="font-bold text-lg">Documentation</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              TEEEM User Manual
            </p>
          </div>

          {/* Chapter List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {CHAPTERS.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => navigateToChapter(chapter.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    selectedChapter === chapter.id
                      ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-base">{chapter.icon}</span>
                  <span className="flex-1 truncate">
                    {chapter.id}. {chapter.name}
                  </span>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    selectedChapter === chapter.id && "rotate-90"
                  )} />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search documentation..."
              className="pl-9"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleSearch}>
            Search
          </Button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
            <Home className="h-4 w-4" />
            <span>/</span>
            <span>Docs</span>
            {selectedChapter !== null && (
              <>
                <span>/</span>
                <span className="text-foreground font-medium">
                  Chapter {selectedChapter}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchResults([]);
                  setSearchQuery("");
                }}
              >
                Clear
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => navigateToChapter(result.chapter)}
                  className="w-full text-left p-3 bg-background rounded-lg border hover:border-indigo-500 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Ch. {result.chapter}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {getChapterName(result.chapter)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {result.excerpt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {selectedChapter !== null ? (
              // Chapter Content
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">
                    {CHAPTERS[selectedChapter]?.icon || "📖"}
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold">
                      Chapter {selectedChapter}: {getChapterName(selectedChapter)}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      TEEEM User Manual
                    </p>
                  </div>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {content.split("\n").map((line, i) => {
                    // Handle horizontal rules
                    if (line.trim() === "---") {
                      return <hr key={i} className="my-8 border-border" />;
                    }
                    // Handle headers
                    if (line.startsWith("## ")) {
                      return (
                        <h2 key={i} className="text-xl font-semibold mt-8 mb-4 text-foreground">
                          {line.replace("## ", "")}
                        </h2>
                      );
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3 key={i} className="text-lg font-medium mt-6 mb-3 text-foreground">
                          {line.replace("### ", "")}
                        </h3>
                      );
                    }
                    // Handle table rows
                    if (line.startsWith("|")) {
                      const cells = line.split("|").filter(c => c.trim());
                      const isHeader = content.split("\n")[i + 1]?.includes("---");
                      const isSeparator = line.includes("---");
                      if (isSeparator) return null;
                      return (
                        <div key={i} className={cn(
                          "grid gap-4 py-2 px-3 border-b border-border text-sm",
                          isHeader && "bg-muted/50 font-medium"
                        )} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
                          {cells.map((cell, j) => (
                            <div key={j}>{cell.trim()}</div>
                          ))}
                        </div>
                      );
                    }
                    // Handle bullet points
                    if (line.startsWith("- ")) {
                      return (
                        <li key={i} className="ml-6 text-muted-foreground">
                          {formatInlineMarkdown(line.replace("- ", ""))}
                        </li>
                      );
                    }
                    // Handle numbered lists
                    if (/^\d+\.\s/.test(line)) {
                      return (
                        <li key={i} className="ml-6 list-decimal text-muted-foreground">
                          {formatInlineMarkdown(line.replace(/^\d+\.\s/, ""))}
                        </li>
                      );
                    }
                    // Regular paragraph
                    return line.trim() ? (
                      <p key={i} className="mb-3 text-muted-foreground leading-relaxed">
                        {formatInlineMarkdown(line)}
                      </p>
                    ) : (
                      <div key={i} className="h-2" />
                    );
                  })}
                </div>

                {/* Navigation Footer */}
                <div className="flex items-center justify-between mt-12 pt-6 border-t">
                  {selectedChapter > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => navigateToChapter(selectedChapter - 1)}
                    >
                      ← Chapter {selectedChapter - 1}: {getChapterName(selectedChapter - 1)}
                    </Button>
                  ) : (
                    <div />
                  )}
                  {selectedChapter < 25 && (
                    <Button
                      variant="outline"
                      onClick={() => navigateToChapter(selectedChapter + 1)}
                    >
                      Chapter {selectedChapter + 1}: {getChapterName(selectedChapter + 1)} →
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Welcome Screen
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto text-indigo-600 dark:text-indigo-400 mb-6" />
                <h1 className="text-3xl font-bold mb-4">TEEEM Documentation</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  Welcome to the TEEEM User Manual. Select a chapter from the sidebar
                  to get started, or use the search to find specific topics.
                </p>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <Card
                    className="cursor-pointer hover:border-indigo-500 transition-colors"
                    onClick={() => navigateToChapter(0)}
                  >
                    <CardContent className="p-6 text-center">
                      <span className="text-3xl mb-2 block">🚀</span>
                      <h3 className="font-medium">Getting Started</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Overview and basics
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:border-indigo-500 transition-colors"
                    onClick={() => navigateToChapter(5)}
                  >
                    <CardContent className="p-6 text-center">
                      <span className="text-3xl mb-2 block">🏗️</span>
                      <h3 className="font-medium">Jobs & Projects</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Construction management
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:border-indigo-500 transition-colors"
                    onClick={() => navigateToChapter(9)}
                  >
                    <CardContent className="p-6 text-center">
                      <span className="text-3xl mb-2 block">📊</span>
                      <h3 className="font-medium">Gantt & Scheduling</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Timeline management
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* All Chapters Grid */}
                <div className="mt-12">
                  <h2 className="text-lg font-semibold mb-4">All Chapters</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {CHAPTERS.map((chapter) => (
                      <button
                        key={chapter.id}
                        onClick={() => navigateToChapter(chapter.id)}
                        className="p-3 rounded-lg border hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                      >
                        <span className="text-xl">{chapter.icon}</span>
                        <p className="text-xs font-medium mt-1 truncate">
                          {chapter.id}. {chapter.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
