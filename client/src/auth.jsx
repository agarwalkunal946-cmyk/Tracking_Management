import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
const AuthContext = createContext(null);
function storedUser() {
  try {
    const value = localStorage.getItem("routeflow_user");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
function AuthProvider({ children }) {
  const initialUser = useMemo(storedUser, []);
  const [user, setUser] = useState(initialUser);
  const [ready, setReady] = useState(!initialUser);
  useEffect(() => {
    const clearSession = () => {
      localStorage.removeItem("routeflow_token");
      localStorage.removeItem("routeflow_user");
      setUser(null);
      setReady(true);
    };
    window.addEventListener("routeflow:unauthorized", clearSession);
    if (initialUser && localStorage.getItem("routeflow_token")) {
      api("/auth/me")
        .then((response) => {
          localStorage.setItem("routeflow_user", JSON.stringify(response.user));
          setUser(response.user);
        })
        .catch(clearSession)
        .finally(() => setReady(true));
    } else {
      clearSession();
    }
    return () => window.removeEventListener("routeflow:unauthorized", clearSession);
  }, [initialUser]);
  const value = useMemo(() => ({
    user,
    ready,
    login: async (email, password) => {
      const response = await api("/auth/login", {
        method: "POST",
        body: { email, password }
      });
      localStorage.setItem("routeflow_token", response.token);
      localStorage.setItem("routeflow_user", JSON.stringify(response.user));
      setUser(response.user);
      setReady(true);
    },
    logout: async () => {
      try {
        await api("/auth/logout", { method: "POST" });
      } finally {
        localStorage.removeItem("routeflow_token");
        localStorage.removeItem("routeflow_user");
        setUser(null);
      }
    }
  }), [ready, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
export {
  AuthProvider,
  useAuth
};
