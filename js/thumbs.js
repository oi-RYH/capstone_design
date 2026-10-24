// 에셋 3D 미리보기 사진 만들기
// 브라우저에서 각 에셋의 3D 모델을 한 번씩 렌더링해서 이미지(data URL)로 만든다.
// 실물 사진은 images/parts/<에셋 id>.jpg 에 넣으면 편집 페이지에서 함께 보인다.
import * as THREE from 'three';
import { ASSETS, resolveParams } from './assets.js';

export const PHOTO_DIR = 'images/parts/';

export function makeThumbnails(size = 160) {
  const out = new Map();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out; // WebGL 을 못 쓰는 환경이면 사진 없이 진행
  }
  renderer.setPixelRatio(2);
  renderer.setSize(size, size * 0.75, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a949c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 3, 2.5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 100000);

  for (const a of ASSETS) {
    if (a.hidden) continue;
    const params = resolveParams(a, a.previewParams || {});
    const obj = a.build(params);
    const holder = new THREE.Group();
    holder.add(obj);
    if (a.previewRot) holder.rotation.set(...a.previewRot);
    scene.add(holder);

    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.95;
    camera.position.copy(center).add(new THREE.Vector3(0.75, 0.55, 1).normalize().multiplyScalar(dist));
    camera.lookAt(center);
    renderer.render(scene, camera);
    out.set(a.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(holder);
  }
  renderer.dispose();
  return out;
}
