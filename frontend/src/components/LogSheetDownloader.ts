import jsPDF from "jspdf";
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

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [1000, 720],
  });

  for (let i = 0; i < svgElements.length; i++) {
    const svg = svgElements[i] as SVGSVGElement;

    // Serialize SVG to data URL
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Render SVG to canvas
    const img = new Image();
    img.width = 2000;
    img.height = 1320;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 2000;
        canvas.height = 1320;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 2000, 1320);
        ctx.drawImage(img, 0, 0, 2000, 1320);

        const imgData = canvas.toDataURL("image/png");

        if (i > 0) {
          pdf.addPage([1000, 660], "landscape");
        }
        pdf.addImage(imgData, "PNG", 0, 0, 1000, 660);

        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = reject;
    });

    img.src = url;
  }

  const date = plan.daily_sheets[0]?.date || "unknown";
  pdf.save(`daily-logs-${date}.pdf`);
}
