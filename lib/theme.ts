import { StyleSheet } from "react-native";

// Cozy palette already used across the Hearth and sign-in screens.
export const colors = {
  bark: "#8a5a3b",
  cream: "#f5ece3",
  text: "#222",
  muted: "#777",
  border: "#ddd",
  error: "#c0392b",
  white: "#fff",
};

export const ui = StyleSheet.create({
  screen: { padding: 20, gap: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: colors.cream, borderRadius: 14, padding: 16, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: -8 },
  button: { backgroundColor: colors.bark, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.bark,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.bark, fontSize: 15, fontWeight: "600" },
  link: { color: colors.bark, fontSize: 15 },
  error: { color: colors.error },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.bark,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.bark },
  chipText: { color: colors.bark, fontSize: 14 },
  chipTextSelected: { color: colors.white },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
