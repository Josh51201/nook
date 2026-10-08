import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { tap } from "../../lib/feedback";
import { COLUMNS, type HearthItem, type WidgetItem } from "../../lib/hearth-layout";
import {
  homeSpot,
  hopPath,
  isNight,
  perchStillThere,
  petSays,
  petSizeForStride,
  pickPerch,
  type PetSize,
  type Spot,
} from "../../lib/hearth-pet";
import { useHearthPetInfo } from "../../lib/pets-data";
import type { WidgetOf } from "../../lib/widgets";
import { Icon } from "../icon";
import { Text } from "../text";
import { GRID_GAP } from "./hearth-grid";
import { CritterArt, Snooze } from "./pet-art";

// The Hearth pet out and about (CORE-048). While you're looking at your
// Hearth (not editing it), each pet is drawn here, on a layer over the grid,
// instead of inside its bed widget: it hops out now and then to sit on top
// of your other widgets and Nooks, sometimes naps there, and comes home.
// It stays in bed at night, when it's waiting for a late meal from Pet Care,
// or when it's set to stay home. Tap it for a little hello.

type PetBed = WidgetItem & { widget: WidgetOf<"companion"> };

export function isPetBed(item: HearthItem): item is PetBed {
  return item.kind === "widget" && item.widget.kind === "companion";
}

export function strideFor(gridWidth: number) {
  return (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS + GRID_GAP;
}

export function PetRoamers({ items, gridWidth, refreshKey, themeText }: { items: HearthItem[]; gridWidth: number; refreshKey: number; themeText: string }) {
  if (!gridWidth) return null;
  const stride = strideFor(gridWidth);
  const pet = petSizeForStride(stride);
  const beds = items.filter(isPetBed);
  if (!beds.length) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {beds.map((bed) => (
        <PetRoamer key={bed.id} bed={bed} items={items} stride={stride} pet={pet} gridWidth={gridWidth} refreshKey={refreshKey} themeText={themeText} />
      ))}
    </View>
  );
}

const HOP_MS = 360;
const between = (low: number, high: number) => low + Math.random() * (high - low);

function PetRoamer({
  bed,
  items,
  stride,
  pet,
  gridWidth,
  refreshKey,
  themeText,
}: {
  bed: PetBed;
  items: HearthItem[];
  stride: number;
  pet: PetSize;
  gridWidth: number;
  refreshKey: number;
  themeText: string;
}) {
  const settings = bed.widget.settings;
  const info = useHearthPetInfo(settings.petId, refreshKey);
  const name = info?.name ?? settings.name;
  const hungry = info?.hungryFor ?? null;
  const photoUrl = settings.photo ? info?.photoUrl ?? null : null;

  const home = () => homeSpot(bed, stride, GRID_GAP, pet);
  const start = useRef(home()).current;
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const jump = useSharedValue(0);
  const hop = useSharedValue(0);
  const breathe = useSharedValue(0);
  const spot = useRef<Spot>(start);
  const moving = useRef(false);
  const visits = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [asleep, setAsleep] = useState(isNight());
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hearts, setHearts] = useState(0);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  function say(text: string, ms = 3400) {
    clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }

  function schedule(ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (alive.current) stepRef.current();
    }, ms);
  }

  // Hop along to `to`, a few bounds at a time, then carry on with `then`.
  function travel(to: Spot, then: () => void) {
    const from = { x: x.value, y: y.value };
    const hops = hopPath(from, to, stride * 1.5);
    if (Math.abs(to.x - from.x) > 2) setFacing(to.x > from.x ? 1 : -1);
    setAsleep(false);
    moving.current = true;
    const timing = { duration: HOP_MS, easing: Easing.linear };
    const [first, ...rest] = hops;
    x.value = withSequence(withTiming(first.x, timing), ...rest.map((h) => withTiming(h.x, timing)));
    y.value = withSequence(withTiming(first.y, timing), ...rest.map((h) => withTiming(h.y, timing)));
    const arc = () => [
      withTiming(1, { duration: HOP_MS / 2, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: HOP_MS / 2, easing: Easing.in(Easing.quad) }),
    ];
    const [up, down] = arc();
    jump.value = withSequence(up, down, ...hops.slice(1).flatMap(arc));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      moving.current = false;
      spot.current = to;
      if (alive.current) then();
    }, hops.length * HOP_MS + 40);
  }

  function arriveAndRest() {
    // Sometimes it curls up for a nap wherever it lands.
    setAsleep(Math.random() < 0.25);
    schedule(between(6000, 13000));
  }

  function goHome() {
    visits.current = 0;
    travel(home(), () => {
      // Settles into bed facing the way it's drawn there.
      setFacing(1);
      setAsleep(isNight() || Math.random() < 0.6);
      schedule(between(12000, 22000));
    });
  }

  function step() {
    if (moving.current) return;
    const night = isNight();
    if (spot.current.on && !perchStillThere(spot.current, items, stride, GRID_GAP, pet)) return goHome();
    if (night || hungry || !settings.wanders) {
      if (spot.current.on) return goHome();
      setAsleep(night || (!hungry && Math.random() < 0.5));
      if (hungry && !night) say(petSays(name, settings.critter, "hungry", Math.random, hungry), 4200);
      return schedule(night ? 60000 : 40000);
    }
    if (spot.current.on) {
      visits.current += 1;
      if (visits.current >= 3 || Math.random() < 0.3) return goHome();
    }
    const next = pickPerch(items, bed.id, stride, GRID_GAP, pet, gridWidth, Math.random, spot.current.on);
    if (!next) {
      setAsleep(true);
      return schedule(20000);
    }
    travel(next, arriveAndRest);
  }
  const stepRef = useRef(step);
  stepRef.current = step;

  // Start and stop with the screen.
  useEffect(() => {
    if (!focused) return;
    alive.current = true;
    if (!moving.current) schedule(between(2500, 5500));
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      if (moving.current) {
        // Paused mid-hop: land where it was headed.
        cancelAnimation(x);
        cancelAnimation(y);
        cancelAnimation(jump);
        moving.current = false;
        spot.current = home();
        x.value = spot.current.x;
        y.value = spot.current.y;
        jump.value = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  // The Hearth changed under it: at home, follow the bed; out visiting
  // something that moved or went away, head home.
  const bedKey = `${bed.x},${bed.y},${bed.w},${bed.h},${stride}`;
  useEffect(() => {
    if (moving.current) return;
    if (!spot.current.on) {
      const at = home();
      spot.current = at;
      x.value = at.x;
      y.value = at.y;
    } else if (!perchStillThere(spot.current, items, stride, GRID_GAP, pet) && alive.current) {
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedKey, items]);

  // A blink now and then, and a slow breath.
  useEffect(() => {
    if (asleep || !focused) return;
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, between(3200, 4800));
    return () => clearInterval(id);
  }, [asleep, focused]);
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: asleep ? 1800 : 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: asleep ? 1800 : 1300, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [asleep, breathe]);

  function pet_() {
    tap();
    setAsleep(false);
    setHearts((n) => n + 1);
    if (!moving.current) hop.value = withSequence(withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 210, easing: Easing.in(Easing.quad) }));
    say(petSays(name, settings.critter, hungry ? "hungry" : "happy", Math.random, hungry));
  }

  const arcHeight = pet.h * 0.7;
  const place = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value - jump.value * arcHeight - hop.value * pet.h * 0.35 }],
  }));
  const body = useAnimatedStyle(() => ({
    transformOrigin: "bottom",
    transform: [
      { scaleY: (asleep ? 0.93 : 1) + breathe.value * 0.025 + jump.value * 0.06 },
      { scaleX: 1 - jump.value * 0.04 },
    ],
  }));

  // Keep the speech bubble on the grid near the edges.
  const nearLeft = spot.current.x < 70;
  const nearRight = spot.current.x > gridWidth - pet.w - 70;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.pet, { width: pet.w, height: pet.h }, place]}>
      {bubble ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            { bottom: pet.h + 4 },
            nearLeft ? { left: 0, alignItems: "flex-start" } : nearRight ? { right: 0, alignItems: "flex-end" } : { left: pet.w / 2 - 90 },
          ]}
        >
          <View style={styles.bubbleCard}>
            <Text style={styles.bubbleText} numberOfLines={2}>
              {bubble}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      {hearts ? <FloatingHeart key={hearts} size={pet.w * 0.32} left={pet.w * 0.55} /> : null}
      {asleep ? (
        <View pointerEvents="none" style={{ position: "absolute", right: -pet.w * 0.2, top: -pet.h * 0.3 }}>
          <Snooze size={pet.w * 0.5} color={themeText} />
        </View>
      ) : null}
      <Pressable onPress={pet_} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${name}, your Hearth pet`}>
        <Animated.View style={body}>
          <CritterArt
            critter={settings.critter}
            fur={settings.fur}
            width={pet.w}
            height={pet.h}
            eyesClosed={asleep || blink}
            photoUrl={photoUrl}
            flip={facing === -1}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function FloatingHeart({ size, left }: { size: number; left: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [{ translateY: -t.value * size * 2.4 }, { scale: 0.6 + Math.min(1, t.value * 3) * 0.5 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left, top: -size * 0.4 }, style]}>
      <Icon name="heart" size={size} color="#e5596f" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pet: { position: "absolute", left: 0, top: 0, zIndex: 200 },
  bubble: { position: "absolute", width: 180, alignItems: "center" },
  bubbleCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    boxShadow: "0px 2px 8px rgba(40, 24, 12, 0.18)",
  },
  bubbleText: { color: "#2a2420", fontSize: 13, fontWeight: "600", textAlign: "center" },
});
