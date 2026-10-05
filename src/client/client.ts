import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { createShellInteractions } from './shell-interactions';

// Recovered from commit 1768aa7 and reconciled with the deployed r157 bundle.
const settings = {
    camera: {
        fieldOfView: 75,
        near: 0.1,
        far: 10_000_000,
        position: new THREE.Vector3(-1, 0.6, 1.2),
    },
    lighting: {
        targetIntensity: 2,
        fadePerFrame: 0.001,
    },
    model: {
        url: new URL('../../b4b5396601f3dd397682.fbx', import.meta.url),
        scale: 0.05,
        rotationPerFrame: 0.001,
    },
};

const worlds = [
    {
        name: 'Milky Way',
        radius: 10_000_000,
        texture: new URL('../../7a5ad68f1a9349a4605b.jpg', import.meta.url),
    },
    {
        name: 'Inner world',
        radius: 10,
        texture: new URL('../../380b6ece336672a1f8f4.jpg', import.meta.url),
    },
    {
        name: 'Outer world',
        radius: 10_000,
        texture: new URL('../../2c04fc5017458fdf96a0.png', import.meta.url),
    },
    {
        name: 'Middle world',
        radius: 1_000,
        texture: new URL('../../f3054be440efc1d9e27d.jpg', import.meta.url),
    },
    {
        name: 'Near world',
        radius: 100,
        texture: new URL('../../7ce9f15429d3ecee33b2.jpg', import.meta.url),
        specular: 0x050505,
        shininess: 10,
    },
];

const scene = new THREE.Scene();
const spotlight = new THREE.SpotLight();
spotlight.position.set(0, 2, 0);
spotlight.intensity = 0;
scene.add(spotlight);

const camera = new THREE.PerspectiveCamera(
    settings.camera.fieldOfView,
    window.innerWidth / window.innerHeight,
    settings.camera.near,
    settings.camera.far,
);
camera.position.copy(settings.camera.position);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.className = 'urchin-canvas';
renderer.useLegacyLights = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
const startingDistance = camera.position.distanceTo(controls.target);
controls.minDistance = startingDistance;
const interactions = createShellInteractions({ camera, controls, canvas: renderer.domElement, startingDistance });

const textureLoader = new THREE.TextureLoader();
for (const world of worlds) {
    const geometry = new THREE.SphereGeometry(world.radius, 25, 25);
    const material = new THREE.MeshPhongMaterial({
        map: textureLoader.load(world.texture.href),
        side: THREE.BackSide,
        specular: world.specular ?? 0x111111,
        shininess: world.shininess ?? 30,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = world.name;
    scene.add(sphere);
}

let urchin: THREE.Group | undefined;
const fbxLoader = new FBXLoader();
fbxLoader.load(
    settings.model.url.href,
    (object) => {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
                child.material.transparent = false;
            }
        });
        object.scale.setScalar(settings.model.scale);
        object.name = 'Urchin';
        scene.add(object);
        urchin = object;
        interactions.attachModel(object);
    },
    undefined,
    (error) => console.error('Unable to load the Urchin model:', error),
);

const ambientLight = new THREE.AmbientLight(0xffffff, 0);
scene.add(ambientLight);

function render() {
    interactions.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
});

// Preserve the deployed frame-based fade and rotation during source recovery.
let lightingComplete = false;
function animate() {
    requestAnimationFrame(animate);
    if (!interactions.paused) controls.update();

    if (!lightingComplete) {
        if (spotlight.intensity < settings.lighting.targetIntensity) {
            spotlight.intensity += settings.lighting.fadePerFrame;
            ambientLight.intensity += settings.lighting.fadePerFrame;
        } else {
            lightingComplete = true;
        }
    }

    render();
    if (urchin && !interactions.paused) {
        urchin.rotation.y += settings.model.rotationPerFrame;
    }
}

animate();
