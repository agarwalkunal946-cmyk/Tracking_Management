import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CalendarDays, CalendarRange, CheckCircle2, Download, Droplets, FileText, Phone, Printer, ReceiptText, Truck, UserRound, WalletCards } from "lucide-react";
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
    const blue = [7, 126, 201];
    const paleBlue = [245, 249, 253];
    const green = [0, 135, 62];
    const red = [190, 35, 29];
    const settings = report.settings ?? {};
    const company = settings.companyName || "RouteFlow Logistics";
    const reporter = [settings.reporterName, settings.reporterTitle].filter(Boolean).join(" | ");
    const subject = reportSubject(report);

    function sectionTitle(title, y) {
      doc.setFillColor(...navy);
      doc.roundedRect(14, y, 182, 8, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(title.toUpperCase(), 18, y + 5.3);
      return y + 8;
    }

    doc.setFillColor(...navy);
    doc.rect(0, 0, 210, 31, "F");
    doc.setFillColor(255, 255, 255);
    doc.circle(16, 15, 8, "F");
    doc.setFillColor(...blue);
    doc.circle(16, 13.5, 3, "F");
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.8);
    doc.line(12, 18, 20, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(company.toUpperCase(), 28, 12.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Water Delivery & Logistics Solutions", 28, 19);
    if (settings.companyPhoneNumber) doc.text(`Tel: ${settings.companyPhoneNumber}`, 196, 12.5, { align: "right" });
    doc.text("Professional delivery reporting", 196, 19, { align: "right" });

    doc.setFillColor(...blue);
    doc.rect(0, 31, 210, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${report.title.toUpperCase()}  |  ${periodText(report.period)}`, 105, 37, { align: "center" });

    doc.setFillColor(...navy);
    doc.roundedRect(14, 46, 182, 10, 1, 1, "F");
    doc.setFillColor(...blue);
    doc.rect(14, 55, 182, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${subject.label}: ${subject.value}`.toUpperCase(), 18, 52.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Period: ${periodText(report.period)}`, 192, 52.5, { align: "right" });

    const cards = [
      ["Total Trips", report.totalTrips, navy],
      ["Total Liters", `${formatNumber(report.totalLiters)} L`, navy],
      ["Total Billed", formatMoney(report.totalAmount), navy],
      ["Amount Paid", formatMoney(report.amountPaid), green],
      ["Outstanding Balance", formatMoney(report.totalBalance), red]
    ];
    cards.forEach(([label, value, color], index) => {
      const x = 14 + index * 37;
      doc.setFillColor(...(index === 4 ? [255, 247, 245] : paleBlue));
      doc.setDrawColor(...(index === 4 ? [241, 205, 197] : [210, 224, 238]));
      doc.roundedRect(x, 62, 34, 25, 2, 2, "FD");
      doc.setFillColor(...(index === 3 ? [229, 246, 235] : index === 4 ? [255, 230, 225] : [229, 240, 251]));
      doc.roundedRect(x + 13, 65, 8, 8, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(65, 78, 92);
      doc.text(label.toUpperCase(), x + 17, 77, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...color);
      doc.text(String(value), x + 17, 83, { align: "center" });
    });

    let y = 93;
    if (report.vehicleSummary?.length) {
      y = sectionTitle("Vehicle Summary", y);
      autoTable(doc, {
        startY: y,
        head: [["Plate No.", "Total Trips", "Total Liters", "Total Amount (KES)"]],
        body: [
          ...report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)]),
          ["TOTAL", report.totalTrips, `${formatNumber(report.totalLiters)} L`, formatMoney(report.totalAmount)]
        ],
        headStyles: { fillColor: blue, textColor: 255, halign: "center", fontStyle: "bold" },
        alternateRowStyles: { fillColor: paleBlue },
        styles: { fontSize: 7, cellPadding: 2.2, halign: "center", lineColor: [220, 228, 237], lineWidth: 0.15 },
        margin: { left: 14, right: 14, bottom: 18 },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === report.vehicleSummary.length) {
            data.cell.styles.fillColor = navy;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
          }
        }
      });
      y = doc.lastAutoTable.finalY + 7;
    }

    if (report.deliveries?.length) {
      if (y > 245) {
        doc.addPage();
        y = 18;
      }
      y = sectionTitle("Delivery Details", y);
      autoTable(doc, {
        startY: y,
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
        headStyles: { fillColor: blue, textColor: 255, halign: "center", fontStyle: "bold" },
        alternateRowStyles: { fillColor: paleBlue },
        styles: { fontSize: 5.8, cellPadding: 1.7, halign: "center", valign: "middle", lineColor: [220, 228, 237], lineWidth: 0.12 },
        columnStyles: {
          0: { cellWidth: 7 }, 1: { cellWidth: 15 }, 2: { cellWidth: 17 }, 3: { cellWidth: 20 },
          4: { cellWidth: 13 }, 5: { cellWidth: 20 }, 6: { cellWidth: 18 }, 7: { cellWidth: 20 },
          8: { cellWidth: 20 }, 9: { cellWidth: 32 }
        },
        margin: { left: 14, right: 14, bottom: 20 }
      });
      y = doc.lastAutoTable.finalY + 7;
    }

    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    const summaryY = Math.max(y, 244);
    doc.setDrawColor(143, 178, 211);
    doc.setFillColor(250, 252, 255);
    doc.roundedRect(14, summaryY, 182, 25, 2, 2, "FD");
    cards.forEach(([label, value, color], index) => {
      const x = 14 + index * 36.4;
      if (index > 0) {
        doc.setDrawColor(215, 225, 235);
        doc.line(x, summaryY + 4, x, summaryY + 17);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(65, 78, 92);
      doc.text(label.toUpperCase(), x + 18.2, summaryY + 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...color);
      doc.text(String(value), x + 18.2, summaryY + 14, { align: "center" });
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(65, 78, 92);
    doc.text(`Total Trips: ${report.totalTrips}  |  Total Liters: ${formatNumber(report.totalLiters)} L  |  Total Billed: ${formatMoney(report.totalAmount)}  |  Paid: ${formatMoney(report.amountPaid)}  |  Outstanding: ${formatMoney(report.totalBalance)}`, 105, summaryY + 21, { align: "center" });

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFillColor(...navy);
      doc.rect(0, 284, 210, 13, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(`System Generated by ${company}`, 14, 290);
      doc.text(reporter || "Authorized delivery report", 105, 290, { align: "center" });
      doc.text(`Date: ${displayDate(new Date().toISOString())}`, 196, 290, { align: "right" });
      doc.text(`Page ${pageNumber} of ${pageCount}`, 196, 294, { align: "right" });
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
  const preparedBy = [settings.reporterName, settings.reporterTitle].filter(Boolean).join(" | ");
  return <div className="report-sheet water-report-sheet">
      <div className="report-brand-bar">
        <div className="report-brand-identity">
          <span className="report-logo"><Droplets /></span>
          <div><strong>{settings.companyName || "RouteFlow Logistics"}</strong><span>Water Delivery & Logistics Solutions</span></div>
        </div>
        <div className="report-contact">
          {settings.companyPhoneNumber && <span><Phone /> {settings.companyPhoneNumber}</span>}
          <span><FileText /> Professional delivery reporting</span>
        </div>
      </div>
      <div className="report-blue-strip"><span><FileText /> {report.title}</span><i /><span><CalendarDays /> {periodText(report.period)}</span></div>
      <div className="report-subject-bar"><strong><Building2 /> {subject.label}: {subject.value}</strong><span><CalendarDays /> Period: {periodText(report.period)}</span></div>
      <div className="report-metrics report-metrics-five">
        <MetricCard icon={<Truck />} label="Total trips" value={report.totalTrips} />
        <MetricCard icon={<Droplets />} label="Total liters" value={`${formatNumber(report.totalLiters)} L`} />
        <MetricCard icon={<ReceiptText />} label="Total billed" value={formatMoney(report.totalAmount)} />
        <MetricCard icon={<CheckCircle2 />} label="Amount paid" value={formatMoney(report.amountPaid)} tone="paid" />
        <MetricCard icon={<WalletCards />} label="Outstanding balance" value={formatMoney(report.totalBalance)} tone="balance" />
      </div>
      {report.vehicleSummary && <SummaryTable icon={<Truck />} title="Vehicle summary" columns={["Plate no.", "Total trips", "Total liters", "Total amount (KES)"]} rows={[
        ...report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)]),
        ["TOTAL", report.totalTrips, `${formatNumber(report.totalLiters)} L`, formatMoney(report.totalAmount)]
      ]} totalLastRow />}
      {report.clientSummary && report.type === "summary" && <SummaryTable icon={<Building2 />} title="Client summary" columns={["Client", "Total trips", "Total liters", "Total amount (KES)"]} rows={report.clientSummary.map((row) => [row.name, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)])} />}
      {report.deliveries && <SummaryTable icon={<FileText />} title="Delivery details" columns={["#", "Serial", "Receipt no.", "Date", "Time", "Plate no.", "Driver", "Staff", "Liters", "Amount (KES)", "Balance (KES)", "Note"]} internalIndexes={[6, 7]} rows={report.deliveries.map((item, index) => [
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
      <div className="report-closing">
        <div className="report-footer-summary">
          <MetricCard icon={<Truck />} label="Total trips" value={report.totalTrips} />
          <MetricCard icon={<Droplets />} label="Total liters" value={`${formatNumber(report.totalLiters)} L`} />
          <MetricCard icon={<ReceiptText />} label="Total billed" value={formatMoney(report.totalAmount)} />
          <MetricCard icon={<CheckCircle2 />} label="Paid" value={formatMoney(report.amountPaid)} tone="paid" />
          <MetricCard icon={<WalletCards />} label="Outstanding balance" value={formatMoney(report.totalBalance)} tone="balance" />
        </div>
        <div className="report-footer-totals"><span>Total trips: <b>{report.totalTrips}</b></span><i /><span>Total liters: <b>{formatNumber(report.totalLiters)} L</b></span><i /><span>Total billed: <b>{formatMoney(report.totalAmount)}</b></span><i /><span className="paid-text">Paid: <b>{formatMoney(report.amountPaid)}</b></span><i /><span className="balance-text">Outstanding: <b>{formatMoney(report.totalBalance)}</b></span></div>
        <div className="report-footer-line"><span><FileText /> System generated by {settings.companyName || "RouteFlow Logistics"}</span><span>{preparedBy || "Authorized delivery report"}</span><span><CalendarDays /> Date: {displayDate(new Date().toISOString())}</span></div>
      </div>
    </div>;
}

function reportSubject(report) {
  if (report.client?.name) return { label: "Client", value: report.client.name };
  if (report.vehicle?.plateNumber) return { label: "Plate no.", value: report.vehicle.plateNumber };
  if (report.type === "range") return { label: "Report", value: "Date range deliveries" };
  return { label: "Report", value: "Grand summary" };
}

function MetricCard({ icon, label, value, tone = "default" }) {
  return <div className={`metric-card ${tone}`}>
      {icon && <span className="metric-icon">{icon}</span>}
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong></div>
    </div>;
}

function ReportTypeButton({ active, onClick, icon, label }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}
function SummaryTable({ icon, title, columns, rows, internalIndexes = [], totalLastRow = false }) {
  return <div className="summary-section">
      <h4>{icon}{title}</h4>
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
