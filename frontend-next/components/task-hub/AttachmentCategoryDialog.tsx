'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Send } from 'lucide-react';
import { AttachmentCategory } from '@/contexts/TaskHubContext';

interface AttachmentCategoryDialogProps {
  open: boolean;
  fileName: string;
  onSelect: (category: AttachmentCategory) => void;
  onCancel: () => void;
}

export function AttachmentCategoryDialog({
  open,
  fileName,
  onSelect,
  onCancel,
}: AttachmentCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Attachment Type</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          How should &quot;{fileName}&quot; be categorized?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => onSelect('info')}
          >
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="font-medium">Info</span>
            <span className="text-xs text-muted-foreground">Reference material</span>
          </Button>
          <Button
            variant="default"
            className="flex flex-col h-auto py-4 gap-2"
            onClick={() => onSelect('response')}
          >
            <Send className="h-6 w-6" />
            <span className="font-medium">Response</span>
            <span className="text-xs opacity-80">To send back</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
