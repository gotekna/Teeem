'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Mail, FileText, Upload, X, Search, Loader2 } from 'lucide-react';

export interface PendingAttachment {
  type: 'email' | 'document' | 'upload';
  id?: number;
  file?: File;
  displayName: string;
  metadata?: Record<string, unknown>;
}

interface AttachmentPickerProps {
  attachments: PendingAttachment[];
  onAdd: (attachment: PendingAttachment) => void;
  onRemove: (index: number) => void;
  jobId?: string;
}

interface EmailResult {
  id: number;
  subject: string;
  from_email: string;
  received_at: string;
  has_attachments?: boolean;
}

interface DocumentResult {
  id: number;
  file_name: string;
  display_name?: string;
  document_type?: string;
  sharepoint_url?: string;
}

export function AttachmentPicker({ attachments, onAdd, onRemove, jobId }: AttachmentPickerProps) {
  const [activeTab, setActiveTab] = React.useState<'email' | 'document' | 'upload'>('email');

  return (
    <div className="space-y-3">
      {/* Attached Items */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <Badge key={idx} variant="secondary" className="flex items-center gap-1 pr-1">
              {att.type === 'email' && <Mail className="h-3 w-3" />}
              {att.type === 'document' && <FileText className="h-3 w-3" />}
              {att.type === 'upload' && <Upload className="h-3 w-3" />}
              <span className="max-w-[150px] truncate">{att.displayName}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-1 hover:bg-destructive/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Picker Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email" className="flex items-center gap-1 text-xs">
            <Mail className="h-3 w-3" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-1 text-xs">
            <FileText className="h-3 w-3" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1 text-xs">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-2">
          <EmailSearchPanel onSelect={onAdd} jobId={jobId} />
        </TabsContent>

        <TabsContent value="document" className="mt-2">
          <DocumentBrowserPanel onSelect={onAdd} />
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          <FileUploadPanel onSelect={onAdd} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailSearchPanel({
  onSelect,
  jobId,
}: {
  onSelect: (att: PendingAttachment) => void;
  jobId?: string;
}) {
  const [search, setSearch] = React.useState('');
  const [emails, setEmails] = React.useState<EmailResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const searchEmails = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, limit: '20' });
      if (jobId) params.append('job_id', jobId);

      const response = await api.get<{ emails?: EmailResult[] } | EmailResult[]>(
        `/api/v1/email_warehouse?${params}`
      );
      // Handle both response formats
      const emailList = Array.isArray(response) ? response : response?.emails || [];
      setEmails(emailList);
    } catch (error) {
      console.error('Failed to search emails:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search emails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchEmails()}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={searchEmails} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {emails.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Search for emails to attach
          </p>
        )}
        {emails.map((email) => (
          <Card
            key={email.id}
            className="p-2 cursor-pointer hover:bg-accent transition-colors"
            onClick={() =>
              onSelect({
                type: 'email',
                id: email.id,
                displayName: email.subject || 'No Subject',
                metadata: { from: email.from_email, date: email.received_at },
              })
            }
          >
            <div className="text-sm font-medium truncate">{email.subject || 'No Subject'}</div>
            <div className="text-xs text-muted-foreground truncate">{email.from_email}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DocumentBrowserPanel({ onSelect }: { onSelect: (att: PendingAttachment) => void }) {
  const [documents, setDocuments] = React.useState<DocumentResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.append('search', search);

      const response = await api.get<{ documents?: DocumentResult[] } | DocumentResult[]>(
        `/api/v1/documents?${params}`
      );
      const docList = Array.isArray(response) ? response : response?.documents || [];
      setDocuments(docList);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadDocuments()}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={loadDocuments} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No documents found</p>
        ) : (
          documents.map((doc) => (
            <Card
              key={doc.id}
              className="p-2 cursor-pointer hover:bg-accent transition-colors"
              onClick={() =>
                onSelect({
                  type: 'document',
                  id: doc.id,
                  displayName: doc.display_name || doc.file_name,
                  metadata: { type: doc.document_type, url: doc.sharepoint_url },
                })
              }
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {doc.display_name || doc.file_name}
                  </div>
                  {doc.document_type && (
                    <div className="text-xs text-muted-foreground">{doc.document_type}</div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function FileUploadPanel({ onSelect }: { onSelect: (att: PendingAttachment) => void }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      onSelect({
        type: 'upload',
        file: file,
        displayName: file.name,
        metadata: { size: file.size, type: file.type },
      });
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed rounded-lg p-4 text-center dark:border-gray-700">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        id="task-file-upload"
      />
      <label htmlFor="task-file-upload" className="cursor-pointer block">
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Click to upload files</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Images</p>
      </label>
    </div>
  );
}
