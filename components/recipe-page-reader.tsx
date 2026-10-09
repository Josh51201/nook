import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

// REC-008: some recipe sites (Cloudflare's "Just a moment…" check) turn
// away a plain download and only let a real browser in. This opens the
// page in an invisible browser, waits for the check to pass, then hands
// back just the recipe data, the page title and its picture tags, ready for
// parseRecipePage. Gives up (null) after 25 seconds.

const READ_PAGE = `(function () {
  var tries = 0;
  function grab() {
    tries++;
    var blocked = /just a moment|attention required|simple page|access denied/i.test(document.title) ||
      !!document.querySelector('#challenge-form, #cf-challenge-running, .cf-turnstile');
    var ld = [].slice.call(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(function (s) { return '<script type="application/ld+json">' + s.textContent + '</scr' + 'ipt>'; })
      .join('');
    if (!blocked && (ld || tries > 6)) {
      var metas = [].slice.call(document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]'))
        .map(function (m) { return m.outerHTML; }).join('');
      var title = '<title>' + document.title.replace(/</g, '') + '</title>';
      window.ReactNativeWebView.postMessage(JSON.stringify({ url: location.href, html: title + metas + ld }));
      return;
    }
    if (tries < 30) setTimeout(grab, 700);
  }
  grab();
})();
true;`;

export function RecipePageReader({ url, onDone }: { url: string; onDone: (page: { url: string; html: string } | null) => void }) {
  const finished = useRef(false);
  const done = (page: { url: string; html: string } | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(page);
  };

  useEffect(() => {
    const timeout = setTimeout(() => done(null), 25000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }} pointerEvents="none">
      <WebView
        source={{ uri: url }}
        injectedJavaScript={READ_PAGE}
        onMessage={(event) => {
          try {
            const page = JSON.parse(event.nativeEvent.data) as { url: string; html: string };
            done(typeof page.html === "string" ? page : null);
          } catch {
            done(null);
          }
        }}
        onError={() => done(null)}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        mediaPlaybackRequiresUserAction
        style={{ width: 360, height: 640 }}
      />
    </View>
  );
}
