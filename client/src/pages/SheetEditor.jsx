import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument } from '../firestoreDocs';
import EditorHeader from '../components/EditorHeader';
import useAutosave from '../useAutosave';
import { cellId, colLetter, evaluateCell } from '../sheetEngine';

export default function SheetEditor() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [cells, setCells] = useState({});
  const [rows, setRows] = useState(30);
  const [cols, setCols] = useState(12);
  const [activeCell, setActiveCell] = useState('A1');
  const [formulaInput, setFormulaInput] = useState('');

  useEffect(() => {
    getDocument(id).then((document) => {
      setDoc(document);
      setTitle(document.title);
      setCells(document.content.cells || {});
      setRows(document.content.rows || 30);
      setCols(document.content.cols || 12);
    });
  }, [id]);

  const status = useAutosave(id, { title, content: { cells, rows, cols } }, 700);

  useEffect(() => {
    setFormulaInput(cells[activeCell]?.raw || '');
  }, [activeCell, cells]);

  function setCellRaw(ref, raw) {
    setCells((prev) => ({ ...prev, [ref]: { ...prev[ref], raw } }));
  }

  function toggleFormat(key) {
    setCells((prev) => {
      const current = prev[activeCell] || { raw: '' };
      return { ...prev, [activeCell]: { ...current, [key]: !current[key] } };
    });
  }

  function setFormat(key, value) {
    setCells((prev) => {
      const current = prev[activeCell] || { raw: '' };
      return { ...prev, [activeCell]: { ...current, [key]: value } };
    });
  }

  function handleFormulaCommit(ref, value) {
    setCellRaw(ref, value);
  }

  const grid = useMemo(() => {
    const g = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const ref = cellId(r, c);
        row.push(ref);
      }
      g.push(row);
    }
    return g;
  }, [rows, cols]);

  if (!doc) return <div className="loading-screen">Cargando hoja de cálculo...</div>;

  const activeFmt = cells[activeCell] || {};

  return (
    <div className="editor-page">
      <EditorHeader
        icon="📊"
        title={title}
        onTitleChange={setTitle}
        status={status}
        extra={
          <div className="sheet-toolbar">
            <button className="btn-ghost" onClick={() => setRows((r) => r + 10)}>+10 filas</button>
            <button className="btn-ghost" onClick={() => setCols((c) => c + 5)}>+5 columnas</button>
          </div>
        }
      />
      <div className="formula-bar">
        <span className="formula-ref">{activeCell}</span>
        <input
          className="formula-input"
          value={formulaInput}
          onChange={(e) => setFormulaInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleFormulaCommit(activeCell, formulaInput);
            }
          }}
          onBlur={() => handleFormulaCommit(activeCell, formulaInput)}
          placeholder="Escribe un valor o fórmula, ej: =SUM(A1:A5), =IF(A1>5,&quot;sí&quot;,&quot;no&quot;)"
        />
      </div>
      <div className="cell-format-bar">
        <button className={`btn-icon ${activeFmt.bold ? 'active' : ''}`} onClick={() => toggleFormat('bold')}><b>B</b></button>
        <button className={`btn-icon ${activeFmt.italic ? 'active' : ''}`} onClick={() => toggleFormat('italic')}><i>I</i></button>
        <button className={`btn-icon ${activeFmt.underline ? 'active' : ''}`} onClick={() => toggleFormat('underline')}><u>U</u></button>
        <div className="divider" />
        <input type="color" title="Color de texto" value={activeFmt.color || '#1a1d29'} onChange={(e) => setFormat('color', e.target.value)} />
        <input type="color" title="Color de relleno" value={activeFmt.bg || '#ffffff'} onChange={(e) => setFormat('bg', e.target.value)} />
        <div className="divider" />
        <button className={`btn-icon ${activeFmt.align === 'left' ? 'active' : ''}`} onClick={() => setFormat('align', 'left')}>⟸</button>
        <button className={`btn-icon ${activeFmt.align === 'center' ? 'active' : ''}`} onClick={() => setFormat('align', 'center')}>≡</button>
        <button className={`btn-icon ${activeFmt.align === 'right' ? 'active' : ''}`} onClick={() => setFormat('align', 'right')}>⟹</button>
      </div>
      <div className="sheet-scroll">
        <table className="sheet-grid">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: cols }).map((_, c) => (
                <th key={c}>{colLetter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {row.map((ref) => {
                  const cellData = cells[ref] || {};
                  const display = evaluateCell(cellData.raw, cells);
                  const style = {
                    fontWeight: cellData.bold ? 700 : 400,
                    fontStyle: cellData.italic ? 'italic' : 'normal',
                    textDecoration: cellData.underline ? 'underline' : 'none',
                    color: cellData.color || undefined,
                    background: cellData.bg || undefined,
                    textAlign: cellData.align || 'left',
                  };
                  return (
                    <td
                      key={ref}
                      className={activeCell === ref ? 'active-cell' : ''}
                      onClick={() => setActiveCell(ref)}
                    >
                      <input
                        style={style}
                        value={activeCell === ref ? formulaInput : display}
                        readOnly={activeCell !== ref}
                        onFocus={() => setActiveCell(ref)}
                        onChange={(e) => setFormulaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleFormulaCommit(ref, formulaInput);
                            const nextRef = cellId(r + 1, row.indexOf(ref));
                            setActiveCell(nextRef);
                          }
                        }}
                        onBlur={() => handleFormulaCommit(ref, formulaInput)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
