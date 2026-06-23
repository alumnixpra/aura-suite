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

export default function PdfEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('create');
  const [pages, setPages] = useState([{ text: '' }]);
  const [sourceFile, setSourceFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const canvasRefs = useRef([]);

  useEffect(() => {
    getDocument(id).then((document) => {
      const content = document.content;
      setDoc(document);
      setTitle(document.title);
      setMode(content.mode || 'create');
      setPages(content.pages || [{ text: '' }]);
      setSourceFile(content.sourceFile || null);
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { mode, pages, sourceFile } }, 700);

  useEffect(() => {
    if (mode !== 'view' || !sourceFile) return;
    (async () => {
      const bytes = Uint8Array.from(atob(sourceFile.split(',')[1]), (c) => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      canvasRefs.current = Array.from({ length: pdf.numPages });
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRefs.current[i - 1];
        if (!canvas) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    })();
  }, [mode, sourceFile]);

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
            {downloadUrl && <a className="btn-ghost" href={downloadUrl} download={`${title}.pdf`}>Descargar</a>}
          </div>
        }
      />

      {uploadError && <div className="pdf-upload-error">{uploadError}</div>}

      {mode === 'view' && sourceFile ? (
        <div className="pdf-view-wrap">
          {pages.map((_, idx) => (
            <canvas key={idx} ref={(el) => (canvasRefs.current[idx] = el)} className="pdf-page-canvas" />
          ))}
        </div>
      ) : (
        <div className="pdf-create-wrap">
          <p className="hint-text">Escribe el contenido de cada página y genera tu PDF, o sube uno existente (máx. {(MAX_PDF_BYTES / 1024).toFixed(0)}KB) para visualizarlo.</p>
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
