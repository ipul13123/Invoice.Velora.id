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
  const sub = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const ship = num(val("shippingFee"));
  const disc = num(val("discount"));
  const dp   = num(val("downPayment"));
  const total = Math.max(sub + ship - disc, 0);
  const sisa  = Math.max(total - dp, 0);

  const payload = JSON.stringify({ inv: val("invoiceNumber"), date: val("invoiceDate"), cust: val("customerName"), total, sisa, items });
  const code = authCode(payload);

  set("previewInvoiceNumber", val("invoiceNumber"));
  set("previewInvoiceDate", parseDate(val("invoiceDate")));
  set("previewStatus", val("paymentStatus"));
  set("previewGrandTotal", rp.format(total));
  set("previewRemaining", rp.format(sisa));
  set("previewPrintedAt", fmtDateTime(new Date()));
  set("previewAuthCode", code);

  set("previewCustomerName", val("customerName"));
  set("previewCustomerPhone", val("customerPhone"));
  set("previewCustomerAddress", val("customerAddress"));
  set("previewEventName", val("eventName"));
  set("previewEventDate", parseDate(val("eventDate")));
  set("previewDeliveryDate", parseDate(val("deliveryDate")));
  set("previewReturnDate", parseDate(val("returnDate")));

  set("previewNotes", val("notes"));
  set("previewBankInfo", val("bankInfo"));
  set("previewPaymentMethod", val("paymentMethod"));

  set("previewSubtotal", rp.format(sub));
  set("previewShipping", rp.format(ship));
  set("previewDiscount", "- " + rp.format(disc));
  set("previewTotal", rp.format(total));
  set("previewDownPayment", rp.format(dp));
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
$("invoiceForm").addEventListener("input", render);
$("invoiceForm").addEventListener("change", render);

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

$("saveBtn").addEventListener("click", () => {
  localStorage.setItem("velora_draft", JSON.stringify({ fields: Object.fromEntries(new FormData($("invoiceForm")).entries()), items }));
  const btn = $("saveBtn");
  btn.textContent = "✓ Tersimpan";
  setTimeout(() => btn.textContent = "💾 Simpan", 1500);
});

$("resetBtn").addEventListener("click", () => {
  localStorage.removeItem("velora_draft");
  $("invoiceForm").reset();
  ["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id => $(id).value = todayISO());
  items = [{ name: "Sewa papan ucapan akrilik custom", duration: "1 hari", qty: 1, price: 250000 }];
  renderEditor(); render();
});

/* ── Init ── */
["invoiceDate","eventDate","deliveryDate","returnDate"].forEach(id => $(id).value = todayISO());

const saved = localStorage.getItem("velora_draft");
if (saved) {
  try {
    const { fields, items: si } = JSON.parse(saved);
    Object.entries(fields || {}).forEach(([k, v]) => { const el = $("invoiceForm").elements[k]; if (el) el.value = v; });
    if (Array.isArray(si) && si.length) items = si;
  } catch { localStorage.removeItem("velora_draft"); }
}

renderEditor();
render();
