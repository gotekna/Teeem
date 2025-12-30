"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Upload, HardHat, Building2, LayoutGrid } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  Persona,
  PERSONA_CONFIG,
  PERSONA_ORDER,
  getStoredPersona,
  setStoredPersona,
} from "@/lib/personas";

const personaIcons: Record<Persona, typeof HardHat> = {
  site: HardHat,
  office: Building2,
  manager: LayoutGrid,
};

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [persona, setPersona] = React.useState<Persona>("manager");

  // Profile form state
  const [profileName, setProfileName] = React.useState("");
  const [profileEmail, setProfileEmail] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");
  const [profileJobTitle, setProfileJobTitle] = React.useState("");

  // Load persona from localStorage on mount
  React.useEffect(() => {
    setPersona(getStoredPersona());
  }, []);

  // Initialize profile form when user data is available
  React.useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setProfilePhone((user as any).mobile_phone || "");
      setProfileJobTitle((user as any).job_title || "");
    }
  }, [user]);

  const handlePersonaChange = (newPersona: Persona) => {
    setPersona(newPersona);
    setStoredPersona(newPersona);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const response = await api.patch<{ success: boolean; user: any; errors?: string[] }>(
        `/api/v1/users/${user.id}`,
        {
          user: {
            name: profileName,
            email: profileEmail,
            mobile_phone: profilePhone,
          },
        }
      );

      if (response?.success) {
        if (refreshUser) {
          await refreshUser();
        }
        alert("Profile saved successfully!");
      } else {
        const errors = response?.errors || [];
        const errorMsg = Array.isArray(errors)
          ? errors.map((e: any) => (typeof e === "string" ? e : e.error || JSON.stringify(e))).join("; ")
          : "Unknown error";
        alert(`Failed to save: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src="" />
            <AvatarFallback className="text-lg">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="+61 400 000 000"
            />
          </div>
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              value={profileJobTitle}
              onChange={(e) => setProfileJobTitle(e.target.value)}
              placeholder="Project Manager"
            />
          </div>
        </div>

        <Separator />

        {/* View Mode / Persona Switcher */}
        <div className="space-y-3">
          <div>
            <Label>View Mode</Label>
            <p className="text-sm text-muted-foreground">
              Customize your sidebar to show only relevant features
            </p>
          </div>
          <div className="flex gap-2">
            {PERSONA_ORDER.map((p) => {
              const Icon = personaIcons[p];
              const isActive = persona === p;
              return (
                <button
                  key={p}
                  onClick={() => handlePersonaChange(p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-secondary border-border"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{PERSONA_CONFIG[p].label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {persona === "site" && "Shows: Dashboard, Jobs, Schedule Master, WHS, Documents, Chat"}
            {persona === "office" && "Shows: Dashboard, Leads, Contacts, Suppliers, Financial, Xero, and more"}
            {persona === "manager" && "Shows all navigation items"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Spinner size={16} className="mr-2" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
