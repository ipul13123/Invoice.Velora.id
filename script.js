const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

const form = document.querySelector("#invoiceForm");
const itemsEditor = document.querySelector("#itemsEditor");
const addItemBtn = document.querySelector("#addItemBtn");
const printBtn = document.querySelector("#printBtn");
const saveBtn = document.querySelector("#saveBtn");
const resetBtn = document.querySelector("#resetBtn");

let items = [
  {
    name: "Sewa papan ucapan akrilik custom",
    duration: "1 hari",
    qty: 1,
    price: 250000
  }
];

function todayInputValue() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function textValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function setText(id, value) {
  document.querySelector(`#${id}`).textContent = value || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeAuthCode(payload) {
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `VEL-${(hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

function renderItemsEditor() {
  itemsEditor.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <label>
        Nama item
        <input data-field="name" data-index="${index}" type="text" value="${escapeHtml(item.name)}">
      </label>
      <label>
        Durasi
        <input data-field="duration" data-index="${index}" type="text" value="${escapeHtml(item.duration)}">
      </label>
      <label>
        Qty
        <input data-field="qty" data-index="${index}" type="number" min="1" step="1" value="${item.qty}">
      </label>
      <label>
        Harga
        <input data-field="price" data-index="${index}" type="number" min="0" step="1000" value="${item.price}">
      </label>
      <button class="remove-item" type="button" data-remove="${index}" aria-label="Hapus item">X</button>
    `;
    itemsEditor.appendChild(row);
  });
}

function renderPreview() {
  const subtotal = items.reduce((sum, item) => {
    return sum + toNumber(item.qty) * toNumber(item.price);
  }, 0);
  const shipping = toNumber(textValue("shippingFee"));
  const discount = toNumber(textValue("discount"));
  const downPayment = toNumber(textValue("downPayment"));
  const total = Math.max(subtotal + shipping - discount, 0);
  const remaining = Math.max(total - downPayment, 0);
  const authPayload = JSON.stringify({
    invoice: textValue("invoiceNumber"),
    date: textValue("invoiceDate"),
    customer: textValue("customerName"),
    event: textValue("eventName"),
    total,
    remaining,
    items
  });
  const authCode = makeAuthCode(authPayload);

  setText("previewInvoiceNumber", textValue("invoiceNumber"));
  setText("previewInvoiceDate", formatDate(textValue("invoiceDate")));
  setText("previewStatus", textValue("paymentStatus"));
  setText("previewCustomerName", textValue("customerName"));
  setText("previewCustomerPhone", textValue("customerPhone"));
  setText("previewCustomerAddress", textValue("customerAddress"));
  setText("previewEventName", textValue("eventName"));
  setText("previewEventDate", formatDate(textValue("eventDate")));
  setText("previewDeliveryDate", formatDate(textValue("deliveryDate")));
  setText("previewReturnDate", formatDate(textValue("returnDate")));
  setText("previewNotes", textValue("notes"));
  setText("previewBankInfo", textValue("bankInfo"));
  setText("previewPaymentMethod", textValue("paymentMethod"));

  setText("previewGrandTotal", rupiah.format(total));
  setText("previewRemaining", rupiah.format(remaining));
  setText("previewAuthCode", authCode);
  setText("previewAuthLine", `${authCode} - cocokkan dengan nomor nota, nama pelanggan, item, dan total tagihan.`);
  setText("previewPrintedAt", formatDateTime(new Date()));
  setText("previewSubtotal", rupiah.format(subtotal));
  setText("previewShipping", rupiah.format(shipping));
  setText("previewDiscount", `- ${rupiah.format(discount)}`);
  setText("previewTotal", rupiah.format(total));
  setText("previewDownPayment", rupiah.format(downPayment));
  setText("previewRemainingBottom", rupiah.format(remaining));

  const previewItems = document.querySelector("#previewItems");
  previewItems.innerHTML = "";

  items.forEach((item) => {
    const subtotalItem = toNumber(item.qty) * toNumber(item.price);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.name || "-")}</td>
      <td>${escapeHtml(item.duration || "-")}</td>
      <td class="number">${toNumber(item.qty)}</td>
      <td class="number">${rupiah.format(toNumber(item.price))}</td>
      <td class="number">${rupiah.format(subtotalItem)}</td>
    `;
    previewItems.appendChild(row);
  });
}

function collectFormData() {
  return {
    fields: Object.fromEntries(new FormData(form).entries()),
    items
  };
}

function applyFormData(data) {
  Object.entries(data.fields || {}).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
  items = Array.isArray(data.items) && data.items.length ? data.items : items;
  renderItemsEditor();
  renderPreview();
}

function saveDraft() {
  localStorage.setItem("veloraInvoiceDraft", JSON.stringify(collectFormData()));
  saveBtn.textContent = "Draft Tersimpan";
  window.setTimeout(() => {
    saveBtn.textContent = "Simpan Draft";
  }, 1400);
}

function loadDraft() {
  const saved = localStorage.getItem("veloraInvoiceDraft");
  if (!saved) return false;

  try {
    applyFormData(JSON.parse(saved));
    return true;
  } catch {
    localStorage.removeItem("veloraInvoiceDraft");
    return false;
  }
}

form.addEventListener("input", renderPreview);
form.addEventListener("change", renderPreview);

itemsEditor.addEventListener("input", (event) => {
  const input = event.target;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!field || !items[index]) return;

  items[index][field] = field === "qty" || field === "price" ? toNumber(input.value) : input.value;
  renderPreview();
});

itemsEditor.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  const index = Number(button.dataset.remove);
  items.splice(index, 1);
  if (!items.length) {
    items.push({ name: "", duration: "1 hari", qty: 1, price: 0 });
  }
  renderItemsEditor();
  renderPreview();
});

addItemBtn.addEventListener("click", () => {
  items.push({
    name: "Tambahan dekorasi / custom nama",
    duration: "1 hari",
    qty: 1,
    price: 0
  });
  renderItemsEditor();
  renderPreview();
});

printBtn.addEventListener("click", () => {
  renderPreview();
  window.print();
});

saveBtn.addEventListener("click", saveDraft);

resetBtn.addEventListener("click", () => {
  localStorage.removeItem("veloraInvoiceDraft");
  form.reset();
  document.querySelector("#invoiceDate").value = todayInputValue();
  items = [
    {
      name: "Sewa papan ucapan akrilik custom",
      duration: "1 hari",
      qty: 1,
      price: 250000
    }
  ];
  renderItemsEditor();
  renderPreview();
});

document.querySelector("#invoiceDate").value = todayInputValue();
document.querySelector("#eventDate").value = todayInputValue();
document.querySelector("#deliveryDate").value = todayInputValue();
document.querySelector("#returnDate").value = todayInputValue();

if (!loadDraft()) {
  renderItemsEditor();
  renderPreview();
}
