import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { PageLoader } from "./components/UI";
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const NewDelivery = lazy(() => import("./pages/NewDelivery").then((module) => ({ default: module.NewDelivery })));
const Deliveries = lazy(() => import("./pages/Deliveries").then((module) => ({ default: module.Deliveries })));
const Reports = lazy(() => import("./pages/Reports").then((module) => ({ default: module.Reports })));
const Clients = lazy(() => import("./pages/Clients").then((module) => ({ default: module.Clients })));
const Vehicles = lazy(() => import("./pages/Vehicles").then((module) => ({ default: module.Vehicles })));
const Users = lazy(() => import("./pages/Users").then((module) => ({ default: module.Users })));
const Activity = lazy(() => import("./pages/Activity").then((module) => ({ default: module.Activity })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
function App() {
  const { user } = useAuth();
  return <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Dashboard />} />
          <Route path="deliveries/new" element={<NewDelivery />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="reports" element={<Reports />} />
          <Route path="clients" element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="vehicles" element={<AdminRoute><Vehicles /></AdminRoute>} />
          <Route path="staff" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="users" element={<Navigate to="/staff" replace />} />
          <Route path="activity" element={<AdminRoute><Activity /></AdminRoute>} />
          <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Suspense>;
}
function AdminRoute({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? children : <Navigate to="/" replace />;
}
export {
  App
};
