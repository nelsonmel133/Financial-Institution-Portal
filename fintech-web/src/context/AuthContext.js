"use client";

/**
 * src/context/AuthContext.js
 *
 * Wraps Firebase Authentication (email/password) and exposes the
 * current user + auth actions to the rest of the app.
 *
 *  - `user` is `undefined` while the initial auth state is resolving,
 *    `null` when signed out, and a Firebase User object when signed in.
 *  - `login` / `signup` / `logout` throw on failure with a readable
 *    `.message` so calling UI can surface it directly.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext(undefined);

const FRIENDLY_ERRORS = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error — check your connection and try again.",
};

function friendlyMessage(error) {
  return FRIENDLY_ERRORS[error?.code] || error?.message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  // undefined = still resolving initial state, null = signed out
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    } catch (err) {
      throw new Error(friendlyMessage(err));
    }
  }, []);

  const signup = useCallback(async (email, password, displayName) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      return cred.user;
    } catch (err) {
      throw new Error(friendlyMessage(err));
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(friendlyMessage(err));
    }
  }, []);

  const value = {
    user,
    loading: user === undefined,
    login,
    signup,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
