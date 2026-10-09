import { useState } from "react";
import { ActivityIndicator, Linking, useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";

import { tiktokPlayerUrl } from "../lib/tiktok";
import { colors } from "../lib/theme";
import { Button } from "./ui";

// A TikTok recipe video playing right in Nook (REC-014), through TikTok's
// own embed player, with a button to open it in the TikTok app instead.
export function TikTokPlayer({ videoId, url, maxHeight = 560 }: { videoId: string; url: string; maxHeight?: number }) {
  const { width: screen } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  // A phone video is 9:16; keep it from taking over the whole screen.
  const height = Math.min(maxHeight, ((screen - 40) * 16) / 9);
  const width = (height * 9) / 16;

  return (
    <View style={{ gap: 10, alignItems: "center" }}>
      <View style={{ width, height, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" }}>
        <WebView
          source={{ uri: tiktokPlayerUrl(videoId) }}
          // The player builds parts of itself from blank pages (about:srcdoc,
          // about:blank); let those load instead of trying to open them.
          originWhitelist={["*"]}
          style={{ flex: 1, backgroundColor: "#000" }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          onLoadEnd={() => setLoading(false)}
          // Taps on links inside the player (the creator, "watch more") go
          // to the TikTok app rather than loading TikTok inside the box.
          onShouldStartLoadWithRequest={(request) => {
            if (!request.url.startsWith("http") || request.url.startsWith("https://www.tiktok.com/player/")) return true;
            // Only a tap on a link in the player itself, not its inner frames.
            if (request.navigationType === "click" && request.isTopFrame !== false) {
              Linking.openURL(request.url).catch(() => {});
              return false;
            }
            return true;
          }}
        />
        {loading ? (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </View>
      <Button title="Watch on TikTok" icon="play" variant="secondary" onPress={() => Linking.openURL(url).catch(() => {})} style={{ alignSelf: "stretch" }} />
    </View>
  );
}
