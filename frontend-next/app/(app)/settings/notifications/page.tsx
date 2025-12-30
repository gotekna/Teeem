"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface UserSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  daily_digest: boolean;
  weekly_report: boolean;
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = React.useState<UserSettings>({
    email_notifications: true,
    sms_notifications: false,
    daily_digest: true,
    weekly_report: true,
  });

  const handleToggle = (key: keyof UserSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: Save to API
  };

  return (
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
              <p className="text-sm text-muted-foreground">Receive notifications via email</p>
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
              <p className="text-sm text-muted-foreground">Receive urgent alerts via SMS</p>
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
              <p className="text-sm text-muted-foreground">Summary of daily activity</p>
            </div>
            <Switch checked={settings.daily_digest} onCheckedChange={() => handleToggle("daily_digest")} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Report</Label>
              <p className="text-sm text-muted-foreground">Weekly progress summary</p>
            </div>
            <Switch
              checked={settings.weekly_report}
              onCheckedChange={() => handleToggle("weekly_report")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
