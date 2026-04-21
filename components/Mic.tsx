"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface MicParams {
  fov: number;
  intensity: number;
  roughness: number;
  metalness: number;
  mainColor: string;
  sideColor: string;
  ambientColor: string;
  micColor: string;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  scale: number;
}

const DEFAULT_PARAMS: MicParams = {
  fov: 19,
  intensity: 2100,
  roughness: 0.25,
  metalness: 0.8,
  mainColor: '#8000ff',
  sideColor: '#8000ff',
  ambientColor: '#222222',
  micColor: '#3b3b3b',
  posX: 0.0,
  posY: -1.7,
  posZ: 2.2,
  rotY: 0.38,
  scale: 1.0,
};

const Mic = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUiHidden, setIsUiHidden] = useState(false);

  // UI state for controlled inputs — separate from live params
  const [uiParams, setUiParams] = useState<MicParams>(DEFAULT_PARAMS);

  // Live refs — read inside rAF without stale closures, zero re-renders
  const paramsRef = useRef<MicParams>(DEFAULT_PARAMS);
  const mouseXRef = useRef(0);

  // Three.js object refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mainLightRef = useRef<THREE.SpotLight | null>(null);
  const sideLightRef = useRef<THREE.PointLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const currentModelRef = useRef<THREE.Group | null>(null);
  const baseScaleRef = useRef(1);
  const animFrameRef = useRef<number>(0);
  const dracoLoaderRef = useRef<DRACOLoader | null>(null);

  // Sync UI state → live ref; apply reactive updates without rebuilding the scene
  const updateParams = useCallback((patch: Partial<MicParams>) => {
    const next = { ...paramsRef.current, ...patch };
    paramsRef.current = next;
    setUiParams(next);

    // Apply hot-updates directly to Three.js objects
    const p = next;
    if (mainLightRef.current) {
      mainLightRef.current.intensity = p.intensity;
      mainLightRef.current.color.set(p.mainColor);
    }
    if (sideLightRef.current) {
      sideLightRef.current.intensity = p.intensity;
      sideLightRef.current.color.set(p.sideColor);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.color.set(p.ambientColor);
    }
    if (cameraRef.current && patch.fov !== undefined) {
      cameraRef.current.fov = p.fov;
      cameraRef.current.updateProjectionMatrix();
    }
    if (currentModelRef.current) {
      if (patch.posX !== undefined || patch.posY !== undefined || patch.posZ !== undefined) {
        currentModelRef.current.position.set(p.posX, p.posY, p.posZ);
      }
      if (patch.scale !== undefined) {
        const s = baseScaleRef.current * p.scale;
        currentModelRef.current.scale.setScalar(s);
      }
      if (patch.micColor !== undefined || patch.roughness !== undefined || patch.metalness !== undefined) {
        currentModelRef.current.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.color.set(p.micColor);
            mat.roughness = p.roughness;
            mat.metalness = p.metalness;
          }
        });
      }
    }
  }, []);

  // Mouse handlers — throttled via rAF lerp, no RAF scheduling needed here
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    mouseXRef.current = ((event.clientX - left) / width) * 2 - 1;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseXRef.current = 0;
  }, []);

  // Three.js bootstrap — runs ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const p = paramsRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      p.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(5, 3, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const mainLight = new THREE.SpotLight(p.mainColor, p.intensity);
    mainLight.position.set(5, 10, 5);
    scene.add(mainLight);
    mainLightRef.current = mainLight;

    const sideLight = new THREE.PointLight(p.sideColor, p.intensity);
    sideLight.position.set(-5, 5, 2);
    scene.add(sideLight);
    sideLightRef.current = sideLight;

    const ambientLight = new THREE.AmbientLight(p.ambientColor, 1);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // OrbitControls (disabled — kept for future use)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false;

    // Loaders
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload(); // warm up WASM decoder in background
    dracoLoaderRef.current = dracoLoader;

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load('/microphone2.glb', (gltf) => {
      const model = gltf.scene;

      // Center & normalise scale once
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const base = maxDim > 0 ? 4 / maxDim : 1;
      baseScaleRef.current = base;
      model.scale.setScalar(base * paramsRef.current.scale);

      model.position.set(paramsRef.current.posX, paramsRef.current.posY, paramsRef.current.posZ);
      model.rotation.y = paramsRef.current.rotY;

      // Apply materials
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          if (mesh.material) (mesh.material as THREE.Material).dispose();
          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(paramsRef.current.micColor),
            roughness: paramsRef.current.roughness,
            metalness: paramsRef.current.metalness,
          });
        }
      });

      currentModelRef.current = model;
      scene.add(model);
    });

    // Animation loop — reads refs, never stale
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (currentModelRef.current) {
        const targetY = paramsRef.current.rotY + mouseXRef.current * 0.4;
        currentModelRef.current.rotation.y +=
          (targetY - currentModelRef.current.rotation.y) * 0.01; // faster lerp
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer — more reliable than window resize
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      controls.dispose();
      dracoLoader.dispose();

      // Full scene cleanup
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            (mesh.material as THREE.Material)?.dispose();
          }
        }
      });

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []); // ← empty deps: scene built once, never rebuilt

  return (
    <section className="relative h-screen w-full bg-black overflow-hidden">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 cursor-crosshair"
      />

      <div className="absolute inset-0 z-[50] pointer-events-none select-none flex items-center justify-end pr-[10%]">
        <h1 className="text-white text-[120px] md:text-[110px] font-black uppercase tracking-tighter leading-[1.1] text-center flex flex-col items-center">
          <span>UCHWYĆ</span>
          <span>CZYSTY</span>
          <span>DŹWIĘK</span>
        </h1>
      </div>

      <button
        onClick={() => setIsUiHidden((v) => !v)}
        className="absolute top-5 right-5 z-[110] bg-white/10 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-full text-[10px] uppercase tracking-[0.2em] hover:bg-white/30 transition-all active:scale-95"
      >
        {isUiHidden ? 'Config' : 'Close'}
      </button>

      {/* Sidebar */}
      <div
        className={`absolute top-0 right-0 h-full w-72 bg-black/90 backdrop-blur-3xl border-l border-white/10 p-8 z-[100] transition-transform duration-700 ease-in-out overflow-y-auto ${isUiHidden ? 'translate-x-full' : 'translate-x-0'
          }`}
      >
        <h2 className="text-white text-[14px] font-light uppercase tracking-[0.3em] mb-10 mt-10 text-center">
          Studio Config
        </h2>

        <div className="space-y-6">
          {/* rotY */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Rotation Base <span>{uiParams.rotY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step="0.001"
              value={uiParams.rotY}
              onChange={(e) => updateParams({ rotY: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* intensity */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Light Intensity <span>{uiParams.intensity}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5000}
              step="10"
              value={uiParams.intensity}
              onChange={(e) => updateParams({ intensity: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* scale */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Scale <span>{uiParams.scale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={3}
              step="0.01"
              value={uiParams.scale}
              onChange={(e) => updateParams({ scale: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* roughness */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Roughness <span>{uiParams.roughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={uiParams.roughness}
              onChange={(e) => updateParams({ roughness: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* metalness */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Metalness <span>{uiParams.metalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={uiParams.metalness}
              onChange={(e) => updateParams({ metalness: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* posY */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Position Y <span>{uiParams.posY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-5}
              max={5}
              step="0.01"
              value={uiParams.posY}
              onChange={(e) => updateParams({ posY: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* Colors */}
          {(['mainColor', 'sideColor', 'micColor', 'ambientColor'] as const).map((key) => (
            <div key={key} className="px-2 flex items-center justify-between">
              <span className="text-[9px] text-white/40 font-mono uppercase">{key}</span>
              <input
                type="color"
                value={uiParams[key]}
                onChange={(e) => updateParams({ [key]: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Mic;
