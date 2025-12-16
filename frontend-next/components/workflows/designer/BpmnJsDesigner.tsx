"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Save, Download, Upload, ZoomIn, ZoomOut, Maximize } from "lucide-react";

// Default empty BPMN diagram
const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="186" y="203" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface BpmnJsDesignerProps {
  processId?: number;
  initialXml?: string;
  processName?: string;
  onSave?: (xml: string, svg: string) => Promise<void>;
}

interface SelectedElement {
  id: string;
  type: string;
  name?: string;
  businessObject?: Record<string, unknown>;
}

export default function BpmnJsDesigner({
  processId,
  initialXml,
  processName = "New Process",
  onSave,
}: BpmnJsDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelerRef = useRef<any>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  // Initialize modeler (client-side only)
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    let modeler: unknown = null;

    const initModeler = async () => {
      // Dynamic import for bpmn-js (browser only)
      const BpmnModeler = (await import("bpmn-js/lib/Modeler")).default;

      // Import CSS dynamically
      await import("bpmn-js/dist/assets/diagram-js.css");
      await import("bpmn-js/dist/assets/bpmn-js.css");
      await import("bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css");

      modeler = new BpmnModeler({
        container: containerRef.current,
      });

      modelerRef.current = modeler;

      // Load initial diagram
      const xmlToLoad = initialXml || EMPTY_BPMN;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (modeler as any).importXML(xmlToLoad);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvas = (modeler as any).get("canvas");
        canvas.zoom("fit-viewport");
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load BPMN diagram:", err);
        toast({
          title: "Error",
          description: "Failed to load diagram",
          variant: "destructive",
        });
      }

      // Listen for selection changes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventBus = (modeler as any).get("eventBus");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus.on("selection.changed", (e: any) => {
        const selection = e.newSelection;
        if (selection && selection.length === 1) {
          const element = selection[0];
          setSelectedElement({
            id: element.id,
            type: element.type,
            name: element.businessObject?.name,
            businessObject: element.businessObject,
          });
        } else {
          setSelectedElement(null);
        }
      });

      // Listen for changes to mark dirty
      eventBus.on("commandStack.changed", () => {
        setIsDirty(true);
      });
    };

    initModeler();

    // Cleanup
    return () => {
      if (modeler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (modeler as any).destroy();
      }
    };
  }, [initialXml, toast]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!modelerRef.current || !onSave) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const { svg } = await modelerRef.current.saveSVG();

      await onSave(xml || "", svg || "");
      setIsDirty(false);

      toast({
        title: "Saved",
        description: "Workflow saved successfully",
      });
    } catch (err) {
      console.error("Failed to save:", err);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    }
  }, [onSave, toast]);

  // Export BPMN XML
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml || ""], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${processName}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  }, [processName]);

  // Import BPMN XML
  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bpmn,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !modelerRef.current) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const xml = event.target?.result as string;
        try {
          await modelerRef.current?.importXML(xml);
          const canvas = modelerRef.current?.get("canvas");
          canvas.zoom("fit-viewport");
          setIsDirty(true);
          toast({
            title: "Imported",
            description: "BPMN diagram imported successfully",
          });
        } catch (err) {
          console.error("Failed to import:", err);
          toast({
            title: "Error",
            description: "Failed to import BPMN file",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [toast]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom * 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    const currentZoom = canvas.zoom();
    canvas.zoom(currentZoom * 0.8);
  }, []);

  const handleFitView = useCallback(() => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas");
    canvas.zoom("fit-viewport");
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium mr-2">{processName}</span>
          {isDirty && <span className="text-xs text-muted-foreground">(unsaved)</span>}
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleImport}>
          <Upload className="w-4 h-4 mr-1" />
          Import
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="outline" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleFitView}>
          <Maximize className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button onClick={handleSave} disabled={!isDirty}>
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* BPMN Canvas */}
        <div
          ref={containerRef}
          className="flex-1 bg-white"
          style={{ minHeight: "500px" }}
        />

        {/* Properties Panel */}
        <div className="w-80 border-l bg-background overflow-auto">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Properties</h3>

            {!isLoaded ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : selectedElement ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <div className="font-medium">{selectedElement.type}</div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">ID</label>
                  <div className="font-mono text-sm">{selectedElement.id}</div>
                </div>

                {selectedElement.name && (
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <div>{selectedElement.name}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Select an element to view its properties
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
