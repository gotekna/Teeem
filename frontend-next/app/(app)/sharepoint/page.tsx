"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, Cloud, HardDrive, CheckCircle, XCircle, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface ConnectionInfo {
  connected: boolean;
  name: string;
  url?: string | null;
  document_library?: string;
  root_folder?: string;
  authenticated_as?: string | null;
  auth_type?: string;
}

interface ConnectionsResponse {
  sharepoint: ConnectionInfo;
  onedrive: ConnectionInfo;
}

export default function SharePointPage() {
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const data = await api.get<ConnectionsResponse>("/api/v1/microsoft/connections");
        setConnections(data);
      } catch (err) {
        console.error("Failed to load Microsoft connections:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadConnections();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !connections) {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-semibold mb-4">SharePoint & OneDrive</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Microsoft 365 is not connected. Connect your account to access SharePoint and OneDrive.
            </p>
            <Link href="/settings/connections/integrations">
              <Button>Connect Microsoft 365</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = connections.sharepoint;
  const od = connections.onedrive;
  const anyConnected = sp.connected || od.connected;

  if (!anyConnected) {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-semibold mb-4">SharePoint & OneDrive</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Microsoft 365 is not connected. Connect your account to access SharePoint and OneDrive.
            </p>
            <Link href="/settings/connections/integrations">
              <Button>Connect Microsoft 365</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">SharePoint & OneDrive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access your organization&apos;s cloud storage
        </p>
      </div>

      <Tabs defaultValue="sharepoint" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sharepoint" className="gap-2">
            <Cloud className="h-4 w-4" />
            SharePoint
          </TabsTrigger>
          <TabsTrigger value="onedrive" className="gap-2">
            <HardDrive className="h-4 w-4" />
            OneDrive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sharepoint">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  {sp.name || "SharePoint"}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={sp.connected
                    ? "border-green-500 text-green-600 dark:text-green-400"
                    : "border-muted text-muted-foreground"
                  }
                >
                  {sp.connected ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Not Connected</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sp.connected ? (
                <>
                  {sp.authenticated_as && (
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{sp.authenticated_as}</span>
                    </p>
                  )}
                  {sp.document_library && (
                    <p className="text-sm text-muted-foreground">
                      Document Library: <span className="font-medium text-foreground">{sp.document_library}</span>
                    </p>
                  )}
                  {sp.root_folder && (
                    <p className="text-sm text-muted-foreground">
                      Root Folder: <span className="font-medium text-foreground">{sp.root_folder}</span>
                    </p>
                  )}
                  <div className="flex gap-3 pt-2">
                    {sp.url && (
                      <a href={sp.url} target="_blank" rel="noopener noreferrer">
                        <Button>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open SharePoint
                        </Button>
                      </a>
                    )}
                    <Link href="/warehouse">
                      <Button variant="outline">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        File Warehouse
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">SharePoint is not configured.</p>
                  <Link href="/settings/connections/integrations">
                    <Button variant="outline">Configure in Settings</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onedrive">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  {od.name || "OneDrive"}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={od.connected
                    ? "border-green-500 text-green-600 dark:text-green-400"
                    : "border-muted text-muted-foreground"
                  }
                >
                  {od.connected ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Not Connected</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {od.connected ? (
                <>
                  {od.authenticated_as && (
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{od.authenticated_as}</span>
                    </p>
                  )}
                  <div className="flex gap-3 pt-2">
                    {od.url && (
                      <a href={od.url} target="_blank" rel="noopener noreferrer">
                        <Button>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open OneDrive
                        </Button>
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">
                    Personal OneDrive requires Microsoft 365 sign-in.
                  </p>
                  <Link href="/settings/connections/integrations">
                    <Button variant="outline">Connect Microsoft 365</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
