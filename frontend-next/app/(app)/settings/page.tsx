"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Link2,
  Key,
  Upload,
  Loader2,
  ChevronRight,
  Wrench,
  HeartPulse,
  Activity,
  HardHat,
  LayoutGrid,
  GraduationCap,
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  Video,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  Persona,
  PERSONA_CONFIG,
  PERSONA_ORDER,
  getStoredPersona,
  setStoredPersona,
} from "@/lib/personas";

interface UserSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  daily_digest: boolean;
  weekly_report: boolean;
}

interface TrainingModule {
  id: number;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  lessons_count: number;
  completed_lessons: number;
  is_required: boolean;
}

interface TrainingStats {
  total_modules: number;
  completed_modules: number;
  in_progress: number;
  total_hours: number;
  certificates_earned: number;
}

interface XeroStatus {
  connected: boolean;
  organization_name?: string;
}

const personaIcons: Record<Persona, typeof HardHat> = {
  site: HardHat,
  office: Building2,
  manager: LayoutGrid,
};

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "profile";
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [persona, setPersona] = React.useState<Persona>('manager');
  const [settings, setSettings] = React.useState<UserSettings>({
    email_notifications: true,
    sms_notifications: false,
    daily_digest: true,
    weekly_report: true,
  });
  const [trainingModules, setTrainingModules] = React.useState<TrainingModule[]>([]);
  const [trainingStats, setTrainingStats] = React.useState<TrainingStats | null>(null);
  const [xeroStatus, setXeroStatus] = React.useState<XeroStatus | null>(null);

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

  const handleTabChange = (value: string) => {
    router.push(`/settings?tab=${value}`);
  };

  React.useEffect(() => {
    const fetchSettings = async () => {
      // Note: Organization settings moved to System Admin (/admin/system)
      // Microsoft 365 org-wide access is managed in Admin System → Connections

      // Fetch Xero status - silently default to not connected on any error
      try {
        const response = await api.xero.getStatus();
        setXeroStatus(response.data || { connected: false });
      } catch {
        // Silently default to not connected - don't log errors for expected failures
        setXeroStatus({ connected: false });
      }

      // Load mock training data
      setTrainingModules([
        {
          id: 1,
          title: "Getting Started with Teeem",
          description: "Learn the basics of the platform and key features",
          category: "Onboarding",
          duration_minutes: 30,
          lessons_count: 5,
          completed_lessons: 5,
          is_required: true,
        },
        {
          id: 2,
          title: "Schedule Master Fundamentals",
          description: "Master the Gantt chart and task management",
          category: "Features",
          duration_minutes: 45,
          lessons_count: 8,
          completed_lessons: 3,
          is_required: false,
        },
        {
          id: 3,
          title: "WHS Compliance",
          description: "Understanding workplace health and safety requirements",
          category: "Compliance",
          duration_minutes: 60,
          lessons_count: 10,
          completed_lessons: 0,
          is_required: true,
        },
      ]);
      setTrainingStats({
        total_modules: 12,
        completed_modules: 4,
        in_progress: 2,
        total_hours: 8,
        certificates_earned: 2,
      });

      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleToggle = (key: keyof UserSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: Save to API
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
        // Refresh user context to get updated data
        if (refreshUser) {
          await refreshUser();
        }
        alert("Profile saved successfully!");
      } else {
        const errors = response?.errors || [];
        const errorMsg = Array.isArray(errors)
          ? errors.map((e: any) => typeof e === 'string' ? e : (e.error || JSON.stringify(e))).join("; ")
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

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getModuleStatus = (module: TrainingModule) => {
    if (module.completed_lessons === module.lessons_count) return "completed";
    if (module.completed_lessons > 0) return "in-progress";
    return "not-started";
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and organization settings
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Wrench className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Training
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
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
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    type="email"
                  />
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
                  {persona === 'site' && "Shows: Dashboard, Jobs, Schedule Master, WHS, Documents, Chat"}
                  {persona === 'office' && "Shows: Dashboard, Leads, Contacts, Suppliers, Financial, Xero, and more"}
                  {persona === 'manager' && "Shows all navigation items"}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={() => handleToggle("email_notifications")}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive urgent alerts via SMS
                    </p>
                  </div>
                  <Switch
                    checked={settings.sms_notifications}
                    onCheckedChange={() => handleToggle("sms_notifications")}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Daily Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Summary of daily activity
                    </p>
                  </div>
                  <Switch
                    checked={settings.daily_digest}
                    onCheckedChange={() => handleToggle("daily_digest")}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Report</Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly progress summary
                    </p>
                  </div>
                  <Switch
                    checked={settings.weekly_report}
                    onCheckedChange={() => handleToggle("weekly_report")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" />
                </div>
                <div className="flex justify-end">
                  <Button>Update Password</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">Status: Not Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Protect your account with 2FA
                    </p>
                  </div>
                  <Button variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    Enable 2FA
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="space-y-4">
            {/* Microsoft 365 org-wide access is managed in Admin System → Connections */}

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push("/settings/integrations/xero")}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-100 rounded-lg">
                      <CreditCard className="h-6 w-6 text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Xero</h3>
                      <p className="text-sm text-muted-foreground">
                        Accounting & invoicing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {xeroStatus?.connected ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Connected</Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push("/settings/documents")}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg dark:bg-orange-900/30">
                      <FolderOpen className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">Documents</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure SharePoint storage paths
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <div className="space-y-4">
            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push("/system-health")}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <HeartPulse className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">System Health</h3>
                      <p className="text-sm text-muted-foreground">
                        Data quality checks and system diagnostics
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push("/corporate")}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Activity className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Corporate Health</h3>
                      <p className="text-sm text-muted-foreground">
                        Company compliance and document verification
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push("/admin")}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Wrench className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Admin Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        User management and system configuration
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training">
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Modules</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{trainingStats?.total_modules || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{trainingStats?.completed_modules || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{trainingStats?.in_progress || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Hours Learned</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{trainingStats?.total_hours || 0}h</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">Certificates</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{trainingStats?.certificates_earned || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Progress Overview */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {trainingStats?.completed_modules || 0} of {trainingStats?.total_modules || 0} modules completed
                  </span>
                </div>
                <Progress
                  value={
                    trainingStats ? (trainingStats.completed_modules / trainingStats.total_modules) * 100 : 0
                  }
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainingModules.map((module) => {
                const status = getModuleStatus(module);
                const progress = (module.completed_lessons / module.lessons_count) * 100;

                return (
                  <Card key={module.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline">{module.category}</Badge>
                        {module.is_required && (
                          <Badge variant="secondary">Required</Badge>
                        )}
                      </div>

                      <h3 className="font-medium mb-1">{module.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {module.description}
                      </p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          {module.lessons_count} lessons
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(module.duration_minutes)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span>
                            {module.completed_lessons}/{module.lessons_count} lessons
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>

                      <Button
                        className="w-full mt-4"
                        variant={status === "completed" ? "outline" : "default"}
                      >
                        {status === "completed" ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Review
                          </>
                        ) : status === "in-progress" ? (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Continue
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and organization settings
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
