import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CalendarDays, CalendarRange, CheckCircle2, Download, Droplets, FileText, Filter, Phone, Printer, ReceiptText, RotateCcw, Truck, UserRound, UsersRound, WalletCards } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useState } from "react";
import { api, queryString } from "../api";
import { EmptyState, ErrorState } from "../components/UI";
import { notify } from "../notify";
import { displayDate } from "../utils";
import { reportFiltersSchema, validateForm } from "../validation";

const initialReportFilters = { clientId: "", vehicleId: "", driverName: "", staffName: "", receipt: "", from: "", to: "" };

function Reports() {
  const [filters, setFilters] = useState(initialReportFilters);
  const [applied, setApplied] = useState(initialReportFilters);
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: () => api("/clients") });
  const vehiclesQuery = useQuery({ queryKey: ["vehicles"], queryFn: () => api("/vehicles") });
  const filterOptionsQuery = useQuery({ queryKey: ["delivery-filter-options"], queryFn: () => api("/deliveries/filter-options") });
  const reportQuery = useQuery({
    queryKey: ["report-preview", applied],
    queryFn: () => api(`/reports/range${queryString(applied)}`),
    placeholderData: (previousData) => previousData
  });
  const report = reportQuery.data;
  const hasFilters = Object.values(applied).some(Boolean);
  const hasDraftFilters = Object.values(filters).some(Boolean);

  function previewReport(event) {
    event.preventDefault();
    const result = validateForm(reportFiltersSchema, filters);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    setFilters(result.data);
    setApplied(result.data);
  }

  function resetFilters() {
    setFilters(initialReportFilters);
    setApplied(initialReportFilters);
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
    doc.roundedRect(14, 46, 182, 14, 1, 1, "F");
    doc.setFillColor(...blue);
    doc.rect(14, 59, 182, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${subject.label}: ${subject.value}`.toUpperCase(), 18, 52.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Period: ${periodText(report.period)}`, 192, 52.5, { align: "right" });
    doc.setFontSize(5.8);
    doc.text(filterSummaryText(report), 18, 57.2, { maxWidth: 174 });

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
      doc.roundedRect(x, 67, 34, 25, 2, 2, "FD");
      doc.setFillColor(...(index === 3 ? [229, 246, 235] : index === 4 ? [255, 230, 225] : [229, 240, 251]));
      doc.roundedRect(x + 13, 70, 8, 8, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(65, 78, 92);
      doc.text(label.toUpperCase(), x + 17, 82, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...color);
      doc.text(String(value), x + 17, 88, { align: "center" });
    });

    let y = 98;
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
        head: [["#", "Client", "Serial", "Receipt No.", "Date", "Plate No.", "Liters", "Amount", "Balance", "Note"]],
        body: report.deliveries.map((item, index) => [
          index + 1,
          item.client?.name || "-",
          item.receiptSerialNo || "-",
          item.receiptNumber,
          displayDate(item.deliveryDate),
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
          0: { cellWidth: 7 }, 1: { cellWidth: 24 }, 2: { cellWidth: 14 }, 3: { cellWidth: 16 },
          4: { cellWidth: 18 }, 5: { cellWidth: 18 }, 6: { cellWidth: 16 }, 7: { cellWidth: 18 },
          8: { cellWidth: 18 }, 9: { cellWidth: 31 }
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

    doc.save(`routeflow-${report.type}-report.pdf`);
    notify.success("PDF downloaded");
  }

  return <div className="reports-layout">
      <aside className="card report-builder">
        <div className="report-builder-head"><FileText /><div><span className="eyebrow">Report builder</span><h2>Filter & preview</h2><p>One filter set powers preview, PDF, and print.</p></div></div>
        <form className="report-filter-grid" onSubmit={previewReport}>
          <label className="field"><span><Building2 /> Client</span><select value={filters.clientId} onChange={(event) => setFilters({ ...filters, clientId: event.target.value })}><option value="">All clients</option>{clientsQuery.data?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="field"><span><Truck /> Plate</span><select value={filters.vehicleId} onChange={(event) => setFilters({ ...filters, vehicleId: event.target.value })}><option value="">All plates</option>{vehiclesQuery.data?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}</select></label>
          <label className="field"><span><UserRound /> Driver</span><select value={filters.driverName} onChange={(event) => setFilters({ ...filters, driverName: event.target.value })}><option value="">All drivers</option>{filterOptionsQuery.data?.drivers.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select></label>
          <label className="field"><span><UsersRound /> Staff</span><select value={filters.staffName} onChange={(event) => setFilters({ ...filters, staffName: event.target.value })}><option value="">All staff</option>{filterOptionsQuery.data?.staff.map((staff) => <option key={staff} value={staff}>{staff}</option>)}</select></label>
          <div className="date-pair">
            <label className="field"><span>Date from</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
            <label className="field"><span>Date to</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          </div>
          <label className="field"><span><ReceiptText /> Receipt No</span><input inputMode="numeric" maxLength={30} placeholder="Exact or partial receipt no." value={filters.receipt} onChange={(event) => setFilters({ ...filters, receipt: event.target.value.replace(/\D/g, "") })} /></label>
          <div className="report-filter-actions">
            <button className="ghost-button" type="button" onClick={resetFilters} disabled={!hasDraftFilters && !hasFilters}><RotateCcw size={16} /> Reset</button>
            <button className="primary-button large" type="submit" disabled={reportQuery.isFetching}><Filter size={16} /> {reportQuery.isFetching ? "Updating..." : "Preview Report"}</button>
          </div>
        </form>
      </aside>

      <section className="card report-preview">
        {reportQuery.error ? <ErrorState message={reportQuery.error.message} /> : !report ? <EmptyState icon={<BarChart3 />} title="Loading report" message="Preparing all delivery records." /> : <>
            <div className="report-preview-head">
              <div><span className="eyebrow">Preview report - internal use only</span><h2>{report.title}</h2><p>{hasFilters ? "Totals and details reflect the selected filters." : "Showing all records. Add filters to narrow the dashboard totals."}</p></div>
              <div><button className="secondary-button" onClick={() => window.print()} disabled={!report}><Printer size={16} /> Print Report</button><button className="primary-button" onClick={downloadPdf} disabled={!report}><Download size={16} /> Download PDF</button></div>
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
      <FilterSummary report={report} />
      <div className="report-metrics report-metrics-five">
        <MetricCard icon={<Truck />} label="Total trips" value={report.totalTrips} />
        <MetricCard icon={<Droplets />} label="Total liters" value={`${formatNumber(report.totalLiters)} L`} />
        <MetricCard icon={<ReceiptText />} label="Total billed" value={formatMoney(report.totalAmount)} />
        <MetricCard icon={<CheckCircle2 />} label="Amount paid" value={formatMoney(report.amountPaid)} tone="paid" />
        <MetricCard icon={<WalletCards />} label="Outstanding balance" value={formatMoney(report.totalBalance)} tone="balance" />
      </div>
      {report.vehicleSummary?.length > 0 && <SummaryTable icon={<Truck />} title="Vehicle summary" columns={["Plate no.", "Total trips", "Total liters", "Total amount (KES)"]} rows={[
        ...report.vehicleSummary.map((row) => [row.plateNumber, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)]),
        ["TOTAL", report.totalTrips, `${formatNumber(report.totalLiters)} L`, formatMoney(report.totalAmount)]
      ]} totalLastRow />}
      {report.clientSummary?.length > 0 && <SummaryTable icon={<Building2 />} title="Client summary" columns={["Client", "Total trips", "Total liters", "Total amount (KES)"]} rows={report.clientSummary.map((row) => [row.name, row.totalTrips, `${formatNumber(row.totalLiters)} L`, formatMoney(row.totalAmount)])} />}
      {report.deliveries && <SummaryTable icon={<FileText />} title="Delivery details" columns={["#", "Client", "Serial", "Receipt no.", "Date", "Time", "Plate no.", "Driver", "Staff", "Liters", "Amount (KES)", "Balance (KES)", "Note"]} internalIndexes={[7, 8]} rows={report.deliveries.map((item, index) => [
        index + 1,
        item.client?.name || "-",
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

function FilterSummary({ report }) {
  const labels = report.filterLabels ?? {};
  const items = [
    ["Client", labels.client || "All Clients"],
    ["Plate", labels.plate || "All Plates"],
    ["Driver", labels.driver || "All Drivers"],
    ["Staff", labels.staff || "All Staff"],
    ["Receipt", labels.receipt || "All Receipts"],
    ["Date", periodText(report.period)]
  ];
  return <div className="report-filter-summary">{items.map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}</div>;
}

function reportSubject(report) {
  const labels = report.filterLabels ?? {};
  const clientSelected = labels.client && labels.client !== "All Clients";
  const plateSelected = labels.plate && labels.plate !== "All Plates";
  if (clientSelected && !plateSelected) return { label: "Client", value: labels.client };
  if (plateSelected && !clientSelected) return { label: "Plate no.", value: labels.plate };
  if (clientSelected || plateSelected || report.filters?.driverName || report.filters?.staffName || report.filters?.receipt) {
    return { label: "Report", value: "Filtered deliveries" };
  }
  return { label: "Report", value: "All delivery records" };
}

function MetricCard({ icon, label, value, tone = "default" }) {
  return <div className={`metric-card ${tone}`}>
      {icon && <span className="metric-icon">{icon}</span>}
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong></div>
    </div>;
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
function filterSummaryText(report) {
  const labels = report.filterLabels ?? {};
  return [
    `Client: ${labels.client || "All Clients"}`,
    `Plate: ${labels.plate || "All Plates"}`,
    `Driver: ${labels.driver || "All Drivers"}`,
    `Staff: ${labels.staff || "All Staff"}`,
    `Receipt: ${labels.receipt || "All Receipts"}`,
    `Date: ${periodText(report.period)}`
  ].join(" | ");
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
