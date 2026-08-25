/* ============================================================
   INST ACESSOR — Interações da apresentação
   ------------------------------------------------------------
   - Nav com estado de scroll + menu mobile
   - Reveal por IntersectionObserver
   - Contadores animados (números)
   - Barras de progresso animadas
   - Anéis SVG de score (animate)
   - Tabs (timeline / histórico / copy)
   - Marquee, spotlight, parallax
   - Copy generator demo
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav scroll ---------- */
  var nav = document.querySelector(".nav");
  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- Menu mobile ---------- */
  var burger = document.querySelector(".nav-burger");
  if (burger) {
    burger.addEventListener("click", function () {
      nav.classList.toggle("open");
      var icon = burger.querySelector(".x");
      document.body.style.overflow = nav.classList.contains("open") ? "hidden" : "";
    });
  }

  /* ---------- Smooth scroll (âncoras) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id === "#") return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (nav) nav.classList.remove("open");
      document.body.style.overflow = "";
      var top = el.getBoundingClientRect().top + window.pageYOffset - (nav ? nav.offsetHeight + 8 : 16);
      window.scrollTo({ top: top, behavior: prefersReduced ? "auto" : "smooth" });
    });
  });

  /* ---------- Reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          ro.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Helpers ---------- */
  function formatNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  /* ---------- Contadores animados ---------- */
  var counters = document.querySelectorAll("[data-count]");
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var dur = 1500;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      var txt = decimals
        ? val.toFixed(decimals).replace(".", ",")
        : Math.round(val).toLocaleString("pt-BR");
      el.textContent = prefix + txt + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && !prefersReduced) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          animateCounter(en.target);
          co.unobserve(en.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = (el.getAttribute("data-prefix") || "") + el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
    });
  }

  /* ---------- Barras de progresso ---------- */
  var bars = document.querySelectorAll(".pillar-bar i, .xp-bar-fill, .goal-progress .gp-bar i, .format-row .f-bar i, .ach-progress i, .diag-bar i, .rank-progress .rp-bar i, .strategy-score .ss-bar i");
  function animateBars() {
    bars.forEach(function (bar) {
      var target = parseFloat(bar.getAttribute("data-w") || bar.parentElement.getAttribute("data-w") || "0");
      bar.style.width = target + "%";
    });
  }
  if ("IntersectionObserver" in window && !prefersReduced) {
    var bo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.style.width = (parseFloat(en.target.getAttribute("data-w") || en.target.parentElement.getAttribute("data-w") || "0")) + "%";
          bo.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    bars.forEach(function (bar) { bo.observe(bar); });
  } else {
    animateBars();
  }

  /* ---------- Anéis de score (SVG) ---------- */
  var rings = document.querySelectorAll(".ring-svg");
  if (!prefersReduced) {
    var ringObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var ring = en.target;
          var circle = ring.querySelector(".ring-progress");
          var num = ring.querySelector(".ring-num");
          var target = parseFloat(ring.getAttribute("data-value") || "0");
          var dur = 1600;
          var start = null;
          var C = 2 * Math.PI * parseFloat(circle.getAttribute("r"));
          circle.style.strokeDasharray = C;
          circle.style.strokeDashoffset = C;
          function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            circle.style.strokeDashoffset = C - (C * (target / 100) * eased);
            if (num) num.textContent = Math.round(target * eased);
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
          ringObs.unobserve(ring);
        }
      });
    }, { threshold: 0.4 });
    rings.forEach(function (r) { ringObs.observe(r); });
  }

  /* ---------- Tabs (timeline / histórico / copy) ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var btns = group.querySelectorAll("[data-tab]");
    var prefix = group.getAttribute("data-tabs"); // ex.: "tl-", "hist-"
    function getPanels() {
      return document.querySelectorAll('[id^="' + prefix + '"]');
    }
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        btns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var id = btn.getAttribute("data-tab");
        getPanels().forEach(function (p) {
          var on = p.id === id;
          p.classList.toggle("active-panel", on);
          p.style.display = on ? "" : "none";
        });
      });
    });
  });

  /* ---------- Copy generator ---------- */
  var copyTabBtns = document.querySelectorAll(".copy-tab");
  var copyTexts = document.querySelectorAll("[data-copy-panel]");
  function setCopyPanel(id, btn) {
    copyTexts.forEach(function (p) {
      p.style.display = p.id === id ? "block" : "none";
    });
    copyTabBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
  }
  copyTabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setCopyPanel(btn.getAttribute("data-tab"), btn);
    });
  });
  var copyGenBtn = document.getElementById("genCopy");
  if (copyGenBtn) {
    var variants = [
      { text: "Você posta. A inteligência estuda. Seu perfil cresce. Conheça o Inst Acessor e transforme suas métricas em estratégia.", hl: "transforme suas métricas em estratégia" },
      { text: "Alcance caindo? A IA do Inst Acessor encontrou o motivo e já separou 3 ações para você reverter hoje.", hl: "já separou 3 ações" },
      { text: "Seus melhores conteúdos têm um padrão. O Inst Acessor descobriu o seu — e mostra como repetir o acerto.", hl: "mostra como repetir o acerto" },
      { text: "De dados soltos a um plano semanal: o Inst Acessor conecta seu Instagram ao próximo nível.", hl: "conecta seu Instagram ao próximo nível" }
    ];
    var vi = 0;
    var txtEl = document.getElementById("copyText");
    var hlEl = document.getElementById("copyHl");
    copyGenBtn.addEventListener("click", function () {
      vi = (vi + 1) % variants.length;
      var v = variants[vi];
      txtEl.textContent = v.text;
      hlEl.textContent = v.hl;
      // re-aplica o highlight no meio do texto
      txtEl.innerHTML = "";
      var idx = v.text.indexOf(v.hl);
      if (idx > -1) {
        var before = document.createTextNode(v.text.slice(0, idx));
        var mark = document.createElement("span");
        mark.className = "hl";
        mark.textContent = v.hl;
        var after = document.createTextNode(v.text.slice(idx + v.hl.length));
        txtEl.appendChild(before);
        txtEl.appendChild(mark);
        txtEl.appendChild(after);
      }
    });
  }

  /* ---------- Parallax suave ---------- */
  var floatEls = document.querySelectorAll("[data-parallax]");
  if (!prefersReduced && floatEls.length && window.matchMedia("(min-width: 900px)").matches) {
    var raf = null;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        floatEls.forEach(function (el) {
          var speed = parseFloat(el.getAttribute("data-parallax") || "0.1");
          var rect = el.getBoundingClientRect();
          var center = rect.top + rect.height / 2 - window.innerHeight / 2;
          el.style.transform = "translateY(" + (-center * speed * -0.12).toFixed(2) + "px)";
        });
        raf = null;
      });
    }, { passive: true });
  }

  /* ---------- Spotlight (hero) ---------- */
  var spot = document.querySelector(".spotlight");
  if (spot && !prefersReduced && window.matchMedia("(pointer: fine)").matches) {
    var hero = document.querySelector(".hero");
    function move(e) {
      spot.style.setProperty("--mx", e.clientX + "px");
      spot.style.setProperty("--my", e.clientY + "px");
      if (!spot.classList.contains("on")) spot.classList.add("on");
    }
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseout", function () {
      if (spot) spot.classList.remove("on");
    });
  }

  /* ---------- Alertas entram em sequência ---------- */
  var alertItems = document.querySelectorAll(".alert-item");
  if ("IntersectionObserver" in window && !prefersReduced) {
    var ao = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (en.isIntersecting) {
          setTimeout(function () { en.target.classList.add("in"); }, i * 180);
          ao.unobserve(en.target);
        }
      });
    }, { threshold: 0.3 });
    alertItems.forEach(function (el) { ao.observe(el); });
  } else {
    alertItems.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Anos / hora no footer ---------- */
  var yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
