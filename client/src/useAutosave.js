import { useEffect, useRef, useState } from 'react';
import { updateDocument } from './firestoreDocs';

export default function useAutosave(docId, { title, content }, delay = 800) {
  const [status, setStatus] = useState('Guardado');
  const timer = useRef(null);
  const latest = useRef({ title, content });
  latest.current = { title, content };
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStatus('Editando...');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('Guardando...');
      try {
        await updateDocument(docId, latest.current);
        setStatus('Guardado');
      } catch {
        setStatus('Error al guardar');
      }
    }, delay);
    return () => clearTimeout(timer.current);
  }, [docId, title, content, delay]);

  return status;
}
