/**
 * ================================================================
 * ANT EFFECTS & CURSOR FOLLOWER FOR THE SUGAR ATELIER
 * ================================================================
 * Honey websites have bees; Cake websites attract sweet-loving Ants!
 * Features:
 *  1. An adorable SVG Pet Ant that follows & orbits the mouse cursor
 *  2. Insect tripod gait walking animation & twitching antennae
 *  3. Free-roaming worker ants wandering across the ENTIRE screen
 *  4. Click on a roaming ant → sweet floating note pops up! 🍰
 *  5. Click-to-drop cake crumb: Follower ant scurries to nibble it!
 *  6. Discreet floating ON/OFF toggle switch with localStorage memory
 *  7. 100% Non-intrusive follower (pointer-events: none on follower)
 */

(function () {
  // Prevent duplicate execution
  if (window.__antSystemInitialized) return;
  window.__antSystemInitialized = true;

  // Configuration
  const CONFIG = {
    enabledKey: "sugarAtelier_ants_enabled",
    maxRoamingAnts: 5,
    followerFollowSpeed: 0.08, // Lerp speed
    minDistanceToMouse: 38,    // Stops this far from cursor
    crumbAttractRadius: 450,   // Ant will seek crumbs if dropped nearby
    soundsEnabled: false       // Silent & smooth
  };

  let isEnabled = localStorage.getItem(CONFIG.enabledKey) !== "false";

  // SVG Ant Template (Tripod gait ready, facing positive X axis)
  function createAntSvg(size = 36, carriedItem = "") {
    return `
      <svg class="ant-svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible;">
        <defs>
          <filter id="antShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="rgba(35, 15, 20, 0.35)" />
          </filter>
        </defs>
        
        <!-- Carried Crumb / Item (at the front mandibles) -->
        ${
          carriedItem
            ? `<g class="carried-crumb" transform="translate(86, 50)"><text x="0" y="4" font-size="16" text-anchor="middle">${carriedItem}</text></g>`
            : ""
        }

        <g filter="url(#antShadow)">
          <!-- Legs Group A (L1, R2, L3) -->
          <g class="legs-group-a">
            <!-- Front Left Leg (L1) -->
            <path class="ant-leg l1" d="M 57 44 Q 68 28 80 22" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Middle Right Leg (R2) -->
            <path class="ant-leg r2" d="M 52 57 Q 52 74 46 84" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Back Left Leg (L3) -->
            <path class="ant-leg l3" d="M 45 44 Q 32 26 18 20" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </g>

          <!-- Legs Group B (R1, L2, R3) -->
          <g class="legs-group-b">
            <!-- Front Right Leg (R1) -->
            <path class="ant-leg r1" d="M 57 56 Q 68 72 80 78" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Middle Left Leg (L2) -->
            <path class="ant-leg l2" d="M 52 43 Q 52 26 46 16" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Back Right Leg (R3) -->
            <path class="ant-leg r3" d="M 45 56 Q 32 74 18 80" fill="none" stroke="#231310" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </g>

          <!-- Abdomen (Gaster) -->
          <ellipse cx="24" cy="50" rx="16" ry="11" fill="#2b1410" />
          <ellipse cx="21" cy="48" rx="8" ry="4" fill="#4d241c" opacity="0.6" />
          <path d="M 20 40 Q 24 50 20 60" stroke="#1a0b08" stroke-width="1" fill="none" opacity="0.4" />
          <path d="M 28 41 Q 31 50 28 59" stroke="#1a0b08" stroke-width="1" fill="none" opacity="0.4" />

          <!-- Petiole (Waist) -->
          <ellipse cx="42" cy="50" rx="3.5" ry="3.5" fill="#1f0e0b" />

          <!-- Thorax (Mesosoma) -->
          <ellipse cx="52" cy="50" rx="8" ry="6.5" fill="#351813" />
          <ellipse cx="51" cy="48" rx="5" ry="3" fill="#5c2c22" opacity="0.5" />

          <!-- Neck -->
          <ellipse cx="61" cy="50" rx="2" ry="2.5" fill="#1f0e0b" />

          <!-- Head -->
          <ellipse cx="69" cy="50" rx="7.5" ry="6" fill="#2b1410" />
          <circle cx="72" cy="47" r="1.2" fill="#0d0504" />
          <circle cx="72" cy="53" r="1.2" fill="#0d0504" />

          <!-- Mandibles -->
          <path d="M 76 48 L 81 46" stroke="#1a0b08" stroke-width="2" stroke-linecap="round" />
          <path d="M 76 52 L 81 54" stroke="#1a0b08" stroke-width="2" stroke-linecap="round" />

          <!-- Antennae with elbow joint & subtle twitch -->
          <g class="ant-antennae">
            <path class="antenna-l" d="M 74 47 Q 81 40 88 38" fill="none" stroke="#231310" stroke-width="1.6" stroke-linecap="round" />
            <path class="antenna-r" d="M 74 53 Q 81 60 88 62" fill="none" stroke="#231310" stroke-width="1.6" stroke-linecap="round" />
          </g>
        </g>
      </svg>
    `;
  }

  // Master Container
  let container = null;
  let followerEl = null;
  let toggleBtn = null;
  let crumbs = [];
  let roamingAnts = [];

  // Mouse & Follower Ant Physics State
  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, moved: false };
  let ant = {
    x: window.innerWidth / 2 + 80,
    y: window.innerHeight / 2 + 80,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    orbitAngle: 0,
    isWalking: false,
    activeTarget: null // If targeting a dropped crumb
  };

  // ── Sweet Notes Pool ──────────────────────────────────────────────
  const sweetNotes = [
    "🍰 So sweet!",     "💕 Yummy!",         "✨ Delicious!",
    "🧁 Cutie!",        "🍓 Tasty!",         "💛 Sweet ant!",
    "🎀 Adorable!",     "🌸 Lovely!",        "🍬 Sugar rush!",
    "⭐ So fluffy!",    "🎂 Cake time!",     "💖 Sweet vibes!",
    "🫶 Aww!",          "🌟 Magical!",       "🍫 Chocolatey!",
    "🥰 So cute!",      "🪄 Enchanting!",    "🌈 Rainbow sweet!",
  ];

  // Build DOM Elements
  function initDOM() {
    // 1. Container for all ants
    container = document.createElement("div");
    container.id = "sugarAtelierAntSystem";
    container.className = "ant-system-container" + (isEnabled ? "" : " ant-system-hidden");
    document.body.appendChild(container);

    // 2. Follower Ant Element
    followerEl = document.createElement("div");
    followerEl.id = "antFollower";
    followerEl.className = "ant-follower";
    followerEl.innerHTML = createAntSvg(38);
    container.appendChild(followerEl);

    // 3. Free-roaming worker ants — clickable, wander whole screen
    initRoamingAnts();

    // 4. Floating Toggle Button (Discreet & aesthetic)
    toggleBtn = document.createElement("button");
    toggleBtn.id = "antToggleBtn";
    toggleBtn.className = "ant-toggle-btn";
    toggleBtn.setAttribute("type", "button");
    toggleBtn.setAttribute("title", "Cake attracts sweet ants! Click to toggle animation");
    updateToggleBtnText();
    toggleBtn.addEventListener("click", toggleAnts);
    document.body.appendChild(toggleBtn);
  }

  function updateToggleBtnText() {
    if (!toggleBtn) return;
    toggleBtn.innerHTML = `
      <span class="ant-btn-icon">${isEnabled ? "🐜" : "🚫"}</span>
      <span class="ant-btn-label">Ants: <strong>${isEnabled ? "ON" : "OFF"}</strong></span>
    `;
    toggleBtn.classList.toggle("is-off", !isEnabled);
  }

  function toggleAnts() {
    isEnabled = !isEnabled;
    localStorage.setItem(CONFIG.enabledKey, isEnabled ? "true" : "false");
    updateToggleBtnText();
    if (container) {
      container.classList.toggle("ant-system-hidden", !isEnabled);
    }
  }

  // ================================================================
  // FREE-ROAMING ANTS — Spawn randomly across the WHOLE screen
  // ================================================================
  function initRoamingAnts() {
    const crumbIcons = ["🍰", "🍓", "🧁", "🎂", "🍬", "🍫"];
    const count = CONFIG.maxRoamingAnts;

    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "ant-marching ant-walking";
      // Roaming ants ARE clickable
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";
      el.style.zIndex = "9998";

      // Start with no food in mouth
      el.innerHTML = createAntSvg(26, "");

      // Spawn at truly random positions across the full viewport
      const startX = 80 + Math.random() * (window.innerWidth  - 160);
      const startY = 80 + Math.random() * (window.innerHeight - 160);
      const startAngle = Math.random() * Math.PI * 2;

      const antData = {
        el,
        x: startX,
        y: startY,
        angle: startAngle,
        targetAngle: startAngle,
        speed: 0.85 + Math.random() * 0.65,
        carried: "",           // currently carrying nothing
        carrying: false,
        // Countdown (frames) until ant picks up food — staggered so not all pick up at once
        pickupTimer: 180 + i * 120 + Math.random() * 200,
        // Countdown (frames) after picking up food until ant drops it
        dropTimer: 0,
        wiggleOffset: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 100,
        wanderInterval: 70 + Math.random() * 110,
        wobble: Math.random() * Math.PI * 2,
        fleeing: false,
        crumbIcons,
      };

      // ── Click = Sweet Note! ───────────────────────────────────────
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showSweetNote(antData.x, antData.y);
        // Little direction change on click
        antData.targetAngle = Math.random() * Math.PI * 2;
        antData.wanderTimer = 60;
      });

      container.appendChild(el);
      roamingAnts.push(antData);
    }
  }

  // ── Drop food with a bounce+vanish animation ──────────────────────
  function dropFood(m) {
    if (!m.carried) return;
    const dropEl = document.createElement("div");
    dropEl.className = "ant-dropped-food";
    dropEl.textContent = m.carried;
    dropEl.style.cssText = `
      position: fixed;
      left: ${m.x}px;
      top:  ${m.y}px;
      font-size: 18px;
      pointer-events: none;
      z-index: 9997;
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
      transition: none;
    `;
    document.body.appendChild(dropEl);

    // Bounce up then fall and fade out
    requestAnimationFrame(() => {
      dropEl.style.transition = "transform 0.35s cubic-bezier(.2,1.6,.6,1), opacity 0.8s ease";
      dropEl.style.transform  = `translate(-50%, -160%) scale(1.35)`;
      dropEl.style.opacity    = "0.9";
      setTimeout(() => {
        dropEl.style.transition = "transform 0.55s ease-in, opacity 0.55s ease-in";
        dropEl.style.transform  = `translate(-50%, 60%) scale(0.5)`;
        dropEl.style.opacity    = "0";
        setTimeout(() => dropEl.remove(), 600);
      }, 370);
    });
  }

  // ── Pop a cute floating sweet note near the clicked ant ──────────
  function showSweetNote(x, y) {
    const note = sweetNotes[Math.floor(Math.random() * sweetNotes.length)];
    const el = document.createElement("div");
    el.className = "ant-sweet-note";
    el.textContent = note;

    // Slight random horizontal scatter so multiple notes don't stack
    const offsetX = (Math.random() - 0.5) * 70;
    el.style.left  = `${x + offsetX}px`;
    el.style.top   = `${y - 16}px`;
    document.body.appendChild(el);

    // Trigger float-up animation on next frame
    requestAnimationFrame(() => el.classList.add("ant-sweet-note-show"));

    setTimeout(() => {
      el.classList.add("ant-sweet-note-hide");
      setTimeout(() => el.remove(), 450);
    }, 1900);
  }

  // Mouse Move Listener
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.moved = true;
  });

  // Touch support for mobile devices
  window.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.moved = true;
    }
  }, { passive: true });

  // Click to Drop Crumb Interaction!
  document.addEventListener("click", (e) => {
    if (!isEnabled) return;
    // Don't drop crumb if clicking interactive controls like inputs or toggle button
    const target = e.target;
    if (target.closest("button, input, select, textarea, .ant-toggle-btn, a, .ant-marching")) {
      return;
    }

    dropCakeCrumb(e.clientX, e.clientY);
  });

  function dropCakeCrumb(x, y) {
    const crumbEl = document.createElement("div");
    crumbEl.className = "ant-crumb";
    const crumbsPool = ["🍰", "🧁", "✨", "🍓", "✨"];
    crumbEl.textContent = crumbsPool[Math.floor(Math.random() * crumbsPool.length)];
    crumbEl.style.left = `${x}px`;
    crumbEl.style.top = `${y}px`;
    container.appendChild(crumbEl);

    const crumbObj = {
      x,
      y,
      el: crumbEl,
      createdAt: performance.now(),
      eaten: false
    };
    crumbs.push(crumbObj);

    // Alert follower ant to target this delicious crumb!
    if (!ant.activeTarget) {
      const dist = Math.hypot(x - ant.x, y - ant.y);
      if (dist < CONFIG.crumbAttractRadius) {
        ant.activeTarget = crumbObj;
      }
    }

    // Auto cleanup after 8 seconds if not eaten
    setTimeout(() => {
      removeCrumb(crumbObj);
    }, 8000);
  }

  function removeCrumb(crumbObj) {
    const idx = crumbs.indexOf(crumbObj);
    if (idx !== -1) {
      crumbs.splice(idx, 1);
      if (crumbObj.el && crumbObj.el.parentNode) {
        crumbObj.el.remove();
      }
    }
    if (ant.activeTarget === crumbObj) {
      ant.activeTarget = null;
    }
  }

  function createNibbleEffect(x, y) {
    for (let i = 0; i < 4; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "ant-nibble-sparkle";
      sparkle.textContent = ["✨", "💛", "⭐"][Math.floor(Math.random() * 3)];
      sparkle.style.left = `${x + (Math.random() * 30 - 15)}px`;
      sparkle.style.top = `${y + (Math.random() * 30 - 15)}px`;
      container.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 700);
    }
  }

  // Smooth Angle Normalization & Interpolation
  function lerpAngle(current, target, factor) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * factor;
  }

  // Main 60FPS Animation Loop
  function tick(timestamp) {
    if (isEnabled) {
      // 1. UPDATE FOLLOWER ANT
      updateFollowerAnt(timestamp);

      // 2. UPDATE ROAMING ANTS
      updateRoamingAnts(timestamp);
    }

    requestAnimationFrame(tick);
  }

  function updateFollowerAnt(timestamp) {
    if (!followerEl) return;

    let targetX = mouse.x;
    let targetY = mouse.y;

    // Check if ant is pursuing a crumb
    if (ant.activeTarget && !ant.activeTarget.eaten) {
      targetX = ant.activeTarget.x;
      targetY = ant.activeTarget.y;

      const distToCrumb = Math.hypot(targetX - ant.x, targetY - ant.y);
      if (distToCrumb < 25) {
        // Ate the crumb!
        ant.activeTarget.eaten = true;
        createNibbleEffect(targetX, targetY);
        removeCrumb(ant.activeTarget);
        ant.activeTarget = null;
      }
    } else {
      // Normal cursor following & playful orbit
      const dxToMouse = mouse.x - ant.x;
      const dyToMouse = mouse.y - ant.y;
      const distToMouse = Math.hypot(dxToMouse, dyToMouse);

      if (distToMouse <= CONFIG.minDistanceToMouse + 15) {
        // Mouse stopped or ant is right next to it: gently orbit & wiggle!
        ant.orbitAngle += 0.035;
        const orbitRadius = 32 + Math.sin(timestamp * 0.003) * 6;
        targetX = mouse.x + Math.cos(ant.orbitAngle) * orbitRadius;
        targetY = mouse.y + Math.sin(ant.orbitAngle) * orbitRadius;
      }
    }

    // Direction vector towards target
    const dx = targetX - ant.x;
    const dy = targetY - ant.y;
    const dist = Math.hypot(dx, dy);

    // Check if ant needs to move
    if (dist > 3) {
      const speed = Math.min(dist * 0.12, 11);
      const targetAngle = Math.atan2(dy, dx);

      // Smooth turning angle
      ant.angle = lerpAngle(ant.angle, targetAngle, 0.18);

      // Smooth coordinate movement
      ant.x += Math.cos(ant.angle) * speed;
      ant.y += Math.sin(ant.angle) * speed;
      ant.speed = speed;

      if (!ant.isWalking) {
        ant.isWalking = true;
        followerEl.classList.add("ant-walking");
      }
    } else {
      ant.speed = 0;
      if (ant.isWalking) {
        ant.isWalking = false;
        followerEl.classList.remove("ant-walking");
      }
    }

    // Render Follower Ant transform (Convert radians to degrees)
    const deg = (ant.angle * 180) / Math.PI;
    followerEl.style.transform = `translate3d(${ant.x - 19}px, ${ant.y - 19}px, 0) rotate(${deg}deg)`;
  }

  // ================================================================
  // ROAMING ANT UPDATE — random wandering across the full screen
  // ================================================================
  function updateRoamingAnts(timestamp) {
    const margin = 50;

    for (let i = 0; i < roamingAnts.length; i++) {
      const m = roamingAnts[i];

      // ── Food pick-up / drop cycle ─────────────────────────────────
      if (!m.carrying) {
        // Count down until ant picks up food
        m.pickupTimer--;
        if (m.pickupTimer <= 0) {
          // Pick up a random food item
          m.carried  = m.crumbIcons[Math.floor(Math.random() * m.crumbIcons.length)];
          m.carrying = true;
          // Carry it for 8–14 seconds (≈480–840 frames at 60fps)
          m.dropTimer   = 480 + Math.random() * 360;
          m.el.innerHTML = createAntSvg(26, m.carried);
        }
      } else {
        // Count down until ant drops the food
        m.dropTimer--;
        if (m.dropTimer <= 0) {
          // Drop & vanish the food
          dropFood(m);
          m.carried  = "";
          m.carrying = false;
          // Wait 6–12 seconds before picking up food again
          m.pickupTimer = 360 + Math.random() * 360;
          m.el.innerHTML = createAntSvg(26, "");
        }
      }

      // ── Wander: pick a new random direction periodically ──────────
      m.wanderTimer--;
      if (m.wanderTimer <= 0) {
        m.targetAngle    = m.angle + (Math.random() - 0.5) * Math.PI * 1.3;
        m.wanderTimer    = m.wanderInterval * (0.6 + Math.random() * 0.8);
      }

      // ── Edge avoidance ────────────────────────────────────────────
      const nearLeft   = m.x < margin;
      const nearRight  = m.x > window.innerWidth  - margin;
      const nearTop    = m.y < margin;
      const nearBottom = m.y > window.innerHeight - margin;

      if (nearLeft)              m.targetAngle = 0;
      if (nearRight)             m.targetAngle = Math.PI;
      if (nearTop)               m.targetAngle = Math.PI / 2;
      if (nearBottom)            m.targetAngle = -Math.PI / 2;
      if (nearLeft  && nearTop)  m.targetAngle =  Math.PI * 0.25;
      if (nearRight && nearTop)  m.targetAngle =  Math.PI * 0.75;
      if (nearLeft  && nearBottom) m.targetAngle = -Math.PI * 0.25;
      if (nearRight && nearBottom) m.targetAngle = -Math.PI * 0.75;

      // Mouse proximity flee removed — ants stay at normal speed so they can be clicked/touched
      let effectiveSpeed = m.speed;
      m.fleeing = false;

      // ── Smooth turn ───────────────────────────────────────────────
      m.angle = lerpAngle(m.angle, m.targetAngle, 0.055);

      // ── Move ──────────────────────────────────────────────────────
      m.x += Math.cos(m.angle) * effectiveSpeed;
      m.y += Math.sin(m.angle) * effectiveSpeed;

      // Hard clamp — never escape the viewport
      m.x = Math.max(8, Math.min(window.innerWidth  - 8, m.x));
      m.y = Math.max(8, Math.min(window.innerHeight - 8, m.y));

      // ── Organic body wobble ───────────────────────────────────────
      m.wobble += 0.14;
      const wobbleTilt = Math.sin(m.wobble) * 7;

      // ── Render ────────────────────────────────────────────────────
      const deg = (m.angle * 180) / Math.PI;
      m.el.style.transform = `translate3d(${m.x - 13}px, ${m.y - 13}px, 0) rotate(${deg + wobbleTilt}deg)`;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initDOM();
      requestAnimationFrame(tick);
    });
  } else {
    initDOM();
    requestAnimationFrame(tick);
  }
})();
