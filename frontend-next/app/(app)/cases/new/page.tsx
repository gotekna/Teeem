"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface CaseTypes {
  case_types: Record<string, string>;
  statuses: Record<string, string>;
  priorities: Record<string, string>;
}

export default function NewCasePage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [types, setTypes] = React.useState<CaseTypes | null>(null);

  // Form fields
  const [title, setTitle] = React.useState("");
  const [caseType, setCaseType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [deadline, setDeadline] = React.useState("");
  const [investigationStartDate, setInvestigationStartDate] = React.useState("");
  const [investigationEndDate, setInvestigationEndDate] = React.useState("");

  // Load case types
  React.useEffect(() => {
    const loadTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: CaseTypes }>(
          "/api/v1/cases/types"
        );
        setTypes(response.data);
      } catch (error) {
        console.error("Failed to load case types:", error);
      }
    };
    loadTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !caseType) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post<{ success: boolean; data: { id: number } }>(
        "/api/v1/cases",
        {
          case: {
            title,
            case_type: caseType,
            description,
            priority,
            deadline: deadline || null,
            investigation_start_date: investigationStartDate || null,
            investigation_end_date: investigationEndDate || null,
          },
        }
      );

      if (response?.success && response?.data?.id) {
        router.push(`/cases/${response.data.id}`);
      }
    } catch (error) {
      console.error("Failed to create case:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/cases" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">New Case</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new investigation or audit case
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter case title..."
                required
              />
            </div>

            {/* Case Type */}
            <div className="space-y-2">
              <Label htmlFor="case_type">Case Type *</Label>
              <Select value={caseType} onValueChange={setCaseType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select case type..." />
                </SelectTrigger>
                <SelectContent>
                  {types?.case_types &&
                    Object.entries(types.case_types).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the case, its scope, and objectives..."
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority..." />
                </SelectTrigger>
                <SelectContent>
                  {types?.priorities &&
                    Object.entries(types.priorities).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Investigation Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Investigation Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={investigationStartDate}
                  onChange={(e) => setInvestigationStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Investigation End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={investigationEndDate}
                  onChange={(e) => setInvestigationEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/cases")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !title || !caseType}>
                {loading ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Briefcase className="h-4 w-4 mr-2" />
                )}
                Create Case
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
