import { supabase } from "./supabaseClient";

export class FileUploadService {
  static bucket = "user-files";

  static async uploadFile(file: File, purpose = "file") {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    if (!authData.user) throw new Error("Not authenticated");

    const uid = authData.user.id;

    const safeName = file.name.replace(/[^\w.\-()+\s]/g, "_");
    const fileId = crypto.randomUUID();
    const objectPath = `users/${uid}/${purpose}/${fileId}/${safeName}`;

    // 1) upload binary
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(this.bucket)
      .upload(objectPath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    // 2) write metadata row
    const { data: row, error: rowErr } = await supabase
      .from("files")
      .insert({
        owner_id: uid,
        bucket_id: this.bucket,
        object_path: uploadData.path, // обычно равен objectPath
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        metadata: { purpose },
        status: "uploaded",
      })
      .select()
      .single();

    if (rowErr) throw rowErr;

    return row;
  }

  static async getSignedDownloadUrl(objectPath: string, expiresIn = 60) {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  static async deleteFile(objectPath: string) {
    // 1) remove object
    const { error: delErr } = await supabase.storage
      .from(this.bucket)
      .remove([objectPath]);

    if (delErr) throw delErr;

    // 2) soft delete metadata
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) throw new Error("Not authenticated");

    const { error: updErr } = await supabase
      .from("files")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("owner_id", uid)
      .eq("object_path", objectPath);

    if (updErr) throw updErr;
  }
}
