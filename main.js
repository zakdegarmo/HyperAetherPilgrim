// main.js - With Ontological Analyzer Logic

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
let isCameraLocked = true;

const clock = new THREE.Clock();

// --- DOM Elements ---
const urlInput = document.getElementById('url-input');
const goBtn = document.getElementById('go-btn');
const hudContent = document.getElementById('hud-content');
const hideHudBtn = document.getElementById('hide-hud-btn');
const cameraLockBtn = document.getElementById('camera-lock-btn');
const helpLink = document.getElementById('help-link');

// --- NEW ANALYZER DOM ELEMENTS ---
const apiKeyInput = document.getElementById('api-key-input');
const analyzeBtn = document.getElementById('analyze-btn');
const analysisOutput = document.getElementById('analysis-output');

const BASE_RADIUS = 100;
const DEPTH_SCALE = 0.6;
const SHAPE_GEOMETRIES = [
  () => new THREE.SphereGeometry(6, 8, 8),
  () => new THREE.IcosahedronGeometry(6, 0),
  () => new THREE.TetrahedronGeometry(6),
  () => new THREE.BoxGeometry(6, 6, 6),
  () => new THREE.OctahedronGeometry(6),
  () => new THREE.DodecahedronGeometry(6),
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

  // --- Event Listeners ---
  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("click", onClick, false);
  
  goBtn.addEventListener("click", onGoClick);
  hideHudBtn.addEventListener("click", onHideHudClick);
  cameraLockBtn.addEventListener("click", onCameraLockClick);
  helpLink.addEventListener("click", onHelpClick);
  
  // --- NEW ANALYZER EVENT LISTENER ---
  analyzeBtn.addEventListener("click", onAnalyzeClick);

  animate();
}

// --- NEW: Ontological Analyzer Function ---
async function onAnalyzeClick() {
    let targetUrl = urlInput.value.trim(); // Use 'let' to allow modification
    const apiKey = apiKeyInput.value.trim();

    // Automatically add "https://" if it's missing
    if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    if (!targetUrl) {
        analysisOutput.textContent = "Error: Please enter a URL to analyze.";
        return;
    }
    if (!apiKey) {
        analysisOutput.textContent = "Error: Please enter your Gemini API Key.";
        return;
    }

    analysisOutput.textContent = "Analyzing... please wait.";
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Working...";

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl, apiKey }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'The server responded with an error.');
        }

        const data = await response.json();
        analysisOutput.textContent = JSON.stringify(data, null, 2);

    } catch (error) {
        analysisOutput.textContent = `Error: ${error.message}`;
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analyze Page";
    }
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
  
  if (url) {
    urlInput.value = url;
    // We can decide if clicking a node should also trigger a fetch
    fetchLinks(url, obj.position.clone(), (obj.userData.depth || 0) + 1);
  }
}

async function fetchLinks(url, parentPosition, depth = 1) {
  try {
    const res = await fetch(`/api/grubber?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('API error: ' + res.status);
    const { links } = await res.json();
    createNodes(links, url, parentPosition, depth);
  } catch (err) {
    console.error('[fetchLinks] Error:', err);
    alert('Failed to fetch links: ' + err.message);
  }
}

function createNodes(links, parentUrl, parentPosition, depth = 1) {
  const parentNode = allNodes.get(parentUrl);
  if (parentNode && !parentNode.userData.childrenVisible) {
      parentNode.userData.childrenVisible = true;
      parentNode.userData.children.forEach(child => {
        nodesGroup.add(child);
        linesGroup.add(child.userData.line);
      });
  }

  const radius = BASE_RADIUS * Math.pow(DEPTH_SCALE, depth - 1);
  const totalLinks = links.length;
  
  links.forEach((link, i) => {
    if (allNodes.has(link)) return;

    const phi = Math.acos(-1 + (2 * i) / totalLinks);
    const theta = Math.sqrt(totalLinks * Math.PI) * phi;
    
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    
    const position = new THREE.Vector3(x, y, z).add(parentPosition);

    const shapeGeo = getShapeByDepth(depth);
    const mat = new THREE.MeshBasicMaterial({
      color: getColorByDepth(depth),
      wireframe: true
    });
    const node = new THREE.Mesh(shapeGeo, mat);
    node.position.copy(position);
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
      position.x,   position.y,   position.z
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
  let url = urlInput.value.trim(); // Use 'let' to allow modification

  // Automatically add "https://"" if it's missing
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!url) {
    alert("Please enter a URL.");
    return;
  }
  
  const existingNode = allNodes.get(url);
  
  if (existingNode && existingNode !== hub) {
      const childrenVisible = existingNode.userData.childrenVisible;
      if (childrenVisible) {
        hideChildren(existingNode);
      } else {
        showChildren(existingNode);
      }
  } else {
      clearScene();
      hub.userData.url = url;
      fetchLinks(url, hub.position.clone(), 1);
  }
}
function clearScene() {
    nodesGroup.clear();
    linesGroup.clear();
    allNodes.clear();
    allNodes.set("", hub); // Keep the hub
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
      if (child.userData.childrenVisible) { // Only show children if they were previously visible
          showChildren(child);
      }
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
