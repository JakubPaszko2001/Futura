"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const WAVE_CONFIG = {
  pointsCount: 200,
  width: 20,
  waves: [
    { color: 0x8000ff, freq: 0.8, phaseOffset: 0, ampMult: 1.0, opacity: 0.9 },
    { color: 0x9632ff, freq: 1.2, phaseOffset: 1.5, ampMult: 0.7, opacity: 0.5 },
    { color: 0xc896ff, freq: 2.0, phaseOffset: 3.0, ampMult: 0.4, opacity: 0.3 },
  ],
};

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
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);
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

    // ── Wave scene (separate canvas, sits beneath the mic canvas) ────────
    const waveContainer = waveContainerRef.current!;
    const waveScene = new THREE.Scene();
    const waveCamera = new THREE.PerspectiveCamera(
      75,
      waveContainer.clientWidth / waveContainer.clientHeight,
      0.1,
      1000,
    );
    waveCamera.position.z = 10;

    const waveRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    waveRenderer.setSize(waveContainer.clientWidth, waveContainer.clientHeight);
    waveRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    waveContainer.appendChild(waveRenderer.domElement);

    const waveState = { amplitude: 0, phase: 0 };

    const waveLines = WAVE_CONFIG.waves.map((w) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(WAVE_CONFIG.pointsCount * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: w.color,
        transparent: true,
        opacity: w.opacity,
      });
      const line = new THREE.Line(geometry, material);
      waveScene.add(line);
      return { ...w, line, geometry, positions };
    });

    const updateWaves = () => {
      waveLines.forEach((w) => {
        const pos = w.positions;
        for (let i = 0; i < WAVE_CONFIG.pointsCount; i++) {
          const t = i / (WAVE_CONFIG.pointsCount - 1);
          const x = (t - 0.5) * WAVE_CONFIG.width;
          const mask = Math.sin(t * Math.PI);
          const angle = i * (w.freq * 0.1) + waveState.phase + w.phaseOffset;
          const y = Math.sin(angle) * (waveState.amplitude * 0.05 * w.ampMult * mask);
          pos[i * 3] = x;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = 0;
        }
        w.geometry.attributes.position.needsUpdate = true;
      });
    };

    // ── Velocity-driven wave amplitude — frame-based smoothing ──────────
    // Scroll listener only feeds an EMA-smoothed velocity. The animate loop
    // derives the target amplitude from it and lerps waveState.amplitude
    // toward the target each frame — no GSAP tweens stomping each other.
    let prevScrollY = window.scrollY;
    let prevScrollTime = performance.now();
    let smoothVelocity = 0;
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = now - prevScrollTime;
      if (dt > 0) {
        const instantV = (Math.abs(y - prevScrollY) * 1000) / dt; // px/s
        smoothVelocity = smoothVelocity * 0.55 + instantV * 0.45;
      }
      prevScrollY = y;
      prevScrollTime = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Animation loop — reads refs, never stale. Drives both scenes.
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (currentModelRef.current) {
        const targetY = paramsRef.current.rotY + mouseXRef.current * 0.4;
        currentModelRef.current.rotation.y +=
          (targetY - currentModelRef.current.rotation.y) * 0.01; // faster lerp
      }

      renderer.render(scene, camera);

      // Decay the velocity each frame so amplitude eases back to 0 when
      // the user stops scrolling, then lerp current amplitude toward target.
      smoothVelocity *= 0.94;
      const targetAmp = Math.min(smoothVelocity / 25, 120);
      waveState.amplitude += (targetAmp - waveState.amplitude) * 0.12;

      waveState.phase += 0.02;
      updateWaves();
      waveRenderer.render(waveScene, waveCamera);
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

      const ww = waveContainer.clientWidth;
      const wh = waveContainer.clientHeight;
      waveCamera.aspect = ww / wh;
      waveCamera.updateProjectionMatrix();
      waveRenderer.setSize(ww, wh);
    });
    ro.observe(container);

    // ── Scroll-driven reveal ─────────────────────────────────────────────
    // Phase 1 (early): per-word mask reveal of text — starts as soon as the
    //   section enters the viewport from below, finishes when it docks at top.
    // Phase 2 (pinned): 3D canvas materialises via expanding circular clip-path.
    const words = textRef.current?.querySelectorAll<HTMLElement>('.word') ?? [];

    const words2 = text2Ref.current?.querySelectorAll<HTMLElement>('.word2') ?? [];
    const words3 = text3Ref.current?.querySelectorAll<HTMLElement>('.word3') ?? [];

    // UCHWYĆ entrance mirrors its exit: drops from above, opacity + blur fade
    gsap.set(words, {
      yPercent: -120,
      opacity: 0,
      filter: 'blur(10px)',
    });
    gsap.set([...Array.from(words2), ...Array.from(words3)], {
      yPercent: 115,
      skewY: 6,
      filter: 'blur(8px)',
    });
    // Mic entrance mirrors its exit: scale up from 0.92, blur + brightness fade
    gsap.set(container, {
      opacity: 0,
      filter: 'blur(20px) brightness(0.4)',
      scale: 0.92,
    });
    // Wave is hidden until the mic fades out — flat lines at amplitude 0
    // would otherwise be visible from the start.
    gsap.set(waveContainer, { opacity: 0 });

    // Phase 1 — runs while the section is scrolling INTO view (no pin)
    const textTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 45%',        // section ~25% into view — slight delay
        end: 'top top+=5%',      // wraps just before it docks at the top
        scrub: 1,
      },
    });

    textTl.to(words, {
      yPercent: 0,
      opacity: 1,
      filter: 'blur(0px)',
      stagger: 0.06,
      duration: 0.55,
      ease: 'power2.out',
    });

    // Phase 2 — section is pinned. Mic dissolves in, then fades out as the
    // wave + new copy take over the same stage.
    const micTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=550%',
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    micTl
      // Mic materialises — mirror of its exit (blur + brightness + scale)
      .to(container, {
        opacity: 1,
        filter: 'blur(0px) brightness(1)',
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
      })
      // Hold so the user can take in the mic
      .to({}, { duration: 0.6 })
      // Mic + UCHWYĆ text exit; wave fades in at the same time
      .to(container, {
        opacity: 0,
        filter: 'blur(20px) brightness(0.4)',
        scale: 0.92,
        duration: 0.7,
        ease: 'power2.in',
      })
      .to(words, {
        yPercent: -120,
        opacity: 0,
        filter: 'blur(10px)',
        stagger: 0.06,
        duration: 0.55,
        ease: 'power2.in',
      }, '<')
      .to(waveContainer, {
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out',
      }, '<')
      // USŁYSZ WIĘCEJ SIEBIE reveals (top-left)
      .to(words2, {
        yPercent: 0,
        skewY: 0,
        filter: 'blur(0px)',
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
      }, '-=0.15')
      // POCZUJ KAŻDY TON reveals (bottom-right)
      .to(words3, {
        yPercent: 0,
        skewY: 0,
        filter: 'blur(0px)',
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
      }, '+=0.4')
      // Long final hold — pin stays so the user can keep scrolling and
      // watch the wave react to scroll velocity.
      .to({}, { duration: 5 });

    return () => {
      textTl.scrollTrigger?.kill();
      textTl.kill();
      micTl.scrollTrigger?.kill();
      micTl.kill();
      window.removeEventListener('scroll', onScroll);
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
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }

      // Wave cleanup
      waveLines.forEach((l) => {
        l.geometry.dispose();
        (l.line.material as THREE.Material).dispose();
      });
      waveRenderer.dispose();
      if (waveRenderer.domElement.parentElement === waveContainer) {
        waveContainer.removeChild(waveRenderer.domElement);
      }
    };
  }, []); // ← empty deps: scene built once, never rebuilt

  return (
    <section ref={sectionRef} className="relative h-screen w-full bg-black overflow-hidden">
      {/* Wave canvas — bottom layer, becomes visible when mic fades out */}
      <div ref={waveContainerRef} className="absolute inset-0 z-[5]" />

      {/* Mic canvas — sits above the wave */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 z-[10] cursor-crosshair"
      />

      {/* "UCHWYĆ CZYSTY DŹWIĘK" — phase 1 text */}
      <div className="absolute inset-0 z-[50] pointer-events-none select-none flex items-center justify-end pr-[10%]">
        <h1
          ref={textRef}
          className="text-[#8000ff] text-[120px] md:text-[110px] font-black uppercase tracking-tighter leading-[1.1] text-center flex flex-col items-center will-change-transform"
        >
          {['UCHWYĆ', 'CZYSTY', 'DŹWIĘK'].map((w) => (
            <span key={w} className="block overflow-hidden pb-[0.08em]">
              <span className="word block will-change-transform">{w}</span>
            </span>
          ))}
        </h1>
      </div>

      {/* "USŁYSZ WIĘCEJ SIEBIE" — phase 2 text (top-left) */}
      <h2
        ref={text2Ref}
        className="absolute top-12 left-8 md:top-20 md:left-20 z-[55] text-[#8000ff] text-[34px] md:text-[56px] font-black uppercase tracking-tighter pointer-events-none select-none flex gap-x-3 will-change-transform"
      >
        {['USŁYSZ', 'WIĘCEJ', 'SIEBIE'].map((w) => (
          <span key={w} className="overflow-hidden pb-[0.12em]">
            <span className="word2 inline-block will-change-transform">{w}</span>
          </span>
        ))}
      </h2>

      {/* "POCZUJ KAŻDY TON" — phase 2 text (bottom-right) */}
      <h2
        ref={text3Ref}
        className="absolute bottom-12 right-8 md:bottom-20 md:right-20 z-[55] text-[#8000ff] text-[34px] md:text-[56px] font-black uppercase tracking-tighter pointer-events-none select-none flex gap-x-3 will-change-transform"
      >
        {['POCZUJ', 'KAŻDY', 'TON'].map((w) => (
          <span key={w} className="overflow-hidden pb-[0.12em]">
            <span className="word3 inline-block will-change-transform">{w}</span>
          </span>
        ))}
      </h2>

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
