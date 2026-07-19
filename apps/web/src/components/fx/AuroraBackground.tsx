'use client';

import { useEffect, useRef } from 'react';

/**
 * Site-wide living flow background — a real-time WebGL domain-warped noise
 * field in the brand emerald/teal, replacing the old MP4 video (which was
 * hidden under prefers-reduced-motion — the reason desktops with the OS
 * "reduce motion" setting only ever saw the static poster). Per the owner's
 * requirement the flow runs on every device, so this deliberately does not
 * gate on prefers-reduced-motion. Colors are read from the theme CSS
 * variables so the field adapts automatically if the theme changes. Falls
 * back to an animated CSS gradient when WebGL is unavailable.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uBg;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uIce;
uniform vec3 uLime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  uv.x *= uRes.x / uRes.y;
  float t = uTime * 0.075;

  vec2 q = vec2(fbm(uv * 1.25 + t), fbm(uv * 1.25 - t * 0.7 + 4.2));
  vec2 r = vec2(
    fbm(uv * 1.55 + q * 1.8 + vec2(1.7, 9.2) + t * 0.55),
    fbm(uv * 1.55 + q * 1.8 + vec2(8.3, 2.8) - t * 0.4)
  );
  float f = fbm(uv * 1.85 + r * 2.1);

  float lum = dot(uBg, vec3(0.299, 0.587, 0.114));
  float ribbon = 0.5 + 0.5 * sin((uv.x * 0.62 + uv.y * 0.18 + r.y * 0.82 - f * 0.7 + t * 0.9) * 6.28318);
  ribbon = smoothstep(0.26, 0.88, ribbon);

  vec3 flow = mix(uC2, uC1, smoothstep(0.16, 0.9, f));
  flow = mix(flow, uIce, 0.22 + 0.24 * lum);
  flow = mix(flow, uIce, 0.18 * ribbon);
  flow = mix(flow, uLime, 0.16 * smoothstep(0.78, 1.0, r.x));

  float strength = mix(0.68, 0.52, smoothstep(0.2, 0.9, lum));
  float mask = smoothstep(0.18, 0.95, f) * (0.45 + 0.55 * smoothstep(0.0, 0.85, q.x));

  vec3 col = mix(uBg, flow, strength * (0.2 + 0.8 * mask));
  gl_FragColor = vec4(col, 1.0);
}`;

const FLOW_VARS = ['--color-bg', '--flow-emerald', '--flow-teal', '--aurora-ice', '--aurora-lime'] as const;
const UNIFORM_NAMES = ['uBg', 'uC1', 'uC2', 'uIce', 'uLime'] as const;

function cssColorToRgb(value: string): [number, number, number] {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = v.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return [0.93, 0.96, 0.95];
}

export function AuroraBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // A fresh canvas per mount: reusing one canvas after loseContext() would
    // hand back the dead context on remount (React StrictMode double-mounts).
    const canvas = document.createElement('canvas');
    canvas.className = 'site-flow-canvas';
    const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false });
    if (!gl) return;
    mount.appendChild(canvas);

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      mount.removeChild(canvas);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'uTime');
    const uRes = gl.getUniformLocation(program, 'uRes');

    const applyThemeColors = () => {
      const styles = getComputedStyle(document.documentElement);
      FLOW_VARS.forEach((cssVar, index) => {
        const rgb = cssColorToRgb(styles.getPropertyValue(cssVar));
        gl.uniform3fv(gl.getUniformLocation(program, UNIFORM_NAMES[index]), rgb);
      });
    };
    applyThemeColors();

    // Re-read theme colors when the theme flips (class/data-theme) or the OS scheme changes.
    const themeObserver = new MutationObserver(applyThemeColors);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const schemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    schemeMedia.addEventListener?.('change', applyThemeColors);

    // The field is soft by nature — render at reduced resolution for 60fps everywhere.
    const RES_SCALE = 0.45;
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * RES_SCALE));
      const h = Math.max(1, Math.round(canvas.clientHeight * RES_SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden) return;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Fade in only once real frames exist — never show an undrawn buffer.
      canvas.classList.add('is-live');
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      schemeMedia.removeEventListener?.('change', applyThemeColors);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (canvas.parentElement === mount) mount.removeChild(canvas);
    };
  }, []);

  return (
    <div ref={mountRef} className="site-aurora" aria-hidden="true">
      <div className="site-flow-fallback" />
    </div>
  );
}
