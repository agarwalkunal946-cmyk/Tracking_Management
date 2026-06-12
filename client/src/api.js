const API_URL = import.meta.env.VITE_API_URL ?? "/api";
class ApiError extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
async function api(path, options = {}) {
  const token = localStorage.getItem("routeflow_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...token ? { Authorization: `Bearer ${token}` } : {},
      ...options.headers
    },
    body: options.body === void 0 ? void 0 : JSON.stringify(options.body)
  });
  if (response.status === 204) return void 0;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("routeflow_token");
      localStorage.removeItem("routeflow_user");
      window.dispatchEvent(new Event("routeflow:unauthorized"));
    }
    throw new ApiError(data.message ?? "Request failed.", response.status);
  }
  return data;
}
function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== void 0 && value !== "") params.set(key, String(value));
  });
  const result = params.toString();
  return result ? `?${result}` : "";
}
export {
  ApiError,
  api,
  queryString
};
