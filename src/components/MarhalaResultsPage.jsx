import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Minus, Sparkles, Trophy } from "lucide-react";
import { calculateMarhalaRanks, effectiveScore, parseJadeed } from "../utils/marhalaRanking";

/**
 * MarhalaResultsPage — APPEND-ONLY feature page (Task 3 + Task 5).
 * Does NOT touch Mark Progress logic. Reads students + weeklyResults only.
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

function JadeedBox({ student }) {
  const r = student?.latestResult || {};
  const j = student?.jadeed || parseJadeed(r);
  const trend = student?.jadeedTrend || "neutral";
  const prev = student?.prevJadeed;
  const label = j.unit === "satar" ? "سطر (Satar)" : "صفه (Safah)";
  return (
    <div className={`mrk-jadeed-box trend-${trend}`}>
      <div className="mrk-jadeed-top">
        <span className="mrk-jadeed-val">{j.value}</span>
        <span className="mrk-jadeed-unit">{label}</span>
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
          <>Last wk: {prev.value} {prev.unit === "satar" ? "سطر" : "صفه"}</>
        ) : (
          <>First recorded week</>
        )}
      </div>
    </div>
  );
}

export default function MarhalaResultsPage({ students = [], weeklyResults = [], onShowAction }) {
  const { groups, orderedMarhalas } = useMemo(
    () => calculateMarhalaRanks(students, weeklyResults),
    [students, weeklyResults]
  );
  const [activeTab, setActiveTab] = useState(orderedMarhalas[0] || "General");
  // Data loads async (Firestore) — default to the first Marhala once available.
  useEffect(() => {
    if (orderedMarhalas.length > 0 && !orderedMarhalas.includes(activeTab)) {
      setActiveTab(orderedMarhalas[0]);
    }
  }, [orderedMarhalas, activeTab]);
  const currentTab = orderedMarhalas.includes(activeTab) ? activeTab : orderedMarhalas[0];
  const rows = (currentTab && groups[currentTab]) || [];
  const [downloading, setDownloading] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const tableWrapRef = useRef(null);

  const showAction = (type, text) => {
    if (typeof onShowAction === "function") onShowAction(type, text);
  };

  // Latin-only check: jsPDF standard fonts carry no Arabic glyphs, so only
  // Latin-script text is printed (Arabic fields are skipped, never blank/garbled).
  const isLatin = (s) => {
    const t = String(s ?? "").trim();
    return t !== "" && /^[\x00-\x7F]*$/.test(t);
  };
  const numOrDash = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

  const buildRowCells = (s) => {
    const r = s.latestResult || {};
    const j = s.jadeed || parseJadeed(r);
    const prev = s.prevJadeed || null;
    const nameLines = [];
    if (isLatin(s.name || s.full_name)) nameLines.push(String(s.name || s.full_name));
    else nameLines.push("Student");
    if (isLatin(s.groupName) && s.groupName !== "Ungrouped") nameLines.push(`(${s.groupName})`);
    const wusoolLines = [`Juz ${r.wusool_juz || "-"}`];
    if (isLatin(r.wusool_surah)) wusoolLines.push(String(r.wusool_surah));
    wusoolLines.push(`Pg ${r.wusool_page || "-"}`);
    const jadeedUnit = j.unit === "satar" ? "satar" : "safah";
    const jadeedLines = [`${j.value} ${jadeedUnit}`];
    if (prev) jadeedLines.push(`last: ${prev.value} ${prev.unit === "satar" ? "satar" : "safah"}`);
    return { r, j, prev, nameLines, wusoolLines, jadeedLines };
  };

  /* ── PDF export (Task 5): text-based A4 Landscape table.
     Vector text (never a screenshot) so every column — including Jadeed —
     always renders, long names wrap instead of cutting, and rows never
     split across pages. ── */
  const handleDownloadPDF = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this Marhala yet.");
      return;
    }
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("l", "mm", "a4");
      const PW = 297, PH = 210, M = 10;
      const cols = [
        { h: "Rank", w: 14 },
        { h: "Student", w: 52 },
        { h: "Score", w: 15 },
        { h: "Murajah", w: 18 },
        { h: "Juz Hali", w: 17 },
        { h: "Takhteet", w: 18 },
        { h: "Jadeed", w: 15 },
        { h: "Jadeed This Week", w: 58 },
        { h: "Wusool", w: 55 },
        { h: "Attend.", w: 15 },
      ];
      const lineH = 4.6, headH = 9;
      const weekStr = rows[0]?.latestResult?.week_date ? String(rows[0].latestResult.week_date) : "-";

      const drawPageHead = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(61, 43, 31);
        pdf.text(`Marhala Result - ${currentTab}`, M, M + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 110, 100);
        pdf.text(`Week: ${weekStr}   |   Mauze Tahfeez`, M, M + 13);
        // gold rule
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

      // small filled triangle for up/down movement (green up / red down)
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
      const footerY = PH - M + 3;

      rows.forEach((s, idx) => {
        const { r, jadeedLines, nameLines, wusoolLines } = buildRowCells(s);
        pdf.setFontSize(8);
        const cellLines = [
          [numOrDash(s.marhalaRank)],
          nameLines.flatMap((t) => pdf.splitTextToSize(t, cols[1].w - 3)),
          [numOrDash(effectiveScore(r))],
          [numOrDash(r.murajazah)],
          [numOrDash(r.juz_hali)],
          [numOrDash(r.takhteet)],
          [numOrDash(r.jadeed)],
          jadeedLines.flatMap((t) => pdf.splitTextToSize(t, cols[7].w - 3)),
          wusoolLines.flatMap((t) => pdf.splitTextToSize(t, cols[8].w - 3)),
          [`${r.attendance_count ?? "-"}/6`],
        ];
        const maxLines = Math.max(...cellLines.map((l) => l.length));
        const rowH = maxLines * lineH + 2.5;
        if (y + rowH > footerY - 4) {
          pdf.addPage("a4", "l");
          y = drawColHeader(drawPageHead());
        }
        // zebra
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
          // rank + jadeed movement triangles (never blank, never cut)
          if (ci === 0 && s.marhalaRank && (s.marhalaRankChange === "up" || s.marhalaRankChange === "down")) {
            const tw = pdf.getTextWidth(String(s.marhalaRank));
            drawTrendTri(x + cw / 2 + tw / 2 + 3.2, y + rowH / 2, s.marhalaRankChange);
          }
          if (ci === 7 && (s.jadeedTrend === "up" || s.jadeedTrend === "down")) {
            const firstW = pdf.getTextWidth(jadeedLines[0] || "");
            drawTrendTri(x + cw / 2 + firstW / 2 + 3.2, y + 3.4 + lineH / 2 - 1, s.jadeedTrend);
          }
          x += cw;
        });
        y += rowH;
      });

      // footers with true page count
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

      const safeName = String(currentTab || "Marhala").replace(/[^A-Za-z0-9]+/g, "_");
      const fileName = `Marhala_Result_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`;
      const pdfBlob = pdf.output("blob");
      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(pdfBlob, fileName);
      showAction("success", `${currentTab} result downloaded (${total} page${total > 1 ? "s" : ""}).`);
    } catch (err) {
      console.error("Marhala PDF error:", err);
      showAction("error", err?.message || "Failed to generate PDF.");
    }
    setDownloading(false);
  };

  /* ── Excel export: the same Marhala table as a fully styled .xlsx sheet
     (CSV cannot carry colors/fonts — a real Excel table does). Premium
     brown/gold header, zebra rows, borders, frozen header + autofilter,
     landscape A4 print fit. Loaded on demand so the main bundle is untouched. ── */
  const handleDownloadExcel = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this Marhala yet.");
      return;
    }
    setDownloadingCsv(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Mauze Tahfeez";
      wb.created = new Date();
      const sheetName = String(currentTab || "Marhala").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Marhala";
      const ws = wb.addWorksheet(sheetName);

      const HEADERS = [
        "Rank", "Move", "Student", "Arabic Name", "Group", "Score",
        "Murajah", "Juz Hali", "Takhteet", "Jadeed",
        "Jadeed This Week", "Jadeed Trend", "Wusool", "Attendance",
      ];
      const WIDTHS = [8, 10, 28, 20, 16, 10, 12, 12, 12, 10, 22, 12, 26, 12];
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

      const weekStr = rows[0]?.latestResult?.week_date ? String(rows[0].latestResult.week_date) : "-";
      const lastCol = String.fromCharCode(64 + HEADERS.length);

      // Title + subtitle
      ws.mergeCells(`A1:${lastCol}1`);
      const titleCell = ws.getCell("A1");
      titleCell.value = `Marhala Result - ${currentTab}`;
      titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: BROWN } };
      titleCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 26;
      ws.mergeCells(`A2:${lastCol}2`);
      const subCell = ws.getCell("A2");
      subCell.value = `Week: ${weekStr}  |  Mauze Tahfeez  |  Generated ${new Date().toLocaleString()}`;
      subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF78706A" } };
      subCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(2).height = 18;

      // Header row
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

      // Data rows
      rows.forEach((s, idx) => {
        const r = s.latestResult || {};
        const j = s.jadeed || parseJadeed(r);
        const prev = s.prevJadeed || null;
        const unit = j.unit === "satar" ? "satar" : "safah";
        const wusool = [`Juz ${r.wusool_juz || "-"}`];
        if (r.wusool_surah) wusool.push(String(r.wusool_surah));
        wusool.push(`Pg ${r.wusool_page || "-"}`);
        const vals = [
          s.marhalaRank ?? "-",
          moveText(s.marhalaRankChange),
          s.name || s.full_name || "Student",
          s.arabic_name || "",
          s.groupName && s.groupName !== "Ungrouped" ? s.groupName : "",
          s.latestResult ? effectiveScore(r) : "-",
          r.murajazah ?? "-",
          r.juz_hali ?? "-",
          r.takhteet ?? "-",
          r.jadeed ?? "-",
          `${j.value} ${unit}${prev ? ` (last: ${prev.value} ${prev.unit === "satar" ? "satar" : "safah"})` : ""}`,
          s.jadeedTrend === "up" ? "Up" : s.jadeedTrend === "down" ? "Down" : "",
          wusool.join(" · "),
          r.attendance_count ?? "-",
        ];
        const row = ws.getRow(4 + idx);
        row.height = 22;
        const zebra = idx % 2 === 1;
        vals.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v;
          c.font = { name: "Calibri", size: 11, color: { argb: BROWN } };
          c.alignment = {
            horizontal: i === 2 || i === 3 ? "left" : "center",
            vertical: "middle",
            wrapText: true,
          };
          if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
          c.border = thinBorder;
        });
        // Top-3 rank in gold
        if ((s.marhalaRank || 99) <= 3) {
          row.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: GOLD_DARK } };
        }
        // Movement + Jadeed trend in green/red
        [2, 12].forEach((col) => {
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
      const safeName = String(currentTab || "Marhala").replace(/[^A-Za-z0-9]+/g, "_");
      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(blob, `Marhala_Result_${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`);
      showAction("success", `${currentTab} Excel sheet downloaded.`);
    } catch (err) {
      console.error("Marhala Excel error:", err);
      showAction("error", err?.message || "Failed to generate Excel sheet.");
    }
    setDownloadingCsv(false);
  };

  if (orderedMarhalas.length === 0) {
    return (
      <div className="mrk-page fade-in">
        <div className="empty-state">
          <Trophy size={48} style={{ opacity: 0.2 }} />
          <p>No student results available for Marhala ranking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mrk-page fade-in">
      <div className="mrk-page-head">
        <div>
          <h2 className="premium-title mrk-title">
            <Trophy size={22} className="mrk-title-icon" /> Marhala Results
          </h2>
          <p className="subtitle">
            Ranked <strong>within each Marhala</strong> by Score → Jadeed → Jadeed Pages → Attendance.
            Jadeed box compares this week vs last week.
          </p>
        </div>
        <div className="mrk-actions">
          <button
            className="mrk-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={downloading || rows.length === 0}
            title={`Download ${currentTab} result as A4 Landscape PDF`}
          >
            <Download size={16} /> {downloading ? "Generating…" : `Download PDF Result — ${currentTab}`}
          </button>
          <button
            className="mrk-csv-btn"
            onClick={handleDownloadExcel}
            disabled={downloadingCsv || rows.length === 0}
            title={`Download ${currentTab} result as a styled Excel sheet`}
          >
            <Download size={16} /> {downloadingCsv ? "Preparing…" : `Download Excel — ${currentTab}`}
          </button>
        </div>
      </div>

      <div className="mrk-tabs" role="tablist" aria-label="Marhala tabs">
        {orderedMarhalas.map((m) => {
          const count = (groups[m] || []).filter((s) => s.latestResult).length;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={m === currentTab}
              className={`mrk-tab ${m === currentTab ? "active" : ""}`}
              onClick={() => setActiveTab(m)}
            >
              {m}
              <span className="mrk-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div ref={tableWrapRef} className="mrk-table-card">
        <div className="mrk-table-title">
          <strong>{currentTab}</strong>
          <span>{rows.filter((s) => s.latestResult).length} students • Week: {rows[0]?.latestResult?.week_date || "—"}</span>
        </div>
        <div className="mrk-table-scroll">
          <table className="mrk-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
                <th>Murajah</th>
                <th>Juz Hali</th>
                <th>Takhteet</th>
                <th>Jadeed</th>
                <th>Jadeed This Week (سطر / صفه)</th>
                <th>Wusool</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const r = s.latestResult || {};
                return (
                  <tr key={s.student_id || s.id || i} className={i % 2 === 0 ? "even" : "odd"}>
                    <td><RankBadge rank={s.marhalaRank} change={s.marhalaRankChange} /></td>
                    <td>
                      <div className="mrk-student">
                        <span className="mrk-student-name">{s.name || s.full_name}</span>
                        {s.arabic_name && <span className="mrk-student-ar">{s.arabic_name}</span>}
                        <span className="mrk-student-group">{s.groupName && s.groupName !== "Ungrouped" ? s.groupName : ""}</span>
                      </div>
                    </td>
                    <td><ScorePill value={effectiveScore(r)} max={100} /></td>
                    <td><ScorePill value={r.murajazah ?? "—"} max={30} /></td>
                    <td><ScorePill value={r.juz_hali ?? "—"} max={30} /></td>
                    <td><ScorePill value={r.takhteet ?? "—"} max={20} /></td>
                    <td><ScorePill value={r.jadeed ?? "—"} max={20} /></td>
                    <td><JadeedBox student={s} /></td>
                    <td>
                      <div className="mrk-wusool">
                        <span>Juz {r.wusool_juz || "—"}</span>
                        <span>{r.wusool_surah || ""}</span>
                        <span>Pg {r.wusool_page || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="mrk-att">
                        <Sparkles size={12} color={(Number(r.attendance_count) || 0) > 0 ? "#d4af37" : "#e0ddd8"} />
                        <span>{r.attendance_count ?? "—"}/6</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.filter((s) => s.latestResult).length === 0 && (
                <tr>
                  <td colSpan={10} className="mrk-empty">No results recorded for this Marhala yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mrk-legend">
          <span><ArrowUp size={13} className="mrk-glow-green" /> Jadeed ↑ 1+ satar/safah vs last week (glowing green)</span>
          <span><ArrowDown size={13} className="mrk-flat-red" /> Same or less Jadeed vs last week (red)</span>
          <span><ArrowUp size={13} className="mrk-arrow-up" /> Rank improved <ArrowDown size={13} className="mrk-arrow-down" /> Rank dropped</span>
        </div>
      </div>
    </div>
  );
}
