import { AlertCircle, Eye, EyeOff, LoaderCircle, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
function PageLoader() {
  return <div className="page-loader"><LoaderCircle className="spin" size={30} /><span>Loading your workspace...</span></div>;
}
function EmptyState({ icon, title, message }) {
  return <div className="empty-state">
      <div className="empty-icon">{icon ?? <Search />}</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>;
}
function ErrorState({ message }) {
  return <div className="error-state">
      <AlertCircle size={20} />
      <span>{message ?? "We couldn\u2019t load this information."}</span>
    </div>;
}
function Modal({ open, title, children, onClose, size = "normal" }) {
  return <AnimatePresence>
      {open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
    className={`modal ${size === "wide" ? "modal-wide" : ""}`}
    initial={{ opacity: 0, y: 20, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 12, scale: 0.98 }}
    transition={{ type: "spring", damping: 26, stiffness: 320 }}
    onMouseDown={(event) => event.stopPropagation()}
  >
            <div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X /></button></div>
            {children}
          </motion.div>
        </motion.div>}
    </AnimatePresence>;
}
function StatusPill({ active }) {
  return <span className={`status-pill ${active ? "active" : "inactive"}`}><i />{active ? "Active" : "Inactive"}</span>;
}
function SecretInput(props) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input">
      <input {...props} type={visible ? "text" : "password"} />
      <button
    type="button"
    title={visible ? "Hide value" : "Show value"}
    aria-label={visible ? "Hide value" : "Show value"}
    onClick={() => setVisible((value) => !value)}
  >
        {visible ? <Eye /> : <EyeOff />}
      </button>
    </div>;
}
function SkeletonCards({ count = 4 }) {
  return <div className="stats-grid">{Array.from({ length: count }, (_, index) => <div className="stat-card skeleton-card" key={index} />)}</div>;
}
export {
  EmptyState,
  ErrorState,
  Modal,
  PageLoader,
  SecretInput,
  SkeletonCards,
  StatusPill
};
