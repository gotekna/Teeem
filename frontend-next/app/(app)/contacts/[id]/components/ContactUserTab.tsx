"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { PropertyRow, PropertySection } from "@/components/contact";
import { Camera, KeyRound, UserX } from "lucide-react";
import type { Contact } from "../types";

// Personal details data shape from API
interface PersonalDetails {
  id: number;
  name: string;
  username: string | null;
  email: string;
  photoUrl: string | null;
  contactId: number | null;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  personalMobile: string | null;
  personalMobileId: number | null;
  personalEmail: string | null;
  personalEmailId: number | null;
  homeAddress: {
    id: number;
    line1: string | null;
    line2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

interface ContactUserTabProps {
  contact: Contact;
  onContactUpdate: (updatedContact: Contact) => void;
  refreshKey?: number;
}

export function ContactUserTab({
  contact,
  onContactUpdate,
  refreshKey,
}: ContactUserTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PersonalDetails | null>(null);
  const [noUser, setNoUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Load personal details via the by_contact endpoint
  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: PersonalDetails }>(
        `/api/v1/users/by_contact/${contact.id}/personal_details`
      );
      if (response.success) {
        setDetails(response.data);
        setNoUser(false);
      }
    } catch (err: unknown) {
      // 404 means no linked user
      if (err instanceof Error && err.message.includes("not found")) {
        setNoUser(true);
        setDetails(null);
      } else {
        toast({
          title: "Error loading user details",
          description: err instanceof Error ? err.message : "Failed to load",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [contact.id, toast]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails, refreshKey]);

  // Save a field to the personal_details endpoint
  const saveField = useCallback(
    async (fieldName: string, value: string | boolean | null): Promise<void> => {
      if (!details) return;
      try {
        const response = await api.patch<{ success: boolean; data: PersonalDetails }>(
          `/api/v1/users/${details.id}/personal_details`,
          { [fieldName]: value }
        );
        if (response.success) {
          setDetails(response.data);
        }
      } catch (err) {
        toast({
          title: "Error saving",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [details, toast]
  );

  // Save home address fields
  const saveAddressField = useCallback(
    async (fieldName: string, value: string | boolean): Promise<void> => {
      if (!details) return;
      const currentAddress = details.homeAddress || {};
      try {
        const response = await api.patch<{ success: boolean; data: PersonalDetails }>(
          `/api/v1/users/${details.id}/personal_details`,
          {
            homeAddress: {
              ...currentAddress,
              [fieldName]: value,
            },
          }
        );
        if (response.success) {
          setDetails(response.data);
        }
      } catch (err) {
        toast({
          title: "Error saving address",
          description: err instanceof Error ? err.message : "Failed to save",
          variant: "destructive",
        });
        throw err;
      }
    },
    [details, toast]
  );

  // Password reset
  const handlePasswordReset = useCallback(async () => {
    if (!details) return;
    setResettingPassword(true);
    try {
      await api.post(`/api/v1/users/${details.id}/reset_password`, {});
      toast({
        title: "Password reset sent",
        description: `Password reset email sent to ${details.email}`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reset",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  }, [details, toast]);

  // Photo upload - uses existing PATCH /api/v1/users/:id with FormData
  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !details) return;

      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid File", description: "Please select an image file (PNG, JPG, etc.)", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Photo must be less than 10MB", variant: "destructive" });
        return;
      }

      // Show preview immediately
      setPhotoPreview(URL.createObjectURL(file));
      setUploadingPhoto(true);

      try {
        const formData = new FormData();
        formData.append("user[photo]", file);

        const token = getStorageItem(STORAGE_KEYS.TOKEN, "", false);
        const response = await fetch(`/api/v1/users/${details.id}`, {
          method: "PATCH",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });
        const data = await response.json();

        if (data?.success) {
          // Reload to get new photo URL
          await loadDetails();
          setPhotoPreview(null);
          toast({ title: "Photo updated" });
        } else {
          toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
          setPhotoPreview(null);
        }
      } catch {
        toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
        setPhotoPreview(null);
      } finally {
        setUploadingPhoto(false);
        // Reset file input
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
    },
    [details, toast, loadDetails]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // No linked user
  if (noUser || !details) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <UserX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No User Account Linked</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            This contact does not have a linked user account. User accounts allow
            people to log in to the system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Identity Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Identity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Display Name"
            value={details.name}
            onSave={(value) => saveField("name", value as string)}
            placeholder="Enter display name"
          />
          <PropertyRow
            label="Username"
            value={details.username}
            onSave={(value) => saveField("username", value as string)}
            placeholder="Enter username"
          />
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Account</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Login Email"
            value={details.email}
            onSave={async () => {}}
            readonly
            hint="Login email is managed in Settings > Users"
          />
          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-sm text-muted-foreground">Password</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasswordReset}
              disabled={resettingPassword}
            >
              {resettingPassword ? (
                <Spinner className="h-3 w-3 mr-2" />
              ) : (
                <KeyRound className="h-3 w-3 mr-2" />
              )}
              Send Password Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Contact Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Personal Contact</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Personal Mobile"
            value={details.personalMobile}
            onSave={(value) => saveField("personalMobile", value as string)}
            type="phone"
            placeholder="Enter personal mobile"
          />
          <PropertyRow
            label="Personal Email"
            value={details.personalEmail}
            onSave={(value) => saveField("personalEmail", value as string)}
            type="email"
            placeholder="Enter personal email"
          />
        </CardContent>
      </Card>

      {/* Home Address Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Home Address</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Street"
            value={details.homeAddress?.line1}
            onSave={(value) => saveAddressField("line1", value)}
            placeholder="Enter street address"
          />
          <PropertyRow
            label="Street Line 2"
            value={details.homeAddress?.line2}
            onSave={(value) => saveAddressField("line2", value)}
            placeholder="Unit, apartment, etc."
          />
          <PropertyRow
            label="Suburb"
            value={details.homeAddress?.city}
            onSave={(value) => saveAddressField("city", value)}
            placeholder="Enter suburb"
          />
          <PropertyRow
            label="State"
            value={details.homeAddress?.region}
            onSave={(value) => saveAddressField("region", value)}
            type="select"
            options={[
              { value: "QLD", label: "QLD" },
              { value: "NSW", label: "NSW" },
              { value: "VIC", label: "VIC" },
              { value: "SA", label: "SA" },
              { value: "WA", label: "WA" },
              { value: "TAS", label: "TAS" },
              { value: "NT", label: "NT" },
              { value: "ACT", label: "ACT" },
            ]}
          />
          <PropertyRow
            label="Postcode"
            value={details.homeAddress?.postalCode}
            onSave={(value) => saveAddressField("postalCode", value)}
            placeholder="Enter postcode"
          />
        </CardContent>
      </Card>

      {/* Personal Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Personal</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Date of Birth"
            value={details.dateOfBirth}
            onSave={(value) => saveField("dateOfBirth", value as string)}
            placeholder="YYYY-MM-DD"
          />
        </CardContent>
      </Card>

      {/* Emergency Contact Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <PropertyRow
            label="Name"
            value={details.emergencyContactName}
            onSave={(value) => saveField("emergencyContactName", value as string)}
            placeholder="Enter emergency contact name"
          />
          <PropertyRow
            label="Phone"
            value={details.emergencyContactPhone}
            onSave={(value) => saveField("emergencyContactPhone", value as string)}
            type="phone"
            placeholder="Enter emergency contact phone"
          />
          <PropertyRow
            label="Relationship"
            value={details.emergencyContactRelationship}
            onSave={(value) => saveField("emergencyContactRelationship", value as string)}
            type="select"
            options={[
              { value: "Spouse", label: "Spouse" },
              { value: "Partner", label: "Partner" },
              { value: "Parent", label: "Parent" },
              { value: "Sibling", label: "Sibling" },
              { value: "Child", label: "Child" },
              { value: "Friend", label: "Friend" },
              { value: "Other", label: "Other" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Profile Photo Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 py-2">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || details.photoUrl || ""} />
                <AvatarFallback className="text-lg">
                  {details.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <Spinner className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                <Camera className="h-3 w-3 mr-2" />
                {details.photoUrl ? "Change Photo" : "Upload Photo"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactUserTab;
