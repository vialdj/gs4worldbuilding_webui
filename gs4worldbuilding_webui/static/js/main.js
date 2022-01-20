// Main File. All shader and effects are from stemkowski. 

//TODO:

// Rotation? Physically accurate would be ludicrously fast so perhaps slow it down for show purposes.
// Add showier 3D effects.
// Add more stuff: Rings, asteroids? Perhaps a few famous comets?
// Loading manager.

import { star_mesh } from './modules/star.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SpriteText2D, textAlign } from 'https://cdn.skypack.dev/three-text2d'
import { CalculateTrueAnomaly, CalculateMT, KeplerSolve } from './modules/physics/Kepler.js';
import * as THREE from 'https://cdn.skypack.dev/three@0.122.0';

//Define Geometry
var ZOOM_SCALE_FACTOR = 200000;
const TRANSPARENT_SPHERE_SIZE = 5;
const TRANSPARENT_SPHERE_NAME = "TransparentSphere";

let composer, clock, camera, renderer;
var controls;
var camera_position = new THREE.Vector3(0,0,0); // Define where the camera is pointing at.
var manager = new THREE.LoadingManager();

var sceneObjs, star_group, orbit_outlines; // 3D objects and groups. Hierarchy is (in descending order of importance) orbit_group > planet_group. Sun and skybox group are special exceptions.
// ^^^^^^^^^^ I must do this in a generic way but ugh re-architecting, hindsight how blessed art thou 
// Setup FPS/Render Time/Memory usage monitor

var stats_fps = new Stats();

// Setup the GUI Options
var datGUI;
var options = new function(){
  this.OrbitSpeedMultiplier= 1.0;
  this.ShowOrbitOutline = true;
  this.HighlightPlanets = true;
  this.AntiAliasing = false;
  this.Alpha = false;
  this.OrbitScale = 0.02;
  this.CameraFocus = 'Sun';
  this.Render_Updated_Scaling = function(){UpdateScene();};
  this.sun_effect_speed = 0.01;
  this.sun_effect_noise = 0.5337;
};

init();
animate();

 // Kilograms

// Encapsulates all physical properties of the celestial body. Also handles rendering.
function Planet(planet_obj, render_group) {
    Object.assign(this, planet_obj)

    //This is for ES5 compatability in safari. Would prefer to use default parameters as ES6 defines it but Chrome/Firefox have basic support currently.
    this.parent_group = render_group;

    //Create 3D Object to be rendered, and add it to the THREE Object3d group.
    this.color = new THREE.Color();
    this.color.setHSL( Math.random(), 0.7, 0.5);
    this.parent_group.add(CreateSphere(this, this.size, 50, this.name));
    //  planet_obj.parent_group.add(CreateTransparentSphere(TRANSPARENT_SPHERE_SIZE,50,TRANSPARENT_SPHERE_NAME));
    // this.parent_group.add(CreateSpriteText(this.name,'#ffffff', this.name + "_text", this.size));

    this.semimajor_axis_scene = function() { return (this.semimajor_axis); };

    // This calls out to the main physics module and calculates the movement in the scene.
    this.eccentric_anomaly = function(){ return (KeplerSolve(this.eccentricity, CalculateMT(this.period, clock))); };
    this.true_anomaly = function(){ return(CalculateTrueAnomaly(this.eccentric_anomaly(), this.eccentricity, true) + this.epoch_mean_anomaly); };
};

function init(){

    stats_fps.showPanel(0);

    clock = new THREE.Clock();
    //Setup Renderer!
    renderer = new THREE.WebGLRenderer({ antialias: false }); // Logarithmic depth buffer set to true causes severe shader artifacts.
    renderer.setSize(window.innerWidth, window.innerHeight);
    //  renderer.autoClear = false;
    //Setup camera and mouse controls.
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight,10,3e8);
    camera.position.set(0, 0, 0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 0.5;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.enablePan = false;
    controls.minDistance = 100;
    controls.maxDistance = 0.8e8;

    const scene = new THREE.Scene();
    const renderScene = new RenderPass( scene, camera );
    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 3, 1, 1 );
    composer = new EffectComposer( renderer );
	composer.addPass( renderScene );
	composer.addPass( bloomPass );

    //Setup GUI
    datGUI = new dat.GUI();
    var OrbitalFolder = datGUI.addFolder("Orbital Parameters");
    OrbitalFolder.add(options,'OrbitSpeedMultiplier',0.0,20000000.0);
    var ShowOutlines = OrbitalFolder.add(options,'ShowOrbitOutline');
    var HighlightPlanets = OrbitalFolder.add(options,'HighlightPlanets');
    var EffectsFolder = datGUI.addFolder("3D Options");
    var RenderOptionsFolder = EffectsFolder.addFolder("Renderer Options");
    var AntiAliasing = RenderOptionsFolder.add(options,'AntiAliasing');
    RenderOptionsFolder.add(options,'Alpha');

    ShowOutlines.onChange(function(value) {
        orbit_outlines.visible = value;
    });

    //Add our 3D scene to the html web page!
    document.getElementById('system-map').appendChild(renderer.domElement);
    document.getElementById('system-map').appendChild(stats_fps.dom);

    scene.add(new THREE.AmbientLight(0xffffff,0.1));

    //Setup planet objects...
    star_group = new THREE.Object3D();
    orbit_outlines = new THREE.Object3D();

    scene.add(star_group);
    star_group.add(orbit_outlines);

    sceneObjs = []
    for (var i = 1, size = objects.length; i < size ; i++) {
        var planet_group = new THREE.Object3D();
        var planet_obj = new Planet(objects[i], planet_group)
        sceneObjs.push(planet_obj)
        if (objects[i].satellites) {
            var planet_orbit_outlines = new THREE.Object3D();
            for (var j = 0, size = objects[i].satellites.length; j < size ; j++) {
                var satellite_group = new THREE.Object3D();
                var satellite_obj = new Planet(objects[i].satellites[j], satellite_group, planet_obj)
                sceneObjs.push(satellite_obj)
                planet_orbit_outlines.add(CreateOrbitalLine(satellite_obj));
                planet_group.add(satellite_group);
            }
            planet_group.add(planet_orbit_outlines);
        }
        orbit_outlines.add(CreateOrbitalLine(planet_obj))
        var group_orbit = new THREE.Object3D();
        group_orbit.add(planet_group)
        scene.add(planet_group)
    }

    var Camera_Focus = datGUI.add(options,'CameraFocus', sceneObjs.map(function(planet_obj) { return (planet_obj.name); }));

    // Add the sun.
    let star = star_mesh(objects[0])
    let pointLight = new THREE.PointLight(star.color);
    pointLight.position.set = (0, 0, 0); // Center of the sun.
    star_group.add(star);
    scene.add(pointLight);

    window.addEventListener('resize',onWindowResize,false);
    composer.render()
};

function CreateSphere(obj, radius, polygon_count, name, basic) {
    var texture_loader = new THREE.TextureLoader(manager);
    var geometry = new THREE.SphereGeometry(radius, polygon_count, polygon_count);
    if (basic == true) {
        var material = new THREE.MeshBasicMaterial({map: texture_loader.load(obj)});
    } else {
        const material = new THREE.MeshBasicMaterial( { color: obj.color } );
        var mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        return(mesh);
    }
    var mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return(mesh);
};

// Creates the orbital outlines on the scene.
function CreateOrbitalLine(planet) {
    var linematerial = new THREE.LineDashedMaterial({color: planet.color});
    var linegeometry = new THREE.Geometry();

    for (var i = 0; i < ((2 * Math.PI) + 0.02); (i = i + 0.01)) {
        var R = planet.semimajor_axis_scene() * (1 - Math.pow(planet.eccentricity, 2)) / (1 + (planet.eccentricity * Math.cos(i + planet.periapsis_arg)));
        var y = R * Math.sin(i + planet.periapsis_arg) * Math.sin(planet.inclination);
        var x = R * (Math.cos(planet.ascending_lon) * Math.cos(i + planet.periapsis_arg) - Math.sin(planet.ascending_lon) * Math.sin(i + planet.periapsis_arg)) * Math.cos(planet.inclination);
        var z = R * (Math.sin(planet.ascending_lon) * Math.cos(i + planet.periapsis_arg) + Math.cos(planet.ascending_lon) * Math.sin(i + planet.periapsis_arg)) * Math.cos(planet.inclination);
        linegeometry.vertices.push(new THREE.Vector3(x, y, z));
    }
    var orbitline = new THREE.Line(linegeometry, linematerial);
    return(orbitline);
};

function CreateTransparentSphere(radius,polygon_count,name){
    var sphere_geometry = new THREE.SphereGeometry(radius,polygon_count,polygon_count);
    var sphere_material = new THREE.MeshBasicMaterial({transparent: true, opacity: 0.05, color: 0xffffff})
    var sphere_mesh = new THREE.Mesh(sphere_geometry,sphere_material);
    sphere_mesh.name = name;
    return(sphere_mesh);
};

//function CreateSpriteText(text,colour,name,offset){
//    var SpriteText = new SpriteText2D(text, { align: textAlign.center, font: '30px Arial', fillStyle: colour, antialias: true });
//    SpriteText.position.set(0,offset+10,0);
//    SpriteText.name = name;
//    return(SpriteText);
//}

// Pretty sure Three.Vector3 makes this redundant. Has a deltaV measurement I am pretty sure.
function CalculateDistanceFromObject(camera_x,camera_y,camera_z,object_x,object_y,object_z){
    var delta_x = Math.abs((camera_x - object_x));
    var delta_y = Math.abs((camera_y - object_y));
    var delta_z = Math.abs((camera_z - object_z));
    var distance = Math.sqrt(Math.pow(delta_x,2)+Math.pow(delta_y,2)+Math.pow(delta_z,2));
    return(distance);
};

function ScaleOverlaySpheres(sphere_name,object_group,distance_from_group){
    var distance_from_planet = 0.0;
    var distance_from_planet = CalculateDistanceFromObject(camera.position.x,camera.position.y,
        camera.position.z,distance_from_group.position.x,distance_from_group.position.y,
        distance_from_group.position.z);
    object_group.getObjectByName(sphere_name,true).scale.x = (distance_from_planet);
    object_group.getObjectByName(sphere_name,true).scale.y = (distance_from_planet);
    object_group.getObjectByName(sphere_name,true).scale.z = (distance_from_planet);
};

// Sets camera target point.
function UpdateCameraLocation(){
    var filtered = sceneObjs.filter(function (planet_obj) { return (planet_obj.name == options.CameraFocus); })
    if (filtered[0]) {
        var parent_group = filtered[0].parent_group;
        camera_position.x = parent_group.position.x;
        camera_position.y = parent_group.position.y;
        camera_position.z = parent_group.position.z;
    } else {
        camera_position.x = 0;
        camera_position.y = 0;
        camera_position.z = 0;
    }
}

// Where the magic happens: Takes a 3D planet_group in and planet physics object, and adjusts the position in the scene.
// Uses eulers angles and astrodynamics to compute keplerian elements to cartesian co-ordinates. Google was very helpful with getting head round some of the maths.
function AdjustPlanetLocation(planet) {
    var R = planet.semimajor_axis_scene() * (1 - Math.pow(planet.eccentricity, 2)) / (1 + (planet.eccentricity * Math.cos(planet.true_anomaly() + planet.periapsis_arg)));
    planet.parent_group.position.y = R * Math.sin(planet.inclination) * Math.sin(planet.true_anomaly() + planet.periapsis_arg);
    planet.parent_group.position.x = R * (Math.cos(planet.ascending_lon) * Math.cos(planet.true_anomaly() + planet.periapsis_arg) - Math.sin(planet.ascending_lon) * Math.sin(planet.true_anomaly() + planet.periapsis_arg)) * Math.cos(planet.inclination);
    planet.parent_group.position.z = R * (Math.sin(planet.ascending_lon) * Math.cos(planet.true_anomaly() + planet.periapsis_arg) + Math.cos(planet.ascending_lon) * Math.sin(planet.true_anomaly() + planet.periapsis_arg)) * Math.cos(planet.inclination);
};

function onWindowResize() {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
};

function animate() {
    //Keep camera pointed at target.
    controls.target= camera_position;
    stats_fps.update();
    update();
    requestAnimationFrame(animate);
    composer.render();
};

// This encapsulates the majority of the physics and animations. Helpful to profile performance in chrome dev tools.
function update(){
    controls.update();
    controls.target= camera_position;
    UpdateCameraLocation();
    //Calculate orbits!

    for (var i = 0, size = sceneObjs.length; i < size ; i++) {
        AdjustPlanetLocation(sceneObjs[i])
        //ScaleOverlaySpheres('Pluto_text', pluto_group, pluto_group, ZOOM_SCALE_FACTOR);
    }
    // Give sun a bit of rotation per frame.
};
