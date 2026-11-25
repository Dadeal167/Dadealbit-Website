const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(any-pointer: fine)");

function revealOnScroll() {
  if (motionPreference.matches || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12 });

  for (const section of document.querySelectorAll("[data-reveal]")) {
    section.classList.add("reveal-ready");
    observer.observe(section);
  }

  const tagline = document.querySelector("[data-word-reveal]");
  if (!tagline) return;

  const taglineObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    taglineObserver.disconnect();
    const words = tagline.querySelectorAll("span");
    words.forEach((word, index) => {
      setTimeout(() => word.classList.add("is-visible"), index * 80);
    });
  }, { threshold: 0.4 });

  tagline.classList.add("word-reveal-ready");
  taglineObserver.observe(tagline);
}

function animateHero() {
  const canvas = document.querySelector(".hero-motion");
  const context = canvas?.getContext("2d");
  if (!context) return;

  const toggle = document.querySelector("[data-motion-toggle]");
  const preview = canvas.closest(".preview");
  const lights = [
    { color: "66, 130, 247", x: .70, y: .34, phase: .2 },
    { color: "238, 128, 212", x: .14, y: .76, phase: 2.0 },
    { color: "66, 211, 177", x: .77, y: .82, phase: 4.4 },
  ];
  const sceneColors = {
    "preview-wallpaper": [.78, .62, .57],
    "preview-formulas": [.64, .81, .33],
    "preview-publication": [.48, .34, .80],
  };
  let targetColors = sceneColors[preview.querySelector("input:checked").id];
  let lightOpacity = [...targetColors];
  let width = 0;
  let height = 0;
  let directionX = 0;
  let directionY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let elapsed = 0;
  let animationFrame = 0;
  let lastPaint = null;
  let visible = true;
  let paused = false;

  function draw() {
    context.clearRect(0, 0, width, height);
    lights.forEach(({ color, x, y, phase }, index) => {
      const time = elapsed * .42 + phase;
      const centerX = width * (x + Math.sin(time) * .17 + tiltX * .075);
      const centerY = height * (y + Math.cos(time * .8) * .27 + tiltY * .09);
      context.save();
      context.translate(centerX, centerY);
      context.scale(width * (.53 + Math.sin(time) * .09), height * .80);
      const light = context.createRadialGradient(0, 0, .08, 0, 0, 1);
      light.addColorStop(0, `rgba(${color}, ${lightOpacity[index]})`);
      light.addColorStop(.55, `rgba(${color}, ${lightOpacity[index] * .55})`);
      light.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = light;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    });
  }

  const canAnimate = () => visible && !paused && !motionPreference.matches && !document.hidden;

  function schedule() {
    if (canAnimate() && !animationFrame) animationFrame = requestAnimationFrame(tick);
  }

  function tick(time) {
    animationFrame = 0;
    if (!canAnimate()) {
      lastPaint = null;
      return;
    }
    if (lastPaint === null || time - lastPaint >= 1000 / 40) {
      if (lastPaint !== null) elapsed += Math.min(50, time - lastPaint) / 1000;
      tiltX += (directionX - tiltX) * 0.16;
      tiltY += (directionY - tiltY) * 0.16;
      lightOpacity = lightOpacity.map((value, index) => value + (targetColors[index] - value) * .12);
      draw();
      lastPaint = time;
    }
    schedule();
  }

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 1.25);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    draw();
    schedule();
  }

  function clearTilt() {
    directionX = 0;
    directionY = 0;
    preview.style.removeProperty("--preview-tilt-x");
    preview.style.removeProperty("--preview-tilt-y");
  }

  function applyMotionSettings() {
    const disabled = paused || motionPreference.matches;
    document.documentElement.classList.toggle("motion-paused", disabled);
    toggle.hidden = motionPreference.matches;
    toggle.textContent = paused ? "播放动效" : "暂停动效";
    window.websitePointer?.apply(!disabled && finePointer.matches);
    if (disabled) {
      clearTilt();
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastPaint = null;
    }
    schedule();
  }

  preview.addEventListener("change", (event) => {
    if (!sceneColors[event.target.id]) return;
    targetColors = sceneColors[event.target.id];
    if (paused || motionPreference.matches) {
      lightOpacity = [...targetColors];
      draw();
    }
  });
  preview.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !canAnimate()) return;
    const bounds = preview.getBoundingClientRect();
    directionX = 2 * (event.clientX - bounds.left) / bounds.width - 1;
    directionY = 2 * (event.clientY - bounds.top) / bounds.height - 1;
    preview.style.setProperty("--preview-tilt-x", `${-1.6 * directionY}deg`);
    preview.style.setProperty("--preview-tilt-y", `${2.4 * directionX}deg`);
  }, { passive: true });
  preview.addEventListener("pointerleave", clearTilt);
  toggle.addEventListener("click", () => {
    paused = !paused;
    applyMotionSettings();
  });
  motionPreference.addEventListener("change", applyMotionSettings);
  finePointer.addEventListener("change", applyMotionSettings);
  document.addEventListener("visibilitychange", schedule);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }).observe(canvas);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  applyMotionSettings();
  resize();
}

revealOnScroll();
animateHero();
