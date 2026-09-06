import { useEffect, useRef, useState } from "react";
import PlaneLoader from "./PlaneLoader";

/**
 * The wait animation in 3D: a low-poly plane banking through soft clouds,
 * lit like an early morning. three.js is loaded only while a trip is being
 * planned, so the initial bundle stays light; without WebGL the flat SVG
 * plane takes over.
 */
export default function Plane3D() {
  const mount = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false;
    let stop: (() => void) | null = null;

    import("three")
      .then((THREE) => {
        if (disposed) return;
        stop = start(THREE, host);
      })
      .catch(() => setFallback(true));

    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  if (fallback) return <PlaneLoader />;
  return <div ref={mount} className="plane-3d" aria-hidden="true" />;
}

type Three = typeof import("three");

function start(THREE: Three, host: HTMLElement): (() => void) | null {
  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  const width = host.clientWidth || 320;
  const height = host.clientHeight || 120;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  // Three-quarter view from above: wings, tail and the bank all read at a glance.
  camera.position.set(0.6, 3.1, 4.6);
  camera.lookAt(0, -0.1, 0);

  // Morning light: warm key, cool sky fill.
  scene.add(new THREE.HemisphereLight(0xdfeef5, 0x9fb5c0, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  // ---- The plane: fuselage, wings, tail, engines — the brand's forest green.
  const body = new THREE.MeshStandardMaterial({ color: 0x0b526b, roughness: 0.45, metalness: 0.15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.6 });
  const plane = new THREE.Group();

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.9, 6, 14), accent);
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), body);
  cockpit.position.set(1.02, 0.03, 0);
  cockpit.scale.set(1.2, 0.8, 0.9);
  plane.add(cockpit);

  const wingShape = new THREE.BoxGeometry(0.6, 0.05, 3.1);
  const wings = new THREE.Mesh(wingShape, body);
  wings.position.set(0.1, -0.05, 0);
  plane.add(wings);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 1.0), body);
  tailWing.position.set(-1.0, 0.05, 0);
  plane.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.05), body);
  fin.position.set(-1.02, 0.3, 0);
  fin.rotation.z = -0.35;
  plane.add(fin);

  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 12), accent);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(0.15, -0.16, side * 0.85);
    plane.add(engine);
  }
  plane.scale.setScalar(0.8);
  scene.add(plane);

  // ---- Clouds: puffs of spheres drifting toward the camera's left.
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const clouds: { group: import("three").Group; speed: number }[] = [];
  const puffGeometry = new THREE.SphereGeometry(1, 10, 8);
  for (let index = 0; index < 7; index += 1) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
      const size = 0.18 + Math.random() * 0.28;
      puff.scale.set(size * 1.6, size, size);
      puff.position.set((p - puffs / 2) * size * 1.3, Math.random() * 0.15, (Math.random() - 0.5) * 0.4);
      group.add(puff);
    }
    group.position.set(-6 + (12 * index) / 7 + Math.random(), -1.0 + Math.random() * 2.0, -2.5 - Math.random() * 3);
    scene.add(group);
    clouds.push({ group, speed: 0.35 + Math.random() * 0.35 });
  }

  const clock = new THREE.Clock();
  let frame = 0;
  const render = () => {
    frame = requestAnimationFrame(render);
    const t = clock.getElapsedTime();

    // A gentle S-shaped flight: drift, climb, and bank into every turn.
    const yaw = Math.sin(t * 0.6) * 0.45;
    plane.position.set(Math.sin(t * 0.6) * 1.4, Math.sin(t * 0.9) * 0.3, Math.cos(t * 0.6) * 0.3);
    plane.rotation.set(0, 0, 0);
    plane.rotateY(-yaw * 0.6); // nose follows the turn
    plane.rotateX(-Math.cos(t * 0.6) * 0.28); // roll into the turn
    plane.rotateZ(Math.cos(t * 0.9) * 0.1); // pitch with the climb

    for (const cloud of clouds) {
      cloud.group.position.x -= cloud.speed * 0.016;
      if (cloud.group.position.x < -7) cloud.group.position.x = 7;
    }

    renderer.render(scene, camera);
  };
  render();

  const onResize = () => {
    const w = host.clientWidth || width;
    const h = host.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
