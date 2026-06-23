import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { getDocument } from '../firestoreDocs';
import { useAuth } from '../AuthContext';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('create');
  const [pages, setPages] = useState([{ text: '' }]);
  const [sourceUrl, setSourceUrl] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const canvasRefs = useRef([]);

  useEffect(() => {
    getDocument(id).then((document) => {
      const content = document.content;
      setDoc(document);
      setTitle(document.title);
      setMode(content.mode || 'create');
      setPages(content.pages || [{ text: '' }]);
      setSourceUrl(content.sourceUrl || null);
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { mode, pages, sourceUrl } }, 700);

  useEffect(() => {
    if (mode !== 'view' || !sourceUrl) return;
    (async () => {
      const pdf = await pdfjsLib.getDocument(sourceUrl).promise;
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
  }, [mode, sourceUrl]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `pdfs/${user.id}/${id}-${Date.now()}.pdf`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const pdf = await pdfjsLib.getDocument(url).promise;
      setSourceUrl(url);
      setMode('view');
      setPages(Array.from({ length: pdf.numPages }, () => ({ text: '' })));
    } finally {
      setUploading(false);
    }
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
              {uploading ? 'Subiendo...' : 'Subir PDF'}
              <input type="file" accept="application/pdf" onChange={handleUpload} hidden disabled={uploading} />
            </label>
            {mode === 'create' && <button className="btn-primary" onClick={generatePdf}>Generar PDF</button>}
            {downloadUrl && <a className="btn-ghost" href={downloadUrl} download={`${title}.pdf`}>Descargar</a>}
          </div>
        }
      />

      {mode === 'view' && sourceUrl ? (
        <div className="pdf-view-wrap">
          {pages.map((_, idx) => (
            <canvas key={idx} ref={(el) => (canvasRefs.current[idx] = el)} className="pdf-page-canvas" />
          ))}
        </div>
      ) : (
        <div className="pdf-create-wrap">
          <p className="hint-text">Escribe el contenido de cada página y genera tu PDF, o sube uno existente para visualizarlo.</p>
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
