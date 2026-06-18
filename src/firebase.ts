import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';

// Hardcoded config based on generated firebase-applet-config.json for instant premium experience
const firebaseConfig = {
  projectId: "gen-lang-client-0772569610",
  appId: "1:637772471412:web:496cc86493ac5970d48521",
  apiKey: "AIzaSyBvweAHBrF8IyHkE1yEOHpwglzLR0kLszk",
  authDomain: "gen-lang-client-0772569610.firebaseapp.com",
  databaseId: "ai-studio-0879152c-7950-444b-8d56-a6101e946040",
  storageBucket: "gen-lang-client-0772569610.firebasestorage.app",
  messagingSenderId: "637772471412"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore targeting the specific databaseId set by AI Studio
export const db = getFirestore(app, "ai-studio-0879152c-7950-444b-8d56-a6101e946040");
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Generic functions to simplify Firestore integration for each of our models
 */
export async function getCollectionData<T>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    })) as T[];
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, collectionName);
    return [];
  }
}

export async function addCollectionDocument<T extends Record<string, any>>(
  collectionName: string, 
  data: T
): Promise<string> {
  try {
    const colRef = collection(db, collectionName);
    const { id, ...cleanedData } = data; // separate the ID
    const docRef = await addDoc(colRef, cleanedData);
    // Also save the generated ID inside the document itself for consistency
    await setDoc(docRef, { ...cleanedData, id: docRef.id }, { merge: true });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, collectionName);
    throw err;
  }
}

export async function setCollectionDocument<T extends { id: string }>(
  collectionName: string, 
  id: string, 
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    const { id: _, ...cleanedData } = data;
    await setDoc(docRef, { ...cleanedData, id }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${id}`);
    throw err;
  }
}

export async function updateCollectionDocument<T>(
  collectionName: string, 
  id: string, 
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data as any);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    throw err;
  }
}

export async function deleteCollectionDocument(
  collectionName: string, 
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    throw err;
  }
}
