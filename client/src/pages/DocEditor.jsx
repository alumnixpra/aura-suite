import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

const Size = Quill.import('attributors/style/size');
Size.whitelist = ['12px', '14px', '16px', '18px', '24px', '32px', '48px'];
Quill.register(Size, true);

const Font = Quill.import('attributors/class/font');
Font.whitelist = ['sans-serif', 'serif', 'monospace', 'georgia', 'tahoma'];
Quill.register(Font, true);

export default function DocEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const editorRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    getDocument(id).then((document) => {
      setDoc(document);
      setTitle(document.title);
      setHtml(document.content.html || '');
    });
  }, [id]);

  useEffect(() => {
    if (!doc || !editorRef.current || quillRef.current) return;
    quillRef.current = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ font: Font.whitelist }, { size: Size.whitelist }],
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ script: 'sub' }, { script: 'super' }],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['link', 'image', 'blockquote', 'code-block'],
          ['clean'],
        ],
      },
    });
    quillRef.current.root.innerHTML = doc.content.html || '';
    quillRef.current.on('text-change', () => {
      setHtml(quillRef.current.root.innerHTML);
    });
  }, [doc]);

  const status = useAutosave(id, { title, content: { html } }, 700);

  function insertTable() {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection(true) || { index: quill.getLength() };
    const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:10px 0;">${Array.from({ length: 3 })
      .map(() => `<tr>${Array.from({ length: 3 }).map(() => '<td style="border:1px solid #ccc;padding:8px;min-width:60px;">&nbsp;</td>').join('')}</tr>`)
      .join('')}</table><p><br></p>`;
    quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
  }

  if (!doc) return <div className="loading-screen">Cargando documento...</div>;

  return (
    <div className="editor-page">
      <EditorHeader
        icon="📄"
        title={title}
        onTitleChange={setTitle}
        status={status}
        extra={<button className="btn-ghost" onClick={insertTable}>+ Tabla</button>}
      />
      <div className="doc-editor-wrap">
        <div ref={editorRef} className="doc-editor" />
      </div>
    </div>
  );
}
