"use client";

import React, { useRef } from 'react';
import Image from 'next/image';
import studioBg from '../assets/Hero-bg.png';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── SHADERY (FBM dissolve — identyczny z działającą wersją HTML) ───────────

const heroVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heroFragment = `
  uniform float uProgress;
  uniform vec2  uResolution;
  uniform vec3  uColor;
  uniform float uSpread;
  varying vec2  vUv;

  float Hash(vec2 p) {
    vec3 p2 = vec3(p.xy, 1.0);
    return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
  }

  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(Hash(i + vec2(0.0, 0.0)), Hash(i + vec2(1.0, 0.0)), f.x),
      mix(Hash(i + vec2(0.0, 1.0)), Hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    v += noise(p * 1.0) * 0.500;
    v += noise(p * 2.0) * 0.250;
    v += noise(p * 4.0) * 0.125;
    return v;
  }

  void main() {
    vec2  uv          = vUv;
    float aspect      = uResolution.x / uResolution.y;
    vec2  centeredUv  = (uv - 0.5) * vec2(aspect, 1.0);

    /* Krawędź przesuwa się z dołu do góry wraz z postępem scrolla */
    float dissolveEdge = uv.y - uProgress * 1.2;
    float noiseValue   = fbm(centeredUv * 15.0);
    float d            = dissolveEdge + noiseValue * uSpread;

    float pixelSize    = 1.0 / uResolution.y;
    float alpha        = 1.0 - smoothstep(-pixelSize, pixelSize, d);

    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ────────────────────────────────────────────────────────────────────────────

export default function HeroSection() {
  const container = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const logoRef    = useRef<HTMLHeadingElement>(null);
  const imageRef   = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!canvasRef.current || !container.current) return;

    // ── Three.js ──────────────────────────────────────────────────────────
    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
      canvas:    canvasRef.current,
      alpha:     true,
      antialias: false,           // false — mniej artefaktów przy szumie
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress:   { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uColor:      { value: new THREE.Color('#000000') },
        uSpread:     { value: 0.5 },   // "szarpanie" krawędzi — zmień wg gustu
      },
      vertexShader:   heroVertex,
      fragmentShader: heroFragment,
      transparent:    true,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    // Pierwsze wyrenderowanie (bez scrolla overlay jest pełny — zakrywa tło)
    renderer.render(scene, camera);

    // ── Scroll → shader ───────────────────────────────────────────────────
    ScrollTrigger.create({
      trigger: container.current,
      start:   "top top",
      end:     "bottom top",
      scrub:   true,
      onUpdate: (self) => {
        material.uniforms.uProgress.value = self.progress;

        // Paralaksa tła
        if (imageRef.current) {
          gsap.set(imageRef.current, { y: self.progress * 150 });
        }

        renderer.render(scene, camera);
      },
    });

    // ── Neon flicker logo ─────────────────────────────────────────────────
    const neonTl = gsap.timeline({ repeat: -1, repeatDelay: 3 });
    neonTl
      .to(logoRef.current, {
        color:      "#bc13fe",
        textShadow: "0 0 20px #bc13fe",
        duration:   0.05,
      })
      .to(logoRef.current, { opacity: 0.5, duration: 0.02 })
      .to(logoRef.current, { opacity: 1,   duration: 0.02 })
      .to(logoRef.current, {
        color:      "#bc13fe",
        textShadow: "0 0 0px #bc13fe",
        duration:   1.5,
        delay:      1,
      });

    // ── Reveal wejściowy ──────────────────────────────────────────────────
    gsap.from(".animate-reveal", {
      y:        50,
      opacity:  0,
      duration: 1.4,
      stagger:  0.15,
      ease:     "expo.out",
    });

    // ── Resize ────────────────────────────────────────────────────────────
    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, { scope: container });

  return (
    <main
      ref={container}
      className="relative w-full bg-[#121212] text-white overflow-hidden"
      style={{ height: '100vh' }}
    >
      {/* Three.js canvas — overlay na samej górze, pointer-events none */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-40 pointer-events-none w-full h-full"
      />

      {/* Tło ze zdjęciem + paralaksa */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div ref={imageRef} className="absolute inset-0 scale-110">
          <Image
            src={studioBg}
            alt="Studio Background"
            fill
            className="object-cover brightness-[0.5] contrast-[1.1]"
            priority
          />
        </div>
        {/* Winiety góra/dół */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black opacity-80" />
      </div>

      {/* Treść */}
      <section className="relative z-30 flex h-full flex-col justify-between px-6 py-10 md:px-16 md:py-16">

        {/* Header */}
        <header className="flex justify-between items-start w-full">
          <div className="animate-reveal group cursor-pointer">
            <h1
              ref={logoRef}
              className="text-xl font-black uppercase tracking-tighter transition-all duration-500"
            >
              Futura
            </h1>
            {/* Podkreślenie hover */}
            <div className="h-[1px] w-0 group-hover:w-full bg-[#bc13fe] transition-all duration-500" />
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/40 mt-1">
              Creative Lab
            </p>
          </div>

          <div className="animate-reveal hidden md:block text-right">
            <div className="font-mono text-[10px] text-white/30 uppercase tracking-widest leading-loose">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
              REC STATUS: ON AIR<br />
              NOISE FLOOR: MINIMAL
            </div>
          </div>
        </header>

        {/* Główny tytuł */}
        <div className="max-w-5xl">
          <h2 className="animate-reveal text-[13vw] font-bold leading-[0.85] uppercase tracking-tighter md:text-[6vw]">
            Studio <br />
            <span className="italic-outline text-transparent italic">Muzyczne</span>
          </h2>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end w-full">
          <div className="animate-reveal hidden lg:block max-w-[240px]">
            <p className="text-[10px] uppercase tracking-widest text-white/40 leading-relaxed border-l border-[#bc13fe] pl-4">
              Definiujemy na nowo przestrzeń dźwiękową poprzez fuzję technologii i emocji.
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="animate-reveal absolute left-1/2 bottom-8 -translate-x-1/2 flex flex-col items-center gap-4">
            <span className="text-[9px] uppercase tracking-[0.5em] text-white/40 animate-bounce">
              Explore
            </span>
            <div className="h-16 w-[1px] bg-gradient-to-b from-[#bc13fe] via-[#bc13fe]/50 to-transparent" />
          </div>

          <div className="animate-reveal text-right font-mono text-[10px] text-white/20">
            <p className="hover:text-[#bc13fe] transition-colors cursor-crosshair">LOC: 52.2297° N</p>
            <p className="hover:text-[#bc13fe] transition-colors cursor-crosshair">CRD: 21.0122° E</p>
          </div>
        </div>
      </section>

      <style jsx global>{`
        body {
          background-color: #121212;
          cursor: crosshair;
        }
        .italic-outline {
          -webkit-text-stroke: 1px #bc13fe;
          color: transparent;
          transition: all 0.5s ease;
        }
        .italic-outline:hover {
          color: #bc13fe;
          -webkit-text-stroke: 1px transparent;
        }
        ::-webkit-scrollbar       { width: 3px; }
        ::-webkit-scrollbar-track { background: #121212; }
        ::-webkit-scrollbar-thumb { background: #bc13fe; }
      `}</style>
    </main>
  );
}
