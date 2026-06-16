"use strict";

/* ── Formatters ── */
const rp = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtDate = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" });
const fmtDateTime = (d) => new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
}).format(d);

/* ── State ── */
let items = [
  { name: "Sewa papan ucapan akrilik custom", duration: "1 hari", qty: 1, price: 250000 }
];

/* ── Helpers ── */
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const todayISO = () => new Date().toISOString().slice(0, 10);
const parseDate = (s) => { if (!s) return "—"; const [y,m,d] = s.split("-").map(Number); return fmtDate.format(new Date(y,m-1,d)); };

function authCode(payload) {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "VEL-" + (h >>> 0).toString(36).toUpperCase().padStart(7,"0").slice(0,7);
}

function set(id, v) { const el = $(id); if (el) el.textContent = v ?? "—"; }

/* ── ① NOMOR NOTA OTOMATIS ── */
function getNextInvoiceNumber() {
  const stored = localStorage.getItem("velora_invoice_counter");
  const counter = stored ? parseInt(stored, 10) : 0;
  const next = counter + 1;
  const year = new Date().getFullYear();
  return `VEL-${year}-${String(next).padStart(3, "0")}`;
}

function bumpInvoiceCounter() {
  const stored = localStorage.getItem("velora_invoice_counter");
  const counter = stored ? parseInt(stored, 10) : 0;
  localStorage.setItem("velora_invoice_counter", counter + 1);
}

function initInvoiceNumber() {
  const invEl = $("invoiceNumber");
  // Hanya generate nomor baru jika field masih default atau kosong
  if (!invEl.value || invEl.value === "VEL-2026-001") {
    invEl.value = getNextInvoiceNumber();
  }
}

/* ── ② WARNA STATUS BAYAR ── */
const STATUS_COLORS = {
  "Belum dibayar": { bg: "#fff0f0", text: "#c0392b", border: "#e74c3c" },
  "DP diterima":   { bg: "#fffbe6", text: "#856404", border: "#f0c040" },
  "Lunas":         { bg: "#edfaf3", text: "#1a7a4a", border: "#27ae60" },
};

function applyStatusColor(statusText) {
  const bar  = $("statusBar");
  const chip = $("previewStatusChip");
  const cfg  = STATUS_COLORS[statusText] || STATUS_COLORS["Belum dibayar"];
  if (bar)  { bar.style.borderTop = `3px solid ${cfg.border}`; }
  if (chip) {
    chip.style.background   = cfg.bg;
    chip.style.color        = cfg.text;
    chip.style.border       = `1px solid ${cfg.border}`;
    chip.textContent        = statusText;
  }
}

/* ── ③ KIRIM VIA WHATSAPP ── */
function buildWAMessage() {
  const invNo   = val("invoiceNumber");
  const cust    = val("customerName");
  const phone   = val("customerPhone");
  const event   = val("eventName");
  const evDate  = parseDate(val("eventDate"));
  const delDate = parseDate(val("deliveryDate"));
  const retDate = parseDate(val("returnDate"));
  const status  = val("paymentStatus");
  const method  = val("paymentMethod");
  const bank    = val("bankInfo");
  const notes   = val("notes");

  const sub  = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const ship = num(val("shippingFee"));
  const disc = num(val("discount"));
  const dp   = num(val("downPayment"));
  const total = Math.max(sub + ship - disc, 0);
  const sisa  = status === "Lunas" ? 0 : Math.max(total - dp, 0);

  const itemLines = items.map(it =>
    `  • ${it.name} (${it.duration}) x${it.qty} = ${rp.format(num(it.qty)*num(it.price))}`
  ).join("\n");

  return `🌸 *NOTA SEWA – Velora.id*
No. Nota : *${invNo}*
Status    : *${status}*

👤 *Pelanggan*
Nama   : ${cust}
WA     : ${phone}

🎪 *Detail Sewa*
Acara  : ${event}
Tgl acara : ${evDate}
Kirim  : ${delDate}
Kembali: ${retDate}

📦 *Item Sewa*
${itemLines}

💰 *Pembayaran*
Subtotal : ${rp.format(sub)}
Ongkir   : ${rp.format(ship)}
Diskon   : -${rp.format(disc)}
*Total   : ${rp.format(total)}*
DP bayar : ${rp.format(dp)}
*Sisa bayar : ${rp.format(sisa)}*

🏦 ${bank}
Metode: ${method}

📝 ${notes}

Terima kasih telah mempercayakan momen spesial Anda kepada Velora.id 🌸`;
}

function sendWhatsApp() {
  const phone = val("customerPhone").replace(/\D/g,"");
  // Normalize nomor: 08xx → 628xx
  const intlPhone = phone.startsWith("0") ? "62" + phone.slice(1) : phone;
  const msg = buildWAMessage();
  const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* ── Placeholder-style value ── */
const DEFAULTS = {
  invoiceNumber: "",
  customerName: "Nama Pelanggan",
  customerPhone: "08xxxxxxxxxx",
  customerAddress: "Alamat acara / pengiriman",
  eventName: "Wedding / Grand Opening",
  paymentMethod: "Transfer / Tunai",
  notes: "Mohon simpan bukti pembayaran.",
  bankInfo: "BCA 0000000000 a.n. Velora.id"
};

function applyPlaceholderStyle(el) {
  if (!el) return;
  const id = el.id;
  if (DEFAULTS[id] !== undefined) {
    const isDefault = el.value === DEFAULTS[id] || el.value === "";
    el.classList.toggle("is-placeholder", isDefault);
  }
}

function initPlaceholderFields() {
  Object.keys(DEFAULTS).forEach(id => {
    const el = $(id);
    if (!el) return;
    applyPlaceholderStyle(el);
    el.addEventListener("focus", () => { if (el.classList.contains("is-placeholder")) el.select?.(); });
    el.addEventListener("input", () => applyPlaceholderStyle(el));
    el.addEventListener("blur",  () => applyPlaceholderStyle(el));
  });
}

/* ── Render editor ── */
function renderEditor() {
  const ed = $("itemsEditor");
  ed.innerHTML = "";
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <label style="grid-column:span 1">Nama<input data-i="${i}" data-f="name" type="text" value="${esc(item.name)}"></label>
      <label>Durasi<input data-i="${i}" data-f="duration" type="text" value="${esc(item.duration)}"></label>
      <label>Qty<input data-i="${i}" data-f="qty" type="number" min="1" value="${item.qty}"></label>
      <label>Harga<input data-i="${i}" data-f="price" type="number" min="0" step="1000" value="${item.price}"></label>
      <button class="btn-remove" data-rm="${i}">✕</button>
    `;
    ed.appendChild(row);
  });
}

/* ── Render preview ── */
function render() {
  const sub   = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const ship  = num(val("shippingFee"));
  const disc  = num(val("discount"));
  const dp    = num(val("downPayment"));
  const total = Math.max(sub + ship - disc, 0);
  const statusVal2 = val("paymentStatus");
  const sisa  = statusVal2 === "Lunas" ? 0 : Math.max(total - dp, 0);

  const payload = JSON.stringify({ inv: val("invoiceNumber"), date: val("invoiceDate"), cust: val("customerName"), total, sisa, items });
  const code = authCode(payload);

  set("previewInvoiceNumber", val("invoiceNumber"));
  set("previewInvoiceDate",   parseDate(val("invoiceDate")));
  set("previewPrintedAt",     fmtDateTime(new Date()));
  set("previewAuthCode",      code);

  set("previewGrandTotal",  rp.format(total));
  set("previewRemaining",   rp.format(sisa));

  // ② Terapkan warna status
  const statusVal = val("paymentStatus");
  set("previewStatus", statusVal);
  applyStatusColor(statusVal);

  set("previewCustomerName",    val("customerName"));
  set("previewCustomerPhone",   val("customerPhone"));
  set("previewCustomerAddress", val("customerAddress"));
  set("previewEventName",       val("eventName"));
  set("previewEventDate",       parseDate(val("eventDate")));
  set("previewDeliveryDate",    parseDate(val("deliveryDate")));
  set("previewReturnDate",      parseDate(val("returnDate")));

  set("previewNotes",         val("notes"));
  set("previewBankInfo",      val("bankInfo"));
  set("previewPaymentMethod", val("paymentMethod"));

  set("previewSubtotal",        rp.format(sub));
  set("previewShipping",        rp.format(ship));
  set("previewDiscount",        "- " + rp.format(disc));
  set("previewTotal",           rp.format(total));
  set("previewDownPayment",     rp.format(dp));
  set("previewRemainingBottom", rp.format(sisa));

  const tbody = $("previewItems");
  tbody.innerHTML = "";
  items.forEach(it => {
    const tr = document.createElement("tr");
    const s = num(it.qty) * num(it.price);
    tr.innerHTML = `<td>${esc(it.name||"—")}</td><td>${esc(it.duration||"—")}</td><td class="r">${num(it.qty)}</td><td class="r">${rp.format(num(it.price))}</td><td class="r">${rp.format(s)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ── Events ── */
$("invoiceForm").addEventListener("input",  render);
$("invoiceForm").addEventListener("change", render);
$("paymentStatus").addEventListener("change", function () {
  if (this.value === "Lunas") {
    const sub   = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
    const ship  = num(val("shippingFee"));
    const disc  = num(val("discount"));
    const total = Math.max(sub + ship - disc, 0);
    $("downPayment").value = total;
  } else if (this.value === "Belum dibayar") {
    $("downPayment").value = 0;
  }
  render();
});
$("itemsEditor").addEventListener("input", (e) => {
  const el = e.target;
  const i = Number(el.dataset.i), f = el.dataset.f;
  if (!f || !items[i]) return;
  items[i][f] = (f === "qty" || f === "price") ? num(el.value) : el.value;
  render();
});

$("itemsEditor").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-rm]");
  if (!btn) return;
  items.splice(Number(btn.dataset.rm), 1);
  if (!items.length) items.push({ name: "", duration: "1 hari", qty: 1, price: 0 });
  renderEditor(); render();
});

$("addItemBtn").addEventListener("click", () => {
  items.push({ name: "Item tambahan", duration: "1 hari", qty: 1, price: 0 });
  renderEditor(); render();
});

$("printBtn").addEventListener("click", () => { render(); window.print(); });

// ③ Tombol WhatsApp
$("waBtn").addEventListener("click", sendWhatsApp);

$("saveBtn").addEventListener("click", () => {
  localStorage.setItem("velora_draft", JSON.stringify({
    fields: Object.fromEntries(new FormData($("invoiceForm")).entries()),
    items
  }));
  const btn = $("saveBtn");
  btn.textContent = "✓ Tersimpan";
  setTimeout(() => btn.textContent = "💾 Simpan", 1500);
});

$("resetBtn").addEventListener("click", () => {
  localStorage.removeItem("velora_draft");
  $("invoiceForm").reset();
  ["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id => $(id).value = todayISO());
  // ① Generate nomor baru saat reset
  bumpInvoiceCounter();
  $("invoiceNumber").value = getNextInvoiceNumber();
  items = [{ name: "Sewa papan ucapan akrilik custom", duration: "1 hari", qty: 1, price: 250000 }];
  renderEditor(); render();
  initPlaceholderFields();
});

/* ── Init ── */
["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id => $(id).value = todayISO());

const saved = localStorage.getItem("velora_draft");
if (saved) {
  try {
    const { fields, items: si } = JSON.parse(saved);
    Object.entries(fields || {}).forEach(([k, v]) => {
      const el = $("invoiceForm").elements[k];
      if (el) el.value = v;
    });
    if (Array.isArray(si) && si.length) items = si;
  } catch { localStorage.removeItem("velora_draft"); }
}

// ① Init nomor nota
initInvoiceNumber();

renderEditor();
render();
initPlaceholderFields();
