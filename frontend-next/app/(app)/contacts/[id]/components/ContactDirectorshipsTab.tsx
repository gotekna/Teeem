"use client";

import Link from "next/link";
import { Building2, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { Directorship } from "../types";

interface ContactDirectorshipsTabProps {
  directorships: Directorship[];
  loadingDirectorships: boolean;
}

export function ContactDirectorshipsTab({
  directorships,
  loadingDirectorships,
}: ContactDirectorshipsTabProps) {
  const currentDirectorships = directorships.filter(d => d.is_current);
  const historicalDirectorships = directorships.filter(d => !d.is_current);

  return (
    <div className="space-y-6">
      {/* Current Directorships */}
      {currentDirectorships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Current Directorships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentDirectorships
                .sort((a, b) => new Date(b.appointment_date || 0).getTime() - new Date(a.appointment_date || 0).getTime())
                .map((dir) => (
                  <DirectorshipCard key={dir.id} directorship={dir} isCurrent />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Directorships */}
      {historicalDirectorships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Historical Directorships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {historicalDirectorships
                .sort((a, b) => new Date(b.resignation_date || b.appointment_date || 0).getTime() - new Date(a.resignation_date || a.appointment_date || 0).getTime())
                .map((dir) => (
                  <DirectorshipCard key={dir.id} directorship={dir} isCurrent={false} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loadingDirectorships && (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loadingDirectorships && directorships.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No directorships found for this contact.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Sub-component for individual directorship card
interface DirectorshipCardProps {
  directorship: Directorship;
  isCurrent: boolean;
}

function DirectorshipCard({ directorship: dir, isCurrent }: DirectorshipCardProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/corporate/companies/${dir.company_id}`}
            className={`text-lg font-semibold hover:underline flex items-center gap-2 ${!isCurrent ? 'text-muted-foreground' : ''}`}
          >
            <Building2 className="h-4 w-4" />
            {dir.company_name}
          </Link>
          {isCurrent ? (
            <Badge variant="default" className="bg-green-600">
              Current
            </Badge>
          ) : (
            <Badge variant="secondary">
              Historical
            </Badge>
          )}
          <Badge variant="outline">
            {dir.formatted_position}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          {dir.company_acn && (
            <div>
              <span className="font-medium">ACN:</span> {dir.company_acn}
            </div>
          )}
          {dir.company_abn && (
            <div>
              <span className="font-medium">ABN:</span> {dir.company_abn}
            </div>
          )}
          {dir.appointment_date && (
            <div>
              <span className="font-medium">Appointed:</span>{" "}
              {new Date(dir.appointment_date).toLocaleDateString()}
            </div>
          )}
          {!isCurrent && dir.resignation_date && (
            <div>
              <span className="font-medium">Resigned:</span>{" "}
              {new Date(dir.resignation_date).toLocaleDateString()}
            </div>
          )}
          {dir.company_group_name && (
            <div className={!isCurrent ? "col-span-2" : ""}>
              <span className="font-medium">Group:</span> {dir.company_group_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
