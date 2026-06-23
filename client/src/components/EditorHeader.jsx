import { useNavigate } from 'react-router-dom';

export default function EditorHeader({ icon, title, onTitleChange, status, extra }) {
  const navigate = useNavigate();
  return (
    <header className="editor-header">
      <button className="btn-ghost" onClick={() => navigate('/')}>← Drive</button>
      <span className="editor-icon">{icon}</span>
      <input
        className="editor-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <span className="save-status">{status}</span>
      <div className="editor-extra">{extra}</div>
    </header>
  );
}
