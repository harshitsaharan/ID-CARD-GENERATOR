import React, { useRef, useState, useEffect } from "react";
import "./App.css";
function useDrag(ref, onMove) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const getPointer = (e) => {
      if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
    };

    const onDown = (e) => {
      e.preventDefault();
      dragging = true;
      el.classList.add("dragging");
      const p = getPointer(e);
      startX = p.x;
      startY = p.y;
      window.addEventListener("mousemove", onMoveEvt);
      window.addEventListener("mouseup", onUpEvt);
      window.addEventListener("touchmove", onMoveEvt, { passive: false });
      window.addEventListener("touchend", onUpEvt);
    };

    const onMoveEvt = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const p = getPointer(e);
      const dx = p.x - startX;
      const dy = p.y - startY;
      // update start so movement is relative (prevents jumpy behavior)
      startX = p.x;
      startY = p.y;
      onMove(dx, dy);
    };

    const onUpEvt = () => {
      dragging = false;
      el.classList.remove("dragging");
      window.removeEventListener("mousemove", onMoveEvt);
      window.removeEventListener("mouseup", onUpEvt);
      window.removeEventListener("touchmove", onMoveEvt);
      window.removeEventListener("touchend", onUpEvt);
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onDown, { passive: false });

    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("touchstart", onDown);
    };
  }, [ref, onMove]);
}

const PRESET_TEMPLATES = [
  { id: "blue-geom", name: "Blue Geometric", url: null, color: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
  { id: "dark-tech", name: "Dark Tech", url: null, color: "linear-gradient(135deg,#0f172a,#0ea5a0)" },
];

export default function App() {
  const previewRef = useRef(null); // card preview element (DOM)
  const exportRef = useRef(null); // node used for export (same content)

  const [templates, setTemplates] = useState(PRESET_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0].id);

  // text content & style
  const [nameText, setNameText] = useState("Participant Name");
  const [orgText, setOrgText] = useState("College / Team Name");

  const [nameStyle, setNameStyle] = useState({ fontSize: 18, color: "#ffffff", fontFamily: "Inter, sans-serif" });
  const [orgStyle, setOrgStyle] = useState({ fontSize: 12, color: "#ffffff", fontFamily: "Inter, sans-serif" });

  // position in % relative to card
  const [namePos, setNamePos] = useState({ x: 10, y: 60 });
  const [orgPos, setOrgPos] = useState({ x: 10, y: 76 });

  const nameRef = useRef(null);
  const orgRef = useRef(null);

  // attach drag handlers
  useDrag(nameRef, (dx, dy) => moveByDelta(dx, dy, nameRef, setNamePos));
  useDrag(orgRef, (dx, dy) => moveByDelta(dx, dy, orgRef, setOrgPos));

  function moveByDelta(dx, dy, elementRef, setter) {
    const card = previewRef.current;
    const el = elementRef.current;
    if (!card || !el) return;
    const cardRect = card.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const curLeft = elRect.left - cardRect.left;
    const curTop = elRect.top - cardRect.top;
    const newLeft = curLeft + dx;
    const newTop = curTop + dy;
    const clampedX = Math.max(0, Math.min(newLeft, cardRect.width - elRect.width));
    const clampedY = Math.max(0, Math.min(newTop, cardRect.height - elRect.height));
    const pctX = (clampedX / cardRect.width) * 100;
    const pctY = (clampedY / cardRect.height) * 100;
    setter((s) => ({ ...s, x: pctX, y: pctY }));
  }

  useEffect(() => {
    // if chosen template is preset (no url) -> nothing special
    // keep this effect in case you add template switching logic later
  }, [selectedTemplate, templates]);

  function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const id = `custom-${Date.now()}`;
      const newT = { id, name: file.name, url: e.target.result };
      setTemplates((s) => [newT, ...s]);
      setSelectedTemplate(id);
    };
    reader.readAsDataURL(file);
  }

  // style objects for inline placement
  const nameStyleObj = {
    left: `${namePos.x}%`,
    top: `${namePos.y}%`,
    fontSize: `${nameStyle.fontSize}px`,
    color: nameStyle.color,
    fontFamily: nameStyle.fontFamily,
    transform: "translate(-0%, -0%)",
    whiteSpace: "nowrap",
  };

  const orgStyleObj = {
    left: `${orgPos.x}%`,
    top: `${orgPos.y}%`,
    fontSize: `${orgStyle.fontSize}px`,
    color: orgStyle.color,
    fontFamily: orgStyle.fontFamily,
    transform: "translate(-0%, -0%)",
    whiteSpace: "nowrap",
  };

  // Export helpers: load libraries dynamically
  async function ensureHtml2Canvas() {
    if (window.html2canvas) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function ensureJsPdf() {
    if (window.jspdf) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  // Export PNG (print-ready CR80: 3.375 x 2.125 in at 300dpi => 1013 x 638 px)
  async function exportPNG() {
    try {
      await ensureHtml2Canvas();
      const h2c = window.html2canvas;
      const node = exportRef.current;
      if (!node) return;
      const width = 1013;
      const scale = width / node.offsetWidth;
      const canvas = await h2c(node, { scale, backgroundColor: null, useCORS: true });
      const dataUrl = canvas.toDataURL("image/png");
      downloadDataUrl(dataUrl, "id-card.png");
    } catch (err) {
      console.error("exportPNG error", err);
      alert("Failed to export PNG. See console for details.");
    }
  }

  // Export PDF
  async function exportPDF() {
    try {
      await ensureHtml2Canvas();
      await ensureJsPdf();
      const h2c = window.html2canvas;
      const { jsPDF } = window.jspdf;
      const node = exportRef.current;
      if (!node) return;
      const width = 1013;
      const scale = width / node.offsetWidth;
      const canvas = await h2c(node, { scale, backgroundColor: null, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      // PDF sized to card at reasonable points (approx)
      const pdf = new jsPDF({ unit: "pt", format: [width * 0.75, (canvas.height) * 0.75] });
      pdf.addImage(imgData, "PNG", 0, 0, width * 0.75, (canvas.height) * 0.75);
      pdf.save("id-card.pdf");
    } catch (err) {
      console.error("exportPDF error", err);
      alert("Failed to export PDF. See console for details.");
    }
  }

  return (
    <div className="app-container">
      <div className="controls">
        <h2>ID Card Generator</h2>
        <p className="instructions">Pick a template, drag the text into place, customize fonts/colors, then export PNG/PDF (print-ready).</p>

        <h3>Templates</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              className={`template-thumb ${selectedTemplate === t.id ? "selected" : ""}`}
              onClick={() => setSelectedTemplate(t.id)}
              title={t.name}
              style={{
                width: 96,
                height: 60,
                borderRadius: 6,
                overflow: "hidden",
                border: selectedTemplate === t.id ? "2px solid #2563eb" : "1px solid #ddd",
                background: t.url ? `url(${t.url}) center/cover no-repeat` : t.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 12,
              }}
            >
              {!t.url && <div style={{ padding: 6 }}>{t.name}</div>}
            </div>
          ))}

          <label style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
              }}
            />
            <div style={{ width: 96, height: 60, borderRadius: 6, border: "1px dashed #bbb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Upload
            </div>
          </label>
        </div>

        <h3>Text content</h3>
        <label>Participant Name</label>
        <input type="text" placeholder="Enter your name" value={nameText} onChange={(e) => setNameText(e.target.value)} />

        <label>College / Team</label>
        <input type="text" placeholder="Enter college or team name" value={orgText} onChange={(e) => setOrgText(e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <h4 style={{ margin: "8px 0" }}>Name style</h4>
            <label>Font family</label>
            <select value={nameStyle.fontFamily} onChange={(e) => setNameStyle((s) => ({ ...s, fontFamily: e.target.value }))}>
              <option>Inter, sans-serif</option>
              <option>Georgia, serif</option>
              <option>Courier New, monospace</option>
              <option>Arial, sans-serif</option>
              <option>"Times New Roman", Times, serif</option>
            </select>

            <label>Font size (px)</label>
            <input type="number" value={nameStyle.fontSize} onChange={(e) => setNameStyle((s) => ({ ...s, fontSize: parseInt(e.target.value || "18") }))} />

            <label>Color</label>
            <input type="color" value={nameStyle.color} onChange={(e) => setNameStyle((s) => ({ ...s, color: e.target.value }))} />
          </div>

          <div>
            <h4 style={{ margin: "8px 0" }}>Org style</h4>
            <label>Font family</label>
            <select value={orgStyle.fontFamily} onChange={(e) => setOrgStyle((s) => ({ ...s, fontFamily: e.target.value }))}>
              <option>Inter, sans-serif</option>
              <option>Georgia, serif</option>
              <option>Courier New, monospace</option>
              <option>Arial, sans-serif</option>
              <option>"Times New Roman", Times, serif</option>
            </select>

            <label>Font size (px)</label>
            <input type="number" value={orgStyle.fontSize} onChange={(e) => setOrgStyle((s) => ({ ...s, fontSize: parseInt(e.target.value || "12") }))} />

            <label>Color</label>
            <input type="color" value={orgStyle.color} onChange={(e) => setOrgStyle((s) => ({ ...s, color: e.target.value }))} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <h4>Quick position</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setNamePos({ x: 10, y: 60 });
                setOrgPos({ x: 10, y: 76 });
              }}
            >
              Reset
            </button>
            <button
              onClick={() => {
                setNamePos({ x: 50, y: 50 });
                setOrgPos({ x: 50, y: 62 });
              }}
            >
              Center
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <h3>Export</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportPNG}>Export PNG (print-ready)</button>
            <button onClick={exportPDF}>Export PDF</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>Exports use html2canvas & jsPDF from CDN. PDF sized to card proportions.</div>
        </div>
      </div>

      <div className="preview-area">
        <div
          className="card-preview"
          ref={previewRef}
          style={{
            width: 430,
            height: 270,
            borderRadius: 8,
            overflow: "hidden",
            background: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div ref={exportRef} style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* background */}
            {(() => {
              const t = templates.find((t) => t.id === selectedTemplate);
              if (t && t.url) return <img src={t.url} alt="bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
              if (t && t.color) return <div style={{ position: "absolute", inset: 0, background: t.color }} />;
              return <div style={{ position: "absolute", inset: 0, background: "#ddd" }} />;
            })()}

            {/* name text (draggable) */}
            <div ref={nameRef} className="draggable-text" style={nameStyleObj}>
              <div style={{ fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{nameText}</div>
            </div>

            {/* org text */}
            <div ref={orgRef} className="draggable-text" style={orgStyleObj}>
              <div style={{ fontWeight: 500, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{orgText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
