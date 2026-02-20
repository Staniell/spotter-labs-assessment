import { jsPDF } from "jspdf";
import type { TripPlan } from "../types";

/**
 * Download all daily log sheets as a single PDF.
 *
 * Strategy: serialize each SVG to an image, then add to jsPDF pages.
 */
export async function downloadAllSheets(plan: TripPlan): Promise<void> {
  const svgElements = document.querySelectorAll(".log-sheet-svg svg");
  if (svgElements.length === 0) {
    alert("No log sheets found to download.");
    return;
  }

  const firstViewBox = svgElements[0].getAttribute("viewBox")?.split(" ") || ["0", "0", "1000", "720"];
  const firstW = parseFloat(firstViewBox[2]);
  const firstH = parseFloat(firstViewBox[3]);

  // Use the dimensions from the first SVG for the initial PDF setup
  const pdf = new jsPDF({
    orientation: firstW > firstH ? "landscape" : "portrait",
    unit: "px",
    format: [firstW, firstH],
  });

  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i] as SVGSVGElement;

    // Ensure the xmlns attribute is explicitly present before serialization
    // This is sometimes missing in React/DOM nodes which breaks SVG in <img> tags
    if (!svg.getAttribute("xmlns")) {
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    // Serialize SVG to data URL securely
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svg);

    // Render SVG to canvas
    const viewBox = svg.getAttribute("viewBox")?.split(" ") || ["0", "0", "1000", "720"];
    const svgW = parseFloat(viewBox[2]);
    const svgH = parseFloat(viewBox[3]);
    const scale = 2; // For higher resolution
    const canvasW = svgW * scale;
    const canvasH = svgH * scale;

    const img = new Image();
    img.width = canvasW;
    img.height = canvasH;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0, canvasW, canvasH);

        const imgData = canvas.toDataURL("image/png");

        if (i > 0) {
          pdf.addPage([svgW, svgH], svgW > svgH ? "landscape" : "portrait");
        }
        pdf.addImage(imgData, "PNG", 0, 0, svgW, svgH);

        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        console.error("Failed to load SVG into Image for PDF rendering:", e);
        reject(new Error("Failed to load SVG into image for PDF generation. The SVG might be invalid."));
      };

      // Set src after setting handlers
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
    });
  }

  const date = plan.daily_sheets[0]?.date || "unknown";
  pdf.save(`daily-logs-${date}.pdf`);
}
