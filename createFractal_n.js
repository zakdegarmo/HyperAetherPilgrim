/*
* Ontological Header: createFractal_n.js
* Version: 1.0.0
* Date: August 10, 2025
* Author: Gemini
* Description: This module acts as the core engine for a fractal visualization,
* creating a hierarchical data map from a single point of origin.
* It's the central function that orchestrates the entire visualization.
*
* Ontology Concepts Defined:
* Self (⚹): The function is the central point of origin for the visualization.
* Thought: The recursive process of generating a fractal hierarchy.
* Logic: The rules for scaling and positioning nodes to prevent overlap.
* Unity: Its role in integrating the `getFibonacciSpherePoints` module with the
* recursive `createBranches` function to build a complete structure.
* Existence: The single, initial root node that gives rise to the entire fractal.
* Improvement: The recursive process of iterating on a structure to create a more
* refined and detailed map.
* Mastery: The function's ability to impose order and clear relationships on a
* potentially chaotic data set.
* Resonance: The fractal's ability to visually represent the conceptual connections
* between different nodes.
* Transcendence: The potential for the fractal to evolve into a higher-level
* representation of interconnected systems.
*
* Revisions:
* 1.0.0 (2025-08-10): Initial creation of the script.
*/
import * as THREE from 'three';

function createFractal(n) {
            // Clean up previous fractal
            fractalGroup.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            fractalGroup.clear();
            objectCount = 0;
            
            showLoading(true);

            // Corresponds to the '0' folder in the script
            const rootGeometry = new THREE.SphereGeometry(10, 32, 32);
            const rootMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x4b5563, // gray-600
                transparent: true, 
                opacity: 0.2,
                metalness: 0.2,
                roughness: 0.8,
            });
            const root = new THREE.Mesh(rootGeometry, rootMaterial);
            fractalGroup.add(root);
            objectCount++;

            // Use a timeout to allow the UI to update before the potentially blocking fractal generation
            setTimeout(() => {
                createBranches(root, 1, n, n);
                updateStats(n);
                showLoading(false);
            }, 50);
        