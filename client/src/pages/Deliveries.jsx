import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, ChevronRight, Download, Filter, LoaderCircle, Pencil, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, queryString } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorState, Modal, PageLoader, SecretInput } from "../components/UI";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { notify } from "../notify";
import { dateInputValue, displayDateTime, playTone } from "../utils";
import { deliveryFiltersSchema, editDeliverySchema, numericInput, pinSchema, validateForm } from "../validation";
const initialFilters = { search: "", clientId: "", vehicleId: "", receipt: "", from: "", to: "" };
function Deliveries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const debouncedSearch = useDebouncedValue(filters.search.trim(), 300);
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: () => api("/clients") });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: () => api("/vehicles") });
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", applied, page],
    queryFn: () => api(`/deliveries${queryString({ ...applied, page, pageSize: 25 })}`),
    placeholderData: (previousData) => previousData
  });
  useEffect(() => {
    setPage(1);
    setApplied((current) => current.search === debouncedSearch ? current : { ...current, search: debouncedSearch });
  }, [debouncedSearch]);
  useEffect(() => {
    const lastPage = Math.max(1, deliveriesQuery.data?.pages ?? 1);
    if (page > lastPage) setPage(lastPage);
  }, [deliveriesQuery.data?.pages, page]);
  function applyFilters(event) {
    event.preventDefault();
    const result = validateForm(deliveryFiltersSchema, filters);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    setPage(1);
    setApplied(result.data);
  }
  function clearFilters() {
    setFilters(initialFilters);
    setApplied(initialFilters);
    setPage(1);
  }
  function exportCsv() {
    const rows = deliveriesQuery.data?.deliveries ?? [];
    const header = ["Receipt", "Date", "Delivered To", "Plate", "Trip", "Note", "Entered By Staff"];
    const csv = [
      header,
      ...rows.map((item) => [
        item.receiptNumber,
        displayDateTime(item.deliveryDate),
        item.client.name,
        item.vehicle.plateNumber,
        item.tripNumber,
        item.note ?? "",
        item.createdBy.name
      ])
    ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "routeflow-deliveries.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  if (deliveriesQuery.isLoading) return <PageLoader />;
  if (deliveriesQuery.error) return <ErrorState message={deliveriesQuery.error.message} />;
  const hasFilters = Object.values(applied).some(Boolean);
  const searchPending = filters.search.trim() !== debouncedSearch || deliveriesQuery.isFetching;
  return <div className="page-stack">
      <form className="card filter-panel" onSubmit={applyFilters}>
        <div className="filter-title"><SlidersHorizontal size={18} /><strong>Find deliveries</strong><span>Search any trip in seconds</span></div>
        <div className="filters-grid">
          <label className="search-field">
            {searchPending ? <LoaderCircle className="spin" /> : <Search />}
            <input aria-label="Search delivery history" maxLength={100} placeholder="Client, plate, Staff, receipt, trip, or note..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <select value={filters.clientId} onChange={(event) => setFilters({ ...filters, clientId: event.target.value })}>
            <option value="">All clients</option>
            {clientsQuery.data?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <select value={filters.vehicleId} onChange={(event) => setFilters({ ...filters, vehicleId: event.target.value })}>
            <option value="">All vehicles</option>
            {vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}
          </select>
          <label className="compact-input"><span>#</span><input type="number" min="1" step="1" placeholder="Receipt no." value={filters.receipt} onChange={(event) => setFilters({ ...filters, receipt: event.target.value })} /></label>
          <label className="date-filter"><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="date-filter"><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <button className="secondary-button" type="submit"><Filter size={16} /> Apply filters</button>
        </div>
      </form>

      <section className="card data-card">
        <div className="card-head data-head">
          <div>
            <span className="eyebrow">All records</span>
            <h3>{deliveriesQuery.data?.total.toLocaleString()} deliveries</h3>
            <p>See who received each delivery and which Staff member entered it.</p>
          </div>
          <div className="head-actions">
            {hasFilters && <button type="button" className="ghost-button" onClick={clearFilters}>Clear filters</button>}
            <button type="button" className="secondary-button" onClick={exportCsv} disabled={!deliveriesQuery.data?.deliveries.length}><Download size={16} /> Export CSV</button>
          </div>
        </div>

        {!deliveriesQuery.data?.deliveries.length ? <EmptyState icon={<CalendarRange />} title="No deliveries found" message="Try changing your filters or add a new delivery." /> : <>
            <div className="table-scroll">
              <table className="delivery-table">
                <thead><tr><th>Receipt</th><th>Date & time</th><th>Delivered to</th><th>Plate</th><th>Trip</th><th>Note</th><th>Entered by Staff</th>{user?.role === "ADMIN" && <th />}</tr></thead>
                <tbody>
                  {deliveriesQuery.data.deliveries.map((delivery) => <tr key={delivery.id}>
                      <td><span className="receipt-code">#{delivery.receiptNumber}</span></td>
                      <td>{displayDateTime(delivery.deliveryDate)}</td>
                      <td><strong>{delivery.client.name}</strong></td>
                      <td><span className="plate">{delivery.vehicle.plateNumber}</span></td>
                      <td><span className="trip-pill">Trip {delivery.tripNumber}</span></td>
                      <td className="note-cell">{delivery.note || <span className="muted">No note</span>}</td>
                      <td>{delivery.createdBy.name}</td>
                      {user?.role === "ADMIN" && <td><div className="row-actions">
                          <button title="Edit" onClick={() => setEditing(delivery)}><Pencil size={16} /></button>
                          <button title="Delete" className="danger" onClick={() => setDeleting(delivery)}><Trash2 size={16} /></button>
                        </div></td>}
                    </tr>)}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Page {page} of {Math.max(1, deliveriesQuery.data.pages)}</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button>
                <button type="button" disabled={page >= deliveriesQuery.data.pages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button>
              </div>
            </div>
          </>}
      </section>

      <EditDeliveryModal delivery={editing} clients={clientsQuery.data?.clients ?? []} onClose={() => setEditing(null)} onSaved={() => {
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }} />
      <DeleteDeliveryModal delivery={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }} />
    </div>;
}
function EditDeliveryModal({ delivery, clients, onClose, onSaved }) {
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: (data) => api(`/deliveries/${delivery.id}`, { method: "PATCH", body: { ...data, deliveryDate: new Date(data.deliveryDate).toISOString() } }),
    onSuccess: () => {
      notify.success("Delivery updated");
      onSaved();
    },
    onError: (error) => notify.error(error.message)
  });
  useEffect(() => {
    if (!delivery) return;
    setClientId(delivery.clientId);
    setDate(dateInputValue(new Date(delivery.deliveryDate)));
    setNote(delivery.note ?? "");
  }, [delivery]);
  return <Modal open={Boolean(delivery)} title={`Edit receipt #${delivery?.receiptNumber ?? ""}`} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => {
    event.preventDefault();
    const result = validateForm(editDeliverySchema, { clientId, deliveryDate: date, note });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }}>
        <label className="field"><span>Date & time</span><input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="field"><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label className="field"><span>Note</span><textarea rows={4} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={mutation.isPending}>Save changes</button></div>
      </form>
    </Modal>;
}
function DeleteDeliveryModal({ delivery, onClose, onDeleted }) {
  const [pin, setPin] = useState("");
  const mutation = useMutation({
    mutationFn: (validPin) => api(`/deliveries/${delivery.id}`, { method: "DELETE", body: { pin: validPin } }),
    onSuccess: () => {
      notify.success("Delivery deleted and logged");
      onDeleted();
      setPin("");
    },
    onError: (error) => {
      playTone("warning");
      notify.error(error.message);
    }
  });
  return <Modal open={Boolean(delivery)} title="Confirm secure deletion" onClose={onClose}>
      <div className="delete-warning"><Trash2 /><div><strong>This action cannot be undone</strong><p>Receipt #{delivery?.receiptNumber} will be permanently removed. The deletion remains visible in the activity log.</p></div></div>
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
        <div className="modal-actions"><button type="button" className="ghost-button" onClick={onClose}>Keep delivery</button><button className="danger-button" disabled={mutation.isPending || pin.length < 4}>Delete permanently</button></div>
      </form>
    </Modal>;
}
export {
  Deliveries
};
