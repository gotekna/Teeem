'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  Settings2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
  EmailDnsRecord,
  DnsStatus,
  DnsRecordsResponse,
  DnsVerifyResponse,
} from '@/lib/email-reseller-types';

interface DnsStatusTabProps {
  subscriptionId: number;
  domain: string;
  dnsStatus: DnsStatus;
  dnsRecords: EmailDnsRecord[];
  onRefresh: () => void;
}

const DNS_STATUS_CONFIG: Record<DnsStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-gray-500', icon: <Clock className="h-4 w-4" /> },
  provisioning: { label: 'Provisioning', color: 'bg-blue-500', icon: <RefreshCw className="h-4 w-4 animate-spin" /> },
  provisioned: { label: 'Provisioned', color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" /> },
  verified: { label: 'Verified', color: 'bg-green-600', icon: <CheckCircle2 className="h-4 w-4" /> },
  missing: { label: 'Missing Records', color: 'bg-yellow-500', icon: <AlertCircle className="h-4 w-4" /> },
  error: { label: 'Error', color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
  zone_not_found: { label: 'Zone Not Found', color: 'bg-red-600', icon: <XCircle className="h-4 w-4" /> },
  not_configured: { label: 'Not Configured', color: 'bg-gray-400', icon: <Settings2 className="h-4 w-4" /> },
};

const RECORD_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  created: { label: 'Created', variant: 'default' },
  verified: { label: 'Verified', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
  missing: { label: 'Missing', variant: 'destructive' },
};

export function DnsStatusTab({
  subscriptionId,
  domain,
  dnsStatus,
  dnsRecords,
  onRefresh,
}: DnsStatusTabProps) {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const statusConfig = DNS_STATUS_CONFIG[dnsStatus] || DNS_STATUS_CONFIG.pending;

  const handleProvision = async () => {
    setIsProvisioning(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/email_subscriptions/${subscriptionId}/provision_dns`
      );

      if (response?.success) {
        toast.success('DNS provisioning queued', {
          description: 'Records will be created in Cloudflare shortly.',
        });
        onRefresh();
      } else {
        toast.error('Failed to provision DNS', {
          description: response?.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to provision DNS');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await api.post<DnsVerifyResponse>(
        `/email_subscriptions/${subscriptionId}/verify_dns`
      );

      if (response?.success && response.data) {
        const { verified, missing, incorrect, status } = response.data;
        if (status === 'verified') {
          toast.success('All DNS records verified', {
            description: `${verified} records are correctly configured.`,
          });
        } else if (status === 'missing') {
          toast.warning('Missing DNS records', {
            description: `${missing} records are missing. Click "Provision DNS" to create them.`,
          });
        } else {
          toast.warning('DNS issues found', {
            description: `${incorrect} records have incorrect values.`,
          });
        }
        onRefresh();
      } else {
        toast.error('Verification failed', {
          description: (response as { error?: string })?.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to verify DNS');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                DNS Status
                <Badge className={`${statusConfig.color} text-white`}>
                  {statusConfig.icon}
                  <span className="ml-1">{statusConfig.label}</span>
                </Badge>
              </CardTitle>
              <CardDescription>
                DNS records for <span className="font-mono">{domain}</span> managed via Cloudflare
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={isVerifying || dnsStatus === 'not_configured'}
              >
                {isVerifying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Verify DNS
              </Button>
              <Button
                size="sm"
                onClick={handleProvision}
                disabled={isProvisioning || dnsStatus === 'not_configured'}
              >
                {isProvisioning ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Settings2 className="h-4 w-4 mr-2" />
                )}
                Provision DNS
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dnsStatus === 'not_configured' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Cloudflare Not Configured
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    To enable automatic DNS provisioning, please configure Cloudflare credentials in{' '}
                    <a href="/settings/company/connections" className="underline">
                      Settings → Connections
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {dnsStatus === 'zone_not_found' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Domain Not Found in Cloudflare
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    The domain <span className="font-mono">{domain}</span> is not in your Cloudflare account.
                    Please add the domain to Cloudflare first.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>DNS Records</CardTitle>
          <CardDescription>
            Required records for email hosting with PolarisMail
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dnsRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No DNS records configured yet.</p>
              <p className="text-sm mt-1">
                Click "Provision DNS" to create the required records.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnsRecords.map((record) => {
                  const statusConfig = RECORD_STATUS_CONFIG[record.status] || RECORD_STATUS_CONFIG.pending;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <span className="font-mono text-sm uppercase">{record.record_type}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{record.name}</span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="font-mono text-xs break-all">{record.content}</span>
                        {record.priority && (
                          <span className="text-muted-foreground ml-2">(priority: {record.priority})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{record.purpose}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                        {record.error_message && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">{record.error_message}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">DNS Configuration Help</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>MX Record:</strong> Routes email to PolarisMail servers
          </p>
          <p>
            <strong>SPF (TXT):</strong> Authorizes PolarisMail to send email on behalf of your domain
          </p>
          <p>
            <strong>DKIM (TXT):</strong> Adds a cryptographic signature to verify email authenticity
          </p>
          <p>
            <strong>DMARC (TXT):</strong> Tells receiving servers what to do with unauthorized emails
          </p>
          <p>
            <strong>Autodiscover/Autoconfig:</strong> Enables automatic email client configuration
          </p>
          <div className="pt-2">
            <a
              href="https://mxtoolbox.com/SuperTool.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Test DNS with MXToolbox
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
