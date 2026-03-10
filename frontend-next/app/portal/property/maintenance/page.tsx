"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { Plus, Camera, X, Wrench } from "lucide-react";

interface MaintenanceItem {
  id: number;
  description: string;
  amount: number;
  status: string;
  bill_date: string;
  charge_to: string;
  property: { id: number; name: string; address: string };
  supplier: string | null;
  created_at: string;
}

function portalFetch(path: string, options?: RequestInit) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
  }).then((r) => r.json());
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number | null | undefined) {
  if (!amount || amount === 0) return "TBD";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(amount);
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  invoiced: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);

  const loadItems = () => {
    portalFetch("/api/v1/portal/property/maintenance")
      .then((res) => { if (res.success) setItems(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadItems(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const active = items.filter((i) => i.status !== "paid");
  const completed = items.filter((i) => i.status === "paid");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Maintenance</h1>
        <Button onClick={() => setShowNewRequest(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {/* Active */}
      <Card>
        <CardHeader><CardTitle>Active Requests</CardTitle></CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No active maintenance requests</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowNewRequest(true)}>
                Submit a Request
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(item.bill_date)} | {item.property.address}
                    </p>
                    {item.supplier && <p className="text-xs text-muted-foreground">Assigned to: {item.supplier}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(item.amount)}</p>
                    <Badge className={statusBadge[item.status] || ""} variant="outline">
                      {item.status === "draft" ? "Submitted" : item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed */}
      {completed.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Completed</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completed.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-75">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(item.bill_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(item.amount)}</p>
                    <Badge className={statusBadge.paid} variant="outline">Paid</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Dialog */}
      <NewMaintenanceDialog
        open={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSubmitted={() => { setShowNewRequest(false); loadItems(); }}
      />
    </div>
  );
}

function NewMaintenanceDialog({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Get property_id from dashboard data
  const [propertyId, setPropertyId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      portalFetch("/api/v1/portal/property/dashboard").then((res) => {
        if (res.success) {
          const id = res.data?.property?.id || res.data?.properties?.[0]?.property?.id;
          setPropertyId(id || null);
        }
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!description.trim() || !propertyId) return;
    setSubmitting(true);

    try {
      const baseUrl = getApiBaseUrl();
      const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");

      const formData = new FormData();
      formData.append("property_id", String(propertyId));
      formData.append("description", description);
      photos.forEach((photo) => formData.append("photos[]", photo));

      await fetch(`${baseUrl}/api/v1/portal/property/maintenance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setDescription("");
      setPhotos([]);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos([...photos, ...Array.from(e.target.files)]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Maintenance Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Describe the issue</label>
            <textarea
              className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. Kitchen tap is leaking, bathroom fan not working..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Photos (optional)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden bg-muted">
                  <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="h-20 w-20 rounded-md border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhoto} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!description.trim() || submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
