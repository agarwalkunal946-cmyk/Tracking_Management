import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Check, FileText, Hash, Info, Sparkles, Truck, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { notify } from "../notify";
import { dateInputValue, playTone } from "../utils";
import { deliveryFormSchema, validateForm } from "../validation";
function NewDelivery() {
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(dateInputValue());
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
      setSaved(delivery);
      setNote("");
      setDeliveryDate(dateInputValue());
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
    const result = validateForm(deliveryFormSchema, { vehicleId, clientId, deliveryDate, note });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    setSaved(null);
    saveMutation.mutate(result.data);
  }
  return <div className="entry-layout">
      <form className="card entry-card" onSubmit={submit}>
        <div className="entry-intro">
          <div className="entry-intro-icon"><Sparkles /></div>
          <div><h2>Delivery details</h2><p>Choose a vehicle and we’ll handle the numbering.</p></div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span><CalendarClock size={15} /> Date & time</span>
            <input type="datetime-local" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} required />
          </label>
          <label className="field">
            <span><Truck size={15} /> Plate number</span>
            <select value={vehicleId} onChange={(event) => {
    setVehicleId(event.target.value);
    setSaved(null);
  }} required>
              <option value="">Select a vehicle</option>
              {vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} {vehicle.label ? `\u2014 ${vehicle.label}` : ""}</option>)}
            </select>
          </label>

          <div className="auto-number-field">
            <span><Hash size={15} /> Trip number</span>
            <strong>{numbersQuery.isFetching ? "..." : numbersQuery.data?.tripNumber ?? "\u2014"}</strong>
            <small><Check /> Auto-generated</small>
          </div>
          <div className="auto-number-field">
            <span><FileText size={15} /> Receipt number</span>
            <strong>{numbersQuery.isFetching ? "..." : numbersQuery.data?.receiptNumber ?? "\u2014"}</strong>
            <small><Check /> Duplicate protected</small>
          </div>

          <label className="field field-full">
            <span><UserRound size={15} /> Client / Delivered to</span>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
              <option value="">Select who receives the delivery</option>
              {clientsQuery.data?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="field field-full">
            <span>Note <small>Optional</small></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Delivery instructions, receiver details, or anything worth noting..." rows={4} maxLength={500} />
            <small className="char-count">{note.length}/500</small>
          </label>
        </div>

        <div className="entry-actions">
          <p><Info size={15} /> Numbers are confirmed only when the delivery is saved.</p>
          <button className="primary-button large" disabled={!vehicleId || !clientId || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving delivery..." : "Save delivery"} <ArrowRight size={18} />
          </button>
        </div>
      </form>

      <aside className="entry-aside">
        <div className="card next-card">
          <span className="eyebrow">Numbering preview</span>
          <h3>{selectedVehicle?.plateNumber ?? "Select a vehicle"}</h3>
          <p>{selectedVehicle?.label ?? "Trip and receipt counters appear here."}</p>
          <div className="counter-preview">
            <div><span>Next trip</span><strong>{numbersQuery.data?.tripNumber ?? "\u2014"}</strong></div>
            <div><span>Next receipt</span><strong>{numbersQuery.data?.receiptNumber ?? "\u2014"}</strong></div>
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
          <div><strong>Built for speed</strong><p>After saving, the client and vehicle stay selected so repeat entries take just a few seconds.</p></div>
        </div>
      </aside>
    </div>;
}
export {
  NewDelivery
};
