import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { colors, radius, spacing } from "../src/theme";

export default function AuthScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const { error, data } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      setMessage(t("auth.checkEmail"));
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <Text style={styles.title}>
        {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
      </Text>
      <Card>
        <TextInput
          style={styles.input}
          placeholder={t("auth.email")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t("auth.password")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.cta} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.ctaText}>
            {busy
              ? t("common.loading")
              : mode === "signin"
                ? t("auth.signIn")
                : t("auth.signUp")}
          </Text>
        </Pressable>
        {message && <Muted>{message}</Muted>}
      </Card>
      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
        <Text style={styles.switchMode}>
          {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
        </Text>
      </Pressable>
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
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  ctaText: { color: colors.background, fontSize: 16, fontWeight: "800" },
  switchMode: { color: colors.accent, fontSize: 15, fontWeight: "600" },
});
