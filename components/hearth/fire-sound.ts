import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { fireVolume, type FireSound } from "../../lib/decor";

// The soft fireplace sound (CORE-047). One player for the whole app: the
// Hearth and each Hollow ask for it while they're on screen, and it plays
// at the loudest volume anyone's asking for. It fades in, fades out when
// you open a Nook or leave the app, and stepping from the Hearth into a
// Hollow carries straight on. The sound is Josh's pick, assets/sounds/fireplace.mp3.

let player: AudioPlayer | null = null;
let modeReady = false;
const wanted = new Map<symbol, number>();
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

function fadeTo(volume: number, done?: () => void) {
  if (!player) return;
  if (fadeTimer) clearInterval(fadeTimer);
  const from = player.volume;
  const steps = volume > from ? 24 : 12; // 1.2 s in, 0.6 s out
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    if (player) player.volume = from + ((volume - from) * step) / steps;
    if (step >= steps) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, 50);
}

function update() {
  const volume = Math.max(0, ...wanted.values());
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
  if (volume > 0) {
    if (!modeReady) {
      modeReady = true;
      // Quiet on silent, never in the background, and never stops your music.
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
    }
    if (!player) {
      player = createAudioPlayer(require("../../assets/sounds/fireplace.mp3"));
      player.loop = true;
      player.volume = 0;
    }
    if (!player.playing) player.play();
    fadeTo(volume);
  } else if (player?.playing) {
    // A moment's grace, so going from the Hearth into a Hollow doesn't stutter.
    pauseTimer = setTimeout(() => fadeTo(0, () => player?.pause()), 300);
  }
}

// Ask for the fire while this screen is showing and the app is open.
export function useFireSound(sound: FireSound | undefined) {
  const focused = useIsFocused();
  const [awake, setAwake] = useState(AppState.currentState === "active");
  const id = useRef(Symbol("fire")).current;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAwake(state === "active"));
    return () => subscription.remove();
  }, []);

  const volume = focused && awake ? fireVolume(sound) : 0;
  useEffect(() => {
    if (volume) wanted.set(id, volume);
    else wanted.delete(id);
    update();
  }, [id, volume]);

  useEffect(
    () => () => {
      wanted.delete(id);
      update();
    },
    [id]
  );
}
