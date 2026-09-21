// ============================================================
// ELECTROMAGNETIC FIELD
// 3D magnetic field visualization for Hydra
//
// Inspired by MIT TEAL field-line / iron-filing representations
// and NIST immersive EM vector visualization.
//
// Controls:
//   1 / 2 / 3 / 4 = number of active magnets
//   Mouse         = tilt the scene
//
// Time (independent of audio):
//   4-minute loop of magnet choreography
//     0–1 min : clustered tightly together
//     1–2 min : slowly split apart in 3D
//     2–3 min : orbit on tilted circular paths
//     3–4 min : two opposing groups
//
// Audio (Hydra mic FFT):
//   envelope -> electromagnetic field *amount*
//     dipole moment strength
//     field-line opacity / thickness
//     vector-arrow brightness
//   (not scene scale — field density, not balloon size)
//
// Gallery: paste gallery-entry.js into hydra.ojack.xyz
//          then click "upload to gallery"
// ============================================================

// Async IIFE so this works both pasted into Hydra and via loadScript()
;(async () => {

const THREE =
  await import(
    "https://unpkg.com/three@0.163.0/build/three.module.js"
  )


// ------------------------------------------------------------
// AUDIO
// ------------------------------------------------------------

a.setBins(8)
a.setSmooth(0.92)
a.setCutoff(1)
a.setScale(2)


// ------------------------------------------------------------
// SCENE
// ------------------------------------------------------------

scene = new THREE.Scene()

camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100
)

camera.position.set(0, 1.2, 11)

renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
})

renderer.setSize(width, height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))


// ------------------------------------------------------------
// AUDIO ENVELOPE → FIELD AMOUNT
// ------------------------------------------------------------
// Lower FFT bins = broad energy, not twitchy visualizer jitter.

em = () => {
  return (
    a.fft[0] * 0.50 +
    a.fft[1] * 0.30 +
    a.fft[2] * 0.15 +
    a.fft[3] * 0.05
  )
}

// Smoothed field amount used by dipole strength + visuals
fieldAmount = 0.25


function updateFieldAmount() {
  // Soft follow so loud bursts thicken the field without popping
  let target = 0.12 + em() * 1.35
  fieldAmount += (target - fieldAmount) * 0.18
}


// ------------------------------------------------------------
// MAGNETS (dipoles)
// ------------------------------------------------------------
// p = position, m = magnetic moment (unit direction; scaled by fieldAmount)

magnets = [
  { p: new THREE.Vector3(0, 0, 0), m: new THREE.Vector3(0, 1, 0) },
  { p: new THREE.Vector3(0, 0, 0), m: new THREE.Vector3(0, 1, 0) },
  { p: new THREE.Vector3(0, 0, 0), m: new THREE.Vector3(1, 0, 0) },
  { p: new THREE.Vector3(0, 0, 0), m: new THREE.Vector3(1, 0, 0) }
]

activeMagnets = 4

window.addEventListener("keydown", (event) => {
  if (
    event.key === "1" ||
    event.key === "2" ||
    event.key === "3" ||
    event.key === "4"
  ) {
    activeMagnets = Number(event.key)
    rebuildField()
    createMagnetMarkers()
  }
})


// ------------------------------------------------------------
// 4-MINUTE MAGNET CHOREOGRAPHY (sound-independent)
// ------------------------------------------------------------

LOOP_MS = 4 * 60 * 1000
choreoStart = performance.now()

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

function smoothstep(edge0, edge1, x) {
  let t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpVec(out, a, b, t) {
  out.set(
    lerp(a.x, b.x, t),
    lerp(a.y, b.y, t),
    lerp(a.z, b.z, t)
  )
  return out
}


// Scratch vectors (avoid GC in the animation loop)
_tmpA = new THREE.Vector3()
_tmpB = new THREE.Vector3()
_tmpC = new THREE.Vector3()
_tmpD = new THREE.Vector3()
_tmpM = new THREE.Vector3()


function updateMagnetChoreography(now) {

  let u = ((now - choreoStart) % LOOP_MS) / LOOP_MS // 0..1 over 4 min
  let minute = u * 4 // 0..4

  // Phase weights (soft overlaps so motion never snaps)
  let wCluster = 1 - smoothstep(0.85, 1.15, minute)
  let wSplit   = smoothstep(0.85, 1.15, minute) * (1 - smoothstep(1.85, 2.15, minute))
  let wOrbit   = smoothstep(1.85, 2.15, minute) * (1 - smoothstep(2.85, 3.15, minute))
  let wGroups  = smoothstep(2.85, 3.15, minute)

  // Normalize weights so they sum ~1 across overlaps
  let wSum = wCluster + wSplit + wOrbit + wGroups
  if (wSum > 1e-6) {
    wCluster /= wSum
    wSplit   /= wSum
    wOrbit   /= wSum
    wGroups  /= wSum
  }

  // Orbit angle advances during minutes 2–3 (and a little into groups)
  let orbitAngle = (minute - 2) * Math.PI * 2 * 1.25

  for (let i = 0; i < 4; i++) {

    // --- Phase A: tightly clustered near origin (tiny 3D tetrahedron) ---
    let clusterR = 0.28
    let clusterPhi = i * (Math.PI * 0.5) + 0.4
    let clusterTheta = 0.55 + i * 0.35
    _tmpA.set(
      clusterR * Math.sin(clusterTheta) * Math.cos(clusterPhi),
      clusterR * Math.cos(clusterTheta),
      clusterR * Math.sin(clusterTheta) * Math.sin(clusterPhi)
    )

    // --- Phase B: split outward along distinct 3D rays ---
    let splitR = 1.1 + smoothstep(1.0, 2.0, minute) * 1.6
    let splitPhi = i * (Math.PI * 0.5) + 0.25
    let splitElev = (i % 2 === 0 ? 0.55 : -0.55) + Math.sin(i) * 0.2
    _tmpB.set(
      splitR * Math.cos(splitElev) * Math.cos(splitPhi),
      splitR * Math.sin(splitElev),
      splitR * Math.cos(splitElev) * Math.sin(splitPhi)
    )

    // --- Phase C: tilted circular orbits (true 3D, not flat) ---
    let orbitR = 2.35
    let phase = orbitAngle + i * (Math.PI * 0.5)
    let tilt = 0.55
    let ox = orbitR * Math.cos(phase)
    let oy = orbitR * Math.sin(phase) * Math.sin(tilt) * (i < 2 ? 1 : -1)
    let oz = orbitR * Math.sin(phase) * Math.cos(tilt)
    // Slight vertical lane offset so paths don't collide
    oy += (i - 1.5) * 0.35
    _tmpC.set(ox, oy, oz)

    // --- Phase D: two groups (0+1 vs 2+3) on opposite sides ---
    let groupSide = i < 2 ? -1 : 1
    let pair = i % 2
    let groupPulse = Math.sin(u * Math.PI * 2 * 2) * 0.25
    _tmpD.set(
      groupSide * (2.4 + groupPulse),
      (pair === 0 ? 0.9 : -0.9) + Math.sin(u * Math.PI * 4 + i) * 0.2,
      (pair === 0 ? 0.7 : -0.7) * groupSide
    )

    // Blend phase targets
    magnets[i].p.set(0, 0, 0)
    magnets[i].p.addScaledVector(_tmpA, wCluster)
    magnets[i].p.addScaledVector(_tmpB, wSplit)
    magnets[i].p.addScaledVector(_tmpC, wOrbit)
    magnets[i].p.addScaledVector(_tmpD, wGroups)

    // Moment directions evolve slowly in 3D (geometry of B, not audio)
    let mx = Math.sin(u * Math.PI * 2 + i * 1.7) * 0.35
    let my = Math.cos(u * Math.PI * 2 * 0.5 + i)
    let mz = Math.sin(u * Math.PI * 2 * 0.75 + i * 0.9) * 0.45
    // Prefer vertical moments when clustered (N–S look), more tilted when split
    let upright = wCluster * 0.85 + wSplit * 0.35
    magnets[i].m.set(
      mx * (1 - upright),
      my * upright + (1 - upright) * my,
      mz * (1 - upright * 0.5)
    ).normalize()

  }

}


// ------------------------------------------------------------
// MAGNETIC FIELD (classical dipole, μ0/4π omitted)
// B ∝ 3r(m·r)/|r|^5 − m/|r|^3
// ------------------------------------------------------------

function magneticField(point) {

  let B = new THREE.Vector3(0, 0, 0)

  // Audio scales the *amount* of field (dipole strength)
  let momentScale = 0.35 + fieldAmount * 1.8

  for (let i = 0; i < activeMagnets; i++) {

    let magnet = magnets[i]

    let r = new THREE.Vector3().subVectors(point, magnet.p)
    let distance = r.length()

    // Avoid singularity at dipole center
    if (distance < 0.32) {
      continue
    }

    let r2 = distance * distance
    let r3 = r2 * distance
    let r5 = r3 * r2

    _tmpM.copy(magnet.m).multiplyScalar(momentScale)

    let mdotr = _tmpM.dot(r)

    let term1 = r.clone().multiplyScalar(3 * mdotr / r5)
    let term2 = _tmpM.clone().multiplyScalar(1 / r3)

    B.add(term1.sub(term2))

  }

  return B

}


// ------------------------------------------------------------
// FIELD LINE INTEGRATION (both directions → closed-looking curves)
// ------------------------------------------------------------

function traceFieldLine(seed, direction) {

  let points = []
  let p = seed.clone()

  // Louder audio → slightly longer traces (more field extent)
  let steps = Math.floor(90 + fieldAmount * 70)

  for (let i = 0; i < steps; i++) {

    let B = magneticField(p)
    let magnitude = B.length()

    if (magnitude < 0.00005) {
      break
    }

    B.normalize().multiplyScalar(direction)

    p.add(B.multiplyScalar(0.08))
    points.push(p.clone())

    if (
      Math.abs(p.x) > 7 ||
      Math.abs(p.y) > 7 ||
      Math.abs(p.z) > 7
    ) {
      break
    }

  }

  return points

}


// ------------------------------------------------------------
// GROUPS
// ------------------------------------------------------------

fieldGroup = new THREE.Group()
scene.add(fieldGroup)

vectorGroup = new THREE.Group()
scene.add(vectorGroup)

magnetGroup = new THREE.Group()
scene.add(magnetGroup)


// ------------------------------------------------------------
// FIELD LINES (TEAL-style continuous tubes)
// ------------------------------------------------------------

function makeTube(points, strength) {

  if (points.length < 8) {
    return
  }

  let curve = new THREE.CatmullRomCurve3(points)

  // Audio → tube radius (field "thickness" / amount)
  let radius = 0.008 + strength * 0.022

  let geometry = new THREE.TubeGeometry(
    curve,
    Math.min(points.length, 100),
    radius,
    5,
    false
  )

  // Color shifts with strength: cool cyan → brighter teal/white
  let t = clamp01(strength)
  let color = new THREE.Color().setRGB(
    0.25 + t * 0.45,
    0.55 + t * 0.35,
    0.85 + t * 0.15
  )

  let material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.10 + strength * 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })

  fieldGroup.add(new THREE.Mesh(geometry, material))

}


function rebuildField() {

  fieldGroup.clear()

  let strength = fieldAmount

  // More audio → denser seed rings (more field lines)
  let ringCount = 3 + Math.floor(clamp01(strength) * 2)
  let seedsPerRing = 10 + Math.floor(clamp01(strength) * 6)

  for (let n = 0; n < activeMagnets; n++) {

    let magnet = magnets[n]

    // Orthonormal basis around moment axis for proper 3D seed rings
    let axis = magnet.m.clone().normalize()
    let helper = Math.abs(axis.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    let u = new THREE.Vector3().crossVectors(axis, helper).normalize()
    let v = new THREE.Vector3().crossVectors(axis, u).normalize()

    for (let ring = 0; ring < ringCount; ring++) {

      let radius = 0.42 + ring * 0.14

      for (let j = 0; j < seedsPerRing; j++) {

        let angle = (j / seedsPerRing) * Math.PI * 2

        // Seed on a circle perpendicular to m (fixes old cos/cos bug)
        let seed = new THREE.Vector3()
          .copy(magnet.p)
          .addScaledVector(u, Math.cos(angle) * radius)
          .addScaledVector(v, Math.sin(angle) * radius)
          .addScaledVector(axis, (ring - ringCount * 0.5) * 0.06)

        let forward = traceFieldLine(seed, 1)
        let backward = traceFieldLine(seed, -1)
        backward.reverse()

        makeTube(backward.concat(forward), strength)

      }

    }

  }

}


// ------------------------------------------------------------
// VECTOR FIELD SAMPLES (NIST / TEAL "arrows" / iron filings)
// Sparse 3D lattice of short segments along local B
// ------------------------------------------------------------

function rebuildVectors() {

  vectorGroup.clear()

  let strength = fieldAmount
  // Louder → denser iron-filing grid
  let half = 2 + Math.floor(clamp01(strength) * 2)
  let step = 1.35 - clamp01(strength) * 0.25

  for (let ix = -half; ix <= half; ix++) {
    for (let iy = -half; iy <= half; iy++) {
      for (let iz = -half; iz <= half; iz++) {

        // Skip empty corners of the cube for clarity
        if (ix * ix + iy * iy + iz * iz > half * half + 1) {
          continue
        }

        let point = new THREE.Vector3(
          ix * step,
          iy * step,
          iz * step
        )

        let B = magneticField(point)
        let mag = B.length()

        if (mag < 0.0002) {
          continue
        }

        B.normalize()

        // Length encodes local |B|, capped for readability
        let len = Math.min(0.55, 0.12 + Math.log1p(mag * 40) * 0.12)
        len *= 0.55 + strength * 0.7

        let tip = point.clone().addScaledVector(B, len * 0.5)
        let tail = point.clone().addScaledVector(B, -len * 0.5)

        let geom = new THREE.BufferGeometry().setFromPoints([tail, tip])

        let intensity = clamp01(0.2 + Math.log1p(mag * 20) * 0.25 + strength * 0.35)

        let mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(
            0.4 + intensity * 0.5,
            0.7 + intensity * 0.25,
            1.0
          ),
          transparent: true,
          opacity: 0.08 + intensity * 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })

        vectorGroup.add(new THREE.Line(geom, mat))

      }
    }
  }

}


// ------------------------------------------------------------
// MAGNET MARKERS
// ------------------------------------------------------------

function createMagnetMarkers() {

  magnetGroup.clear()

  for (let i = 0; i < activeMagnets; i++) {

    let sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
      })
    )

    // Tiny axis stub showing moment direction
    let axisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.28, 0),
      new THREE.Vector3(0, 0.28, 0)
    ])
    let axis = new THREE.Line(
      axisGeom,
      new THREE.LineBasicMaterial({
        color: 0xffcc88,
        transparent: true,
        opacity: 0.7
      })
    )
    axis.name = "momentAxis"

    let marker = new THREE.Group()
    marker.add(sphere)
    marker.add(axis)
    magnetGroup.add(marker)

  }

}


function syncMagnetMarkers() {

  for (let i = 0; i < magnetGroup.children.length; i++) {

    let marker = magnetGroup.children[i]
    let magnet = magnets[i]

    if (magnet == null) {
      continue
    }

    marker.position.copy(magnet.p)

    // Aim the axis stub along m
    let axis = marker.getObjectByName("momentAxis")
    if (axis != null) {
      let dir = magnet.m.clone().normalize()
      // Default line is along +Y; rotate to match m
      let quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir
      )
      axis.setRotationFromQuaternion(quat)
    }

  }

}


// ------------------------------------------------------------
// CAMERA / MOUSE
// ------------------------------------------------------------

mouseX = 0
mouseY = 0

window.addEventListener("mousemove", (event) => {
  mouseX = event.clientX / window.innerWidth - 0.5
  mouseY = event.clientY / window.innerHeight - 0.5
})


// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------

updateMagnetChoreography(performance.now())
updateFieldAmount()
rebuildField()
rebuildVectors()
createMagnetMarkers()
syncMagnetMarkers()

lastRebuild = 0
REBUILD_MS = 420 // field geometry lag — keeps Hydra responsive


// ------------------------------------------------------------
// ANIMATION
// ------------------------------------------------------------

update = () => {

  let now = performance.now()

  updateFieldAmount()
  updateMagnetChoreography(now)
  syncMagnetMarkers()

  // Rebuild field geometry on a cadence (magnets move every frame;
  // lines refresh often enough to read as continuous motion)
  if (now - lastRebuild > REBUILD_MS) {
    rebuildField()
    rebuildVectors()
    lastRebuild = now
  }

  // ----------------------------------------------------------
  // Slow 3D turn + mouse tilt (whole EM scene)
  // ----------------------------------------------------------

  let level = fieldAmount

  fieldGroup.rotation.y += 0.0012 + level * 0.0035
  vectorGroup.rotation.y = fieldGroup.rotation.y
  magnetGroup.rotation.y = fieldGroup.rotation.y

  let rx = mouseY * 0.4
  let rz = mouseX * 0.14

  fieldGroup.rotation.x = rx
  fieldGroup.rotation.z = rz
  vectorGroup.rotation.x = rx
  vectorGroup.rotation.z = rz
  magnetGroup.rotation.x = rx
  magnetGroup.rotation.z = rz

  // Audio modulates opacity live between rebuilds (field amount feel)
  for (let tube of fieldGroup.children) {
    if (tube.material != null) {
      tube.material.opacity = 0.08 + level * 0.62
    }
  }

  for (let line of vectorGroup.children) {
    if (line.material != null) {
      line.material.opacity = 0.06 + level * 0.4
    }
  }

  // Subtle camera orbit for depth (independent of magnet choreography)
  let camT = ((now - choreoStart) % LOOP_MS) / LOOP_MS
  camera.position.x = Math.sin(camT * Math.PI * 2) * 1.2
  camera.position.y = 1.2 + Math.sin(camT * Math.PI * 2 * 0.5) * 0.4
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)

}


// ------------------------------------------------------------
// HYDRA OUTPUT
// ------------------------------------------------------------

s0.init({
  src: renderer.domElement
})

// Do NOT use Hydra noise — Three.js is the sole visual.

solid(0, 0, 0)
  .layer(src(s0))
  .out(o0)

render(o0)

})().catch((err) => {
  console.error("electromagnetic field failed:", err)
})
