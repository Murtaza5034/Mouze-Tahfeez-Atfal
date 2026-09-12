import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Minus,
  Sparkles,
  Trophy,
  Search,
  Users,
  CalendarCheck,
  Award,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { calculateMonthlyMarhalaResults, getFatemiHijriMonth } from "../utils/marhalaMonthly";
import { SURAH_NAMES_AR, SURAH_NAMES_EN, getSurahByPage } from "../quranPageMap";

/**
 * Translates/cleans Quran Surah names to pure Latin characters for jsPDF Helvetica,
 * eliminating mojibake / font fallback glyphs (e.g. 'þÿpôpûpõþ-').
 */
function getCleanSurahName(surah, page) {
  const sStr = String(surah || "").trim();
  if (sStr && /^[\x00-\x7F]+$/.test(sStr)) {
    return sStr;
  }
  if (sStr) {
    const idx = SURAH_NAMES_AR.findIndex(
      (ar) => ar === sStr || sStr.includes(ar) || ar.includes(sStr)
    );
    if (idx !== -1 && SURAH_NAMES_EN[idx]) {
      return SURAH_NAMES_EN[idx];
    }
  }
  const pNum = Number(page);
  if (Number.isFinite(pNum) && pNum >= 1 && pNum <= 604) {
    const sObj = getSurahByPage(pNum);
    if (sObj?.nameEn) return sObj.nameEn;
  }
  return "";
}

/**
 * ScorePill — visual score badge with custom coloring.
 */
function ScorePill({ value, max = 100 }) {
  if (value === null || value === undefined || value === "" || value === "—") {
    return <span className="mrk-score-dash">—</span>;
  }
  const v = Number(value) || 0;
  const good = max === 100 ? v >= 80 : max === 30 ? v >= 24 : v >= 15;
  return (
    <span className="mrk-score-pill" data-good={good ? "1" : "0"}>
      {value}
      <span className="mrk-score-max">/{max}</span>
    </span>
  );
}

/**
 * RankBadge — Rank pill with trophy icon for top 3 & movement arrow.
 */
function RankBadge({ rank, change }) {
  if (!rank) return <span className="mrk-rank-empty">—</span>;
  const isTop3 = rank <= 3;
  return (
    <span className="mrk-rank-wrap">
      <span className={`mrk-rank-badge ${isTop3 ? `top top-${rank}` : ""}`}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
      </span>
      {change === "up" && (
        <ArrowUp size={15} strokeWidth={3.2} className="mrk-rank-arrow mrk-arrow-up" title="Rank improved vs last month" />
      )}
      {change === "down" && (
        <ArrowDown size={15} strokeWidth={3.2} className="mrk-rank-arrow mrk-arrow-down" title="Rank dropped vs last month" />
      )}
      {change === "same" && (
        <Minus size={13} strokeWidth={3} className="mrk-rank-arrow mrk-arrow-same" title="Rank maintained" />
      )}
    </span>
  );
}

/**
 * JadeedTotalBox — monthly cumulative jadeed pages/satar with trend arrow.
 */
function JadeedTotalBox({ row }) {
  const trend = row?.jadeedTrend || "neutral";
  const label = row?.jadeedUnit === "satar" ? "سطر (Satar)" : "صفحة (Safah)";
  const prev = row?.prevJadeed;
  return (
    <div className={`mrk-jadeed-box trend-${trend}`}>
      <div className="mrk-jadeed-top">
        <span className="mrk-jadeed-val">{row?.totalJadeed ?? "—"}</span>
        <span className="mrk-jadeed-unit">{label} · Total</span>
        {trend === "up" && (
          <ArrowUp size={18} strokeWidth={3.2} className="mrk-jadeed-arrow mrk-glow-green" title="Improved vs previous month" />
        )}
        {trend === "down" && (
          <ArrowDown size={18} strokeWidth={3.2} className="mrk-jadeed-arrow mrk-flat-red" title="Equal or less than previous month" />
        )}
        {trend === "neutral" && <Minus size={15} className="mrk-jadeed-arrow mrk-neutral" />}
      </div>
      <div className="mrk-jadeed-sub">
        {prev ? (
          <>Last month: {prev.value} {prev.unit === "satar" ? "سطر" : "صفحة"}</>
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
  const monthData = (currentMonth && months[currentMonth]) || {
    label: "",
    groups: {},
    orderedMarhalas: [],
    allStudentsRanked: [],
    distinctMonthWeeks: [],
  };

  // 'ALL' represents the Overall Full Atfal 4-Week Result table
  const [marhalaTab, setMarhalaTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("rank-asc");

  // Keep tabs synchronized when data reloads
  useEffect(() => {
    if (orderedMonths.length > 0 && !orderedMonths.includes(monthTab)) {
      setMonthTab(orderedMonths[0]);
    }
  }, [orderedMonths, monthTab]);

  useEffect(() => {
    if (
      marhalaTab !== "ALL" &&
      monthData.orderedMarhalas.length > 0 &&
      !monthData.orderedMarhalas.includes(marhalaTab)
    ) {
      setMarhalaTab("ALL");
    }
  }, [monthData, marhalaTab]);

  const isOverall = marhalaTab === "ALL";
  const currentMarhala = isOverall ? "ALL" : marhalaTab;

  const rawRows = useMemo(() => {
    if (isOverall) {
      return monthData.allStudentsRanked || [];
    }
    return monthData.groups[currentMarhala] || [];
  }, [isOverall, monthData, currentMarhala]);

  // Search & Sorting Filter
  const rows = useMemo(() => {
    let list = [...rawRows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.arabic_name && s.arabic_name.includes(q)) ||
          (s.its && String(s.its).includes(q)) ||
          (s.groupName && s.groupName.toLowerCase().includes(q)) ||
          (s.marhala && s.marhala.toLowerCase().includes(q)) ||
          (s.teacherName && s.teacherName.toLowerCase().includes(q))
      );
    }

    if (sortBy === "rank-asc") {
      list.sort((a, b) => {
        const rA = isOverall ? (a.overallRank || 9999) : (a.marhalaRank || 9999);
        const rB = isOverall ? (b.overallRank || 9999) : (b.marhalaRank || 9999);
        return rA - rB;
      });
    } else if (sortBy === "rank-desc") {
      list.sort((a, b) => {
        const rA = isOverall ? (a.overallRank || 0) : (a.marhalaRank || 0);
        const rB = isOverall ? (b.overallRank || 0) : (b.marhalaRank || 0);
        return rB - rA;
      });
    } else if (sortBy === "score-desc") {
      list.sort((a, b) => (Number(b.avgScore) || 0) - (Number(a.avgScore) || 0));
    } else if (sortBy === "name-asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sortBy === "jadeed-desc") {
      list.sort((a, b) => (Number(b.totalJadeed) || 0) - (Number(a.totalJadeed) || 0));
    } else if (sortBy === "att-desc") {
      list.sort((a, b) => (Number(b.attendanceTotal) || 0) - (Number(a.attendanceTotal) || 0));
    }

    return list;
  }, [rawRows, searchQuery, sortBy, isOverall]);

  const [downloading, setDownloading] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

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

  const distinctWeeks = monthData.distinctMonthWeeks || [];

  // Helper to extract a student's week result for column wIdx (0, 1, 2, 3...)
  const getStudentWeek = (s, wIdx) => {
    if (!s) return null;
    const info = getWeekSlotInfo(wIdx);
    // 1. Match by weekNum via weeksByWeekNum
    if (info?.weekNum && s.weeksByWeekNum && s.weeksByWeekNum[info.weekNum]) {
      return s.weeksByWeekNum[info.weekNum];
    }
    const targetDate = distinctWeeks[wIdx];
    // 2. Direct match by exact week_date from weeksByDate
    if (targetDate && s.weeksByDate && s.weeksByDate[targetDate]) {
      return s.weeksByDate[targetDate];
    }
    // 3. Direct match by week_date from weeksData
    if (targetDate && Array.isArray(s.weeksData)) {
      const found = s.weeksData.find((w) => w.week_date === targetDate);
      if (found) return found;
    }
    // 4. Fallback: match by weekNum in weeksData
    if (info?.weekNum && Array.isArray(s.weeksData)) {
      const found = s.weeksData.find((w) => w.weekIndex === info.weekNum || w.weekNum === info.weekNum);
      if (found) return found;
    }
    return null;
  };

  // Structured week metadata for headers & exports (matches Parents Portal Week numbers: Week 1, Week 2, Week 4, Week 5)
  const getWeekSlotInfo = (wIdx) => {
    if (monthData.monthWeeksInfo && monthData.monthWeeksInfo[wIdx]) {
      return monthData.monthWeeksInfo[wIdx];
    }
    const dStr = distinctWeeks[wIdx] || "";
    if (dStr) {
      try {
        const parts = dStr.split("-");
        const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        const greg = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        const fi = getFatemiHijriMonth(dStr);
        const weekNum = fi && fi.date ? Math.ceil(fi.date / 7) : (wIdx + 1);
        const hijriText = fi && fi.date ? `${fi.date} ${fi.nameEn ? fi.nameEn.split(" ")[0] : "Rabi"}` : "";
        return {
          index: wIdx,
          weekNum,
          title: `Week ${wIdx + 1}`,
          dateStr: dStr,
          greg,
          hijriText,
          fullLabel: hijriText ? `${greg} • ${hijriText}` : greg,
        };
      } catch (_) {}
    }
    // Fallback default week mapping: 1, 2, 4, 5
    const fallbackNums = [1, 2, 4, 5];
    const weekNum = fallbackNums[wIdx] || (wIdx + 1);
    return {
      index: wIdx,
      weekNum,
      title: `Week ${wIdx + 1}`,
      dateStr: "",
      greg: "",
      hijriText: "",
      fullLabel: `Week ${wIdx + 1}`,
    };
  };

  const formatWeekLabel = (wIdx) => {
    const info = getWeekSlotInfo(wIdx);
    return `Week ${wIdx + 1} (${info.fullLabel || info.greg || ""})`;
  };

  // Quick summary metrics for the month
  const overallRows = monthData.allStudentsRanked || [];
  const classAvgScore = useMemo(() => {
    if (overallRows.length === 0) return 0;
    const total = overallRows.reduce((acc, r) => acc + (Number(r.avgScore) || 0), 0);
    return Math.round((total / overallRows.length) * 10) / 10;
  }, [overallRows]);

  const topScorer = overallRows[0] || null;

  /* ── 1. PDF Export: Generates clean A4 Landscape table for Overall (4 Weeks) or Marhala ── */
  const handleDownloadPDF = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this month yet.");
      return;
    }
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
      const PW = 297, PH = 210, M = 9;

      const info1 = getWeekSlotInfo(0);
      const info2 = getWeekSlotInfo(1);
      const info3 = getWeekSlotInfo(2);
      const info4 = getWeekSlotInfo(3);

      // Dynamic columns for Overall (with 4 distinct weeks) vs Marhala
      const cols = isOverall
        ? [
            { h: "Rank", w: 12 },
            { h: "Student Name", w: 48 },
            { h: "Marhala", w: 18 },
            { h: `W1 (${info1.greg || "Aug 14"})`, w: 17 },
            { h: `W2 (${info2.greg || "Aug 21"})`, w: 17 },
            { h: `W3 (${info3.greg || "Sep 04"})`, w: 17 },
            { h: `W4 (${info4.greg || "Sep 11"})`, w: 17 },
            { h: "Monthly Avg", w: 22 },
            { h: "Murajah (/100)", w: 20 },
            { h: "Juz Hali (/100)", w: 20 },
            { h: "Total Jadeed", w: 26 },
            { h: "Attend. (/22)", w: 17 },
            { h: "Latest Wusool", w: 28 },
          ]
        : [
            { h: "Rank", w: 14 },
            { h: "Student Name", w: 58 },
            { h: "Avg Score", w: 20 },
            { h: "Murajah (/100)", w: 22 },
            { h: "Juz Hali (/100)", w: 22 },
            { h: "Jadeed Total", w: 48 },
            { h: "Latest Wusool", w: 45 },
            { h: "Attend. (/22)", w: 26 },
            { h: "Weeks", w: 24 },
          ];

      const headH = 7.5;
      const footerY = PH - 6;
      const rowH = 7.3;
      const lineH = 2.8;

      // Ensure 41 students fit cleanly onto 2 equal A4 landscape pages (21 on P1, 20 on P2)
      const rowsPerPage = rows.length <= 44 ? Math.ceil(rows.length / 2) : 22;

      const drawPageHead = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(43, 26, 16);
        const titleText = isOverall
          ? `Monthly Full Atfal Result — ${monthData.label} (Dates 1–30 / 4 Weeks Breakdown)`
          : `Monthly Marhala Result — ${monthData.label} — ${currentMarhala}`;
        pdf.text(titleText, M, M + 4.5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(110, 95, 80);
        pdf.text(
          `${rows.length} Atfal students  |  Mauze Tahfeez  |  Rank Sorted Result  |  A4 Landscape`,
          M,
          M + 9
        );

        pdf.setDrawColor(212, 175, 55);
        pdf.setLineWidth(0.5);
        pdf.line(M, M + 11.5, PW - M, M + 11.5);
        return M + 13.5;
      };

      const drawColHeader = (y) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.2);
        let x = M;
        cols.forEach((c) => {
          pdf.setFillColor(43, 26, 16);
          pdf.rect(x, y, c.w, headH, "F");
          pdf.setTextColor(255, 233, 168);
          pdf.text(c.h, x + c.w / 2, y + headH / 2 + 1.2, { align: "center" });
          x += c.w;
        });
        return y + headH;
      };

      const drawTrendTri = (cx, cy, dir) => {
        if (dir === "up") {
          pdf.setFillColor(46, 125, 50);
          pdf.triangle(cx - 1.4, cy + 1.2, cx + 1.4, cy + 1.2, cx, cy - 1.5, "F");
        } else if (dir === "down") {
          pdf.setFillColor(198, 40, 40);
          pdf.triangle(cx - 1.4, cy - 1.2, cx + 1.4, cy - 1.2, cx, cy + 1.5, "F");
        }
      };

      let y = drawColHeader(drawPageHead());

      rows.forEach((s, idx) => {
        // Page break trigger: split evenly across 2 pages without cutting any row
        if (idx > 0 && idx === rowsPerPage) {
          pdf.addPage("a4", "landscape");
          y = drawColHeader(drawPageHead());
        } else if (y + rowH > footerY - 5) {
          pdf.addPage("a4", "landscape");
          y = drawColHeader(drawPageHead());
        }

        const unit = s.jadeedUnit === "satar" ? "satar" : "safah";
        const nameLines = [];
        if (isLatin(s.name)) nameLines.push(String(s.name));
        else nameLines.push("Student");
        if (isLatin(s.groupName) && s.groupName !== "Ungrouped") nameLines.push(`(${s.groupName})`);

        const cleanSurah = getCleanSurahName(s.wusool?.surah, s.wusool?.page);
        const wusoolLines = [
          `Juz ${s.wusool?.juz || "-"}${cleanSurah ? " · " + cleanSurah : ""}`,
          `Pg ${s.wusool?.page || "-"}`,
        ];

        const jTotal = `${s.totalJadeed} ${unit}`;
        pdf.setFontSize(7);

        let cellLines = [];
        if (isOverall) {
          const w1 = getStudentWeek(s, 0);
          const w2 = getStudentWeek(s, 1);
          const w3 = getStudentWeek(s, 2);
          const w4 = getStudentWeek(s, 3);
          const formatWCell = (w) => (w ? [`${w.score}`, `Att: ${w.attendance_count}/${w.attendance_max || 6}`] : ["—"]);
          cellLines = [
            [numOrDash(s.overallRank ?? s.marhalaRank)],
            nameLines.flatMap((t) => pdf.splitTextToSize(t, cols[1].w - 3)),
            [String(s.marhala || "General")],
            formatWCell(w1),
            formatWCell(w2),
            formatWCell(w3),
            formatWCell(w4),
            [numOrDash(s.avgScore)],
            [numOrDash(s.avgMurajazah100 ?? s.avgMurajazah)],
            [numOrDash(s.avgJuzHali100 ?? s.avgJuzHali)],
            [jTotal],
            [`${s.attendanceTotal}/${s.attendanceMax}`],
            wusoolLines.flatMap((t) => pdf.splitTextToSize(t, cols[12].w - 2)),
          ];
        } else {
          const jPrev = s.prevJadeed ? `last: ${s.prevJadeed.value}` : "";
          cellLines = [
            [numOrDash(s.marhalaRank)],
            nameLines.flatMap((t) => pdf.splitTextToSize(t, cols[1].w - 3)),
            [numOrDash(s.avgScore)],
            [numOrDash(s.avgMurajazah100 ?? s.avgMurajazah)],
            [numOrDash(s.avgJuzHali100 ?? s.avgJuzHali)],
            [jTotal, ...(jPrev ? pdf.splitTextToSize(jPrev, cols[5].w - 3) : [])],
            wusoolLines.flatMap((t) => pdf.splitTextToSize(t, cols[6].w - 3)),
            [`${s.attendanceTotal}/${s.attendanceMax}`],
            [`${s.weeksCount} wks`],
          ];
        }

        // Alternating row background
        if (idx % 2 === 0) {
          pdf.setFillColor(252, 250, 245);
          pdf.rect(M, y, cols.reduce((n, c) => n + c.w, 0), rowH, "F");
        }

        let x = M;
        const currentRank = isOverall ? s.overallRank : s.marhalaRank;
        const currentChange = isOverall ? s.overallRankChange : s.marhalaRankChange;

        cellLines.forEach((lines, ci) => {
          const cw = cols[ci].w;
          pdf.setDrawColor(230, 220, 200);
          pdf.setLineWidth(0.2);
          pdf.rect(x, y, cw, rowH);

          pdf.setFont("helvetica", ci === 0 && (currentRank || 99) <= 3 ? "bold" : "normal");

          if (ci === 0 && (currentRank || 99) <= 3) {
            pdf.setTextColor(180, 130, 20);
          } else {
            pdf.setTextColor(43, 26, 16);
          }

          const totalLinesH = lines.length * lineH;
          const startTy = y + (rowH - totalLinesH) / 2 + 2.1;

          lines.forEach((t, li) => {
            const ty = startTy + li * lineH;
            pdf.text(t, x + cw / 2, ty, { align: "center" });
          });

          if (ci === 0 && currentRank && (currentChange === "up" || currentChange === "down")) {
            const tw = pdf.getTextWidth(String(currentRank));
            drawTrendTri(x + cw / 2 + tw / 2 + 2.5, y + rowH / 2, currentChange);
          }

          const jColIdx = isOverall ? 10 : 5;
          if (ci === jColIdx && (s.jadeedTrend === "up" || s.jadeedTrend === "down")) {
            const firstW = pdf.getTextWidth(jTotal);
            drawTrendTri(x + cw / 2 + firstW / 2 + 2.5, y + rowH / 2, s.jadeedTrend);
          }

          x += cw;
        });

        y += rowH;
      });

      const total = pdf.getNumberOfPages();
      const stamp = `Generated ${new Date().toLocaleString()} - Mauze Tahfeez - A4 Landscape`;
      for (let p = 1; p <= total; p++) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(140, 130, 120);
        pdf.text(stamp, M, footerY);
        pdf.text(`Page ${p} of ${total}`, PW - M, footerY, { align: "right" });
      }

      const fileName = isOverall
        ? `Monthly_Result_Full_Atfal_${safeFilePart(monthData.label)}_4Weeks_${fileStamp()}.pdf`
        : `Monthly_Marhala_Result_${safeFilePart(monthData.label)}_${safeFilePart(currentMarhala)}_${fileStamp()}.pdf`;

      const pdfBlob = pdf.output("blob");
      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(pdfBlob, fileName);
      showAction("success", `${monthData.label} PDF result downloaded successfully.`);
    } catch (err) {
      console.error("Monthly PDF error:", err);
      showAction("error", err?.message || "Failed to generate PDF.");
    }
    setDownloading(false);
  };

  /* ── 2. CSV Export: UTF-8 BOM CSV supporting Arabic script, 4 weeks, and rankings ── */
  const handleDownloadCSV = async () => {
    if (rows.length === 0) {
      showAction("error", "Nothing to export for this month yet.");
      return;
    }
    setDownloadingCsv(true);
    try {
      const headers = isOverall
        ? [
            "Overall Rank",
            "Marhala Rank",
            "Student Name",
            "Arabic Name",
            "ITS",
            "Group",
            "Marhala",
            formatWeekLabel(0) + " Score",
            formatWeekLabel(1) + " Score",
            formatWeekLabel(2) + " Score",
            formatWeekLabel(3) + " Score",
            "Monthly Avg Score (/100)",
            "Murajah Avg (/100)",
            "Juz Hali Avg (/100)",
            "Total Jadeed Month",
            "Jadeed Unit",
            "Jadeed Trend",
            "Attendance (Days Present / 22)",
            "Attendance Max (22)",
            "Wusool Juz",
            "Wusool Surah",
            "Wusool Page",
          ]
        : [
            "Marhala Rank",
            "Student Name",
            "Arabic Name",
            "ITS",
            "Group",
            "Marhala",
            "Monthly Avg Score (/100)",
            "Murajah Avg (/100)",
            "Juz Hali Avg (/100)",
            "Total Jadeed Month",
            "Jadeed Unit",
            "Jadeed Trend",
            "Attendance (Days Present / 22)",
            "Attendance Max (22)",
            "Weeks Totalled",
            "Wusool Juz",
            "Wusool Surah",
            "Wusool Page",
          ];

      const escapeCsv = (val) => {
        const str = String(val ?? "").replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvRows = [headers.map(escapeCsv).join(",")];

      rows.forEach((s) => {
        const w1 = getStudentWeek(s, 0);
        const w2 = getStudentWeek(s, 1);
        const w3 = getStudentWeek(s, 2);
        const w4 = getStudentWeek(s, 3);
        const rowVals = isOverall
          ? [
              s.overallRank ?? "-",
              s.marhalaRank ?? "-",
              s.name || "Student",
              s.arabic_name || "",
              s.its || "",
              s.groupName || "",
              s.marhala || "General",
              w1 ? `${w1.score}/100` : "-",
              w2 ? `${w2.score}/100` : "-",
              w3 ? `${w3.score}/100` : "-",
              w4 ? `${w4.score}/100` : "-",
              s.avgScore ?? "-",
              s.avgMurajazah100 ?? s.avgMurajazah ?? "-",
              s.avgJuzHali100 ?? s.avgJuzHali ?? "-",
              s.totalJadeed ?? "0",
              s.jadeedUnit || "safah",
              s.jadeedTrend || "neutral",
              s.attendanceTotal ?? "0",
              s.attendanceMax ?? "22",
              s.wusool?.juz || "-",
              s.wusool?.surah || "-",
              s.wusool?.page || "-",
            ]
          : [
              s.marhalaRank ?? "-",
              s.name || "Student",
              s.arabic_name || "",
              s.its || "",
              s.groupName || "",
              s.marhala || "General",
              s.avgScore ?? "-",
              s.avgMurajazah100 ?? s.avgMurajazah ?? "-",
              s.avgJuzHali100 ?? s.avgJuzHali ?? "-",
              s.totalJadeed ?? "0",
              s.jadeedUnit || "safah",
              s.jadeedTrend || "neutral",
              s.attendanceTotal ?? "0",
              s.attendanceMax ?? "22",
              s.weeksCount ?? "0",
              s.wusool?.juz || "-",
              s.wusool?.surah || "-",
              s.wusool?.page || "-",
            ];
        csvRows.push(rowVals.map(escapeCsv).join(","));
      });

      // UTF-8 BOM ensures Arabic script renders smoothly without mojibake
      const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const fileName = isOverall
        ? `Monthly_Result_Full_Atfal_${safeFilePart(monthData.label)}_4Weeks_${fileStamp()}.csv`
        : `Monthly_Marhala_Result_${safeFilePart(monthData.label)}_${safeFilePart(currentMarhala)}_${fileStamp()}.csv`;

      const { downloadFile } = await import("../downloadUtils");
      await downloadFile(blob, fileName);
      showAction("success", `${monthData.label} CSV result downloaded successfully.`);
    } catch (err) {
      console.error("Monthly CSV error:", err);
      showAction("error", err?.message || "Failed to generate CSV file.");
    }
    setDownloadingCsv(false);
  };

  /* ── 3. Excel (.xlsx) Export: styled workbook with frozen header & auto-filter ── */
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
      const sheetName = isOverall
        ? `${monthData.label} Overall 4W`.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31)
        : `${monthData.label} ${currentMarhala}`.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
      const ws = wb.addWorksheet(sheetName || "Monthly");

      const info1 = getWeekSlotInfo(0);
      const info2 = getWeekSlotInfo(1);
      const info3 = getWeekSlotInfo(2);
      const info4 = getWeekSlotInfo(3);

      const HEADERS = isOverall
        ? [
            "Rank", "Student", "Group", "ITS", "Marhala",
            `Week 1 (${info1.fullLabel})`,
            `Week 2 (${info2.fullLabel})`,
            `Week 3 (${info3.fullLabel})`,
            `Week 4 (${info4.fullLabel})`,
            "Avg Score (/100)", "Murajah (/100)", "Juz Hali (/100)",
            "Jadeed Total", "Trend", "Attendance (/22)", "Wusool",
          ]
        : [
            "Rank", "Move", "Student", "Group", "Avg Score (/100)",
            "Murajah (/100)", "Juz Hali (/100)",
            "Jadeed Total (month)", "Jadeed Trend", "Wusool", "Attendance (/22)", "Weeks",
          ];

      const WIDTHS = isOverall
        ? [8, 26, 15, 12, 14, 16, 16, 16, 16, 15, 15, 15, 18, 10, 15, 22]
        : [8, 10, 28, 16, 15, 15, 15, 22, 12, 26, 15, 10];

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
      titleCell.value = isOverall
        ? `Monthly Full Atfal Result — ${monthData.label} (Dates 1–30 / 4 Weeks Overall)`
        : `Monthly Marhala Result — ${monthData.label} — ${currentMarhala}`;
      titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: BROWN } };
      titleCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(1).height = 26;

      ws.mergeCells(`A2:${lastCol}2`);
      const subCell = ws.getCell("A2");
      subCell.value = `${rows.length} Atfal students  |  Mauze Tahfeez  |  Generated ${new Date().toLocaleString()}`;
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

        let vals = [];
        if (isOverall) {
          const w1 = getStudentWeek(s, 0);
          const w2 = getStudentWeek(s, 1);
          const w3 = getStudentWeek(s, 2);
          const w4 = getStudentWeek(s, 3);
          vals = [
            s.overallRank ?? "-",
            s.name || "Student",
            s.groupName && s.groupName !== "Ungrouped" ? s.groupName : "",
            s.its || "",
            s.marhala || "General",
            w1 ? w1.score : "-",
            w2 ? w2.score : "-",
            w3 ? w3.score : "-",
            w4 ? w4.score : "-",
            s.avgScore ?? "-",
            s.avgMurajazah100 ?? s.avgMurajazah ?? "-",
            s.avgJuzHali100 ?? s.avgJuzHali ?? "-",
            `${s.totalJadeed} ${unit}`,
            s.jadeedTrend === "up" ? "Up" : s.jadeedTrend === "down" ? "Down" : "",
            `${s.attendanceTotal}/${s.attendanceMax}`,
            wusool.join(" · "),
          ];
        } else {
          vals = [
            s.marhalaRank ?? "-",
            moveText(s.marhalaRankChange),
            s.name || "Student",
            s.groupName && s.groupName !== "Ungrouped" ? s.groupName : "",
            s.avgScore,
            s.avgMurajazah100 ?? s.avgMurajazah,
            s.avgJuzHali100 ?? s.avgJuzHali,
            `${s.totalJadeed} ${unit}${s.prevJadeed ? ` (last: ${s.prevJadeed.value})` : ""}`,
            s.jadeedTrend === "up" ? "Up" : s.jadeedTrend === "down" ? "Down" : "",
            wusool.join(" · "),
            `${s.attendanceTotal}/${s.attendanceMax}`,
            `${s.weeksCount}`,
          ];
        }

        const row = ws.getRow(4 + idx);
        row.height = 22;
        const zebra = idx % 2 === 1;
        vals.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v;
          c.font = { name: "Calibri", size: 11, color: { argb: BROWN } };
          c.alignment = {
            horizontal: i === 1 || (!isOverall && i === 2) ? "left" : "center",
            vertical: "middle",
            wrapText: true,
          };
          if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
          c.border = thinBorder;
        });

        const curRank = isOverall ? s.overallRank : s.marhalaRank;
        if ((curRank || 99) <= 3) {
          row.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: GOLD_DARK } };
        }
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
      const fileName = isOverall
        ? `Monthly_Result_Full_Atfal_${safeFilePart(monthData.label)}_4Weeks_${fileStamp()}.xlsx`
        : `Monthly_Marhala_Result_${safeFilePart(monthData.label)}_${safeFilePart(currentMarhala)}_${fileStamp()}.xlsx`;

      await downloadFile(blob, fileName);
      showAction("success", `${monthData.label} Excel sheet downloaded.`);
    } catch (err) {
      console.error("Monthly Excel error:", err);
      showAction("error", err?.message || "Failed to generate Excel sheet.");
    }
    setDownloadingXlsx(false);
  };

  if (orderedMonths.length === 0) {
    return (
      <div className="mrk-page fade-in">
        <div className="empty-state">
          <Trophy size={48} style={{ opacity: 0.2 }} />
          <p>No monthly results recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mrk-page fade-in">
      {/* ── 1. Page Header ── */}
      <div className="mrk-page-head">
        <div>
          <div className="mrk-title-badge-row">
            <h2 className="premium-title mrk-title">
              <Trophy size={24} className="mrk-title-icon" /> Monthly Atfal Results
            </h2>
            <span className="mrk-month-active-badge">{monthData.label}</span>
          </div>
          <p className="subtitle">
            Comprehensive 4-week (Dates 1–30) student rankings & Marhala-wise performance analysis.
          </p>
        </div>

        {/* Action Buttons: PDF, CSV, Excel */}
        <div className="mrk-actions">
          <button
            className="mrk-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={downloading || rows.length === 0}
            title={`Download ${monthData.label} ${isOverall ? "All Atfal (4 Weeks)" : currentMarhala} result as A4 Landscape PDF`}
          >
            <Download size={16} /> {downloading ? "Generating PDF…" : `Download PDF — ${isOverall ? "All Atfal" : currentMarhala}`}
          </button>
          <button
            className="mrk-csv-btn"
            onClick={handleDownloadCSV}
            disabled={downloadingCsv || rows.length === 0}
            title={`Download ${monthData.label} ${isOverall ? "All Atfal (4 Weeks)" : currentMarhala} as CSV spreadsheet`}
          >
            <FileSpreadsheet size={16} /> {downloadingCsv ? "Preparing CSV…" : `Download CSV`}
          </button>
          <button
            className="mrk-excel-btn"
            onClick={handleDownloadExcel}
            disabled={downloadingXlsx || rows.length === 0}
            title={`Download ${monthData.label} ${isOverall ? "All Atfal (4 Weeks)" : currentMarhala} as a styled Excel workbook`}
          >
            <Download size={16} /> {downloadingXlsx ? "Preparing Excel…" : `Download Excel`}
          </button>
        </div>
      </div>

      {/* ── 2. Primary Month Selection Tabs ── */}
      <div className="mrk-tabs" role="tablist" aria-label="Month tabs">
        {orderedMonths.map((mk) => {
          const count = (months[mk]?.allStudentsRanked || []).length ||
            Object.values(months[mk].groups).reduce((n, g) => n + g.length, 0);
          return (
            <button
              key={mk}
              role="tab"
              aria-selected={mk === currentMonth}
              className={`mrk-tab ${mk === currentMonth ? "active" : ""}`}
              onClick={() => setMonthTab(mk)}
            >
              <CalendarCheck size={14} style={{ marginRight: 6 }} />
              {months[mk].label}
              <span className="mrk-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── 3. Quick Month Overview Stats Ribbon (Shown when viewing Overall) ── */}
      {isOverall && overallRows.length > 0 && (
        <div className="mrk-overall-stats-grid fade-in">
          <div className="mrk-stat-card gold">
            <div className="mrk-stat-icon">
              <Users size={20} />
            </div>
            <div>
              <span className="mrk-stat-label">Total Atfal Ranked</span>
              <strong className="mrk-stat-val">{overallRows.length} Students</strong>
            </div>
          </div>
          <div className="mrk-stat-card emerald">
            <div className="mrk-stat-icon">
              <Trophy size={20} />
            </div>
            <div>
              <span className="mrk-stat-label">Monthly Champion (#1)</span>
              <strong className="mrk-stat-val">
                {topScorer?.name || "—"} ({topScorer?.avgScore || 0}/100)
              </strong>
            </div>
          </div>
          <div className="mrk-stat-card purple">
            <div className="mrk-stat-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="mrk-stat-label">Month Class Average</span>
              <strong className="mrk-stat-val">{classAvgScore} / 100</strong>
            </div>
          </div>
          <div className="mrk-stat-card blue">
            <div className="mrk-stat-icon">
              <CalendarCheck size={20} />
            </div>
            <div>
              <span className="mrk-stat-label">Dates Cycle (4 Weeks)</span>
              <strong className="mrk-stat-val">
                {getWeekSlotInfo(0).greg || "15 Aug"} – {getWeekSlotInfo(3).greg || "11 Sep"} (Dates 1–30)
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Sub-tabs: 'All Atfal (Overall Ranking)' + Individual Marhalas ── */}
      <div className="mrk-subtabs" role="tablist" aria-label="Marhala tabs">
        {/* Tab 1: Overall Full Atfal Students */}
        <button
          role="tab"
          aria-selected={isOverall}
          className={`mrk-tab mrk-tab-all ${isOverall ? "active" : ""}`}
          onClick={() => setMarhalaTab("ALL")}
        >
          <Trophy size={14} style={{ marginRight: 6 }} />
          All Atfal (Overall Ranking)
          <span className="mrk-tab-count">{overallRows.length}</span>
        </button>

        {/* Marhala-wise Tabs (Preserved exactly as before) */}
        {monthData.orderedMarhalas.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={m === currentMarhala && !isOverall}
            className={`mrk-tab ${m === currentMarhala && !isOverall ? "active" : ""}`}
            onClick={() => setMarhalaTab(m)}
          >
            <Layers size={13} style={{ marginRight: 5 }} />
            {m}
            <span className="mrk-tab-count">{(monthData.groups[m] || []).length}</span>
          </button>
        ))}
      </div>

      {/* ── 5. Search & Sorting Toolbar ── */}
      <div className="mrk-toolbar">
        <div className="mrk-search-wrap">
          <Search size={16} className="mrk-search-icon" />
          <input
            type="text"
            className="mrk-search-input"
            placeholder="Search student by name, ITS, group or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mrk-sort-wrap">
          <label className="mrk-sort-label">Sort by:</label>
          <select
            className="mrk-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="rank-asc">Rank: Highest First (#1 →)</option>
            <option value="score-desc">Average Score (High → Low)</option>
            <option value="name-asc">Student Name (A → Z)</option>
            <option value="jadeed-desc">Jadeed Total Pages (High → Low)</option>
            <option value="att-desc">Attendance (High → Low)</option>
            <option value="rank-desc">Rank: Lowest First</option>
          </select>
        </div>
      </div>

      {/* ── 6. Result Table Card ── */}
      <div className="mrk-table-card">
        <div className="mrk-table-title">
          <div className="mrk-table-title-left">
            <strong>
              {isOverall
                ? `All Atfal Monthly Results (Dates 1–30 / 4 Weeks) — ${monthData.label}`
                : `${monthData.label} — ${currentMarhala}`}
            </strong>
            <span className="mrk-table-badge">
              {rows.length} {rows.length === 1 ? "student" : "students"}
            </span>
          </div>
          <span className="mrk-table-sub">
            {isOverall
              ? "Full Atfal ranked by Overall Monthly Performance • 4 Weeks breakdown"
              : `${rows[0]?.weeksCount || 0} weeks totalled within ${currentMarhala}`}
          </span>
        </div>

        <div className="mrk-table-scroll">
          <table className="mrk-table">
            <thead>
              {isOverall ? (
                /* Overall 4-Week Headers */
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Marhala</th>
                  <th className="mrk-th-week">
                    <div className="mrk-th-week-title">{getWeekSlotInfo(0).title}</div>
                    <div className="mrk-th-week-sub">{getWeekSlotInfo(0).fullLabel}</div>
                  </th>
                  <th className="mrk-th-week">
                    <div className="mrk-th-week-title">{getWeekSlotInfo(1).title}</div>
                    <div className="mrk-th-week-sub">{getWeekSlotInfo(1).fullLabel}</div>
                  </th>
                  <th className="mrk-th-week">
                    <div className="mrk-th-week-title">{getWeekSlotInfo(2).title}</div>
                    <div className="mrk-th-week-sub">{getWeekSlotInfo(2).fullLabel}</div>
                  </th>
                  <th className="mrk-th-week">
                    <div className="mrk-th-week-title">{getWeekSlotInfo(3).title}</div>
                    <div className="mrk-th-week-sub">{getWeekSlotInfo(3).fullLabel}</div>
                  </th>
                  <th className="mrk-th-highlight">Monthly Avg Score</th>
                  <th>Murajah (/100)</th>
                  <th>Juz Hali (/100)</th>
                  <th>Jadeed Total Month</th>
                  <th>Attendance (/22)</th>
                  <th>Latest Wusool</th>
                </tr>
              ) : (
                /* Marhala-Wise Headers (Preserved) */
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Avg Score</th>
                  <th>Murajah (/100)</th>
                  <th>Juz Hali (/100)</th>
                  <th>Jadeed Total Month (سطر / صفحة)</th>
                  <th>Wusool (latest)</th>
                  <th>Attendance (/22)</th>
                  <th>Weeks</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const rankToUse = isOverall ? s.overallRank : s.marhalaRank;
                const changeToUse = isOverall ? s.overallRankChange : s.marhalaRankChange;

                return (
                  <tr key={`${s.pkey}-${i}`} className={i % 2 === 0 ? "even" : "odd"}>
                    {/* Rank */}
                    <td>
                      <RankBadge rank={rankToUse} change={changeToUse} />
                    </td>

                    {/* Student Identity Cell */}
                    <td>
                      <div className="mrk-student-cell">
                        {s.photo ? (
                          <img
                            src={s.photo}
                            alt={s.name}
                            className="mrk-student-avatar"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              const uId = String(s.student_id || s.pkey || "");
                              const cached =
                                typeof localStorage !== "undefined" && uId
                                  ? localStorage.getItem(`mauze_student_photo_${uId}`) ||
                                    localStorage.getItem(`mauze_photo_${uId}`) ||
                                    (s.its ? localStorage.getItem(`mauze_photo_${s.its}`) : "")
                                  : "";
                              if (cached && e.currentTarget.src !== cached) {
                                e.currentTarget.src = cached;
                              } else {
                                e.currentTarget.src = "/logo.png";
                              }
                            }}
                          />
                        ) : (
                          <div className="mrk-student-avatar-fallback">
                            {(s.name || "S").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="mrk-student-meta">
                          <div className="mrk-student-name-row">
                            <span className="mrk-student-name">{s.name}</span>
                            {s.arabic_name && (
                              <span className="mrk-student-ar" dir="rtl">
                                {s.arabic_name}
                              </span>
                            )}
                          </div>
                          <div className="mrk-student-chips">
                            {s.its && <span className="mrk-student-its">ITS: {s.its}</span>}
                            {s.groupName && s.groupName !== "Ungrouped" && (
                              <span className="mrk-student-group">{s.groupName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Overall View: Marhala Tag + 4 Weeks Columns */}
                    {isOverall && (
                      <>
                        <td>
                          <span className={`mrk-marhala-pill marhala-${String(s.marhala || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`}>
                            {s.marhala || "General"}
                          </span>
                        </td>

                        {/* Week 1 to Week 4 (Dates 1 to 30) */}
                        {[0, 1, 2, 3].map((wIdx) => {
                          const wData = getStudentWeek(s, wIdx);
                          if (!wData) {
                            return (
                              <td key={wIdx} className="mrk-week-cell empty">
                                <span className="mrk-week-dash" title={`Week ${wIdx + 1}: No result recorded`}>—</span>
                              </td>
                            );
                          }
                          return (
                            <td key={wIdx} className="mrk-week-cell scored">
                              <div className="mrk-week-card">
                                <ScorePill value={wData.score} max={100} />
                                <div className="mrk-week-meta">
                                  <span>Att: {wData.attendance_count}/{wData.attendance_max || 6}</span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </>
                    )}

                    {/* Monthly Score & Breakdown */}
                    <td className={isOverall ? "mrk-td-highlight" : ""}>
                      <ScorePill value={s.avgScore} max={100} />
                    </td>
                    <td><ScorePill value={s.avgMurajazah100 ?? s.avgMurajazah} max={100} /></td>
                    <td><ScorePill value={s.avgJuzHali100 ?? s.avgJuzHali} max={100} /></td>

                    {/* Jadeed Total Month */}
                    <td>
                      <JadeedTotalBox row={s} />
                    </td>

                    {/* Overall vs Marhala Wusool and Attendance column order */}
                    {isOverall ? (
                      <>
                        {/* Attendance */}
                        <td>
                          <div className="mrk-att">
                            <Sparkles size={13} color={(Number(s.attendanceTotal) || 0) > 0 ? "#d4af37" : "#e0ddd8"} />
                            <span className="mrk-att-val">{s.attendanceTotal}/{s.attendanceMax}</span>
                          </div>
                        </td>
                        {/* Latest Wusool */}
                        <td>
                          <div className="mrk-wusool">
                            <span>Juz {s.wusool?.juz || "—"}</span>
                            <span>{s.wusool?.surah || ""}</span>
                            <span>Pg {s.wusool?.page || "—"}</span>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Wusool */}
                        <td>
                          <div className="mrk-wusool">
                            <span>Juz {s.wusool?.juz || "—"}</span>
                            <span>{s.wusool?.surah || ""}</span>
                            <span>Pg {s.wusool?.page || "—"}</span>
                          </div>
                        </td>
                        {/* Attendance */}
                        <td>
                          <div className="mrk-att">
                            <Sparkles size={12} color={(Number(s.attendanceTotal) || 0) > 0 ? "#d4af37" : "#e0ddd8"} />
                            <span>{s.attendanceTotal}/{s.attendanceMax}</span>
                          </div>
                        </td>
                        {/* Weeks Count */}
                        <td>
                          <span className="mrk-score-pill">
                            {s.weeksCount}<span className="mrk-score-max"> wks</span>
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={isOverall ? 13 : 9} className="mrk-empty">
                    {searchQuery
                      ? "No students match your search criteria."
                      : "No monthly results recorded for this month yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Legend */}
        <div className="mrk-legend">
          <span>
            <ArrowUp size={13} className="mrk-glow-green" /> Jadeed total ↑ 1+ satar/safah vs last month (glowing green)
          </span>
          <span>
            <ArrowDown size={13} className="mrk-flat-red" /> Same or less Jadeed total vs last month (red)
          </span>
          <span>
            <ArrowUp size={13} className="mrk-arrow-up" /> Rank improved
          </span>
          <span>
            <ArrowDown size={13} className="mrk-arrow-down" /> Rank dropped
          </span>
          {isOverall && (
            <span>
              <Award size={13} color="#d4af37" /> Top 3 Overall students awarded distinction medals 🥇🥈🥉
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
