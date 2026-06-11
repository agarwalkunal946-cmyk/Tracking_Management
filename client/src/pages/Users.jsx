import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, UserCog, UsersRound } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { EmptyState, Modal, PageLoader, SecretInput, StatusPill } from "../components/UI";
import { notify } from "../notify";
import { displayDate, shortName } from "../utils";
import { numericInput, pinSchema, staffFormSchema, validateForm } from "../validation";
function Users() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const query = useQuery({ queryKey: ["users"], queryFn: () => api("/admin/users") });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api(`/admin/users/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      notify.success("Staff access updated");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => notify.error(error.message)
  });
  if (query.isLoading) return <PageLoader />;
  return <div className="page-stack">
      <section className="management-hero">
        <div><span className="eyebrow">Delivery team</span><h2>Manage Staff accounts</h2><p>Staff can add deliveries, view records, and run reports.</p></div>
        <button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={17} /> Add Staff</button>
      </section>
      <section className="card data-card">
        {!query.data?.users.length ? <EmptyState icon={<UsersRound />} title="No Staff accounts" message="Create an account for your delivery team." /> : <div className="user-list">
            {query.data.users.map((user) => <article className="user-row" key={user.id}>
                <span className="avatar large-avatar">{shortName(user.name)}</span>
                <div className="user-main"><strong>{user.name}</strong><span>{user.email}</span></div>
                <span className="role-badge staff"><UserCog /> Staff</span>
                <span className="joined">Joined {displayDate(user.createdAt)}</span>
                <StatusPill active={Boolean(user.active)} />
                <div className="user-actions">
                  <button className={user.active ? "ghost-button" : "secondary-button"} onClick={() => updateMutation.mutate({ id: user.id, data: { active: !user.active } })}>{user.active ? "Deactivate" : "Activate"}</button>
                  <button className="icon-button danger" title="Delete Staff account" onClick={() => setDeleting(user)}><Trash2 size={15} /></button>
                </div>
              </article>)}
          </div>}
      </section>
      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => {
    setAddOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }} />
      <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }} />
    </div>;
}
function DeleteUserModal({ user, onClose, onDeleted }) {
  const [pin, setPin] = useState("");
  function close() {
    setPin("");
    onClose();
  }
  const mutation = useMutation({
    mutationFn: (validPin) => api(`/admin/users/${user.id}`, { method: "DELETE", body: { pin: validPin } }),
    onSuccess: () => {
      notify.success("Staff account deleted");
      setPin("");
      onDeleted();
    },
    onError: (error) => notify.error(error.message)
  });
  return <Modal open={Boolean(user)} title="Delete Staff account?" onClose={close}>
      <div className="delete-warning"><Trash2 /><div><strong>This action cannot be undone</strong><p>{user?.name} can only be deleted when the account has no delivery history. Otherwise, deactivate it.</p></div></div>
      <form className="modal-form" onSubmit={(event) => {
    event.preventDefault();
    const result = validateForm(pinSchema, pin);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }}>
        <label className="field"><span>Enter Admin PIN to continue</span><SecretInput inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={12} value={pin} onChange={(event) => setPin(numericInput(event.target.value))} placeholder="••••" autoFocus required /></label>
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={close}>Keep Staff</button><button className="danger-button" disabled={mutation.isPending || pin.length < 4}>{mutation.isPending ? "Deleting..." : "Delete Staff"}</button></div>
      </form>
    </Modal>;
}
function AddUserModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const mutation = useMutation({
    mutationFn: (data) => api("/admin/users", { method: "POST", body: data }),
    onSuccess: () => {
      notify.success("Staff account created");
      setForm({ name: "", email: "", password: "" });
      onSaved();
    },
    onError: (error) => notify.error(error.message)
  });
  function submit(event) {
    event.preventDefault();
    const result = validateForm(staffFormSchema, form);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }
  return <Modal open={open} title="Add Staff member" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field"><span>Full name</span><input minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label className="field"><span>Email address</span><input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label className="field"><span><KeyRound size={14} /> Temporary password</span><SecretInput value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={100} autoComplete="new-password" required /></label>
        <div className="role-explainer"><UserCog /><div><strong>Staff access</strong><p>Can add deliveries, view records, and run reports. Cannot edit, delete, or manage settings.</p></div></div>
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={mutation.isPending}>Create Staff</button></div>
      </form>
    </Modal>;
}
export {
  Users
};
