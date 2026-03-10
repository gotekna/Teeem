"use client";

/**
 * CorporateTab - Editable sensitive corporate information
 *
 * Contains TFN, business names, ASIC credentials (multi-user).
 * Corporate Key is shared per company. Each user has their own username/password/recovery.
 * Sensitive fields (TFN, credential passwords) require password to reveal.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Save, Eye, EyeOff, Plus, Pencil, Trash2, Lock, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { Corporate, AsicPortalCredential } from "@/lib/types/corporate";
import { PasswordRevealDialog } from "@/components/corporate/PasswordRevealDialog";

interface CorporateTabProps {
  company: Corporate;
  companyId?: string;
  entityId?: string;
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  resigned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function CorporateTab({ company, onUpdate }: CorporateTabProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);

  // Sensitive data fetched after password verification (for TFN)
  const [sensitiveData, setSensitiveData] = React.useState<{
    tfn?: string;
    encrypted_asic_password?: string;
    encrypted_recovery_answer?: string;
  } | null>(null);

  const [showTfn, setShowTfn] = React.useState(false);

  const [formData, setFormData] = React.useState({
    tfn: "",
    business_names: company.business_names || "",
    previous_names: company.previous_names || "",
    registered_office_address: company.registered_office_address || "",
    corporate_key: company.corporate_key || "",
  });

  // ASIC credential management
  const [credentials, setCredentials] = React.useState<AsicPortalCredential[]>(
    company.asic_portal_credentials || []
  );
  const [showCredentialDialog, setShowCredentialDialog] = React.useState(false);
  const [editingCredential, setEditingCredential] = React.useState<AsicPortalCredential | null>(null);
  const [credentialSaving, setCredentialSaving] = React.useState(false);
  const [credentialForm, setCredentialForm] = React.useState({
    username: "",
    encrypted_password: "",
    recovery_question: "",
    encrypted_recovery_answer: "",
    status: "active" as string,
    notes: "",
    contact_id: "" as string,
  });

  // Contact search for credential dialog
  const [contactSearch, setContactSearch] = React.useState("");
  const [contactResults, setContactResults] = React.useState<Array<{ id: number; display_name: string }>>([]);
  const [contactSearching, setContactSearching] = React.useState(false);

  // Per-credential password reveal
  const [revealCredentialId, setRevealCredentialId] = React.useState<number | null>(null);
  const [showCredRevealDialog, setShowCredRevealDialog] = React.useState(false);
  const [revealedCredentials, setRevealedCredentials] = React.useState<Record<number, { password?: string; answer?: string }>>({});
  const [visibleFields, setVisibleFields] = React.useState<Record<string, boolean>>({});

  // Sync credentials when company data changes
  React.useEffect(() => {
    setCredentials(company.asic_portal_credentials || []);
  }, [company.asic_portal_credentials]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSend: Record<string, unknown> = { ...formData };
      if (!dataToSend.tfn) delete dataToSend.tfn;
      if (typeof dataToSend.previous_names === "string") {
        const names = (dataToSend.previous_names as string)
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        dataToSend.previous_names = names;
      }
      await api.put(`/api/v1/companies/${company.id}`, { company: dataToSend });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatTFN = (tfn?: string) => {
    if (!tfn) return "-";
    const digits = tfn.replace(/\D/g, "");
    if (digits.length === 9) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return tfn;
  };

  // TFN reveal
  const handleRevealClick = () => {
    if (sensitiveData) return;
    setShowPasswordDialog(true);
  };

  const handleRevealed = (data: { tfn?: string; encrypted_asic_password?: string; encrypted_recovery_answer?: string }) => {
    setSensitiveData(data);
    if (data.tfn) {
      setFormData(prev => ({ ...prev, tfn: data.tfn || "" }));
    }
  };

  const toggleTfn = () => {
    if (!sensitiveData) { handleRevealClick(); return; }
    setShowTfn(!showTfn);
  };

  // ---- Credential CRUD ----

  const openAddCredential = () => {
    setEditingCredential(null);
    setCredentialForm({ username: "", encrypted_password: "", recovery_question: "", encrypted_recovery_answer: "", status: "active", notes: "", contact_id: "" });
    setContactSearch("");
    setContactResults([]);
    setShowCredentialDialog(true);
  };

  const openEditCredential = (cred: AsicPortalCredential) => {
    setEditingCredential(cred);
    setCredentialForm({
      username: cred.username,
      encrypted_password: "",
      recovery_question: cred.recovery_question || "",
      encrypted_recovery_answer: "",
      status: cred.status,
      notes: cred.notes || "",
      contact_id: cred.contact_id ? String(cred.contact_id) : "",
    });
    setContactSearch(cred.contact_name || "");
    setContactResults([]);
    setShowCredentialDialog(true);
  };

  const handleCredentialSave = async () => {
    setCredentialSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: credentialForm.username,
        recovery_question: credentialForm.recovery_question,
        status: credentialForm.status,
        notes: credentialForm.notes,
        contact_id: credentialForm.contact_id || null,
      };
      if (credentialForm.encrypted_password) payload.encrypted_password = credentialForm.encrypted_password;
      if (credentialForm.encrypted_recovery_answer) payload.encrypted_recovery_answer = credentialForm.encrypted_recovery_answer;

      if (editingCredential) {
        const res = await api.put<{ success: boolean; credential: AsicPortalCredential }>(
          `/api/v1/companies/${company.id}/asic_credentials/${editingCredential.id}`,
          { credential: payload }
        );
        if (res?.success) {
          setCredentials(prev => prev.map(c => c.id === editingCredential.id ? res.credential : c));
        }
      } else {
        const res = await api.post<{ success: boolean; credential: AsicPortalCredential }>(
          `/api/v1/companies/${company.id}/asic_credentials`,
          { credential: payload }
        );
        if (res?.success) {
          setCredentials(prev => [...prev, res.credential]);
        }
      }
      setShowCredentialDialog(false);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to save credential:", error);
    } finally {
      setCredentialSaving(false);
    }
  };

  const handleDeleteCredential = async (cred: AsicPortalCredential) => {
    try {
      await api.delete(`/api/v1/companies/${company.id}/asic_credentials/${cred.id}`);
      setCredentials(prev => prev.map(c => c.id === cred.id ? { ...c, status: "resigned" as const } : c));
      onUpdate?.();
    } catch (error) {
      console.error("Failed to delete credential:", error);
    }
  };

  // Contact search debounce
  React.useEffect(() => {
    if (contactSearch.length < 2) { setContactResults([]); return; }
    const timer = setTimeout(async () => {
      setContactSearching(true);
      try {
        const res = await api.get<{ contacts: Array<{ id: number; display_name: string }> }>(
          `/api/v1/contacts?search=${encodeURIComponent(contactSearch)}&per_page=10`
        );
        setContactResults(res.contacts || []);
      } catch { setContactResults([]); }
      finally { setContactSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // Per-credential reveal
  const handleCredReveal = (credId: number) => {
    if (revealedCredentials[credId]) {
      // Already revealed - just toggle visibility
      return;
    }
    setRevealCredentialId(credId);
    setShowCredRevealDialog(true);
  };

  const handleCredRevealVerified = async (password: string) => {
    if (!revealCredentialId) return;
    try {
      const res = await api.post<{ success: boolean; data: { encrypted_password?: string; encrypted_recovery_answer?: string }; error?: string }>(
        `/api/v1/companies/${company.id}/asic_credentials/${revealCredentialId}/reveal`,
        { password },
        { skipAuthRedirect: true }
      );
      if (res?.success) {
        setRevealedCredentials(prev => ({
          ...prev,
          [revealCredentialId]: { password: res.data.encrypted_password, answer: res.data.encrypted_recovery_answer }
        }));
        setShowCredRevealDialog(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleCredField = (credId: number, field: "password" | "answer") => {
    const key = `${credId}-${field}`;
    if (!revealedCredentials[credId]) {
      handleCredReveal(credId);
      return;
    }
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Corporate Details</h3>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size={16} className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          This section contains sensitive corporate information. Keep this data secure and limit access.
        </p>
      </div>

      {/* Tax & Registration */}
      <div>
        <h4 className="text-sm font-semibold mb-4">Tax & Registration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">TFN</Label>
            {isEditing ? (
              <Input
                value={formData.tfn}
                onChange={(e) => setFormData({ ...formData, tfn: e.target.value })}
                placeholder="000 000 000"
                className="mt-1"
              />
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-sm font-mono">
                  {!company.has_tfn ? "-" : showTfn && sensitiveData?.tfn ? formatTFN(sensitiveData.tfn) : "... ... ..."}
                </p>
                {company.has_tfn && (
                  <button type="button" onClick={toggleTfn} className="text-muted-foreground hover:text-foreground p-0.5">
                    {showTfn && sensitiveData ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Business Names (Trading As)</Label>
            {isEditing ? (
              <Input
                value={formData.business_names}
                onChange={(e) => setFormData({ ...formData, business_names: e.target.value })}
                placeholder="Trading names"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.business_names || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Previous Names</Label>
            {isEditing ? (
              <Input
                value={formData.previous_names}
                onChange={(e) => setFormData({ ...formData, previous_names: e.target.value })}
                placeholder="Comma-separated previous names"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.previous_names || "-"}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Separate multiple names with commas</p>
          </div>
          <div className="md:col-span-2">
            <Label className="text-muted-foreground">Registered Office</Label>
            {isEditing ? (
              <Textarea
                value={formData.registered_office_address}
                onChange={(e) => setFormData({ ...formData, registered_office_address: e.target.value })}
                rows={2}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.registered_office_address || "-"}</p>
            )}
          </div>
        </div>
      </div>

      {/* ASIC Portal Access */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold mb-4">ASIC Portal Access</h4>

        {/* Corporate Key - shared per company */}
        <div className="mb-6">
          <Label className="text-muted-foreground">Corporate Key (shared)</Label>
          {isEditing ? (
            <Input
              value={formData.corporate_key}
              onChange={(e) => setFormData({ ...formData, corporate_key: e.target.value })}
              className="mt-1 max-w-xs"
            />
          ) : (
            <p className="text-sm font-mono mt-1">{company.corporate_key || "-"}</p>
          )}
        </div>

        {/* ASIC Portal Users */}
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-medium text-muted-foreground">Portal Users</h5>
          <Button variant="outline" size="sm" onClick={openAddCredential}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        </div>

        {credentials.length === 0 ? (
          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
            No ASIC portal users configured. Click &quot;Add User&quot; to add credentials.
          </div>
        ) : (
          <div className="border rounded-lg divide-y dark:divide-border">
            {credentials.map((cred) => (
              <div key={cred.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Contact */}
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="text-sm">{cred.contact_name || "-"}</p>
                  </div>
                  {/* Username */}
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-mono">{cred.username}</p>
                  </div>
                  {/* Password */}
                  <div>
                    <p className="text-xs text-muted-foreground">Password</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-mono">
                        {!cred.has_password
                          ? "-"
                          : visibleFields[`${cred.id}-password`] && revealedCredentials[cred.id]?.password
                            ? revealedCredentials[cred.id].password
                            : "........"}
                      </p>
                      {cred.has_password && (
                        <button type="button" onClick={() => toggleCredField(cred.id, "password")} className="text-muted-foreground hover:text-foreground p-0.5">
                          {visibleFields[`${cred.id}-password`] && revealedCredentials[cred.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Recovery Q */}
                  <div>
                    <p className="text-xs text-muted-foreground">Recovery Q</p>
                    <p className="text-sm truncate">{cred.recovery_question || "-"}</p>
                  </div>
                  {/* Recovery A */}
                  <div>
                    <p className="text-xs text-muted-foreground">Answer</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-mono">
                        {!cred.has_recovery_answer
                          ? "-"
                          : visibleFields[`${cred.id}-answer`] && revealedCredentials[cred.id]?.answer
                            ? revealedCredentials[cred.id].answer
                            : "........"}
                      </p>
                      {cred.has_recovery_answer && (
                        <button type="button" onClick={() => toggleCredField(cred.id, "answer")} className="text-muted-foreground hover:text-foreground p-0.5">
                          {visibleFields[`${cred.id}-answer`] && revealedCredentials[cred.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {/* Status + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cred.status] || ""}`}>
                    {cred.status}
                  </span>
                  <button type="button" onClick={() => openEditCredential(cred)} className="text-muted-foreground hover:text-foreground p-1" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {cred.status === "active" && (
                    <button type="button" onClick={() => handleDeleteCredential(cred)} className="text-muted-foreground hover:text-destructive p-1" title="Mark as resigned">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TFN Password Reveal Dialog */}
      <PasswordRevealDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        companyId={company.id}
        onRevealed={handleRevealed}
      />

      {/* Per-Credential Password Reveal Dialog */}
      <CredentialRevealDialog
        open={showCredRevealDialog}
        onOpenChange={setShowCredRevealDialog}
        onVerify={handleCredRevealVerified}
      />

      {/* Add/Edit Credential Dialog */}
      <Dialog open={showCredentialDialog} onOpenChange={setShowCredentialDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingCredential ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingCredential ? "Edit ASIC Credential" : "Add ASIC Credential"}
            </DialogTitle>
            <DialogDescription>
              {editingCredential ? "Update portal user credentials." : "Add a new ASIC portal user for this company."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Contact search */}
            <div>
              <Label>Contact (optional)</Label>
              <div className="relative mt-1">
                <Input
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    if (!e.target.value) setCredentialForm(f => ({ ...f, contact_id: "" }));
                  }}
                  placeholder="Search contacts..."
                />
                {contactSearching && <Spinner size={14} className="absolute right-3 top-3" />}
                {contactResults.length > 0 && contactSearch.length >= 2 && (
                  <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-y-auto">
                    {contactResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setCredentialForm(f => ({ ...f, contact_id: String(c.id) }));
                          setContactSearch(c.display_name);
                          setContactResults([]);
                        }}
                      >
                        {c.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Username *</Label>
              <Input
                value={credentialForm.username}
                onChange={(e) => setCredentialForm(f => ({ ...f, username: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                value={credentialForm.encrypted_password}
                onChange={(e) => setCredentialForm(f => ({ ...f, encrypted_password: e.target.value }))}
                placeholder={editingCredential ? "Leave blank to keep current" : "Enter password"}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Recovery Question</Label>
              <Input
                value={credentialForm.recovery_question}
                onChange={(e) => setCredentialForm(f => ({ ...f, recovery_question: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Recovery Answer</Label>
              <Input
                value={credentialForm.encrypted_recovery_answer}
                onChange={(e) => setCredentialForm(f => ({ ...f, encrypted_recovery_answer: e.target.value }))}
                placeholder={editingCredential ? "Leave blank to keep current" : "Enter answer"}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={credentialForm.status} onValueChange={(v) => setCredentialForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={credentialForm.notes}
                onChange={(e) => setCredentialForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialDialog(false)}>Cancel</Button>
            <Button onClick={handleCredentialSave} disabled={credentialSaving || !credentialForm.username.trim()}>
              {credentialSaving && <Spinner size={16} className="mr-2" />}
              {editingCredential ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Inline credential reveal dialog - verifies user password then returns decrypted values.
 */
function CredentialRevealDialog({
  open,
  onOpenChange,
  onVerify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (password: string) => Promise<boolean | undefined>;
}) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError("Please enter your password"); return; }
    setLoading(true);
    setError("");
    try {
      const success = await onVerify(password);
      if (!success) setError("Invalid password");
    } catch {
      setError("Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password Required
            </DialogTitle>
            <DialogDescription>
              Enter your login password to reveal credential details.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cred-reveal-password">Password</Label>
            <Input
              ref={inputRef}
              id="cred-reveal-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter your password"
              className="mt-1.5"
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner size={16} className="mr-2" />}
              Verify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CorporateTab;
