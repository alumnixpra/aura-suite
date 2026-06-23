import { deflate, inflate } from 'pako';

// Comprime el contenido del documento a un string base64 gzip para minimizar
// el espacio usado en Firestore (cuota gratuita limitada).
export function compressContent(content) {
  const json = JSON.stringify(content);
  const compressed = deflate(json);
  let binary = '';
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]);
  return btoa(binary);
}

export function decompressContent(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = inflate(bytes, { to: 'string' });
  return JSON.parse(json);
}
