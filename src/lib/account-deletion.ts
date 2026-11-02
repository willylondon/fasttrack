const AVATAR_BUCKET = "avatars";
const AVATAR_PAGE_SIZE = 100;

type StorageResult<T> = Promise<{ data: T | null; error: unknown }>;

export type AccountDeletionClient = {
  storage: {
    from(bucket: string): {
      list(path: string, options: { limit: number }): StorageResult<{ name: string }[]>;
      remove(paths: string[]): StorageResult<unknown>;
    };
  };
  schema(name: "next_auth"): {
    from(table: "users"): {
      delete(): {
        eq(column: "id", value: string): PromiseLike<{ error: unknown }>;
      };
    };
  };
};

/**
 * Permanently deletes an account. Removing the next_auth user cascades through
 * sessions, linked sign-ins, the profile and every profile-owned table.
 * Avatars live outside the database and are publicly readable, so they go first:
 * a storage failure stops here with the account intact and safe to retry.
 */
export async function deleteAccount(supabase: AccountDeletionClient, userId: string) {
  const avatars = supabase.storage.from(AVATAR_BUCKET);

  for (;;) {
    const { data: files, error: listError } = await avatars.list(userId, { limit: AVATAR_PAGE_SIZE });

    if (listError) {
      throw listError;
    }

    if (!files?.length) {
      break;
    }

    const { error: removeError } = await avatars.remove(files.map((file) => `${userId}/${file.name}`));

    if (removeError) {
      throw removeError;
    }
  }

  const { error } = await supabase.schema("next_auth").from("users").delete().eq("id", userId);

  if (error) {
    throw error;
  }
}
