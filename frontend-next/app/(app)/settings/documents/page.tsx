"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Loader2, CheckCircle2, FolderOpen } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";

interface DocumentPaths {
  company_documents_base_path: string;
  people_documents_base_path: string;
  job_documents_base_path: string;
}

export default function DocumentSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [paths, setPaths] = React.useState<DocumentPaths>({
    company_documents_base_path: "",
    people_documents_base_path: "",
    job_documents_base_path: "",
  });

  React.useEffect(() => {
    const fetchPaths = async () => {
      try {
        const response = await api.get<{ success: boolean; data: DocumentPaths }>(
          "/api/v1/corporate_company_settings/document_paths"
        );
        if (response.success) {
          setPaths(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch document paths:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPaths();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/api/v1/corporate_company_settings/document_paths", {
        settings: paths,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save document paths:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Document Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure SharePoint base paths for document storage
          </p>
        </div>
      </div>

      {/* Save Success Alert */}
      {saved && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Document paths saved successfully
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>SharePoint Base Paths</CardTitle>
          <CardDescription>
            Specify the root folders in SharePoint where documents will be organized by scope
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Documents */}
          <div className="space-y-2">
            <Label htmlFor="company_path" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600" />
              Company Documents Base Path
            </Label>
            <Input
              id="company_path"
              value={paths.company_documents_base_path}
              onChange={(e) =>
                setPaths({ ...paths, company_documents_base_path: e.target.value })
              }
              placeholder="00 TEEEM PRIVATE"
            />
            <p className="text-xs text-muted-foreground">
              Root folder for corporate company documents. Structure:{" "}
              <code className="bg-muted px-1 rounded">[base_path]/[group_name]/[company_name]</code>
            </p>
          </div>

          {/* People Documents */}
          <div className="space-y-2">
            <Label htmlFor="people_path" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-purple-600" />
              People Documents Base Path
            </Label>
            <Input
              id="people_path"
              value={paths.people_documents_base_path}
              onChange={(e) =>
                setPaths({ ...paths, people_documents_base_path: e.target.value })
              }
              placeholder="teeem/Corporate/People"
            />
            <p className="text-xs text-muted-foreground">
              Root folder for people/contact documents
            </p>
          </div>

          {/* Job Documents */}
          <div className="space-y-2">
            <Label htmlFor="job_path" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-green-600" />
              Job Documents Base Path
            </Label>
            <Input
              id="job_path"
              value={paths.job_documents_base_path}
              onChange={(e) =>
                setPaths({ ...paths, job_documents_base_path: e.target.value })
              }
              placeholder="TEEEM Jobs"
            />
            <p className="text-xs text-muted-foreground">
              Root folder for job documents. Structure:{" "}
              <code className="bg-muted px-1 rounded">[base_path]/[job_title]/[category]</code>
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning Card */}
      <Alert>
        <AlertDescription>
          <strong>Note:</strong> Changing these paths will affect where new documents are created.
          Existing documents will not be moved automatically.
        </AlertDescription>
      </Alert>
    </div>
  );
}
