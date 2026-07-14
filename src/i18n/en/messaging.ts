// ENGLISH dictionary — `messaging` namespace (E11-04).
// Must cover exactly the same keys as fr/messaging.ts (typed as
// `MessagingTranslations`, so a missing/mismatched key is a TypeScript error).

import type { MessagingTranslations } from '../fr/messaging';

export const messagingEn: MessagingTranslations = {
  common: {
    back: 'Back',
    cancel: 'Cancel',
    clearSearch: 'Clear search',
    searchByUsernameOrName: 'Search by username or name',
    searchError: 'Search failed. Please try again.',
    noResultsFor: (query: string) => `No users found for '@${query}'`,
  },

  list: {
    title: 'Messages',
    emptyState: 'No conversations yet, start one with the +',
    newConversationA11y: 'New conversation',
  },

  conversationRow: {
    noMessage: 'No messages',
    conversationWith: (name: string) => `Conversation with ${name}`,
    time: {
      now: 'now',
      minutesAgo: (n: number) => `${n} min`,
      hoursAgo: (n: number) => `${n} h`,
      daysAgo: (n: number) => `${n} d`,
    },
  },

  conversation: {
    replyAuthorSelf: 'your message',
    replyAuthorUnknown: '@a member',
    replyAuthorFallback: 'Message',
    attachmentPhoto: '📷 Photo',
    attachmentVoice: '🎙️ Voice message',
    attachmentVideo: '🎬 Video',
    replyParentUnloaded: 'Scroll up to see the original message…',
    sendErrorTitle: 'Sending failed',
    uploadErrorTitle: 'Upload failed',
    uploadFailedFallback: 'Upload failed',
    uploadAudioFailedFallback: 'Audio upload failed',
    attachSheetTitle: 'Add an image',
    galleryOption: 'Gallery',
    cameraOption: 'Camera',
    permissionDeniedTitle: 'Permission denied',
    photoPermissionMessage: 'Enable photo access in Settings.',
    cameraPermissionMessage: 'Enable camera access in Settings.',
    parentNotLoadedTitle: 'Message not loaded',
    parentNotLoadedMessage: 'The parent message is too old. Scroll up and try again.',
    realtimeDown: 'Realtime connection unavailable — pull to refresh',
    emptyConversation: 'No messages yet. Start the conversation 👋',
  },

  bubble: {
    deletedMessage: '🚫 Message deleted',
    goToReplyA11y: (author: string) => `Go to ${author}'s message`,
    imageSentA11y: 'Sent image',
    sendFailed: 'Failed — tap to retry',
    edited: 'edited',
  },

  voice: {
    pauseA11y: 'Pause',
    playA11y: 'Play voice message',
  },

  input: {
    placeholder: 'Write a message…',
    replyingTo: (author: string) => `Replying to ${author}`,
    cancelReplyA11y: 'Cancel reply',
    tooManyMentions: (max: number) => `Maximum ${max} mentions per message.`,
    recording: (current: number, max: number) => `Recording… ${current}s / ${max}s`,
    addImageA11y: 'Add an image',
    addImageHint: 'Tap to open the gallery or take a photo',
    stopRecordingA11y: 'Stop recording',
    recordVoiceA11y: 'Record a voice message',
    stopRecordingHint: 'Tap to stop and send the recording',
    recordVoiceHint: 'Tap to start a voice recording',
    sendA11y: 'Send message',
  },

  actionSheet: {
    reply: 'Reply',
    edit: 'Edit',
    delete: 'Delete',
    editHeader: 'Edit message',
    editPlaceholder: 'Type your message…',
    save: 'Save',
    replyA11y: 'Reply to this message',
    editA11y: 'Edit this message',
    deleteA11y: 'Delete this message',
    emptyContentTitle: 'Empty content',
    emptyContentMessage: 'The message cannot be empty.',
    editFailedTitle: 'Could not edit',
    deleteFailedTitle: 'Could not delete',
    retryLater: 'Please try again in a moment.',
    deleteConfirmTitle: 'Delete this message?',
    deleteConfirmMessage:
      'The content will be replaced by "Message deleted" for all participants. This cannot be undone.',
    deleteAction: 'Delete',
  },

  newConversation: {
    toggleDmA11y: 'New one-to-one conversation',
    toggleGroupA11y: 'New group',
    toggleDmLabel: 'Conversation',
    toggleGroupLabel: 'Group',
    titleDm: 'New conversation',
    titleGroup: 'New group',
    groupNamePlaceholder: 'Group name',
    groupNameA11y: 'Group name',
    removeParticipantA11y: (username: string) => `Remove @${username}`,
    searchUserPlaceholder: 'Search for a user...',
    addMembersPlaceholder: 'Add members...',
    searchUserA11y: 'Search for a user',
    searchGroupA11y: 'Search to add to the group',
    searchHintGroup: 'Search and tap members to add them',
    createGroupFailedFallback: 'Creation failed',
    createGroupA11y: 'Create group',
    creating: 'Creating…',
    createGroupButton: (count: number) => `Create group (${count})`,
  },

  share: {
    toastSelectOther: 'Choose another user',
    toastSent: 'Sent on DOUMASSI',
    toastSendFailed: 'Sending failed, please try again',
    title: 'Send on DOUMASSI',
    searchPlaceholder: 'Search for a user...',
    linkUnavailable: 'Link to share unavailable.',
  },

  errors: {
    groupNameRequired: 'Group name is required',
    groupNameTooLong: 'Name too long (max 80 characters)',
    participantRequired: 'Select at least one participant',
    invalidRpcResponse: 'Invalid RPC response',
    messageEmpty: 'Empty message',
    messageTooLong: (max: number) => `Message too long (max ${max} characters)`,
    attachmentUrlRequired: 'Attachment URL required for this message type',
    sessionExpired: 'Session expired. Please sign in again.',
    editContentEmpty: 'Empty content',
  },

  deletedAccount: 'Deleted account',

  calls: {
    startErrorTitle: 'Could not start the call',
    startInvalidResponse: 'Invalid Edge Function response',
    audioCallA11y: 'Audio call',
    videoCallA11y: 'Video call',
    audioCallHint: (name: string) => `Tap to call ${name} with audio`,
    videoCallHint: (name: string) => `Tap to call ${name} with video`,

    entry: {
      noAnswer: 'No answer',
      missed: 'Missed call',
      rejectedByRecipient: 'Call declined by recipient',
      rejected: 'Call declined',
      cancelled: 'Call cancelled',
      videoCall: 'Video call',
      audioCall: 'Audio call',
      tapToRecall: 'Tap to call back.',
    },

    active: {
      connecting: 'Calling…',
      ended: 'Call ended',
      connectingToRoom: 'Connecting to the room…',
      muteMicA11y: 'Mute microphone',
      unmuteMicA11y: 'Unmute microphone',
      turnOffCameraA11y: 'Turn off camera',
      turnOnCameraA11y: 'Turn on camera',
      switchCameraA11y: 'Switch camera',
      hangUpA11y: 'Hang up',
    },

    incoming: {
      fallbackName: 'Incoming call',
      incomingVideo: 'Incoming video call',
      incomingAudio: 'Incoming audio call',
      declineA11y: 'Decline call',
      acceptA11y: 'Accept call',
      declineHint: 'Tap to decline this incoming call',
      acceptHint: (callType: 'audio' | 'video') =>
        `Tap to answer the ${callType === 'video' ? 'video' : 'audio'} call`,
    },

    permissions: {
      deniedTitle: 'Permission denied',
      deviceMic: 'microphone',
      deviceCamera: 'camera',
      deniedMessage: (device: string) =>
        `DOUMASSI needs access to your ${device} to make this call. Enable the permission in Settings.`,
      openSettings: 'Open Settings',
    },
  },
};
