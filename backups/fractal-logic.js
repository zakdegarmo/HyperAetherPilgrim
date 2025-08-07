// fractal-logic.js

let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let nodesGroup, linesGroup, hub;
const allNodes = new Map();
const tooltip = document.getElementById("tooltip");

const BASE_RADIUS = 100;
const DEPTH_SCALE = 0.6;
const SHAPE_GEOMETRIES = [
  () => new THREE.SphereGeometry(6, 8, 8),
  () => new THREE.IcosahedronGeometry(6, 0),
  () => new THREE.TetrahedronGeometry(6),
  () => new THREE.BoxGeometry(6, 6, 6),
  () => new THREE.OctahedronGeometry(6),
  () => new THREE.DodecahedronGeometry(6),
  () => new THREE.IcosahedronGeometry(6, 1),
  () => new THREE.IcosahedronGeometry(6, 2),
  () => new THREE.IcosahedronGeometry(6, 3),
  () => new THREE.SphereGeometry(6, 12, 12)
];

function getShapeByDepth(depth) {
  const index = depth % SHAPE_GEOMETRIES.length;
  return SHAPE_GEOMETRIES[index]();
}

function getColorByDepth(depth) {
  const hue = (depth * 36) % 360;
  return new THREE.Color(`hsl(${hue}, 100%, 60%)`);
}

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 200, 400);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  nodesGroup = new THREE.Group();
  linesGroup = new THREE.Group();
  scene.add(nodesGroup, linesGroup);

  const hubGeo = new THREE.SphereGeometry(12, 16, 16);
  const hubMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(0, 0, 0);
  hub.userData = { url: "", depth: 0, children: [], childrenVisible: true };
  scene.add(hub);
  allNodes.set("", hub);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("click", onClick);
  window.addEventListener("mousemove", onMouseMove);
  document.getElementById("go").addEventListener("click", onGoClick);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(nodesGroup.children.concat([hub]));
  if (hits.length) {
    const obj = hits[0].object;
    tooltip.style.display = "block";
    tooltip.style.left = event.clientX + 10 + "px";
    tooltip.style.top = event.clientY + 10 + "px";
    tooltip.innerHTML = `Depth: ${obj.userData.depth || 0}<br>URL: ${obj.userData.url || "N/A"}`;
  } else {
    tooltip.style.display = "none";
  }
}

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(nodesGroup.children.concat([hub]));
  if (!hits.length) return;

  const obj = hits[0].object;
  const url = obj.userData.url || "";
  const nextDepth = (obj.userData.depth || 1) + 1;
  const pos = obj.position.clone();

  if (url) {
    document.getElementById("urlInput").value = url;
    fetchLinks(url, pos, nextDepth);
  }
}

function fetchLinks(url, parentPosition, depth = 1) {
  console.log('[fetchLinks] Fetching:', `/api/grubber?url=${encodeURIComponent(url)}`);
  fetch(`/api/grubber?url=${encodeURIComponent(url)}`)
    .then(res => {
      if (!res.ok) {
        throw new Error('API error: ' + res.status);
      }
      return res.json();
    })
    .then(({ links }) => {
      console.log('[fetchLinks] Links received:', links);
      createNodes(links, url, parentPosition, depth);
    })
    .catch(err => {
      console.error('[fetchLinks] Error:', err);
      alert('Failed to fetch links: ' + err.message);
    });
}

function createNodes(links, parentUrl, parentPosition, depth = 1) {
  const parentShape = getShapeByDepth(depth - 1);
  const geometryPoints = parentShape.attributes.position.array;
  const positions = [];

  for (let i = 0; i < links.length; i++) {
    const ix = (i % (geometryPoints.length / 3)) * 3;
    const p = new THREE.Vector3(geometryPoints[ix], geometryPoints[ix + 1], geometryPoints[ix + 2]);
    p.normalize().multiplyScalar(BASE_RADIUS * Math.pow(DEPTH_SCALE, depth - 1)).add(parentPosition);
    positions.push(p);
  }

  links.forEach((link, i) => {
    if (allNodes.has(link)) return;

    const shapeGeo = getShapeByDepth(depth);
    const mat = new THREE.MeshBasicMaterial({
      color: getColorByDepth(depth),
      wireframe: true
    });
    const node = new THREE.Mesh(shapeGeo, mat);
    node.scale.set(0.5, 0.5, 0.5);
    node.position.copy(positions[i]);
    node.userData = {
      url: link,
      parentUrl,
      depth,
      children: [],
      childrenVisible: true,
      line: null
    };

    nodesGroup.add(node);
    allNodes.set(link, node);

    // Use global LineGeometry, LineMaterial, Line2 from three.js examples
    const lg = new LineGeometry();
    lg.setPositions([
      parentPosition.x, parentPosition.y, parentPosition.z,
      positions[i].x,   positions[i].y,   positions[i].z
    ]);

    const lm = new LineMaterial({
      color: 0x4b5563,
      linewidth: 2,
      worldUnits: false
    });
    lm.resolution.set(window.innerWidth, window.innerHeight);

    const line = new Line2(lg, lm);
    linesGroup.add(line);
    node.userData.line = line;

    const parentNode = allNodes.get(parentUrl);
    if (parentNode) parentNode.userData.children.push(node);
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateHUD();
  renderer.render(scene, camera);
}

function updateHUD() {
  const hud = document.getElementById("hud");
  const p = camera.position;
  hud.textContent = `Camera\n x: ${p.x.toFixed(1)}\n y: ${p.y.toFixed(1)}\n z: ${p.z.toFixed(1)}`;
}

function onGoClick() {
  const url = document.getElementById("urlInput").value.trim();
  console.log('[Go Clicked] URL input:', url);
  if (!url) {
    alert("Please enter a URL.");
    return;
  }
  fetchLinks(url, hub.position.clone(), 1);
}

// Patch for Three.js examples: assign controls and lines to THREE namespace if available
if (typeof OrbitControls !== 'undefined') THREE.OrbitControls = OrbitControls;
if (typeof Line2 !== 'undefined') THREE.Line2 = Line2;
if (typeof LineMaterial !== 'undefined') THREE.LineMaterial = LineMaterial;
if (typeof LineGeometry !== 'undefined') THREE.LineGeometry = LineGeometry;

init();