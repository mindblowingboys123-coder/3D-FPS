import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let gameMode = 'story';
let currentLevel = 1;
let credits = Number(localStorage.getItem('fps_credits')) || 100;
let inventory = JSON.parse(localStorage.getItem('fps_inventory')) || { rifle: false, sniper: false, speed: false, shield: false };
let currentWeapon = 'pistol';

let health = 100;
let maxHealth = 100;
let stamina = 100;
let isDead = false;
let isScoped = false;
let isSliding = false;
let slideTimer = 0;

// Movement & Damping
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

let platforms = [];
let enemies = [];
let lights = [];
let raycaster = new THREE.Raycaster();

window.addEventListener('DOMContentLoaded', () => {
    updateUI();
    initEngine();
});

window.showHomeMenu = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('home-menu').classList.remove('hidden');
    updateUI();
};

window.showStoryMenu = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('story-menu').classList.remove('hidden');
};

window.openShop = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('shop-menu').classList.remove('hidden');
    updateUI();
};

window.buyItem = (item, cost) => {
    if (credits >= cost && !inventory[item]) {
        credits -= cost;
        inventory[item] = true;
        localStorage.setItem('fps_credits', credits);
        localStorage.setItem('fps_inventory', JSON.stringify(inventory));
        updateUI();
    }
};

function updateUI() {
    document.getElementById('credits-display').innerText = credits;
    document.getElementById('shop-credits').innerText = credits;
    document.getElementById('hud-credits').innerText = credits;
    
    if (inventory.rifle) document.getElementById('buy-rifle').innerText = 'Owned';
    if (inventory.sniper) document.getElementById('buy-sniper').innerText = 'Owned';
    if (inventory.speed) document.getElementById('buy-speed').innerText = 'Owned';
    if (inventory.shield) document.getElementById('buy-shield').innerText = 'Owned';
}

window.startMode = (mode) => {
    gameMode = mode;
    currentLevel = 1;
    maxHealth = inventory.shield ? 150 : 100;
    health = maxHealth;
    
    if (inventory.sniper) currentWeapon = 'sniper';
    else if (inventory.rifle) currentWeapon = 'rifle';
    else currentWeapon = 'pistol';

    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');

    controls.lock();
    loadLevel(currentLevel);
};

function initEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x050508, 0.025);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);

    controls.addEventListener('unlock', () => {
        if (!isDead) window.showHomeMenu();
    });

    scene.add(controls.getObject());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    animate();
}

// SCENERY & MAP BUILDER
function loadLevel(lvl) {
    // Clear previous objects & lights
    platforms.forEach(p => scene.remove(p));
    enemies.forEach(e => scene.remove(e.mesh));
    lights.forEach(l => scene.remove(l));
    platforms = [];
    enemies = [];
    lights = [];

    controls.getObject().position.set(0, 1.6, 20);
    velocity.set(0, 0, 0);

    // Ambient Lighting
    const ambLight = new THREE.AmbientLight(lvl === 1 ? 0x112233 : 0x331100, 0.6);
    scene.add(ambLight);
    lights.push(ambLight);

    // Main Floor
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: lvl === 1 ? 0x1e222a : 0x181210, 
        roughness: 0.4, 
        metalness: 0.6 
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(80, 2, 80), floorMat);
    floor.position.set(0, -1, 0);
    floor.receiveShadow = true;
    scene.add(floor);
    platforms.push(floor);

    // Enclosing Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.8 });
    const wallGeoN = new THREE.BoxGeometry(80, 20, 2);
    
    const wallN = new THREE.Mesh(wallGeoN, wallMat); wallN.position.set(0, 10, -40);
    const wallS = new THREE.Mesh(wallGeoN, wallMat); wallS.position.set(0, 10, 40);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 80), wallMat); wallE.position.set(40, 10, 0);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 80), wallMat); wallW.position.set(-40, 10, 0);
    
    [wallN, wallS, wallE, wallW].forEach(w => { scene.add(w); platforms.push(w); });

    if (lvl === 1) {
        // MAP 1: RESEARCH LAB
        buildLabEnvironment();
    } else {
        // MAP 2: ELECTRICAL SECTOR
        buildElectricalEnvironment();
    }

    // Spawn Enemies
    const enemyCount = gameMode === 'story' ? 4 + lvl * 3 : 8 + lvl * 5;
    for (let i = 0; i < enemyCount; i++) {
        spawnEnemy();
    }

    document.getElementById('hud-mode').innerText = gameMode.toUpperCase();
    document.getElementById('hud-level').innerText = currentLevel;
    updateEnemyHUD();
}

function buildLabEnvironment() {
    // Central Holographic Core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 12), coreMat);
    core.position.set(0, 8, 0);
    scene.add(core);

    const pointLight = new THREE.PointLight(0x00f0ff, 3, 40);
    pointLight.position.set(0, 8, 0);
    scene.add(pointLight);
    lights.push(pointLight);

    // Lab Terminals & Tables
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x2a303c, metalness: 0.5 });
    for (let x = -25; x <= 25; x += 25) {
        for (let z = -20; z <= 10; z += 30) {
            if (x === 0 && z === 0) continue;
            const desk = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 4), deskMat);
            desk.position.set(x, 1, z);
            desk.castShadow = true;
            desk.receiveShadow = true;
            scene.add(desk);
            platforms.push(desk);
        }
    }
}

function buildElectricalEnvironment() {
    // High Voltage Generators
    const genMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, metalness: 0.8, roughness: 0.2 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

    for (let i = -20; i <= 20; i += 20) {
        const gen = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 16), genMat);
        gen.position.set(i, 6, -15);
        scene.add(gen);
        platforms.push(gen);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.3, 8, 24), glowMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(i, 6, -15);
        scene.add(ring);

        const pLight = new THREE.PointLight(0xff6600, 2, 25);
        pLight.position.set(i, 6, -15);
        scene.add(pLight);
        lights.push(pLight);
    }
}

function spawnEnemy() {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xcc1133, roughness: 0.3 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), armorMat);
    torso.position.y = 1.2;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), armorMat);
    head.position.y = 2.0;
    group.add(head);

    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    visor.position.set(0, 2.0, 0.2);
    group.add(visor);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.0);
    const leftLeg = new THREE.Mesh(legGeo, jointMat);
    leftLeg.position.set(-0.25, 0.5, 0);
    const rightLeg = new THREE.Mesh(legGeo, jointMat);
    rightLeg.position.set(0.25, 0.5, 0);
    group.add(leftLeg, rightLeg);

    group.position.set(
        (Math.random() - 0.5) * 60,
        0,
        (Math.random() - 0.5) * 60 - 10
    );

    scene.add(group);
    enemies.push({ mesh: group, health: 60 + currentLevel * 10 });
}

function updateEnemyHUD() {
    document.getElementById('hud-enemies').innerText = enemies.length;
}

function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': 
            if (canJump) { velocity.y += 10; canJump = false; }
            break;
        case 'KeyC':
        case 'ShiftLeft':
            if (!isSliding && stamina > 30) {
                isSliding = true;
                slideTimer = 0.4;
                stamina -= 30;
                camera.position.y = 0.8;
            }
            break;
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function onMouseDown(e) {
    if (!controls.isLocked) return;
    if (e.button === 0) {
        shoot();
    } else if (e.button === 2) {
        isScoped = true;
        camera.fov = currentWeapon === 'sniper' ? 20 : 45;
        camera.updateProjectionMatrix();
        document.getElementById('crosshair').classList.add('scoped');
        document.getElementById('scope-overlay').style.display = 'block';
    }
}

function onMouseUp(e) {
    if (e.button === 2) {
        isScoped = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        document.getElementById('crosshair').classList.remove('scoped');
        document.getElementById('scope-overlay').style.display = 'none';
    }
}

function shoot() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const enemyMeshes = enemies.map(e => e.mesh);
    const intersects = raycaster.intersectObjects(enemyMeshes, true);

    if (intersects.length > 0) {
        let hitGroup = intersects[0].object;
        while (hitGroup.parent && hitGroup.parent.type === 'Group') {
            hitGroup = hitGroup.parent;
        }

        const enemyObj = enemies.find(e => e.mesh === hitGroup);
        if (enemyObj) {
            const dmg = currentWeapon === 'sniper' ? 100 : (currentWeapon === 'rifle' ? 40 : 25);
            enemyObj.health -= dmg;

            if (enemyObj.health <= 0) {
                scene.remove(enemyObj.mesh);
                enemies = enemies.filter(e => e !== enemyObj);
                credits += 25;
                localStorage.setItem('fps_credits', credits);
                updateUI();
                updateEnemyHUD();

                if (enemies.length === 0) {
                    currentLevel++;
                    if (gameMode === 'story' && currentLevel > 2) {
                        alert('STORY COMPLETED: Outpost Purged Successfully!');
                        controls.unlock();
                    } else {
                        alert(`Level Cleared! Entering Sector ${currentLevel}`);
                        loadLevel(currentLevel);
                    }
                }
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// SMOOTH GAME LOOP
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1); // Cap delta to prevent lag glitches

    if (controls.isLocked) {
        if (stamina < 100) stamina = Math.min(100, stamina + 25 * delta);
        document.getElementById('stamina-fill').style.width = stamina + '%';

        // Smooth Inertia Damping
        velocity.x -= velocity.x * 8.0 * delta;
        velocity.z -= velocity.z * 8.0 * delta;
        velocity.y -= 28.0 * delta; // Smooth gravity

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speedMult = (inventory.speed ? 1.3 : 1.0) * (isSliding ? 2.2 : 1.0);
        if (moveForward || moveBackward) velocity.z -= direction.z * 300.0 * delta * speedMult;
        if (moveLeft || moveRight) velocity.x -= direction.x * 300.0 * delta * speedMult;

        if (isSliding) {
            slideTimer -= delta;
            if (slideTimer <= 0) {
                isSliding = false;
                camera.position.y = 1.6;
            }
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += velocity.y * delta;

        // Hard Floor Bound
        if (controls.getObject().position.y < 1.6) {
            controls.getObject().position.y = 1.6;
            velocity.y = 0;
            canJump = true;
        }

        // Smooth Platform Landing & Standing
        const playerRay = new THREE.Raycaster(
            controls.getObject().position,
            new THREE.Vector3(0, -1, 0),
            0,
            1.8
        );
        const platformHits = playerRay.intersectObjects(platforms);

        if (platformHits.length > 0) {
            const targetY = platformHits[0].point.y + 1.6;
            if (controls.getObject().position.y <= targetY + 0.3) {
                controls.getObject().position.y = targetY;
                velocity.y = Math.max(0, velocity.y);
                canJump = true;
            }
        }

        // Enemy AI Movement
        const playerPos = controls.getObject().position;
        enemies.forEach(e => {
            e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);
            e.mesh.translateZ(2.2 * delta * (1 + currentLevel * 0.1));

            if (e.mesh.position.distanceTo(playerPos) < 1.5) {
                health -= 12 * delta;
                document.getElementById('health-fill').style.width = Math.max(0, (health / maxHealth) * 100) + '%';

                if (health <= 0 && !isDead) {
                    isDead = true;
                    alert('CRITICAL FAILURE: Operative Defeated.');
                    location.reload();
                }
            }
        });
    }

    prevTime = time;
    renderer.render(scene, camera);
}import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let gameMode = 'story';
let currentLevel = 1;
let credits = Number(localStorage.getItem('fps_credits')) || 100;
let inventory = JSON.parse(localStorage.getItem('fps_inventory')) || { rifle: false, sniper: false, speed: false, shield: false };
let currentWeapon = 'pistol';

let health = 100;
let maxHealth = 100;
let stamina = 100;
let isDead = false;
let isScoped = false;
let isSliding = false;
let slideTimer = 0;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

let platforms = [];
let enemies = [];
let raycaster = new THREE.Raycaster();

window.addEventListener('DOMContentLoaded', () => {
    updateUI();
    initEngine();
});

window.showHomeMenu = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('home-menu').classList.remove('hidden');
    updateUI();
};

window.showStoryMenu = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('story-menu').classList.remove('hidden');
};

window.openShop = () => {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('shop-menu').classList.remove('hidden');
    updateUI();
};

window.buyItem = (item, cost) => {
    if (credits >= cost && !inventory[item]) {
        credits -= cost;
        inventory[item] = true;
        localStorage.setItem('fps_credits', credits);
        localStorage.setItem('fps_inventory', JSON.stringify(inventory));
        updateUI();
    }
};

function updateUI() {
    document.getElementById('credits-display').innerText = credits;
    document.getElementById('shop-credits').innerText = credits;
    document.getElementById('hud-credits').innerText = credits;
    
    if (inventory.rifle) document.getElementById('buy-rifle').innerText = 'Owned';
    if (inventory.sniper) document.getElementById('buy-sniper').innerText = 'Owned';
    if (inventory.speed) document.getElementById('buy-speed').innerText = 'Owned';
    if (inventory.shield) document.getElementById('buy-shield').innerText = 'Owned';
}

window.startMode = (mode) => {
    gameMode = mode;
    currentLevel = 1;
    maxHealth = inventory.shield ? 150 : 100;
    health = maxHealth;
    
    if (inventory.sniper) currentWeapon = 'sniper';
    else if (inventory.rifle) currentWeapon = 'rifle';
    else currentWeapon = 'pistol';

    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');

    controls.lock();
    loadLevel(currentLevel);
};

function initEngine() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.FogExp2(0x0a0a12, 0.03);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    controls = new PointerLockControls(camera, document.body);

    controls.addEventListener('unlock', () => {
        if (!isDead) window.showHomeMenu();
    });

    scene.add(controls.getObject());

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function loadLevel(lvl) {
    platforms.forEach(p => scene.remove(p));
    enemies.forEach(e => scene.remove(e.mesh));
    platforms = [];
    enemies = [];

    // Reset player position safely above ground
    controls.getObject().position.set(0, 3, 0);
    velocity.set(0, 0, 0);

    // Base Floor
    const floorGeo = new THREE.BoxGeometry(100, 2, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, 0);
    floor.receiveShadow = true;
    scene.add(floor);
    platforms.push(floor);

    // Interactive Platforms / Obstacles
    const platformCount = 10 + lvl * 2;
    for (let i = 0; i < platformCount; i++) {
        const w = Math.random() * 6 + 4;
        const h = Math.random() * 4 + 2;
        const d = Math.random() * 6 + 4;
        const plat = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5 })
        );
        plat.position.set(
            (Math.random() - 0.5) * 70,
            h / 2,
            (Math.random() - 0.5) * 70
        );
        plat.castShadow = true;
        plat.receiveShadow = true;
        scene.add(plat);
        platforms.push(plat);
    }

    // Spawn Enemies
    const enemyCount = gameMode === 'story' ? 4 + lvl * 3 : 8 + lvl * 5;
    for (let i = 0; i < enemyCount; i++) {
        spawnEnemy();
    }

    document.getElementById('hud-mode').innerText = gameMode.toUpperCase();
    document.getElementById('hud-level').innerText = currentLevel;
    updateEnemyHUD();
}

function spawnEnemy() {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xcc1133, roughness: 0.3 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), armorMat);
    torso.position.y = 1.2;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), armorMat);
    head.position.y = 2.0;
    group.add(head);

    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    visor.position.set(0, 2.0, 0.2);
    group.add(visor);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.0);
    const leftLeg = new THREE.Mesh(legGeo, jointMat);
    leftLeg.position.set(-0.25, 0.5, 0);
    const rightLeg = new THREE.Mesh(legGeo, jointMat);
    rightLeg.position.set(0.25, 0.5, 0);
    group.add(leftLeg, rightLeg);

    group.position.set(
        (Math.random() - 0.5) * 80,
        0,
        (Math.random() - 0.5) * 80
    );

    scene.add(group);
    enemies.push({ mesh: group, health: 60 + currentLevel * 10 });
}

function updateEnemyHUD() {
    document.getElementById('hud-enemies').innerText = enemies.length;
}

function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space': 
            if (canJump) { velocity.y += 12; canJump = false; }
            break;
        case 'KeyC':
        case 'ShiftLeft':
            if (!isSliding && stamina > 30) {
                isSliding = true;
                slideTimer = 0.5;
                stamina -= 30;
                camera.position.y = 0.8;
            }
            break;
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function onMouseDown(e) {
    if (!controls.isLocked) return;
    if (e.button === 0) {
        shoot();
    } else if (e.button === 2) {
        isScoped = true;
        camera.fov = currentWeapon === 'sniper' ? 20 : 45;
        camera.updateProjectionMatrix();
        document.getElementById('crosshair').classList.add('scoped');
        document.getElementById('scope-overlay').style.display = 'block';
    }
}

function onMouseUp(e) {
    if (e.button === 2) {
        isScoped = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        document.getElementById('crosshair').classList.remove('scoped');
        document.getElementById('scope-overlay').style.display = 'none';
    }
}

function shoot() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const enemyMeshes = enemies.map(e => e.mesh);
    const intersects = raycaster.intersectObjects(enemyMeshes, true);

    if (intersects.length > 0) {
        let hitGroup = intersects[0].object;
        while (hitGroup.parent && hitGroup.parent.type === 'Group') {
            hitGroup = hitGroup.parent;
        }

        const enemyObj = enemies.find(e => e.mesh === hitGroup);
        if (enemyObj) {
            const dmg = currentWeapon === 'sniper' ? 100 : (currentWeapon === 'rifle' ? 40 : 25);
            enemyObj.health -= dmg;

            if (enemyObj.health <= 0) {
                scene.remove(enemyObj.mesh);
                enemies = enemies.filter(e => e !== enemyObj);
                credits += 25;
                localStorage.setItem('fps_credits', credits);
                updateUI();
                updateEnemyHUD();

                if (enemies.length === 0) {
                    currentLevel++;
                    if (gameMode === 'story' && currentLevel > 3) {
                        alert('STORY COMPLETED: Outpost Purged Successfully!');
                        controls.unlock();
                    } else {
                        alert(`Level ${currentLevel - 1} Cleared! Starting Level ${currentLevel}`);
                        loadLevel(currentLevel);
                    }
                }
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        if (stamina < 100) stamina = Math.min(100, stamina + 20 * delta);
        document.getElementById('stamina-fill').style.width = stamina + '%';

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 30.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const speedMult = (inventory.speed ? 1.3 : 1.0) * (isSliding ? 2.0 : 1.0);
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta * speedMult;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta * speedMult;

        if (isSliding) {
            slideTimer -= delta;
            if (slideTimer <= 0) {
                isSliding = false;
                camera.position.y = 1.6;
            }
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += velocity.y * delta;

        // HARD FLOOR BOUNDARY: Prevent falling through the void entirely
        if (controls.getObject().position.y < 1.6) {
            controls.getObject().position.y = 1.6;
            velocity.y = 0;
            canJump = true;
        }

        // Platform Collisions
        const playerRay = new THREE.Raycaster(
            controls.getObject().position,
            new THREE.Vector3(0, -1, 0),
            0,
            1.8
        );
        const platformHits = playerRay.intersectObjects(platforms);

        if (platformHits.length > 0) {
            const targetY = platformHits[0].point.y + 1.6;
            if (controls.getObject().position.y <= targetY + 0.5) {
                controls.getObject().position.y = targetY;
                velocity.y = Math.max(0, velocity.y);
                canJump = true;
            }
        }

        const playerPos = controls.getObject().position;
        enemies.forEach(e => {
            e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);
            e.mesh.translateZ(2.5 * delta * (1 + currentLevel * 0.1));

            if (e.mesh.position.distanceTo(playerPos) < 1.5) {
                health -= 15 * delta;
                document.getElementById('health-fill').style.width = Math.max(0, (health / maxHealth) * 100) + '%';

                if (health <= 0 && !isDead) {
                    isDead = true;
                    alert('CRITICAL FAILURE: Operative Defeated.');
                    location.reload();
                }
            }
        });
    }

    prevTime = time;
    renderer.render(scene, camera);
}
