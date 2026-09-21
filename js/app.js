// ── Theme Manager: Immediate theme application to prevent light-theme flash ──
const THEME_KEY = "sugarAtelierTheme";
(function initThemeEarly() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark-theme");
      if (document.body) {
        document.body.setAttribute("data-theme", "dark");
        document.body.classList.add("dark-theme");
      }
    }
  } catch (e) {}
})();

const CART_KEY = "sugarAtelierCart", WISH_KEY = "sugarAtelierWishlist";

const WISH_ICON_OUTLINE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
const WISH_ICON_SAVED = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

const PRODUCTS_INFO = {
  "Classic Chocolate Dream": {
    price: 1850,
    category: "Chocolate",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=700&q=85"
  },
  "Strawberry Velvet": {
    price: 2050,
    category: "Red Velvet",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=700&q=85"
  },
  "Elegant Wedding Bliss": {
    price: 4900,
    category: "Wedding",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=700&q=85"
  },
  "Birthday Celebration": {
    price: 1650,
    category: "Birthday",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=85"
  },
  "Berry Bliss Cheesecake": {
    price: 2200,
    category: "Cheesecake",
    image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=85"
  }
};

const money = n => "৳ " + Number(n).toLocaleString("en-US");
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || "[]");
const setCart = c => { localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartCount(); };
const getWish = () => JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
const setWish = w => {
  localStorage.setItem(WISH_KEY, JSON.stringify(w));
  if (window.auth && window.auth.currentUser && window.db) {
    try {
      window.db.collection("customers").doc(window.auth.currentUser.uid).set({ wishlist: w }, { merge: true }).catch(() => {});
    } catch (e) {}
  }
};

// Sync wishlist on user login
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (window.auth) {
      window.auth.onAuthStateChanged(user => {
        if (user && window.db) {
          window.db.collection("customers").doc(user.uid).get().then(doc => {
            if (doc.exists && Array.isArray(doc.data().wishlist)) {
              const cloudWish = doc.data().wishlist;
              const localWish = getWish();
              const merged = Array.from(new Set([...cloudWish, ...localWish]));
              localStorage.setItem(WISH_KEY, JSON.stringify(merged));
              if (document.getElementById("wishlistGrid") && typeof initWishlist === "function") {
                initWishlist();
              }
            }
          }).catch(() => {});
        }
      });
    }
  }, 300);
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

function updateCartCount() {
  document.querySelectorAll(".cart-count").forEach(e => {
    e.textContent = getCart().reduce((s, x) => s + x.qty, 0);
  });
}

function addToCart(name, price, qty = 1, image = null) {
  const c = getCart();
  const itemPrice = Number(price) || PRODUCTS_INFO[name]?.price || 1850;
  const itemImg = image || PRODUCTS_INFO[name]?.image || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80";
  const x = c.find(i => i.name === name);
  if (x) {
    x.qty += Number(qty) || 1;
    if (!x.image) x.image = itemImg;
  } else {
    c.push({ name, price: itemPrice, qty: Number(qty) || 1, image: itemImg });
  }
  setCart(c);
  toast(name + " added to cart");
}

function renderCart() {
  const box = document.getElementById("cartItems");
  if (!box) return;
  const c = getCart();
  const checkoutLink = document.querySelector(".summary .btn-primary");
  if (!c.length) {
    box.innerHTML = '<div class="form-card"><h2>Your cart is empty</h2><p>Add a delicious cake to continue.</p><a class="btn btn-primary" href="shop.html">Shop Cakes</a></div>';
    if (checkoutLink) {
      checkoutLink.style.opacity = "0.5";
      checkoutLink.style.pointerEvents = "none";
      checkoutLink.setAttribute("tabindex", "-1");
    }
    updateTotals();
    return;
  }

  if (checkoutLink) {
    checkoutLink.style.opacity = "1";
    checkoutLink.style.pointerEvents = "auto";
    checkoutLink.removeAttribute("tabindex");
  }

  box.innerHTML = c.map((i, idx) => `
    <div class="cart-item">
      <img src="${i.image || PRODUCTS_INFO[i.name]?.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80'}" alt="${i.name}">
      <div>
        <h3>${i.name}</h3>
        <p>${money(i.price)} each</p>
      </div>
      <input class="qty cart-qty" data-index="${idx}" type="number" min="1" value="${i.qty}">
      <button class="icon-btn remove-cart" data-index="${idx}" aria-label="Remove item">×</button>
    </div>
  `).join("");

  updateTotals();

  box.querySelectorAll(".remove-cart").forEach(b => {
    b.onclick = () => {
      const cart = getCart();
      cart.splice(Number(b.dataset.index), 1);
      setCart(cart);
      renderCart();
      toast("Item removed from cart");
    };
  });

  box.querySelectorAll(".cart-qty").forEach(q => {
    q.onchange = () => {
      const cart = getCart();
      const val = Math.max(1, Number(q.value) || 1);
      cart[Number(q.dataset.index)].qty = val;
      setCart(cart);
      renderCart();
    };
  });
}

function updateTotals() {
  const cart = getCart();
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = sub > 0 ? 100 : 0;
  let discountPct = 0;
  try {
    const rawCoupon = localStorage.getItem("sugarCoupon");
    if (rawCoupon) {
      if (rawCoupon.startsWith("{")) {
        const parsed = JSON.parse(rawCoupon);
        discountPct = Number(parsed.discount) || 15;
      } else if (rawCoupon === "SWEET15") {
        discountPct = 15;
      }
    }
  } catch (e) {}
  const discount = (sub > 0 && discountPct > 0) ? Math.round(sub * (discountPct / 100)) : 0;
  const total = Math.max(0, sub - discount + delivery);

  setText("subtotal", money(sub));
  setText("discount", discount > 0 ? "− " + money(discount) : "− " + money(0));
  setText("cartDelivery", money(delivery));
  setText("grandTotal", money(total));
  setText("checkoutSubtotal", money(sub));
  setText("checkoutTotal", money(total));
}

function setText(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}

function initShop() {
  const grid = document.getElementById("shopGrid");
  if (!grid) return;
  const searchInput = document.getElementById("productSearch");
  const params = new URLSearchParams(window.location.search);
  const urlSearch = params.get("search");

  if (urlSearch && searchInput && !searchInput.value) {
    searchInput.value = urlSearch;
  }

  // If shop.html has its dedicated filter engine (#categoryPills), let it manage filter events to avoid conflicts
  if (document.getElementById("categoryPills") || typeof window.applyShopFilters === "function") {
    if (typeof window.applyShopFilters === "function") {
      window.applyShopFilters();
    }
    return;
  }

  const cards = [...grid.querySelectorAll(".searchable")];
  const categoryFilter = document.getElementById("categoryFilter");
  const sortProducts = document.getElementById("sortProducts");

  const urlCategory = params.get("category");
  if (urlCategory && categoryFilter) {
    const targetCat = urlCategory.toLowerCase().trim();
    for (const opt of categoryFilter.options) {
      if (opt.value.toLowerCase().trim() === targetCat || opt.text.toLowerCase().trim().includes(targetCat)) {
        categoryFilter.value = opt.value;
        break;
      }
    }
  }

  const run = () => {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const cat = (categoryFilter?.value || "").toLowerCase().trim();
    const allCards = [...grid.querySelectorAll(".searchable")];
    allCards.forEach(c => {
      const nameMatch = !q || c.dataset.name.toLowerCase().includes(q);
      const catMatch = !cat || (c.dataset.category || "").toLowerCase() === cat;
      c.style.display = (nameMatch && catMatch) ? "" : "none";
    });
    const shown = allCards.filter(c => c.style.display !== "none").length;
    setText("productCount", shown + " Cake" + (shown === 1 ? "" : "s"));
  };

  searchInput?.addEventListener("input", run);
  categoryFilter?.addEventListener("change", run);
  sortProducts?.addEventListener("change", e => {
    const allCards = [...grid.querySelectorAll(".searchable")];
    allCards.sort((a, b) => {
      if (e.target.value === "low") return +a.dataset.price - +b.dataset.price;
      if (e.target.value === "high") return +b.dataset.price - +a.dataset.price;
      return 0;
    }).forEach(c => grid.appendChild(c));
    run();
  });

  run();
}

function initWishlist() {
  const grid = document.getElementById("wishlistGrid");
  if (!grid) return;
  const w = getWish();
  if (!w.length) {
    grid.innerHTML = '<div class="form-card"><h2>Your wishlist is empty</h2><p>Save your favourite cakes here to order later.</p><a class="btn btn-primary" href="shop.html">Browse Cakes</a></div>';
    return;
  }

  // Merge PRODUCTS_INFO with admin products map (if admin-products.js is loaded)
  const allMap = (typeof getAllProductsMap === "function")
    ? getAllProductsMap()
    : {};

  grid.innerHTML = w.map(n => {
    // Try allMap first (covers admin products), then PRODUCTS_INFO fallback
    const adminP = allMap[n];
    const info = adminP
      ? { price: adminP.price, image: adminP.image }
      : (PRODUCTS_INFO[n] || { price: 1850, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=85" });

    const productUrl = `product.html?name=${encodeURIComponent(n)}`;
    return `
      <article class="product-card">
        <div class="product-img">
          <button class="wishlist-btn saved" data-wishlist="${n}" title="Remove from wishlist">${WISH_ICON_SAVED}</button>
          <a href="${productUrl}"><img src="${info.image}" alt="${n}"></a>
        </div>
        <div class="product-info">
          <h3><a href="${productUrl}">${n}</a></h3>
          <p class="product-price">${money(info.price)}</p>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-primary full add-cart" data-name="${n}" data-price="${info.price}">Add to Cart</button>
            <button class="btn btn-outline remove-from-wishlist" data-name="${n}" title="Remove" style="padding:10px 14px;">✕</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".remove-from-wishlist").forEach(btn => {
    btn.onclick = () => {
      const name = btn.dataset.name;
      const curWish = getWish().filter(item => item !== name);
      setWish(curWish);
      initWishlist();
      toast("Removed from wishlist");
    };
  });
}

function initProductDetail() {
  const detail = document.querySelector(".product-detail");
  if (!detail) return;

  // Thumbnail switching
  const mainImg = detail.querySelector(".main-product-image");
  const thumbs = detail.querySelectorAll(".thumbs img");
  thumbs.forEach((t, idx) => {
    t.style.cursor = "pointer";
    t.style.transition = "border-color 0.2s ease";
    if (idx === 0) t.style.outline = "2px solid var(--primary)";
    t.addEventListener("click", () => {
      if (mainImg) mainImg.src = t.src.replace("&w=200", "&w=1000");
      thumbs.forEach(img => img.style.outline = "none");
      t.style.outline = "2px solid var(--primary)";
    });
  });

  // Size option price multipliers
  const sizeMultipliers = {
    "0.5 KG": 0.6,
    "1 KG": 1.0,
    "1.5 KG": 1.45,
    "2 KG": 1.85
  };
  const priceEl = detail.querySelector(".price");
  const addBtn = detail.querySelector(".add-cart");
  const basePrice = Number(addBtn?.dataset.price) || 1850;

  detail.querySelectorAll(".option").forEach(opt => {
    const isSize = opt.querySelector("b")?.textContent.toLowerCase().includes("size");
    const chips = opt.querySelectorAll(".chips button");
    chips.forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        chips.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        if (isSize) {
          const sz = btn.textContent.trim();
          const mult = sizeMultipliers[sz] || 1.0;
          const newPrice = Math.round(basePrice * mult);
          if (priceEl) {
            priceEl.innerHTML = `${money(newPrice)} <del>${money(Math.round(newPrice * 1.15))}</del>`;
          }
          if (addBtn) {
            addBtn.dataset.price = newPrice;
          }
        }
      });
    });
  });
}

// Global click delegation
document.addEventListener("click", e => {
  // Add to cart
  const add = e.target.closest(".add-cart");
  if (add) {
    const container = add.closest(".buy-row") || add.closest(".product-card") || add.closest(".product-detail") || document;
    const qtyInput = container.querySelector(".qty");
    const qty = qtyInput ? Math.max(1, Number(qtyInput.value) || 1) : 1;
    const imgEl = container.querySelector("img") || document.querySelector(".main-product-image");
    const imgSrc = imgEl ? imgEl.src : null;
    addToCart(add.dataset.name, add.dataset.price, qty, imgSrc);
    return;
  }

  // Wishlist toggle
  const wish = e.target.closest(".wishlist-btn");
  if (wish) {
    const w = getWish();
    const n = wish.dataset.wishlist;
    const i = w.indexOf(n);
    if (i >= 0) {
      w.splice(i, 1);
      wish.classList.remove("saved");
      wish.innerHTML = WISH_ICON_OUTLINE;
      toast("Removed from wishlist");
    } else {
      w.push(n);
      wish.classList.add("saved");
      wish.innerHTML = WISH_ICON_SAVED;
      toast("Added to wishlist");
    }
    setWish(w);
    // If currently on wishlist page, re-render
    if (document.getElementById("wishlistGrid")) {
      initWishlist();
    }
    return;
  }
});

// Coupon handling
document.getElementById("applyCoupon")?.addEventListener("click", async () => {
  const input = document.getElementById("couponCode");
  const v = input?.value?.trim().toUpperCase();
  if (!v) {
    toast("Please enter a coupon code.");
    return;
  }

  // 1. Built-in promo
  if (v === "SWEET15") {
    localStorage.setItem("sugarCoupon", JSON.stringify({ code: "SWEET15", discount: 15 }));
    toast("🎉 SWEET15 applied: 15% discount!");
    updateTotals();
    return;
  }

  // 2. Check Firestore coupons collection
  if (window.db) {
    try {
      const doc = await window.db.collection("coupons").doc(v).get();
      if (doc.exists) {
        const cData = doc.data();
        const now = new Date();
        const exp = cData.expiry ? new Date(cData.expiry) : null;
        if (exp && exp < now) {
          toast("This coupon has expired.");
          return;
        }
        const disc = Number(cData.discount) || 15;
        localStorage.setItem("sugarCoupon", JSON.stringify({ code: v, discount: disc }));
        toast(`🎉 ${v} applied: ${disc}% discount!`);
        updateTotals();
        return;
      }
    } catch (err) {
      console.warn("Coupon check error:", err);
    }
  }

  // 3. Fallback localStorage coupons
  try {
    const savedCoupons = JSON.parse(localStorage.getItem("sugarAtelierCoupons") || "[]");
    const found = savedCoupons.find(c => (c.code || "").toUpperCase() === v);
    if (found) {
      const now = new Date();
      const exp = found.expiry ? new Date(found.expiry) : null;
      if (exp && exp < now) {
        toast("This coupon has expired.");
        return;
      }
      const disc = Number(found.discount) || 15;
      localStorage.setItem("sugarCoupon", JSON.stringify({ code: v, discount: disc }));
      toast(`🎉 ${v} applied: ${disc}% discount!`);
      updateTotals();
      return;
    }
  } catch (e) {}

  toast("Invalid coupon code. Try SWEET15");
});

// Standalone checkoutForm listener (if not handled by custom checkout.html script)
const checkoutForm = document.getElementById("checkoutForm");
if (checkoutForm && !document.getElementById("placeOrderBtn")) {
  checkoutForm.addEventListener("submit", e => {
    e.preventDefault();
    const cart = getCart();
    if (!cart.length) {
      toast("Your cart is empty! Add cakes first.");
      return;
    }
    const method = document.querySelector('input[name="pay"]:checked')?.value || "Cash on Delivery";
    toast("Order created. Payment: " + method);
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem("sugarCoupon");
    setTimeout(() => location.href = "orders.html", 900);
  });
}

// Contact form
document.getElementById("contactForm")?.addEventListener("submit", e => {
  e.preventDefault();
  toast("Thank you! Your message has been submitted.");
  e.target.reset();
});

// Custom cake form
if (!window.__customCakeHandler) {
  document.getElementById("customCakeForm")?.addEventListener("submit", e => {
    e.preventDefault();
    toast("Custom cake request submitted! We will contact you shortly.");
    e.target.reset();
  });
}

// Register form (runs only if page has not defined custom handler)
const regForm = document.getElementById("registerForm");
if (regForm && !window.__customRegisterHandler) {
  regForm.addEventListener("submit", e => {
    e.preventDefault();
    const passInputs = e.target.querySelectorAll("input[type='password']");
    if (passInputs.length >= 2 && passInputs[0].value !== passInputs[1].value) {
      toast("Passwords do not match! Please verify.");
      return;
    }
    toast("Account created successfully! Welcome to The Sugar Atelier.");
    setTimeout(() => location.href = "account.html", 900);
  });
}

// Forgot password form
const forgotForm = document.getElementById("forgotPasswordForm") || document.querySelector(".auth-page form");
if (forgotForm && (location.pathname.includes("forgot-password") || document.title.includes("Forgot Password"))) {
  forgotForm.addEventListener("submit", e => {
    e.preventDefault();
    toast("Password reset link sent to your email!");
    e.target.reset();
  });
}

// Admin login
document.getElementById("adminLoginForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const u = document.getElementById("adminUser")?.value.trim(),
        p = document.getElementById("adminPass")?.value.trim();
  if (u === "admin" && p === "12345") {
    sessionStorage.setItem("adminLoggedIn", "1");
    location.href = "admin-dashboard.html";
  } else {
    toast("Invalid credentials. Demo: admin / 12345");
  }
});

// Admin product delete button
document.querySelectorAll(".delete-product").forEach(b => {
  b.onclick = () => {
    if (confirm("Are you sure you want to delete this product?")) {
      b.closest("tr")?.remove();
      toast("Product deleted");
    }
  };
});

// Admin product search
document.getElementById("adminProductSearch")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  document.querySelectorAll("#adminProductRows tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
});

// Global Search
const globalSearchInput = document.getElementById("globalSearch");
const searchButton = document.getElementById("searchButton");
const runSearch = () => {
  const q = globalSearchInput ? globalSearchInput.value.trim() : "";
  if (q) {
    location.href = "shop.html?search=" + encodeURIComponent(q);
  } else {
    toast("Please enter a cake name first");
  }
};
searchButton?.addEventListener("click", runSearch);
globalSearchInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSearch();
  }
});

// Mobile Drawer Navigation
function initMobileMenu() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  // Create drawer and backdrop if not already created
  let drawer = document.getElementById("mobileDrawer");
  let backdrop = document.getElementById("mobileBackdrop");
  if (!drawer) {
    backdrop = document.createElement("div");
    backdrop.id = "mobileBackdrop";
    backdrop.className = "mobile-backdrop";

    drawer = document.createElement("div");
    drawer.id = "mobileDrawer";
    drawer.className = "mobile-drawer";
    drawer.innerHTML = `
      <div class="drawer-header">
        <a class="logo" href="index.html">The Sugar <span>Atelier</span></a>
        <button class="drawer-close" id="drawerCloseBtn" aria-label="Close menu">✕</button>
      </div>
      <nav class="drawer-nav">
        <a href="index.html">🏠 Home</a>
        <a href="shop.html">🎂 Shop Cakes</a>
        <a href="categories.html">🍰 Categories</a>
        <a href="custom-cake.html">✨ Custom Cakes</a>
        <a href="about.html">📖 Our Story</a>
        <a href="contact.html">✉️ Contact Us</a>
        <a href="faq.html">❓ FAQ</a>
      </nav>
      <div class="drawer-account-section">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid var(--border);">
          <span style="font-weight:700;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);">Appearance</span>
          <button class="theme-toggle-btn" type="button" aria-label="Toggle dark/light mode" style="width:36px;height:36px;font-size:16px;"></button>
        </div>
        <h4>Customer Account</h4>
        <a href="account.html">👤 My Profile</a>
        <a href="orders.html">📦 My Orders</a>
        <a href="wishlist.html">🔖 My Wishlist</a>
        <a href="cart.html">🛒 Shopping Cart</a>
        <a href="login.html" style="color:#c0392b;margin-top:6px;font-weight:600;">🚪 Sign Out</a>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  // Ensure mobile toggle button exists in .nav-actions
  const navActions = header.querySelector(".nav-actions");
  if (navActions && !document.getElementById("mobileMenuBtn")) {
    const btn = document.createElement("button");
    btn.className = "mobile-toggle";
    btn.id = "mobileMenuBtn";
    btn.setAttribute("aria-label", "Toggle navigation");
    btn.innerHTML = "<span></span><span></span><span></span>";
    navActions.appendChild(btn);
  }

  const openBtn = document.getElementById("mobileMenuBtn");
  const closeBtn = document.getElementById("drawerCloseBtn");

  const openDrawer = () => {
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
  };

  openBtn?.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
}

// ── Dark / Light Theme Manager ──────────────────────────────────────
// ── Dark / Light Theme Manager ──────────────────────────────────────
function applyTheme(theme) {
  const isDark = theme === "dark";
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark-theme");
    if (document.body) {
      document.body.setAttribute("data-theme", "dark");
      document.body.classList.add("dark-theme");
    }
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark-theme");
    if (document.body) {
      document.body.removeAttribute("data-theme");
      document.body.classList.remove("dark-theme");
    }
  }
}

let themeToggleLock = false;
function toggleTheme() {
  if (themeToggleLock) return;
  themeToggleLock = true;
  setTimeout(() => { themeToggleLock = false; }, 250);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark" ||
                 document.documentElement.classList.contains("dark-theme");
  const newTheme = isDark ? "light" : "dark";
  applyTheme(newTheme);
  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch (e) {}
  updateThemeButtons();
  toast(newTheme === "dark" ? "🌙 Dark theme enabled" : "☀️ Light theme enabled");
}

function updateThemeButtons() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark" ||
                 document.documentElement.classList.contains("dark-theme");
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.innerHTML = isDark ? "☀️" : "🌙";
    btn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("aria-label", btn.title);
  });
}

// Global click event listener for theme toggle buttons (delegation prevents duplicate or lost handlers)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-toggle-btn");
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  }
});

// Expose globally
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;

function initThemeUI() {
  // Sync state from storage
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark" ? "dark" : "light");

  // 1. Site Header (.nav-actions)
  const navActions = document.querySelector(".site-header .nav-actions");
  if (navActions && !document.getElementById("themeToggleBtn")) {
    const btn = document.createElement("button");
    btn.className = "theme-toggle-btn";
    btn.id = "themeToggleBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle dark/light mode");
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const orderBtn = navActions.querySelector(".btn-primary");
    if (mobileBtn) {
      navActions.insertBefore(btn, mobileBtn);
    } else if (orderBtn) {
      navActions.insertBefore(btn, orderBtn);
    } else {
      navActions.appendChild(btn);
    }
  }

  // 2. Admin top bar or floating toggle
  const adminTop = document.querySelector(".admin-top");
  if (adminTop && !document.getElementById("adminThemeToggleBtn")) {
    const btn = document.createElement("button");
    btn.className = "theme-toggle-btn";
    btn.id = "adminThemeToggleBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle dark/light mode");
    const actionsGroup = adminTop.querySelector("div[style*='display:flex'], div[style*='display: flex']");
    if (actionsGroup) {
      actionsGroup.prepend(btn);
    } else {
      btn.style.marginLeft = "auto";
      adminTop.appendChild(btn);
    }
  } else if (!navActions && !adminTop && !document.getElementById("floatingThemeToggle")) {
    // Floating toggle for pages without header/admin-top (e.g., admin-login.html)
    const floatBtn = document.createElement("button");
    floatBtn.className = "theme-toggle-btn floating-theme-toggle";
    floatBtn.id = "floatingThemeToggle";
    floatBtn.type = "button";
    floatBtn.setAttribute("aria-label", "Toggle dark/light mode");
    document.body.appendChild(floatBtn);
  }

  updateThemeButtons();
}

// Page Initialization
function bootApp() {
  initThemeUI();
  initMobileMenu();
  updateCartCount();
  renderCart();
  initShop();
  initWishlist();
  initProductDetail();

  // Highlight saved wishlist buttons on any page
  const w = getWish();
  document.querySelectorAll(".wishlist-btn").forEach(b => {
    if (w.includes(b.dataset.wishlist)) {
      b.classList.add("saved");
      b.innerHTML = WISH_ICON_SAVED;
    } else {
      b.classList.remove("saved");
      b.innerHTML = WISH_ICON_OUTLINE;
    }
  });

  updateTotals();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp);
} else {
  bootApp();
}

// Auto-load Ant System (Cake attracts sweet Ants!)
(function loadAntEffects() {
  if (window.__antSystemInitialized) return;
  const script = document.createElement("script");
  const currentScript = document.currentScript;
  if (currentScript && currentScript.src) {
    script.src = new URL("ant-effects.js", currentScript.src).href;
  } else {
    script.src = "js/ant-effects.js";
  }
  document.head.appendChild(script);
})();

// Admin Session Guard & Logout handler
(function initAdminAuth() {
  const path = location.pathname.toLowerCase();
  const isAdminPage = path.includes("admin-") && !path.includes("admin-login");
  if (isAdminPage) {
    if (sessionStorage.getItem("adminLoggedIn") !== "1") {
      location.href = "admin-login.html";
      return;
    }
  }

  document.querySelectorAll('a[href="admin-login.html"], .admin-logout').forEach(link => {
    link.addEventListener("click", () => {
      sessionStorage.removeItem("adminLoggedIn");
    });
  });
})();

