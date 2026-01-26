/**
 * TeeemPowerPoint Export
 *
 * Converts presentation JSON data to PPTX using PptxGenJS.
 * All coordinates are in inches (PptxGenJS standard).
 */

import PptxGenJS from "pptxgenjs";
import type {
  PresentationData,
  Slide,
  SlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  TableElement,
  ChartElement,
  ChartType,
} from "./types";

// Map our shape types to PptxGenJS shape names
const SHAPE_MAP: Record<string, string> = {
  rect: "rect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  triangle: "triangle",
  line: "line",
  arrow: "rightArrow",
  star5: "star5",
  diamond: "diamond",
};

// Map our chart types to PptxGenJS chart types
const CHART_TYPE_MAP: Record<ChartType, PptxGenJS.CHART_NAME> = {
  bar: PptxGenJS.charts.BAR,
  line: PptxGenJS.charts.LINE,
  pie: PptxGenJS.charts.PIE,
  doughnut: PptxGenJS.charts.DOUGHNUT,
  area: PptxGenJS.charts.AREA,
  scatter: PptxGenJS.charts.SCATTER,
};

/**
 * Export presentation data to PPTX file
 */
export async function exportToPptx(
  data: PresentationData,
  filename?: string
): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Set presentation metadata
  if (data.metadata) {
    if (data.metadata.title) pptx.title = data.metadata.title;
    if (data.metadata.author) pptx.author = data.metadata.author;
    if (data.metadata.subject) pptx.subject = data.metadata.subject;
    if (data.metadata.company) pptx.company = data.metadata.company;
  }

  // Set theme colors if provided
  if (data.theme?.colors) {
    // PptxGenJS doesn't have direct theme color API, but we use colors in elements
  }

  // Add slides
  for (const slideData of data.slides) {
    addSlide(pptx, slideData);
  }

  // Generate and return blob
  const blob = await pptx.write({ outputType: "blob" });
  return blob as Blob;
}

/**
 * Export and trigger download
 */
export async function downloadPptx(
  data: PresentationData,
  filename: string = "presentation.pptx"
): Promise<void> {
  const pptx = new PptxGenJS();

  // Set presentation metadata
  if (data.metadata) {
    if (data.metadata.title) pptx.title = data.metadata.title;
    if (data.metadata.author) pptx.author = data.metadata.author;
    if (data.metadata.subject) pptx.subject = data.metadata.subject;
    if (data.metadata.company) pptx.company = data.metadata.company;
  }

  // Add slides
  for (const slideData of data.slides) {
    addSlide(pptx, slideData);
  }

  // Trigger download
  await pptx.writeFile({ fileName: filename });
}

/**
 * Add a slide to the presentation
 */
function addSlide(pptx: PptxGenJS, slideData: Slide): void {
  const slide = pptx.addSlide();

  // Set background
  if (slideData.background) {
    if (slideData.background.color) {
      slide.background = { color: slideData.background.color.replace("#", "") };
    } else if (slideData.background.image) {
      slide.background = { data: slideData.background.image };
    }
  }

  // Add speaker notes
  if (slideData.notes) {
    slide.addNotes(slideData.notes);
  }

  // Sort elements by zIndex and add them
  const sortedElements = [...slideData.elements].sort(
    (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
  );

  for (const element of sortedElements) {
    addElement(slide, element);
  }
}

/**
 * Add an element to a slide
 */
function addElement(slide: PptxGenJS.Slide, element: SlideElement): void {
  switch (element.type) {
    case "text":
      addTextElement(slide, element);
      break;
    case "image":
      addImageElement(slide, element);
      break;
    case "shape":
      addShapeElement(slide, element);
      break;
    case "table":
      addTableElement(slide, element);
      break;
    case "chart":
      addChartElement(slide, element);
      break;
  }
}

/**
 * Add a text element
 */
function addTextElement(slide: PptxGenJS.Slide, element: TextElement): void {
  const opts: PptxGenJS.TextPropsOptions = {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotate: element.rotation,
  };

  // Apply text options
  if (element.options) {
    if (element.options.fontSize) opts.fontSize = element.options.fontSize;
    if (element.options.fontFace) opts.fontFace = element.options.fontFace;
    if (element.options.bold) opts.bold = element.options.bold;
    if (element.options.italic) opts.italic = element.options.italic;
    if (element.options.underline) opts.underline = { style: "sng" };
    if (element.options.strike) opts.strike = "sngStrike";
    if (element.options.color) opts.color = element.options.color;
    if (element.options.align) opts.align = element.options.align;
    if (element.options.valign) opts.valign = element.options.valign;
    if (element.options.bullet) {
      if (typeof element.options.bullet === "boolean") {
        opts.bullet = element.options.bullet;
      } else {
        opts.bullet = { type: element.options.bullet.type || "bullet" };
      }
    }
    if (element.options.lineSpacing) opts.lineSpacing = element.options.lineSpacing;
    if (element.options.margin !== undefined) {
      if (typeof element.options.margin === "number") {
        opts.margin = element.options.margin;
      } else {
        // [top, right, bottom, left]
        opts.margin = element.options.margin;
      }
    }
  }

  slide.addText(element.content, opts);
}

/**
 * Add an image element
 */
function addImageElement(slide: PptxGenJS.Slide, element: ImageElement): void {
  const opts: PptxGenJS.ImageProps = {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotate: element.rotation,
  };

  // Handle data URL vs external URL
  if (element.src.startsWith("data:")) {
    opts.data = element.src;
  } else {
    opts.path = element.src;
  }

  // Apply image options
  if (element.options) {
    if (element.options.sizing) {
      // Only include sizing if w and h are provided
      if (element.options.sizing.w !== undefined && element.options.sizing.h !== undefined) {
        opts.sizing = {
          type: element.options.sizing.type,
          w: element.options.sizing.w,
          h: element.options.sizing.h,
        };
      }
    }
    if (element.options.hyperlink) {
      opts.hyperlink = element.options.hyperlink;
    }
  }

  slide.addImage(opts);
}

/**
 * Add a shape element
 */
function addShapeElement(slide: PptxGenJS.Slide, element: ShapeElement): void {
  const shapeType = SHAPE_MAP[element.shapeType] || "rect";

  const opts: PptxGenJS.ShapeProps = {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotate: element.rotation,
  };

  // Apply shape options
  if (element.options) {
    if (element.options.fill) {
      const fill = element.options.fill;
      if ("color" in fill) {
        opts.fill = { color: fill.color.replace("#", "") };
      }
    }
    if (element.options.line) {
      opts.line = {
        color: element.options.line.color?.replace("#", ""),
        width: element.options.line.width,
        dashType: element.options.line.dashType as PptxGenJS.ShapeLineProps["dashType"],
      };
    }
    if (element.options.shadow) {
      opts.shadow = {
        type: element.options.shadow.type,
        blur: element.options.shadow.blur,
        offset: element.options.shadow.offset,
        angle: element.options.shadow.angle,
        color: element.options.shadow.color?.replace("#", ""),
      };
    }
  }

  slide.addShape(shapeType as PptxGenJS.SHAPE_NAME, opts);
}

/**
 * Add a table element
 */
function addTableElement(slide: PptxGenJS.Slide, element: TableElement): void {
  // Convert our row/cell format to PptxGenJS format
  // PptxGenJS expects TableRow[] where each row is TableCell[]
  const tableRows: PptxGenJS.TableRow[] = element.rows.map((row) =>
    row.cells.map((cell) => {
      const cellProps: PptxGenJS.TableCell = {
        text: cell.text,
      };

      if (cell.options) {
        if (cell.options.fill) {
          cellProps.options = cellProps.options || {};
          cellProps.options.fill = { color: cell.options.fill.color.replace("#", "") };
        }
        if (cell.options.color) {
          cellProps.options = cellProps.options || {};
          cellProps.options.color = cell.options.color.replace("#", "");
        }
        if (cell.options.bold) {
          cellProps.options = cellProps.options || {};
          cellProps.options.bold = cell.options.bold;
        }
        if (cell.options.align) {
          cellProps.options = cellProps.options || {};
          cellProps.options.align = cell.options.align;
        }
        if (cell.options.valign) {
          cellProps.options = cellProps.options || {};
          cellProps.options.valign = cell.options.valign;
        }
        if (cell.options.colspan) {
          cellProps.options = cellProps.options || {};
          cellProps.options.colspan = cell.options.colspan;
        }
        if (cell.options.rowspan) {
          cellProps.options = cellProps.options || {};
          cellProps.options.rowspan = cell.options.rowspan;
        }
      }

      return cellProps;
    })
  );

  const opts: PptxGenJS.TableProps = {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
  };

  // Apply table options
  if (element.options) {
    if (element.options.colW) opts.colW = element.options.colW;
    if (element.options.rowH) opts.rowH = element.options.rowH;
    if (element.options.border) {
      opts.border = {
        pt: element.options.border.pt,
        color: element.options.border.color.replace("#", ""),
      };
    }
    if (element.options.fill) {
      opts.fill = { color: element.options.fill.color.replace("#", "") };
    }
    if (element.options.fontFace) opts.fontFace = element.options.fontFace;
    if (element.options.fontSize) opts.fontSize = element.options.fontSize;
  }

  slide.addTable(tableRows, opts);
}

/**
 * Add a chart element
 */
function addChartElement(slide: PptxGenJS.Slide, element: ChartElement): void {
  const chartType = CHART_TYPE_MAP[element.chartType];

  // Convert our data format to PptxGenJS format
  const chartData: PptxGenJS.OptsChartData[] = element.data.map((series) => ({
    name: series.name,
    labels: series.labels,
    values: series.values,
  }));

  const opts: PptxGenJS.IChartOpts = {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
  };

  // Apply chart options
  if (element.options) {
    if (element.options.showLegend !== undefined) {
      opts.showLegend = element.options.showLegend;
    }
    if (element.options.legendPos) {
      opts.legendPos = element.options.legendPos;
    }
    if (element.options.showTitle) {
      opts.showTitle = element.options.showTitle;
    }
    if (element.options.title) {
      opts.title = element.options.title;
    }
    if (element.options.showValue !== undefined) {
      opts.showValue = element.options.showValue;
    }
    if (element.options.chartColors) {
      opts.chartColors = element.options.chartColors.map((c) => c.replace("#", ""));
    }
    if (element.options.barDir && element.chartType === "bar") {
      opts.barDir = element.options.barDir;
    }
    if (element.options.lineSmooth !== undefined && element.chartType === "line") {
      opts.lineSmooth = element.options.lineSmooth;
    }
  }

  slide.addChart(chartType, chartData, opts);
}
