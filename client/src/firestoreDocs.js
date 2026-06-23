import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { compressContent, decompressContent } from './compress';

const COLLECTION = 'documents';

const DEFAULT_CONTENT = {
  doc: { html: '<h1>Documento sin título</h1><p></p>' },
  sheet: { cells: {}, rows: 30, cols: 12 },
  slide: { slides: [{ id: 'slide-1', elements: [], background: '#ffffff' }] },
  pdf: { mode: 'create', pages: [{ text: '' }], sourceFile: null, annotations: {} },
};

const TYPE_LABEL = { doc: 'Documento', sheet: 'Hoja de cálculo', slide: 'Presentación', pdf: 'PDF' };

function toMillis(value) {
  if (!value) return Date.now();
  if (value instanceof Timestamp) return value.toMillis();
  return value;
}

function readContent(data) {
  if (data.contentGz) return decompressContent(data.contentGz);
  return data.content || {};
}

export function watchDocuments(uid, type, callback) {
  const base = collection(db, COLLECTION);
  const q = type
    ? query(base, where('ownerId', '==', uid), where('type', '==', type), orderBy('updatedAt', 'desc'))
    : query(base, where('ownerId', '==', uid), orderBy('updatedAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const documents = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        title: data.title,
        created_at: toMillis(data.createdAt),
        updated_at: toMillis(data.updatedAt),
      };
    });
    callback(documents);
  });
}

export async function getDocument(id) {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Documento no encontrado');
  const data = snap.data();
  return {
    id: snap.id,
    owner_id: data.ownerId,
    type: data.type,
    title: data.title,
    content: readContent(data),
    created_at: toMillis(data.createdAt),
    updated_at: toMillis(data.updatedAt),
  };
}

export async function createDocument(uid, type, title) {
  const docTitle = title || `${TYPE_LABEL[type]} sin título`;
  const content = DEFAULT_CONTENT[type];
  const ref = await addDoc(collection(db, COLLECTION), {
    ownerId: uid,
    type,
    title: docTitle,
    contentGz: compressContent(content),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, type, title: docTitle, content };
}

export async function updateDocument(id, { title, content }) {
  const ref = doc(db, COLLECTION, id);
  const patch = { updatedAt: serverTimestamp() };
  if (title !== undefined) patch.title = title;
  if (content !== undefined) patch.contentGz = compressContent(content);
  await updateDoc(ref, patch);
}

export async function deleteDocument(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
