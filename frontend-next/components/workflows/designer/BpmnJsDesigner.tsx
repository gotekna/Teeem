"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Save, Download, Upload, ZoomIn, ZoomOut, Maximize, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

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
  onSave?: (xml: string, svg: string, name: string) => Promise<void>;
}

interface SelectedElement {
  id: string;
  type: string;
  name?: string;
  businessObject?: Record<string, unknown>;
}

interface DocumentTemplate {
  id: number;
  name: string;
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
  const [editableName, setEditableName] = useState(processName || "New Workflow");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const { toast } = useToast();

  // Update editable name when prop changes (e.g., data loads from server)
  useEffect(() => {
    if (processName) {
      setEditableName(processName);
    }
  }, [processName]);

  // Prevent keyboard events in input fields from reaching BPMN canvas
  // This must be at document level with capture to run before bpmn-js handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === "INPUT" ||
                        target.tagName === "TEXTAREA" ||
                        target.tagName === "SELECT" ||
                        target.isContentEditable;

      // If typing in an editable field, stop bpmn-js from handling it
      if (isEditable) {
        e.stopImmediatePropagation();
      }
    };

    // Add at document level with capture - must be added before bpmn-js initializes
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Fetch document templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await api.get<{ success: boolean; document_templates: DocumentTemplate[] }>(
          "/api/v1/document_templates"
        );
        console.log("Templates response:", response);
        if (response?.success && response.document_templates) {
          setTemplates(response.document_templates);
          console.log("Loaded templates:", response.document_templates.length);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  // Track initialization
  const initializedRef = useRef(false);
  const initCounterRef = useRef(0); // Track init attempts to handle StrictMode/races
  const xmlLoadedRef = useRef(false);

  // Initialize modeler ONCE (client-side only)
  useEffect(() => {
    const myInitId = ++initCounterRef.current;

    console.log("useEffect running:", {
      initId: myInitId,
      hasContainer: !!containerRef.current,
      initialized: initializedRef.current,
      processId,
      initialXmlLength: initialXml?.length
    });

    if (!containerRef.current || typeof window === "undefined") {
      console.log(`[${myInitId}] No container or SSR, skipping`);
      return;
    }
    if (initializedRef.current) {
      console.log(`[${myInitId}] Already initialized, skipping`);
      return;
    }

    // Wait for initialXml if processId exists (editing existing workflow)
    // For new workflows, initialXml will be undefined and that's fine
    if (processId && !initialXml && !xmlLoadedRef.current) {
      console.log(`[${myInitId}] Waiting for initialXml to load...`);
      return; // Wait for query to complete
    }

    console.log(`[${myInitId}] Starting modeler initialization...`);
    xmlLoadedRef.current = true;

    let modeler: unknown = null;
    let aborted = false;

    const initModeler = async () => {
      console.log(`[${myInitId}] initModeler async starting...`);
      try {
        // Dynamic import for bpmn-js (browser only)
        const BpmnModeler = (await import("bpmn-js/lib/Modeler")).default;
        console.log(`[${myInitId}] BpmnModeler imported`);

        // Import CSS dynamically
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/diagram-js.css");
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/bpmn-js.css");
        // @ts-expect-error - CSS imports don't have type declarations
        await import("bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css");
        console.log(`[${myInitId}] CSS imported`);

        // Check if this init attempt was superseded or aborted
        if (aborted || initCounterRef.current !== myInitId) {
          console.log(`[${myInitId}] Init superseded or aborted (current: ${initCounterRef.current})`);
          return;
        }

        // Check if already initialized by another attempt
        if (initializedRef.current) {
          console.log(`[${myInitId}] Already initialized by another attempt`);
          return;
        }

        console.log(`[${myInitId}] Creating modeler with container:`, containerRef.current);
        modeler = new BpmnModeler({
          container: containerRef.current!,
        });
        console.log(`[${myInitId}] Modeler created:`, modeler);

        modelerRef.current = modeler;

        // Load initial diagram
        const xmlToLoad = initialXml || EMPTY_BPMN;
        console.log(`[${myInitId}] Initializing modeler with XML length:`, xmlToLoad.length);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (modeler as any).importXML(xmlToLoad);
        console.log(`[${myInitId}] XML imported successfully`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvas = (modeler as any).get("canvas");
        canvas.zoom("fit-viewport");

        // Mark as fully initialized AFTER successful setup
        initializedRef.current = true;
        setIsLoaded(true);
        console.log(`[${myInitId}] Modeler loaded and ready`);

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
      } catch (err) {
        console.error("initModeler failed:", err);
        toast({
          title: "Error",
          description: "Failed to initialize diagram editor",
          variant: "destructive",
        });
      }
    };

    initModeler();

    // Cleanup
    return () => {
      console.log(`[${myInitId}] Cleanup running, modeler exists:`, !!modeler, "initialized:", initializedRef.current);
      aborted = true;
      if (modeler) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (modeler as any).destroy();
        modelerRef.current = null;
        initializedRef.current = false;
      }
    };
  // Note: initialXml in deps so effect re-runs when XML loads from parent query
  // The initCounterRef ensures only the latest init attempt succeeds
  }, [toast, initialXml, processId]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!modelerRef.current || !onSave) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const { svg } = await modelerRef.current.saveSVG();

      await onSave(xml || "", svg || "", editableName);
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
  }, [onSave, toast, editableName]);

  // Export BPMN XML
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml || ""], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${editableName}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  }, [editableName]);

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

  // Update element name
  const handleNameChange = useCallback((newName: string) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get("modeling");
    const elementRegistry = modelerRef.current.get("elementRegistry");
    const element = elementRegistry.get(selectedElement.id);

    if (element) {
      modeling.updateProperties(element, { name: newName });
      setSelectedElement(prev => prev ? { ...prev, name: newName } : null);
    }
  }, [selectedElement]);


  // Update service task documentation (stores template_id)
  const handleTemplateChange = useCallback((templateId: string) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get("modeling");
    const moddle = modelerRef.current.get("moddle");
    const elementRegistry = modelerRef.current.get("elementRegistry");
    const element = elementRegistry.get(selectedElement.id);

    if (element) {
      // Create proper BPMN documentation element
      const config = { template_id: parseInt(templateId, 10), task_type: "generate_document" };
      const configJson = JSON.stringify(config);

      // Create a documentation element using moddle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentation = (moddle as any).create("bpmn:Documentation", {
        text: configJson
      });

      // Update the element with the new documentation array
      modeling.updateProperties(element, {
        documentation: [documentation]
      });

      // Update local state to reflect the change
      setSelectedElement(prev => prev ? {
        ...prev,
        businessObject: { ...prev.businessObject, documentation: [{ text: configJson }] }
      } : null);

      setIsDirty(true);
    }
  }, [selectedElement]);

  // Get current template ID from selected element
  const getTemplateId = useCallback((): string => {
    if (!selectedElement?.businessObject) return "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bo = selectedElement.businessObject as any;
    const docs = bo.documentation;

    if (!docs) return "";

    // Handle array of documentation elements (standard BPMN format)
    if (Array.isArray(docs) && docs.length > 0) {
      const textContent = docs[0].text || docs[0].body || docs[0];
      if (typeof textContent === "string") {
        try {
          const config = JSON.parse(textContent);
          return config.template_id?.toString() || "";
        } catch {
          return "";
        }
      }
    }

    // Handle direct object (from local state update)
    if (typeof docs === "object" && docs.template_id) {
      return docs.template_id.toString();
    }

    // Handle JSON string
    if (typeof docs === "string") {
      try {
        const config = JSON.parse(docs);
        return config.template_id?.toString() || "";
      } catch {
        return "";
      }
    }

    return "";
  }, [selectedElement]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <div className="flex items-center gap-1">
          <Input
            value={editableName}
            onChange={(e) => {
              setEditableName(e.target.value);
              setIsDirty(true);
            }}
            className="text-sm font-medium h-8 w-48"
            placeholder="Workflow name..."
          />
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
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <div className="font-medium">{selectedElement.type.replace("bpmn:", "")}</div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">ID</Label>
                  <div className="font-mono text-xs">{selectedElement.id}</div>
                </div>

                <div>
                  <Label htmlFor="element-name">Name</Label>
                  <Input
                    id="element-name"
                    value={selectedElement.name || ""}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter name..."
                    className="mt-1"
                  />
                </div>

                {/* Service Task Config - show for Task or ServiceTask */}
                {(selectedElement.type === "bpmn:ServiceTask" || selectedElement.type === "bpmn:Task") && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Document Generation</h4>
                    <div>
                      <Label htmlFor="template-select">Word Template</Label>
                      <select
                        id="template-select"
                        value={getTemplateId()}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select template...</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id.toString()}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
