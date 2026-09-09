import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Minus, Sparkles, Trophy } from "lucide-react";
import { calculateMonthlyMarhalaResults } from "../utils/marhalaMonthly";

/**
 * MarhalaMonthlyPage — APPEND-ONLY feature page (Monthly Marhala Results).
 * Mirrors MarhalaResultsPage (weekly) but aggregates per calendar month.
 * Reads students + weeklyResults only. Does NOT touch Mark Progress logic.
 */
function ScorePill({ value, max }) {
  const v = Number(value) || 0;
  const good = max === 100 ? v >= 80 : max === 30 ? v >= 24 : v >= 15;
  return (
    <span className="mrk-score-pill" data-good={good ? "1" : "0"}>
      {value ?? "—"}
      <span className="mrk-score-max">/ {max}</span>
    </span>
  );
}

function RankBadge({ rank, change }) {
  if (!rank) return <span className="mrk-rank-empty">—</span>;
  return (
    <span className="mrk-rank-wrap">
      <span className={`mrk-rank-badge ${rank <= 3 ? "top" : ""}`}>
        {rank <= 3 ? ["🏆", "🥈", "🥉"][rank - 1] : rank}
      </span>
      {change === "up" && <ArrowUp size={16} strokeWidth={3.2} className="mrk-rank-arrow mrk-arrow-up" />}
      {change === "down" && <ArrowDown size={16} strokeWidth={3.2} className="mrk-rank-arrow mrk-arrow-down" />}
      {change === "same" && <Minus size={14} strokeWidth={3} className="mrk-rank-arrow mrk-arrow-same" />}
    </span>
  );
}

function JadeedTotalBox({ row }) {
  const trend = row?.jadeedTrend || "neutral";
  const label = row?.jadeedUnit === "satar" ? "سطر (Satar)" : "صفه (Safah)";
  const prev = row?.prevJadeed;
  return (
    <div className={`mrk-jadeed-box trend-${trend}`}>
      <div className="mrk-jadeed-top">
        <span className="mrk-jadeed-val">{row?.totalJadeed ?? "—"}</span>
        <span className="mrk-jadeed-unit">{label} · Total</span>
        {trend === "up" && (
          <ArrowUp size={20} strokeWidth={3.2} className="mrk-jadeed-arrow mrk-glow-green" />
        )}
        {trend === "down" && (
          <ArrowDown size={20} strokeWidth={3.2} className="mrk-jadeed-arrow mrk-flat-red" />
        )}
        {trend === "neutral" && <Minus size={16} className="mrk-jadeed-arrow mrk-neutral" />}
      </div>
      <div className="mrk-jadeed-sub">
        {prev ? (
          <>Last month: {prev.value} {prev.unit === "satar" ? "سطر" : "صفه"}</>
        ) : (
          <>First recorded month</>
        )}
      </div>
    </div>
  );
}

export default function MarhalaMonthlyPage({ students = [], weeklyResults = [], onShowAction }) {
  const { months, orderedMonths } = useMemo(
    () => calculateMonthlyMarhalaResults(students, weeklyResults),
    [students, weeklyResults]
  );
  const [monthTab, setMonthTab] = useState(orderedMonths[0] || "");
  const currentMonth = orderedMonths.includes(monthTab) ? monthTab : orderedMonths[0] || "";
  const monthData = (currentMonth && months[currentMonth]) || { label: "", groups: {}, orderedMarhalas: [] };
  const [marhalaTab, setMarhalaTab] = useState(monthData.orderedMarhalas[0] || "General");
  // Data loads async (Firestore) — default tabs once available.
  useEffect(() => {
    if (orderedMonths.length > 0 && !orderedMonths.includes(monthTab)) {
      setMonthTab(orderedMonths[0]);
    }
  }, [orderedMonths, monthTab]);
  useEffect(() => {
    if (monthData.orderedMarhalas.length > 0 && !monthData.orderedMarhalas.includes(marhalaTab)) {
      setMarhalaTab(monthData.orderedMarhalas[0]);
    }
  }, [monthData, marhalaTab]);
  const currentMarhala = monthData.orderedMarhalas.includes(marhalaTab)
    ? marhalaTab
    : monthData.orderedMarhalas[0];
  const rows = (currentMarhala && monthData.groups[currentMarhala]) || [];
  const [downloading, setDownloading] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  const showAction = (type, text) => {
    if (typeof onShowAction === "function") onShowAction(type, text);
  };

  const isLatin = (s) => {
    const t = String(s ?? "").trim();
    return t !== "" && /^[\x00-\x7F]*$/.test(t);
  };
  const numOrDash = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));
  const safeFilePart = (s) => String(s || " ").replace(/[^A-Za-z0-9]+/g, "_");
  const fileStamp = () => new Date().toISOString().split("T")[0];

  /* ── PDF export: text-based A4 Landscape monthly table (never a screenshot,
     so Jadeed totals always render, names wrap, rows never split pages). ── */
  const handleDownloadPDF = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this month yet.");
      return;
    }
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("l", "mm", "a4");
      const PW = 297, PH = 210, M = 10;
      const cols = [
        { h: "Rank", w: 14 },
        { h: "Student", w: 50 },
        { h: "Avg Score", w: 15 },
        { h: "Murajah", w: 17 },
        { h: "Juz Hali", w: 17 },
        { h: "Takhteet", w: 17 },
        { h: "Jadeed", w: 15 },
        { h: "Jadeed Total", w: 54 },
        { h: "Wusool", w: 48 },
        { h: "Attend.", w: 18 },
        { h: "Weeks", w: 12 },
      ];
      const lineH = 4.6, headH = 9;
      const footerY = PH - M + 3;

      const drawPageHead = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(61, 43, 31);
        pdf.text(`Monthly Marhala Result - ${monthData.label} - ${currentMarhala}`, M, M + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 110, 100);
        pdf.text(`${rows.length} students   |   Mauze Tahfeez`, M, M + 13);
        pdf.setDrawColor(212, 175, 55);
        pdf.setLineWidth(0.6);
        pdf.line(M, M + 15.5, PW - M, M + 15.5);
        return M + 18;
      };

      const drawColHeader = (y) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        let x = M;
        cols.forEach((c) => {
          pdf.setFillColor(61, 43, 31);
          pdf.rect(x, y, c.w, headH, "F");
          pdf.setTextColor(255, 233, 168);
          pdf.text(c.h, x + c.w / 2, y + headH / 2 + 1.4, { align: "center" });
          x += c.w;
        });
        return y + headH;
      };

      const drawTrendTri = (cx, cy, dir) => {
        if (dir === "up") {
          pdf.setFillColor(46, 125, 50);
          pdf.triangle(cx - 1.6, cy + 1.4, cx + 1.6, cy + 1.4, cx, cy - 1.8, "F");
        } else if (dir === "down") {
          pdf.setFillColor(198, 40, 40);
          pdf.triangle(cx - 1.6, cy - 1.4, cx + 1.6, cy - 1.4, cx, cy + 1.8, "F");
        }
      };

      let y = drawColHeader(drawPageHead());

      rows.forEach((s, idx) => {
        const unit = s.jadeedUnit === "satar" ? "satar" : "safah";
        const nameLines = [];
        if (isLatin(s.name)) nameLines.push(String(s.name));
        else nameLines.push("Student");
        if (isLatin(s.groupName) && s.groupName !== "Ungrouped") nameLines.push(`(${s.groupName})`);
        const wusoolLines = [`Juz ${s.wusool?.juz || "-"}`];
        if (isLatin(s.wusool?.surah)) wusoolLines.push(String(s.wusool.surah));
        wusoolLines.push(`Pg ${s.wusool?.page || "-"}`);
        const jTotal = `${s.totalJadeed} ${unit}`;
        const jPrev = s.prevJadeed ? `last: ${s.prevJadeed.value} ${s.prevJadeed.unit === "satar" ? "satar" : "safah"}` : "";
        pdf.setFontSize(8);
        const cellLines = [
          [numOrDash(s.marhalaRank)],
          nameLines.flatMap((t) => pdf.splitTextToSize(t, cols[1].w - 3)),
          [numOrDash(s.avgScore)],
          [numOrDash(s.avgMurajazah)],
          [numOrDash(s.avgJuzHali)],
          [numOrDash(s.avgTakhteet)],
          [numOrDash(s.avgJadeedMarks)],
          [jTotal, ...(jPrev ? pdf.splitTextToSize(jPrev, cols[7].w - 3) : [])],
          wusoolLines.flatMap((t) => pdf.splitTextToSize(t, cols[8].w - 3)),
          [`${s.attendanceTotal}/${s.attendanceMax}`],
          [`${s.weeksCount} wks`],
        ];
        const maxLines = Math.max(...cellLines.map((l) => l.length));
        const rowH = maxLines * lineH + 2.5;
        if (y + rowH > footerY - 4) {
          pdf.addPage("a4", "l");
          y = drawColHeader(drawPageHead());
        }
        if (idx % 2 === 0) {
          pdf.setFillColor(252, 250, 245);
          pdf.rect(M, y, cols.reduce((n, c) => n + c.w, 0), rowH, "F");
        }
        let x = M;
        cellLines.forEach((lines, ci) => {
          const cw = cols[ci].w;
          pdf.setDrawColor(230, 220, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(x, y, cw, rowH);
          const leftAlign = ci === 1;
          pdf.setFont("helvetica", ci === 0 && (s.marhalaRank || 99) <= 3 ? "bold" : "normal");
          if (ci === 0 && (s.marhalaRank || 99) <= 3) pdf.setTextColor(150, 110, 20);
          else pdf.setTextColor(61, 43, 31);
          lines.forEach((t, li) => {
            const ty = y + 3.4 + li * lineH;
            if (leftAlign) pdf.text(t, x + 2, ty);
            else pdf.text(t, x + cw / 2, ty, { align: "center" });
          });
          if (ci === 0 && s.marhalaRank && (s.marhalaRankChange === "up" || s.marhalaRankChange === "down")) {
            const tw = pdf.getTextWidth(String(s.marhalaRank));
            drawTrendTri(x + cw / 2 + tw / 2 + 3.2, y + rowH / 2, s.marhalaRankChange);
          }
          if (ci === 7 && (s.jadeedTrend === "up" || s.jadeedTrend === "down")) {
            const firstW = pdf.getTextWidth(jTotal);
            drawTrendTri(x + cw / 2 + firstW / 2 + 3.2, y + 3.4 + lineH / 2 - 1, s.jadeedTrend);
          }
          x += cw;
        });
        y += rowH;
      });

      const total = pdf.getNumberOfPages();
      const stamp = `Generated ${new Date().toLocaleString()} - Mauze Tahfeez`;
      for (let p = 1; p <= total; p++) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(150, 140, 130);
        pdf.text(stamp, M, footerY);
        pdf.text(`Page ${p} of ${total}`, PW - M, footerY, { align: "right" });
      }

      const fileName = `Monthly_Marhala_Result_${safeFilePart(monthData.label)}_${safeFilePart(currentMarhala)}_${fileStamp()}.pdf`;
      const pdfBlob = pdf.output("blob");
      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(pdfBlob, fileName);
      showAction("success", `${monthData.label} result downloaded (${total} page${total > 1 ? "s" : ""}).`);
    } catch (err) {
      console.error("Monthly Marhala PDF error:", err);
      showAction("error", err?.message || "Failed to generate PDF.");
    }
    setDownloading(false);
  };

  /* ── Excel export: styled .xlsx monthly table (brown/gold header, zebra,
     frozen header + autofilter, landscape A4 print fit). ── */
  const handleDownloadExcel = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this month yet.");
      return;
    }
    setDownloadingXlsx(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Mauze Tahfeez";
      wb.created = new Date();
      const sheetName = `${monthData.label} ${currentMarhala}`.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Monthly";
      const ws = wb.addWorksheet(sheetName);

      const HEADERS = [
        "Rank", "Move", "Student", "Group", "Avg Score",
        "Murajah", "Juz Hali", "Takhteet", "Jadeed (avg)",
        "Jadeed Total (month)", "Jadeed Trend", "Wusool", "Attendance", "Weeks",
      ];
      const WIDTHS = [8, 10, 28, 16, 10, 12, 12, 12, 10, 22, 12, 26, 12, 10];
      WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      const BROWN = "FF3D2B1F";
      const GOLD = "FFFFE9A8";
      const GOLD_DARK = "FFB8860B";
      const GREEN = "FF2E7D32";
      const RED = "FFC62828";
      const GREY = "FF888888";
      const GRID = "FFE8E0D2";
      const ZEBRA = "FFFCF8F0";
      const thinBorder = {
        top: { style: "thin", color: { argb: GRID } },
        left: { style: "thin", color: { argb: GRID } },
        bottom: { style: "thin", color: { argb: GRID } },
        right: { style: "thin", color: { argb: GRID } },
      };
      const moveText = (c) => (c === "up" ? "Up" : c === "down" ? "Down" : c === "same" ? "Same" : "");
      const lastCol = String.fromCharCode(64 + HEADERS.length);

      ws.mergeCells(`A1:${lastCol}1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = `Monthly Marhala Result - ${monthData.label} - ${currentMarhala}`;
      titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: BROWN } };
      titleCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 26;
      ws.mergeCells(`A2:${lastCol}2`);
      const subCell = ws.getCell("A2");
      subCell.value = `${rows.length} students  |  Mauze Tahfeez  |  Generated ${new Date().toLocaleString()}`;
      subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF78706A" } };
      subCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(2).height = 18;

      const headRow = ws.getRow(3);
      headRow.height = 24;
      HEADERS.forEach((h, i) => {
        const c = headRow.getCell(i + 1);
        c.value = h;
        c.font = { name: "Calibri", size: 11, bold: true, color: { argb: GOLD } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BROWN } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = thinBorder;
      });

      rows.forEach((s, idx) => {
        const unit = s.jadeedUnit === "satar" ? "satar" : "safah";
        const wusool = [`Juz ${s.wusool?.juz || "-"}`];
        if (s.wusool?.surah) wusool.push(String(s.wusool.surah));
        wusool.push(`Pg ${s.wusool?.page || "-"}`);
        const vals = [
          s.marhalaRank ?? "-",
          moveText(s.marhalaRankChange),
          s.name || "Student",
          s.groupName && s.groupName !== "Ungrouped" ? s.groupName : "",
          s.avgScore,
          s.avgMurajazah,
          s.avgJuzHali,
          s.avgTakhteet,
          s.avgJadeedMarks,
          `${s.totalJadeed} ${unit}${s.prevJadeed ? ` (last: ${s.prevJadeed.value} ${s.prevJadeed.unit === "satar" ? "satar" : "safah"})` : ""}`,
          s.jadeedTrend === "up" ? "Up" : s.jadeedTrend === "down" ? "Down" : "",
          wusool.join(" · "),
          `${s.attendanceTotal}/${s.attendanceMax}`,
          `${s.weeksCount}`,
        ];
        const row = ws.getRow(4 + idx);
        row.height = 22;
        const zebra = idx % 2 === 1;
        vals.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v;
          c.font = { name: "Calibri", size: 11, color: { argb: BROWN } };
          c.alignment = {
            horizontal: i === 2 ? "left" : "center",
            vertical: "middle",
            wrapText: true,
          };
          if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
          c.border = thinBorder;
        });
        if ((s.marhalaRank || 99) <= 3) {
          row.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: GOLD_DARK } };
        }
        [2, 11].forEach((col) => {
          const t = col === 2 ? s.marhalaRankChange : s.jadeedTrend;
          if (t === "up") row.getCell(col).font = { name: "Calibri", size: 11, bold: true, color: { argb: GREEN } };
          else if (t === "down") row.getCell(col).font = { name: "Calibri", size: 11, bold: true, color: { argb: RED } };
          else if (t === "same") row.getCell(col).font = { name: "Calibri", size: 11, color: { argb: GREY } };
        });
      });

      ws.views = [{ state: "frozen", ySplit: 3 }];
      ws.autoFilter = `A3:${lastCol}3`;
      ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      ws.printTitleRow = "1:3";

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(blob, `Monthly_Marhala_Result_${safeFilePart(monthData.label)}_${safeFilePart(currentMarhala)}_${fileStamp()}.xlsx`);
      showAction("success", `${monthData.label} Excel sheet downloaded.`);
    } catch (err) {
      console.error("Monthly Marhala Excel error:", err);
      showAction("error", err?.message || "Failed to generate Excel sheet.");
    }
    setDownloadingXlsx(false);
  };

  if (orderedMonths.length === 0) {
    return (
      <div className="mrk-page fade-in">
        <div className="empty-state">
          <Trophy size={48} style={{ opacity: 0.2 }} />
          <p>No monthly results available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mrk-page fade-in">
      <div className="mrk-page-head">
        <div>
          <h2 className="premium-title mrk-title">
            <Trophy size={22} className="mrk-title-icon" /> Monthly Marhala Results
          </h2>
          <p className="subtitle">
            Month totals <strong>within each Marhala</strong>: avg marks, total Jadeed (سطر / صفه),
            total attendance. Ranked by Avg Score → Jadeed → Jadeed Total → Attendance.
          </p>
        </div>
        <div className="mrk-actions">
          <button
            className="mrk-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={downloading || rows.length === 0}
            title={`Download ${monthData.label} ${currentMarhala} result as A4 Landscape PDF`}
          >
            <Download size={16} /> {downloading ? "Generating…" : `Download PDF Result — ${currentMarhala}`}
          </button>
          <button
            className="mrk-csv-btn"
            onClick={handleDownloadExcel}
            disabled={downloadingXlsx || rows.length === 0}
            title={`Download ${monthData.label} ${currentMarhala} result as a styled Excel sheet`}
          >
            <Download size={16} /> {downloadingXlsx ? "Preparing…" : `Download Excel — ${currentMarhala}`}
          </button>
        </div>
      </div>

      <div className="mrk-tabs" role="tablist" aria-label="Month tabs">
        {orderedMonths.map((mk) => {
          const count = Object.values(months[mk].groups).reduce((n, g) => n + g.length, 0);
          return (
            <button
              key={mk}
              role="tab"
              aria-selected={mk === currentMonth}
              className={`mrk-tab ${mk === currentMonth ? "active" : ""}`}
              onClick={() => setMonthTab(mk)}
            >
              {months[mk].label}
              <span className="mrk-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mrk-subtabs" role="tablist" aria-label="Marhala tabs">
        {monthData.orderedMarhalas.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={m === currentMarhala}
            className={`mrk-tab ${m === currentMarhala ? "active" : ""}`}
            onClick={() => setMarhalaTab(m)}
          >
            {m}
            <span className="mrk-tab-count">{(monthData.groups[m] || []).length}</span>
          </button>
        ))}
      </div>

      <div className="mrk-table-card">
        <div className="mrk-table-title">
          <strong>{monthData.label} — {currentMarhala}</strong>
          <span>{rows.length} students • {rows[0]?.weeksCount || 0} weeks totalled</span>
        </div>
        <div className="mrk-table-scroll">
          <table className="mrk-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Avg Score</th>
                <th>Murajah (avg)</th>
                <th>Juz Hali (avg)</th>
                <th>Takhteet (avg)</th>
                <th>Jadeed (avg)</th>
                <th>Jadeed Total Month (سطر / صفه)</th>
                <th>Wusool (latest)</th>
                <th>Attendance (month)</th>
                <th>Weeks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={`${s.pkey}-${i}`} className={i % 2 === 0 ? "even" : "odd"}>
                  <td><RankBadge rank={s.marhalaRank} change={s.marhalaRankChange} /></td>
                  <td>
                    <div className="mrk-student">
                      <span className="mrk-student-name">{s.name}</span>
                      {s.arabic_name && <span className="mrk-student-ar">{s.arabic_name}</span>}
                      <span className="mrk-student-group">{s.groupName && s.groupName !== "Ungrouped" ? s.groupName : ""}</span>
                    </div>
                  </td>
                  <td><ScorePill value={s.avgScore} max={100} /></td>
                  <td><ScorePill value={s.avgMurajazah} max={30} /></td>
                  <td><ScorePill value={s.avgJuzHali} max={30} /></td>
                  <td><ScorePill value={s.avgTakhteet} max={20} /></td>
                  <td><ScorePill value={s.avgJadeedMarks} max={20} /></td>
                  <td><JadeedTotalBox row={s} /></td>
                  <td>
                    <div className="mrk-wusool">
                      <span>Juz {s.wusool?.juz || "—"}</span>
                      <span>{s.wusool?.surah || ""}</span>
                      <span>Pg {s.wusool?.page || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="mrk-att">
                      <Sparkles size={12} color={(Number(s.attendanceTotal) || 0) > 0 ? "#d4af37" : "#e0ddd8"} />
                      <span>{s.attendanceTotal}/{s.attendanceMax}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mrk-score-pill">{s.weeksCount}<span className="mrk-score-max"> wks</span></span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="mrk-empty">No results recorded for this month yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mrk-legend">
          <span><ArrowUp size={13} className="mrk-glow-green" /> Jadeed total ↑ 1+ satar/safah vs last month (glowing green)</span>
          <span><ArrowDown size={13} className="mrk-flat-red" /> Same or less Jadeed total vs last month (red)</span>
          <span><ArrowUp size={13} className="mrk-arrow-up" /> Rank improved <ArrowDown size={13} className="mrk-arrow-down" /> Rank dropped</span>
        </div>
      </div>
    </div>
  );
}
