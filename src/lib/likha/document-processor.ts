// src/lib/likha/document-processor.ts
// LIKHA Scanner — Client-side document image processing via OpenCV.js (WASM).
// Handles edge detection, perspective correction, and image enhancement for
// camera-scanned documents. Falls back gracefully when OpenCV is unavailable.

'use client';

export interface ProcessingOptions {
  /** Auto-detect edges and correct perspective (requires OpenCV.js) */
  autoEdgeDetect?: boolean;
  /** Manual crop box as fractions [top, right, bottom, left] 0-1 (used when auto fails or is off) */
  cropBox?: { top: number; right: number; bottom: number; left: number };
  /** Contrast adjustment -100 to 100 */
  contrast?: number;
  /** Brightness adjustment -100 to 100 */
  brightness?: number;
  /** Output JPEG quality 0-1 */
  quality?: number;
  /** Convert to grayscale */
  grayscale?: boolean;
}

export interface ProcessingResult {
  blob: Blob;
  width: number;
  height: number;
  usedOpenCV: boolean;
  edgesDetected: boolean;
}

// ── OpenCV.js dynamic loader (singleton, cached after first load) ──

let cvPromise: Promise<any> | null = null;

export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('OpenCV.js requires browser context'));
      return;
    }

    // Already loaded (e.g. from a previous session)
    if ((window as any).cv && (window as any).cv.Mat) {
      resolve((window as any).cv);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.10.0/opencv.js';
    script.async = true;
    script.onload = () => {
      // OpenCV.js sets window.cv after WASM initialization
      const checkReady = () => {
        if ((window as any).cv && (window as any).cv.Mat) {
          resolve((window as any).cv);
        } else {
          // Poll until ready (WASM may still be initializing)
          setTimeout(checkReady, 100);
        }
      };
      // Start checking after a brief delay for the script to execute
      setTimeout(checkReady, 200);
    };
    script.onerror = () => {
      cvPromise = null; // Allow retry
      reject(new Error('Failed to load OpenCV.js from CDN'));
    };
    document.head.appendChild(script);
  });

  return cvPromise;
}

/** Check if OpenCV.js is already loaded and ready */
export function isCVReady(): boolean {
  return typeof window !== 'undefined' && !!(window as any).cv?.Mat;
}

// ── Edge detection & perspective correction ──

/**
 * Attempt to detect the document in the image and correct its perspective.
 * Returns the corrected image data, or null if detection failed.
 */
function detectAndCorrect(
  cv: any,
  imageData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): ImageData | null {
  try {
    // Create Mat from RGBA ImageData
    const rgbaMat = cv.matFromImageData(imageData);

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(rgbaMat, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Canny edge detection
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);

    // Dilate to connect edge segments
    const dilated = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edges, dilated, kernel);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find the largest 4-sided contour (likely the document boundary)
    let bestContour: any = null;
    let bestArea = 0;
    const totalArea = canvasWidth * canvasHeight;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Document should be at least 10% of the image and less than 95%
      if (area > totalArea * 0.1 && area < totalArea * 0.95 && area > bestArea) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          bestContour = approx;
          bestArea = area;
          contour.delete();
        } else {
          approx.delete();
        }
      }
      contour.delete();
    }

    // Clean up intermediate Mats
    rgbaMat.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();

    if (!bestContour) return null;

    // Order the 4 corners: top-left, top-right, bottom-right, bottom-left
    const pts: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      pts.push([
        bestContour.floatAt(i, 0), // x
        bestContour.floatAt(i, 1), // y
      ]);
    }
    bestContour.delete();

    // Sort: by y to separate top/bottom, then by x within each pair
    pts.sort((a, b) => a[1] - b[1]);
    const top = pts.slice(0, 2).sort((a, b) => a[0] - b[0]);
    const bottom = pts.slice(2, 4).sort((a, b) => a[0] - b[0]);
    const ordered = [top[0], top[1], bottom[1], bottom[0]]; // TL, TR, BR, BL

    // Calculate the target dimensions (width/height of the corrected document)
    const widthTop = Math.hypot(ordered[1][0] - ordered[0][0], ordered[1][1] - ordered[0][1]);
    const widthBot = Math.hypot(ordered[2][0] - ordered[3][0], ordered[2][1] - ordered[3][1]);
    const heightLeft = Math.hypot(ordered[3][0] - ordered[0][0], ordered[3][1] - ordered[0][1]);
    const heightRight = Math.hypot(ordered[2][0] - ordered[1][0], ordered[2][1] - ordered[1][1]);
    const docWidth = Math.max(widthTop, widthBot);
    const docHeight = Math.max(heightLeft, heightRight);

    if (docWidth < 50 || docHeight < 50) return null; // Too small to be a document

    // Source points (detected corners) → Destination points (rectangular output)
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, new Float32Array([
      ordered[0][0], ordered[0][1],
      ordered[1][0], ordered[1][1],
      ordered[2][0], ordered[2][1],
      ordered[3][0], ordered[3][1],
    ]));

    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, new Float32Array([
      0, 0,
      docWidth, 0,
      docWidth, docHeight,
      0, docHeight,
    ]));

    const transform = cv.getPerspectiveTransform(srcTri, dstTri);

    // Re-read the original image for warping
    const originalMat = cv.matFromImageData(imageData);
    const warped = new cv.Mat();
    cv.warpPerspective(
      originalMat,
      warped,
      transform,
      new cv.Size(Math.round(docWidth), Math.round(docHeight))
    );

    // Clean up
    srcTri.delete();
    dstTri.delete();
    transform.delete();
    originalMat.delete();

    // Convert warped result back to ImageData
    const warpedRGBA = new cv.Mat();
    cv.cvtColor(warped, warpedRGBA, cv.COLOR_RGBA2RGBA); // ensure 4-channel
    const result = new ImageData(
      new Uint8ClampedArray(warpedRGBA.data),
      warpedRGBA.cols,
      warpedRGBA.rows
    );

    warped.delete();
    warpedRGBA.delete();

    return result;
  } catch (err) {
    console.warn('[document-processor] Edge detection failed:', err);
    return null;
  }
}

// ── Main processing pipeline ──

/**
 * Process a captured image for document archival.
 *
 * Pipeline: edge detection → perspective correction → enhancement → JPEG encode.
 * Falls back to basic crop + canvas enhancement if OpenCV.js is unavailable.
 */
export async function processDocumentImage(
  source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const {
    autoEdgeDetect = true,
    cropBox,
    contrast = 25,
    brightness = 15,
    quality = 0.92,
    grayscale = false,
  } = options;

  const srcWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : (source as any).width || (source as any).naturalWidth;
  const srcHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : (source as any).height || (source as any).naturalHeight;

  // Draw source to a working canvas
  const workCanvas = document.createElement('canvas');
  workCanvas.width = srcWidth;
  workCanvas.height = srcHeight;
  const workCtx = workCanvas.getContext('2d')!;
  workCtx.drawImage(source as any, 0, 0, srcWidth, srcHeight);

  let usedOpenCV = false;
  let edgesDetected = false;

  // ── Step 1: Edge detection + perspective correction ──
  if (autoEdgeDetect) {
    try {
      const cv = await loadOpenCV();
      usedOpenCV = true;

      const imageData = workCtx.getImageData(0, 0, srcWidth, srcHeight);
      const corrected = detectAndCorrect(cv, imageData, srcWidth, srcHeight);

      if (corrected) {
        edgesDetected = true;
        workCanvas.width = corrected.width;
        workCanvas.height = corrected.height;
        workCtx.putImageData(corrected, 0, 0);
      }
    } catch (err) {
      console.warn('[document-processor] OpenCV unavailable, using basic processing:', err);
    }
  }

  // ── Step 1b: Manual crop fallback ──
  if (!edgesDetected && cropBox) {
    const { top, right, bottom, left } = cropBox;
    const sx = Math.round(left * srcWidth);
    const sy = Math.round(top * srcHeight);
    const sw = Math.round((right - left) * srcWidth);
    const sh = Math.round((bottom - top) * srcHeight);

    if (sw > 0 && sh > 0) {
      const croppedData = workCtx.getImageData(sx, sy, sw, sh);
      workCanvas.width = sw;
      workCanvas.height = sh;
      workCtx.putImageData(croppedData, 0, 0);
    }
  }

  // ── Step 2: Enhancement ──
  const finalWidth = workCanvas.width;
  const finalHeight = workCanvas.height;
  const finalData = workCtx.getImageData(0, 0, finalWidth, finalHeight);
  const d = finalData.data;

  const contrastFactor = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Brightness
    r += brightness * 2.55;
    g += brightness * 2.55;
    b += brightness * 2.55;

    // Grayscale
    if (grayscale) {
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = avg;
    }

    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, b));
  }

  workCtx.putImageData(finalData, 0, 0);

  // ── Step 3: Encode to JPEG blob ──
  const blob = await new Promise<Blob>((resolve, reject) => {
    workCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
      'image/jpeg',
      quality
    );
  });

  return {
    blob,
    width: finalWidth,
    height: finalHeight,
    usedOpenCV,
    edgesDetected,
  };
}

// ── Multi-page PDF assembly ──

/**
 * Assemble multiple processed page images into a single PDF blob.
 * Uses jsPDF (already a project dependency).
 */
export async function assemblePagesToPDF(pages: Blob[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  if (pages.length === 0) throw new Error('No pages to assemble');

  // Read the first page to determine page size
  const firstImg = await blobToDataUrl(pages[0]);
  const firstDims = await getImageDimensions(firstImg);

  // A4 dimensions in mm (595.28 x 841.89 pt)
  const a4Width = 210;
  const a4Height = 297;

  const pdf = new jsPDF({
    orientation: firstDims.width > firstDims.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add first page
  pdf.addImage(firstImg, 'JPEG', 0, 0, a4Width, a4Height);

  // Add remaining pages
  for (let i = 1; i < pages.length; i++) {
    const img = await blobToDataUrl(pages[i]);
    const dims = await getImageDimensions(img);
    const orientation = dims.width > dims.height ? 'landscape' : 'portrait';
    pdf.addPage('a4', orientation);
    pdf.addImage(img, 'JPEG', 0, 0, a4Width, a4Height);
  }

  return pdf.output('blob');
}

// ── Utility helpers ──

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
