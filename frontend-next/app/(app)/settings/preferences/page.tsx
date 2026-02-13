"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Moon,
  Sun,
  Monitor,
  LayoutGrid,
  List,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { HelpIcon } from "@/components/help/HelpTooltip";
import {
  getHelpButtonHoverOnly,
  setHelpButtonHoverOnly,
} from "@/components/help/FloatingHelpButton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

/**
 * Preferences Page - Personal Settings
 *
 * Combines UI preferences and training progress.
 * Part of the Settings/Admin merge - Personal section.
 * Accessible to all authenticated users.
 */

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [compactMode, setCompactMode] = React.useState(false);
  const [enableAiWritingAssistant, setEnableAiWritingAssistant] = React.useState(false);
  const [savingAi, setSavingAi] = React.useState(false);
  const [helpButtonHoverOnly, setHelpButtonHoverOnlyState] = React.useState(false);

  // Initialize preferences from localStorage/user data
  React.useEffect(() => {
    // Help button preference (localStorage)
    setHelpButtonHoverOnlyState(getHelpButtonHoverOnly());
  }, []);

  // Initialize AI Writing Assistant from user data
  React.useEffect(() => {
    if (user) {
      setEnableAiWritingAssistant((user as any).enable_ai_writing_assistant ?? false);
    }
  }, [user]);

  // Handle help button visibility toggle
  const handleHelpButtonHoverOnlyChange = (checked: boolean) => {
    setHelpButtonHoverOnlyState(checked);
    setHelpButtonHoverOnly(checked);
    toast({
      title: checked ? "Help button now shows on hover" : "Help button always visible",
      description: checked
        ? "The help button will fade in when you hover near the bottom-right corner."
        : "The help button is now always visible.",
    });
  };

  // Handle AI Writing Assistant toggle
  const handleAiWritingAssistantChange = async (checked: boolean) => {
    if (!user?.id) return;

    setEnableAiWritingAssistant(checked);
    setSavingAi(true);

    try {
      const response = await api.patch<{ success: boolean; user?: any; errors?: string[] }>(
        `/api/v1/users/${user.id}`,
        { user: { enable_ai_writing_assistant: checked } }
      );

      if (response?.success) {
        if (refreshUser) await refreshUser();
        toast({
          title: checked ? "AI Writing Assistant enabled" : "AI Writing Assistant disabled",
          description: checked
            ? "Grammar and tone checking is now active in text editors."
            : "Only browser spell check will be used.",
        });
      } else {
        // Revert on failure
        setEnableAiWritingAssistant(!checked);
        toast({
          title: "Error",
          description: "Failed to update setting",
          variant: "destructive",
        });
      }
    } catch {
      // Revert on error
      setEnableAiWritingAssistant(!checked);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* UI Preferences Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Theme Selection */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Select your preferred color scheme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                >
                  <Sun className="h-4 w-4 mr-1" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                >
                  <Moon className="h-4 w-4 mr-1" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                >
                  <Monitor className="h-4 w-4 mr-1" />
                  System
                </Button>
              </div>
            </div>

            {/* View Mode */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Default View</Label>
                <p className="text-sm text-muted-foreground">
                  Choose how lists are displayed by default
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>
            </div>

            {/* Compact Mode */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Label>Compact Mode</Label>
                  <HelpIcon
                    content="Reduces spacing between rows in tables and list views. Useful for seeing more data at once on smaller screens."
                    size="sm"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Use smaller spacing in tables and lists
                </p>
              </div>
              <Switch
                checked={compactMode}
                onCheckedChange={setCompactMode}
              />
            </div>

            {/* AI Writing Assistant */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>AI Writing Assistant</Label>
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <HelpIcon
                    content="When enabled, AI will analyze your text in email composers and notes to suggest grammar improvements and professional tone adjustments."
                    tips={[
                      "Works in email compose, notes, and rich text fields",
                      "Suggestions appear as you type",
                      "Your text is processed securely and not stored"
                    ]}
                    variant="tip"
                    size="sm"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable grammar and tone checking powered by AI
                </p>
              </div>
              <Switch
                checked={enableAiWritingAssistant}
                onCheckedChange={handleAiWritingAssistantChange}
                disabled={savingAi}
              />
            </div>

            {/* Help Button Visibility */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>Help Button on Hover Only</Label>
                  <HelpCircle className="h-4 w-4 text-indigo-500" />
                  <HelpIcon
                    content="When enabled, the floating help button (bottom-right corner) will be nearly invisible until you hover over it."
                    tips={[
                      "The button fades to 10% opacity when not hovered",
                      "Hover over the bottom-right corner to reveal it",
                      "Great for reducing visual clutter"
                    ]}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Hide the help button until you hover over it
                </p>
              </div>
              <Switch
                checked={helpButtonHoverOnly}
                onCheckedChange={handleHelpButtonHoverOnlyChange}
              />
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
