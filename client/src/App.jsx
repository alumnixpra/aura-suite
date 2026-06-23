import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DocEditor from './pages/DocEditor';
import SheetEditor from './pages/SheetEditor';
import SlideEditor from './pages/SlideEditor';
import PdfEditor from './pages/PdfEditor';
import './aura.css';

function PrivateRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading-screen">Cargando...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/docs/:id" element={<PrivateRoute><DocEditor /></PrivateRoute>} />
      <Route path="/sheets/:id" element={<PrivateRoute><SheetEditor /></PrivateRoute>} />
      <Route path="/slides/:id" element={<PrivateRoute><SlideEditor /></PrivateRoute>} />
      <Route path="/pdf/:id" element={<PrivateRoute><PdfEditor /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
