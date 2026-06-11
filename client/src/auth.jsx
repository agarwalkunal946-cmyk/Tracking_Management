import { createContext, useContext, useMemo, useState } from "react";
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
  const [user, setUser] = useState(storedUser);
  const value = useMemo(() => ({
    user,
    login: async (email, password) => {
      const response = await api("/auth/login", {
        method: "POST",
        body: { email, password }
      });
      localStorage.setItem("routeflow_token", response.token);
      localStorage.setItem("routeflow_user", JSON.stringify(response.user));
      setUser(response.user);
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
  }), [user]);
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
