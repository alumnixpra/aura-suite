import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Firestore limita cada documento a ~1MB; el base64 pesa ~33% más que el binario.
const MAX_PDF_BYTES = 700 * 1024;
const ANNOT_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fbc02d', '#000000'];

export default function PdfEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('create');
  const [pages, setPages] = useState([{ text: '' }]);
  const [sourceFile, setSourceFile] = useState(null);
  const [annotations, setAnnotations] = useState({});
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [tool, setTool] = useState('none'); // none | draw | text
  const [annotColor, setAnnotColor] = useState(ANNOT_COLORS[0]);
  const canvasRefs = useRef([]);
  const overlayRefs = useRef([]);
  const viewportSizes = useRef([]);
  const drawingRef = useRef(null);

  useEffect(() => {
    getDocument(id).then((document) => {
      const content = document.content;
      setDoc(document);
      setTitle(document.title);
      setMode(content.mode || 'create');
      setPages(content.pages || [{ text: '' }]);
      setSourceFile(content.sourceFile || null);
      setAnnotations(content.annotations || {});
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { mode, pages, sourceFile, annotations } }, 700);

  useEffect(() => {
    if (mode !== 'view' || !sourceFile) return;
    (async () => {
      const bytes = Uint8Array.from(atob(sourceFile.split(',')[1]), (c) => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      canvasRefs.current = Array.from({ length: pdf.numPages });
      overlayRefs.current = Array.from({ length: pdf.numPages });
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.2 });
        viewportSizes.current[i - 1] = { width: viewport.width, height: viewport.height };
        const canvas = canvasRefs.current[i - 1];
        if (!canvas) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      redrawAllOverlays();
    })();
  }, [mode, sourceFile]);

  useEffect(() => {
    redrawAllOverlays();
  }, [annotations]);

  function redrawAllOverlays() {
    overlayRefs.current.forEach((canvas, idx) => {
      if (!canvas) return;
      const size = viewportSizes.current[idx];
      if (size) {
        canvas.width = size.width;
        canvas.height = size.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pageAnnot = annotations[idx];
      if (!pageAnnot) return;
      for (const stroke of pageAnnot.strokes || []) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
      for (const stamp of pageAnnot.texts || []) {
        ctx.fillStyle = stamp.color;
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(stamp.text, stamp.x, stamp.y);
      }
    });
  }

  function getPagePoint(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function handleOverlayMouseDown(e, pageIdx) {
    const canvas = overlayRefs.current[pageIdx];
    if (!canvas) return;
    const point = getPagePoint(e, canvas);
    if (tool === 'text') {
      const text = window.prompt('Texto a insertar:');
      if (!text) return;
      setAnnotations((prev) => {
        const page = prev[pageIdx] || { strokes: [], texts: [] };
        return { ...prev, [pageIdx]: { ...page, texts: [...(page.texts || []), { x: point.x, y: point.y, text, color: annotColor }] } };
      });
      return;
    }
    if (tool === 'draw') {
      drawingRef.current = { pageIdx, points: [point] };
    }
  }

  function handleOverlayMouseMove(e, pageIdx) {
    if (!drawingRef.current || drawingRef.current.pageIdx !== pageIdx) return;
    const canvas = overlayRefs.current[pageIdx];
    const point = getPagePoint(e, canvas);
    drawingRef.current.points.push(point);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = annotColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const pts = drawingRef.current.points;
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  function handleOverlayMouseUp(pageIdx) {
    if (!drawingRef.current || drawingRef.current.pageIdx !== pageIdx) return;
    const { points } = drawingRef.current;
    drawingRef.current = null;
    if (points.length < 2) return;
    setAnnotations((prev) => {
      const page = prev[pageIdx] || { strokes: [], texts: [] };
      return { ...prev, [pageIdx]: { ...page, strokes: [...(page.strokes || []), { points, color: annotColor }] } };
    });
  }

  function clearPageAnnotations(pageIdx) {
    setAnnotations((prev) => ({ ...prev, [pageIdx]: { strokes: [], texts: [] } }));
  }

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError('');
    if (file.size > MAX_PDF_BYTES) {
      setUploadError(`El PDF pesa ${(file.size / 1024).toFixed(0)}KB, el máximo permitido es ${(MAX_PDF_BYTES / 1024).toFixed(0)}KB (límite de Firestore en el plan gratuito).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setSourceFile(dataUrl);
      setMode('view');
      setAnnotations({});
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      setPages(Array.from({ length: pdf.numPages }, () => ({ text: '' })));
    };
    reader.readAsDataURL(file);
  }

  function addPage() {
    setPages((prev) => [...prev, { text: '' }]);
  }

  function updatePageText(idx, text) {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, text } : p)));
  }

  async function generatePdf() {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const p of pages) {
      const page = pdfDoc.addPage([595, 842]);
      const lines = (p.text || '').split('\n');
      let y = 800;
      for (const line of lines) {
        page.drawText(line.slice(0, 110), { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
        y -= 18;
        if (y < 40) break;
      }
    }
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    setDownloadUrl(URL.createObjectURL(blob));
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  async function exportAnnotated() {
    const bytes = Uint8Array.from(atob(sourceFile.split(',')[1]), (c) => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const docPages = pdfDoc.getPages();
    docPages.forEach((page, idx) => {
      const pageAnnot = annotations[idx];
      if (!pageAnnot) return;
      const size = viewportSizes.current[idx];
      const scaleX = size ? page.getWidth() / size.width : 1;
      const scaleY = size ? page.getHeight() / size.height : 1;
      const toPdfY = (y) => page.getHeight() - y * scaleY;
      for (const stroke of pageAnnot.strokes || []) {
        const color = hexToRgb(stroke.color);
        for (let i = 1; i < stroke.points.length; i++) {
          const a = stroke.points[i - 1];
          const b = stroke.points[i];
          page.drawLine({
            start: { x: a.x * scaleX, y: toPdfY(a.y) },
            end: { x: b.x * scaleX, y: toPdfY(b.y) },
            thickness: 2,
            color,
          });
        }
      }
      for (const stamp of pageAnnot.texts || []) {
        page.drawText(stamp.text, { x: stamp.x * scaleX, y: toPdfY(stamp.y), size: 14, font, color: hexToRgb(stamp.color) });
      }
    });
    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    setDownloadUrl(URL.createObjectURL(blob));
  }

  if (!doc) return <div className="loading-screen">Cargando PDF...</div>;

  return (
    <div className="editor-page">
      <EditorHeader
        icon="🧾"
        title={title}
        onTitleChange={setTitle}
        status={status}
        extra={
          <div className="pdf-toolbar">
            <label className="btn-ghost upload-btn">
              Subir PDF
              <input type="file" accept="application/pdf" onChange={handleUpload} hidden />
            </label>
            {mode === 'create' && <button className="btn-primary" onClick={generatePdf}>Generar PDF</button>}
            {mode === 'view' && sourceFile && <button className="btn-primary" onClick={exportAnnotated}>Exportar con anotaciones</button>}
            {downloadUrl && <a className="btn-ghost" href={downloadUrl} download={`${title}.pdf`}>Descargar</a>}
          </div>
        }
      />

      {uploadError && <div className="pdf-upload-error">{uploadError}</div>}

      {mode === 'view' && sourceFile ? (
        <>
          <div className="pdf-annot-toolbar">
            <button className={`btn-icon ${tool === 'none' ? 'active' : ''}`} onClick={() => setTool('none')} title="Mover/ver">🖱️</button>
            <button className={`btn-icon ${tool === 'draw' ? 'active' : ''}`} onClick={() => setTool('draw')} title="Dibujar">✏️</button>
            <button className={`btn-icon ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Insertar texto">🔤</button>
            <div className="divider" />
            {ANNOT_COLORS.map((c) => (
              <button key={c} className={`btn-icon ${annotColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setAnnotColor(c)} />
            ))}
          </div>
          <div className="pdf-view-wrap">
            {pages.map((_, idx) => (
              <div key={idx} className="pdf-page-wrap">
                <div className="pdf-page-toolbar">
                  <button className="btn-ghost" onClick={() => clearPageAnnotations(idx)}>Limpiar página</button>
                </div>
                <canvas ref={(el) => (canvasRefs.current[idx] = el)} className="pdf-page-canvas" />
                <canvas
                  ref={(el) => (overlayRefs.current[idx] = el)}
                  className="pdf-annotation-canvas"
                  style={{ cursor: tool === 'none' ? 'default' : 'crosshair' }}
                  onMouseDown={(e) => handleOverlayMouseDown(e, idx)}
                  onMouseMove={(e) => handleOverlayMouseMove(e, idx)}
                  onMouseUp={() => handleOverlayMouseUp(idx)}
                  onMouseLeave={() => handleOverlayMouseUp(idx)}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pdf-create-wrap">
          <p className="hint-text">Escribe el contenido de cada página y genera tu PDF, o sube uno existente (máx. {(MAX_PDF_BYTES / 1024).toFixed(0)}KB) para visualizarlo y anotarlo.</p>
          {pages.map((p, idx) => (
            <div key={idx} className="pdf-page-block">
              <h4>Página {idx + 1}</h4>
              <textarea value={p.text} onChange={(e) => updatePageText(idx, e.target.value)} rows={12} />
            </div>
          ))}
          <button className="btn-ghost" onClick={addPage}>+ Añadir página</button>
        </div>
      )}
    </div>
  );
}
