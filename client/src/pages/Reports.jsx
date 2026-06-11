import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, Download, FileText, Printer, Truck, UserRound } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { api, queryString } from "../api";
import { EmptyState } from "../components/UI";
import { notify } from "../notify";
import { displayDate, displayDateTime } from "../utils";
import { reportFiltersSchema, validateForm } from "../validation";
function Reports() {
  const [type, setType] = useState("client");
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: () => api("/clients") });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: () => api("/vehicles") });
  const reportMutation = useMutation({
    mutationFn: () => {
      const suffix = queryString({ from, to });
      if (type === "client") return api(`/reports/client/${clientId}${suffix}`);
      if (type === "vehicle") return api(`/reports/vehicle/${vehicleId}${suffix}`);
      if (type === "range") return api(`/reports/range${suffix}`);
      return api(`/reports/grand-summary${suffix}`);
    },
    onSuccess: setReport,
    onError: (error) => notify.error(error.message)
  });
  function canGenerate() {
    if (type === "client") return Boolean(clientId);
    if (type === "vehicle") return Boolean(vehicleId);
    return true;
  }
  function generateReport() {
    const result = validateForm(reportFiltersSchema, { type, clientId, vehicleId, from, to });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    reportMutation.mutate();
  }
  function downloadPdf() {
    if (!report) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const coral = [242, 102, 80];
    doc.setFillColor(30, 31, 34);
    doc.rect(0, 0, 210, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text("ROUTEFLOW", 15, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("DELIVERY INTELLIGENCE", 15, 21);
    doc.setTextColor(...coral);
    doc.setFontSize(12);
    doc.text(report.title.toUpperCase(), 195, 18, { align: "right" });
    doc.setTextColor(38, 38, 38);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const subject = report.client?.name ?? report.vehicle?.plateNumber ?? report.title;
    doc.text(subject, 15, 50);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(`Reporting period: ${periodText(report.period)}`, 15, 57);
    doc.setFillColor(250, 246, 240);
    doc.roundedRect(15, 64, 55, 23, 3, 3, "F");
    doc.setTextColor(115, 110, 103);
    doc.setFontSize(8);
    doc.text("TOTAL TRIPS", 20, 72);
    doc.setTextColor(28, 29, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(String(report.totalTrips), 20, 82);
    let y = 96;
    if (report.plateSummary?.length) {
      doc.setFontSize(11);
      doc.text("Plate summary", 15, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["Plate number", "Total trips"]],
        body: report.plateSummary.map((row) => [row.plateNumber, row.totalTrips]),
        theme: "striped",
        headStyles: { fillColor: [30, 31, 34] },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = doc.lastAutoTable.finalY + 10;
    }
    if (report.clientSummary?.length) {
      autoTable(doc, {
        startY: y,
        head: [["Client", "Total trips"]],
        body: report.clientSummary.map((row) => [row.name, row.totalTrips]),
        theme: "striped",
        headStyles: { fillColor: [30, 31, 34] }
      });
      y = doc.lastAutoTable.finalY + 10;
    }
    if (report.vehicleSummary?.length) {
      autoTable(doc, {
        startY: y,
        head: [["Plate number", "Total trips"]],
        body: report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips]),
        theme: "striped",
        headStyles: { fillColor: [30, 31, 34] }
      });
      y = doc.lastAutoTable.finalY + 10;
    }
    if (report.deliveries?.length) {
      doc.setFontSize(11);
      doc.setTextColor(28, 29, 31);
      doc.text("Delivery history", 15, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["Receipt", "Date / time", "Client", "Plate", "Trip", "Note"]],
        body: report.deliveries.map((item) => [
          item.receiptNumber,
          displayDateTime(item.deliveryDate),
          item.client.name,
          item.vehicle.plateNumber,
          item.tripNumber,
          item.note ?? "\u2014"
        ]),
        headStyles: { fillColor: [30, 31, 34] },
        alternateRowStyles: { fillColor: [250, 247, 243] },
        styles: { fontSize: 7.5, cellPadding: 2.3 },
        columnStyles: { 5: { cellWidth: 42 } },
        didDrawPage: ({ pageNumber }) => {
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 140);
          doc.text(`RouteFlow \u2022 Generated ${(/* @__PURE__ */ new Date()).toLocaleString()} \u2022 Page ${pageNumber}`, 105, 291, { align: "center" });
        }
      });
    }
    doc.save(`routeflow-${report.type}-report.pdf`);
    notify.success("Professional PDF downloaded");
  }
  return <div className="reports-layout">
      <aside className="card report-builder">
        <div className="report-builder-head"><FileText /><div><span className="eyebrow">Report builder</span><h2>Create a report</h2></div></div>
        <label className="field"><span>Report type</span>
          <div className="report-type-grid">
            <ReportTypeButton active={type === "client"} onClick={() => {
    setType("client");
    setReport(null);
  }} icon={<UserRound />} label="Client" />
            <ReportTypeButton active={type === "vehicle"} onClick={() => {
    setType("vehicle");
    setReport(null);
  }} icon={<Truck />} label="Vehicle" />
            <ReportTypeButton active={type === "range"} onClick={() => {
    setType("range");
    setReport(null);
  }} icon={<CalendarRange />} label="Date range" />
            <ReportTypeButton active={type === "summary"} onClick={() => {
    setType("summary");
    setReport(null);
  }} icon={<BarChart3 />} label="Summary" />
          </div>
        </label>
        {type === "client" && <label className="field"><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Choose client</option>{clientsQuery.data?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>}
        {type === "vehicle" && <label className="field"><span>Plate number</span><select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Choose vehicle</option>{vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}</select></label>}
        <div className="date-pair">
          <label className="field"><span>From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field"><span>To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <button className="primary-button large" onClick={generateReport} disabled={!canGenerate() || reportMutation.isPending}>
          {reportMutation.isPending ? "Building report..." : "Generate report"}
        </button>
      </aside>

      <section className="card report-preview">
        {!report ? <EmptyState icon={<BarChart3 />} title="Your report will appear here" message="Choose a report type, set the date range, and generate a print-ready summary." /> : <>
            <div className="report-preview-head">
              <div><span className="eyebrow">Preview</span><h2>{report.title}</h2><p>{periodText(report.period)}</p></div>
              <div><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Print</button><button className="primary-button" onClick={downloadPdf}><Download size={16} /> Download PDF</button></div>
            </div>
            <div className="report-sheet">
              <div className="report-sheet-brand"><strong>RouteFlow</strong><span>Delivery intelligence</span></div>
              <div className="report-subject"><div><small>REPORT FOR</small><h3>{report.client?.name ?? report.vehicle?.plateNumber ?? "Grand summary"}</h3></div><div><small>REPORTING PERIOD</small><strong>{periodText(report.period)}</strong></div></div>
              <div className="report-metrics">
                <div><span>Total trips</span><strong>{report.totalTrips}</strong></div>
                {report.totalClients !== void 0 && <div><span>Total clients</span><strong>{report.totalClients}</strong></div>}
                {report.totalVehicles !== void 0 && <div><span>Total vehicles</span><strong>{report.totalVehicles}</strong></div>}
              </div>
              {report.plateSummary && <SummaryTable title="Plate summary" columns={["Plate number", "Total trips"]} rows={report.plateSummary.map((row) => [row.plateNumber, row.totalTrips])} />}
              {report.clientSummary && <SummaryTable title="Client summary" columns={["Client", "Total trips"]} rows={report.clientSummary.map((row) => [row.name, row.totalTrips])} />}
              {report.vehicleSummary && <SummaryTable title="Vehicle summary" columns={["Plate number", "Total trips"]} rows={report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips])} />}
              {report.deliveries && <SummaryTable title="Delivery history" columns={["Receipt", "Date", "Time", "Client", "Plate", "Trip", "Note"]} rows={report.deliveries.map((item) => [
    `#${item.receiptNumber}`,
    displayDate(item.deliveryDate),
    new Date(item.deliveryDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    item.client.name,
    item.vehicle.plateNumber,
    item.tripNumber,
    item.note || "\u2014"
  ])} />}
            </div>
          </>}
      </section>
    </div>;
}
function ReportTypeButton({ active, onClick, icon, label }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}
function SummaryTable({ title, columns, rows }) {
  return <div className="summary-section">
      <h4>{title}</h4>
      <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
    </div>;
}
function periodText(period) {
  if (!period.from && !period.to) return "All available records";
  if (period.from && period.to) return `${displayDate(`${period.from}T12:00:00`)} \u2013 ${displayDate(`${period.to}T12:00:00`)}`;
  if (period.from) return `From ${displayDate(`${period.from}T12:00:00`)}`;
  return `Until ${displayDate(`${period.to}T12:00:00`)}`;
}
export {
  Reports
};
