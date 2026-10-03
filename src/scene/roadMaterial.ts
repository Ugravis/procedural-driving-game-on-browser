import { MeshStandardMaterial, ShaderMaterial } from 'three'

const vertexShader = `
  attribute float across;
  attribute float along;
  varying float vAcross;
  varying float vAlong;
  varying vec3 vWorld;
  void main() {
    vAcross = across;
    vAlong = along;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = `
  varying float vAcross;
  varying float vAlong;
  varying vec3 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    float grain = hash(floor(vWorld.xz * 6.0));
    vec3 asphalt = vec3(0.13, 0.14, 0.15) + (grain - 0.5) * 0.05;
    float edge = smoothstep(0.82, 0.9, abs(vAcross));
    float dash = step(0.5, fract(vAlong / 8.0));
    float centre = (1.0 - smoothstep(0.02, 0.05, abs(vAcross))) * dash;
    vec3 color = mix(asphalt, vec3(0.92, 0.92, 0.88), edge);
    color = mix(color, vec3(0.96, 0.78, 0.2), centre);
    gl_FragColor = vec4(color, 1.0);
  }
`

export const roadStandardMaterial = new MeshStandardMaterial({
  color: '#3a3f44',
  polygonOffset: true,
  polygonOffsetFactor: -2,
})

export const roadShaderMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  polygonOffset: true,
  polygonOffsetFactor: -2,
})
