import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer, camera, camcontrols;
let mapa, mapsx, mapsy;
const scale = 5;

// Extremos geográficos del mapa
const minlon = -15.46945,
  maxlon = -15.39203;
const minlat = 28.07653,
  maxlat = 28.18235;

// Colores y escalas
const DEFAULT_COLOR = 0x1976d2; // azul
const HIGHLIGHT_COLOR = 0xff5252; // rojo
const DEFAULT_SCALE = 1.0;
const SELECTED_SCALE = 1.6;

const objetos = [];
const datosEstaciones = [];

// TÍTULO CENTRADO ARRIBA
const tituloPequeno = document.createElement("div");
tituloPequeno.textContent = "Mapa bicicletas Alberto Redondo";
Object.assign(tituloPequeno.style, {
  position: "fixed",
  top: "12px",
  left: "50%",
  transform: "translateX(-50%)",
  color: "white",
  fontSize: "16px",
  fontWeight: "bold",
  fontFamily: "system-ui, sans-serif",
  zIndex: "2000",
  opacity: "0.9",
});
document.body.appendChild(tituloPequeno);

let raycaster, mouse, tip, panel, search;
let animatingCamera = false;

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.enableDamping = true;
  camcontrols.dampingFactor = 0.06;
  camcontrols.minDistance = 1.2;
  camcontrols.maxDistance = 30;
  camcontrols.enablePan = true;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Tooltip
  tip = document.createElement("div");
  Object.assign(tip.style, {
    position: "fixed",
    pointerEvents: "none",
    padding: "4px 6px",
    borderRadius: "6px",
    background: "rgba(0,0,0,0.75)",
    color: "white",
    font: "12px system-ui, sans-serif",
    transform: "translate(-50%, -120%)",
    display: "none",
    zIndex: "1000",
  });
  document.body.appendChild(tip);

  // Panel
  panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    right: "12px",
    top: "12px",
    minWidth: "260px",
    maxWidth: "360px",
    padding: "12px",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,.15)",
    font: "14px system-ui, sans-serif",
    display: "none",
    zIndex: "999",
  });
  document.body.appendChild(panel);

  // Cerrar panel con click fuera
  document.addEventListener("click", (e) => {
    if (
      panel.style.display !== "none" &&
      !panel.contains(e.target) &&
      e.target !== renderer.domElement
    ) {
      panel.style.display = "none";
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") panel.style.display = "none";
  });

  // Buscador
  search = document.createElement("input");
  search.placeholder = "Buscar estación…";
  Object.assign(search.style, {
    position: "fixed",
    left: "12px",
    top: "48px",
    width: "260px",
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    background: "white",
    font: "14px system-ui, sans-serif",
    zIndex: "1001",
  });
  search.addEventListener("input", onSearch);
  document.body.appendChild(search);

  // Eventos
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);

  // Carga mapa + CSV
  new THREE.TextureLoader().load(
    "src/mapaLPGC.png",
    function (texture) {
      const ratio = texture.image.width / texture.image.height;
      mapsy = scale;
      mapsx = mapsy * ratio;

      Plano(0, 0, 0, mapsx, mapsy);
      mapa.material.map = texture;
      mapa.material.needsUpdate = true;

      camera.position.set(0, 0, Math.max(mapsx, mapsy));
      camcontrols.target.set(0, 0, 0);
      camcontrols.update();

      fetch("src/Geolocalización estaciones sitycleta.csv")
        .then((r) => r.text())
        .then(procesarCSVEstaciones)
        .catch((err) => console.error("Error CSV:", err));
    },
    undefined,
    function (err) {
      console.error("Error textura:", err);
    }
  );
}

function procesarCSVEstaciones(content) {
  const sep = ";";
  const filas = content.split("\n").filter((l) => l.trim().length > 0);
  if (filas.length < 2) return;

  const encabezados = filas[0].split(sep).map((s) => s.trim());
  const indices = {
    id: encabezados.indexOf("idbase"),
    nombre: encabezados.indexOf("nombre"),
    lat: encabezados.indexOf("latitud"),
    lon: encabezados.indexOf("altitud"),
    calle: encabezados.indexOf("calle"),
    numero: encabezados.indexOf("numero"),
    postal: encabezados.indexOf("codpostal"),
    ext: encabezados.indexOf("externalId"),
  };

  for (let i = 1; i < filas.length; i++) {
    const c = filas[i].split(sep);
    if (c.length <= 1) continue;

    const lat = parseFloat(c[indices.lat]);
    const lon = parseFloat(c[indices.lon]);
    if (isNaN(lat) || isNaN(lon)) continue;

    const est = {
      id: c[indices.id],
      nombre: c[indices.nombre],
      lat,
      lon,
      calle: c[indices.calle],
      numero: c[indices.numero],
      codpostal: c[indices.postal],
      externalId: c[indices.ext],
    };
    datosEstaciones.push(est);

    const x = Map2Range(lon, minlon, maxlon, -mapsx / 2, mapsx / 2);
    const y = Map2Range(lat, minlat, maxlat, -mapsy / 2, mapsy / 2);
    Esfera(x, y, 0, 0.02, 12, 12, DEFAULT_COLOR, est);
  }
}

function Map2Range(val, vmin, vmax, dmin, dmax) {
  const t = 1 - (vmax - val) / (vmax - vmin);
  return dmin + t * (dmax - dmin);
}

function Esfera(px, py, pz, r, nx, ny, col, data) {
  const g = new THREE.SphereGeometry(r, nx, ny);
  const m = new THREE.MeshBasicMaterial({ color: col });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(px, py, pz);
  mesh.userData = Object.assign({ _selected: false }, data || {});
  objetos.push(mesh);
  scene.add(mesh);
}

function Plano(px, py, pz, sx, sy) {
  const g = new THREE.PlaneGeometry(sx, sy);
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(px, py, pz);
  scene.add(mesh);
  mapa = mesh;
}

function applyDefaultStyle(marker) {
  marker.material.color.setHex(DEFAULT_COLOR);
  marker.scale.set(DEFAULT_SCALE, DEFAULT_SCALE, DEFAULT_SCALE);
}

function applySelectedStyle(marker) {
  marker.material.color.setHex(HIGHLIGHT_COLOR);
  marker.scale.set(SELECTED_SCALE, SELECTED_SCALE, SELECTED_SCALE);
}

function clearSelection() {
  for (let i = 0; i < objetos.length; i++) {
    const m = objetos[i];
    if (m.userData && m.userData._selected) {
      m.userData._selected = false;
      applyDefaultStyle(m);
    }
  }
}

function onMouseMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(objetos, false);
  if (hits.length) {
    const ud = hits[0].object.userData || {};
    const nombre = ud.nombre || "Estación";
    tip.textContent = nombre;
    tip.style.left = e.clientX + "px";
    tip.style.top = e.clientY + "px";
    tip.style.display = "block";
    document.body.style.cursor = "pointer";
  } else {
    tip.style.display = "none";
    document.body.style.cursor = "";
  }
}

function onClick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(objetos, false);
  if (!hits.length) return;

  const marker = hits[0].object;
  const d = marker.userData || {};

  clearSelection();
  marker.userData._selected = true;
  applySelectedStyle(marker);

  const x = Map2Range(d.lon, minlon, maxlon, -mapsx / 2, mapsx / 2);
  const y = Map2Range(d.lat, minlat, maxlat, -mapsy / 2, mapsy / 2);
  const span = Math.max(mapsx, mapsy);
  const desiredDist = Math.max(span * 0.25, 1.6);
  animateCameraTo(x, y, desiredDist, 600);

  renderPanel(d);
}

function renderPanel(d) {
  panel.innerHTML = "";
  panel.style.display = "block";

  const closeBtn = document.createElement("div");
  closeBtn.textContent = "✕";
  Object.assign(closeBtn.style, {
    position: "absolute",
    right: "10px",
    top: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#666",
    fontSize: "16px",
    userSelect: "none",
  });
  closeBtn.onclick = () => (panel.style.display = "none");
  panel.appendChild(closeBtn);

  const info = document.createElement("div");
  info.innerHTML =
    '<b style="font-size:15px">' +
    escapeHtml(d.nombre || "Estación") +
    "</b>" +
    '<div style="margin-top:6px;line-height:1.35">' +
    "<div><b>ID:</b> " +
    escapeHtml(d.id || "-") +
    "</div>" +
    "<div><b>Lat/Lon:</b> " +
    (isFinite(d.lat) ? d.lat.toFixed(6) : "-") +
    " / " +
    (isFinite(d.lon) ? d.lon.toFixed(6) : "-") +
    "</div>" +
    "<div><b>Dirección:</b> " +
    escapeHtml((d.calle || "") + " " + (d.numero || "")) +
    "</div>" +
    "<div><b>Código Postal:</b> " +
    escapeHtml(d.codpostal || "") +
    "</div>" +
    "</div>";
  panel.appendChild(info);
}

function escapeHtml(s) {
  return typeof s === "string"
    ? s.replace(
        /[&<>"']/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          }[m])
      )
    : s;
}

function animateCameraTo(targetX, targetY, dist, durationMs) {
  const startPos = camera.position.clone();
  const startTarget = camcontrols.target.clone();
  const endPos = new THREE.Vector3(targetX, targetY, dist);
  const endTarget = new THREE.Vector3(targetX, targetY, 0);
  const startTime = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step() {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    const k = easeInOutCubic(t);
    camera.position.lerpVectors(startPos, endPos, k);
    camcontrols.target.lerpVectors(startTarget, endTarget, k);
    camcontrols.update();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function onSearch() {
  const q = (search.value || "").trim().toLowerCase();
  objetos.forEach((m) => {
    const name = (
      m.userData && m.userData.nombre ? String(m.userData.nombre) : ""
    ).toLowerCase();
    const match = q === "" ? true : name.indexOf(q) !== -1;
    m.visible = match;
    if (m.userData && m.userData._selected) applySelectedStyle(m);
    else applyDefaultStyle(m);
  });
}

function animate() {
  requestAnimationFrame(animate);
  camcontrols.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
