const stage = document.querySelector("#spine-stage");
const status = document.querySelector("#spine-status");
const retry = document.querySelector("#spine-retry");
const wallpaper = document.querySelector("#preview-wallpaper");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scenePath = "./assets/spine/scene/";

let scene;
let visible = false;
let nearViewport = false;
let started = false;
let frame = 0;
let previousFrame;

function loadRuntime() {
  if (window.spine) return Promise.resolve(window.spine);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./assets/spine/spine-player.min.js";
    script.onload = () => resolve(window.spine);
    script.onerror = (error) => {
      script.remove();
      reject(error);
    };
    document.head.append(script);
  });
}

async function fetchSceneFile(filename) {
  const response = await fetch(scenePath + filename);
  if (!response.ok) throw new Error(`Unable to load ${filename}.`);
  return response;
}

async function createScene() {
  const runtime = loadRuntime();
  const atlasText = fetchSceneFile("CH0294_home.atlas").then((response) => response.text());
  const textureAssets = Promise.all([runtime, atlasText]).then(async ([spine, text]) => {
    const atlas = new spine.TextureAtlas(text);
    const images = await Promise.all(atlas.pages.map(async (page) => {
      const image = new Image();
      image.src = scenePath + page.name;
      await image.decode();
      return image;
    }));
    return { atlas, images };
  });
  const [spine, { atlas, images }, skeletonBytes] = await Promise.all([
    runtime,
    textureAssets,
    fetchSceneFile("CH0294_home.skel").then((response) => response.arrayBuffer()),
  ]);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  canvas.setAttribute("aria-hidden", "true");
  const context = new spine.ManagedWebGLRenderingContext(canvas, { alpha: false, antialias: true });
  const { gl } = context;
  if (!gl) throw new Error("WebGL is unavailable.");

  const data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas))
    .readSkeletonData(new Uint8Array(skeletonBytes));
  const skeleton = new spine.Skeleton(data);
  const state = new spine.AnimationState(new spine.AnimationStateData(data));
  const renderer = new spine.SceneRenderer(canvas, context);
  const premultipliedAlpha = atlas.pages.every((page) => page.pma);
  atlas.pages.forEach((page, index) => page.setTexture(new spine.GLTexture(context, images[index])));
  state.setAnimation(0, "Idle_01", true);

  // Frame the original camera artwork around the character and crop to cover the preview.
  renderer.camera.position.set(40, 1040, 0);
  const resizeObserver = new ResizeObserver(scheduleFrame);
  resizeObserver.observe(stage);
  canvas.addEventListener("webglcontextlost", () => {
    stage.dataset.state = "loading";
    previousFrame = undefined;
  });
  canvas.addEventListener("webglcontextrestored", scheduleFrame);
  stage.replaceChildren(canvas);

  return {
    draw(delta) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height || gl.isContextLost()) return false;
      const pixelRatio = Math.min(devicePixelRatio, 2);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const unitsPerPixel = Math.min(3040 / pixelWidth, 1710 / pixelHeight);
      renderer.camera.setViewport(pixelWidth * unitsPerPixel, pixelHeight * unitsPerPixel);
      skeleton.update(delta);
      state.update(delta);
      state.apply(skeleton);
      skeleton.updateWorldTransform(spine.Physics.update);
      gl.viewport(0, 0, pixelWidth, pixelHeight);
      gl.clearColor(0.13, 0.12, 0.27, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.begin();
      renderer.drawSkeleton(skeleton, premultipliedAlpha);
      renderer.end();
      return true;
    },
    dispose() {
      resizeObserver.disconnect();
      atlas.dispose();
      renderer.dispose();
      context.dispose();
      canvas.remove();
    },
  };
}

function failPreview() {
  cancelAnimationFrame(frame);
  frame = 0;
  scene?.dispose();
  scene = undefined;
  stage.dataset.state = "error";
  status.textContent = "暂时无法播放动态壁纸。";
  retry.hidden = false;
}

function canShow() {
  return wallpaper.checked && visible && !document.hidden;
}

function scheduleFrame() {
  if (scene && !frame && canShow()) frame = requestAnimationFrame(drawFrame);
}

function drawFrame(now) {
  frame = 0;
  if (!canShow()) return;
  const playing = !reducedMotion.matches && !document.documentElement.classList.contains("motion-paused");
  const delta = playing && previousFrame !== undefined ? Math.min((now - previousFrame) / 1000, 0.1) : 0;
  previousFrame = playing ? now : undefined;
  try {
    if (!scene.draw(delta)) return;
    const state = playing ? "playing" : "paused";
    if (stage.dataset.state !== state) stage.dataset.state = state;
    if (playing) scheduleFrame();
  } catch {
    failPreview();
  }
}

function syncPreview() {
  if (!started && (visible || nearViewport) && wallpaper.checked && !document.hidden) {
    started = true;
    stage.dataset.state = "loading";
    status.textContent = "正在加载动态壁纸…";
    retry.hidden = true;
    createScene().then((loadedScene) => {
      scene = loadedScene;
      syncPreview();
    }).catch(failPreview);
  }
  if (!canShow()) {
    cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = undefined;
    if (scene && stage.dataset.state === "playing") stage.dataset.state = "paused";
    return;
  }
  scheduleFrame();
}

new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  syncPreview();
}).observe(stage);
new IntersectionObserver(([entry]) => {
  nearViewport = entry.isIntersecting;
  syncPreview();
}, { rootMargin: "0px 0px 240px 0px" }).observe(stage);
retry.addEventListener("click", () => {
  started = false;
  syncPreview();
});
stage.closest(".preview").addEventListener("change", syncPreview);
document.addEventListener("visibilitychange", syncPreview);
reducedMotion.addEventListener("change", syncPreview);
new MutationObserver(syncPreview).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
