"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, Cloud, HardDrive, XCircle } from "lucide-react";
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

function EmbeddedView({ url, name }: { url: string; name: string }) {
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Microsoft blocks iframes with X-Frame-Options. We try it, and if it
  // fails to load (onError or timeout), we show the "open in new tab" view.
  useEffect(() => {
    // Give iframe 4 seconds to load before assuming it's blocked
    const timeout = setTimeout(() => {
      if (iframeLoading) {
        setIframeBlocked(true);
        setIframeLoading(false);
      }
    }, 4000);
    return () => clearTimeout(timeout);
  }, [iframeLoading]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false);
    // If it loaded, the iframe worked (rare for SharePoint but possible for some configs)
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeBlocked(true);
    setIframeLoading(false);
  }, []);

  if (iframeBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Cloud className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg font-medium">{name}</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {name} opens in a new browser tab for the best experience.
        </p>
        <div className="flex gap-3">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open {name}
            </Button>
          </a>
          <Link href="/settings/connections">
            <Button variant="outline" size="lg">
              <Cloud className="h-4 w-4 mr-2" />
              Check Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 220px)" }}>
      {iframeLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <Spinner size={32} className="text-muted-foreground" />
        </div>
      )}
      <iframe
        src={url}
        className="w-full h-full border-0 rounded-lg"
        title={name}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}

function NotConnectedView({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <XCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">
          {label} is not connected. Connect your Microsoft 365 account in Settings.
        </p>
        <Link href="/settings/connections/integrations">
          <Button>Connect Microsoft 365</Button>
        </Link>
      </CardContent>
    </Card>
  );
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
        <NotConnectedView label="Microsoft 365" />
      </div>
    );
  }

  const sp = connections.sharepoint;
  const od = connections.onedrive;
  const anyConnected = sp.connected || od.connected;

  if (!anyConnected) {
    return (
      <div className="container max-w-4xl py-8">
        <NotConnectedView label="Microsoft 365" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      <Tabs defaultValue="sharepoint" className="flex flex-col flex-1">
        <div className="px-4 pt-2 pb-2 flex items-center gap-4">
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
        </div>

        <TabsContent value="sharepoint" className="flex-1 px-4">
          {sp.connected && sp.url ? (
            <EmbeddedView url={sp.url} name={sp.name || "SharePoint"} />
          ) : sp.connected ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Cloud className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">SharePoint URL not configured.</p>
              <Link href="/settings/connections">
                <Button variant="outline">Configure in Settings</Button>
              </Link>
            </div>
          ) : (
            <NotConnectedView label="SharePoint" />
          )}
        </TabsContent>

        <TabsContent value="onedrive" className="flex-1 px-4">
          {od.connected && od.url ? (
            <EmbeddedView url={od.url} name={od.name || "OneDrive"} />
          ) : od.connected ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <HardDrive className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground">OneDrive URL could not be determined.</p>
              <Link href="/settings/connections/integrations">
                <Button variant="outline">Check Settings</Button>
              </Link>
            </div>
          ) : (
            <NotConnectedView label="OneDrive" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
