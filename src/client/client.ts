import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import Stats from 'three/examples/jsm/libs/stats.module'
//import express from 'express'
//import path from 'path'
//import {fileURLToPath} from 'url'
//import MilkyWay from '../img/MilkyWay.jpg';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// // //serve static stuff (CSS fix)
// // const express = require('express');
// // const path = require('path');

// // const app = express();
// // app.use(express.static(__dirname + '\public'));



//Using typescript to style document
const body = document.getElementById('body');
const box = document.getElementById('UrchinHeading');
const titleText = document.getElementById('TitleText');



if(box!=null){
    box.style.backgroundColor = 'black';
}
if(body!=null){
    body.style.backgroundColor = 'black';
}

if(titleText!= null){
    titleText.style.color = 'white';
    titleText.style.alignContent = "200px";
}
const scene = new THREE.Scene()
//scene.add(new THREE.AxesHelper(5))



const light = new THREE.SpotLight();
light.position.set(0, 2, 0)
light.intensity = 2;
scene.add(light);

const MilkyURL = new URL("../img/MilkyWay.jpg", import.meta.url);

const urchinFBXUrl = new URL('../assets/Urchin.fbx', import.meta.url);

const urchinURL = new URL('../assets/Urchin.glb', import.meta.url);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
)
camera.position.z = 2
camera.position.set(0.2, 0.8, 0.9);
//camera.position.set(0,50,100);
//camera.lookAt(scene.position);

const renderer = new THREE.WebGLRenderer()
// Since Three r150, and Blender 3.6, lighting has changed significantly.
//
// renderer.physicallyCorrectLights = true // is now deprecated since Three r150. Use renderer.useLegacyLights = false instead.
//
// If exporting lights from Blender, they are very bright.
// lights exported from blender are 10000 times brighter when used in Threejs
// so, you can counter this by setting renderer.useLegacyLights = false
renderer.useLegacyLights = false // WebGLRenderer.physicallyCorrectLights = true is now WebGLRenderer.useLegacyLights = false
// however, they are now still 100 times brighter in Threejs than in Blender,
// so to try and match the threejs scene shown in video, reduce Spotlight watts in Blender to 10w.
// The scene in blender will be lit very dull. 
// Blender and Threejs use different renderers, they will never match. Just try your best.


renderer.shadowMap.enabled = true
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

//Skybox
const textureLoader = new THREE.TextureLoader();
//scene.background= textureLoader.load(MilkyURL.href);
const cubeTextureLoader = new THREE.CubeTextureLoader();
// scene.background= cubeTextureLoader.load([
//     MilkyURL.href,
//     MilkyURL.href,
//     MilkyURL.href,
//     MilkyURL.href,
//     MilkyURL.href,
//     MilkyURL.href

// ]);

// //This is the implementation:
// var SkyGeo = new THREE.SphereGeometry(10, 25, 25);

// var loader = new THREE.TextureLoader();
// var texture = loader.load(MilkyURL.href);
// var material = new THREE.MeshPhongMaterial({
//     map: texture,
// });

// var sky = new THREE.Mesh(SkyGeo, material);
// sky.material.side = THREE.BackSide;
// scene.add(sky);
// console.log(sky);


//Urhcin FBX
const fbxLoader = new FBXLoader();

fbxLoader.load(
    urchinFBXUrl.href,
    (object) => {
        object.traverse(function (child) {
            if ((child as THREE.Mesh).isMesh) {
                // (child as THREE.Mesh).material = material
                if ((child as THREE.Mesh).material) {
                    ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).transparent = false
                }
            }
        })
        object.scale.set(.05, .05, .05)
        object.name = "Urchin";
        scene.add(object)
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
)


// const assetLoader = new GLTFLoader();
// assetLoader.load(urchinURL.href, function(gltf){
//     const model = gltf.scene;
//     console.log(model);
//     scene.add(model);
//     model.position.set(0, 0, 0);
// }, undefined, function(error){
//     console.error(error);
// });

const al = new THREE.AmbientLight(0xffffff, 2);
scene.add(al);

// const loader = new GLTFLoader()
// loader.load(
//     'E:\Github\Three.js-TypeScript-Tutorial\models\Urchin.glb',
//     function (gltf) {
//         gltf.scene.traverse(function (child) {
//             if ((child as THREE.Mesh).isMesh) {
//                 const m = child as THREE.Mesh
//                 m.receiveShadow = true
//                 m.castShadow = true
//             }
//             if ((child as THREE.Light).isLight) {
//                 const l = child as THREE.SpotLight
//                 l.castShadow = true
//                 l.shadow.bias = -0.003
//                 l.shadow.mapSize.width = 2048
//                 l.shadow.mapSize.height = 2048
//             }
//         })
//         scene.add(gltf.scene)
//     },
//     (xhr) => {
//         console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
//     },
//     (error) => {
//         console.log(error)
//     }
// )

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

//const stats = new Stats()
//document.body.appendChild(stats.dom)

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    render()

    //stats.update()
    var urchinObj = scene.getObjectByName("Urchin");
    if(urchinObj){
    //urchinObj.rotation.x += 0.01;
    urchinObj.rotation.y += 0.001;
    }

    
    //console.log(camera.position);
    //console.log("Booop");
}

function render() {
    renderer.render(scene, camera)
}

animate()
//render();