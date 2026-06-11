import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./App";
import { AuthProvider } from "./auth";
import "./styles.css";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3e4, retry: 1, refetchOnWindowFocus: false }
  }
});
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            richColors
            closeButton
            expand={false}
            visibleToasts={1}
            position="top-right"
            duration={2800}
            gap={8}
            toastOptions={{
              classNames: {
                toast: "routeflow-toast",
                title: "routeflow-toast-title",
                icon: "routeflow-toast-icon",
                closeButton: "routeflow-toast-close"
              }
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
