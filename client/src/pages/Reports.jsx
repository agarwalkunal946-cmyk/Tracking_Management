import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, Download, FileText, Printer, Truck, UserRound } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { api, queryString } from "../api";
import { EmptyState } from "../components/UI";
import { notify } from "../notify";
import { displayDate } from "../utils";
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
    const navy = [4, 47, 98];
    const blue = [0, 98, 185];
    const green = [0, 135, 62];
    const red = [190, 35, 29];
    const settings = report.settings ?? {};
    const company = settings.companyName || "RouteFlow Logistics";

    doc.setFillColor(...navy);
    doc.rect(0, 0, 210, 31, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(company.toUpperCase(), 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Water Delivery & Logistics Solutions", 14, 20);
    if (settings.companyPhoneNumber) doc.text(`Tel: ${settings.companyPhoneNumber}`, 196, 13, { align: "right" });
    doc.setFillColor(...blue);
    doc.rect(0, 31, 210, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${report.title.toUpperCase()}  |  ${periodText(report.period)}`, 105, 37, { align: "center" });

    doc.setTextColor(20, 31, 47);
    doc.setFontSize(11);
    const subject = reportSubject(report);
    doc.text(`${subject.label}: ${subject.value}`.toUpperCase(), 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${periodText(report.period)}`, 196, 50, { align: "right" });

    const cards = [
      ["Total Trips", report.totalTrips, navy],
      ["Total Liters", `${formatNumber(report.totalLiters)} L`, navy],
      ["Total Billed", formatMoney(report.totalAmount), navy],
      ["Amount Paid", formatMoney(report.amountPaid), green],
      ["Outstanding Balance", formatMoney(report.totalBalance), red]
    ];
    cards.forEach(([label, value, color], index) => {
      const x = 14 + index * 37;
      doc.setDrawColor(220, 226, 235);
      doc.roundedRect(x, 58, 34, 22, 2, 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(65, 78, 92);
      doc.text(label, x + 17, 66, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...color);
      doc.text(String(value), x + 17, 74, { align: "center" });
    });

    let y = 88;
    if (report.vehicleSummary?.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.text("VEHICLE SUMMARY", 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["Plate No.", "Total Trips", "Total Liters", "Total Amount (KES)"]],
        body: [
          ...report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)]),
          ["TOTAL", report.totalTrips, `${formatNumber(report.totalLiters)} L`, formatMoney(report.totalAmount)]
        ],
        headStyles: { fillColor: navy, textColor: 255 },
        footStyles: { fillColor: navy, textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        didParseCell: (data) => {
          if (data.row.index === report.vehicleSummary.length) {
            data.cell.styles.fillColor = navy;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
          }
        }
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    if (report.deliveries?.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.text("DELIVERY DETAILS", 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["#", "Serial", "Receipt No.", "Date", "Time", "Plate No.", "Liters", "Amount", "Balance", "Note"]],
        body: report.deliveries.map((item, index) => [
          index + 1,
          item.receiptSerialNo || "-",
          item.receiptNumber,
          displayDate(item.deliveryDate),
          new Date(item.deliveryDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          item.vehicle?.plateNumber || "-",
          `${formatNumber(item.itemSize)} L`,
          formatMoney(item.amount),
          formatMoney(item.balance),
          item.note || "-"
        ]),
        headStyles: { fillColor: navy, textColor: 255 },
        alternateRowStyles: { fillColor: [244, 248, 253] },
        styles: { fontSize: 6.6, cellPadding: 1.7 },
        didDrawPage: ({ pageNumber }) => {
          doc.setFillColor(...navy);
          doc.rect(0, 284, 210, 13, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.text(`System Generated by ${company}`, 14, 290);
          const reporter = [settings.reporterName, settings.reporterTitle].filter(Boolean).join(" | ");
          if (reporter) doc.text(reporter, 14, 294);
          doc.text(`Date: ${displayDate(new Date().toISOString())}`, 196, 290, { align: "right" });
          doc.text(`Page ${pageNumber}`, 196, 294, { align: "right" });
        }
      });
    }
    doc.save(`routeflow-${report.type}-client-report.pdf`);
    notify.success("Client PDF downloaded");
  }
  return <div className="reports-layout">
      <aside className="card report-builder">
        <div className="report-builder-head"><FileText /><div><span className="eyebrow">Report builder</span><h2>Create a report</h2></div></div>
        <label className="field"><span>Report type</span>
          <div className="report-type-grid">
            <ReportTypeButton active={type === "client"} onClick={() => { setType("client"); setReport(null); }} icon={<UserRound />} label="Client" />
            <ReportTypeButton active={type === "vehicle"} onClick={() => { setType("vehicle"); setReport(null); }} icon={<Truck />} label="Vehicle" />
            <ReportTypeButton active={type === "range"} onClick={() => { setType("range"); setReport(null); }} icon={<CalendarRange />} label="Date range" />
            <ReportTypeButton active={type === "summary"} onClick={() => { setType("summary"); setReport(null); }} icon={<BarChart3 />} label="Summary" />
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
              <div><span className="eyebrow">Preview report - internal use only</span><h2>{report.title}</h2><p>Driver and Staff are shown here for management verification. PDF/print hides them for the client version.</p></div>
              <div><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> Print PDF</button><button className="primary-button" onClick={downloadPdf}><Download size={16} /> Download PDF</button></div>
            </div>
            <ReportSheet report={report} />
          </>}
      </section>
    </div>;
}

function ReportSheet({ report }) {
  const settings = report.settings ?? {};
  const subject = reportSubject(report);
  return <div className="report-sheet water-report-sheet">
      <div className="report-brand-bar">
        <div><strong>{settings.companyName || "RouteFlow Logistics"}</strong><span>Water Delivery & Logistics Solutions</span></div>
        <div>{settings.companyPhoneNumber && <span>Tel: {settings.companyPhoneNumber}</span>}</div>
      </div>
      <div className="report-blue-strip">{report.title} <i /> {periodText(report.period)}</div>
      <div className="report-subject-bar"><strong>{subject.label}: {subject.value}</strong><span>Period: {periodText(report.period)}</span></div>
      <div className="report-metrics report-metrics-five">
        <MetricCard label="Total trips" value={report.totalTrips} />
        <MetricCard label="Total liters" value={`${formatNumber(report.totalLiters)} L`} />
        <MetricCard label="Total billed" value={formatMoney(report.totalAmount)} />
        <MetricCard label="Amount paid" value={formatMoney(report.amountPaid)} tone="paid" />
        <MetricCard label="Outstanding balance" value={formatMoney(report.totalBalance)} tone="balance" />
      </div>
      {report.vehicleSummary && <SummaryTable title="Vehicle summary" columns={["Plate no.", "Total trips", "Total liters", "Total amount (KES)"]} rows={[
        ...report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)]),
        ["TOTAL", report.totalTrips, `${formatNumber(report.totalLiters)} L`, formatMoney(report.totalAmount)]
      ]} totalLastRow />}
      {report.clientSummary && report.type === "summary" && <SummaryTable title="Client summary" columns={["Client", "Total trips", "Total liters", "Total amount (KES)"]} rows={report.clientSummary.map((row) => [row.name, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)])} />}
      {report.deliveries && <SummaryTable title="Delivery details" columns={["#", "Serial", "Receipt no.", "Date", "Time", "Plate no.", "Driver", "Staff", "Liters", "Amount (KES)", "Balance (KES)", "Note"]} internalIndexes={[6, 7]} rows={report.deliveries.map((item, index) => [
        index + 1,
        item.receiptSerialNo || "-",
        item.receiptNumber,
        displayDate(item.deliveryDate),
        new Date(item.deliveryDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        item.vehicle?.plateNumber || "-",
        item.driverName || "-",
        item.staffName || "-",
        `${formatNumber(item.itemSize)} L`,
        formatMoney(item.amount),
        formatMoney(item.balance),
        item.note || "-"
      ])} totalLastRow={false} />}
      <div className="report-footer-summary">
        <MetricCard label="Total trips" value={report.totalTrips} />
        <MetricCard label="Total liters" value={`${formatNumber(report.totalLiters)} L`} />
        <MetricCard label="Total billed" value={formatMoney(report.totalAmount)} />
        <MetricCard label="Paid" value={formatMoney(report.amountPaid)} tone="paid" />
        <MetricCard label="Outstanding balance" value={formatMoney(report.totalBalance)} tone="balance" />
      </div>
      <div className="report-footer-line"><span>System Generated by {settings.companyName || "RouteFlow Logistics"}</span><span>{[settings.reporterName, settings.reporterTitle].filter(Boolean).join(" | ")}</span><span>Date: {displayDate(new Date().toISOString())}</span></div>
    </div>;
}

function reportSubject(report) {
  if (report.client?.name) return { label: "Client", value: report.client.name };
  if (report.vehicle?.plateNumber) return { label: "Plate no.", value: report.vehicle.plateNumber };
  if (report.type === "range") return { label: "Report", value: "Date range deliveries" };
  return { label: "Report", value: "Grand summary" };
}

function MetricCard({ label, value, tone = "default" }) {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ReportTypeButton({ active, onClick, icon, label }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}
function SummaryTable({ title, columns, rows, internalIndexes = [], totalLastRow = false }) {
  return <div className="summary-section">
      <h4>{title}</h4>
      <div className="table-scroll"><table><thead><tr>{columns.map((column, index) => <th className={internalIndexes.includes(index) ? "internal-only" : ""} key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr className={totalLastRow && rowIndex === rows.length - 1 ? "total-row" : ""} key={rowIndex}>{row.map((cell, cellIndex) => <td className={internalIndexes.includes(cellIndex) ? "internal-only" : ""} key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
    </div>;
}
function periodText(period) {
  if (!period.from && !period.to) return "All available records";
  if (period.from && period.to) return `${displayDate(`${period.from}T12:00:00`)} - ${displayDate(`${period.to}T12:00:00`)}`;
  if (period.from) return `From ${displayDate(`${period.from}T12:00:00`)}`;
  return `Until ${displayDate(`${period.to}T12:00:00`)}`;
}
function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}
function formatMoney(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}
export {
  Reports
};
