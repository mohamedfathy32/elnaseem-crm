import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user role from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      setUserRole(userData.role);
      
      // Check if user is disabled
      if (userData.disabled) {
        await signOut(auth);
        throw new Error('تم تعطيل حسابك. يرجى التواصل مع المدير.');
      }
      
      // Update login tracking
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastLogin = userData.lastLogin ? new Date(userData.lastLogin) : null;
      
      // Reset login count if it's a new month
      const loginCount = (lastLogin && lastLogin >= currentMonthStart) 
        ? (userData.loginCount || 0) 
        : 0;
      
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: now.toISOString(),
        loginCount: loginCount + 1
      });
    }
    
    return userCredential;
  }

  async function signup(email, password, role, name) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save user data with role
    await setDoc(doc(db, 'users', user.uid), {
      email,
      role,
      name,
      createdAt: new Date().toISOString()
    });
    
    setUserRole(role);
    return userCredential;
  }

  function logout() {
    setUserRole(null);
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
