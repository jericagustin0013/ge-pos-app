"use strict";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const storeKey = "graphique-eloise-data-v1";
const navItems = [
  ["dashboard", "Dashboard", "📊"],
  ["pos", "POS", "🧾"],
  ["items", "Items", "📦"],
  ["stocks", "Stocks", "🧱"],
  ["users", "Users", "👥"],
  ["orders", "Orders", "📋"],
];
const payTypes = ["Cash", "GCash", "Card", "Invoice"];
const roles = {
  Admin: { canEditPrices: true, canManageUsers: true },
  Manager: { canEditPrices: true, canManageUsers: false },
  Cashier: { canEditPrices: false, canManageUsers: false },
};
const seed = {
  activeUserId: "u-admin",
  users: [
    { id: "u-admin", name: "Administrator", role: "Admin", username: "admin", password: "admin123", pin: "0000", active: true },
    { id: "u-manager", name: "Shop Owner", role: "Manager", username: "owner", password: "owner123", pin: "1111", active: true },
    { id: "u-cashier", name: "Cashier", role: "Cashier", username: "cashier", password: "cashier123", pin: "2222", active: true },
  ],
  materials: [
    { id: "mat-a4", name: "A4 Paper", unit: "sheet", cost: 1.5, price: 3, stock: 500, reorder: 80, sellable: true, image: "./img/mat-a4.jpg" },
    { id: "mat-phototop", name: "Phototop Print", unit: "print", cost: 18, price: 35, stock: 120, reorder: 20, sellable: true, image: "./img/mat-phototop.jpg" },
    { id: "mat-sintra", name: "Sintra Board", unit: "board", cost: 22, price: 45, stock: 80, reorder: 15, sellable: true, image: "./img/mat-sintra.jpg" },
    { id: "mat-ink-bw", name: "Black Ink", unit: "page", cost: .35, price: 0, stock: 3000, reorder: 300, sellable: false, image: "./img/mat-ink-bw.jpg" },
    { id: "mat-ink-color", name: "Color Ink", unit: "page", cost: 2.8, price: 0, stock: 1600, reorder: 250, sellable: false, image: "./img/mat-ink-color.jpg" },
    { id: "mat-laminate", name: "Lamination Film", unit: "sheet", cost: 8, price: 20, stock: 90, reorder: 15, sellable: true, image: "./img/mat-laminate.jpg" },
  ],
  items: [
    { id: "svc-bw", name: "B/W Copy", category: "Copies", unit: "page", price: 3, desc: "Black and white copy on A4 paper.", image: "./img/svc-bw.jpg", recipe: [{ materialId: "mat-a4", qty: 1 }, { materialId: "mat-ink-bw", qty: 1 }] },
    { id: "svc-color", name: "Color Print A4", category: "Copies", unit: "page", price: 15, desc: "Full color print on A4 paper.", image: "./img/svc-color.jpg", recipe: [{ materialId: "mat-a4", qty: 1 }, { materialId: "mat-ink-color", qty: 1 }] },
    { id: "svc-a4-sintra", name: "A4 Sintra Mount", category: "Sintra", unit: "set", price: 150, desc: "1 A4, 1 Phototop, and 2 Sintra boards.", image: "./img/svc-sintra.jpg", recipe: [{ materialId: "mat-a4", qty: 1 }, { materialId: "mat-phototop", qty: 1 }, { materialId: "mat-sintra", qty: 2 }] },
    { id: "svc-lamination", name: "A4 Lamination", category: "Finishing", unit: "sheet", price: 35, desc: "Laminate one A4 sheet.", image: "./img/svc-lamination.jpg", recipe: [{ materialId: "mat-laminate", qty: 1 }] },
    { id: "svc-design", name: "Layout / Design Time", category: "Services", unit: "15 min", price: 250, desc: "Assisted layout edits and resizing.", image: "./img/svc-design.jpg", recipe: [] },
  ],
  orders: [],
};
let db = structuredClone(seed);
let cart = [];
let activeView = "dashboard";
let activeCategory = "All";
let editingItemId = null;
let editingMaterialId = null;
let editingUserId = null;
let uploadedItemImage = ""; //for uploading photos //
let uploadedMaterialImage = ""; //for uploading photos//
let activePayment = "Cash";
let deferredInstallPrompt = null;
const fallbackImg = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="%23242424"/></svg>');

const $ = s => document.querySelector(s);
const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let idbConnection = null;
function openAppDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("graphique-eloise-db", 1);
    request.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("state")) d.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function idbGet(k) {
  idbConnection ||= await openAppDatabase();
  return new Promise((res, rej) => {
    const tx = idbConnection.transaction("state", "readonly");
    const r = tx.objectStore("state").get(k);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) {
  idbConnection ||= await openAppDatabase();
  return new Promise((res, rej) => {
    const tx = idbConnection.transaction("state", "readwrite");
    tx.objectStore("state").put(v, k);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function loadDb() {
  const saved = await idbGet("app-state");
  if (saved) {
    const merged = structuredClone(seed);
    Object.assign(merged, saved);
    merged.users = (saved.users || seed.users).map(savedUser => {
      const seedUser = seed.users.find(u => u.id === savedUser.id);
      return {
        ...seedUser,
        ...savedUser,
        username: savedUser.username || seedUser?.username,
        password: savedUser.password || seedUser?.password,
      };
    });
    return merged;
  }
  try {
    const legacy = localStorage.getItem(storeKey);
    if (legacy) {
      const m = { ...structuredClone(seed), ...JSON.parse(legacy) };
      await idbSet("app-state", m);
      localStorage.removeItem(storeKey);
      return m;
    }
  } catch {}
  await idbSet("app-state", structuredClone(seed));
  return structuredClone(seed);
}
function saveDb() {
  idbSet("app-state", db).catch(e => {
    console.error("Save failed", e);
    updateAppStatus("Save failed", "error");
  });
}
function currentUser() { return db.users.find(u => u.id === db.activeUserId) || db.users[0]; }
function canEditPrices() { return !!roles[currentUser().role]?.canEditPrices; }
function canManageUsers() { return !!roles[currentUser().role]?.canManageUsers; }
function material(id) { return db.materials.find(r => r.id === id); }
function itemCost(item) {
  return item.recipe.reduce((s, l) => s + ((material(l.materialId)?.cost || 0) * Number(l.qty || 0)), 0);
}
function itemStock(item) {
  if (!item.recipe.length) return Infinity;
  return Math.min(...item.recipe.map(l => Math.floor((material(l.materialId)?.stock || 0) / Math.max(.0001, Number(l.qty || 0)))));
}
function lineTotal(l) { return l.price * l.qty - Math.max(0, Number(l.discount) || 0); }
function lineCost(l) {
  const i = db.items.find(r => r.id === l.id);
  return i ? itemCost(i) * l.qty : 0;
}
function totals() {
  const subtotal = cart.reduce((s, l) => s + lineTotal(l), 0);
  const rush = $("#orderType").value === "Rush" ? Math.max(50, subtotal * .12) : 0;
  const cost = cart.reduce((s, l) => s + lineCost(l), 0);
  return { subtotal, rush, cost, total: subtotal + rush };
}
function setDefaultDueDate() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  $("#dueDate").value = d.toISOString().slice(0, 16);
}

async function init() {
  try { db = await loadDb(); } catch (e) { console.warn("DB load fallback", e); }
  renderNav();
  renderUserChip();
  renderPayment();
  setDefaultDueDate();
  renderAll();
  bindEvents();
  bindLogin();
  updateAppStatus();
  registerServiceWorker();
  restoreSession();
}
function restoreSession() {
  const uid = sessionStorage.getItem("ge-active-user");
  const u = uid && db.users.find(x => x.id === uid && x.active);
  if (u) { db.activeUserId = u.id; renderUserChip(); unlockApp(); }
  else { document.body.classList.add("locked"); setTimeout(() => document.getElementById("loginPass")?.focus(), 60); }
}
function unlockApp() {
  document.body.classList.remove("locked");
  const s = document.getElementById("loginScreen"); if (s) s.style.display = "none";
}
function lockApp() {
  sessionStorage.removeItem("ge-active-user");
  const s = document.getElementById("loginScreen"); if (s) s.style.display = "";
  document.body.classList.add("locked");
  const p = document.getElementById("loginPass"); if (p) { p.value = ""; setTimeout(() => p.focus(), 60); }
}
function bindLogin() {
  const roleMap = { admin: "admin", owner: "owner", cashier: "cashier" };
  const tabs = document.getElementById("loginRoleTabs");
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPass");
  const err = document.getElementById("loginErr");
  tabs.addEventListener("click", e => {
    const b = e.target.closest("[data-role]"); if (!b) return;
    [...tabs.children].forEach(c => c.classList.toggle("active", c === b));
    userInput.value = roleMap[b.dataset.role]; passInput.value = ""; err.textContent = ""; passInput.focus();
  });
  document.getElementById("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const u = userInput.value.trim().toLowerCase();
    const p = passInput.value;
    const match = db.users.find(x => x.active && (x.username || "").toLowerCase() === u && x.password === p);
    if (!match) { err.textContent = "Invalid username or password."; return; }
    err.textContent = "";
    db.activeUserId = match.id;
    sessionStorage.setItem("ge-active-user", match.id);
    renderUserChip(); renderAll();
    unlockApp();
  });
  document.getElementById("logoutBtn")?.addEventListener("click", lockApp);
}
function renderAll() {
  renderDashboard(); renderCategories(); renderCatalog(); renderCart();
  renderItems(); renderMaterials(); renderUsers(); renderOrders(); renderEditors();
}
function renderNav() {
  $("#mainNav").innerHTML = navItems.map(([id, label, icon]) =>
    `<button type="button" class="${activeView === id ? "active" : ""}" data-view="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`
  ).join("");
  navItems.forEach(([id]) => $(`#${id}View`).classList.toggle("active", activeView === id));
}
function renderUserChip() {
  const chip = $("#userChip");
  if (!chip) return;
  const u = currentUser();
  if (!u) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.textContent = `${u.name} · ${u.role}`;
}
function renderDashboard() {
  const today = new Date().toDateString();
  const todayOrders = db.orders.filter(o => new Date(o.createdISO).toDateString() === today);
  const sales = todayOrders.reduce((s, o) => s + o.totals.total, 0);
  const cost = todayOrders.reduce((s, o) => s + o.totals.cost, 0);
  const low = db.materials.filter(r => r.stock <= r.reorder).length;
  $("#stats").innerHTML = [
    ["Today Sales", peso.format(sales)],
    ["Today Profit", peso.format(sales - cost)],
    ["Orders", todayOrders.length],
    ["Low Stocks", low],
  ].map(([l, v]) => `<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join("");
  const rows = [...db.items].sort((a, b) => itemStock(a) - itemStock(b)).slice(0, 8);
  $("#dashboardTable").innerHTML = `<thead><tr><th>Item</th><th>Price</th><th>Material Cost</th><th>Available Sets</th><th>Margin</th></tr></thead><tbody>${rows.map(item => {
    const c = itemCost(item), s = itemStock(item);
    return `<tr><td data-label="Item">${esc(item.name)}</td><td data-label="Price">${peso.format(item.price)}</td><td data-label="Material Cost">${peso.format(c)}</td><td data-label="Available">${s === Infinity ? "Service" : s}</td><td data-label="Margin">${peso.format(item.price - c)}</td></tr>`;
  }).join("")}</tbody>`;
}
function renderCategories() {
  const cats = ["All", ...new Set(db.items.map(i => i.category))];
  $("#categoryTabs").innerHTML = cats.map(c => `<button type="button" class="tab ${c === activeCategory ? "active" : ""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
}
function renderCatalog() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const visible = db.items.filter(i =>
    (activeCategory === "All" || i.category === activeCategory) &&
    `${i.name} ${i.category} ${i.desc}`.toLowerCase().includes(q)
  );
  $("#catalog").innerHTML = visible.map(item => {
    const stock = itemStock(item), cost = itemCost(item);
    const img = item.image || fallbackImg;
    return `<button class="card product" type="button" data-add="${item.id}">
      <img class="product-img" src="${img}" alt="${esc(item.name)}" loading="lazy" onerror="this.src='${fallbackImg}'">
      <div class="product-body">
        <h3>${esc(item.name)}</h3>
        <span class="badge">${esc(item.category)} · ${esc(item.unit)}</span>
        <p class="hint">${esc(item.desc || "Custom print shop item.")}<br>Cost: ${peso.format(cost)} · Stock: ${stock === Infinity ? "service" : stock}</p>
      </div>
      <div class="price-row"><span class="price">${peso.format(item.price)}</span><span class="add-dot" aria-hidden="true">+</span></div>
    </button>`;
  }).join("") || `<div class="empty" style="grid-column:1/-1">No matching item.<br>Try a different search or category.</div>`;
}
function renderCart() {
  if (!cart.length) {
    $("#cartItems").innerHTML = `<div class="empty">Tap an item in POS to start an order.</div>`;
  } else {
    $("#cartItems").innerHTML = cart.map((line, i) => `<div class="cart-line">
      <div class="cart-top"><div><strong>${esc(line.name)}</strong><span>${peso.format(line.price)} per ${esc(line.unit)} · ${peso.format(lineTotal(line))}</span></div>
      <div class="qty"><button type="button" data-step="-1" data-index="${i}" aria-label="Decrease">−</button><input type="number" min=".01" step=".01" value="${line.qty}" data-qty="${i}" aria-label="Quantity"><button type="button" data-step="1" data-index="${i}" aria-label="Increase">+</button></div></div>
      <div class="cart-controls"><input value="${esc(line.note || "")}" data-note="${i}" placeholder="Line note"><input type="number" min="0" step=".01" value="${line.discount || 0}" data-discount="${i}" aria-label="Discount"><button class="danger icon" type="button" data-remove="${i}" aria-label="Remove">×</button></div>
    </div>`).join("");
  }
  const t = totals();
  const count = cart.reduce((s, l) => s + Number(l.qty), 0);
  $("#ticketMeta").textContent = cart.length ? `${count} unit(s), ${cart.length} line(s)` : "No items added";
  $("#subtotal").textContent = peso.format(t.subtotal);
  $("#rushFee").textContent = peso.format(t.rush);
  $("#materialCost").textContent = peso.format(t.cost);
  $("#grandTotal").textContent = peso.format(t.total);
  $("#mobileCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
  $("#mobileTotal").textContent = peso.format(t.total);
  $("#changeDue").value = peso.format(Math.max(0, (Number($("#tendered").value) || 0) - t.total));
}
function renderPayment() {
  $("#payMethods").innerHTML = payTypes.map(t => `<button type="button" class="pay-method ${t === activePayment ? "active" : ""}" data-pay="${t}">${t}</button>`).join("");
}
function renderEditors() {
  const lock = canEditPrices() ? "" : "disabled";
  const item = editingItemId ? db.items.find(r => r.id === editingItemId) : { name: "", category: "Copies", unit: "set", price: 0, desc: "", image: "", recipe: [] };
  $("#itemEditor").innerHTML = `<div class="grid">
    <div class="form-grid three">
      <label>Name<input id="itemName" value="${esc(item.name)}"></label>
      <label>Category<input id="itemCategory" value="${esc(item.category)}"></label>
      <label>Unit<input id="itemUnit" value="${esc(item.unit)}"></label>
    </div>
    <div class="form-grid three">
      <label>Selling Price (PHP)<input id="itemPrice" type="number" step=".01" value="${item.price || 0}" ${lock}></label>
      <label>Upload Photo
    <input id="itemImage" type="file" accept="image/*">
</label>
      <label>Computed Cost<input value="${peso.format(itemCost(item))}" readonly></label>
    </div>
    <label>Description<textarea id="itemDesc">${esc(item.desc)}</textarea></label>
    <div><h3>Recipe / Bill of Materials</h3><div class="recipe-list" id="recipeRows">${renderRecipeRows(item.recipe || [])}</div><button class="ghost" id="addRecipeBtn" type="button" style="margin-top:8px">+ Add Material</button></div>
    <div class="form-grid"><button class="ghost" id="cancelItemBtn" type="button">Cancel</button><button class="primary" id="saveItemBtn" type="button">${editingItemId ? "Save Item" : "Create Item"}</button></div>
  </div>`;

  uploadedItemImage = item.image || "";

const fileInput = $("#itemImage");

fileInput.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

        uploadedItemImage = e.target.result;

    };

    reader.readAsDataURL(file);

});


  const mat = editingMaterialId ? db.materials.find(r => r.id === editingMaterialId) : { name: "", unit: "piece", cost: 0, price: 0, stock: 0, reorder: 0, sellable: false, image: "" };
  $("#materialEditor").innerHTML = `<div class="grid"><div class="form-grid three">
    <label>Name<input id="matName" value="${esc(mat.name)}"></label><label>Unit<input id="matUnit" value="${esc(mat.unit)}"></label><label>Stock<input id="matStock" type="number" step=".01" value="${mat.stock || 0}"></label>
    <label>Raw Cost (PHP)<input id="matCost" type="number" step=".01" value="${mat.cost || 0}" ${lock}></label><label>Selling Price (PHP)<input id="matPrice" type="number" step=".01" value="${mat.price || 0}" ${lock}></label><label>Reorder Point<input id="matReorder" type="number" step=".01" value="${mat.reorder || 0}"></label>
  </div><div class="form-grid"><label>Upload Photo
    <input id="matImage" type="file" accept="image/*">
</label><label>Sell as add-on<select id="matSellable"><option value="true">Yes</option><option value="false">No</option></select></label></div><div class="form-grid"><button class="ghost" id="cancelMaterialBtn" type="button">Cancel</button><button class="primary" id="saveMaterialBtn" type="button">${editingMaterialId ? "Save Material" : "Create Material"}</button></div></div>`;

uploadedMaterialImage = mat.image || "";

const matFile = $("#matImage");

if (matFile) {
    matFile.addEventListener("change", function () {

        const file = this.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {

            uploadedMaterialImage = e.target.result;

            const preview = $("#matPreview");
            if (preview) {
                preview.src = uploadedMaterialImage;
            }

        };

        reader.readAsDataURL(file);

    });
};

  $("#matSellable").value = String(!!mat.sellable);
  const usr = editingUserId ? db.users.find(r => r.id === editingUserId) : { name: "", role: "Cashier", pin: "", active: true };
  $("#userEditor").innerHTML = `<div class="grid"><div class="form-grid three">
    <label>Name<input id="userName" value="${esc(usr.name)}" ${canManageUsers() ? "" : "disabled"}></label><label>Role<select id="userRole" ${canManageUsers() ? "" : "disabled"}>${Object.keys(roles).map(r => `<option>${r}</option>`).join("")}</select></label><label>PIN<input id="userPin" value="${esc(usr.pin)}" ${canManageUsers() ? "" : "disabled"}></label>
  </div><label>Active<select id="userActive" ${canManageUsers() ? "" : "disabled"}><option value="true">Yes</option><option value="false">No</option></select></label><div class="form-grid"><button class="ghost" id="cancelUserBtn" type="button">Cancel</button><button class="primary" id="saveUserBtn" type="button" ${canManageUsers() ? "" : "disabled"}>${editingUserId ? "Save User" : "Create User"}</button></div></div>`;
  $("#userRole").value = usr.role || "Cashier";
  $("#userActive").value = String(!!usr.active);
}
function renderRecipeRows(recipe) {
  return recipe.map((line, i) => `<div class="recipe-row"><select data-recipe-material="${i}">${db.materials.map(m => `<option value="${m.id}" ${m.id === line.materialId ? "selected" : ""}>${esc(m.name)} (${esc(m.unit)})</option>`).join("")}</select><input type="number" step=".01" min=".01" value="${line.qty}" data-recipe-qty="${i}"><button class="danger icon" type="button" data-recipe-remove="${i}" aria-label="Remove">×</button></div>`).join("") || `<p class="hint">No material recipe. Use this for labor-only services.</p>`;
}
function collectRecipeRows() {
  return [...document.querySelectorAll(".recipe-row")].map(r => ({
    materialId: r.querySelector("[data-recipe-material]").value,
    qty: Number(r.querySelector("[data-recipe-qty]")?.value) || 1,
  }));
}
function renderItems() {
  $("#itemsTable").innerHTML = `<thead><tr><th>Item</th><th>Category</th><th>Unit</th><th>Price</th><th>Cost</th><th>Stock</th><th></th></tr></thead><tbody>${db.items.map(i => `<tr><td data-label="Item"><img class="mat-thumb" src="${i.image || fallbackImg}" alt="" onerror="this.src='${fallbackImg}'">${esc(i.name)}</td><td data-label="Category">${esc(i.category)}</td><td data-label="Unit">${esc(i.unit)}</td><td data-label="Price">${peso.format(i.price)}</td><td data-label="Cost">${peso.format(itemCost(i))}</td><td data-label="Stock">${itemStock(i) === Infinity ? "Service" : itemStock(i)}</td><td class="actions"><button class="ghost" data-edit-item="${i.id}">Edit</button> <button class="danger" data-delete-item="${i.id}">Delete</button></td></tr>`).join("")}</tbody>`;
}
function renderMaterials() {
  $("#materialsTable").innerHTML = `<thead><tr><th>Material</th><th>Unit</th><th>Raw Cost</th><th>Product Price</th><th>Stock</th><th>Reorder</th><th></th></tr></thead><tbody>${db.materials.map(m => `<tr><td data-label="Material"><img class="mat-thumb" src="${m.image || fallbackImg}" alt="" onerror="this.src='${fallbackImg}'">${esc(m.name)}</td><td data-label="Unit">${esc(m.unit)}</td><td data-label="Raw Cost">${peso.format(m.cost)}</td><td data-label="Product Price">${m.sellable ? peso.format(m.price) : "—"}</td><td data-label="Stock" class="${m.stock <= m.reorder ? "stock-low" : "stock-ok"}">${m.stock}</td><td data-label="Reorder">${m.reorder}</td><td class="actions"><button class="ghost" data-edit-material="${m.id}">Edit</button> <button class="danger" data-delete-material="${m.id}">Delete</button></td></tr>`).join("")}</tbody>`;
}
function renderUsers() {
  $("#usersTable").innerHTML = `<thead><tr><th>Name</th><th>Role</th><th>Can Edit Prices</th><th>Active</th><th></th></tr></thead><tbody>${db.users.map(u => `<tr><td data-label="Name">${esc(u.name)}</td><td data-label="Role">${esc(u.role)}</td><td data-label="Can Edit Prices">${roles[u.role]?.canEditPrices ? "Yes" : "No"}</td><td data-label="Active">${u.active ? "Yes" : "No"}</td><td class="actions"><button class="ghost" data-edit-user="${u.id}">Edit</button> <button class="danger" data-delete-user="${u.id}" ${canManageUsers() ? "" : "disabled"}>Delete</button></td></tr>`).join("")}</tbody>`;
}
function renderOrders() {
  $("#ordersTable").innerHTML = `<thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Cost</th><th>Total</th></tr></thead><tbody>${db.orders.map(o => `<tr><td data-label="Order">${esc(o.id)}</td><td data-label="Customer">${esc(o.customer)}</td><td data-label="Date">${esc(o.created)}</td><td data-label="Payment">${esc(o.payment)}</td><td data-label="Cost">${peso.format(o.totals.cost)}</td><td data-label="Total">${peso.format(o.totals.total)}</td></tr>`).join("") || `<tr><td data-label="Orders" colspan="6" style="text-align:center;color:var(--muted)">No completed orders yet.</td></tr>`}</tbody>`;
}
function addToCart(id) {
  const item = db.items.find(r => r.id === id);
  if (!item) return;
  const stock = itemStock(item);
  if (stock !== Infinity && stock <= 0) return alert("This item has no available stock based on its recipe.");
  const ex = cart.find(l => l.id === id);
  ex ? ex.qty++ : cart.push({ id: item.id, name: item.name, unit: item.unit, price: item.price, qty: 1, discount: 0, note: "" });
  $("#ticketPanel").classList.add("open");
  renderCart();
}
function saveItem() {
  if (!canEditPrices()) return alert("Only Admin or Manager can edit item prices.");
  const recipe = collectRecipeRows();
  const r = { id: editingItemId || uid("item"), name: $("#itemName").value.trim(), category: $("#itemCategory").value.trim(), unit: $("#itemUnit").value.trim(), price: Number($("#itemPrice").value) || 0, image: uploadedItemImage, desc: $("#itemDesc").value.trim(), recipe };
  if (!r.name) return alert("Item name is required.");
  editingItemId ? db.items.splice(db.items.findIndex(x => x.id === editingItemId), 1, r) : db.items.push(r);
  editingItemId = null; saveDb(); renderAll();
}
function saveMaterial() {
  if (!canEditPrices()) return alert("Only Admin or Manager can edit material prices.");
  const r = { id: editingMaterialId || uid("mat"), name: $("#matName").value.trim(), unit: $("#matUnit").value.trim(), stock: Number($("#matStock").value) || 0, cost: Number($("#matCost").value) || 0, price: Number($("#matPrice").value) || 0, reorder: Number($("#matReorder").value) || 0, sellable: $("#matSellable").value === "true", image: uploadedMaterialImage };
  if (!r.name) return alert("Material name is required.");
  editingMaterialId ? db.materials.splice(db.materials.findIndex(x => x.id === editingMaterialId), 1, r) : db.materials.push(r);
  editingMaterialId = null; saveDb(); renderAll();
}
function saveUser() {
  if (!canManageUsers()) return alert("Only Admin can manage users.");
  const r = { id: editingUserId || uid("user"), name: $("#userName").value.trim(), role: $("#userRole").value, pin: $("#userPin").value.trim(), active: $("#userActive").value === "true" };
  if (!r.name) return alert("User name is required.");
  editingUserId ? db.users.splice(db.users.findIndex(x => x.id === editingUserId), 1, r) : db.users.push(r);
  editingUserId = null; saveDb(); renderAll(); renderUserChip();
}
function checkout() {
  if (!cart.length) return alert("Add at least one item before checkout.");
  for (const l of cart) {
    const i = db.items.find(r => r.id === l.id);
    const a = itemStock(i);
    if (a !== Infinity && l.qty > a) return alert(`${i.name} only has ${a} available set(s).`);
  }
  for (const l of cart) {
    const i = db.items.find(r => r.id === l.id);
    i.recipe.forEach(req => {
      const m = material(req.materialId);
      if (m) m.stock = Math.max(0, Number(m.stock) - req.qty * l.qty);
    });
  }
  const now = new Date(), t = totals();
  const order = { id: `GE-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(db.orders.length + 1).padStart(4,"0")}`, createdISO: now.toISOString(), created: now.toLocaleString(), customer: $("#customerName").value.trim() || "Walk-in customer", phone: $("#customerPhone").value.trim(), due: $("#dueDate").value, type: $("#orderType").value, notes: $("#jobNotes").value.trim(), payment: activePayment, tendered: Number($("#tendered").value) || 0, cashier: currentUser().name, items: structuredClone(cart), totals: t };
  db.orders.unshift(order);
  saveDb();
  renderReceipt(order);
  cart = [];
  $("#tendered").value = ""; $("#customerName").value = ""; $("#customerPhone").value = ""; $("#jobNotes").value = "";
  setDefaultDueDate();
  $("#ticketPanel").classList.remove("open");
  renderAll();
}
function renderReceipt(o) {
  $("#receiptBody").innerHTML = `<h2>Graphique Eloise</h2><p style="text-align:center;color:#555;font-size:.78rem;margin:4px 0 14px">${esc(o.id)}<br>${esc(o.created)}<br>Cashier: ${esc(o.cashier)}<br>${esc(o.customer)}</p>${o.items.map(l => `<div class="receipt-line"><span>${esc(l.name)}<br>${l.qty} ${esc(l.unit)}</span><strong>${peso.format(lineTotal(l))}</strong></div>`).join("")}<div class="receipt-line"><span>Subtotal</span><strong>${peso.format(o.totals.subtotal)}</strong></div><div class="receipt-line"><span>Rush</span><strong>${peso.format(o.totals.rush)}</strong></div><div class="receipt-line receipt-total"><span>TOTAL</span><strong>${peso.format(o.totals.total)}</strong></div><div class="receipt-line"><span>${esc(o.payment)} tendered</span><strong>${peso.format(o.tendered)}</strong></div><div class="receipt-line"><span>Change</span><strong>${peso.format(Math.max(0, o.tendered - o.totals.total))}</strong></div><p style="text-align:center;margin-top:14px;font-size:.76rem;color:#666">Thank you for your order!</p>`;
  $("#receiptModal").classList.add("open");
}
function exportCsv() {
  if (!db.orders.length) return alert("No orders to export.");
  const rows = [["Order ID","Created","Customer","Cashier","Payment","Cost","Total"], ...db.orders.map(o => [o.id,o.created,o.customer,o.cashier,o.payment,o.totals.cost.toFixed(2),o.totals.total.toFixed(2)])];
  const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "graphique-eloise-orders.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
function updateAppStatus(message, state) {
  const s = $("#appStatus"); if (!s) return;
  const online = navigator.onLine;
  s.textContent = message || (online ? "Offline ready" : "Offline mode");
  s.classList.remove("offline", "error");
  if (state === "error") s.classList.add("error");
  else if (state === true || !online) s.classList.add("offline");
}
function isInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isLocalhostHost() { return ["localhost","127.0.0.1","::1"].includes(location.hostname); }
function isAndroidDevice() { return /Android/i.test(navigator.userAgent); }
function installDiagnostic() {
  if (isInstalledApp()) return "Graphique Eloise is already installed.";
  if (deferredInstallPrompt) return "Chrome says this app is ready to install.";
  if (!window.isSecureContext && !isLocalhostHost())
    return `Install prompt is blocked because this page is opened from ${location.origin}. Android Chrome requires HTTPS for installable apps, except localhost on the Android device.`;
  if (!("serviceWorker" in navigator)) return "This browser does not support service workers, so it cannot install this offline app.";
  if (!isAndroidDevice()) return "Install prompt is not ready yet. On Android Chrome, wait a moment or use the browser menu and choose Add to Home screen.";
  return "Install prompt is not ready yet. Refresh once after the app finishes loading, or use Chrome menu then Add to Home screen.";
}
function updateInstallButton() {
  const b = $("#installBtn"); if (!b) return;
  const installed = isInstalledApp();
  const can = !!deferredInstallPrompt && !installed;
  b.classList.toggle("unavailable", !can);
  b.disabled = installed;
  b.textContent = installed ? "Installed" : (can ? "Install" : "Install Help");
}
async function installAndroidApp() {
  if (!deferredInstallPrompt) { showInstallHelp(); return; }
  deferredInstallPrompt.prompt();
  const c = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButton();
  updateAppStatus(c.outcome === "accepted" ? "Installing" : "Install dismissed", c.outcome !== "accepted");
}
function showInstallHelp() {
  $("#installMessage").textContent = installDiagnostic();
  $("#installWarning").textContent = !window.isSecureContext && !isLocalhostHost()
    ? "XAMPP over your Wi-Fi IP address is normal HTTP. The app can still open, but Android will not show the real app install prompt until you serve it through HTTPS."
    : "If the install prompt does not appear, use the browser menu and choose Add to Home screen.";
  $("#tryInstallBtn").disabled = !deferredInstallPrompt;
  $("#installModal").classList.add("open");
  updateAppStatus(isInstalledApp() ? "Installed" : "Install help", !deferredInstallPrompt);
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) { updateAppStatus("Local only", true); return; }
  navigator.serviceWorker.register("./sw.js")
    .then(() => updateAppStatus())
    .catch(() => updateAppStatus("Offline cache blocked", true));
}
function setFullscreenState(a) {
  document.body.classList.toggle("fullscreen-mode", a);
  $("#fullscreenBtn").setAttribute("aria-pressed", String(a));
  $("#fullscreenBtn").title = a ? "Exit fullscreen" : "Toggle fullscreen";
}
async function toggleFullscreen() {
  if (document.fullscreenElement) { await document.exitFullscreen?.(); setFullscreenState(false); return; }
  try { await document.documentElement.requestFullscreen?.(); setFullscreenState(true); }
  catch { setFullscreenState(!document.body.classList.contains("fullscreen-mode")); }
}
function bindEvents() {
  $("#mainNav").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (!b) return; activeView = b.dataset.view; renderNav(); });
  $("#categoryTabs").addEventListener("click", e => { const b = e.target.closest("[data-category]"); if (!b) return; activeCategory = b.dataset.category; renderCategories(); renderCatalog(); });
  $("#catalog").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) addToCart(b.dataset.add); });
  $("#searchInput").addEventListener("input", renderCatalog);
  $("#payMethods").addEventListener("click", e => { const b = e.target.closest("[data-pay]"); if (!b) return; activePayment = b.dataset.pay; renderPayment(); });
  $("#cartItems").addEventListener("click", e => {
    const s = e.target.closest("[data-step]"), r = e.target.closest("[data-remove]");
    if (s) { cart[+s.dataset.index].qty = Math.max(.01, Number(cart[+s.dataset.index].qty) + Number(s.dataset.step)); renderCart(); }
    if (r) { cart.splice(+r.dataset.remove, 1); renderCart(); }
  });
  $("#cartItems").addEventListener("input", e => {
    if (e.target.matches("[data-qty]")) cart[+e.target.dataset.qty].qty = Math.max(.01, Number(e.target.value) || .01);
    if (e.target.matches("[data-discount]")) cart[+e.target.dataset.discount].discount = Math.max(0, Number(e.target.value) || 0);
    if (e.target.matches("[data-note]")) cart[+e.target.dataset.note].note = e.target.value;
    renderCart();
  });
  document.body.addEventListener("click", e => {
    if (e.target.id === "newItemBtn") { editingItemId = null; renderEditors(); }
    if (e.target.id === "newMaterialBtn") { editingMaterialId = null; renderEditors(); }
    if (e.target.id === "newUserBtn") { editingUserId = null; renderEditors(); }
    if (e.target.id === "saveItemBtn") saveItem();
    if (e.target.id === "saveMaterialBtn") saveMaterial();
    if (e.target.id === "saveUserBtn") saveUser();
    if (e.target.id === "cancelItemBtn") { editingItemId = null; renderEditors(); }
    if (e.target.id === "cancelMaterialBtn") { editingMaterialId = null; renderEditors(); }
    if (e.target.id === "cancelUserBtn") { editingUserId = null; renderEditors(); }
    if (e.target.id === "addRecipeBtn") {
      const r = collectRecipeRows();
      r.push({ materialId: db.materials[0].id, qty: 1 });
      $("#recipeRows").innerHTML = renderRecipeRows(r);
    }
    const ie = e.target.closest("[data-edit-item]"); if (ie) { editingItemId = ie.dataset.editItem; activeView = "items"; renderNav(); renderEditors(); }
    const id_ = e.target.closest("[data-delete-item]"); if (id_ && confirm("Delete this item?")) { db.items = db.items.filter(r => r.id !== id_.dataset.deleteItem); saveDb(); renderAll(); }
    const me = e.target.closest("[data-edit-material]"); if (me) { editingMaterialId = me.dataset.editMaterial; activeView = "stocks"; renderNav(); renderEditors(); }
    const md = e.target.closest("[data-delete-material]"); if (md && confirm("Delete this material?")) { db.materials = db.materials.filter(r => r.id !== md.dataset.deleteMaterial); saveDb(); renderAll(); }
    const ue = e.target.closest("[data-edit-user]"); if (ue) { editingUserId = ue.dataset.editUser; activeView = "users"; renderNav(); renderEditors(); }
    const ud = e.target.closest("[data-delete-user]"); if (ud && canManageUsers() && confirm("Delete this user?")) { db.users = db.users.filter(r => r.id !== ud.dataset.deleteUser); saveDb(); renderAll(); renderUserChip(); }
    const rr = e.target.closest("[data-recipe-remove]"); if (rr) rr.closest(".recipe-row").remove();
  });
  $("#tendered").addEventListener("input", renderCart);
  $("#orderType").addEventListener("change", renderCart);
  $("#checkoutBtn").addEventListener("click", checkout);
  $("#clearBtn").addEventListener("click", () => { if (cart.length && !confirm("Clear the current ticket?")) return; cart = []; renderCart(); $("#ticketPanel").classList.remove("open"); });
  $("#exportBtn").addEventListener("click", exportCsv);
  $("#fullscreenBtn").addEventListener("click", toggleFullscreen);
  $("#installBtn").addEventListener("click", installAndroidApp);
  $("#tryInstallBtn").addEventListener("click", installAndroidApp);
  $("#closeInstallBtn").addEventListener("click", () => $("#installModal").classList.remove("open"));
  $("#installModal").addEventListener("click", e => { if (e.target.id === "installModal") $("#installModal").classList.remove("open"); });
  $("#closeReceiptBtn").addEventListener("click", () => $("#receiptModal").classList.remove("open"));
  $("#printReceiptBtn").addEventListener("click", () => window.print());
  $("#receiptModal").addEventListener("click", e => { if (e.target.id === "receiptModal") $("#receiptModal").classList.remove("open"); });
  $("#mobileCartBtn").addEventListener("click", () => $("#ticketPanel").classList.add("open"));
  $("#closeTicketBtn").addEventListener("click", () => $("#ticketPanel").classList.remove("open"));
  $("#resetDemo").addEventListener("click", () => {
    $("#resetModal").classList.add("open");
});

$("#closeResetModal").addEventListener("click", () => {
    $("#resetModal").classList.remove("open");
});

document.querySelectorAll(".reset-option").forEach(btn => {

    btn.addEventListener("click", async () => {

        const type = btn.dataset.reset;

        if (!confirm(`Reset ${type}?`))
            return;

        switch (type) {

            case "dashboard":

                cart = [];
                $("#customerName").value = "";
                $("#customerPhone").value = "";
                $("#jobNotes").value = "";
                $("#tendered").value = "";
                setDefaultDueDate();

                break;

            case "stocks":

                db.materials = structuredClone(seed.materials);

                break;

            case "items":

                db.items = structuredClone(seed.items);

                break;

            case "orders":

                db.orders = [];

                break;

            case "all":

                db = structuredClone(seed);
                cart = [];

                break;

        }

        await idbSet("app-state", db);

        renderAll();
        renderUserChip();

        $("#resetModal").classList.remove("open");

    });

});
  window.addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); deferredInstallPrompt = ev; updateInstallButton(); updateAppStatus("Ready to install"); });
  window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; updateInstallButton(); updateAppStatus("Installed"); });
  window.addEventListener("online", () => updateAppStatus());
  window.addEventListener("offline", () => updateAppStatus());
  document.addEventListener("fullscreenchange", () => setFullscreenState(!!document.fullscreenElement));
  updateInstallButton();
}
init();