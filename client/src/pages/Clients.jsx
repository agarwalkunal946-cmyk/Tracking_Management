import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState, Modal, PageLoader, SecretInput, StatusPill } from "../components/UI";
import { notify } from "../notify";
import { clientFormSchema, numericInput, pinSchema, validateForm } from "../validation";
const blank = { name: "", phone: "", email: "", address: "", active: true };
function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const query = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => api("/clients?all=true")
  });
  const clients = useMemo(() => (query.data?.clients ?? []).filter((client) => client.name.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  if (query.isLoading) return <PageLoader />;
  return <div className="page-stack">
      <section className="management-hero">
        <div><span className="eyebrow">Client directory</span><h2>{query.data?.clients.length ?? 0} delivery recipients</h2><p>Clients are the companies or people who receive your deliveries.</p></div>
        <button className="primary-button" onClick={() => {
    setEditing(null);
    setModalOpen(true);
  }}><Plus size={17} /> Add client</button>
      </section>
      <section className="card data-card">
        <div className="card-head data-head">
          <label className="search-field management-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients..." /></label>
        </div>
        {!clients.length ? <EmptyState icon={<UsersRound />} title="No clients found" message="Add your first client to start recording deliveries." /> : <div className="entity-grid">
            {clients.map((client) => <article className="entity-card" key={client.id}>
                <div className="entity-top">
                  <div className="client-logo">{client.name.slice(0, 2).toUpperCase()}</div>
                  <StatusPill active={client.active} />
                  <div className="entity-actions">
                    <button className="icon-button" title="Edit client" onClick={() => {
    setEditing(client);
    setModalOpen(true);
  }}><Pencil size={15} /></button>
                    <button className="icon-button danger" title="Delete client" onClick={() => setDeleting(client)}><Trash2 size={15} /></button>
                  </div>
                </div>
                <h3>{client.name}</h3>
                <div className="entity-meta">
                  <span><Phone /> {client.phone || "No phone"}</span>
                  <span><Mail /> {client.email || "No email"}</span>
                  <span><MapPin /> {client.address || "No address"}</span>
                </div>
                <div className="entity-stat"><span>Lifetime trips</span><strong>{client._count?.deliveries ?? 0}</strong></div>
              </article>)}
          </div>}
      </section>
      <ClientModal open={modalOpen} client={editing} onClose={() => setModalOpen(false)} onSaved={() => {
    setModalOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
  }} />
      <DeleteClientModal client={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }} />
    </div>;
}
function ClientModal({ open, client, onClose, onSaved }) {
  const [form, setForm] = useState(blank);
  const mutation = useMutation({
    mutationFn: (data) => api(client ? `/clients/${client.id}` : "/clients", { method: client ? "PATCH" : "POST", body: data }),
    onSuccess: () => {
      notify.success(client ? "Client updated" : "Client added");
      onSaved();
      setForm(blank);
    },
    onError: (error) => notify.error(error.message)
  });
  useEffect(() => {
    if (!open) return;
    setForm(client ? {
      name: client.name,
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      active: client.active
    } : blank);
  }, [client, open]);
  function submit(event) {
    event.preventDefault();
    const result = validateForm(clientFormSchema, form);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }
  return <Modal open={open} title={client ? "Edit client" : "Add a new client"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field"><span>Client name</span><input minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <div className="form-row"><label className="field"><span>Phone</span><input type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="+254 712 345 678" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="field"><span>Email</span><input type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
        <label className="field"><span>Address</span><input maxLength={250} autoComplete="street-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        {client && <label className="toggle-row"><div><strong>Active client</strong><span>Available in delivery entry</span></div><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /></label>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save client"}</button></div>
      </form>
    </Modal>;
}
function DeleteClientModal({ client, onClose, onDeleted }) {
  const [pin, setPin] = useState("");
  const mutation = useMutation({
    mutationFn: (validPin) => api(`/clients/${client.id}`, { method: "DELETE", body: { pin: validPin } }),
    onSuccess: () => {
      notify.success("Client deleted");
      setPin("");
      onDeleted();
    },
    onError: (error) => notify.error(error.message)
  });
  useEffect(() => {
    if (!client) setPin("");
  }, [client]);
  return <Modal open={Boolean(client)} title="Delete client?" onClose={onClose}>
      <div className="delete-warning"><Trash2 /><div><strong>This action cannot be undone</strong><p>{client?.name} can only be deleted when it has no delivery history. Otherwise, deactivate it from Edit client.</p></div></div>
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
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Keep client</button><button className="danger-button" disabled={mutation.isPending || pin.length < 4}>{mutation.isPending ? "Deleting..." : "Delete client"}</button></div>
      </form>
    </Modal>;
}
export {
  Clients
};
