/**
 * ============================================================
 * PRODUCT MANAGER — Firebase Firestore & localStorage CRUD
 * ============================================================
 * Handles: Add, Edit, Delete, List products
 * Products stored in Firebase Firestore with localStorage fallback
 * ============================================================
 */

(function () {
  "use strict";

  const PRODUCTS_KEY = "sugarAtelierProducts";
  window.__adminProductsLoaded = true; // Tells app.js to skip its fallback productForm handler
  const ADMIN_WISH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

// Default built-in products (always visible, cannot be deleted)
const BUILTIN_PRODUCTS = [
  {
    id: "builtin-1",
    name: "Classic Chocolate Dream",
    sku: "SC-001",
    category: "Chocolate",
    price: 1850,
    discount: 2100,
    stock: 25,
    status: "Active",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=700&q=85",
    description: "Rich, smooth and irresistible chocolate cake.",
    builtin: true
  },
  {
    id: "builtin-2",
    name: "Strawberry Velvet",
    sku: "SC-002",
    category: "Red Velvet",
    price: 2050,
    discount: 2400,
    stock: 14,
    status: "Active",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=700&q=85",
    description: "Fresh strawberry cream cake.",
    builtin: true
  },
  {
    id: "builtin-3",
    name: "Elegant Wedding Bliss",
    sku: "SC-003",
    category: "Wedding",
    price: 4900,
    discount: 0,
    stock: 8,
    status: "Active",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=700&q=85",
    description: "Elegant cakes for your special day.",
    builtin: true
  },
  {
    id: "builtin-4",
    name: "Birthday Celebration",
    sku: "SC-004",
    category: "Birthday",
    price: 1650,
    discount: 0,
    stock: 20,
    status: "Active",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=85",
    description: "Make every birthday special.",
    builtin: true
  },
  {
    id: "builtin-5",
    name: "Berry Bliss Cheesecake",
    sku: "SC-005",
    category: "Cheesecake",
    price: 2200,
    discount: 2500,
    stock: 12,
    status: "Active",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=85",
    description: "Creamy baked cheesecake topped with fresh mixed berries.",
    builtin: true
  }
];

// ── Helpers ───────────────────────────────────────────────────────────
function getSavedProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]"); }
  catch { return []; }
}

function setSavedProducts(arr) {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.warn("Storage quota warning, compressing entries:", e);
    try {
      // Fallback: strip extra-large base64 data to keep products saved locally
      const safeArr = arr.map(p => {
        if (p.image && p.image.length > 50000) {
          return { ...p, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=85" };
        }
        return p;
      });
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(safeArr));
      return true;
    } catch (e2) {
      console.error("Critical storage error:", e2);
      return false;
    }
  }
}

function getAllProducts() {
  const saved = getSavedProducts();
  const savedNames = new Set(saved.map(p => (p.name || "").trim().toLowerCase()));
  const filteredBuiltin = BUILTIN_PRODUCTS.filter(bp => !savedNames.has(bp.name.trim().toLowerCase()));
  // Return saved custom products first, followed by default built-in cakes
  return [...saved, ...filteredBuiltin];
}

function genId() {
  return "prod-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

const adminMoney = n => "৳ " + Number(n).toLocaleString("en-US");

function adminToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

// ================================================================
// ADMIN PRODUCTS PAGE — render product table
// ================================================================
function initAdminProductsPage() {
  const tbody = document.getElementById("adminProductRows");
  if (!tbody) return;

  renderAdminTable();
  window.refreshAdminProductTable = renderAdminTable;

  document.getElementById("adminProductSearch")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    tbody.querySelectorAll("tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  function renderAdminTable() {
    const products = getAllProducts();
    tbody.innerHTML = products.map(p => `
      <tr data-id="${p.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${p.image || ''}" alt="${p.name}"
              style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f5f5f5;">
            <div>
              <div style="font-weight:600;">${p.name}</div>
              ${p.category ? `<small style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;background:${(p.category === 'Custom' || p.category === 'Custom Cakes') ? 'rgba(139,58,98,0.12)' : '#f3f4f6'};color:${(p.category === 'Custom' || p.category === 'Custom Cakes') ? 'var(--primary,#8B3A62)' : '#4b5563'};font-weight:600;">${(p.category === 'Custom' || p.category === 'Custom Cakes') ? '✨ Custom Cake' : p.category}</small>` : ''}
            </div>
          </div>
        </td>
        <td>${p.sku || "—"}</td>
        <td>${adminMoney(p.price)}</td>
        <td>${p.stock ?? "—"}</td>
        <td><span style="color:${p.status === 'Active' ? '#27ae60' : '#999'}">${p.status || "Active"}</span></td>
        <td>
          <a href="admin-product-form.html?id=${p.id}">Edit</a> ·
          ${p.builtin
            ? `<span style="color:#bbb;font-size:12px;">Built-in</span>`
            : `<button class="link-btn delete-product" data-id="${p.id}">Delete</button>`}
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".delete-product").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        const prodId = btn.dataset.id;
        const saved = getSavedProducts().filter(p => p.id !== prodId);
        setSavedProducts(saved);
        renderAdminTable();
        adminToast("Product deleted");

        // Delete from Firestore
        if (window.db) {
          try {
            await window.db.collection("products").doc(prodId).delete();
            console.log("Deleted from Firestore:", prodId);
          } catch (err) {
            console.warn("Could not delete from Firestore:", err);
          }
        }
      };
    });
  }
}

// ================================================================
// ADMIN PRODUCT FORM — Add / Edit
// ================================================================
function initAdminProductForm() {
  const form = document.getElementById("productForm");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  let editProduct = null;

  if (editId) {
    editProduct = getAllProducts().find(p => p.id === editId);
    if (editProduct) {
      setFormVal("productName",      editProduct.name);
      setFormVal("sku",              editProduct.sku);
      setFormVal("price",            editProduct.price);
      setFormVal("discount",         editProduct.discount || "");
      setFormVal("stock",            editProduct.stock);
      setFormVal("shortDescription", editProduct.shortDesc || "");
      setFormVal("description",      editProduct.description || "");
      setFormVal("imageUrl",         editProduct.image || "");
      selectOpt("category", editProduct.category);
      selectOpt("status",   editProduct.status);
      const h1 = document.querySelector("h1");
      if (h1) h1.textContent = "Edit Product";
    }
  }

  // ── Helper: Compress image file via canvas ──
  function compressImageFile(file) {
    return new Promise(resolve => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.78));
          } catch {
            resolve(ev.target.result);
          }
        };
        img.onerror = () => resolve(ev.target.result);
        img.src = ev.target.result;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  // ── Live image preview when file is selected ─────────────────────
  const fileInput = form.querySelector('[name="images"]');
  let previewEl = form.querySelector("#imgPreview");
  if (!previewEl && fileInput) {
    previewEl = document.createElement("img");
    previewEl.id = "imgPreview";
    previewEl.style.cssText = "display:none;max-width:180px;max-height:130px;border-radius:10px;margin-top:8px;object-fit:cover;border:2px solid var(--primary,#c0392b);";
    fileInput.parentElement.appendChild(previewEl);
  }

  let compressedDataUrl = null;
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) {
      compressedDataUrl = null;
      if (previewEl) previewEl.style.display = "none";
      return;
    }
    compressedDataUrl = await compressImageFile(file);
    if (previewEl && compressedDataUrl) {
      previewEl.src = compressedDataUrl;
      previewEl.style.display = "block";
    }
  });

  // ── Show existing image preview when editing ──────────────────────
  if (editProduct?.image && previewEl) {
    previewEl.src = editProduct.image;
    previewEl.style.display = "block";
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"], button.btn-primary');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving Product...";
    }

    const fd = new FormData(form);
    const name  = fd.get("productName")?.trim();
    const price = Number(fd.get("price")) || 0;

    if (!name)  {
      adminToast("Product name is required!");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Save Product"; }
      return;
    }
    if (!price) {
      adminToast("Price is required!");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Save Product"; }
      return;
    }

    const rawCat = fd.get("category") || "Birthday";
    const category = rawCat.replace(/ Cakes?$/i, "").trim();

    let imageStr = "";
    if (compressedDataUrl) {
      imageStr = compressedDataUrl;
    } else if (fileInput?.files[0]) {
      imageStr = await compressImageFile(fileInput.files[0]);
    } else {
      imageStr = fd.get("imageUrl")?.trim() || editProduct?.image || "";
    }

    if (!imageStr) {
      imageStr = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=85";
    }

    const productData = {
      id:          editProduct ? editProduct.id : genId(),
      name,
      sku:         fd.get("sku")?.trim() || ("SC-" + Math.floor(100 + Math.random() * 900)),
      category,
      price,
      discount:    Number(fd.get("discount")) || 0,
      stock:       Number(fd.get("stock")) || 10,
      status:      fd.get("status") || "Active",
      shortDesc:   fd.get("shortDescription")?.trim() || "",
      description: fd.get("description")?.trim() || "",
      image:       imageStr,
      builtin:     false,
      updatedAt:   Date.now()
    };

    // 1. Update local cache immediately
    const saved = getSavedProducts();
    if (editProduct) {
      const idx = saved.findIndex(p => p.id === editProduct.id);
      if (idx !== -1) saved[idx] = productData;
      else saved.unshift(productData);
    } else {
      saved.unshift(productData);
    }
    setSavedProducts(saved);

    // 2. Save to Firestore if connected
    if (window.db) {
      try {
        await window.db.collection("products").doc(productData.id).set(productData, { merge: true });
        console.log("Saved to Firestore:", productData.name);
      } catch (dbErr) {
        console.warn("Could not save to Firestore:", dbErr);
      }
    }

    adminToast(editProduct ? "Product updated!" : "Product added to shop!");
    setTimeout(() => {
      location.href = "admin-products.html";
    }, 450);
  });

  function setFormVal(name, val) {
    const el = form.querySelector(`[name="${name}"]`);
    if (el) el.value = val ?? "";
  }

  function selectOpt(name, val) {
    const sel = form.querySelector(`[name="${name}"]`);
    if (!sel || !val) return;
    for (const opt of sel.options) {
      if (opt.value.toLowerCase().includes(val.toLowerCase()) ||
          opt.text.toLowerCase().includes(val.toLowerCase())) {
        sel.value = opt.value;
        break;
      }
    }
  }
}

// ================================================================
// SHOP PAGE — inject products into the product grid
// ================================================================
function injectShopProducts() {
  const grid = document.getElementById("shopGrid");
  if (!grid) return;

  // Clean up any previously injected cards before re-injecting
  grid.querySelectorAll(".injected-card").forEach(el => el.remove());

  const saved = getSavedProducts().filter(p => p.status !== "Draft");
  if (!saved.length) {
    updateShopCount();
    return;
  }

  const existingNames = new Set(
    [...grid.querySelectorAll(".product-card:not(.injected-card)")].map(c => (c.dataset.name || "").trim().toLowerCase())
  );

  saved.forEach(p => {
    if (!p.name) return;
    const normName = p.name.trim().toLowerCase();
    if (existingNames.has(normName)) return;
    existingNames.add(normName);

    const isCustom = (p.category === "Custom" || p.category === "Custom Cakes");
    const normCategory = isCustom ? "Custom" : (p.category || "");

    const article = document.createElement("article");
    article.className = "product-card searchable injected-card" + (isCustom ? " custom-card" : "");
    article.setAttribute("data-name",     p.name);
    article.setAttribute("data-category", normCategory);
    article.setAttribute("data-price",    p.price);

    const hasBadge  = p.discount && p.discount > p.price;
    const discPct   = hasBadge ? Math.round((1 - p.price / p.discount) * 100) : 0;

    article.innerHTML = `
      <div class="product-img">
        ${isCustom ? `<span class="badge" style="background:linear-gradient(135deg,#8B3A62,#c46a92);color:#fff;">Bespoke • Custom</span>` : (hasBadge ? `<span class="badge">${discPct}% OFF</span>` : "")}
        <button class="wishlist-btn" data-wishlist="${p.name}">${ADMIN_WISH_ICON}</button>
        <a href="${isCustom ? 'custom-cake.html' : `product.html?name=${encodeURIComponent(p.name)}`}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </a>
      </div>
      <div class="product-info">
        <div class="rating">★★★★★ <small>${isCustom ? "(Custom Design)" : "(New)"}</small></div>
        <h3><a href="${isCustom ? 'custom-cake.html' : `product.html?name=${encodeURIComponent(p.name)}`}">${p.name}</a></h3>
        ${isCustom ? `<p style="font-size:12px;color:var(--muted);margin:0 0 6px;">${p.shortDesc || "Custom name, flavor & piping text"}</p>` : ""}
        <p class="product-price">
          ${adminMoney(p.price)}
          ${hasBadge ? `<del>${adminMoney(p.discount)}</del>` : ""}
        </p>
        ${isCustom ? `
          <button class="btn btn-primary full open-quick-custom-btn"
            data-name="${p.name}"
            data-price="${p.price}"
            data-flavor="${p.flavor || 'Belgian Rich Chocolate'}"
            data-size="${p.weight || '1.5 KG'}"
            data-img="${p.image}">
            Customize & Order ✨
          </button>
        ` : `
          <button class="btn btn-primary full add-cart"
            data-name="${p.name}" data-price="${p.price}">Add to Cart</button>
        `}
      </div>
    `;
    grid.appendChild(article);
  });

  // Category pills
  const pillsContainer = document.getElementById("categoryPills");
  if (pillsContainer) {
    const existingCats = new Set(
      [...pillsContainer.querySelectorAll(".filter-pill")].map(p => p.dataset.cat)
    );
    const icons = { Birthday:"🎉", Chocolate:"🍫", Wedding:"💍", Cheesecake:"🍓", Custom:"✨" };
    saved.forEach(p => {
      const cat = p.category || "";
      if (cat && !existingCats.has(cat)) {
        existingCats.add(cat);
        const btn = document.createElement("button");
        btn.className = "filter-pill";
        btn.dataset.cat = cat;
        btn.innerHTML = `<span class="pill-icon">${icons[cat] || "🎂"}</span> ${cat}`;
        pillsContainer.appendChild(btn);
      }
    });
  }

  updateShopCount();

  if (typeof window.applyShopFilters === "function") {
    window.applyShopFilters();
  }
}

function updateShopCount() {
  const grid = document.getElementById("shopGrid");
  if (grid) {
    const allCards = [...grid.querySelectorAll(".searchable")];
    const countEl  = document.getElementById("productCount");
    if (countEl) {
      countEl.textContent = allCards.length + " Cake" + (allCards.length === 1 ? "" : "s");
    }
  }
}

// ================================================================
// HOMEPAGE — inject admin products into Best Sellers grid
// ================================================================
function injectHomepageProducts() {
  const grid = document.getElementById("homeBestSellers");
  if (!grid) return;

  grid.querySelectorAll(".injected-card").forEach(el => el.remove());

  const saved = getSavedProducts().filter(p => p.status !== "Draft");
  const toShow = saved.length ? saved.slice(-3).reverse() : [];
  if (!toShow.length) return;

  const existingNames = new Set(
    [...grid.querySelectorAll(".product-card:not(.injected-card)")].map(c => (c.dataset.name || "").trim().toLowerCase())
  );

  toShow.forEach(p => {
    if (!p.name) return;
    const normName = p.name.trim().toLowerCase();
    if (existingNames.has(normName)) return;
    existingNames.add(normName);

    const hasBadge = p.discount && p.discount > p.price;
    const discPct  = hasBadge ? Math.round((1 - p.price / p.discount) * 100) : 0;
    const article  = document.createElement("article");
    article.className = "product-card injected-card";
    article.setAttribute("data-name", p.name);
    article.innerHTML = `
      <div class="product-img">
        ${hasBadge ? `<span class="badge">${discPct}% OFF</span>` : ""}
        <button class="wishlist-btn" data-wishlist="${p.name}">${ADMIN_WISH_ICON}</button>
        <a href="product.html?name=${encodeURIComponent(p.name)}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </a>
      </div>
      <div class="product-info">
        <div class="rating">★★★★★ <small>(New)</small></div>
        <h3><a href="product.html?name=${encodeURIComponent(p.name)}">${p.name}</a></h3>
        <p class="product-price">
          ${adminMoney(p.price)}
          ${hasBadge ? `<del>${adminMoney(p.discount)}</del>` : ""}
        </p>
        <button class="btn btn-primary full add-cart"
          data-name="${p.name}" data-price="${p.price}">Add to Cart</button>
      </div>
    `;
    grid.appendChild(article);
  });
}

// ================================================================
// HELPER — get all products as a map (name → product) for wishlist
// ================================================================
function getAllProductsMap() {
  const map = {};
  getAllProducts().forEach(p => { map[p.name] = p; });
  return map;
}
window.getAllProductsMap = getAllProductsMap;

// ================================================================
// FIREBASE FIRESTORE SYNC
// ================================================================
function initFirestoreSync() {
  if (!window.db) return;

  // 1. One-time migration: If Firestore is empty but user had local products, upload them
  try {
    const local = getSavedProducts();
    if (local.length > 0) {
      window.db.collection("products").get().then(snap => {
        if (snap.empty) {
          console.log("Migrating existing local products to Firestore...");
          local.forEach(p => {
            const docId = p.id || genId();
            window.db.collection("products").doc(docId).set({ ...p, id: docId }, { merge: true });
          });
        }
      }).catch(err => console.warn("Firestore migration check note:", err));
    }
  } catch (e) {
    console.warn("Migration notice:", e);
  }

  // 2. Real-time sync listener
  try {
    window.db.collection("products").onSnapshot(snapshot => {
      const firestoreProducts = [];
      snapshot.forEach(doc => {
        firestoreProducts.push({ ...doc.data(), id: doc.id });
      });

      // Merge with any local products to avoid accidental wipes
      const local = getSavedProducts();
      const mergedMap = new Map();
      firestoreProducts.forEach(p => mergedMap.set(p.id, p));
      local.forEach(p => {
        if (!mergedMap.has(p.id)) {
          mergedMap.set(p.id, p);
          // Also sync missing item to Firestore
          if (window.db) {
            window.db.collection("products").doc(p.id).set(p, { merge: true });
          }
        }
      });
      const merged = Array.from(mergedMap.values());

      // Update local cache
      setSavedProducts(merged);

      // Re-render components
      injectShopProducts();
      injectHomepageProducts();
      if (typeof window.refreshAdminProductTable === "function") {
        window.refreshAdminProductTable();
      }

      // Notify page listeners
      window.dispatchEvent(new CustomEvent("productsUpdated", { detail: merged }));
    }, error => {
      console.warn("Firestore sync listener note:", error);
    });
  } catch (err) {
    console.warn("Firestore init listener notice:", err);
  }
}

  // ── Auto-run with readyState safety ──────────────────────────────────
  function initAdminSystem() {
    initAdminProductsPage();
    initAdminProductForm();
    injectShopProducts();
    injectHomepageProducts();
    initFirestoreSync();
  }

  // Expose methods to global window
  window.getAllProductsMap = getAllProductsMap;
  window.getAllProducts = getAllProducts;
  window.getSavedProducts = getSavedProducts;
  window.setSavedProducts = setSavedProducts;
  window.initAdminSystem = initAdminSystem;
  window.injectShopProducts = injectShopProducts;
  window.injectHomepageProducts = injectHomepageProducts;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminSystem);
  } else {
    initAdminSystem();
  }
})();

