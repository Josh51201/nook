import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { tap } from "../../lib/feedback";
import { colors, ui } from "../../lib/theme";
import { placeLabel, type Place } from "../../lib/weather";
import { searchPlaces } from "../../lib/weather-data";
import { Icon } from "../icon";
import { Tap } from "../motion";
import { Text, TextInput } from "../text";
import { Chip } from "../ui";

// Find a town by name for the Weather and Window widgets (CORE-056, 057).
// Nook never asks for the phone's location: you type a place, and only that
// name goes to Open-Meteo to look it up.
export function PlacePicker({ value, onChange }: { value: Place | null; onChange: (place: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [changing, setChanging] = useState(!value);

  // Looks up what you've typed once you pause for a moment.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setFailed(false);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlaces(text)
        .then((places) => live && (setResults(places), setFailed(false)))
        .catch(() => live && (setResults([]), setFailed(true)))
        .finally(() => live && setSearching(false));
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (value && !changing) {
    return (
      <View style={[ui.row, { gap: 10 }]}>
        <Icon name="place" size={18} color={colors.bark} />
        <Text style={{ flex: 1, color: colors.text, fontWeight: "600" }} numberOfLines={2}>
          {placeLabel(value)}
        </Text>
        <Chip onPress={() => setChanging(true)}>Change</Chip>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.row, { gap: 10 }]}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Type a town or city"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator color={colors.bark} /> : null}
      </View>
      {results.map((place) => (
        <Tap
          key={`${place.lat},${place.lon}`}
          onPress={() => {
            tap();
            onChange(place);
            setChanging(false);
            setQuery("");
          }}
          style={[ui.row, { gap: 10, paddingVertical: 8 }]}
        >
          <Icon name="place" size={16} color={colors.muted} />
          <Text style={{ flex: 1, color: colors.text }} numberOfLines={2}>
            {placeLabel(place)}
          </Text>
        </Tap>
      ))}
      {failed ? <Text style={ui.muted}>Couldn't reach the weather service. Check your connection and try again.</Text> : null}
      {!searching && !failed && query.trim().length >= 2 && !results.length ? (
        <Text style={ui.muted}>No towns by that name. Try the nearest city.</Text>
      ) : null}
      {value ? (
        <Chip onPress={() => setChanging(false)}>Keep {value.name}</Chip>
      ) : null}
      <Text style={ui.muted}>Nook never uses your phone's location: only the town name you type is sent, to Open-Meteo, to find the weather.</Text>
    </View>
  );
}
