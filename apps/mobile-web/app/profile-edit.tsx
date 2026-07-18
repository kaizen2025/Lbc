import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { colors, radius, spacing } from "../src/theme";

export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { retry: false });
  const update = trpc.profile.update.useMutation({
    onSuccess: () => void utils.profile.me.invalidate(),
  });

  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (me.data?.profile) {
      setUsername(me.data.profile.username);
      setCity(me.data.profile.city ?? "");
      if (me.data.profile.latitude != null && me.data.profile.longitude != null) {
        setCoords({ lat: me.data.profile.latitude, lng: me.data.profile.longitude });
      }
    }
  }, [me.data]);

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus(t("profileEdit.locationDenied"));
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    const places = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const detectedCity = places[0]?.city ?? places[0]?.subregion ?? "";
    if (detectedCity) setCity(detectedCity);
    setLocationStatus(t("profileEdit.locationSet", { city: detectedCity || "✓" }));
  }

  function save() {
    update.mutate({
      username: username || undefined,
      city: city || undefined,
      latitude: coords?.lat,
      longitude: coords?.lng,
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>{t("profileEdit.title")}</Text>
      <Card>
        <Muted>{t("profileEdit.username")}</Muted>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Muted>{t("profileEdit.city")}</Muted>
        <TextInput style={styles.input} value={city} onChangeText={setCity} />
        <Pressable style={styles.secondary} onPress={() => void useMyLocation()}>
          <Text style={styles.secondaryText}>{t("profileEdit.useMyLocation")}</Text>
        </Pressable>
        {locationStatus && <Muted>{locationStatus}</Muted>}
        <Muted>{t("profileEdit.locationHint")}</Muted>
        <Pressable style={styles.cta} onPress={save} disabled={update.isPending}>
          <Text style={styles.ctaText}>
            {update.isPending ? t("common.loading") : t("common.save")}
          </Text>
        </Pressable>
        {update.isSuccess && <Muted>{t("profileEdit.saved")}</Muted>}
        {update.isError && <Muted>{update.error.message}</Muted>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
  },
  secondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  secondaryText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  ctaText: { color: colors.background, fontSize: 16, fontWeight: "800" },
});
