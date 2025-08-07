// main.js

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let nodesGroup, linesGroup, hub;
const allNodes = new Map();
let keyboard = {};
let isCameraLocked = true;

const moveSpeed = 100;
const lookSpeed = 0.005;
const clock = new THREE.Clock();

const urlInput = document.getElementById('url-input');
const goBtn = document.getElementById('go-btn');
const hudContent = document.getElementById('hud-content');
const hideHudBtn = document.getElementById('hide-hud-btn');
const cameraLockBtn = document.getElementById('camera-lock-btn');
const helpLink = document.getElementById('help-link');

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
  scene.fog = new THREE.FogExp2(0x0B1120, 0.005);
  
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 50, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Use OrbitControls for a good user experience, it's easier than manual camera controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enabled = isCameraLocked;
  
  nodesGroup = new THREE.Group();
  linesGroup = new THREE.Group();
  scene.add(nodesGroup, linesGroup);

  const hubGeo = new THREE.SphereGeometry(12, 16, 16);
  const hubMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
  hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(0, 0, 0);
  hub.userData = { url: "", depth: 0, children: [], childrenVisible: true, isRoot: true };
  scene.add(hub);
  allNodes.set("", hub);

  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("click", onClick, false);
  
  goBtn.addEventListener("click", onGoClick);
  hideHudBtn.addEventListener("click", onHideHudClick);
  cameraLockBtn.addEventListener("click", onCameraLockClick);
  helpLink.addEventListener("click", onHelpClick);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onCameraLockClick() {
  isCameraLocked = !isCameraLocked;
  controls.enabled = isCameraLocked;
  cameraLockBtn.textContent = isCameraLocked ? "Unlock Camera" : "Lock Camera";
}

function onHelpClick(event) {
  event.preventDefault();
  alert("Click a node to crawl to its links. Use the mouse to rotate and zoom. Toggle 'Unlock Camera' to move freely with WASD keys.");
}

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(nodesGroup.children.concat([hub]));
  if (!hits.length) return;

  const obj = hits[0].object;
  const url = obj.userData.url || "";
  const nextDepth = (obj.userData.depth || 0) + 1;
  const pos = obj.position.clone();

  if (url) {
    urlInput.value = url;
    fetchLinks(url, pos, nextDepth);
  }
}

async function fetchLinks(url, parentPosition, depth = 1) {
  try {
    console.log('[fetchLinks] Fetching:', `/api/grubber?url=${encodeURIComponent(url)}`);
    const res = await fetch(`/api/grubber?url=${encodeURIComponent(url)}`);

    if (!res.ok) {
      throw new Error('API error: ' + res.status);
    }

    const { links } = await res.json();
    console.log('[fetchLinks] Links received:', links);
    createNodes(links, url, parentPosition, depth);
  } catch (err) {
    console.error('[fetchLinks] Error:', err);
    alert('Failed to fetch links: ' + err.message);
  }
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

  const parentNode = allNodes.get(parentUrl);
  if (parentNode && !parentNode.userData.childrenVisible) {
      parentNode.userData.childrenVisible = true;
      // Re-add children and lines if they were hidden
      parentNode.userData.children.forEach(child => {
        nodesGroup.add(child);
        linesGroup.add(child.userData.line);
      });
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

    if (parentNode) parentNode.userData.children.push(node);
  });
}

function onGoClick() {
  const url = urlInput.value.trim();
  console.log('[Go Clicked] URL input:', url);
  if (!url) {
    alert("Please enter a URL.");
    return;
  }
  
  const existingNode = allNodes.get(url);
  
  if (existingNode) {
      // Logic to toggle visibility of children
      const childrenVisible = existingNode.userData.childrenVisible;
      if (childrenVisible) {
        hideChildren(existingNode);
      } else {
        showChildren(existingNode);
      }
  } else {
      // New URL, fetch and create nodes
      fetchLinks(url, hub.position.clone(), 1);
  }
}

function hideChildren(node) {
  if (!node.userData.children) return;
  node.userData.children.forEach(child => {
    if (nodesGroup.children.includes(child)) {
      nodesGroup.remove(child);
      linesGroup.remove(child.userData.line);
      hideChildren(child);
    }
  });
  node.userData.childrenVisible = false;
}

function showChildren(node) {
  if (!node.userData.children) return;
  node.userData.children.forEach(child => {
    if (!nodesGroup.children.includes(child)) {
      nodesGroup.add(child);
      linesGroup.add(child.userData.line);
      showChildren(child);
    }
  });
  node.userData.childrenVisible = true;
}

function onHideHudClick() {
  hudContent.classList.toggle('hud-hidden');
  hideHudBtn.textContent = hudContent.classList.contains('hud-hidden') ? 'Show HUD' : 'Hide HUD';
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init();