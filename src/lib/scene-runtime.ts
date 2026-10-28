// Runs inside the opaque-origin iframe of a 3D scene card. The scene-runtime Vite plugin bundles it with three.js
// into one classic script; the card inlines that script, then the model's code as `__scene.run(async (ctx) => { … })`.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import GUI from 'three/addons/libs/lil-gui.module.min.js'
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'

/** Sent from the frame to the card. `grid` says whether there was anything to lay a grid under. */
export type SceneMessage =
  | { type: 'ready'; grid: boolean }
  /** The code made its first label or frame callback, so the card can offer to hide the labels or pause the motion. */
  | { type: 'uses'; feature: 'labels' | 'motion' }
  | { type: 'error'; message: string }
  | { type: 'export'; format: 'glb' | 'png'; data: Blob }
  | { type: 'export-error'; message: string }

/** Sent from the card to the frame. `theme` sets the `--scene-*` colors that labels and the control panel use. */
export type SceneCommand =
  | { type: 'reset' }
  | { type: 'export'; format: 'glb' | 'png' }
  | { type: 'theme'; colors: Record<string, string> }
  | { type: 'view'; options: ViewOptions }

/** What the card's toolbar turns on and off. */
export type ViewOptions = { labels: boolean; grid: boolean; motion: boolean }
/** What the model's code is called with; the card names these as its parameters. */
export type SceneContext = ReturnType<typeof createContext>

type FrameCallback = (delta: number, elapsed: number) => void

const post = (message: SceneMessage) => parent.postMessage(message, '*')

// The card writes the document line where the model's code starts, so errors can point at its own lines.
const codeStart = Number(document.documentElement.dataset.codeLine) || 0
const SRCDOC_POSITION = /about:srcdoc:(\d+):\d+/g

function codeLine(stack: string | undefined): number | undefined {
  for (const [, line] of stack?.matchAll(SRCDOC_POSITION) ?? []) {
    if (Number(line) >= codeStart) return Number(line) - codeStart + 1
  }
}

let failed = false

function report(error: unknown, line = error instanceof Error ? codeLine(error.stack) : undefined) {
  // The first error is the useful one; later ones tend to follow from it.
  if (failed) return
  failed = true
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  post({ type: 'error', message: line ? `${text} (line ${line})` : text })
}

addEventListener('error', (event) => {
  // A syntax error in the model's code has no useful stack, only the document line it was found on.
  const line = event.lineno >= codeStart && codeStart > 0 ? event.lineno - codeStart + 1 : undefined
  report(event.error ?? event.message, event.error instanceof SyntaxError ? line : undefined)
})
addEventListener('unhandledrejection', (event) => report(event.reason))

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.shadowMap.enabled = true
document.body.append(renderer.domElement)

const labels = new CSS2DRenderer()
labels.domElement.className = 'labels'
document.body.append(labels.domElement)

const scene = new THREE.Scene()
// A soft studio light, so standard materials look right even before the code adds its own lights.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.6

const DEFAULT_VIEW = new THREE.Vector3(4, 3, 5)
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
camera.position.copy(DEFAULT_VIEW)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

let size = { width: 0, height: 0 }

/** Matches the canvas to the frame. Checked every frame: a frame can start before it is laid out, without a resize event after. */
function resize() {
  const width = innerWidth
  const height = innerHeight
  if (!width || !height || (width === size.width && height === size.height)) return
  size = { width, height }
  renderer.setSize(width, height)
  labels.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
resize()

let panel: GUI | undefined
let grid: THREE.GridHelper | undefined
const frames: Array<FrameCallback> = []
const view: ViewOptions = { labels: true, grid: false, motion: true }
const used = new Set<'labels' | 'motion'>()

function use(feature: 'labels' | 'motion') {
  if (used.has(feature)) return
  used.add(feature)
  post({ type: 'uses', feature })
}

function createContext() {
  return {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    /** Calls back before every frame with the seconds since the last frame and since the start. */
    onFrame: (callback: FrameCallback) => {
      use('motion')
      frames.push(callback)
    },
    /** A text tag that stays over the object it is added to. */
    label: (text: string) => {
      use('labels')
      const element = document.createElement('div')
      element.className = 'label'
      element.textContent = text
      return new CSS2DObject(element)
    },
    /** The scene's control panel, made on first use. */
    gui: () => (panel ??= new GUI({ title: document.documentElement.lang === 'vi' ? 'Điều chỉnh' : 'Controls', width: 220 })),
    addons: { RoundedBoxGeometry, ConvexGeometry, ParametricGeometry, BufferGeometryUtils, SimplexNoise },
  }
}

/** The box around everything visible, leaving out what the code marked with `userData.fit = false`. */
function sceneBounds() {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const part = new THREE.Box3()
  const visit = (object: THREE.Object3D) => {
    if (!object.visible || object.userData.fit === false) return
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      if (object instanceof THREE.InstancedMesh) object.computeBoundingBox()
      const geometry = object.geometry as THREE.BufferGeometry
      if (!(object instanceof THREE.InstancedMesh) && !geometry.boundingBox) geometry.computeBoundingBox()
      const local = object instanceof THREE.InstancedMesh ? object.boundingBox : geometry.boundingBox
      if (local && !local.isEmpty()) box.union(part.copy(local).applyMatrix4(object.matrixWorld))
    }
    for (const child of object.children) visit(child)
  }
  visit(scene)
  return box
}

/** Points the camera at the box. */
function fitView(box: THREE.Box3) {
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2
  const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 16 / 10
  const horizontal = Math.atan(Math.tan(vertical) * aspect)
  const distance = (sphere.radius / Math.sin(Math.min(vertical, horizontal))) * 1.05
  camera.position.copy(sphere.center).addScaledVector(DEFAULT_VIEW.clone().normalize(), distance)
  camera.near = Math.max(distance / 1000, 0.001)
  camera.far = Math.max(distance * 100, camera.far)
  camera.updateProjectionMatrix()
  controls.target.copy(sphere.center)
  controls.update()
}

/** The nearest of 1, 2 or 5 times a power of ten at or above the value. */
function roundStep(value: number) {
  const power = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 5].find((n) => n * power >= value) ?? 10) * power
}

/** A floor grid under the box, twice its size, with lines on round world coordinates. */
function makeGrid(box: THREE.Box3) {
  const size = box.getSize(new THREE.Vector3())
  const extent = Math.max(size.x, size.y, size.z) * 2
  if (!(extent > 0) || !Number.isFinite(extent)) return
  const step = roundStep(extent / 16)
  const divisions = Math.ceil(extent / step / 2) * 2
  const center = box.getCenter(new THREE.Vector3())
  const helper = new THREE.GridHelper(divisions * step, divisions, 0xffffff, 0xffffff)
  helper.position.set(Math.round(center.x / step) * step, box.min.y, Math.round(center.z / step) * step)
  const material = helper.material as THREE.LineBasicMaterial
  material.transparent = true
  material.opacity = 0.3
  material.depthWrite = false
  // Drawn before see-through floors, so a shadow plane at the same height does not hide it.
  helper.renderOrder = -1
  helper.userData.fit = false
  helper.visible = view.grid
  return helper
}

const swatch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!

/** Any CSS color, theme colors in oklch included, which THREE.Color cannot read itself. */
function cssColor(value: string) {
  swatch.clearRect(0, 0, 1, 1)
  swatch.fillStyle = value
  swatch.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = swatch.getImageData(0, 0, 1, 1).data
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}

/** The grid takes the theme's text color. */
function paintGrid() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--scene-text').trim()
  if (grid && color) (grid.material as THREE.LineBasicMaterial).color.copy(cssColor(color))
}

let last: number | undefined
// Scene time, which stands still while the motion is paused.
let elapsed = 0

function render(time: number) {
  const delta = last === undefined ? 0 : (time - last) / 1000
  last = time
  resize()
  if (view.motion) {
    elapsed += delta
    for (const frame of [...frames]) {
      try {
        frame(delta, elapsed)
      } catch (error) {
        // A failing callback would throw again every frame; drop it and keep the scene interactive.
        frames.splice(frames.indexOf(frame), 1)
        report(error)
      }
    }
  }
  controls.update(delta)
  renderer.render(scene, camera)
  if (view.labels) labels.render(scene, camera)
}

async function exportScene(format: 'glb' | 'png'): Promise<Blob> {
  if (format === 'png') {
    // The drawing buffer is only readable in the task that drew it.
    renderer.render(scene, camera)
    return new Promise((resolve, reject) =>
      renderer.domElement.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the scene')))),
    )
  }
  // The grid is the viewer's, not part of the model.
  const data = await new GLTFExporter().parseAsync(grid ? scene.children.filter((child) => child !== grid) : scene, {
    binary: true,
    onlyVisible: true,
  })
  return new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' })
}

addEventListener('message', (event: MessageEvent<SceneCommand>) => {
  if (event.source !== parent) return
  const command = event.data
  if (command.type === 'reset') controls.reset()
  if (command.type === 'view') {
    Object.assign(view, command.options)
    labels.domElement.hidden = !view.labels
    if (grid) grid.visible = view.grid
  }
  if (command.type === 'theme') {
    for (const [name, value] of Object.entries(command.colors)) {
      if (name.startsWith('--scene-')) document.documentElement.style.setProperty(name, value)
    }
    paintGrid()
  }
  if (command.type === 'export') {
    exportScene(command.format).then(
      (data) => post({ type: 'export', format: command.format, data }),
      (error: unknown) => post({ type: 'export-error', message: error instanceof Error ? error.message : String(error) }),
    )
  }
})

async function run(setup: (context: SceneContext) => unknown) {
  try {
    await setup(createContext())
  } catch (error) {
    report(error)
    return
  }
  const bounds = sceneBounds()
  // Code that places the camera itself keeps its view; otherwise the view frames the whole scene.
  if (camera.position.equals(DEFAULT_VIEW) && controls.target.lengthSq() === 0 && !bounds.isEmpty()) fitView(bounds)
  else controls.update()
  controls.saveState()
  grid = bounds.isEmpty() ? undefined : makeGrid(bounds)
  if (grid) {
    scene.add(grid)
    paintGrid()
  }
  // Drawn once right away, so the scene shows even before the browser grants the frame its first animation frame.
  render(performance.now())
  renderer.setAnimationLoop(render)
  post({ type: 'ready', grid: grid !== undefined })
}

Object.assign(globalThis, { __scene: { run } })
