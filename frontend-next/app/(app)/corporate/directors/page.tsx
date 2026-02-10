"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  Search,
  Building2,
  Mail,
  Phone,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState } from "@/components/ui/empty-state";

// Calculate director compliance score
const calculateDirectorCompliance = (director: Director) => {
  const requiredFields = [
    { field: "director_id", label: "Director ID" },
    { field: "date_of_birth", label: "Date of Birth" },
    { field: "residential_address", label: "Residential Address" },
    { field: "drivers_licence", label: "Drivers Licence" },
  ];

  const optionalFields = [
    { field: "passport_number", label: "Passport" },
    { field: "photo_url", label: "Photo" },
    { field: "place_of_birth", label: "Place of Birth" },
  ];

  const filledRequired = requiredFields.filter((f) => director[f.field as keyof Director]).length;
  const filledOptional = optionalFields.filter((f) => director[f.field as keyof Director]).length;

  const requiredScore = (filledRequired / requiredFields.length) * 100;
  const totalFilled = filledRequired + filledOptional;
  const totalFields = requiredFields.length + optionalFields.length;

  return {
    requiredScore,
    totalScore: Math.round((totalFilled / totalFields) * 100),
    filledRequired,
    totalRequired: requiredFields.length,
    missingRequired: requiredFields.filter((f) => !director[f.field as keyof Director]).map((f) => f.label),
    isFullyCompliant: filledRequired === requiredFields.length,
  };
};

interface Directorship {
  company: {
    id: number;
    name: string;
  };
}

interface Director {
  id: number;
  display_name: string;
  email?: string;
  mobile_phone?: string;
  director_position?: string;
  director_id?: string;
  date_of_birth?: string;
  residential_address?: string;
  drivers_licence?: string;
  passport_number?: string;
  photo_url?: string;
  place_of_birth?: string;
  director_tfn?: string;
  is_beneficial_owner?: boolean;
  directorships?: Directorship[];
}

export default function DirectorsPage() {
  const router = useRouter();
  const [directors, setDirectors] = React.useState<Director[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    loadDirectors();
  }, []);

  const loadDirectors = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ contacts: Director[] }>("/api/v1/contacts", {
        params: { is_director: true },
      });
      setDirectors(response.contacts || []);
    } catch (error) {
      console.error("Failed to load directors:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDirectors = React.useMemo(() => {
    if (!searchQuery) return directors;
    const query = searchQuery.toLowerCase();
    return directors.filter(
      (director) =>
        director.display_name?.toLowerCase().includes(query) ||
        director.email?.toLowerCase().includes(query) ||
        director.director_tfn?.toLowerCase().includes(query)
    );
  }, [directors, searchQuery]);

  const getDirectorCompanies = (director: Director) => {
    return director.directorships?.map((d) => d.company) || [];
  };

  if (loading) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackButton fallbackHref="/corporate" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Directors Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive directory of all company directors
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or TFN..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Directors Grid */}
      {filteredDirectors.length === 0 ? (
        <EmptyState
          title="No directors found"
          description={searchQuery ? "Try adjusting your search." : "No directors have been added yet."}
          icon={<Users className="h-12 w-12" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDirectors.map((director) => {
            const companies = getDirectorCompanies(director);
            const compliance = calculateDirectorCompliance(director);
            return (
              <Card
                key={director.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/contacts/${director.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 relative">
                      {director.photo_url ? (
                        <img
                          src={director.photo_url}
                          alt={director.display_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      {/* Compliance indicator badge */}
                      <div
                        className={cn(
                          "absolute -bottom-1 -right-1 rounded-full p-0.5",
                          compliance.isFullyCompliant ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                        )}
                      >
                        {compliance.isFullyCompliant ? (
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-medium">{director.display_name}</h3>
                      {director.director_position && (
                        <p className="text-sm text-muted-foreground">{director.director_position}</p>
                      )}
                    </div>
                  </div>

                  {/* Compliance Status Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn("font-medium", compliance.isFullyCompliant ? "text-green-600 dark:text-green-400" : "text-amber-600")}>
                        {compliance.isFullyCompliant
                          ? "Fully Compliant"
                          : `${compliance.filledRequired}/${compliance.totalRequired} Required`}
                      </span>
                      <span className="text-muted-foreground">{compliance.totalScore}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          compliance.isFullyCompliant
                            ? "bg-green-500"
                            : compliance.requiredScore >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${compliance.totalScore}%` }}
                      />
                    </div>
                    {!compliance.isFullyCompliant && compliance.missingRequired.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Missing: {compliance.missingRequired.slice(0, 2).join(", ")}
                        {compliance.missingRequired.length > 2 && ` +${compliance.missingRequired.length - 2}`}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {director.email && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 mr-2" />
                        {director.email}
                      </div>
                    )}
                    {director.mobile_phone && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 mr-2" />
                        {director.mobile_phone}
                      </div>
                    )}
                  </div>

                  {companies.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center text-xs text-muted-foreground mb-2">
                        <Building2 className="h-4 w-4 mr-1" />
                        Directorships ({companies.length})
                      </div>
                      <div className="space-y-1">
                        {companies.slice(0, 3).map((company) => (
                          <div key={company.id} className="text-xs text-muted-foreground truncate">
                            {company.name}
                          </div>
                        ))}
                        {companies.length > 3 && (
                          <div className="text-xs text-muted-foreground italic">+{companies.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {director.is_beneficial_owner && (
                    <div className="mt-3">
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
                        Beneficial Owner
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Results count */}
      {filteredDirectors.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredDirectors.length} {filteredDirectors.length === 1 ? "director" : "directors"}
        </div>
      )}
    </div>
  );
}
