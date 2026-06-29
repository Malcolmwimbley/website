/* ══════════════════════════════════════════
   Malcolm Wimbley — Software Engineer
   main.js
══════════════════════════════════════════ */

/* ─────────────────────────────────────────
   STAR FIELD
───────────────────────────────────────── */
(function () {
  const c = document.getElementById('stars');
  const ctx = c.getContext('2d');
  let stars = [];

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    stars = Array.from({ length: 180 }, () => ({
      x:  Math.random() * c.width,
      y:  Math.random() * c.height,
      r:  Math.random() * 1.4 + 0.2,
      a:  Math.random(),
      sp: Math.random() * 0.004 + 0.001,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.a += s.sp;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,244,248,${0.25 + 0.5 * Math.abs(Math.sin(s.a))})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

/* ─────────────────────────────────────────
   INTERACTIVE EARTH GLOBE
───────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('globeCanvas');
  const ctx    = canvas.getContext('2d');
  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R  = W / 2 - 10;

  // Houston coordinates
  const HOUSTON_LAT =  29.7604 * Math.PI / 180;
  const HOUSTON_LON = -95.3698 * Math.PI / 180;

  // Rotation state
  let rotY     = -1.8; // start showing Americas
  let rotX     =  0.15;
  let drag     = false;
  let lastX    = 0, lastY = 0;
  let velX     = 0, velY  = 0.0015;
  let autoSpin = true;
  let pulseT   = 0;

  // Touch support
  let lastTouchX = 0, lastTouchY = 0;

  // Simplified continent polygons [lon, lat] in degrees
  const LAND = [
    // North America
    { pts: [[-170,70],[-140,70],[-110,65],[-85,70],[-65,60],[-55,47],[-70,43],[-75,25],[-85,15],[-90,15],[-100,20],[-105,30],[-115,30],[-120,40],[-130,50],[-140,55],[-155,60],[-168,65],[-170,70]] },
    // Greenland
    { pts: [[-55,85],[-20,85],[-15,70],[-35,60],[-55,65],[-55,85]] },
    // South America
    { pts: [[-80,10],[-70,15],[-60,10],[-50,0],[-35,-5],[-35,-20],[-55,-35],[-65,-55],[-70,-50],[-80,-40],[-75,-20],[-80,0],[-80,10]] },
    // Europe
    { pts: [[-10,35],[30,35],[40,45],[30,60],[20,70],[5,60],[-5,50],[-10,35]] },
    // Africa
    { pts: [[-18,15],[40,15],[50,10],[45,-10],[35,-35],[20,-35],[15,-30],[10,-5],[0,5],[-18,10],[-18,15]] },
    // Asia
    { pts: [[30,35],[100,10],[120,20],[140,35],[140,70],[60,80],[30,70],[30,35]] },
    // Australia
    { pts: [[115,-20],[135,-15],[150,-25],[150,-40],[135,-40],[115,-35],[115,-20]] },
    // UK / Ireland
    { pts: [[-8,50],[2,50],[2,58],[-5,58],[-8,55],[-8,50]] },
  ];

  // Convert lat/lon (radians) → unit-sphere XYZ
  function latLonTo3D(lat, lon) {
    return {
      x: Math.cos(lat) * Math.cos(lon),
      y: Math.sin(lat),
      z: Math.cos(lat) * Math.sin(lon),
    };
  }

  // Apply Y-axis then X-axis rotation
  function rotatePoint(p) {
    const x1 =  p.x * Math.cos(rotY) + p.z * Math.sin(rotY);
    const z1 = -p.x * Math.sin(rotY) + p.z * Math.cos(rotY);
    const y1 =  p.y;
    const y2 =  y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 =  y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
    return { x: x1, y: y2, z: z2 };
  }

  // Project 3D point onto 2D canvas
  function project(p3d) {
    return { x: cx + p3d.x * R, y: cy - p3d.y * R, vis: p3d.z > 0 };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pulseT += 0.04;

    // Atmosphere glow
    const atm = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.18);
    atm.addColorStop(0,   'rgba(0,180,255,0.0)');
    atm.addColorStop(0.5, 'rgba(0,180,255,0.06)');
    atm.addColorStop(1,   'rgba(0,50,120,0.0)');
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = atm; ctx.fill();

    // Ocean base
    const ocean = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.05, cx, cy, R);
    ocean.addColorStop(0,   '#0d2a4a');
    ocean.addColorStop(0.5, '#071828');
    ocean.addColorStop(1,   '#040e18');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = ocean; ctx.fill();

    // Grid lines
    ctx.strokeStyle = 'rgba(0,245,255,0.07)';
    ctx.lineWidth   = 0.8;

    for (let lon = -180; lon <= 180; lon += 30) {
      const lonR = lon * Math.PI / 180;
      ctx.beginPath(); let first = true;
      for (let lat = -90; lat <= 90; lat += 3) {
        const p  = latLonTo3D(lat * Math.PI / 180, lonR);
        const r  = rotatePoint(p);
        const pr = project(r);
        if (!pr.vis) { first = true; continue; }
        first ? ctx.moveTo(pr.x, pr.y) : ctx.lineTo(pr.x, pr.y);
        first = false;
      }
      ctx.stroke();
    }

    for (let lat = -75; lat <= 75; lat += 30) {
      const latR = lat * Math.PI / 180;
      ctx.beginPath(); let first = true;
      for (let lon = -180; lon <= 180; lon += 3) {
        const p  = latLonTo3D(latR, lon * Math.PI / 180);
        const r  = rotatePoint(p);
        const pr = project(r);
        if (!pr.vis) { first = true; continue; }
        first ? ctx.moveTo(pr.x, pr.y) : ctx.lineTo(pr.x, pr.y);
        first = false;
      }
      ctx.stroke();
    }

    // Continents
    LAND.forEach(land => {
      ctx.beginPath();
      let started = false;
      land.pts.forEach(([lon, lat]) => {
        const p  = latLonTo3D(lat * Math.PI / 180, lon * Math.PI / 180);
        const r  = rotatePoint(p);
        const pr = project(r);
        if (!started) { ctx.moveTo(pr.x, pr.y); started = true; }
        else ctx.lineTo(pr.x, pr.y);
      });
      ctx.closePath();

      const midLon = (land.pts[0][0] + land.pts[Math.floor(land.pts.length / 2)][0]) / 2;
      const midLat = (land.pts[0][1] + land.pts[Math.floor(land.pts.length / 2)][1]) / 2;
      const cp = latLonTo3D(midLat * Math.PI / 180, midLon * Math.PI / 180);
      const cr = rotatePoint(cp);

      if (cr.z > -0.3) {
        const fade = Math.max(0, Math.min(1, (cr.z + 0.3) / 0.6));
        ctx.fillStyle   = `rgba(20,80,40,${0.55 * fade})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(30,160,70,${0.35 * fade})`;
        ctx.lineWidth   = 0.7;
        ctx.stroke();
      }
    });

    // Specular highlight
    const spec = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.38, 0, cx - R * 0.15, cy - R * 0.1, R * 0.85);
    spec.addColorStop(0,   'rgba(180,240,255,0.13)');
    spec.addColorStop(0.3, 'rgba(100,200,255,0.06)');
    spec.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = spec; ctx.fill();

    // Globe rim
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0,   'rgba(0,245,255,0.45)');
    rim.addColorStop(0.5, 'rgba(0,100,180,0.2)');
    rim.addColorStop(1,   'rgba(0,30,80,0.1)');
    ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke();

    // Houston marker
    const hp  = latLonTo3D(HOUSTON_LAT, HOUSTON_LON);
    const hr  = rotatePoint(hp);
    const hpr = project(hr);

    if (hr.z > 0.05) {
      const alpha = Math.min(1, (hr.z - 0.05) / 0.3);

      // Pulse rings
      for (let i = 0; i < 3; i++) {
        const phase  = (pulseT - i * 0.5) % (Math.PI * 2);
        const pScale = Math.sin(phase) * 0.5 + 0.5;
        const rad    = 6 + pScale * 14;
        const op     = (1 - pScale) * 0.7 * alpha;
        ctx.beginPath(); ctx.arc(hpr.x, hpr.y, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,215,0,${op})`;
        ctx.lineWidth   = 1.5; ctx.stroke();
      }

      // Centre dot
      ctx.beginPath(); ctx.arc(hpr.x, hpr.y, 5, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(255,215,0,${alpha})`;   ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`; ctx.lineWidth = 1.5; ctx.stroke();

      // Label
      const labelX = hpr.x + 10;
      const labelY = hpr.y - 10;
      ctx.font      = 'bold 11px JetBrains Mono, monospace';
      ctx.fillStyle = `rgba(255,215,0,${alpha})`;
      ctx.fillText('Houston, TX', labelX, labelY);
      ctx.font      = '9px JetBrains Mono, monospace';
      ctx.fillStyle = `rgba(200,220,255,${alpha * 0.7})`;
      ctx.fillText('29.76°N  95.37°W', labelX, labelY + 13);

      // Leader line
      ctx.beginPath();
      ctx.moveTo(hpr.x, hpr.y); ctx.lineTo(labelX - 2, labelY + 4);
      ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.5})`; ctx.lineWidth = 1; ctx.stroke();
    }

    if (autoSpin) rotY += velY;
    requestAnimationFrame(draw);
  }

  // Mouse drag
  canvas.addEventListener('mousedown', e => {
    drag = true; autoSpin = false;
    lastX = e.clientX; lastY = e.clientY;
    velX = 0; velY = 0;
  });
  canvas.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    rotY += dx * 0.006; rotX += dy * 0.004;
    rotX  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    velX  = dy * 0.004; velY = dx * 0.006;
    lastX = e.clientX;  lastY = e.clientY;
  });
  canvas.addEventListener('mouseup',    () => { drag = false; autoSpin = true; });
  canvas.addEventListener('mouseleave', () => { drag = false; autoSpin = true; });

  // Touch drag
  canvas.addEventListener('touchstart', e => {
    e.preventDefault(); drag = true; autoSpin = false;
    lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault(); if (!drag) return;
    const dx = e.touches[0].clientX - lastTouchX;
    const dy = e.touches[0].clientY - lastTouchY;
    rotY += dx * 0.006; rotX += dy * 0.004;
    rotX   = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
  });
  canvas.addEventListener('touchend', () => { drag = false; autoSpin = true; });

  draw();
})();

/* ─────────────────────────────────────────
   LIFE EXPECTANCY TIMER
───────────────────────────────────────── */
(function () {
  const BIRTH       = new Date('1997-01-25T00:00:00Z').getTime();
  const LIFE_Y      = 79;
  const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

  const intEl   = document.querySelector('#lifeTimer .int-part');
  const decEl   = document.querySelector('#lifeTimer .dec-part');
  const barFill = document.getElementById('timerBar');
  const barLbl  = document.getElementById('timerBarLabel');

  function update() {
    const elapsed = Date.now() - BIRTH;
    const years   = elapsed / MS_PER_YEAR;
    const pct     = Math.min((years / LIFE_Y) * 100, 100);
    const intPart = Math.floor(years);
    const decFull = (years - intPart).toFixed(9).slice(2);

    intEl.textContent       = String(intPart).padStart(2, '0');
    decEl.textContent       = decFull;
    barFill.style.width     = pct.toFixed(6) + '%';
    barLbl.textContent      = `${pct.toFixed(6)}% elapsed · ~${(LIFE_Y - years).toFixed(4)} years remaining (est.)`;

    requestAnimationFrame(update);
  }

  update();
})();
