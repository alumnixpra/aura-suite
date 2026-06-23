import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Ese email ya está registrado',
  'auth/invalid-email': 'Email inválido',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
  'auth/user-not-found': 'Email o contraseña incorrectos',
  'auth/wrong-password': 'Email o contraseña incorrectos',
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/too-many-requests': 'Demasiados intentos, espera un momento',
};

function firebaseErrorMessage(code) {
  return ERROR_MESSAGES[code] || 'Algo salió mal';
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/');
    } catch (err) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="aura-logo-mark">A</span>
          <span className="aura-logo-text">Aura Suite</span>
        </div>
        <h1>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Accede a tus documentos, hojas, presentaciones y PDFs.' : 'Empieza a crear en segundos.'}
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tu nombre" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>
        <button className="auth-switch" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}
