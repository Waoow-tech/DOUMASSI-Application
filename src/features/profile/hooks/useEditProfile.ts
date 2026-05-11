import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { EditProfileFormValues } from '@/features/profile/schemas/editProfileSchema';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import { type CurrentProfile, profileQueryKey } from './useProfileQuery';

type SaveProfileInput = {
  values: EditProfileFormValues;
  currentProfile: CurrentProfile;
  uploadAvatar: (userId: string) => Promise<string | undefined>;
  uploadCover: (userId: string) => Promise<string | undefined>;
  hasAvatarChange: boolean;
  hasCoverChange: boolean;
};

function nullableTrim(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useEditProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      values,
      currentProfile,
      uploadAvatar,
      uploadCover,
      hasAvatarChange,
      hasCoverChange,
    }: SaveProfileInput) => {
      const updates: Record<string, unknown> = {};
      const fullName = values.fullName.trim();
      const displayName = nullableTrim(values.displayName);
      const bio = nullableTrim(values.bio);
      const username = values.username.trim().toLowerCase();
      const currentUsername = currentProfile.username?.toLowerCase() ?? '';

      if (fullName !== (currentProfile.full_name ?? '')) updates.full_name = fullName;
      if (displayName !== currentProfile.display_name) updates.display_name = displayName;
      if (bio !== currentProfile.bio) updates.bio = bio;
      if (values.isProfessional !== Boolean(currentProfile.is_professional)) {
        updates.is_professional = values.isProfessional;
      }

      if (hasAvatarChange) {
        const avatarUrl = await uploadAvatar(currentProfile.id);
        if (avatarUrl) updates.avatar_url = avatarUrl;
      }

      if (hasCoverChange) {
        const coverUrl = await uploadCover(currentProfile.id);
        if (coverUrl) updates.cover_url = coverUrl;
      }

      if (username !== currentUsername) {
        const { error } = await supabase.rpc('update_username', {
          p_username: username,
        });

        if (error) throw error;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentProfile.id);

        if (error) throw error;
      }

      logger.info('Profile updated', {
        userId: currentProfile.id,
        changedFields: Object.keys(updates),
        usernameChanged: username !== currentUsername,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
