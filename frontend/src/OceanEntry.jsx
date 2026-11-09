import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWave;

  float waveHeight(vec2 p, float t) {
    float swell = sin(dot(p, vec2(0.095, 0.17)) + t * 0.46) * 0.42;
    float crossSwell = sin(dot(p, vec2(-0.17, 0.085)) - t * 0.34) * 0.24;
    float rollingWave = cos(dot(p, vec2(0.11, -0.21)) + t * 0.29) * 0.14;
    float ripple = sin(p.x * 0.78 + p.y * 0.34 + t * 0.88) * 0.075;
    float crossRipple = sin(p.x * 1.22 - p.y * 0.48 - t * 0.72) * 0.038;
    return swell + crossSwell + rollingWave + ripple + crossRipple;
  }

  void main() {
    vec3 displaced = position;
    float t = uTime;
    displaced.z = waveHeight(position.xy, t);

    float epsilon = 0.12;
    float dx = waveHeight(position.xy + vec2(epsilon, 0.0), t) - displaced.z;
    float dy = waveHeight(position.xy + vec2(0.0, epsilon), t) - displaced.z;
    vec3 surfaceNormal = normalize(vec3(-dx / epsilon, -dy / epsilon, 1.0));

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * surfaceNormal);
    vWave = displaced.z;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uCameraPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWave;

  void main() {
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
    float depth = smoothstep(-2.0, 1.2, vWorldPosition.y + vWave * 0.32);

    vec3 deepWater = vec3(0.018, 0.075, 0.13);
    vec3 blueWater = vec3(0.035, 0.25, 0.35);
    vec3 lightWater = vec3(0.16, 0.5, 0.54);
    float distanceMix = smoothstep(-48.0, 10.0, vWorldPosition.z);
    vec3 color = mix(deepWater, blueWater, distanceMix * 0.68 + depth * 0.22 + 0.12);

    vec3 lightDirection = normalize(vec3(-0.42, 0.72, 0.56));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float specular = pow(max(dot(normal, halfDirection), 0.0), 42.0);
    float shimmerA = sin(dot(vWorldPosition.xz, vec2(0.24, 0.12)) + uTime * 0.24);
    float shimmerB = sin(dot(vWorldPosition.xz, vec2(-0.15, 0.21)) - uTime * 0.18);
    float shimmer = pow(max(shimmerA * shimmerB, 0.0), 5.0);
    float reflection = specular * 0.34 + shimmer * smoothstep(0.12, 0.92, diffuse) * 0.12;
    float crest = smoothstep(0.34, 0.62, vWave) * smoothstep(0.08, 0.35, length(normal.xz));

    color = mix(color, lightWater, fresnel * 0.76);
    color += vec3(0.7, 0.87, 0.82) * reflection;
    color += vec3(0.04, 0.12, 0.15) * diffuse;
    color = mix(color, vec3(0.42, 0.68, 0.68), crest * 0.2);

    float horizonFade = smoothstep(-52.0, -17.0, vWorldPosition.z);
    color = mix(vec3(0.07, 0.16, 0.2), color, horizonFade);
    gl_FragColor = vec4(color, 0.97);
  }
`;

function createBubbles() {
  return Array.from({ length: 14 }, (_, index) => ({
    left: `${8 + ((index * 37) % 87)}%`,
    delay: `${-((index * 2.3) % 14)}s`,
    duration: `${12 + ((index * 13) % 10)}s`,
    size: `${3 + ((index * 7) % 7)}px`,
  }));
}

const bubbles = createBubbles();

export default function OceanEntry({ onComplete }) {
  const canvasRef = useRef(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 850 : 4300;
    const startedAt = performance.now();
    let frame = 0;
    let renderer;
    let material;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 120);
      camera.position.set(0, 7.8, 15);
      camera.lookAt(0, 0, -1.5);

      material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uCameraPosition: { value: camera.position.clone() },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
      });

      const ocean = new THREE.Mesh(new THREE.PlaneGeometry(140, 200, 220, 260), material);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.set(0, -1.55, -80);
      scene.add(ocean);

      const starPositions = [];
      for (let index = 0; index < 180; index += 1) {
        starPositions.push(
          (Math.random() - 0.5) * 55,
          4 + Math.random() * 18,
          -10 - Math.random() * 48,
        );
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
      const starMaterial = new THREE.PointsMaterial({
        color: 0x9de8ef,
        size: 0.045,
        transparent: true,
        opacity: 0.58,
        sizeAttenuation: true,
      });
      scene.add(new THREE.Points(starGeometry, starMaterial));

      const resize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight, false);
      };
      window.addEventListener("resize", resize);

      const render = (now) => {
        const elapsed = (now - startedAt) / 1000;
        const dive = reducedMotion ? 0 : THREE.MathUtils.smoothstep(elapsed, 0.35, 3.35);
        material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
        camera.position.y = THREE.MathUtils.lerp(7.2, 4.15, dive);
        camera.position.z = THREE.MathUtils.lerp(15.8, 11.4, dive);
        camera.position.x = Math.sin(elapsed * 0.27) * 0.22;
        camera.lookAt(0, -0.35 - dive * 0.9, -1.5);
        material.uniforms.uCameraPosition.value.copy(camera.position);

        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };
      frame = window.requestAnimationFrame(render);

      const leaveTimer = window.setTimeout(() => setLeaving(true), duration - 600);
      const completeTimer = window.setTimeout(onComplete, duration);

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(leaveTimer);
        window.clearTimeout(completeTimer);
        window.removeEventListener("resize", resize);
        ocean.geometry.dispose();
        material.dispose();
        starGeometry.dispose();
        starMaterial.dispose();
        renderer.dispose();
      };
    } catch (error) {
      console.error("Could not initialize the ocean entry animation.", error);
      const fallbackTimer = window.setTimeout(onComplete, reducedMotion ? 250 : 1800);
      return () => window.clearTimeout(fallbackTimer);
    }
  }, [onComplete]);

  return (
    <div aria-label="Opening your Taskflow workspace" className={`ocean-entry ${leaving ? "ocean-entry-leaving" : ""}`} role="status">
      <canvas aria-hidden="true" className="ocean-entry-canvas" ref={canvasRef} />
      <div aria-hidden="true" className="ocean-entry-atmosphere" />
      <div aria-hidden="true" className="ocean-entry-bubbles">
        {bubbles.map((bubble, index) => (
          <span key={index} style={{
            "--bubble-left": bubble.left,
            "--bubble-delay": bubble.delay,
            "--bubble-duration": bubble.duration,
            "--bubble-size": bubble.size,
          }} />
        ))}
      </div>
      <div aria-hidden="true" className="ocean-entry-logo">
        <span className="ocean-entry-logo-orbit">
          <span className="ocean-entry-logo-icon">t</span>
          <span className="ocean-entry-logo-wordmark">taskflow</span>
        </span>
      </div>
      <div className="ocean-entry-content">
        <div className="ocean-entry-kicker"><span /> TASKFLOW <span className="ocean-entry-divider">/</span> PROJECT SPACE</div>
        <h1>Make waves<br /><span>together.</span></h1>
        <p>Your workspace is ready.</p>
        <div className="ocean-entry-progress"><span /></div>
        <small>SYNCING YOUR TEAM</small>
      </div>
      <div aria-hidden="true" className="ocean-entry-coordinate">N 37° 48' · OPEN WATER</div>
      <div aria-hidden="true" className="ocean-entry-mark">t</div>
    </div>
  );
}
