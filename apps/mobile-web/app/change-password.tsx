import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen, SectionTitle } from "../src/components/ui";
import { formStyles } from "../src/components/forms";
import { supabase } from "../src/lib/supabase";
import { colors } from "../src/theme";

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 6) {
      setMessage(t("password.tooShort"));
      return;
    }
    if (password !== confirm) {
      setMessage(t("password.mismatch"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(t("password.changed"));
    setTimeout(() => router.back(), 800);
  }

  return (
    <Screen>
      <SectionTitle>{t("password.change")}</SectionTitle>
      <Card>
        <TextInput
          style={formStyles.input}
          placeholder={t("password.new")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={formStyles.input}
          placeholder={t("password.confirm")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
        <Pressable style={formStyles.cta} onPress={() => void submit()} disabled={busy}>
          <Text style={formStyles.ctaText}>
            {busy ? t("common.loading") : t("common.save")}
          </Text>
        </Pressable>
        {message && <Muted>{message}</Muted>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({});
