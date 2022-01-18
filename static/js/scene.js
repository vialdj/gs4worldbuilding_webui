// Main File. All shader and effects are from stemkowski. 

//TODO:

// Rotation? Physically accurate would be ludicrously fast so perhaps slow it down for show purposes.
// Add showier 3D effects.
// Add more stuff: Rings, asteroids? Perhaps a few famous comets?
// Loading manager.

//Define Geometry
var ZOOM_SCALE_FACTOR = 1200;
const SUN_MASS = 1.989e30;
const PLANET_SCALE = 10000;
const GRAV_CONSTANT = 6.674E-11;
const SECONDS_IN_YEAR = 3.15576e7;
const SUN_SIZE = 695;

const TRANSPARENT_SPHERE_SIZE = 5;
const TRANSPARENT_SPHERE_NAME = "TransparentSphere";
//var ZOOM_SCALE_FACTOR = 1200;

var scene, camera, controls, renderer; // The basics
var camera_position = new THREE.Vector3(0,0,0); // Define where the camera is pointing at.
var lights = [];

var manager = new THREE.LoadingManager();

document.getElementById("loadbar").innerHTML="<b> Loading: </b> 0%";

manager.onProgress = function(item,loaded,total){
    document.getElementById("loadbar").innerHTML="<b> Loading: </b>" + (loaded/total*100).toFixed(2)+"%";
};

manager.onLoad= function(){
    document.getElementById("loadbar").innerHTML="";
};

var planet_objs, sun_group, orbit_outlines; // 3D objects and groups. Hierarchy is (in descending order of importance) orbit_group > planet_group. Sun and skybox group are special exceptions.
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
  this.PlanetScale = 1;
  this.OrbitScale = 0.02;
  this.CameraFocus = 'Sun';
  this.Render_Updated_Scaling = function(){UpdateScene();};
  this.sun_effect_speed = 0.01;
  this.sun_effect_noise = 0.5337;
};

init();
animate();


 // Kilograms
//var SCALING_TIME = 10.0;

// Encapsulates all physical properties of the celestial body. Also handles rendering.
function Planet(planet_obj, render_group) {
    Object.assign(this, planet_obj)

    //This is for ES5 compatability in safari. Would prefer to use default parameters as ES6 defines it but Chrome/Firefox have basic support currently.
    if (this.parent_mass === undefined) {
        this.parent_mass = SUN_MASS;
    }

    this.parent_group = render_group;
    this.bump = 'static/textures/' + this.texture + '/surface_bump.jpg';
    this.spec = 'static/textures/' + this.texture + '/surface_spec.jpg';
    this.norm = 'static/textures/' + this.texture + '/surface_norm.jpg';
    this.texture = 'static/textures/' + this.texture + '/surface_diff.jpg';

    //Create 3D Object to be rendered, and add it to the THREE Object3d group.
    this.parent_group.add(CreateSphere(this, this.size, 50, this.name));
    //  planet_obj.parent_group.add(CreateTransparentSphere(TRANSPARENT_SPHERE_SIZE,50,TRANSPARENT_SPHERE_NAME));
    this.parent_group.add(CreateSpriteText(this.name,'#ffffff', this.name + "_text", this.size));

    this.semimajor_axis_scene = function() { return (this.semimajor_axis / PLANET_SCALE); };

    // This calls out to the main physics module and calculates the movement in the scene.
    this.eccentric_anomaly = function(){ return(KeplerSolve(this.eccentricity, CalculateMT(CalculateN(this.semimajor_axis, this.parent_mass)))); };
    this.true_anomaly = function(){ return(CalculateTrueAnamoly(this.eccentric_anomaly(), this.eccentricity, true) + this.epoch_mean_anomaly); };
};

function init(){

    stats_fps.showPanel(0);

    //Setup Renderer!
    renderer = new THREE.WebGLRenderer({antialias: false, logarithmicDepthBuffer: false, alpha:true}); // Logarithmic depth buffer set to true causes severe shader artifacts.
    renderer.setSize(window.innerWidth, window.innerHeight);
    //  renderer.autoClear = false;
    //Setup camera and mouse controls.
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight,10,3e8);
    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 0;
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 0.5;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.enablePan = false;
    controls.minDistance = 2000;
    controls.maxDistance = 0.8e8;
    controls.addEventListener( 'change', render );

    //Setup GUI
    datGUI = new dat.GUI();
    var OrbitalFolder = datGUI.addFolder("Orbital Parameters");
    OrbitalFolder.add(options,'OrbitSpeedMultiplier',0.0,20000000.0);
    OrbitalFolder.add(options,'PlanetScale',1,30);
    var ShowOutlines = OrbitalFolder.add(options,'ShowOrbitOutline');
    var HighlightPlanets = OrbitalFolder.add(options,'HighlightPlanets');
    var EffectsFolder = datGUI.addFolder("3D Options");
    var RenderOptionsFolder = EffectsFolder.addFolder("Renderer Options");
    var AntiAliasing = RenderOptionsFolder.add(options,'AntiAliasing');
    RenderOptionsFolder.add(options,'Alpha');

    ShowOutlines.onChange(function(value) {
        orbit_outlines.visible = value;
    });

    HighlightPlanets.onChange(function(value) {
        if (value == true) {
            ZOOM_SCALE_FACTOR = 1200;
        } else {
            ZOOM_SCALE_FACTOR = 2e5;
        }
    });

    //Add our 3D scene to the html web page!
    document.getElementById('system-map').appendChild(renderer.domElement);
    document.getElementById('system-map').appendChild(stats_fps.dom);

    //Setup lights...
    scene = new THREE.Scene();
    lights[ 0 ] = new THREE.AmbientLight(0xffffff,0.1);
    lights[ 1 ] = new THREE.PointLight( 0xffffff,2,1000000,2);
    lights[ 1 ].position.set = (0,0,0); // Center of the sun.
    scene.add(lights[ 0 ]);
    scene.add(lights[ 1 ]);

    //Setup planet objects...
    sun_group = new THREE.Object3D();
    orbit_outlines = new THREE.Object3D();

    scene.add(sun_group);
    sun_group.add(orbit_outlines);

    planet_objs = []
    for (var i = 0, size = planets.length; i < size ; i++) {
        var planet_group = new THREE.Object3D();
        var planet_obj = new Planet(planets[i], planet_group)
        planet_objs.push(planet_obj)
        if (planets[i].satellites) {
            var planet_orbit_outlines = new THREE.Object3D();
            for (var j = 0, size = planets[i].satellites.length; j < size ; j++) {
                var satellite_group = new THREE.Object3D();
                var satellite_obj = new Planet(planets[i].satellites[j], satellite_group, planet_obj)
                planet_objs.push(satellite_obj)
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

    Camera_Focus = datGUI.add(options,'CameraFocus', planet_objs.map(function(planet_obj) { return (planet_obj.name); }));

    // Add the sun.
    sun_group.add(star_mesh());

    window.addEventListener('resize',onWindowResize,false);
    render();
    document.getElementById("loadbar").innerHTML="";
};

function CreateSphere(obj, radius, polygon_count, name, basic) {
    var texture_loader = new THREE.TextureLoader(manager);
    var geometry = new THREE.SphereGeometry(radius, polygon_count, polygon_count);
    if (basic == true) {
        var material = new THREE.MeshBasicMaterial({map: texture_loader.load(obj)});
    } else {
        // Surface material
        var material = new THREE.MeshPhongMaterial();
        material.map = texture_loader.load(obj.texture);
        material.bumpMap = texture_loader.load(obj.bump);
        material.specularMap = texture_loader.load(obj.spec);
        material.normalMap = texture_loader.load(obj.norm);
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
    var linematerial = new THREE.LineBasicMaterial({color: 0x7c7c7c});
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

function CreateSpriteText(text,colour,name,offset){
    var SpriteText = new THREE_Text.SpriteText2D(text, { align: THREE_Text.textAlign.center, font: '30px Arial', fillStyle: colour, antialias: true });
    SpriteText.position.set(0,offset+10,0);
    SpriteText.name = name;
    return(SpriteText);
}

// Pretty sure Three.Vector3 makes this redundant. Has a deltaV measurement I am pretty sure.
function CalculateDistanceFromObject(camera_x,camera_y,camera_z,object_x,object_y,object_z){
    var delta_x = Math.abs((camera_x - object_x));
    var delta_y = Math.abs((camera_y - object_y));
    var delta_z = Math.abs((camera_z - object_z));
    var distance = Math.sqrt(Math.pow(delta_x,2)+Math.pow(delta_y,2)+Math.pow(delta_z,2));
    return(distance);
};

function ScaleOverlaySpheres(sphere_name,object_group,distance_from_group,scale_constant){
    var distance_from_planet = 0.0;
    var distance_from_planet = CalculateDistanceFromObject(camera.position.x,camera.position.y,
        camera.position.z,distance_from_group.position.x,distance_from_group.position.y,
        distance_from_group.position.z);
    object_group.getObjectByName(sphere_name,true).scale.x = (distance_from_planet)/scale_constant;
    object_group.getObjectByName(sphere_name,true).scale.y = (distance_from_planet)/scale_constant;
    object_group.getObjectByName(sphere_name,true).scale.z = (distance_from_planet)/scale_constant;
};

function ScalePlanet(planet, scale_constant){
    planet.parent_group.getObjectByName(planet.name, true).scale.x = scale_constant;
    planet.parent_group.getObjectByName(planet.name, true).scale.y = scale_constant;
    planet.parent_group.getObjectByName(planet.name, true).scale.z = scale_constant;
};

// Sets camera target point.
function UpdateCameraLocation(){
    var filtered = planet_objs.filter(function (planet_obj) { return (planet_obj.name == options.CameraFocus); })
    if (filtered[0]) {
        var parent_group = filtered[0].parent_group;
        camera_position.x = parent_group.position.x;
        camera_position.y = parent_group.position.y;
        camera_position.z = parent_group.position.z;
        controls.minDistance = 200;
    } else {
        camera_position.x = 0;
        camera_position.y = 0;
        camera_position.z = 0;
        controls.minDistance = 2000;
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
    render();
};

function animate() {
    render();
    //Keep camera pointed at target.
    controls.target= camera_position;
    stats_fps.update();
    update();
    requestAnimationFrame(animate);
};

function render() {
    renderer.render( scene, camera );
};

// This encapsulates the majority of the physics and animations. Helpful to profile performance in chrome dev tools.
function update(){
    controls.update();
    controls.target= camera_position;
    UpdateCameraLocation();
    //Set Scaling Time from GUI
    SCALING_TIME = options.OrbitSpeedMultiplier;
    //Calculate orbits!

    for (var i = 0, size = planet_objs.length; i < size ; i++) {
        AdjustPlanetLocation(planet_objs[i])
        ScalePlanet(planet_objs[i], options.PlanetScale)
        //ScaleOverlaySpheres('Pluto_text', pluto_group, pluto_group, ZOOM_SCALE_FACTOR);
    }
    // Give sun a bit of rotation per frame.
};
