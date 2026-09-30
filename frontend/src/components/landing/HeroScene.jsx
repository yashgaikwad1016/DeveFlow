import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Helper to test WebGL availability safely
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Generates dynamic crisp canvas textures for the 3D cards
function createCardTexture({ title, tag, tagColor, subtitle, metric, points, avatarText, progress }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  // Background Glass Card
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 300, 24);
  ctx.fill();

  // Card Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Top Accent Stripe
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(0.5, '#7c3aed');
  grad.addColorStop(1, '#db2777');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 8, [24, 24, 0, 0]);
  ctx.fill();

  // Tag Badge
  ctx.fillStyle = tagColor || 'rgba(99, 102, 241, 0.2)';
  ctx.beginPath();
  ctx.roundRect(32, 36, 120, 36, 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(tag, 46, 60);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(title, 32, 116);

  // Subtitle
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(subtitle, 32, 148);

  // Progress Bar if present
  if (typeof progress === 'number') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(32, 185, 448, 12, 6);
    ctx.fill();

    const pGrad = ctx.createLinearGradient(32, 0, 32 + (448 * progress) / 100, 0);
    pGrad.addColorStop(0, '#10b981');
    pGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(32, 185, (448 * progress) / 100, 12, 6);
    ctx.fill();
  }

  // Footer Row
  if (avatarText) {
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.arc(54, 246, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(avatarText, 54, 252);
    ctx.textAlign = 'left';
  }

  // Metric Text
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(metric || '', 92, 252);

  // Points / Badge
  if (points) {
    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(points, 480, 252);
    ctx.textAlign = 'left';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export default function HeroScene() {
  const containerRef = useRef(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const supported = checkWebGLSupport();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setHasWebGL(supported);
    setIsReducedMotion(reduced);

    if (!supported || reduced || !containerRef.current) return;

    const container = containerRef.current;
    let width = container.clientWidth || 580;
    let height = container.clientHeight || 520;
    const isMobile = window.innerWidth < 768;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 11);

    // 2. High-Performance Renderer with Device-Aware Pixel Ratio
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Optimized Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x818cf8, 2.5);
    dirLight.position.set(5, 8, 8);
    scene.add(dirLight);

    const accentLight = new THREE.PointLight(0xec4899, 2.2, 25);
    accentLight.position.set(-6, -4, 4);
    scene.add(accentLight);

    const cursorLight = new THREE.PointLight(0x6366f1, 2.8, 18);
    scene.add(cursorLight);

    // 4. Pivot Group
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 5. High-Performance MeshStandardMaterial Cards with FrontSide Culling
    const cardGeom = new THREE.PlaneGeometry(3.6, 2.1);
    const cardMeshes = [];

    // Card 1: Active Sprint (Center Front)
    const tex1 = createCardTexture({
      tag: 'ACTIVE SPRINT',
      tagColor: 'rgba(16, 185, 129, 0.3)',
      title: 'Sprint 04 • Cloud Core',
      subtitle: 'Target: Deploy Auth & RBAC sync',
      metric: '24 Tasks Assigned',
      points: '34 Story Pts',
      avatarText: 'SC',
      progress: 72,
    });
    const mat1 = new THREE.MeshStandardMaterial({
      map: tex1,
      transparent: true,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const card1 = new THREE.Mesh(cardGeom, mat1);
    card1.position.set(-0.6, 0.2, 1.2);
    card1.rotation.set(-0.06, 0.12, 0.02);
    mainGroup.add(card1);
    cardMeshes.push({ mesh: card1, basePos: { x: -0.6, y: 0.2, z: 1.2 }, speed: 1.2, amp: 0.12, phase: 0 });

    // Card 2: AI Velocity Insights (Top Right)
    const tex2 = createCardTexture({
      tag: 'AI INSIGHTS',
      tagColor: 'rgba(139, 92, 246, 0.35)',
      title: 'Velocity Forecast',
      subtitle: '94% On-Track to milestone',
      metric: 'Zero Bottleneck Risk',
      points: 'AI Score: 98',
      avatarText: 'AI',
      progress: 94,
    });
    const mat2 = new THREE.MeshStandardMaterial({
      map: tex2,
      transparent: true,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const card2 = new THREE.Mesh(cardGeom, mat2);
    card2.position.set(2.4, 1.7, -0.6);
    card2.rotation.set(0.08, -0.22, -0.04);
    card2.scale.set(0.9, 0.9, 0.9);
    mainGroup.add(card2);
    cardMeshes.push({ mesh: card2, basePos: { x: 2.4, y: 1.7, z: -0.6 }, speed: 1.0, amp: 0.15, phase: 1.8 });

    // Card 3: Kanban Task Card (Bottom Right)
    const tex3 = createCardTexture({
      tag: 'TASK • IN PROGRESS',
      tagColor: 'rgba(59, 130, 246, 0.35)',
      title: 'Real-time Kanban Board',
      subtitle: 'Multi-status drag & drop workflow',
      metric: 'Assignee: Alex Dev',
      points: '5 Pts • High',
      avatarText: 'AD',
      progress: 55,
    });
    const mat3 = new THREE.MeshStandardMaterial({
      map: tex3,
      transparent: true,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const card3 = new THREE.Mesh(cardGeom, mat3);
    card3.position.set(1.9, -1.8, 0.2);
    card3.rotation.set(-0.04, -0.15, 0.05);
    card3.scale.set(0.92, 0.92, 0.92);
    mainGroup.add(card3);
    cardMeshes.push({ mesh: card3, basePos: { x: 1.9, y: -1.8, z: 0.2 }, speed: 1.4, amp: 0.14, phase: 3.2 });

    // Card 4: Issue Tracker (Left Lower)
    const tex4 = createCardTexture({
      tag: 'ISSUE RESOLVED',
      tagColor: 'rgba(16, 185, 129, 0.35)',
      title: 'Defect #42: CORS Gateway',
      subtitle: 'Strict origin sanitization verified',
      metric: 'Severity: High',
      points: 'Status: Closed',
      avatarText: 'YG',
      progress: 100,
    });
    const mat4 = new THREE.MeshStandardMaterial({
      map: tex4,
      transparent: true,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const card4 = new THREE.Mesh(cardGeom, mat4);
    card4.position.set(-2.6, -1.4, -0.8);
    card4.rotation.set(0.12, 0.25, -0.06);
    card4.scale.set(0.85, 0.85, 0.85);
    mainGroup.add(card4);
    cardMeshes.push({ mesh: card4, basePos: { x: -2.6, y: -1.4, z: -0.8 }, speed: 1.1, amp: 0.13, phase: 4.5 });

    // Mobile scale adjustment
    if (isMobile) {
      mainGroup.scale.set(0.78, 0.78, 0.78);
    }

    // 6. Connecting Workflow Splines
    const curvePoints = [
      new THREE.Vector3(-2.6, -1.4, -0.8),
      new THREE.Vector3(-0.6, 0.2, 1.2),
      new THREE.Vector3(2.4, 1.7, -0.6),
      new THREE.Vector3(1.9, -1.8, 0.2),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    const tubeGeom = new THREE.TubeGeometry(curve, 50, 0.032, 6, true);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.45,
    });
    const splineTube = new THREE.Mesh(tubeGeom, tubeMat);
    mainGroup.add(splineTube);

    // Glowing Pulse Nodes
    const pulseSpheres = [];
    const pulseGeom = new THREE.SphereGeometry(0.11, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    for (let i = 0; i < 4; i++) {
      const pMesh = new THREE.Mesh(pulseGeom, pulseMat);
      mainGroup.add(pMesh);
      pulseSpheres.push({ mesh: pMesh, offset: i * 0.25 });
    }

    // 7. Ambient Geometric Milestone Spheres
    const polyGroup = new THREE.Group();
    const icoGeom = new THREE.IcosahedronGeometry(0.42, 0);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.3,
      metalness: 0.6,
      wireframe: true,
    });
    const ico1 = new THREE.Mesh(icoGeom, icoMat);
    ico1.position.set(-2.8, 2.2, -1.2);
    polyGroup.add(ico1);

    const octGeom = new THREE.OctahedronGeometry(0.32, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.3,
      metalness: 0.6,
      wireframe: true,
    });
    const oct1 = new THREE.Mesh(octGeom, octMat);
    oct1.position.set(3.4, -0.4, 0.8);
    polyGroup.add(oct1);
    mainGroup.add(polyGroup);

    // 8. Device-Adapted Particle Field
    const particleCount = isMobile ? 50 : 100;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 16;
      particlePositions[i + 1] = (Math.random() - 0.5) * 12;
      particlePositions[i + 2] = (Math.random() - 0.5) * 10;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xa5b4fc,
      size: 0.05,
      transparent: true,
      opacity: 0.55,
    });
    const particleSystem = new THREE.Points(particleGeom, particleMat);
    scene.add(particleSystem);

    // 9. Reusable Scratch Vector (ZERO ALLOCATIONS IN ANIMATION LOOP)
    const tempSplineVec = new THREE.Vector3();

    // 10. Mouse Tracking (Only sets target coordinates)
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX = (x / rect.width - 0.5) * 2;
      mouseY = -(y / rect.height - 0.5) * 2;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // 11. Intersection Observer & Visibility Optimization (Pause when off-screen)
    let isVisible = true;
    let isTabActive = true;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 12. Animation Loop
    let animationId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Skip render passes completely when scrolled off-screen or tab is hidden
      if (!isVisible || !isTabActive) return;

      const elapsedTime = clock.getElapsedTime();

      // Smooth camera / group rotation via Lerp
      targetX += (mouseX * 0.28 - targetX) * 0.05;
      targetY += (mouseY * 0.22 - targetY) * 0.05;

      mainGroup.rotation.y = targetX;
      mainGroup.rotation.x = -targetY;

      // Update interactive light position smoothly
      cursorLight.position.set(mouseX * 4, mouseY * 3, 4);

      // Bobbing floating motion for each card
      for (let i = 0; i < cardMeshes.length; i++) {
        const item = cardMeshes[i];
        const floatY = Math.sin(elapsedTime * item.speed + item.phase) * item.amp;
        const floatRot = Math.cos(elapsedTime * item.speed * 0.8 + item.phase) * 0.02;
        item.mesh.position.y = item.basePos.y + floatY;
        item.mesh.rotation.z = floatRot;
      }

      // Move pulse beads along the spline curve with ZERO object allocation
      for (let i = 0; i < pulseSpheres.length; i++) {
        const p = pulseSpheres[i];
        const t = (elapsedTime * 0.18 + p.offset) % 1;
        curve.getPointAt(t, tempSplineVec);
        p.mesh.position.copy(tempSplineVec);
      }

      // Rotating polyhedra
      ico1.rotation.x += 0.008;
      ico1.rotation.y += 0.012;
      oct1.rotation.y -= 0.01;
      oct1.rotation.z += 0.007;

      // Particle subtle drift
      particleSystem.rotation.y = elapsedTime * 0.015;

      renderer.render(scene, camera);
    };

    animate();

    // 13. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          camera.aspect = cr.width / cr.height;
          camera.updateProjectionMatrix();
          renderer.setSize(cr.width, cr.height);
        }
      }
    });
    resizeObserver.observe(container);

    // 14. Cleanup
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      cardGeom.dispose();
      tubeGeom.dispose();
      tubeMat.dispose();
      pulseGeom.dispose();
      pulseMat.dispose();
      icoGeom.dispose();
      icoMat.dispose();
      octGeom.dispose();
      octMat.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      [tex1, tex2, tex3, tex4].forEach((t) => t.dispose());
      [mat1, mat2, mat3, mat4].forEach((m) => m.dispose());
    };
  }, []);

  // Graceful Fallback if WebGL unavailable or user prefers reduced motion
  if (!hasWebGL || isReducedMotion) {
    return (
      <div className="hero-fallback-cards">
        <div className="fallback-card fallback-card-1">
          <div className="badge b-In-Progress" style={{ marginBottom: 10 }}>Active Sprint</div>
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>Sprint 04 • Cloud Core</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Target: Deploy Auth & RBAC sync</p>
          <div className="prog-row">
            <div className="progress">
              <div style={{ width: '72%' }}></div>
            </div>
            <span>72%</span>
          </div>
        </div>

        <div className="fallback-card fallback-card-2">
          <div className="badge b-High" style={{ marginBottom: 10 }}>AI Insight</div>
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>94% Velocity Confidence</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No bottleneck risk detected across 24 tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-3d-container" ref={containerRef}>
      <div className="hero-3d-overlay-badge">
        <span>Interactive 3D Workspace • Move Cursor</span>
      </div>
    </div>
  );
}
