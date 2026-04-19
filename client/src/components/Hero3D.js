import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    Float,
    Environment,
    ContactShadows,
    RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";

/**
 * Hero3D — professional, bounded 3D stage for the landing hero.
 *
 * Design intent:
 *   • Cinematic, restrained color palette — cool blues + neutral grays,
 *     no playful primaries. Suitable for an enterprise/civic audience.
 *   • A stylized Ashland Transit bus on a gently cambered road,
 *     with one passing sedan and minimal environmental detail so
 *     the composition reads clearly at small sizes.
 *   • Wheels rotate on the correct axis.
 *   • Camera gently reacts to pointer + scroll for subtle depth.
 *   • Automatic day / night palette based on local time (06:00–19:00 = day).
 *     A manual `mode` prop overrides the auto-selection.
 *
 * This scene is intended to live INSIDE a bounded stage (not a full-
 * bleed overlay), so copy on the opposite column is always 100%
 * legible.
 */

// ─── Palette tokens: day vs night ───────────────────────────────
// A single source of truth for color, so every element in the scene
// reads from the same theme and nothing looks out of place after a
// palette swap.
const PALETTES = {
    day: {
        background: "#dbeafe", // soft sky blue
        fog: "#cbd5e1",
        buildings: "#475569",
        buildingLightEmissive: "#1e293b",
        asphalt: "#334155",
        sidewalk: "#94a3b8",
        curb: "#64748b",
        laneMarker: "#fef3c7",
        laneMarkerEmissive: "#fbbf24",
        windowEmissive: "#60a5fa",
        windowEmissiveIntensity: 0.25,
        headlightIntensity: 0.3, // dim during the day
        lampOn: false,
        envPreset: "city",
        ambientIntensity: 0.65,
        keyLightColor: "#fff7ed",
        keyLightIntensity: 1.4,
        rimLightColor: "#60a5fa",
        rimLightIntensity: 0.4,
        sunMoon: {
            color: "#fde68a",
            emissive: "#f59e0b",
            emissiveIntensity: 1.4,
            position: [-4.5, 4.2, -3.8],
        },
    },
    night: {
        background: "#0b1528",
        fog: "#0b1528",
        buildings: "#0b1220",
        buildingLightEmissive: "#fbbf24",
        asphalt: "#0b1220",
        sidewalk: "#1e293b",
        curb: "#334155",
        laneMarker: "#e2e8f0",
        laneMarkerEmissive: "#cbd5e1",
        windowEmissive: "#1e3a8a",
        windowEmissiveIntensity: 0.8,
        headlightIntensity: 2.6,
        lampOn: true,
        envPreset: "night",
        ambientIntensity: 0.3,
        keyLightColor: "#cbd5e1",
        keyLightIntensity: 0.9,
        rimLightColor: "#60a5fa",
        rimLightIntensity: 1.6,
        sunMoon: {
            color: "#f1f5f9",
            emissive: "#cbd5e1",
            emissiveIntensity: 0.85,
            position: [-4.5, 4.2, -3.8],
        },
    },
};

// Auto-select palette from current local hour (day: 06:00 - 18:59).
const autoPaletteName = () => {
    const h = new Date().getHours();
    return h >= 6 && h < 19 ? "day" : "night";
};

// React context for the chosen palette so nested 3D components can read
// from a single theme without prop-drilling.
const PaletteContext = React.createContext(PALETTES.night);
const usePalette = () => React.useContext(PaletteContext);

// ─── Camera rig: very subtle mouse + scroll parallax ────────────
const CameraRig = () => {
    const { camera, pointer } = useThree();
    const base = useRef(new THREE.Vector3(5.4, 2.4, 6.0));
    const lookAt = useRef(new THREE.Vector3(0, 0.45, 0));
    const scrollN = useRef(0);

    useFrame(() => {
        const sy = typeof window !== "undefined" ? Math.min(window.scrollY / 900, 1) : 0;
        scrollN.current = THREE.MathUtils.lerp(scrollN.current, sy, 0.08);

        const px = pointer.x * 0.35;
        const py = pointer.y * 0.2;

        const tgt = new THREE.Vector3(
            base.current.x + px,
            base.current.y + py - scrollN.current * 0.35,
            base.current.z - scrollN.current * 0.6,
        );
        camera.position.lerp(tgt, 0.06);
        camera.lookAt(lookAt.current);
    });

    return null;
};

// ─── Wheel (oriented + rolls correctly along X) ─────────────────
const Wheel = ({ position, refCb }) => (
    <group position={position} ref={refCb}>
        {/* Tire — rotated so its axis is along Z (width of bus) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.16, 28]} />
            <meshStandardMaterial color="#0b1220" roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.165, 20]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.7} />
        </mesh>
        {/* Spokes */}
        {[0, 1, 2, 3, 4].map((i) => (
            <mesh
                key={i}
                rotation={[0, 0, (i * Math.PI) / 2.5]}
                position={[0, 0, 0]}
            >
                <boxGeometry args={[0.28, 0.03, 0.02]} />
                <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.6} />
            </mesh>
        ))}
    </group>
);

// ─── City bus (main subject) ────────────────────────────────────
const CityBus = () => {
    const palette = usePalette();
    const group = useRef();
    const wheels = [useRef(), useRef(), useRef(), useRef()];

    useFrame((state) => {
        if (!group.current) return;
        const t = state.clock.getElapsedTime();
        // Subtle bob + very small roll to imply movement
        group.current.position.y = -0.42 + Math.sin(t * 1.8) * 0.018;
        group.current.rotation.z = Math.sin(t * 1.2) * 0.006;

        // Wheels roll forward: rotation on Z axis (because tire cylinder
        // was rotated PI/2 on X, its spin axis is world-Z here).
        const spin = -t * 6;
        wheels.forEach((w) => {
            if (w.current) w.current.rotation.z = spin;
        });
    });

    return (
        <group ref={group} position={[0, -0.42, 0]}>
            {/* Lower chassis — darker navy band */}
            <RoundedBox args={[3.3, 0.6, 1.3]} radius={0.12} smoothness={6} position={[0, 0.12, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#0f2350" metalness={0.5} roughness={0.4} />
            </RoundedBox>

            {/* Main body */}
            <RoundedBox args={[3.35, 1.2, 1.35]} radius={0.24} smoothness={8} position={[0, 0.78, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#1e40af" metalness={0.35} roughness={0.32} />
            </RoundedBox>

            {/* Roof */}
            <RoundedBox args={[3.15, 0.2, 1.25]} radius={0.08} smoothness={4} position={[0, 1.42, 0]} castShadow>
                <meshStandardMaterial color="#0b1e5c" metalness={0.4} roughness={0.35} />
            </RoundedBox>

            {/* Roof AC unit */}
            <RoundedBox args={[0.6, 0.08, 0.8]} radius={0.02} smoothness={3} position={[0.6, 1.55, 0]}>
                <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
            </RoundedBox>

            {/* A subtle single accent stripe — white instead of gold */}
            <mesh position={[0, 0.42, 0.686]}>
                <planeGeometry args={[3.15, 0.05]} />
                <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, 0.42, -0.686]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[3.15, 0.05]} />
                <meshStandardMaterial color="#f8fafc" emissive="#e2e8f0" emissiveIntensity={0.25} />
            </mesh>

            {/* Side windows — tint reacts to day/night palette */}
            {[-1.2, -0.6, 0.0, 0.6, 1.2].map((x, i) => (
                <group key={i}>
                    <mesh position={[x, 0.98, 0.686]}>
                        <planeGeometry args={[0.44, 0.45]} />
                        <meshStandardMaterial
                            color="#0f172a"
                            emissive={palette.windowEmissive}
                            emissiveIntensity={palette.windowEmissiveIntensity}
                            metalness={0.9}
                            roughness={0.1}
                        />
                    </mesh>
                    <mesh position={[x, 0.98, -0.686]} rotation={[0, Math.PI, 0]}>
                        <planeGeometry args={[0.44, 0.45]} />
                        <meshStandardMaterial
                            color="#0f172a"
                            emissive={palette.windowEmissive}
                            emissiveIntensity={palette.windowEmissiveIntensity}
                            metalness={0.9}
                            roughness={0.1}
                        />
                    </mesh>
                </group>
            ))}

            {/* Windshield */}
            <mesh position={[1.66, 0.95, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[1.15, 0.55]} />
                <meshStandardMaterial
                    color="#0f172a"
                    emissive="#1e40af"
                    emissiveIntensity={0.95}
                    metalness={0.95}
                    roughness={0.08}
                />
            </mesh>

            {/* Rear window */}
            <mesh position={[-1.66, 0.95, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[1.15, 0.55]} />
                <meshStandardMaterial
                    color="#0f172a"
                    emissive="#1e40af"
                    emissiveIntensity={0.55}
                    metalness={0.95}
                    roughness={0.08}
                />
            </mesh>

            {/* Route destination sign */}
            <mesh position={[1.661, 1.28, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.98, 0.18]} />
                <meshStandardMaterial color="#0b1220" emissive="#fbbf24" emissiveIntensity={0.65} />
            </mesh>

            {/* Headlights — glow harder at night, dimmer in daylight */}
            {[0.42, -0.42].map((z, i) => (
                <mesh key={i} position={[1.662, 0.35, z]} rotation={[0, Math.PI / 2, 0]}>
                    <circleGeometry args={[0.08, 16]} />
                    <meshStandardMaterial
                        color="#ffffff"
                        emissive="#fef3c7"
                        emissiveIntensity={palette.headlightIntensity}
                        toneMapped={false}
                    />
                </mesh>
            ))}
            <pointLight
                position={[2.0, 0.35, 0]}
                color="#fde68a"
                intensity={palette.headlightIntensity * 0.4}
                distance={3.2}
            />

            {/* Taillights */}
            {[0.42, -0.42].map((z, i) => (
                <mesh key={i} position={[-1.662, 0.35, z]} rotation={[0, -Math.PI / 2, 0]}>
                    <circleGeometry args={[0.07, 16]} />
                    <meshStandardMaterial
                        color="#fee2e2"
                        emissive="#dc2626"
                        emissiveIntensity={1.6}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {/* Door outline + glass */}
            <mesh position={[-0.25, 0.62, 0.686]}>
                <planeGeometry args={[0.46, 1.0]} />
                <meshStandardMaterial color="#0b1e5c" metalness={0.45} roughness={0.35} />
            </mesh>
            <mesh position={[-0.25, 0.62, 0.689]}>
                <planeGeometry args={[0.38, 0.88]} />
                <meshStandardMaterial
                    color="#0f172a"
                    emissive="#1e3a8a"
                    emissiveIntensity={0.55}
                    metalness={0.85}
                    roughness={0.12}
                />
            </mesh>

            {/* Wheels — correct axis */}
            <Wheel position={[1.12, -0.12, 0.72]} refCb={wheels[0]} />
            <Wheel position={[1.12, -0.12, -0.72]} refCb={wheels[1]} />
            <Wheel position={[-1.12, -0.12, 0.72]} refCb={wheels[2]} />
            <Wheel position={[-1.12, -0.12, -0.72]} refCb={wheels[3]} />
        </group>
    );
};

// ─── Passing sedan (neutral gray, single car, not a toy) ────────
const PassingSedan = () => {
    const ref = useRef();
    const wheels = [useRef(), useRef()];
    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime() * 0.45;
        const loop = ((t + 12) % 24) - 12;
        ref.current.position.x = loop;
        wheels.forEach((w) => {
            if (w.current) w.current.rotation.z = -t * 8;
        });
    });
    return (
        <group ref={ref} position={[0, -0.58, -1.45]}>
            <RoundedBox args={[1.55, 0.42, 0.78]} radius={0.1} smoothness={5} position={[0, 0.24, 0]} castShadow>
                <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.3} />
            </RoundedBox>
            <RoundedBox args={[0.95, 0.32, 0.74]} radius={0.08} smoothness={5} position={[-0.08, 0.58, 0]} castShadow>
                <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.3} />
            </RoundedBox>
            {/* Glass */}
            <mesh position={[-0.08, 0.6, 0.378]}>
                <planeGeometry args={[0.65, 0.22]} />
                <meshStandardMaterial color="#0f172a" emissive="#1e3a8a" emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[-0.08, 0.6, -0.378]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[0.65, 0.22]} />
                <meshStandardMaterial color="#0f172a" emissive="#1e3a8a" emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Head + tail */}
            <mesh position={[0.77, 0.24, 0.3]} rotation={[0, Math.PI / 2, 0]}>
                <circleGeometry args={[0.05, 12]} />
                <meshStandardMaterial color="#ffffff" emissive="#fef3c7" emissiveIntensity={2} toneMapped={false} />
            </mesh>
            <mesh position={[0.77, 0.24, -0.3]} rotation={[0, Math.PI / 2, 0]}>
                <circleGeometry args={[0.05, 12]} />
                <meshStandardMaterial color="#ffffff" emissive="#fef3c7" emissiveIntensity={2} toneMapped={false} />
            </mesh>
            {/* Wheels */}
            <group position={[0.5, 0, 0.4]} ref={wheels[0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.15, 0.15, 0.08, 18]} />
                    <meshStandardMaterial color="#0b1220" />
                </mesh>
            </group>
            <group position={[-0.5, 0, 0.4]} ref={wheels[1]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.15, 0.15, 0.08, 18]} />
                    <meshStandardMaterial color="#0b1220" />
                </mesh>
            </group>
        </group>
    );
};

// ─── Road (single asphalt surface, dashed center line) ──────────
const Road = () => {
    const palette = usePalette();
    const group = useRef();
    useFrame((state) => {
        if (!group.current) return;
        const t = state.clock.getElapsedTime();
        group.current.children.forEach((child, i) => {
            const base = -10 + i * 1.6;
            child.position.x = ((base + t * 4.5) % 20) - 10;
        });
    });
    return (
        <group position={[0, -1.0, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[30, 5]} />
                <meshStandardMaterial color={palette.asphalt} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.005, 2.35]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[30, 0.7]} />
                <meshStandardMaterial color={palette.sidewalk} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.005, -2.35]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[30, 0.7]} />
                <meshStandardMaterial color={palette.sidewalk} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.01, 1.95]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[30, 0.08]} />
                <meshStandardMaterial color={palette.curb} />
            </mesh>
            <mesh position={[0, 0.01, -1.95]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[30, 0.08]} />
                <meshStandardMaterial color={palette.curb} />
            </mesh>

            <group ref={group}>
                {Array.from({ length: 14 }).map((_, i) => (
                    <mesh
                        key={i}
                        position={[-10 + i * 1.6, 0.02, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                    >
                        <planeGeometry args={[0.7, 0.06]} />
                        <meshStandardMaterial
                            color={palette.laneMarker}
                            emissive={palette.laneMarkerEmissive}
                            emissiveIntensity={0.3}
                        />
                    </mesh>
                ))}
            </group>
        </group>
    );
};

// ─── Distant skyline — subtle silhouette ────────────────────────
const Skyline = () => {
    const palette = usePalette();
    const buildings = useMemo(
        () => [
            { x: -7.5, h: 2.6, w: 1.3 },
            { x: -5.7, h: 3.8, w: 1.2 },
            { x: -3.9, h: 2.2, w: 1.3 },
            { x: -2.1, h: 4.4, w: 1.1 },
            { x: -0.3, h: 3.0, w: 1.3 },
            { x: 1.8, h: 4.0, w: 1.2 },
            { x: 3.8, h: 2.6, w: 1.3 },
            { x: 5.6, h: 3.6, w: 1.2 },
            { x: 7.4, h: 2.4, w: 1.3 },
        ],
        [],
    );
    return (
        <group position={[0, -1.0, -4.5]}>
            {buildings.map((b, i) => (
                <group key={i} position={[b.x, b.h / 2, 0]}>
                    <RoundedBox args={[b.w, b.h, 1]} radius={0.04} smoothness={3}>
                        <meshStandardMaterial color={palette.buildings} roughness={0.95} />
                    </RoundedBox>
                    {/* Window lights — only in night palette */}
                    {palette.lampOn &&
                        Array.from({ length: Math.floor(b.h / 0.4) }).map((_, row) =>
                            Array.from({ length: 3 }).map((_, col) => {
                                const lit = (row * 3 + col + i * 2) % 4 === 0;
                                if (!lit) return null;
                                return (
                                    <mesh
                                        key={`${row}-${col}`}
                                        position={[
                                            -b.w / 2 + 0.2 + col * (b.w / 3.2),
                                            -b.h / 2 + 0.28 + row * 0.4,
                                            0.51,
                                        ]}
                                    >
                                        <planeGeometry args={[0.08, 0.14]} />
                                        <meshStandardMaterial
                                            color="#fef3c7"
                                            emissive={palette.buildingLightEmissive}
                                            emissiveIntensity={1.1}
                                            toneMapped={false}
                                        />
                                    </mesh>
                                );
                            }),
                        )}
                </group>
            ))}
        </group>
    );
};

// ─── Street lamp (slim) — bulb only glows at night ──────────────
const StreetLamp = ({ position }) => {
    const palette = usePalette();
    return (
        <group position={position}>
            <mesh position={[0, 0.95, 0]}>
                <cylinderGeometry args={[0.03, 0.04, 1.9, 8]} />
                <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0.22, 1.82, 0]} rotation={[0, 0, -0.35]}>
                <boxGeometry args={[0.42, 0.04, 0.04]} />
                <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0.42, 1.73, 0]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color="#fef3c7"
                    emissive="#fde68a"
                    emissiveIntensity={palette.lampOn ? 2.3 : 0.05}
                    toneMapped={false}
                />
            </mesh>
            {palette.lampOn && (
                <pointLight position={[0.42, 1.73, 0]} color="#fde68a" intensity={0.5} distance={2.8} />
            )}
        </group>
    );
};

// ─── Route pin (cone + ball) ────────────────────────────────────
const RoutePin = ({ position, color, delay = 0 }) => {
    const ref = useRef();
    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime() + delay;
        ref.current.position.y = position[1] + Math.sin(t * 1.6) * 0.08;
        ref.current.rotation.y = t * 0.5;
    });
    return (
        <group ref={ref} position={position}>
            <mesh>
                <sphereGeometry args={[0.17, 24, 24]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={1.2}
                    toneMapped={false}
                />
            </mesh>
            <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.08, 0.2, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.8}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
};

// ─── Route arc (tube) ───────────────────────────────────────────
const RouteArc = ({ from, to }) => {
    const geometry = useMemo(() => {
        const midX = (from[0] + to[0]) / 2;
        const midY = Math.max(from[1], to[1]) + 0.9;
        const midZ = (from[2] + to[2]) / 2;
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(...from),
            new THREE.Vector3(midX, midY, midZ),
            new THREE.Vector3(...to),
        ]);
        return new THREE.TubeGeometry(curve, 64, 0.025, 10, false);
    }, [from, to]);

    const ref = useRef();
    useFrame((state) => {
        if (!ref.current) return;
        ref.current.material.emissiveIntensity =
            1.1 + Math.sin(state.clock.getElapsedTime() * 2) * 0.3;
    });

    return (
        <mesh ref={ref} geometry={geometry}>
            <meshStandardMaterial
                color="#60a5fa"
                emissive="#3b82f6"
                emissiveIntensity={1.2}
                toneMapped={false}
            />
        </mesh>
    );
};

// ─── Traveling GPS dot on the arc ───────────────────────────────
const GPSDot = ({ from, to }) => {
    const ref = useRef();
    const curve = useMemo(() => {
        const midX = (from[0] + to[0]) / 2;
        const midY = Math.max(from[1], to[1]) + 0.9;
        const midZ = (from[2] + to[2]) / 2;
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(...from),
            new THREE.Vector3(midX, midY, midZ),
            new THREE.Vector3(...to),
        ]);
    }, [from, to]);

    useFrame((state) => {
        if (!ref.current) return;
        const t = (state.clock.getElapsedTime() * 0.22) % 1;
        const p = curve.getPoint(t);
        ref.current.position.copy(p);
    });

    return (
        <group ref={ref}>
            <mesh>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#60a5fa"
                    emissiveIntensity={2.8}
                    toneMapped={false}
                />
            </mesh>
            <pointLight color="#60a5fa" intensity={1.3} distance={1.6} />
        </group>
    );
};

// ─── Ground pulse (route node under the bus) ────────────────────
const GroundPulse = () => {
    const ref = useRef();
    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        const s = 1 + ((Math.sin(t * 1.3) + 1) / 2) * 1.0;
        ref.current.scale.set(s, s, s);
        ref.current.material.opacity = 0.38 * (1 - (s - 1) / 1.0);
    });
    return (
        <mesh ref={ref} position={[0, -0.99, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.05, 48]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.4} />
        </mesh>
    );
};

// ─── Sun / moon (silent hint of time of day) ────────────────────
const SunMoon = () => {
    const palette = usePalette();
    const ref = useRef();
    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        ref.current.position.y = palette.sunMoon.position[1] + Math.sin(t * 0.4) * 0.04;
    });
    return (
        <mesh ref={ref} position={palette.sunMoon.position}>
            <sphereGeometry args={[0.55, 32, 32]} />
            <meshStandardMaterial
                color={palette.sunMoon.color}
                emissive={palette.sunMoon.emissive}
                emissiveIntensity={palette.sunMoon.emissiveIntensity}
                toneMapped={false}
            />
        </mesh>
    );
};

// ─── Composite scene ────────────────────────────────────────────
const Scene = () => {
    const palette = usePalette();
    return (
        <>
            <color attach="background" args={[new THREE.Color(palette.background)]} />
            <fog attach="fog" args={[palette.fog, 9, 22]} />

            <ambientLight intensity={palette.ambientIntensity} />
            <directionalLight
                position={[5, 8, 4]}
                intensity={palette.keyLightIntensity}
                color={palette.keyLightColor}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />
            <pointLight
                position={[-5, 3, -3]}
                color={palette.rimLightColor}
                intensity={palette.rimLightIntensity}
                distance={12}
            />
            <pointLight position={[4, 2.2, 3]} color="#fbbf24" intensity={0.5} distance={8} />

            <SunMoon />
            <Skyline />
            <Road />

            <StreetLamp position={[-3.8, -1.0, 1.95]} />
            <StreetLamp position={[3.8, -1.0, 1.95]} />
            <StreetLamp position={[-6, -1.0, -1.95]} />
            <StreetLamp position={[6, -1.0, -1.95]} />

            <GroundPulse />

            <Float floatIntensity={0.14} speed={1.0} rotationIntensity={0}>
                <CityBus />
            </Float>

            <PassingSedan />

            <RouteArc from={[-2.4, 2.0, -0.6]} to={[2.6, 2.3, -0.9]} />
            <GPSDot from={[-2.4, 2.0, -0.6]} to={[2.6, 2.3, -0.9]} />
            <RoutePin position={[-2.4, 2.0, -0.6]} color="#22c55e" delay={0} />
            <RoutePin position={[2.6, 2.3, -0.9]} color="#ef4444" delay={0.6} />

            <Environment preset={palette.envPreset} />

            <CameraRig />
        </>
    );
};

/**
 * @param {object} props
 * @param {"auto"|"day"|"night"} [props.mode="auto"] - Force a palette, or let
 *   the scene auto-select based on local time (day: 06:00-18:59, else night).
 * @param {string} [props.className]
 */
const Hero3D = ({ mode = "auto", className = "" }) => {
    const supportsWebGL = useMemo(() => {
        try {
            const canvas = document.createElement("canvas");
            return !!(
                window.WebGLRenderingContext &&
                (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
            );
        } catch {
            return false;
        }
    }, []);

    // Chosen palette name; re-evaluated every minute in auto mode so the
    // scene naturally transitions if the user sits through sunset/sunrise.
    const [paletteName, setPaletteName] = React.useState(() =>
        mode === "auto" ? autoPaletteName() : mode,
    );

    React.useEffect(() => {
        if (mode !== "auto") {
            setPaletteName(mode);
            return;
        }
        setPaletteName(autoPaletteName());
        const id = setInterval(() => setPaletteName(autoPaletteName()), 60_000);
        return () => clearInterval(id);
    }, [mode]);

    const palette = PALETTES[paletteName] || PALETTES.night;

    if (!supportsWebGL) return null;

    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            aria-hidden="true"
        >
            <Canvas
                shadows
                dpr={[1, 1.8]}
                camera={{ position: [5.4, 2.4, 6.0], fov: 36 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: "high-performance",
                    toneMapping: THREE.ACESFilmicToneMapping,
                    outputColorSpace: THREE.SRGBColorSpace,
                }}
            >
                <PaletteContext.Provider value={palette}>
                    <Suspense fallback={null}>
                        <Scene />
                    </Suspense>
                    <ContactShadows
                        position={[0, -0.99, 0]}
                        opacity={paletteName === "day" ? 0.35 : 0.55}
                        scale={14}
                        blur={2.6}
                        far={4}
                    />
                </PaletteContext.Provider>
            </Canvas>
        </div>
    );
};

export default Hero3D;
