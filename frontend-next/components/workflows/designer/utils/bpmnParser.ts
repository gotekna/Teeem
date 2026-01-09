import type { BpmnNodeType, BpmnNodeData, BpmnEdgeData } from "../types";

interface ParsedBpmnElement {
  id: string;
  name?: string;
  type: BpmnNodeType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface ParsedBpmnEdge {
  id: string;
  source: string;
  target: string;
  name?: string;
  conditionExpression?: string;
}

interface ParsedBpmnProcess {
  id: string;
  name: string;
  nodes: ParsedBpmnElement[];
  edges: ParsedBpmnEdge[];
  dataStores: ParsedBpmnElement[];
}

// Map BPMN element types to our internal types
const BPMN_TYPE_MAP: Record<string, BpmnNodeType> = {
  startEvent: "start_event",
  endEvent: "end_event",
  userTask: "user_task",
  serviceTask: "service_task",
  exclusiveGateway: "exclusive_gateway",
  parallelGateway: "parallel_gateway",
  intermediateCatchEvent: "timer_event",
  intermediateThrowEvent: "timer_event",
  boundaryEvent: "timer_event",
  dataStoreReference: "data_store_reference",
};

// Get attribute value from element, handling namespaces
function getAttr(element: Element, name: string): string | null {
  return element.getAttribute(name) || element.getAttribute(`bpmn:${name}`);
}

// Get text content of child element
function getChildText(element: Element, tagName: string): string | null {
  const child = element.querySelector(tagName) ||
                element.querySelector(`bpmn\\:${tagName}`);
  return child?.textContent || null;
}

// Parse position from BPMNDI shape
function parsePosition(
  shapeMap: Map<string, { x: number; y: number; width: number; height: number }>,
  elementId: string
): { x: number; y: number } {
  const shape = shapeMap.get(elementId);
  if (shape) {
    return { x: shape.x, y: shape.y };
  }
  return { x: 0, y: 0 };
}

// Parse extension elements for config
function parseExtensions(element: Element): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Parse compoza extensions (from the UPHomes file)
  const attrs = element.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith("compoza:") || attr.name.startsWith("rapid:")) {
      const key = attr.name.split(":")[1];
      config[key] = attr.value;
    }
  }

  // Parse implementation attribute for service tasks
  const implementation = getAttr(element, "implementation");
  if (implementation) {
    config.implementation = implementation;

    // Map compoza implementations to our task types
    if (implementation.includes("fill-docx-document")) {
      config.task_type = "generate_document";
    } else if (implementation.includes("send-email")) {
      config.task_type = "send_email";
    } else if (implementation.includes("webhook")) {
      config.task_type = "call_webhook";
    }
  }

  // Parse extension elements
  const extensionElements = element.querySelector("extensionElements") ||
                            element.querySelector("bpmn\\:extensionElements");
  if (extensionElements) {
    // Parse dynamic fields
    const dynamicFields = extensionElements.querySelectorAll("[ColumnName]");
    if (dynamicFields.length > 0) {
      config.dynamicFields = Array.from(dynamicFields).map((field) => ({
        columnName: field.getAttribute("ColumnName"),
        title: field.getAttribute("Title"),
        fieldType: field.getAttribute("FieldType"),
        settings: field.getAttribute("Settings"),
      }));
    }

    // Parse rapid getItemRequest
    const getItemRequest = extensionElements.querySelector("getItemRequest") ||
                           extensionElements.querySelector("rapid\\:getItemRequest");
    if (getItemRequest) {
      config.dataSource = {
        list: getItemRequest.getAttribute("list"),
        itemId: getItemRequest.getAttribute("itemId"),
      };
    }
  }

  return config;
}

export function parseBpmnXml(xmlString: string): ParsedBpmnProcess {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`Invalid BPMN XML: ${parseError.textContent}`);
  }

  // Build shape position map from BPMNDI
  const shapeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  const shapes = doc.querySelectorAll("BPMNShape, bpmndi\\:BPMNShape");
  shapes.forEach((shape) => {
    const elementRef = shape.getAttribute("bpmnElement");
    const bounds = shape.querySelector("Bounds, dc\\:Bounds");
    if (elementRef && bounds) {
      shapeMap.set(elementRef, {
        x: parseFloat(bounds.getAttribute("x") || "0"),
        y: parseFloat(bounds.getAttribute("y") || "0"),
        width: parseFloat(bounds.getAttribute("width") || "100"),
        height: parseFloat(bounds.getAttribute("height") || "80"),
      });
    }
  });

  // Find the process element
  const process = doc.querySelector("process, bpmn\\:process");
  if (!process) {
    throw new Error("No process element found in BPMN file");
  }

  const processId = getAttr(process, "id") || "process_1";
  const processName = getAttr(process, "name") || "Imported Process";

  const nodes: ParsedBpmnElement[] = [];
  const edges: ParsedBpmnEdge[] = [];
  const dataStores: ParsedBpmnElement[] = [];

  // Parse all flow elements
  const elementTypes = [
    "startEvent",
    "endEvent",
    "userTask",
    "serviceTask",
    "exclusiveGateway",
    "parallelGateway",
    "intermediateCatchEvent",
    "intermediateThrowEvent",
    "boundaryEvent",
    "dataStoreReference",
  ];

  elementTypes.forEach((elementType) => {
    const elements = process.querySelectorAll(elementType) ||
                     process.querySelectorAll(`bpmn\\:${elementType}`);

    elements.forEach((element) => {
      const id = getAttr(element, "id");
      if (!id) return;

      const nodeType = BPMN_TYPE_MAP[elementType];
      if (!nodeType) return;

      const node: ParsedBpmnElement = {
        id,
        name: getAttr(element, "name") || undefined,
        type: nodeType,
        position: parsePosition(shapeMap, id),
        config: parseExtensions(element),
      };

      // Check for timer definitions
      if (elementType.includes("Event")) {
        const timerDef = element.querySelector("timerEventDefinition, bpmn\\:timerEventDefinition");
        if (timerDef) {
          node.type = "timer_event";
          const duration = getChildText(timerDef, "timeDuration");
          if (duration) {
            node.config.duration = duration;
          }
        }
      }

      if (nodeType === "data_store_reference") {
        dataStores.push(node);
      } else {
        nodes.push(node);
      }
    });
  });

  // Parse sequence flows
  const sequenceFlows = process.querySelectorAll("sequenceFlow, bpmn\\:sequenceFlow");
  sequenceFlows.forEach((flow) => {
    const id = getAttr(flow, "id");
    const source = getAttr(flow, "sourceRef");
    const target = getAttr(flow, "targetRef");

    if (!id || !source || !target) return;

    const conditionExpr = flow.querySelector("conditionExpression, bpmn\\:conditionExpression");

    edges.push({
      id,
      source,
      target,
      name: getAttr(flow, "name") || undefined,
      conditionExpression: conditionExpr?.textContent || undefined,
    });
  });

  return {
    id: processId,
    name: processName,
    nodes: [...nodes, ...dataStores],
    edges,
    dataStores,
  };
}

// Convert parsed BPMN to our internal format for React Flow
export function convertToReactFlowFormat(parsed: ParsedBpmnProcess) {
  // Normalize positions (BPMN can have negative coordinates)
  let minX = Infinity;
  let minY = Infinity;

  parsed.nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
  });

  // Add padding and normalize
  const offsetX = minX < 0 ? Math.abs(minX) + 100 : 100;
  const offsetY = minY < 0 ? Math.abs(minY) + 100 : 100;

  const nodes = parsed.nodes.map((node) => ({
    id: node.id,
    nodeKey: node.id,
    nodeType: node.type,
    name: node.name || getDefaultName(node.type),
    description: undefined,
    config: node.config,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));

  const edges = parsed.edges.map((edge) => ({
    id: edge.id,
    edgeKey: edge.id,
    source: edge.source,
    target: edge.target,
    name: edge.name,
    conditionExpression: edge.conditionExpression,
    isDefault: false,
  }));

  return {
    name: parsed.name,
    nodes,
    edges,
  };
}

function getDefaultName(type: BpmnNodeType): string {
  const names: Record<BpmnNodeType, string> = {
    start_event: "Start",
    end_event: "End",
    user_task: "User Task",
    service_task: "Service Task",
    exclusive_gateway: "Decision",
    parallel_gateway: "Parallel",
    timer_event: "Timer",
    data_store_reference: "Data Store",
    intermediate_event: "Intermediate Event",
    sub_process: "Sub-Process",
    annotation: "Note",
    pool: "Pool",
    lane: "Lane",
  };
  return names[type] || "Node";
}

// Export helper to read and parse a BPMN file
export async function importBpmnFile(file: File): Promise<ReturnType<typeof convertToReactFlowFormat>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const xmlString = event.target?.result as string;
        const parsed = parseBpmnXml(xmlString);
        const converted = convertToReactFlowFormat(parsed);
        resolve(converted);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}
