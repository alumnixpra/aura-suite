import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';

function uid() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newTextElement() {
  return { id: uid(), type: 'text', text: 'Texto nuevo', x: 60, y: 60, width: 320, fontSize: 20, color: '#1a1a1a', bold: false };
}

function newShapeElement(shape) {
  return { id: uid(), type: 'shape', shape, x: 100, y: 100, width: 220, height: 140, color: '#6a5cff' };
}

function newImageElement(src) {
  return { id: uid(), type: 'image', src, x: 100, y: 100, width: 300, height: 200 };
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
      setSlides(document.content.slides || [{ id: 'slide-1', elements: [], background: '#ffffff' }]);
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { slides } }, 700);

  function addSlide() {
    setSlides((prev) => [...prev, { id: `slide-${Date.now()}`, elements: [], background: '#ffffff' }]);
    setActiveIdx(slides.length);
  }

  function duplicateSlide(idx) {
    setSlides((prev) => {
      const copy = { ...prev[idx], id: `slide-${Date.now()}`, elements: prev[idx].elements.map((el) => ({ ...el, id: uid() })) };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveIdx(idx + 1);
  }

  function moveSlide(idx, dir) {
    setSlides((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setActiveIdx((i) => (i === idx ? idx + dir : i));
  }

  function deleteSlide(idx) {
    if (slides.length === 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((i) => Math.max(0, i - (idx <= i ? 1 : 0)));
  }

  function setSlideBackground(color) {
    setSlides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, background: color } : s)));
  }

  function addElement(el) {
    setSlides((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, elements: [...s.elements, el] } : s)));
    setActiveEl(el.id);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addElement(newImageElement(reader.result));
    reader.readAsDataURL(file);
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

  function renderElement(el, editable) {
    if (el.type === 'shape') {
      return (
        <div
          style={{
            position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
            background: el.color, borderRadius: el.shape === 'ellipse' ? '50%' : 6,
          }}
        />
      );
    }
    if (el.type === 'image') {
      return <img src={el.src} alt="" style={{ position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height, objectFit: 'cover', borderRadius: 4 }} />;
    }
    return (
      <div
        className="slide-element"
        style={{ left: el.x, top: el.y, width: el.width, fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal' }}
      >
        {editable ? (
          <div contentEditable suppressContentEditableWarning onBlur={(e) => updateElement(el.id, { text: e.target.innerText })}>
            {el.text}
          </div>
        ) : el.text}
      </div>
    );
  }

  function startDrag(e, el) {
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
  }

  if (!doc) return <div className="loading-screen">Cargando presentación...</div>;

  const slide = slides[activeIdx];

  if (presenting) {
    return (
      <div className="present-mode" onClick={() => setPresenting(false)}>
        <div className="present-slide" style={{ background: slide.background || '#fff' }}>
          {slide.elements.map((el) => <div key={el.id}>{renderElement(el, false)}</div>)}
        </div>
        <div className="present-hint">Clic para salir · {activeIdx + 1}/{slides.length}</div>
        <div className="present-nav">
          <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.max(0, i - 1)); }}>‹</button>
          <button onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => Math.min(slides.length - 1, i + 1)); }}>›</button>
        </div>
      </div>
    );
  }

  const activeElement = slide.elements.find((e) => e.id === activeEl);

  return (
    <div className="editor-page">
      <EditorHeader
        icon="📑"
        title={title}
        onTitleChange={setTitle}
        status={status}
        extra={
          <div className="slide-toolbar">
            <button className="btn-ghost" onClick={() => addElement(newTextElement())}>+ Texto</button>
            <button className="btn-ghost" onClick={() => addElement(newShapeElement('rect'))}>+ Rectángulo</button>
            <button className="btn-ghost" onClick={() => addElement(newShapeElement('ellipse'))}>+ Elipse</button>
            <label className="btn-ghost upload-btn">
              + Imagen
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
            </label>
            <button className="btn-primary" onClick={() => setPresenting(true)}>▶ Presentar</button>
          </div>
        }
      />
      <div className="slide-workspace">
        <aside className="slide-list">
          {slides.map((s, idx) => (
            <div key={s.id} className={`slide-thumb ${idx === activeIdx ? 'active' : ''}`} onClick={() => setActiveIdx(idx)}>
              <div className="slide-thumb-canvas" style={{ background: s.background || '#fff' }}>
                {s.elements.map((el) => {
                  if (el.type === 'shape') {
                    return <div key={el.id} className="slide-thumb-shape" style={{ left: el.x / 4, top: el.y / 4, width: el.width / 4, height: el.height / 4, background: el.color, borderRadius: el.shape === 'ellipse' ? '50%' : 3 }} />;
                  }
                  if (el.type === 'image') {
                    return <img key={el.id} src={el.src} alt="" className="slide-thumb-shape" style={{ left: el.x / 4, top: el.y / 4, width: el.width / 4, height: el.height / 4, objectFit: 'cover' }} />;
                  }
                  return (
                    <div key={el.id} className="slide-thumb-element" style={{ left: el.x / 4, top: el.y / 4, width: el.width / 4, fontSize: Math.max(4, el.fontSize / 4) }}>
                      {el.text}
                    </div>
                  );
                })}
              </div>
              <div className="slide-thumb-row">
                <span>{idx + 1}</span>
                <div className="slide-thumb-actions">
                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }}>↑</button>
                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }}>↓</button>
                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); duplicateSlide(idx); }}>⧉</button>
                </div>
              </div>
            </div>
          ))}
          <button className="btn-ghost add-slide-btn" onClick={addSlide}>+ Diapositiva</button>
          {slides.length > 1 && (
            <button className="btn-ghost danger" onClick={() => deleteSlide(activeIdx)}>Eliminar actual</button>
          )}
        </aside>

        <div className="slide-canvas-wrap">
          <div className="slide-canvas" style={{ background: slide.background || '#fff' }}>
            {slide.elements.map((el) => (
              <div
                key={el.id}
                className={el.type === 'text' ? (activeEl === el.id ? 'selected' : '') : `slide-shape ${activeEl === el.id ? 'selected' : ''}`}
                onClick={() => setActiveEl(el.id)}
                onMouseDown={(e) => startDrag(e, el)}
                style={el.type !== 'text' ? { position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height } : undefined}
              >
                {renderElement(el, el.type === 'text')}
              </div>
            ))}
          </div>

          <div className="element-inspector">
            <h5>Fondo de diapositiva</h5>
            <label>Color <input type="color" value={slide.background || '#ffffff'} onChange={(e) => setSlideBackground(e.target.value)} /></label>

            {activeElement && (
              <>
                <h5>Elemento seleccionado</h5>
                {activeElement.type === 'text' && (
                  <>
                    <label>Tamaño <input type="number" value={activeElement.fontSize} onChange={(e) => updateElement(activeElement.id, { fontSize: Number(e.target.value) })} /></label>
                    <label>Color <input type="color" value={activeElement.color} onChange={(e) => updateElement(activeElement.id, { color: e.target.value })} /></label>
                    <label><input type="checkbox" checked={activeElement.bold} onChange={(e) => updateElement(activeElement.id, { bold: e.target.checked })} /> Negrita</label>
                  </>
                )}
                {activeElement.type === 'shape' && (
                  <>
                    <label>Color <input type="color" value={activeElement.color} onChange={(e) => updateElement(activeElement.id, { color: e.target.value })} /></label>
                    <label>Ancho <input type="number" value={activeElement.width} onChange={(e) => updateElement(activeElement.id, { width: Number(e.target.value) })} /></label>
                    <label>Alto <input type="number" value={activeElement.height} onChange={(e) => updateElement(activeElement.id, { height: Number(e.target.value) })} /></label>
                  </>
                )}
                {activeElement.type === 'image' && (
                  <>
                    <label>Ancho <input type="number" value={activeElement.width} onChange={(e) => updateElement(activeElement.id, { width: Number(e.target.value) })} /></label>
                    <label>Alto <input type="number" value={activeElement.height} onChange={(e) => updateElement(activeElement.id, { height: Number(e.target.value) })} /></label>
                  </>
                )}
                <button className="btn-ghost danger" onClick={() => deleteElement(activeElement.id)}>Eliminar elemento</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
