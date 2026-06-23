import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

function newTextElement() {
  return {
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'text',
    text: 'Texto nuevo',
    x: 60,
    y: 60,
    width: 320,
    fontSize: 20,
    color: '#1a1a1a',
    bold: false,
  };
}

export default function SlideEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeEl, setActiveEl] = useState(null);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    getDocument(id).then((document) => {
      setDoc(document);
      setTitle(document.title);
      setSlides(document.content.slides || [{ id: 'slide-1', elements: [] }]);
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { slides } }, 700);

  function addSlide() {
    setSlides((prev) => [...prev, { id: `slide-${Date.now()}`, elements: [] }]);
    setActiveIdx(slides.length);
  }

  function deleteSlide(idx) {
    if (slides.length === 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((i) => Math.max(0, i - (idx <= i ? 1 : 0)));
  }

  function addTextBox() {
    setSlides((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, elements: [...s.elements, newTextElement()] } : s))
    );
  }

  function updateElement(elId, patch) {
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeIdx
          ? { ...s, elements: s.elements.map((el) => (el.id === elId ? { ...el, ...patch } : el)) }
          : s
      )
    );
  }

  function deleteElement(elId) {
    setSlides((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, elements: s.elements.filter((el) => el.id !== elId) } : s))
    );
    setActiveEl(null);
  }

  if (!doc) return <div className="loading-screen">Cargando presentación...</div>;

  const slide = slides[activeIdx];

  if (presenting) {
    return (
      <div className="present-mode" onClick={() => setPresenting(false)}>
        <div className="present-slide">
          {slide.elements.map((el) => (
            <div
              key={el.id}
              className="slide-element"
              style={{
                left: el.x,
                top: el.y,
                width: el.width,
                fontSize: el.fontSize,
                color: el.color,
                fontWeight: el.bold ? 'bold' : 'normal',
              }}
            >
              {el.text}
            </div>
          ))}
        </div>
        <div className="present-hint">Clic para salir · {activeIdx + 1}/{slides.length}</div>
        <div className="present-nav">
          <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.max(0, i - 1)); }}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.min(slides.length - 1, i + 1)); }}>›</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <EditorHeader
        icon="📑"
        title={title}
        onTitleChange={setTitle}
        status={status}
        extra={
          <div className="slide-toolbar">
            <button className="btn-ghost" onClick={addTextBox}>+ Texto</button>
            <button className="btn-primary" onClick={() => setPresenting(true)}>▶ Presentar</button>
          </div>
        }
      />
      <div className="slide-workspace">
        <aside className="slide-list">
          {slides.map((s, idx) => (
            <div key={s.id} className={`slide-thumb ${idx === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(idx)}>
              <div className="slide-thumb-canvas">
                {s.elements.map((el) => (
                  <div
                    key={el.id}
                    className="slide-thumb-element"
                    style={{ left: el.x / 4, top: el.y / 4, width: el.width / 4, fontSize: Math.max(4, el.fontSize / 4) }}
                  >
                    {el.text}
                  </div>
                ))}
              </div>
              <span>{idx + 1}</span>
            </div>
          ))}
          <button className="btn-ghost add-slide-btn" onClick={addSlide}>+ Diapositiva</button>
          {slides.length > 1 && (
            <button className="btn-ghost danger" onClick={() => deleteSlide(activeIdx)}>Eliminar actual</button>
          )}
        </aside>

        <div className="slide-canvas-wrap">
          <div className="slide-canvas">
            {slide.elements.map((el) => (
              <div
                key={el.id}
                className={`slide-element editable ${activeEl === el.id ? 'selected' : ''}`}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  fontSize: el.fontSize,
                  color: el.color,
                  fontWeight: el.bold ? 'bold' : 'normal',
                }}
                onClick={() => setActiveEl(el.id)}
                onMouseDown={(e) => {
                  setActiveEl(el.id);
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const origX = el.x;
                  const origY = el.y;
                  function onMove(ev) {
                    updateElement(el.id, { x: origX + (ev.clientX - startX), y: origY + (ev.clientY - startY) });
                  }
                  function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  }
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateElement(el.id, { text: e.target.innerText })}
                >
                  {el.text}
                </div>
              </div>
            ))}
          </div>

          {activeEl && (
            <div className="element-inspector">
              {(() => {
                const el = slide.elements.find((e) => e.id === activeEl);
                if (!el) return null;
                return (
                  <>
                    <label>Tamaño <input type="number" value={el.fontSize} onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })} /></label>
                    <label>Color <input type="color" value={el.color} onChange={(e) => updateElement(el.id, { color: e.target.value })} /></label>
                    <label><input type="checkbox" checked={el.bold} onChange={(e) => updateElement(el.id, { bold: e.target.checked })} /> Negrita</label>
                    <button className="btn-ghost danger" onClick={() => deleteElement(el.id)}>Eliminar elemento</button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
