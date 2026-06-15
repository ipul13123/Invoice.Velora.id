"use strict";

/* ── Formatters ── */
const rp = new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 });
const fmtDate = new Intl.DateTimeFormat("id-ID", { day:"2-digit", month:"long", year:"numeric" });
const fmtDateTime = d => new Intl.DateTimeFormat("id-ID", {
  day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit"
}).format(d);

/* ── State ── */
let items = [
  { name:"Sewa papan ucapan akrilik custom", duration:"1 hari", qty:1, price:250000 }
];

/* ── Helpers ── */
const $   = id => document.getElementById(id);
const val = id => $(id).value.trim();
const num = v  => { const n = Number(v); return isFinite(n) ? n : 0; };
const esc = s  => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const todayISO  = () => new Date().toISOString().slice(0,10);
const parseDate = s  => { if(!s) return "—"; const [y,m,d]=s.split("-").map(Number); return fmtDate.format(new Date(y,m-1,d)); };
const setText   = (id,v) => { const e=$(id); if(e) e.textContent = v??"—"; };

/* ── Auth code (FNV-1a) ── */
function authCode(payload) {
  let h = 2166136261;
  for (let i=0; i<payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h,16777619); }
  return "VEL-" + (h>>>0).toString(36).toUpperCase().padStart(7,"0").slice(0,7);
}

/* ── Auto invoice number ── */
function getNextInvoiceNumber() {
  const c = parseInt(localStorage.getItem("velora_counter")||"0",10);
  return `VEL-${new Date().getFullYear()}-${String(c+1).padStart(3,"0")}`;
}
function bumpCounter() {
  const c = parseInt(localStorage.getItem("velora_counter")||"0",10);
  localStorage.setItem("velora_counter", c+1);
}
function initInvoiceNumber() {
  const el = $("invoiceNumber");
  if (!el.value || el.value==="VEL-2026-001") el.value = getNextInvoiceNumber();
}

/* ── Status colors ── */
const STATUS_CFG = {
  "Belum dibayar": { bg:"#fff0f0", text:"#c0392b", border:"#e74c3c" },
  "DP diterima":   { bg:"#fffbe6", text:"#856404", border:"#f0c040" },
  "Lunas":         { bg:"#edfaf3", text:"#1a7a4a", border:"#27ae60" },
};

function applyStatus(statusText) {
  const cfg = STATUS_CFG[statusText] || STATUS_CFG["Belum dibayar"];
  ["n1","n2"].forEach(p => {
    const bar  = $(`${p}_statusBar`);
    const chip = $(`${p}_statusChip`);
    if (bar)  bar.style.borderTop = `3px solid ${cfg.border}`;
    if (chip) {
      chip.style.background = cfg.bg;
      chip.style.color      = cfg.text;
      chip.style.border     = `1px solid ${cfg.border}`;
      chip.textContent      = statusText;
    }
  });
}

/* ═══════════════════════════════════════════
   WATERMARK CANVAS — anti-pemalsuan
   Layer: teks diagonal berulang "VELORA.ID ASLI"
   + border micro-pattern
═══════════════════════════════════════════ */
function drawWatermark(canvasId, notaEl, authStr) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const W = notaEl.offsetWidth  || 396;
  const H = notaEl.offsetHeight || 623;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,W,H);

  /* Teks diagonal repeating */
  ctx.save();
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.fillStyle = "#be5d7b";
  ctx.translate(W/2, H/2);
  ctx.rotate(-Math.PI / 5);

  const txt  = `✦ VELORA.ID ASLI ✦ ${authStr} `;
  const meas = ctx.measureText(txt);
  const tw   = meas.width;
  const rowH = 22;
  const cols = Math.ceil(W * 1.6 / tw) + 2;
  const rows = Math.ceil(H * 1.6 / rowH) + 2;
  const ox   = -cols * tw / 2;
  const oy   = -rows * rowH / 2;

  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      ctx.fillText(txt, ox + c*tw, oy + r*rowH);
    }
  }
  ctx.restore();

  /* Micro dot border pattern */
  ctx.save();
  ctx.fillStyle = "#be5d7b";
  const dot = 1.5, gap = 6;
  for (let x=gap; x<W; x+=gap) {
    for (let y=gap; y<H; y+=gap) {
      const onBorder = x < gap*2 || x > W-gap*2 || y < gap*2 || y > H-gap*2;
      if (onBorder) { ctx.beginPath(); ctx.arc(x,y,dot,0,Math.PI*2); ctx.fill(); }
    }
  }
  ctx.restore();
}

/* ── Build item rows HTML ── */
function buildItemRows() {
  return items.map(it => {
    const s = num(it.qty)*num(it.price);
    return `<tr><td>${esc(it.name||"—")}</td><td>${esc(it.duration||"—")}</td><td class="r">${num(it.qty)}</td><td class="r">${rp.format(num(it.price))}</td><td class="r">${rp.format(s)}</td></tr>`;
  }).join("");
}

/* ── Main render ── */
function render() {
  const sub   = items.reduce((s,it)=>s+num(it.qty)*num(it.price),0);
  const ship  = num(val("shippingFee"));
  const disc  = num(val("discount"));
  const dp    = num(val("downPayment"));
  const total = Math.max(sub+ship-disc,0);
  const sisa  = Math.max(total-dp,0);

  const invNo   = val("invoiceNumber");
  const invDate = parseDate(val("invoiceDate"));
  const now     = fmtDateTime(new Date());

  const payload = JSON.stringify({ inv:invNo, date:val("invoiceDate"), cust:val("customerName"), total, sisa, items });
  const code    = authCode(payload);

  const custName  = val("customerName");
  const custPhone = val("customerPhone");
  const custAddr  = val("customerAddress");
  const evName    = val("eventName");
  const evDate    = parseDate(val("eventDate"));
  const delDate   = parseDate(val("deliveryDate"));
  const retDate   = parseDate(val("returnDate"));
  const notes     = val("notes");
  const bank      = val("bankInfo");
  const method    = val("paymentMethod");
  const itemRowsHTML = buildItemRows();

  ["n1","n2"].forEach(p => {
    setText(`${p}_invNo`,      invNo);
    setText(`${p}_invDate`,    invDate);
    setText(`${p}_auth`,       code);
    setText(`${p}_printedAt`,  now);
    setText(`${p}_grandTotal`, rp.format(total));
    setText(`${p}_remaining`,  rp.format(sisa));
    setText(`${p}_custName`,   custName);
    setText(`${p}_custPhone`,  custPhone);
    setText(`${p}_custAddr`,   custAddr);
    setText(`${p}_evName`,     evName);
    setText(`${p}_evDate`,     evDate);
    setText(`${p}_delDate`,    delDate);
    setText(`${p}_retDate`,    retDate);
    setText(`${p}_notes`,      notes);
    setText(`${p}_bank`,       bank);
    setText(`${p}_method`,     method);
    setText(`${p}_sub`,        rp.format(sub));
    setText(`${p}_ship`,       rp.format(ship));
    setText(`${p}_disc`,       "- "+rp.format(disc));
    setText(`${p}_total`,      rp.format(total));
    setText(`${p}_dp`,         rp.format(dp));
    setText(`${p}_sisa`,       rp.format(sisa));
    setText(`${p}_secCode`,    code);

    const tb = $(`${p}_items`);
    if (tb) tb.innerHTML = itemRowsHTML;
  });

  applyStatus(val("paymentStatus"));

  /* Redraw watermark canvases */
  requestAnimationFrame(() => {
    drawWatermark("wmCanvas1", $("nota1"), code);
    drawWatermark("wmCanvas2", $("nota2"), code);
  });
}

/* ── Editor render ── */
function renderEditor() {
  const ed = $("itemsEditor");
  ed.innerHTML = "";
  items.forEach((item,i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <label>Nama<input data-i="${i}" data-f="name"     type="text"   value="${esc(item.name)}"></label>
      <label>Durasi<input data-i="${i}" data-f="duration" type="text"   value="${esc(item.duration)}"></label>
      <label>Qty<input    data-i="${i}" data-f="qty"      type="number" min="1"      value="${item.qty}"></label>
      <label>Harga<input  data-i="${i}" data-f="price"    type="number" min="0" step="1000" value="${item.price}"></label>
      <button class="btn-remove" data-rm="${i}">✕</button>`;
    ed.appendChild(row);
  });
}

/* ── WhatsApp ── */
function buildWAMsg() {
  const sub   = items.reduce((s,it)=>s+num(it.qty)*num(it.price),0);
  const ship  = num(val("shippingFee"));
  const disc  = num(val("discount"));
  const dp    = num(val("downPayment"));
  const total = Math.max(sub+ship-disc,0);
  const sisa  = Math.max(total-dp,0);
  const lines = items.map(it=>`  • ${it.name} (${it.duration}) x${it.qty} = ${rp.format(num(it.qty)*num(it.price))}`).join("\n");
  return `🌸 *NOTA SEWA – Velora.id*
No. Nota : *${val("invoiceNumber")}*
Status    : *${val("paymentStatus")}*

👤 *Pelanggan*
Nama   : ${val("customerName")}
WA     : ${val("customerPhone")}

🎪 *Detail Sewa*
Acara     : ${val("eventName")}
Tgl acara : ${parseDate(val("eventDate"))}
Kirim     : ${parseDate(val("deliveryDate"))}
Kembali   : ${parseDate(val("returnDate"))}

📦 *Item Sewa*
${lines}

💰 *Pembayaran*
Subtotal     : ${rp.format(sub)}
Ongkir/pasang: ${rp.format(ship)}
Diskon       : -${rp.format(disc)}
*Total       : ${rp.format(total)}*
DP dibayar   : ${rp.format(dp)}
*Sisa bayar  : ${rp.format(sisa)}*

🏦 ${val("bankInfo")}
Metode: ${val("paymentMethod")}

📝 ${val("notes")}

Terima kasih telah mempercayakan momen spesial Anda kepada Velora.id 🌸`;
}

/* ── Placeholder styling ── */
const DEFAULTS = {
  customerName:"Nama Pelanggan", customerPhone:"08xxxxxxxxxx",
  customerAddress:"Alamat acara / pengiriman", eventName:"Wedding / Grand Opening",
  paymentMethod:"Transfer / Tunai", notes:"Mohon simpan bukti pembayaran.",
  bankInfo:"BCA 0000000000 a.n. Velora.id"
};
function applyPlaceholder(el) {
  if (!el) return;
  const def = DEFAULTS[el.id];
  if (def !== undefined) el.classList.toggle("is-placeholder", el.value===def || el.value==="");
}
function initPlaceholders() {
  Object.keys(DEFAULTS).forEach(id => {
    const el=$(id); if (!el) return;
    applyPlaceholder(el);
    el.addEventListener("focus", () => { if(el.classList.contains("is-placeholder")) el.select?.(); });
    el.addEventListener("input", () => applyPlaceholder(el));
    el.addEventListener("blur",  () => applyPlaceholder(el));
  });
}

/* ── Events ── */
$("invoiceForm").addEventListener("input",  render);
$("invoiceForm").addEventListener("change", render);

$("itemsEditor").addEventListener("input", e => {
  const el=e.target, i=Number(el.dataset.i), f=el.dataset.f;
  if(!f||!items[i]) return;
  items[i][f] = (f==="qty"||f==="price") ? num(el.value) : el.value;
  render();
});
$("itemsEditor").addEventListener("click", e => {
  const btn = e.target.closest("[data-rm]");
  if (!btn) return;
  items.splice(Number(btn.dataset.rm),1);
  if (!items.length) items.push({name:"",duration:"1 hari",qty:1,price:0});
  renderEditor(); render();
});
$("addItemBtn").addEventListener("click", () => {
  items.push({name:"Item tambahan",duration:"1 hari",qty:1,price:0});
  renderEditor(); render();
});
$("printBtn").addEventListener("click", () => { render(); setTimeout(()=>window.print(),120); });
$("waBtn").addEventListener("click", () => {
  const phone = val("customerPhone").replace(/\D/g,"");
  const intl  = phone.startsWith("0") ? "62"+phone.slice(1) : phone;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(buildWAMsg())}`,"_blank");
});
$("saveBtn").addEventListener("click", () => {
  localStorage.setItem("velora_draft", JSON.stringify({
    fields: Object.fromEntries(new FormData($("invoiceForm")).entries()), items
  }));
  const btn=$("saveBtn"); btn.textContent="✓ Tersimpan";
  setTimeout(()=>btn.textContent="💾 Simpan",1500);
});
$("resetBtn").addEventListener("click", () => {
  localStorage.removeItem("velora_draft");
  $("invoiceForm").reset();
  ["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id=>$(id).value=todayISO());
  bumpCounter();
  $("invoiceNumber").value = getNextInvoiceNumber();
  items = [{name:"Sewa papan ucapan akrilik custom",duration:"1 hari",qty:1,price:250000}];
  renderEditor(); render(); initPlaceholders();
});

/* ── Resize: redraw watermark ── */
window.addEventListener("resize", () => {
  const code = $("n1_auth")?.textContent || "VEL-0000000";
  drawWatermark("wmCanvas1",$("nota1"),code);
  drawWatermark("wmCanvas2",$("nota2"),code);
});

/* ── Init ── */
["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id=>$(id).value=todayISO());

const saved = localStorage.getItem("velora_draft");
if (saved) {
  try {
    const {fields,items:si} = JSON.parse(saved);
    Object.entries(fields||{}).forEach(([k,v])=>{ const el=$("invoiceForm").elements[k]; if(el) el.value=v; });
    if (Array.isArray(si)&&si.length) items=si;
  } catch { localStorage.removeItem("velora_draft"); }
}

initInvoiceNumber();
renderEditor();
render();
initPlaceholders();
