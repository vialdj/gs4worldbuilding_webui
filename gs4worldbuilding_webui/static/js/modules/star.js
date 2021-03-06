import * as THREE from 'https://cdn.skypack.dev/three@0.122.0';

function star_mesh(star) {
    const colorMap = {
        'A5': 0xf9fcc8,
        'A6': 0xf9fcc8,
        'A7': 0xf9fcc8,
        'A9': 0xf9fcc8,
        'F0': 0xf4fe50,
        'F2': 0xf4fe50,
        'F3': 0xf4fe50,
        'F4': 0xf4fe50,
        'F5': 0xf4fe50,
        'F6': 0xf4fe50,
        'F7': 0xf4fe50,
        'F8': 0xf4fe50,
        'F9': 0xf4fe50,
        'G0': 0xfedb50,
        'G1': 0xfedb50,
        'G2': 0xfedb50,
        'G4': 0xfedb50,
        'G6': 0xfedb50,
        'G8': 0xfedb50,
        'K0': 0xfdc289,
        'K2': 0xfdc289,
        'K4': 0xfdc289,
        'K5': 0xfdc289,
        'K6': 0xfdc289,
        'K8': 0xfdc289,
        'M0': 0xfd9c89,
        'M1': 0xfd9c89,
        'M2': 0xfd9c89,
        'M3': 0xfd9c89,
        'M4': 0xfd9c89,
        'M5': 0xfd9c89,
        'M6': 0xfd9c89,
        'M7': 0xfd9c89,
        'D': 0xffffff,
    }
    return new THREE.Mesh(new THREE.SphereGeometry(star.size,50,50), new THREE.MeshBasicMaterial( {color: colorMap[star.spectral_type]} )); 
}

export { star_mesh };