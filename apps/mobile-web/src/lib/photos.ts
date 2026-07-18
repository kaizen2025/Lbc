import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const BUCKET = "cardtrade-listings";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Ouvre la galerie, compresse, uploade dans le dossier de l'utilisateur
 * (`<uid>/...` — imposé par la policy Storage) et renvoie l'URL publique.
 * Renvoie null si l'utilisateur annule.
 */
export async function pickAndUploadPhoto(userId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
    allowsEditing: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;

  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(asset.base64), {
      contentType: asset.mimeType ?? "image/jpeg",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
