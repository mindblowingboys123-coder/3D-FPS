import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x101010 );
    scene.fog = new THREE.FogExp2( 0x101010, 0.05 );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.y = 1.6; // Player height

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    controls = new PointerLockControls( camera, document.body );

    const instructions = document.getElementById( 'instructions' );
    instructions.addEventListener( 'click', () => {
        controls.lock();
    });

    controls.addEventListener( 'lock', () => {
        instructions.style.display = 'none';
    });

    controls.addEventListener( 'unlock', () => {
        instructions.style.display = '';
    });

    scene.add( controls.getObject() );

    // Lighting
    const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 2.5 );
    light.position.set( 0.5, 1, 0.75 );
    scene.add( light );

    // Floor
    const floorGeometry = new THREE.PlaneGeometry( 200, 200, 50, 50 );
    floorGeometry.rotateX( - Math.PI / 2 );
    const floorMaterial = new THREE.MeshBasicMaterial( { color: 0x444444, wireframe: true } );
    const floor = new THREE.Mesh( floorGeometry, floorMaterial );
    scene.add( floor );

    // Add some target boxes to shoot at
    const boxGeometry = new THREE.BoxGeometry( 2, 2, 2 );
    for ( let i = 0; i < 20; i++ ) {
        const boxMaterial = new THREE.MeshBasicMaterial( { color: Math.random() * 0xffffff } );
        const box = new THREE.Mesh( boxGeometry, boxMaterial );
        box.position.x = ( Math.random() - 0.5 ) * 80;
        box.position.y = 1;
        box.position.z = ( Math.random() - 0.5 ) * 80;
        scene.add( box );
    }

    // Keyboard Listeners
    window.addEventListener( 'keydown', (e) => handleKeys(e, true) );
    window.addEventListener( 'keyup', (e) => handleKeys(e, false) );
    window.addEventListener( 'click', shoot );
    window.addEventListener( 'resize', onWindowResize );
}

function handleKeys(event, isDown) {
    switch ( event.code ) {
        case 'KeyW': moveForward = isDown; break;
        case 'KeyS': moveBackward = isDown; break;
        case 'KeyA': moveLeft = isDown; break;
        case 'KeyD': moveRight = isDown; break;
    }
}

function shoot() {
    if ( !controls.isLocked ) return;
    
    // Simple Raycaster for shooting
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2( 0, 0 ); // Center of screen
    raycaster.setFromCamera( pointer, camera );
    
    const intersects = raycaster.intersectObjects( scene.children );
    if ( intersects.length > 0 ) {
        const hitObject = intersects[ 0 ].object;
        if ( hitObject.geometry.type === 'BoxGeometry' ) {
            // Change color or remove target when hit
            hitObject.material.color.set( 0xff0000 );
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame( animate );

    const time = performance.now();
    if ( controls.isLocked ) {
        const delta = ( time - prevTime ) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number( moveForward ) - Number( moveBackward );
        direction.x = Number( moveRight ) - Number( moveLeft );
        direction.normalize();

        if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
        if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight( - velocity.x * delta );
        controls.moveForward( - velocity.z * delta );
    }

    prevTime = time;
    renderer.render( scene, camera );
}
