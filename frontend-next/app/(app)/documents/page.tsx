"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import {
  Upload,
  FolderOpen,
  Cloud,
  Building2,
  Briefcase,
  Users,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

// Foundation slugs for the three document types
const DOCUMENT_TYPES = {
  company: "company_documents",
  job: "job_documents",
  people: "people_documents"
} as const;

type DocumentType = keyof typeof DOCUMENT_TYPES;

interface Folder {
  id: string;
  name: string;
  path: string;
  documents_count: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Parse tab from path: /documents/job → "job", /documents → "company"
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/documents", "").split("/").filter(Boolean);
    const tab = parts[0];
    if (tab && Object.keys(DOCUMENT_TYPES).includes(tab)) {
      return tab as DocumentType;
    }
    return "company";
  }, [pathname]) as DocumentType;

  const [folders] = useState<Folder[]>([
    { id: "1", name: "Contracts", path: "/contracts", documents_count: 12 },
    { id: "2", name: "Financial", path: "/financial", documents_count: 8 },
    { id: "3", name: "Compliance", path: "/compliance", documents_count: 5 },
    { id: "4", name: "Plans", path: "/plans", documents_count: 0 },
  ]);
  const [sharePointConnected] = useState(false);

  // Handle tab change - path-based navigation
  const handleTabChange = useCallback((value: string) => {
    const url = value === "company" ? "/documents" : `/documents/${value}`;
    router.push(url);
  }, [router]);

  // Left actions with SharePoint + Upload buttons
  const documentsLeftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/dashboard" />
      {!sharePointConnected && (
        <Button
          variant="outline"
          onClick={() => router.push("/settings/integrations/microsoft")}
        >
          <Cloud className="h-4 w-4 mr-2" />
          Connect SharePoint
        </Button>
      )}
      <Button>
        <Upload className="h-4 w-4 mr-2" />
        Upload
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Document Type Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <div className="px-4 shrink-0">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="job" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Job
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-2">
              <Users className="h-4 w-4" />
              People
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 min-h-0 mt-6 px-4">
          {/* SharePoint Status */}
          {sharePointConnected && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Cloud className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">SharePoint Connected</p>
                    <p className="text-sm text-blue-700">
                      Documents are synced with your Microsoft SharePoint
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/settings/integrations/microsoft")}
                  >
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <Card className="lg:col-span-1">
          <div className="p-6 pb-3">
            <h3 className="text-base font-semibold">Folders</h3>
          </div>
          <CardContent className="space-y-1">
            {folders.length > 0 ? (
              folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {folder.documents_count}
                  </Badge>
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No folders yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents Table */}
        <div className="lg:col-span-3 h-full">
          <TeeemTableView
            key={activeTab} // Force remount when tab changes
            foundationId={DOCUMENT_TYPES[activeTab]}
            autoFetchRecords={true}
            tableName={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Documents`}
            enableExport={true}
            leftActions={documentsLeftActions}
            hideFooter={true}
          />
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
