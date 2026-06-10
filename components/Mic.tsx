"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PricingPanel from './PricingPanel';

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

// Speaker shares the mic's look. Starts centred at the orbit target so it is
// guaranteed to be in frame — fine-tune position/scale from the panel.
// Colours/material/lighting are kept identical to the mic on purpose.
const SPEAKER_PARAMS: MicParams = {
  ...DEFAULT_PARAMS,
  mainColor: '#8000ff',   // same as mic
  sideColor: '#8000ff',   // same as mic
  ambientColor: '#222222', // same as mic
  micColor: '#3b3b3b',    // same as mic
  intensity: 2100,        // same as mic
  roughness: 0.25,        // same as mic
  metalness: 0.8,         // same as mic
  posX: 0.0,
  posY: 0.0,
  posZ: 0.0,
  rotY: -0.38,
};

const Mic = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);
  const text3Ref = useRef<HTMLHeadingElement>(null);
  const speakerContainerRef = useRef<HTMLDivElement>(null);
  const speakerTextRef = useRef<HTMLHeadingElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [isSpeakerPreview, setIsSpeakerPreview] = useState(false);

  // UI state for controlled inputs — separate from live params
  const [speakerUiParams, setSpeakerUiParams] = useState<MicParams>(SPEAKER_PARAMS);

  // Live refs — read inside rAF without stale closures, zero re-renders
  const paramsRef = useRef<MicParams>(DEFAULT_PARAMS);
  const speakerParamsRef = useRef<MicParams>(SPEAKER_PARAMS);
  const mouseXRef = useRef(0);

  // Three.js object refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mainLightRef = useRef<THREE.SpotLight | null>(null);
  const sideLightRef = useRef<THREE.PointLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const currentModelRef = useRef<THREE.Group | null>(null);
  const speakerModelRef = useRef<THREE.Group | null>(null);
  const speakerCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const speakerControlsRef = useRef<OrbitControls | null>(null);
  const spkMainLightRef = useRef<THREE.SpotLight | null>(null);
  const spkSideLightRef = useRef<THREE.PointLight | null>(null);
  const spkAmbientLightRef = useRef<THREE.AmbientLight | null>(null);
  const baseScaleRef = useRef(1);
  const speakerBaseScaleRef = useRef(1);
  const animFrameRef = useRef<number>(0);
  const dracoLoaderRef = useRef<DRACOLoader | null>(null);
  // True while the section is anywhere in the viewport — gates the render loop.
  const sectionActiveRef = useRef(true);

  // Sync UI state → live ref; apply reactive updates to the speaker scene/model.
  const updateSpeakerParams = useCallback((patch: Partial<MicParams>) => {
    const next = { ...speakerParamsRef.current, ...patch };
    speakerParamsRef.current = next;
    setSpeakerUiParams(next);

    const p = next;
    if (spkMainLightRef.current) {
      spkMainLightRef.current.intensity = p.intensity;
      spkMainLightRef.current.color.set(p.mainColor);
    }
    if (spkSideLightRef.current) {
      spkSideLightRef.current.intensity = p.intensity;
      spkSideLightRef.current.color.set(p.sideColor);
    }
    if (spkAmbientLightRef.current) {
      spkAmbientLightRef.current.color.set(p.ambientColor);
    }
    if (speakerCameraRef.current && patch.fov !== undefined) {
      speakerCameraRef.current.fov = p.fov;
      speakerCameraRef.current.updateProjectionMatrix();
    }
    if (speakerModelRef.current) {
      if (patch.posX !== undefined || patch.posY !== undefined || patch.posZ !== undefined) {
        speakerModelRef.current.position.set(p.posX, p.posY, p.posZ);
      }
      if (patch.scale !== undefined) {
        const s = speakerBaseScaleRef.current * p.scale;
        speakerModelRef.current.scale.setScalar(s);
      }
      if (patch.micColor !== undefined || patch.roughness !== undefined || patch.metalness !== undefined) {
        speakerModelRef.current.traverse((child) => {
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

  // Preview mode — force the speaker canvas fully visible & on top so it can
  // be positioned with the panel without scrolling to its timeline phase.
  useEffect(() => {
    const el = speakerContainerRef.current;
    if (!el) return;
    if (isSpeakerPreview) {
      gsap.set(el, {
        opacity: 1,
        filter: 'blur(0px) brightness(1)',
        scale: 1,
        zIndex: 80,
      });
      el.style.pointerEvents = 'auto';        // let OrbitControls grab the mouse
      if (speakerControlsRef.current) speakerControlsRef.current.enabled = true;
    } else {
      gsap.set(el, { opacity: 0, zIndex: 15 });
      el.style.pointerEvents = 'none';
      if (speakerControlsRef.current) speakerControlsRef.current.enabled = false;
    }
  }, [isSpeakerPreview]);

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

    // ── Speaker scene (own canvas, revealed AFTER the wave) ──────────────
    const speakerContainer = speakerContainerRef.current!;
    const speakerScene = new THREE.Scene();
    speakerScene.background = new THREE.Color(0x000000);

    const sp = speakerParamsRef.current;
    const speakerCamera = new THREE.PerspectiveCamera(
      sp.fov,
      speakerContainer.clientWidth / speakerContainer.clientHeight,
      0.1,
      1000,
    );
    speakerCamera.position.set(5, 3, 5);
    speakerCameraRef.current = speakerCamera;

    const speakerRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    speakerRenderer.setSize(speakerContainer.clientWidth, speakerContainer.clientHeight);
    speakerRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    speakerRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    speakerRenderer.toneMappingExposure = 1.2;
    speakerContainer.appendChild(speakerRenderer.domElement);

    // Orbit controls — only enabled in preview so the speaker can be found
    // and framed by hand (drag to rotate, scroll to zoom).
    const speakerControls = new OrbitControls(speakerCamera, speakerRenderer.domElement);
    speakerControls.enableDamping = true;
    speakerControls.enabled = false;
    speakerControlsRef.current = speakerControls;

    const spkMain = new THREE.SpotLight(sp.mainColor, sp.intensity);
    spkMain.position.set(5, 10, 5);
    speakerScene.add(spkMain);
    spkMainLightRef.current = spkMain;
    const spkSide = new THREE.PointLight(sp.sideColor, sp.intensity);
    spkSide.position.set(-5, 5, 2);
    speakerScene.add(spkSide);
    spkSideLightRef.current = spkSide;
    const spkAmbient = new THREE.AmbientLight(sp.ambientColor, 1);
    speakerScene.add(spkAmbient);
    spkAmbientLightRef.current = spkAmbient;

    loader.load('/spekaer.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const base = maxDim > 0 ? 4 / maxDim : 1;
      speakerBaseScaleRef.current = base;
      model.scale.setScalar(base * speakerParamsRef.current.scale);

      model.position.set(speakerParamsRef.current.posX, speakerParamsRef.current.posY, speakerParamsRef.current.posZ);
      model.rotation.y = speakerParamsRef.current.rotY;

      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          if (mesh.material) (mesh.material as THREE.Material).dispose();
          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(speakerParamsRef.current.micColor),
            roughness: speakerParamsRef.current.roughness,
            metalness: speakerParamsRef.current.metalness,
          });
        }
      });

      speakerModelRef.current = model;
      speakerScene.add(model);

      // Point the orbit target at the model so preview orbiting feels right.
      speakerControls.target.set(
        speakerParamsRef.current.posX,
        speakerParamsRef.current.posY,
        speakerParamsRef.current.posZ,
      );
      speakerControls.update();

      // Diagnostics — confirms the model loaded and how big it ended up.
      console.log('[speaker] loaded — raw size:', size, 'baseScale:', base);
    }, undefined, (err) => {
      console.error('[speaker] failed to load /spekaer.glb', err);
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

    // A canvas is "visible" only when GSAP has its container opacity > ~0.
    // CSS opacity:0 does NOT stop WebGL, so we gate the render calls ourselves.
    const isVisible = (el: HTMLElement) => parseFloat(el.style.opacity || '1') > 0.001;

    // Animation loop — reads refs, never stale. Drives all three scenes, but
    // only renders the ones currently on screen (huge perf win — invisible
    // scenes cost nothing). When the whole section is off-screen, it bails out
    // before any work at all.
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Section scrolled out of view → render nothing.
      if (!sectionActiveRef.current) return;

      // ── Mic ──────────────────────────────────────────────────────────
      if (isVisible(container)) {
        if (currentModelRef.current) {
          const targetY = paramsRef.current.rotY + mouseXRef.current * 0.4;
          currentModelRef.current.rotation.y +=
            (targetY - currentModelRef.current.rotation.y) * 0.01; // faster lerp
        }
        renderer.render(scene, camera);
      }

      // ── Speaker ──────────────────────────────────────────────────────
      // Always render while preview/orbit is active; otherwise only when shown.
      if (speakerControls.enabled || isVisible(speakerContainer)) {
        if (speakerControls.enabled) {
          speakerControls.update();
        } else if (speakerModelRef.current) {
          const targetY = speakerParamsRef.current.rotY + mouseXRef.current * 0.4;
          speakerModelRef.current.rotation.y +=
            (targetY - speakerModelRef.current.rotation.y) * 0.01;
        }
        speakerRenderer.render(speakerScene, speakerCamera);
      }

      // ── Wave ─────────────────────────────────────────────────────────
      // Decay velocity / lerp amplitude every active frame (cheap) so it never
      // spikes on reveal, but only run the heavy geometry update + render when
      // the wave is actually visible.
      smoothVelocity *= 0.94;
      const targetAmp = Math.min(smoothVelocity / 25, 120);
      waveState.amplitude += (targetAmp - waveState.amplitude) * 0.12;
      waveState.phase += 0.02;

      if (isVisible(waveContainer)) {
        updateWaves();
        waveRenderer.render(waveScene, waveCamera);
      }
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

      const sw = speakerContainer.clientWidth;
      const sh = speakerContainer.clientHeight;
      speakerCamera.aspect = sw / sh;
      speakerCamera.updateProjectionMatrix();
      speakerRenderer.setSize(sw, sh);

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
    // Phase 2 (pinned): mic → wave → speaker, all on the same pinned stage.
    const words = textRef.current?.querySelectorAll<HTMLElement>('.word') ?? [];

    const words2 = text2Ref.current?.querySelectorAll<HTMLElement>('.word2') ?? [];
    const words3 = text3Ref.current?.querySelectorAll<HTMLElement>('.word3') ?? [];
    const words4 = speakerTextRef.current?.querySelectorAll<HTMLElement>('.word4') ?? [];

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
    // Speaker headline (left) starts dropped from above like UCHWYĆ
    gsap.set(words4, {
      yPercent: -120,
      opacity: 0,
      filter: 'blur(10px)',
    });
    // Mic entrance mirrors its exit: scale up from 0.92, blur + brightness fade
    gsap.set(container, {
      opacity: 0,
      filter: 'blur(20px) brightness(0.4)',
      scale: 0.92,
    });
    // Wave + speaker canvases are hidden until their cue.
    gsap.set(waveContainer, { opacity: 0 });
    gsap.set(speakerContainer, {
      opacity: 0,
      filter: 'blur(20px) brightness(0.4)',
      scale: 0.92,
    });
    // Cennik hidden until the speaker leaves. autoAlpha → visibility:hidden so
    // it never intercepts clicks while the 3D phases play.
    gsap.set(pricingRef.current, { autoAlpha: 0, filter: 'blur(20px)', yPercent: 5 });

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

    textTl
      .to(words, {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        stagger: 0.06,
        duration: 0.55,
        ease: 'power2.out',
      })
      .to(container, {
        opacity: 1,
        filter: 'blur(0px) brightness(1)',
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
      }, '<');

    // Phase 2 — section is pinned. Mic dissolves in, the wave takes over, then
    // the speaker takes the same stage after the wave.
    const micTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=850%',
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    micTl
      // Mic + UCHWYĆ are already revealed during scroll-in (textTl).
      // Pin starts with a hold so the user can take in the scene.
      .to({}, { duration: 1.0 })
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
      // Hold on the wave so the user can scroll and watch it react.
      .to({}, { duration: 0.5 })
      // ── Wave exits, speaker takes the stage ──────────────────────────
      .to(waveContainer, {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.in',
      })
      .to([words2, words3], {
        yPercent: 115,
        skewY: 6,
        filter: 'blur(8px)',
        stagger: 0.06,
        duration: 0.55,
        ease: 'power2.in',
      }, '<')
      // Speaker enters only AFTER the wave has fully faded out (no '<' here,
      // so it starts at the end of the wave-exit tween).
      .to(speakerContainer, {
        opacity: 1,
        filter: 'blur(0px) brightness(1)',
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
      })
      // POCZUJ POTĘGĘ BASU reveals (left) — enters together with the speaker,
      // exactly like the mic + its headline (textTl uses '<').
      .to(words4, {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        stagger: 0.06,
        duration: 0.55,
        ease: 'power2.out',
      }, '<')
      // Very short beat, then the speaker exits with the SAME effect as the mic
      // (blur + brightness down + scale 0.92, headline flies up).
      .to({}, { duration: 0.3 })
      .to(speakerContainer, {
        opacity: 0,
        filter: 'blur(20px) brightness(0.4)',
        scale: 0.92,
        duration: 0.7,
        ease: 'power2.in',
      })
      .to(words4, {
        yPercent: -120,
        opacity: 0,
        filter: 'blur(10px)',
        stagger: 0.06,
        duration: 0.55,
        ease: 'power2.in',
      }, '<')
      // ── Cennik takes the same stage once the speaker is gone ──────────
      .to(pricingRef.current, {
        autoAlpha: 1,
        filter: 'blur(0px)',
        yPercent: 0,
        duration: 0.8,
        ease: 'power2.out',
      })
      // Long hold so the cennik stays put and the calendar can be used.
      .to({}, { duration: 3 });

    // ── Render-loop gate ────────────────────────────────────────────────
    // Flip sectionActiveRef whenever the section enters/leaves the viewport.
    // While off-screen the rAF loop bails immediately (no WebGL work at all).
    // Uses IntersectionObserver (NOT a ScrollTrigger) so the pin's spacer math
    // can't confuse it — during the pin the section is fixed & covers the
    // viewport, so it stays correctly "intersecting" the whole time.
    const sectionIO = new IntersectionObserver(
      (entries) => { sectionActiveRef.current = entries[0].isIntersecting; },
      { threshold: 0 },
    );
    sectionIO.observe(sectionRef.current!);

    return () => {
      sectionIO.disconnect();
      textTl.scrollTrigger?.kill();
      textTl.kill();
      micTl.scrollTrigger?.kill();
      micTl.kill();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      controls.dispose();
      dracoLoader.dispose();

      // Full scene cleanup — mic
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

      // Speaker scene cleanup
      speakerScene.traverse((obj) => {
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
      speakerControls.dispose();
      speakerRenderer.dispose();
      if (speakerRenderer.domElement.parentElement === speakerContainer) {
        speakerContainer.removeChild(speakerRenderer.domElement);
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

      {/* Speaker canvas — top 3D layer, revealed after the wave */}
      <div
        ref={speakerContainerRef}
        className="absolute inset-0 z-[15] pointer-events-none"
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

      {/* "POCZUJ POTĘGĘ BASU" — speaker phase text (LEFT) */}
      <div className="absolute inset-0 z-[60] pointer-events-none select-none flex items-center justify-start pl-[10%]">
        <h1
          ref={speakerTextRef}
          className="text-[#8000ff] text-[120px] md:text-[110px] font-black uppercase tracking-tighter leading-[1.1] text-center flex flex-col items-center will-change-transform"
        >
          {['POCZUJ', 'POTĘGĘ', 'BASU'].map((w) => (
            <span key={w} className="block overflow-hidden pb-[0.08em]">
              <span className="word4 block will-change-transform">{w}</span>
            </span>
          ))}
        </h1>
      </div>

      {/* Cennik — fills the section (100vh) and is revealed on the same pinned
          stage once the speaker fades out. autoAlpha (visibility:hidden) keeps
          it click-through until shown. */}
      <div ref={pricingRef} className="absolute inset-0 z-[65] bg-black">
        <PricingPanel />
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
          {/* Preview toggle — show the speaker without scrolling to its phase */}
          <button
            onClick={() => setIsSpeakerPreview((v) => !v)}
            className={`w-full py-3 rounded-full text-[10px] uppercase tracking-[0.2em] border transition-all active:scale-95 ${isSpeakerPreview
              ? 'bg-[#8000ff] text-white border-[#8000ff]'
              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
          >
            {isSpeakerPreview ? 'Preview: ON' : 'Preview Speaker'}
          </button>

          {/* speaker rotY */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Rotation Base <span>{speakerUiParams.rotY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step="0.001"
              value={speakerUiParams.rotY}
              onChange={(e) => updateSpeakerParams({ rotY: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker posX */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Position X <span>{speakerUiParams.posX.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              step="0.01"
              value={speakerUiParams.posX}
              onChange={(e) => updateSpeakerParams({ posX: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker posY */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Position Y <span>{speakerUiParams.posY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              step="0.01"
              value={speakerUiParams.posY}
              onChange={(e) => updateSpeakerParams({ posY: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker posZ */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Position Z <span>{speakerUiParams.posZ.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              step="0.01"
              value={speakerUiParams.posZ}
              onChange={(e) => updateSpeakerParams({ posZ: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker scale */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Scale <span>{speakerUiParams.scale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={20}
              step="0.01"
              value={speakerUiParams.scale}
              onChange={(e) => updateSpeakerParams({ scale: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker intensity */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Light Intensity <span>{speakerUiParams.intensity}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5000}
              step="10"
              value={speakerUiParams.intensity}
              onChange={(e) => updateSpeakerParams({ intensity: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker roughness */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Roughness <span>{speakerUiParams.roughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={speakerUiParams.roughness}
              onChange={(e) => updateSpeakerParams({ roughness: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker metalness */}
          <div className="px-2">
            <div className="flex justify-between text-[9px] text-white/40 mb-2 font-mono uppercase">
              Metalness <span>{speakerUiParams.metalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={speakerUiParams.metalness}
              onChange={(e) => updateSpeakerParams({ metalness: parseFloat(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* speaker Colors */}
          {(['mainColor', 'sideColor', 'micColor', 'ambientColor'] as const).map((key) => (
            <div key={`spk-${key}`} className="px-2 flex items-center justify-between">
              <span className="text-[9px] text-white/40 font-mono uppercase">{key}</span>
              <input
                type="color"
                value={speakerUiParams[key]}
                onChange={(e) => updateSpeakerParams({ [key]: e.target.value })}
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
