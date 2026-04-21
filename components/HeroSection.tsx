"use client";

import React, { useRef, useMemo } from 'react';
import Image from 'next/image';
import studioBg from '../assets/Hero-bg.png';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// --- SHADERS DLA HERO ---
const heroVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const heroFragment = `
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform float uSpread;
  varying vec2 vUv;

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
    v += noise(p * 1.0) * 0.5;
    v += noise(p * 2.0) * 0.25;
    v += noise(p * 4.0) * 0.125;
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);
    float noiseValue = fbm(centeredUv * 12.0) * uSpread;
    float edge = (uv.y + 0.6) - (uProgress * 2.8);
    float d = edge - noiseValue;
    float pixelSize = 2.0 / uResolution.y;
    float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export default function HeroSection() {
  const container = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);

  useGSAP(() => {
    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      alpha: true,
      antialias: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uColor: { value: new THREE.Color('#020205') },
        uSpread: { value: 0.8 }
      },
      vertexShader: heroVertex,
      fragmentShader: heroFragment,
      transparent: true,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    const render = () => renderer.render(scene, camera);

    // --- SCROLL ANIMATION (Bez pustego miejsca) ---
    ScrollTrigger.create({
      trigger: container.current,
      start: "top top",
      end: "bottom top", // Animacja trwa podczas scrollowania przez 100vh
      scrub: true,
      onUpdate: (self) => {
        material.uniforms.uProgress.value = self.progress;
        render();
      }
    });

    // --- NEON LOGO LOOP ---
    const neonTl = gsap.timeline({ repeat: -1, repeatDelay: 4 });
    neonTl
      .to(logoRef.current, { color: "#bc13fe", textShadow: "0 0 15px rgba(188, 19, 254, 0.9)", duration: 0.05 })
      .to(logoRef.current, { opacity: 0.2, duration: 0.03 }).to(logoRef.current, { opacity: 1, duration: 0.03 })
      .to(logoRef.current, { textShadow: "0 0 30px rgba(188, 19, 254, 1)", duration: 0.1 })
      .to(logoRef.current, { color: "#ffffff", textShadow: "0 0 0px rgba(188, 19, 254, 0)", duration: 1, delay: 2 });

    // Initial Reveal
    gsap.from(".animate-reveal", {
      y: 30,
      opacity: 0,
      duration: 1.2,
      stagger: 0.1,
      ease: "power4.out"
    });

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      render();
    };

    window.addEventListener('resize', handleResize);
    render();

    return () => window.removeEventListener('resize', handleResize);
  }, { scope: container });

  return (
    <main 
      ref={container} 
      className="relative w-full bg-[#020205] text-white overflow-hidden"
      style={{ height: '100vh' }} // Tylko 100vh - kolejna sekcja będzie zaraz pod
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-40 pointer-events-none w-full h-full" />

      <div className="relative h-full w-full overflow-hidden">
        {/* Statyczne Tło */}
        <div className="absolute inset-0 z-0">
          <Image src={studioBg} alt="Background" fill className="object-cover brightness-[0.6]" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020205] via-transparent to-[#020205] opacity-80" />
        </div>

        {/* Content */}
        <section className="relative z-30 flex h-full flex-col justify-between px-8 py-12 md:px-16 md:py-20">
          <header className="flex justify-between items-start w-full mix-blend-difference">
            <div className="animate-reveal">
              <h1 ref={logoRef} className="text-2xl font-black uppercase tracking-tighter">Futura</h1>
              <p className="text-[10px] uppercase tracking-widest text-white/40">Creative Lab</p>
            </div>
            <div className="animate-reveal hidden md:block text-right font-mono text-[10px] text-white/30 uppercase tracking-widest">
              Status: Active<br/>v.2.0.26
            </div>
          </header>

          <div className="max-w-4xl">
            <h2 className="animate-reveal text-[12vw] font-bold leading-[0.8] uppercase tracking-tighter md:text-[9vw]">
              Studio <br />
              <span className="text-[#bc13fe] italic">Muzyczne</span>
            </h2>
          </div>

          <div className="flex justify-between items-end w-full">
            <div className="animate-reveal hidden md:block max-w-xs">
              <p className="text-[9px] uppercase tracking-widest text-white/40 leading-relaxed">
                Exploring the boundaries between physical matter and digital code.
              </p>
            </div>
            <div className="animate-reveal absolute left-1/2 bottom-0 -translate-x-1/2 flex flex-col items-center gap-4">
              {/* ml-[0.4em] koryguje optyczny środek przy dużym trackingu */}
              <span className="text-[9px] uppercase tracking-[0.4em] text-white/30 ml-[0.4em]">
                Scroll
              </span>
              <div className="h-12 w-[1px] bg-gradient-to-b from-[#bc13fe] to-transparent" />
            </div>
            <div className="animate-reveal text-right font-mono text-[10px] text-white/20">
              52.2297° N<br/>21.0122° E
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        body { background-color: #020205; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #020205; }
        ::-webkit-scrollbar-thumb { background: #bc13fe; }
      `}</style>
    </main>
  );
}