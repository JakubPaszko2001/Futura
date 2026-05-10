"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const WAVE_CONFIG = {
  pointsCount: 200,
  width: 20,
  waves: [
    { color: 0x8000ff, freq: 0.8, phaseOffset: 0,   ampMult: 1.0, opacity: 0.9 },
    { color: 0x9632ff, freq: 1.2, phaseOffset: 1.5, ampMult: 0.7, opacity: 0.5 },
    { color: 0xc896ff, freq: 2.0, phaseOffset: 3.0, ampMult: 0.4, opacity: 0.3 },
  ],
};

const WaveSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLHeadingElement>(null);
  const text2Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!containerRef.current || !sectionRef.current) return;
    const container = containerRef.current;

    // ── Three.js scene ─────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const waveState = { amplitude: 0, phase: 0 };

    const lines = WAVE_CONFIG.waves.map((w) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(WAVE_CONFIG.pointsCount * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: w.color,
        transparent: true,
        opacity: w.opacity,
      });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      return { ...w, line, geometry, positions };
    });

    const updateWaves = () => {
      lines.forEach((w) => {
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

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      waveState.phase += 0.02;
      updateWaves();
      renderer.render(scene, camera);
    };
    animate();

    // ── Velocity-driven amplitude (port from fala2.html) ───────────────
    const velocityTrigger = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const velocity = Math.abs(self.getVelocity() / 10);
        gsap.to(waveState, {
          amplitude: Math.min(velocity, 100),
          duration: 0.3,
          overwrite: true,
        });
        gsap.to(waveState, {
          amplitude: 0,
          duration: 2.5,
          delay: 0.1,
          ease: 'power2.out',
          overwrite: false,
        });
      },
    });

    // ── Text reveal ────────────────────────────────────────────────────
    const w1 = Array.from(text1Ref.current?.querySelectorAll<HTMLElement>('.word') ?? []);
    const w2 = Array.from(text2Ref.current?.querySelectorAll<HTMLElement>('.word') ?? []);

    gsap.set([...w1, ...w2], {
      yPercent: 115,
      skewY: 6,
      filter: 'blur(8px)',
    });

    const revealTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top bottom',
        end: 'top top+=10%',
        scrub: 1,
      },
    });

    revealTl
      .to(w1, {
        yPercent: 0,
        skewY: 0,
        filter: 'blur(0px)',
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
      })
      .to(w2, {
        yPercent: 0,
        skewY: 0,
        filter: 'blur(0px)',
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
      }, '+=0.3');

    // ── Resize ─────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      velocityTrigger.kill();
      revealTl.scrollTrigger?.kill();
      revealTl.kill();
      ro.disconnect();
      lines.forEach((l) => {
        l.geometry.dispose();
        (l.line.material as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full bg-black overflow-hidden"
    >
      <div ref={containerRef} className="absolute inset-0" />

      <h2
        ref={text1Ref}
        className="absolute top-12 left-8 md:top-20 md:left-20 z-[10] text-[#8000ff] text-[34px] md:text-[56px] font-black uppercase tracking-tighter pointer-events-none select-none flex gap-x-3 will-change-transform"
      >
        {['USŁYSZ', 'WIĘCEJ', 'SIEBIE'].map((word) => (
          <span key={word} className="overflow-hidden pb-[0.12em]">
            <span className="word inline-block will-change-transform">{word}</span>
          </span>
        ))}
      </h2>

      <h2
        ref={text2Ref}
        className="absolute bottom-12 right-8 md:bottom-20 md:right-20 z-[10] text-[#8000ff] text-[34px] md:text-[56px] font-black uppercase tracking-tighter pointer-events-none select-none flex gap-x-3 will-change-transform"
      >
        {['POCZUJ', 'KAŻDY', 'TON'].map((word) => (
          <span key={word} className="overflow-hidden pb-[0.12em]">
            <span className="word inline-block will-change-transform">{word}</span>
          </span>
        ))}
      </h2>
    </section>
  );
};

export default WaveSection;
