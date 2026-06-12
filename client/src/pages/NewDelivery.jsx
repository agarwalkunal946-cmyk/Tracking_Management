import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Check, FileText, Hash, Info, Sparkles, Truck, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { notify } from "../notify";
import { dateInputValue, playTone } from "../utils";
import { deliveryFormSchema, validateForm } from "../validation";

function splitDateTime(value = dateInputValue()) {
  const [date, time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function NewDelivery() {
  const queryClient = useQueryClient();
  const initialDate = splitDateTime();
  const [vehicleId, setVehicleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [entryDate, setEntryDate] = useState(initialDate.date);
  const [entryTime, setEntryTime] = useState(initialDate.time);
  const [driverName, setDriverName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [balance, setBalance] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(null);
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => api("/clients")
  });
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api("/vehicles")
  });
  const numbersQuery = useQuery({
    queryKey: ["next-numbers", vehicleId],
    queryFn: () => api(`/vehicles/${vehicleId}/next-numbers`),
    enabled: Boolean(vehicleId)
  });
  useEffect(() => {
    if (!clientId && clientsQuery.data?.clients[0]) setClientId(clientsQuery.data.clients[0].id);
  }, [clientId, clientsQuery.data]);
  const selectedVehicle = useMemo(
    () => vehiclesQuery.data?.vehicles.find((vehicle) => vehicle.id === vehicleId),
    [vehicleId, vehiclesQuery.data]
  );
  const saveMutation = useMutation({
    mutationFn: (data) => api("/deliveries", {
      method: "POST",
      body: { ...data, deliveryDate: new Date(data.deliveryDate).toISOString() }
    }),
    onSuccess: ({ delivery }) => {
      const nextDate = splitDateTime();
      setSaved(delivery);
      setDriverName("");
      setStaffName("");
      setBalance("");
      setNote("");
      setEntryDate(nextDate.date);
      setEntryTime(nextDate.time);
      playTone("success");
      notify.success(`Receipt #${delivery.receiptNumber} saved successfully`);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      void queryClient.invalidateQueries({ queryKey: ["next-numbers", vehicleId] });
    },
    onError: (error) => {
      playTone("warning");
      notify.error(error.message);
    }
  });
  function submit(event) {
    event.preventDefault();
    const result = validateForm(deliveryFormSchema, {
      vehicleId,
      clientId,
      deliveryDate: `${entryDate}T${entryTime}`,
      driverName,
      staffName,
      balance: balance === "" ? NaN : Number(balance),
      note
    });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    if (!numbersQuery.data?.receiptSerialNo || !numbersQuery.data?.itemSize || !Number(numbersQuery.data?.amount)) {
      notify.error("Selected plate is missing item size, amount, or receipt serial number.");
      return;
    }
    setSaved(null);
    saveMutation.mutate(result.data);
  }
  const vehicleDetailsReady = Boolean(numbersQuery.data?.receiptSerialNo)
    && Boolean(numbersQuery.data?.itemSize)
    && Number(numbersQuery.data?.amount) > 0;
  const requiredMissing = !vehicleId || !clientId || !entryDate || !entryTime || !driverName.trim() || !staffName.trim() || balance === "" || !vehicleDetailsReady;
  return <div className="entry-layout">
      <form className="card entry-card" onSubmit={submit}>
        <div className="entry-intro">
          <div className="entry-intro-icon"><Sparkles /></div>
          <div><h2>Delivery details</h2><p>Choose a vehicle and we’ll handle the numbering.</p></div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span><CalendarClock size={15} /> Date *</span>
            <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
          </label>
          <label className="field">
            <span><CalendarClock size={15} /> Time *</span>
            <input type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} required />
          </label>
          <label className="field field-full">
            <span><UserRound size={15} /> Client / Delivered to *</span>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
              <option value="">Select who receives the delivery</option>
              {clientsQuery.data?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="field field-full">
            <span><Truck size={15} /> Plate number *</span>
            <select value={vehicleId} onChange={(event) => {
    setVehicleId(event.target.value);
    setSaved(null);
  }} required>
              <option value="">Select a vehicle</option>
              {vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} {vehicle.label ? `- ${vehicle.label}` : ""}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Item size *</span>
            <input value={numbersQuery.isFetching ? "Loading..." : numbersQuery.data?.itemSize ?? "Auto-filled"} readOnly />
          </label>
          <label className="field">
            <span>Amount (KES) *</span>
            <input value={numbersQuery.isFetching ? "Loading..." : numbersQuery.data?.amount ?? "Auto-filled"} readOnly />
          </label>
          <label className="field">
            <span>Driver *</span>
            <input value={driverName} onChange={(event) => setDriverName(event.target.value)} placeholder="Enter driver name" maxLength={80} required />
          </label>
          <label className="field">
            <span>Staff *</span>
            <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Enter staff name" maxLength={80} required />
          </label>

          <div className="auto-number-field">
            <span><Hash size={15} /> Trip number *</span>
            <strong>{numbersQuery.isFetching ? "..." : numbersQuery.data?.tripNumber ?? "-"}</strong>
            <small><Check /> Auto-generated</small>
          </div>
          <div className="auto-number-field">
            <span><FileText size={15} /> Receipt number *</span>
            <strong>{numbersQuery.isFetching ? "..." : numbersQuery.data?.receiptNumber ?? "-"}</strong>
            <small><Check /> Duplicate protected</small>
          </div>
          <label className="field field-full">
            <span>Receipt serial no *</span>
            <input value={numbersQuery.isFetching ? "Loading..." : numbersQuery.data?.receiptSerialNo ?? "Auto-filled"} readOnly />
          </label>
          <label className="field field-full">
            <span>Balance (KES) *</span>
            <input type="number" min="0" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="Enter balance" required />
          </label>
          <label className="field field-full">
            <span>Note <small>Optional</small></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Delivery instructions, receiver details, or anything worth noting..." rows={4} maxLength={500} />
            <small className="char-count">{note.length}/500</small>
          </label>
        </div>

        <div className="entry-actions">
          <p><Info size={15} /> All fields are required except Note. Numbers update after save.</p>
          <button className="primary-button large" disabled={requiredMissing || numbersQuery.isFetching || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving delivery..." : "Save delivery"} <ArrowRight size={18} />
          </button>
        </div>
      </form>

      <aside className="entry-aside">
        <div className="card next-card">
          <span className="eyebrow">Numbering preview</span>
          <h3>{selectedVehicle?.plateNumber ?? "Select a vehicle"}</h3>
          <p>{selectedVehicle?.label ?? "Trip, receipt, amount, and serial appear here."}</p>
          <div className="counter-preview">
            <div><span>Next trip</span><strong>{numbersQuery.data?.tripNumber ?? "-"}</strong></div>
            <div><span>Next receipt</span><strong>{numbersQuery.data?.receiptNumber ?? "-"}</strong></div>
          </div>
          <div className="vehicle-detail-preview">
            <span>Item size: <strong>{numbersQuery.data?.itemSize ?? "-"}</strong></span>
            <span>Amount: <strong>KES {numbersQuery.data?.amount ?? "-"}</strong></span>
            <span>Serial: <strong>{numbersQuery.data?.receiptSerialNo ?? "-"}</strong></span>
          </div>
        </div>

        {saved && <motion.div className="card saved-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="saved-check"><Check /></div>
            <span>Delivery saved</span>
            <h3>Receipt #{saved.receiptNumber}</h3>
            <p>{saved.client.name} · {saved.vehicle.plateNumber}</p>
            <Link className="text-link" to="/deliveries">View in delivery history <ArrowRight size={15} /></Link>
          </motion.div>}

        <div className="tip-card">
          <Sparkles size={18} />
          <div><strong>Built for speed</strong><p>After saving, the plate stays selected and item size, amount, serial, receipt, and trip reload automatically.</p></div>
        </div>
      </aside>
    </div>;
}
export {
  NewDelivery
};
