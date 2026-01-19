"use client";

import * as React from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Quote,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface InspiringQuote {
  id: number;
  quote: string;
  original_quote?: string;
  author: string;
  category: string;
  is_active: boolean;
  display_order?: number;
  aussie_slang?: string;
  created_at: string;
  updated_at?: string;
}

const DEFAULT_QUOTES: InspiringQuote[] = [
  { id: 1, quote: "The only way to do great work is to love what you do.", author: "Steve Jobs", category: "Motivation", is_active: true, created_at: new Date().toISOString() },
  { id: 2, quote: "Quality is not an act, it is a habit.", author: "Aristotle", category: "Success", is_active: true, created_at: new Date().toISOString() },
  { id: 3, quote: "The best way to predict the future is to create it.", author: "Peter Drucker", category: "Leadership", is_active: true, created_at: new Date().toISOString() },
  { id: 4, quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", category: "Perseverance", is_active: true, created_at: new Date().toISOString() },
  { id: 5, quote: "Alone we can do so little; together we can do so much.", author: "Helen Keller", category: "Teamwork", is_active: true, created_at: new Date().toISOString() },
  { id: 6, quote: "A building has integrity just like a man. And just as seldom.", author: "Ayn Rand", category: "Construction", is_active: true, created_at: new Date().toISOString() },
  { id: 7, quote: "We shape our buildings; thereafter they shape us.", author: "Winston Churchill", category: "Construction", is_active: true, created_at: new Date().toISOString() },
  { id: 8, quote: "Excellence is not a destination but a continuous journey that never ends.", author: "Brian Tracy", category: "Success", is_active: true, created_at: new Date().toISOString() },
];

export function InspiringQuotesTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [quotes, setQuotes] = React.useState<InspiringQuote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingQuote, setEditingQuote] = React.useState<InspiringQuote | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [randomQuote, setRandomQuote] = React.useState<InspiringQuote | null>(null);
  const [filterCategory, setFilterCategory] = React.useState<string>("");

  const [formData, setFormData] = React.useState({
    quote: "",
    author: "",
    category: "",
    active: true,
  });

  React.useEffect(() => {
    loadQuotes();
  }, []);

  React.useEffect(() => {
    if (quotes.length > 0) {
      pickRandomQuote();
    }
     
  }, [quotes]);

  const loadQuotes = async () => {
    try {
      const response = await api.get<{ success: boolean; data: InspiringQuote[] }>("/api/v1/inspiring_quotes");
      if (response?.success && Array.isArray(response.data)) {
        setQuotes(response.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to load quotes:", error);
      // Use localStorage or defaults
      const saved = getStorageItem<InspiringQuote[] | null>(STORAGE_KEYS.INSPIRING_QUOTES, null);
      setQuotes(saved || DEFAULT_QUOTES);
    } finally {
      setLoading(false);
    }
  };

  const pickRandomQuote = () => {
    const activeQuotes = quotes.filter((q) => q.is_active);
    if (activeQuotes.length > 0) {
      const random = activeQuotes[Math.floor(Math.random() * activeQuotes.length)];
      setRandomQuote(random);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      quote: "",
      author: "",
      category: "",
      active: true,
    });
    setEditingQuote(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (quote: InspiringQuote) => {
    setFormData({
      quote: quote.quote,
      author: quote.author,
      category: quote.category,
      active: quote.is_active,
    });
    setEditingQuote(quote);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.quote) {
      toast({ title: "Error", description: "Quote text is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Map formData.active to is_active for API and state
      const quoteData = {
        quote: formData.quote,
        author: formData.author,
        category: formData.category,
        is_active: formData.active,
      };

      let updatedQuotes: InspiringQuote[];

      if (editingQuote) {
        updatedQuotes = quotes.map((q) =>
          q.id === editingQuote.id ? { ...q, ...quoteData } : q
        );
        toast({ title: "Success", description: "Quote updated successfully" });
      } else {
        const newQuote: InspiringQuote = {
          id: Date.now(),
          ...quoteData,
          created_at: new Date().toISOString(),
        };
        updatedQuotes = [...quotes, newQuote];
        toast({ title: "Success", description: "Quote added successfully" });
      }

      setQuotes(updatedQuotes);
      setStorageItem(STORAGE_KEYS.INSPIRING_QUOTES, updatedQuotes);

      // Try to save to API
      try {
        if (editingQuote) {
          await api.patch(`/api/v1/inspiring_quotes/${editingQuote.id}`, { inspiring_quote: quoteData });
        } else {
          await api.post("/api/v1/inspiring_quotes", { inspiring_quote: quoteData });
        }
      } catch {
        // Saved locally as fallback
      }

      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this quote?"))) return;

    const updatedQuotes = quotes.filter((q) => q.id !== id);
    setQuotes(updatedQuotes);
    setStorageItem(STORAGE_KEYS.INSPIRING_QUOTES, updatedQuotes);

    try {
      await api.delete(`/api/v1/inspiring_quotes/${id}`);
    } catch {
      // Deleted locally
    }

    toast({ title: "Success", description: "Quote deleted successfully" });
  };

  const handleToggleActive = async (id: number) => {
    const updatedQuotes = quotes.map((q) =>
      q.id === id ? { ...q, is_active: !q.is_active } : q
    );
    setQuotes(updatedQuotes);
    setStorageItem(STORAGE_KEYS.INSPIRING_QUOTES, updatedQuotes);

    try {
      const quote = quotes.find((q) => q.id === id);
      if (quote) {
        await api.patch(`/api/v1/inspiring_quotes/${id}`, {
          inspiring_quote: { is_active: !quote.is_active },
        });
      }
    } catch {
      // Updated locally
    }
  };

  const handleResetToDefaults = async () => {
    if (!(await confirm("Reset all quotes to default values? This will remove any custom quotes."))) return;
    setQuotes(DEFAULT_QUOTES);
    setStorageItem(STORAGE_KEYS.INSPIRING_QUOTES, DEFAULT_QUOTES);
    toast({ title: "Success", description: "Quotes reset to defaults" });
  };

  // Derive unique categories from loaded quotes (dynamic, not hardcoded)
  const categories = React.useMemo(() => {
    const cats = [...new Set(quotes.map(q => q.category).filter(Boolean))];
    return cats.sort();
  }, [quotes]);

  const filteredQuotes = filterCategory
    ? quotes.filter((q) => q.category === filterCategory)
    : quotes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspiring Quotes</h2>
          <p className="text-sm text-muted-foreground">
            Manage quotes displayed throughout the application to inspire your team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleResetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Quote
          </Button>
        </div>
      </div>

      {/* Random Quote Display */}
      {randomQuote && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Quote className="h-8 w-8 text-purple-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="text-lg font-medium text-purple-900 dark:text-purple-200 italic">
                  &ldquo;{randomQuote.quote}&rdquo;
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-400 mt-2">
                  — {randomQuote.author}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={pickRandomQuote}>
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by category:</span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterCategory === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("")}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Quotes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Active</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No quotes found. Add one to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((quote) => (
                  <TableRow key={quote.id} className={cn(!quote.is_active && "opacity-50")}>
                    <TableCell>
                      <Checkbox
                        checked={quote.is_active}
                        onCheckedChange={() => handleToggleActive(quote.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm truncate" title={quote.quote}>
                        &ldquo;{quote.quote}&rdquo;
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quote.author || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {quote.category ? (
                        <Badge variant="secondary">{quote.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(quote)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(quote.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {quotes.filter((q) => q.is_active).length} of {quotes.length} quotes active
      </p>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingQuote ? "Edit Quote" : "Add Quote"}
            </DialogTitle>
            <DialogDescription>
              {editingQuote
                ? "Update the quote details."
                : "Add a new inspiring quote to your collection."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quote">Quote *</Label>
              <textarea
                id="quote"
                placeholder="Enter the quote text..."
                value={formData.quote}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                placeholder="e.g., Steve Jobs"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={formData.category === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormData({ ...formData, category: cat })}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked === true })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active (will be shown in the app)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingQuote ? (
                "Update Quote"
              ) : (
                "Add Quote"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
