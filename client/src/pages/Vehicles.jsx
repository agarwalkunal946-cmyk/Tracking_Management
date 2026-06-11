import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Hash, Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState, Modal, PageLoader, SecretInput, StatusPill } from "../components/UI";
import { notify } from "../notify";
import { numericInput, pinSchema, validateForm, vehicleFormSchema } from "../validation";
const blank = { plateNumber: "", label: "", tripCounter: 0, receiptCounter: 0, active: true };
function Vehicles() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const query = useQuery({ queryKey: ["vehicles", "all"], queryFn: () => api("/vehicles?all=true") });
  const vehicles = useMemo(() => (query.data?.vehicles ?? []).filter((vehicle) => `${vehicle.plateNumber} ${vehicle.label}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  if (query.isLoading) return <PageLoader />;
  return <div className="page-stack">
      <section className="management-hero">
        <div><span className="eyebrow">Fleet directory</span><h2>{query.data?.vehicles.length ?? 0} vehicles under management</h2><p>Each vehicle keeps independent trip and receipt counters.</p></div>
        <button className="primary-button" onClick={() => {
    setEditing(null);
    setModalOpen(true);
  }}><Plus size={17} /> Add vehicle</button>
      </section>
      <section className="card data-card">
        <div className="card-head data-head"><label className="search-field management-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plate or vehicle..." /></label></div>
        {!vehicles.length ? <EmptyState icon={<Truck />} title="No vehicles found" message="Add a vehicle and set its starting counters." /> : <div className="entity-grid">
            {vehicles.map((vehicle) => <article className="entity-card vehicle-card" key={vehicle.id}>
                <div className="entity-top"><div className="vehicle-icon"><Truck /></div><StatusPill active={vehicle.active} /><div className="entity-actions">
                    <button className="icon-button" title="Edit vehicle" onClick={() => {
    setEditing(vehicle);
    setModalOpen(true);
  }}><Pencil size={15} /></button>
                    <button className="icon-button danger" title="Delete vehicle" onClick={() => setDeleting(vehicle)}><Trash2 size={15} /></button>
                  </div></div>
                <span className="vehicle-plate">{vehicle.plateNumber}</span>
                <p>{vehicle.label || "Delivery vehicle"}</p>
                <div className="vehicle-counters">
                  <div><Gauge /><span>Trip counter<strong>{vehicle.tripCounter}</strong></span></div>
                  <div><Hash /><span>Receipt counter<strong>{vehicle.receiptCounter}</strong></span></div>
                </div>
                <div className="entity-stat"><span>Recorded deliveries</span><strong>{vehicle._count?.deliveries ?? 0}</strong></div>
              </article>)}
          </div>}
      </section>
      <VehicleModal open={modalOpen} vehicle={editing} onClose={() => setModalOpen(false)} onSaved={() => {
    setModalOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }} />
      <DeleteVehicleModal vehicle={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }} />
    </div>;
}
function VehicleModal({ open, vehicle, onClose, onSaved }) {
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setForm(vehicle ? {
      plateNumber: vehicle.plateNumber,
      label: vehicle.label ?? "",
      tripCounter: vehicle.tripCounter,
      receiptCounter: vehicle.receiptCounter,
      active: vehicle.active
    } : blank);
  }, [open, vehicle]);
  const mutation = useMutation({
    mutationFn: (data) => api(vehicle ? `/vehicles/${vehicle.id}` : "/vehicles", { method: vehicle ? "PATCH" : "POST", body: data }),
    onSuccess: () => {
      notify.success(vehicle ? "Vehicle updated" : "Vehicle added");
      onSaved();
    },
    onError: (error) => notify.error(error.message)
  });
  function submit(event) {
    event.preventDefault();
    const result = validateForm(vehicleFormSchema, form);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }
  return <Modal open={open} title={vehicle ? "Edit vehicle" : "Add a vehicle"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="field"><span>Plate number</span><input minLength={2} maxLength={30} value={form.plateNumber} onChange={(event) => setForm({ ...form, plateNumber: event.target.value.toUpperCase() })} placeholder="Enter plate number" required /></label>
        <label className="field"><span>Vehicle label</span><input maxLength={80} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Vehicle type or name" /></label>
        <div className="form-row">
          <label className="field"><span>{vehicle ? "Trip counter" : "Starting trip no."}</span><input type="number" min="0" step="1" value={form.tripCounter} onChange={(event) => setForm({ ...form, tripCounter: event.target.value === "" ? 0 : Number(event.target.value) })} required /></label>
          <label className="field"><span>{vehicle ? "Receipt counter" : "Starting receipt no."}</span><input type="number" min="0" step="1" value={form.receiptCounter} onChange={(event) => setForm({ ...form, receiptCounter: event.target.value === "" ? 0 : Number(event.target.value) })} required /></label>
        </div>
        <p className="form-hint">The next entry will use counter + 1. Existing receipt numbers remain protected by the database.</p>
        {vehicle && <label className="toggle-row"><div><strong>Active vehicle</strong><span>Available for new deliveries</span></div><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /></label>}
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={mutation.isPending}>Save vehicle</button></div>
      </form>
    </Modal>;
}
function DeleteVehicleModal({ vehicle, onClose, onDeleted }) {
  const [pin, setPin] = useState("");
  const mutation = useMutation({
    mutationFn: (validPin) => api(`/vehicles/${vehicle.id}`, { method: "DELETE", body: { pin: validPin } }),
    onSuccess: () => {
      notify.success("Vehicle deleted");
      setPin("");
      onDeleted();
    },
    onError: (error) => notify.error(error.message)
  });
  useEffect(() => {
    if (!vehicle) setPin("");
  }, [vehicle]);
  return <Modal open={Boolean(vehicle)} title="Delete vehicle?" onClose={onClose}>
      <div className="delete-warning"><Trash2 /><div><strong>This action cannot be undone</strong><p>{vehicle?.plateNumber} can only be deleted when it has no delivery history. Otherwise, deactivate it from Edit vehicle.</p></div></div>
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
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Keep vehicle</button><button className="danger-button" disabled={mutation.isPending || pin.length < 4}>{mutation.isPending ? "Deleting..." : "Delete vehicle"}</button></div>
      </form>
    </Modal>;
}
export {
  Vehicles
};
