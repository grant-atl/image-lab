export const EFFECTS = [
  { id: 'pixel-mosaic', name: 'Pixel mosaic', description: 'Pixels take on image colors, then resolve into detail.', category: 'Pixel' },
  { id: 'noise-dissolve', name: 'Noise dissolve', description: 'Fine grain thins as the image develops.', category: 'Pixel' },
  { id: 'liquid-metal', name: 'Liquid metal', description: 'A chromatic border fades as the image appears.', category: 'Organic' },
  { id: 'frosted-glass', name: 'Frosted glass', description: 'A textured glass surface clears into the image.', category: 'Organic' },
  { id: 'dot-matrix', name: 'Dot matrix', description: 'Dots expand and join to fill the image.', category: 'Pixel' },
  { id: 'heat-haze', name: 'Heat haze', description: 'Soft refraction settles as the image appears.', category: 'Organic' },
  { id: 'satin', name: 'Satin', description: 'Soft folds give way to the image.', category: 'Organic' },
  { id: 'exposure', name: 'Exposure', description: 'The image develops from a field of fine grain.', category: 'Pixel' },
  { id: 'woven', name: 'Woven', description: 'Fine woven threads fade into the image.', category: 'Geometric' },
  { id: 'voronoi', name: 'Cellular', description: 'Moving cells fill with pieces of the image.', category: 'Organic' },
  { id: 'blur', name: 'Soft focus', description: 'A diffuse image gradually comes into focus.', category: 'Organic' },
  { id: 'brushed-metal', name: 'Brushed metal', description: 'Brushed silver fades into the image.', category: 'Geometric' },
] as const satisfies readonly { id: string; name: string; description: string; category: 'Pixel' | 'Organic' | 'Geometric' }[]

export type EffectId = (typeof EFFECTS)[number]['id']

export function getAnimationSpeed(speed = 1): number {
  return Number.isFinite(speed) ? Math.max(0, Math.min(3, speed)) : 1
}

/** Seconds in; normalized reveal progress out. The loop includes a loading and hold phase. */
export function getRevealProgress(elapsed: number, duration = 3, loop = false): number {
  const length = Number.isFinite(duration) ? Math.max(0.1, duration) : 3
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  const revealTime = loop ? (time % (length + 2.7)) - 1.2 : time
  return Math.max(0, Math.min(1, revealTime / length))
}

export const REVEAL_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const REVEAL_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec3 uColor;
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform int uEffect;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, -1.2, 1.2, 1.6) * p + 3.7;
    amplitude *= 0.5;
  }
  return value;
}
vec3 photographAt(vec2 uv, float bias) {
  float viewAspect = uResolution.x / uResolution.y;
  float imageAspect = uImageSize.x / uImageSize.y;
  vec2 crop = min(vec2(1.0), vec2(viewAspect / imageAspect, imageAspect / viewAspect));
  return texture2D(uTexture, (uv - 0.5) * crop + 0.5, bias).rgb;
}
vec3 photograph(vec2 uv) { return photographAt(uv, 0.0); }
float ease(float x) { return x * x * (3.0 - 2.0 * x); }
vec3 blurredImage(vec2 uv, float spread) {
  float pixels = spread * uResolution.y;
  if (pixels < 0.5) return photograph(uv);
  float bias = max(0.0, log2(max(pixels, 1.0)) - 0.5);
  vec2 offset = vec2(uResolution.y / uResolution.x, 1.0) * spread * 0.65;
  // Prefiltered mip levels keep a wide blur smooth without repeated image edges.
  vec3 sum = photographAt(uv, bias) * 0.25;
  sum += photographAt(uv + vec2(offset.x, 0.0), bias) * 0.125;
  sum += photographAt(uv - vec2(offset.x, 0.0), bias) * 0.125;
  sum += photographAt(uv + vec2(0.0, offset.y), bias) * 0.125;
  sum += photographAt(uv - vec2(0.0, offset.y), bias) * 0.125;
  sum += photographAt(uv + offset, bias) * 0.0625;
  sum += photographAt(uv - offset, bias) * 0.0625;
  sum += photographAt(uv + vec2(offset.x, -offset.y), bias) * 0.0625;
  sum += photographAt(uv + vec2(-offset.x, offset.y), bias) * 0.0625;
  return sum;
}
float materialSquare(float value) { return value * value; }
float studioCard(vec2 position, vec2 center, vec2 size, float softness) {
  vec2 edge = abs(position - center) - size;
  float distanceToCard = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0);
  return 1.0 - smoothstep(-softness, softness, distanceToCard);
}
vec3 studioMetal(vec3 normal, float roughness) {
  vec3 reflection = reflect(vec3(0.0, 0.0, -1.0), normal);
  vec2 environment = reflection.xy / max(0.4, 1.0 + reflection.z);
  float key = studioCard(environment, vec2(-0.46, 0.14), vec2(0.15, 0.82), roughness);
  float fill = studioCard(environment, vec2(0.56, -0.24), vec2(0.27, 0.46), roughness * 2.0);
  float ceiling = exp(-materialSquare((environment.y - 0.63) / (0.14 + roughness)));
  float room = 0.045 + 0.12 * smoothstep(-0.8, 0.9, reflection.y);
  vec3 silver = vec3(room + key * 0.92 + fill * 0.48 + ceiling * 0.28);
  return clamp(silver * mix(vec3(1.0), uColor, 0.035), 0.0, 1.0);
}
vec3 palette(float n) {
  vec3 charcoal = vec3(0.045, 0.051, 0.048);
  vec3 silver = vec3(0.39, 0.42, 0.39);
  return mix(mix(charcoal, silver, n * n * 0.8), uColor, smoothstep(0.76, 1.0, n) * 0.67);
}
void main() {
  vec2 uv = vUv;
  float p = clamp(uProgress, 0.0, 1.0);
  float t = uTime;
  float strength = clamp(uIntensity, 0.0, 1.0);
  float aspect = uResolution.x / uResolution.y;
  vec2 point = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 original = photograph(uv);
  vec3 revealed = original;
  vec3 waiting = vec3(0.06);
  float mask = 0.0;

  if (uEffect == 0) {
    float count = mix(80.0, 44.0, strength);
    vec2 grid = vec2(count * aspect, count);
    vec2 cell = floor(uv * grid);
    float seed = hash(cell);
    float phase = t * 1.1 + seed * 4.0;
    float churn = mix(hash(cell + floor(phase) * vec2(3.7, 1.3)),
                      hash(cell + (floor(phase) + 1.0) * vec2(3.7, 1.3)),
                      smoothstep(0.1, 0.9, fract(phase)));
    float field = noise(cell * 0.12 + vec2(t * 0.15, -t * 0.1));
    float tone = churn * 0.6 + field * 0.4;
    vec2 local = fract(uv * grid);
    float edge = smoothstep(0.005, 0.025, min(min(local.x, local.y), min(1.0-local.x, 1.0-local.y)));
    waiting = mix(vec3(0.045, 0.054, 0.046), vec3(0.44, 0.48, 0.41), tone * tone);
    waiting = mix(waiting, uColor * 0.66, smoothstep(0.69, 0.94, tone) * 0.68);
    waiting *= mix(0.72, 1.0, edge);
    vec2 pixelUv = (cell + 0.5) / grid;
    vec3 pixelColor = photograph(pixelUv);
    float arrival = seed * 0.65 + noise(cell * 0.13) * 0.35;
    float colorize = smoothstep(arrival * 0.28, arrival * 0.28 + 0.32, p);
    waiting = mix(waiting, pixelColor * mix(0.88, 1.0, edge), colorize);
    revealed = original;
    mask = smoothstep(0.5, 1.0, p);
  } else if (uEffect == 1) {
    vec2 grainCell = floor(uv * uResolution / mix(1.0, 1.65, strength));
    float fixedGrain = hash(grainCell);
    float grain = mix(hash(grainCell + floor(t * 4.0)), hash(grainCell + floor(t * 4.0) + 1.0), ease(fract(t * 4.0)));
    float cloud = fbm(point * 2.3 + vec2(t * 0.045, -t * 0.025));
    waiting = vec3(0.07 + cloud * 0.12 + (grain - 0.5) * 0.07);
    waiting *= mix(vec3(1.0), uColor, 0.035);
    float threshold = fixedGrain * 0.76 + noise(point * 3.0) * 0.24;
    mask = smoothstep(threshold - 0.18, threshold + 0.18, ease(p) * 1.36 - 0.18);
    revealed = original + vec3((fixedGrain - 0.5) * 0.045 * (1.0-ease(p)));
  } else if (uEffect == 2) {
    waiting = original;
    mask = 1.0;
  } else if (uEffect == 3) {
    float clear = ease(p);
    float grain = hash(floor(uv * uResolution)) - 0.5;
    float mist = noise(point * 1.7 + vec2(t * 0.045, -t * 0.03));
    float light = exp(-materialSquare(point.x * 0.65 + point.y * 0.9 - sin(t * 0.12) * 0.15) * 3.0);
    waiting = vec3(0.10, 0.115, 0.12) + vec3(0.22) * light + vec3(mist * 0.13 + grain * 0.028);
    waiting *= mix(vec3(1.0), uColor, 0.025);
    vec2 refraction = vec2(noise(point * 28.0), noise(point * 28.0 + 8.0)) - 0.5;
    refraction *= vec2(1.0 / aspect, 1.0) * mix(0.01, 0.035, strength) * (1.0-clear);
    revealed = blurredImage(uv + refraction, pow(1.0-clear, 2.0) * mix(0.025, 0.08, strength));
    revealed += vec3(grain * 0.065 * (1.0-clear));
    mask = smoothstep(0.0, 0.78, p);
  } else if (uEffect == 4) {
    float count = mix(38.0, 72.0, strength);
    vec2 grid = vec2(count * aspect, count);
    vec2 cell = floor(uv * grid);
    float seed = hash(cell);
    float d = length(fract(uv * grid) - 0.5);
    float pulse = 0.5 + 0.5 * sin(t * 2.0 + seed * 20.0);
    float dotShape = 1.0 - smoothstep(0.23, 0.29, d);
    waiting = vec3(0.045) + palette(seed * 0.5 + pulse * 0.5) * dotShape;
    float growth = clamp((p - seed * 0.28) / 0.72, 0.0, 1.0);
    mask = 1.0 - smoothstep(growth * 0.78 - 0.04, growth * 0.78 + 0.02, d);
    revealed = photograph(mix((cell + 0.5) / grid, uv, smoothstep(0.3, 0.95, p)));
  } else if (uEffect == 5) {
    float clear = ease(p);
    vec2 flow = point * vec2(2.4, 1.3) + vec2(0.0, -t * 0.09);
    float bend = sin(flow.y * 3.0 + sin(flow.x * 2.0 + t * 0.12));
    float haze = noise(flow + vec2(bend * 0.6, 0.0));
    float light = exp(-materialSquare(point.x + bend * 0.13) * 5.0);
    waiting = vec3(0.075, 0.078, 0.074) + vec3(0.20, 0.20, 0.18) * light + vec3(haze * 0.1);
    waiting *= mix(vec3(1.0), uColor, 0.03);
    vec2 displacement = vec2(bend * 0.7 + haze - 0.5, sin(flow.x * 3.0 + t * 0.13) * 0.3);
    displacement *= vec2(1.0/aspect, 1.0) * mix(0.035, 0.09, strength) * pow(1.0-clear, 2.0);
    revealed = photograph(uv + displacement);
    mask = smoothstep(0.02, 0.85, p);
  } else if (uEffect == 6) {
    vec2 clothUv = mat2(0.966, -0.259, 0.259, 0.966) * point;
    float drift = sin(t * 0.14) * 0.055;
    float foldDistance = clothUv.x + clothUv.y * clothUv.y * 0.22 - 0.065 + drift;
    float fold = exp(-materialSquare(foldDistance / 0.34));
    float valleyDistance = foldDistance + 0.43;
    float valley = exp(-materialSquare(valleyDistance / 0.62));
    float crossSlope = -0.36 * foldDistance / (0.34 * 0.34) * fold
                     + 0.15 * valleyDistance / (0.62 * 0.62) * valley;
    vec2 slope = vec2(crossSlope + clothUv.x * 0.045,
                     crossSlope * clothUv.y * 0.44 + clothUv.y * 0.07 - 0.09);
    float settle = materialSquare(1.0 - ease(p));
    slope *= mix(0.82, 1.18, strength) * mix(0.2, 1.0, settle);
    vec3 normal = normalize(vec3(-slope, 1.0));
    vec3 tangent = normalize(vec3(0.0, 1.0, slope.y));
    vec3 bitangent = normalize(cross(normal, tangent));
    vec3 light = normalize(vec3(-0.5, 0.75, 1.1));
    vec3 halfVector = normalize(light + vec3(0.0, 0.0, 1.0));
    float nDotH = max(dot(normal, halfVector), 0.05);
    float across = dot(halfVector, bitangent) / 0.36;
    float along = dot(halfVector, tangent) / 0.7;
    float sheen = exp(-(across * across + along * along) / (nDotH * nDotH));
    float diffuse = max(dot(normal, light), 0.0);
    float fiberCount = min(uResolution.y * 0.65, 900.0);
    float fiber = noise(vec2(clothUv.x * fiberCount, clothUv.y * 3.0)) - 0.5;
    float occlusion = 0.94 - valley * 0.055;
    float silver = (0.05 + diffuse * 0.075 + sheen * 0.47) * occlusion + fiber * 0.003;
    waiting = vec3(silver) * mix(vec3(1.0), uColor, 0.01);

    // The image takes on the cloth's lighting and relief as the fold relaxes.
    vec2 displacement = normal.xy / vec2(aspect, 1.0) * 0.14 * strength * settle;
    float clothLight = mix(0.52 + diffuse * 0.48, 1.0, ease(p));
    revealed = photograph(uv + displacement) * clothLight + vec3(sheen * 0.2 * settle);
    mask = smoothstep(0.02, 0.62, p);
  } else if (uEffect == 7) {
    float develop = ease(p);
    float grain = hash(floor(uv * uResolution) + floor(t * 3.0)) - 0.5;
    float light = noise(point * 1.8 + vec2(t * 0.04, 0.0));
    waiting = vec3(0.055 + light * 0.04 + grain * 0.028);
    float luminance = dot(original, vec3(0.2126, 0.7152, 0.0722));
    vec3 silverImage = vec3(luminance) * vec3(0.96, 0.99, 1.02);
    vec3 developedImage = mix(silverImage, original, smoothstep(0.18, 0.88, p));
    revealed = pow(max(developedImage, vec3(0.0)), vec3(mix(3.6, 1.0, develop)));
    revealed += grain * mix(0.02, 0.055, strength) * (1.0-develop);
    mask = smoothstep(0.0, 0.55, p);
  } else if (uEffect == 8) {
    float threadCount = clamp(uResolution.y * 0.24, 90.0, 140.0);
    vec2 weave = point * threadCount;
    vec2 cell = floor(weave);
    vec2 local = fract(weave) - 0.5;
    float overUnder = mod(cell.x + cell.y, 2.0);
    vec2 crossSection = local / 0.47;
    vec2 section = sqrt(max(vec2(0.0), 1.0 - crossSection * crossSection));
    float top = mix(section.x, section.y, overUnder);
    float beneath = mix(section.y, section.x, overUnder);
    float topCoverage = smoothstep(0.0, 0.25, top);
    float coverage = max(top, beneath * 0.78);
    vec2 curvature = local / max(section, vec2(0.24));
    vec2 topNormal = mix(vec2(curvature.x, 0.0), vec2(0.0, curvature.y), overUnder);
    vec2 lowerNormal = mix(vec2(0.0, curvature.y), vec2(curvature.x, 0.0), overUnder);
    vec2 relief = mix(lowerNormal * 0.65, topNormal, topCoverage);
    vec3 normal = normalize(vec3(relief * mix(0.26, 0.4, strength), 1.0));
    vec3 light = normalize(vec3(0.45 + sin(t * 0.16) * 0.38, -0.55, 1.25));
    vec3 halfVector = normalize(light + vec3(0.0, 0.0, 1.0));
    float diffuse = max(dot(normal, light), 0.0);
    float sheen = pow(max(dot(normal, halfVector), 0.0), 22.0);
    float broadLight = 0.5 + 0.5 * sin(point.x * 1.4 + point.y * 0.8 - t * 0.18);
    float occlusion = 0.78 + 0.22 * topCoverage;
    float fiber = noise(uv * uResolution * 0.45) - 0.5;
    float cloth = 0.035 + coverage * occlusion * (0.055 + diffuse * 0.09 + sheen * 0.018 + broadLight * 0.025) + fiber * 0.004;
    waiting = vec3(cloth) * mix(vec3(1.0), uColor, 0.02);
    float settle = pow(1.0 - ease(p), 2.0);
    revealed = original * (1.0 + (cloth - 0.15) * 0.45 * settle);
    mask = ease(p);
  } else if (uEffect == 9) {
    vec2 field = point * mix(10.0, 18.0, strength);
    vec2 cell = floor(field), local = fract(field);
    float nearest = 10.0, second = 10.0;
    vec2 selected = vec2(0.0), center = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 seed = hash2(cell + offset);
        vec2 moving = 0.5 + 0.32 * sin(seed * 6.2831 + t * 0.45);
        float distanceToCell = length(offset + moving - local);
        if (distanceToCell < nearest) {
          second = nearest;
          nearest = distanceToCell;
          selected = cell + offset;
          center = cell + offset + moving;
        } else {
          second = min(second, distanceToCell);
        }
      }
    }
    float seed = hash(selected);
    float edge = smoothstep(0.015, 0.07, second - nearest);
    waiting = palette(seed) * mix(0.35, 1.0, edge);
    mask = smoothstep(seed * 0.8, seed * 0.8 + 0.2, p);
    vec2 cellUv = center / mix(10.0, 18.0, strength) / vec2(aspect, 1.0) + 0.5;
    revealed = photograph(mix(cellUv, uv, smoothstep(0.35, 1.0, p)));
  } else if (uEffect == 10) {
    float focus = ease(p);
    float cloud = noise(point * 1.5 + vec2(t * 0.035, t * 0.025));
    float light = exp(-dot(point - vec2(sin(t * 0.1) * 0.22, 0.12), point - vec2(sin(t * 0.1) * 0.22, 0.12)) * 1.6);
    waiting = mix(vec3(0.09, 0.10, 0.09), vec3(0.36, 0.38, 0.34), light * 0.6 + cloud * 0.4);
    waiting *= mix(vec3(1.0), uColor, 0.04);
    revealed = blurredImage(uv, pow(1.0-focus, 2.5) * mix(0.055, 0.14, strength));
    mask = smoothstep(0.0, 0.55, p);
  } else {
    vec2 surface = mat2(0.985, -0.174, 0.174, 0.985) * point;
    float clock = t * 0.12;
    vec2 slope = vec2(surface.x * 0.7 + sin(clock) * 0.23, surface.y * 0.28 - 0.2);
    vec3 normal = normalize(vec3(-slope, 1.0));
    vec3 reflection = reflect(vec3(0.0, 0.0, -1.0), normal);
    float lightPosition = reflection.x * 0.8 + reflection.y * 0.55;
    float softReflection = exp(-materialSquare((lightPosition - 0.02) / 0.36));
    float narrowReflection = exp(-materialSquare((lightPosition + 0.2) / 0.085));
    float fiberCount = min(uResolution.y * 0.78, 1200.0);
    float grain = noise(vec2(surface.x * 6.0, surface.y * fiberCount)) - 0.5;
    float fineGrain = noise(vec2(surface.x * 24.0, surface.y * fiberCount * 0.43)) - 0.5;
    float finish = (grain * 0.038 + fineGrain * 0.015) * mix(0.55, 1.25, strength);
    vec3 silver = studioMetal(normal, 0.16) * 0.38 + vec3(0.11 + softReflection * 0.48 + narrowReflection * 0.12 + finish);
    waiting = silver * mix(vec3(1.0), uColor, 0.025);
    float settle = pow(1.0 - ease(p), 2.0);
    revealed = blurredImage(uv + normal.xy / vec2(aspect, 1.0) * 0.016 * strength * settle, 0.01 * settle);
    mask = ease(p);
  }
  if (p <= 0.0) mask = 0.0;
  vec3 result = mix(waiting, revealed, clamp(mask, 0.0, 1.0));
  if (p >= 0.9999) result = original;
  gl_FragColor = vec4(result, 1.0);
}
`
