import { supabase } from "./supabaseClient.js";

/**
 * Create or update a user profile in Supabase
 * Called when a user logs in via OAuth
 */
export async function upsertUserProfile(userData) {
  try {
    const { email, name } = userData;

    if (!email) {
      return { success: false, error: "Email is required" };
    }

    console.log("🔍 Checking if user exists:", email);

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows returned (user doesn't exist)
      console.error("❌ Error fetching user:", fetchError);
      return { success: false, error: fetchError.message };
    }

    if (existingUser) {
      // User exists - update their name
      console.log("✅ User exists, updating profile...");

      const { data: updatedUser, error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name || existingUser.name,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Error updating user:", updateError);
        return { success: false, error: updateError.message };
      }

      console.log("✅ User profile updated successfully");
      return { success: true, data: updatedUser, isNewUser: false };
    } else {
      // New user - create profile
      console.log("🆕 New user, creating profile...");

      const { data: newUser, error: insertError } = await supabase
        .from("profiles")
        .insert([
          {
            email: email,
            name: name || "Anonymous User",
            total_wins: 0,
            total_debates: 0,
            total_score: 0,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creating user:", insertError);
        return { success: false, error: insertError.message };
      }

      console.log("✅ User profile created successfully");
      return { success: true, data: newUser, isNewUser: true };
    }
  } catch (error) {
    console.error("❌ Unexpected error in upsertUserProfile:", error);
    return { success: false, error: error.message };
  }
}
