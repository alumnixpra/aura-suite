import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { watchDocuments, createDocument, deleteDocument } from '../firestoreDocs';
import { useAuth } from '../AuthContext';

const TYPE_META = {
  doc: { label: 'Documento', icon: '📄', color: '#4285f4', path: 'docs', create: 'Documento nuevo' },
  sheet: { label: 'Hoja de cálculo', icon: '📊', color: '#0f9d58', path: 'sheets', create: 'Hoja nueva' },
  slide: { label: 'Presentación', icon: '📑', color: '#f4b400', path: 'slides', create: 'Presentación nueva' },
  pdf: { label: 'PDF', icon: '🧾', color: '#db4437', path: 'pdf', create: 'PDF nuevo' },
};

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = watchDocuments(user.id, null, (docs) => {
      setDocuments(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function createDoc(type) {
    const created = await createDocument(user.id, type);
    navigate(`/${TYPE_META[type].path}/${created.id}`);
  }

  async function deleteDoc(id, e) {
    e.stopPropagation();
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    await deleteDocument(id);
  }

  function openDoc(doc) {
    navigate(`/${TYPE_META[doc.type].path}/${doc.id}`);
  }

  const filtered = filter === 'all' ? documents : documents.filter((d) => d.type === filter);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="aura-logo">
          <span className="aura-logo-mark">A</span>
          <span className="aura-logo-text">Aura Suite</span>
        </div>
        <div className="dashboard-user">
          <span>{user?.name}</span>
          <button className="btn-ghost" onClick={logout}>Salir</button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="create-row">
          {Object.entries(TYPE_META).map(([type, meta]) => (
            <button key={type} className="create-card" style={{ borderColor: meta.color }} onClick={() => createDoc(type)}>
              <span className="create-icon" style={{ background: meta.color }}>{meta.icon}</span>
              <span>{meta.create}</span>
            </button>
          ))}
        </section>

        <section className="filter-row">
          <button className={filter === 'all' ? 'chip active' : 'chip'} onClick={() => setFilter('all')}>Todos</button>
          {Object.entries(TYPE_META).map(([type, meta]) => (
            <button key={type} className={filter === type ? 'chip active' : 'chip'} onClick={() => setFilter(type)}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </section>

        {loading ? (
          <p className="empty-state">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">No tienes documentos aquí todavía. Crea uno arriba ✨</p>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Última edición</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} onClick={() => openDoc(doc)}>
                  <td>
                    <span className="doc-icon" style={{ background: TYPE_META[doc.type].color }}>
                      {TYPE_META[doc.type].icon}
                    </span>
                    {doc.title}
                  </td>
                  <td>{TYPE_META[doc.type].label}</td>
                  <td>{new Date(doc.updated_at).toLocaleString()}</td>
                  <td>
                    <button className="btn-ghost danger" onClick={(e) => deleteDoc(doc.id, e)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
