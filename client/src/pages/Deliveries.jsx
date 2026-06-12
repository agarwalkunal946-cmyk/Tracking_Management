import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Download, Droplets, Filter, LoaderCircle, PackageCheck, Pencil, ReceiptText, RotateCcw, Search, SlidersHorizontal, Trash2, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { api, queryString } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorState, Modal, PageLoader, SecretInput } from "../components/UI";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { notify } from "../notify";
import { dateInputValue, displayDateTime, playTone } from "../utils";
import { deliveryFiltersSchema, editDeliverySchema, numericInput, pinSchema, validateForm } from "../validation";
const initialFilters = { search: "", clientId: "", vehicleId: "", driverName: "", staffName: "", receipt: "", from: "", to: "" };
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
  const filterOptionsQuery = useQuery({ queryKey: ["delivery-filter-options"], queryFn: () => api("/deliveries/filter-options") });
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
    const header = ["Receipt", "Date", "Delivered To", "Plate", "Trip", "Serial", "Liters", "Amount", "Balance", "Driver", "Staff", "Note", "Entered By Staff"];
    const csv = [
      header,
      ...rows.map((item) => [
        item.receiptNumber,
        displayDateTime(item.deliveryDate),
        item.client.name,
        item.vehicle.plateNumber,
        item.tripNumber,
        item.receiptSerialNo ?? "",
        item.itemSize ?? "",
        item.amount ?? "",
        item.balance ?? "",
        item.driverName ?? "",
        item.staffName ?? "",
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
  const hasDraftFilters = Object.values(filters).some(Boolean);
  const searchPending = filters.search.trim() !== debouncedSearch || deliveriesQuery.isFetching;
  const summary = deliveriesQuery.data?.summary ?? {};
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
            <option value="">All plates</option>
            {vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}
          </select>
          <select value={filters.driverName} onChange={(event) => setFilters({ ...filters, driverName: event.target.value })}>
            <option value="">All drivers</option>
            {filterOptionsQuery.data?.drivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
          </select>
          <select value={filters.staffName} onChange={(event) => setFilters({ ...filters, staffName: event.target.value })}>
            <option value="">All staff</option>
            {filterOptionsQuery.data?.staff.map((staff) => <option key={staff} value={staff}>{staff}</option>)}
          </select>
          <label className="compact-input"><span>#</span><input inputMode="numeric" maxLength={30} placeholder="Receipt no." value={filters.receipt} onChange={(event) => setFilters({ ...filters, receipt: event.target.value.replace(/\D/g, "") })} /></label>
          <label className="date-filter"><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label className="date-filter"><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <button className="secondary-button" type="submit"><Filter size={16} /> Apply filters</button>
          <button className="ghost-button" type="button" onClick={clearFilters} disabled={!hasDraftFilters && !hasFilters}><RotateCcw size={16} /> Reset</button>
        </div>
      </form>

      <section className="stats-grid delivery-summary-grid">
        <SummaryCard icon={<PackageCheck />} label="Filtered trips" value={summary.totalTrips ?? 0} note={hasFilters ? "Matching records" : "All records"} accent="coral" />
        <SummaryCard icon={<Droplets />} label="Total liters" value={`${formatNumber(summary.totalLiters)} L`} note="Filtered volume" accent="blue" />
        <SummaryCard icon={<ReceiptText />} label="Total billed" value={formatMoney(summary.totalAmount)} note="Filtered amount" accent="gold" />
        <SummaryCard icon={<CheckCircle2 />} label="Amount paid" value={formatMoney(summary.amountPaid)} note="Billed minus balance" accent="mint" />
        <SummaryCard icon={<WalletCards />} label="Balance" value={formatMoney(summary.totalBalance)} note="Outstanding" accent="dark" />
      </section>

      <section className="card data-card">
        <div className="card-head data-head">
          <div>
            <span className="eyebrow">All records</span>
            <h3>{deliveriesQuery.data?.total.toLocaleString()} deliveries</h3>
            <p>See who received each delivery and which Staff member entered it.</p>
          </div>
          <div className="head-actions">
            {hasFilters && <button type="button" className="ghost-button" onClick={clearFilters}>Reset filters</button>}
            <button type="button" className="secondary-button" onClick={exportCsv} disabled={!deliveriesQuery.data?.deliveries.length}><Download size={16} /> Export CSV</button>
          </div>
        </div>

        {!deliveriesQuery.data?.deliveries.length ? <EmptyState icon={<CalendarRange />} title="No deliveries found" message="Try changing your filters or add a new delivery." /> : <>
            <div className="table-scroll">
              <table className="delivery-table">
                <thead><tr><th>Receipt</th><th>Date & time</th><th>Delivered to</th><th>Plate</th><th>Trip</th><th>Serial</th><th>Liters</th><th>Amount</th><th>Balance</th><th>Driver</th><th>Staff</th><th>Note</th><th>Entered by Staff</th>{user?.role === "ADMIN" && <th />}</tr></thead>
                <tbody>
                  {deliveriesQuery.data.deliveries.map((delivery) => <tr key={delivery.id}>
                      <td><span className="receipt-code">#{delivery.receiptNumber}</span></td>
                      <td>{displayDateTime(delivery.deliveryDate)}</td>
                      <td><strong>{delivery.client?.name ?? "Deleted client"}</strong></td>
                      <td><span className="plate">{delivery.vehicle?.plateNumber ?? "Deleted vehicle"}</span></td>
                      <td><span className="trip-pill">Trip {delivery.tripNumber}</span></td>
                      <td>{delivery.receiptSerialNo || <span className="muted">-</span>}</td>
                      <td>{delivery.itemSize ? `${Number(delivery.itemSize).toLocaleString()} L` : <span className="muted">-</span>}</td>
                      <td>{delivery.amount !== undefined ? `KES ${Number(delivery.amount || 0).toLocaleString()}` : <span className="muted">-</span>}</td>
                      <td>{delivery.balance !== undefined ? `KES ${Number(delivery.balance || 0).toLocaleString()}` : <span className="muted">-</span>}</td>
                      <td>{delivery.driverName || <span className="muted">-</span>}</td>
                      <td>{delivery.staffName || <span className="muted">-</span>}</td>
                      <td className="note-cell">{delivery.note || <span className="muted">No note</span>}</td>
                      <td>{delivery.createdBy?.name ?? "Deleted user"}</td>
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
  const [driverName, setDriverName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [balance, setBalance] = useState("");
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
    setDriverName(delivery.driverName ?? "");
    setStaffName(delivery.staffName ?? "");
    setBalance(String(delivery.balance ?? ""));
  }, [delivery]);
  return <Modal open={Boolean(delivery)} title={`Edit receipt #${delivery?.receiptNumber ?? ""}`} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => {
    event.preventDefault();
    const result = validateForm(editDeliverySchema, { clientId, deliveryDate: date, note, driverName, staffName, balance: balance === "" ? NaN : Number(balance) });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    mutation.mutate(result.data);
  }}>
        <label className="field"><span>Date & time</span><input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="field"><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <div className="form-row"><label className="field"><span>Driver</span><input value={driverName} onChange={(event) => setDriverName(event.target.value)} required /></label><label className="field"><span>Staff</span><input value={staffName} onChange={(event) => setStaffName(event.target.value)} required /></label></div>
        <label className="field"><span>Balance (KES)</span><input type="number" min="0" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} required /></label>
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
function SummaryCard({ icon, label, value, note, accent }) {
  return <div className="stat-card">
      <div className={`stat-icon ${accent}`}>{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </div>;
}
function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}
function formatMoney(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}
export {
  Deliveries
};
