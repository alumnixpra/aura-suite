import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

export default function DocEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const loadedRef = useRef(false);

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
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['link', 'blockquote', 'code-block'],
          ['clean'],
        ],
      },
    });
    quillRef.current.root.innerHTML = doc.content.html || '';
    loadedRef.current = true;
    quillRef.current.on('text-change', () => {
      setHtml(quillRef.current.root.innerHTML);
    });
  }, [doc]);

  const status = useAutosave(id, { title, content: { html } }, 700);

  if (!doc) return <div className="loading-screen">Cargando documento...</div>;

  return (
    <div className="editor-page">
      <EditorHeader icon="📄" title={title} onTitleChange={setTitle} status={status} />
      <div className="doc-editor-wrap">
        <div ref={editorRef} className="doc-editor" />
      </div>
    </div>
  );
}
