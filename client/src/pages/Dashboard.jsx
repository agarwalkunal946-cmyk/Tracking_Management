import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CarFront, PackageCheck, Sparkles, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorState, SkeletonCards } from "../components/UI";
import { displayDateTime } from "../utils";
function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard")
  });
  if (error) return <ErrorState message={error.message} />;
  return <div className="dashboard-stack">
      <section className="welcome-strip">
        <div>
          <span><Sparkles size={15} /> Live operations</span>
          <h2>Your delivery day, at a glance.</h2>
          <p>Track every movement and stay one step ahead.</p>
        </div>
        <Link className="primary-button" to="/deliveries/new">New delivery <ArrowRight size={17} /></Link>
      </section>

      {isLoading || !data ? <SkeletonCards /> : <>
          <section className="stats-grid">
            <StatCard icon={<PackageCheck />} label="Trips today" value={data.stats.tripsToday} accent="coral" note="Live count" />
            <StatCard icon={<CalendarDays />} label="This month" value={data.stats.tripsMonth} accent="gold" note={`${data.stats.totalTrips} all time`} />
            <StatCard icon={<UsersRound />} label="Active clients" value={data.stats.totalClients} accent="mint" note="Client directory" />
            <StatCard icon={<TrendingUp />} label="All-time trips" value={data.stats.totalTrips} accent="blue" note="Growing steadily" />
          </section>

          <section className="dashboard-grid">
            <div className="card chart-card">
              <div className="card-head">
                <div><span className="eyebrow">Last 7 days</span><h3>Delivery rhythm</h3></div>
                <span className="live-badge"><i /> Updated live</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.weekly.map((item) => ({
    ...item,
    label: (/* @__PURE__ */ new Date(`${item.date}T12:00:00`)).toLocaleDateString("en", { weekday: "short" })
  }))}>
                    <defs>
                      <linearGradient id="tripGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff765d" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#ff765d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#ece8e1" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8a8883", fontSize: 12 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8a8883", fontSize: 12 }} width={26} />
                    <Tooltip contentStyle={{ border: 0, borderRadius: 12, boxShadow: "0 12px 30px rgba(34,31,27,.12)" }} />
                    <Area type="monotone" dataKey="trips" stroke="#ff6b52" strokeWidth={3} fill="url(#tripGradient)" activeDot={{ r: 6, fill: "#ff6b52", stroke: "#fff", strokeWidth: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card leaders-card">
              <div className="card-head"><div><span className="eyebrow">Top performers</span><h3>Activity leaders</h3></div></div>
              <Leader
    icon={<UserRound />}
    title="Most active client"
    value={data.stats.mostActiveClient?.name ?? "No trips yet"}
    trips={data.stats.mostActiveClient?.trips ?? 0}
    color="coral"
  />
              <Leader
    icon={<CarFront />}
    title="Most active vehicle"
    value={data.stats.mostActiveVehicle?.plateNumber ?? "No trips yet"}
    trips={data.stats.mostActiveVehicle?.trips ?? 0}
    color="dark"
  />
              <Link to="/reports" className="text-link">Explore detailed reports <ArrowRight size={15} /></Link>
            </div>
          </section>

          <section className="card recent-card">
            <div className="card-head">
              <div><span className="eyebrow">Latest movement</span><h3>Recent deliveries</h3></div>
              <Link to="/deliveries" className="text-link">View all <ArrowRight size={15} /></Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Receipt</th><th>Delivered to</th><th>Vehicle</th><th>Trip</th><th>Date & time</th><th>Entered by Staff</th></tr></thead>
                <tbody>
                  {data.recentDeliveries.map((delivery) => <tr key={delivery.id}>
                      <td><span className="receipt-code">#{delivery.receiptNumber}</span></td>
                      <td><strong>{delivery.client.name}</strong></td>
                      <td><span className="plate">{delivery.vehicle.plateNumber}</span></td>
                      <td>Trip {delivery.tripNumber}</td>
                      <td>{displayDateTime(delivery.deliveryDate)}</td>
                      <td>{delivery.createdBy.name}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </>}
    </div>;
}
function StatCard({ icon, label, value, accent, note }) {
  return <motion.div className="stat-card" whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
      <div className={`stat-icon ${accent}`}>{icon}</div>
      <div><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{note}</small></div>
    </motion.div>;
}
function Leader({ icon, title, value, trips, color }) {
  return <div className="leader-row">
      <div className={`leader-icon ${color}`}>{icon}</div>
      <div><span>{title}</span><strong>{value}</strong></div>
      <b>{trips} trips</b>
    </div>;
}
export {
  Dashboard
};
