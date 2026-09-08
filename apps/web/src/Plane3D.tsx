import { memo, useEffect, useRef, useState } from "react";
import PlaneLoader from "./PlaneLoader";

type Three = typeof import("three");
type Group = import("three").Group;
type Material = import("three").Material;

// Loaded only while planning. Unmounting on success/error releases the GPU resources.
const Plane3D = memo(function Plane3D() {
  const mount = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    const fail = () => { if (!disposed) setFallback(true); };
    import("three").then((THREE) => {
      if (!disposed) stop = start(THREE, host, fail, () => { if (!disposed) setReady(true); });
    }).catch(fail);
    return () => { disposed = true; stop?.(); };
  }, []);
  // Keep the host mounted so cleanup can always remove its canvas.
  return <div className="flight-loader" aria-hidden="true">
    <div ref={mount} className="plane-3d" hidden={fallback} />
    {(!ready || fallback) && <div className="globe-placeholder"><div className="globe-placeholder-earth" /><PlaneLoader /></div>}
  </div>;
});
export default Plane3D;

function start(THREE: Three, host: HTMLElement, fail: () => void, ready: () => void): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 1.2, 8.5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xe3f3ff, 1.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-4, 5, 6);
  scene.add(sun);

  const axis = new THREE.Group();
  axis.rotation.z = 0.15;
  scene.add(axis);
  const earthMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.45, 64, 48), earthMaterial);
  axis.add(earth);
  let textureReady = false;
  let disposed = false;
  let frame = 0;
  let failed = false;
  const onFailure = () => {
    if (disposed) return;
    failed = true;
    cancelAnimationFrame(frame);
    fail();
  };
  const texture = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/earth-blue-marble.jpg`,
    (loaded) => {
      if (disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      earthMaterial.map = loaded;
      earthMaterial.needsUpdate = true;
      textureReady = true;
    }, undefined, onFailure
  );

  const white = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.32, metalness: 0.08 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x105669, roughness: 0.35 });
  const coral = new THREE.MeshStandardMaterial({ color: 0xd47a54, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x183d4e, roughness: 0.18, metalness: 0.3 });
  const sphere = new THREE.SphereGeometry(1, 20, 12);
  const ellipsoid = (parent: Group, material: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
  };
  const wing = (parent: Group, points: number[][], material: Material) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: 0.08, bevelEnabled: true, bevelSegments: 2,
      steps: 1, bevelSize: 0.035, bevelThickness: 0.035
    }), material);
    mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    return mesh;
  };
  const plane = new THREE.Group();
  ellipsoid(plane, white, 0, 0, 0, 0.25, 0.25, 1.65);
  ellipsoid(plane, glass, 0, 0.13, -1.14, 0.19, 0.14, 0.3);
  for (const side of [-1, 1]) {
    wing(plane, [[0, -0.55], [side * 1.65, 0.48], [side * 1.7, 0.82], [side * 0.13, 0.4]], white);
    wing(plane, [[0, 1], [side * 0.7, 1.55], [side * 0.68, 1.72], [0, 1.5]], teal);
    ellipsoid(plane, teal, side * 0.8, -0.17, 0.16, 0.17, 0.17, 0.4);
    ellipsoid(plane, glass, side * 0.8, -0.17, -0.2, 0.12, 0.12, 0.025);
    ellipsoid(plane, coral, side * 1.6, 0.08, 0.65, 0.07, 0.07, 0.18);
    for (let j = 0; j < 7; j++) {
      ellipsoid(plane, glass, side * 0.242, 0.06, -0.72 + j * 0.22, 0.014, 0.045, 0.045);
    }
  }
  const tail = wing(plane, [[0.95, 0], [1.45, 0.75], [1.7, 0.75], [1.6, 0]], teal);
  tail.rotation.set(0, -Math.PI / 2, 0);
  tail.position.y = 0.05;
  plane.scale.setScalar(0.27);
  const orbit = new THREE.Group();
  orbit.rotation.set(0.48, 0, -0.32);
  orbit.add(plane);
  scene.add(orbit);
  const radius = 2.05;
  const points = Array.from({ length: 181 }, (_, i) => {
    const a = i / 180 * Math.PI * 2;
    return new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a));
  });
  orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xe6be8c, transparent: true, opacity: 0.27 })));
  const trailPositions = new Float32Array(65 * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
  orbit.add(new THREE.Line(trailGeometry,
    new THREE.LineBasicMaterial({ color: 0xffd0a2, transparent: true, opacity: 0.85 })));

  const resize = () => {
    const width = host.clientWidth || 320, height = host.clientHeight || 320;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    // Fit the orbit to the narrower axis, including portrait phones.
    camera.position.z = Math.max(8.5, 2.6 / (Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect));
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const contextLost = (event: Event) => { event.preventDefault(); onFailure(); };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  let last = performance.now(), flight = 0.9, spin = -1.2;
  let firstFrame = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const render = (now: number) => {
    if (disposed || failed) return;
    const delta = reducedMotion.matches || document.hidden ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now;
    flight += delta * 0.7;
    spin += delta * 0.6;
    earth.rotation.y = spin;
    plane.position.set(radius * Math.cos(flight), 0, radius * Math.sin(flight));
    plane.rotation.set(0, -flight - Math.PI, -0.16);
    for (let i = 0; i < 65; i++) {
      const a = flight - 0.06 - i * 0.011;
      trailPositions[i * 3] = radius * Math.cos(a);
      trailPositions[i * 3 + 2] = radius * Math.sin(a);
    }
    trailGeometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    if (firstFrame && textureReady) { firstFrame = false; ready(); }
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    const geometries = new Set<import("three").BufferGeometry>();
    const materials = new Set<Material>();
    scene.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
