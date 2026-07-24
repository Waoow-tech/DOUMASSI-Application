// ENGLISH dictionary — `feed` namespace (E11-02).
// Must cover exactly the same keys as fr/feed.ts (typed as
// `FeedTranslations`, so a missing/mismatched key is a TypeScript error).

import type { FeedTranslations } from '../fr/feed';

export const feedEn: FeedTranslations = {
  time: {
    justNow: 'Just now',
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
    weeks: (n: number) => `${n}w ago`,
    months: (n: number) => `${n}mo ago`,
    years: (n: number) => `${n}y ago`,
  },

  tabs: {
    social: 'Social',
    business: 'Business',
    ai: 'AI',
    wallet: 'Wallet',
    soon: 'Soon',
    openTabA11y: (label: string) => `Open the ${label} tab`,
    placeholders: {
      business: {
        title: 'Marketplace coming soon',
        subtitle: 'Buy, sell, discover.',
      },
      ai: {
        title: 'Doumassi AI coming soon',
        subtitle: 'AI assistant, image generation and more.',
      },
      wallet: {
        title: 'Dpay coming soon',
        subtitle: 'Your built-in crypto wallet.',
      },
      soon: {
        title: 'Even more to come',
        subtitle: 'DOUMASSI keeps growing. Stay tuned.',
        manifest:
          'A social, business, creative and financial space designed to bring all your uses together in one universe.',
      },
    },
  },

  screen: {
    openProfileA11y: 'Open my profile',
    openSettingsA11y: 'Open settings',
    searchPostsPlaceholder: 'Search posts...',
    searchPlaceholder: 'Search...',
    emptyTitle: 'Follow accounts to see their posts here',
    emptyDiscover: 'Discover accounts',
    createPostA11y: 'Create a post',
    toastShareFailed: 'Sharing failed, please try again',
    toastPostDeleted: 'Post deleted',
    toastDeleteFailed: 'Delete failed, please try again',
    toastPostHidden: 'Post hidden',
    undo: 'Undo',
    toastDisplayRestored: 'Post restored',
    toastHideFailed: 'Hiding failed, please try again',
    toastLinkCopied: 'Link copied',
  },

  stories: {
    bar: {
      addStoryA11y: 'Add to your story',
      openStoryA11y: (username: string) => `Open @${username}'s story`,
      createStoryHint: 'Tap to create a new story',
      viewStoryHint: (username: string) => `Tap to watch @${username}'s story`,
      yourStory: 'Your story',
    },

    viewer: {
      time: {
        justNow: 'just now',
        minutes: (n: number) => `${n}m`,
        hours: (n: number) => `${n}h`,
      },
      errorTitle: 'No story to show',
      back: 'Back',
      previousA11y: 'Previous story',
      previousHint: 'Tap to go back to the previous story',
      resume: 'Resume',
      pause: 'Pause',
      resumeHint: 'Tap to resume playback',
      pauseHint: 'Tap to pause',
      nextA11y: 'Next story',
      nextHint: 'Tap to go to the next story',
      openAuthorA11y: (username: string) => `Open @${username}'s profile`,
      close: 'Close',
      seenByA11y: 'See who viewed this story',
      seenByHint: 'See the list of people who viewed this story',
      seenBy: 'Seen by',
    },

    viewers: {
      time: {
        justNow: 'just now',
        minutesAgo: (n: number) => `${n}m ago`,
        hoursAgo: (n: number) => `${n}h ago`,
        daysAgo: (n: number) => `${n}d ago`,
      },
      viewsLabel: (n: number) => `${n} ${n > 1 ? 'views' : 'view'}`,
      empty: 'No one has viewed this story yet',
    },

    create: {
      videoTooLongTitle: 'Video too long',
      videoTooLongMessage: (max: number) => `The video must be ${max} seconds long at most.`,
      errorTitle: 'Error',
      recordingFailed: 'Video recording failed. Check your microphone permissions.',
      permissionDeniedTitle: 'Permission denied',
      photoPermissionMessage: 'Enable photo access in Settings.',
      retake: 'Retake',
      publish: 'Publish',
      publishErrorFallback: 'Something went wrong while publishing.',
      cameraPermissionMessage: 'Enable camera access in Settings to use stories.',
      back: 'Back',
      closeCameraA11y: 'Close camera',
      photoModeA11y: 'Photo mode',
      videoModeA11y: 'Video mode',
      photo: 'Photo',
      video: 'Video',
      switchCameraA11y: 'Switch camera (front / back)',
      pickFromGalleryA11y: 'Choose from gallery',
      takePhotoA11y: 'Take a photo',
      holdToRecordA11y: 'Hold to record a video',
    },
  },

  postCard: {
    viewProfileA11y: (username: string) => `View @${username}'s profile`,
    openPost: 'Open post',
    openPostMedia: 'Open post media',
    seeMore: '...more',
    openMenuA11y: (username: string) => `Open the menu for @${username}'s post`,
    likeA11y: (username: string) => `Like @${username}'s post`,
    likeHintAdd: 'Tap to like this post',
    likeHintRemove: 'Tap to remove your like',
    commentA11y: (username: string) => `Comment on @${username}'s post`,
    shareA11y: (username: string) => `Share @${username}'s post`,
    bookmarkA11y: (username: string) => `Save @${username}'s post`,
    bookmarkHintAdd: 'Tap to save this post to your favorites',
    bookmarkHintRemove: 'Tap to remove this post from your favorites',
  },

  postDetail: {
    errorTitle: 'Post unavailable',
    back: 'Back',
    toggleOverlaysA11y: 'Show or hide the post controls',
    closeA11y: 'Close post',
  },

  postMenu: {
    share: 'Share',
    copyLink: 'Copy link',
    delete: 'Delete',
    hide: 'Hide this post',
    report: 'Report',
    linkCopiedTitle: 'Link copied',
    linkCopiedMessage: 'The post link is ready to be shared.',
    reportTitle: 'Report',
    reportMessage: 'This action will be available in Sprint 4.',
    deleteTitle: 'Delete this post?',
    deleteMessage: 'This action is irreversible. The post will be removed from the feed.',
    cancel: 'Cancel',
    deleteConfirm: 'Delete',
  },

  share: {
    outside: 'Share outside DOUMASSI',
    inside: 'Send on DOUMASSI',
  },

  comments: {
    title: 'Comments',
    closeA11y: 'Close comments',
    empty: 'Be the first to comment!',
    reply: 'Reply',
    replyA11y: (username: string) => `Reply to @${username}`,
    likeA11y: (username: string) => `Like @${username}'s comment`,
    replyingTo: (username: string) => `Replying to @${username}`,
    cancelReplyA11y: 'Cancel reply',
    inputPlaceholder: 'Add a comment...',
    deleteTitle: 'Delete this comment?',
    deleteMessage: 'This will remove the comment from the post.',
    cancel: 'Cancel',
    delete: 'Delete',
    sendErrorTitle: 'Comment not sent',
    sendErrorMessage: (message: string) => `${message} Please try again in a moment.`,
    publishErrorFallback: 'Unable to post this comment right now.',
    time: {
      minutes: (n: number) => `${n}m`,
      hours: (n: number) => `${n}h`,
      days: (n: number) => `${n}d`,
      weeks: (n: number) => `${n}w`,
      months: (n: number) => `${n}mo`,
      years: (n: number) => `${n}y`,
    },
  },

  mentions: {
    searching: 'Searching…',
    noResults: 'No user found',
    mentionA11y: (username: string) => `Mention @${username}`,
    profileA11y: (username: string) => `${username}'s profile`,
  },

  createPost: {
    discardTitle: 'Discard post?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    photoPermissionTitle: 'Permission denied',
    photoPermissionMessage: 'Enable photo access in Settings to add images.',
    cameraPermissionMessage: 'Enable camera access in Settings.',
    title: 'New post',
    publish: 'Publish',
    contentPlaceholder: "What's new?",
    uploadFailed: (n: number) => `Upload failed for ${n} image${n > 1 ? 's' : ''}.`,
    retry: 'Retry',
    tooManyMentions: (max: number) => `Maximum ${max} mentions per post.`,
    imagesCount: (n: number, max: number) => `${n}/${max} images`,
    // Video — E14-01
    videoPermissionMessage: 'Enable photo access in Settings to add a video.',
    videoTooLongTitle: 'Video too long',
    videoTooLongMessage: (secs: number) => `Pick a video of ${secs} seconds or less.`,
    videoWithImagesTitle: 'One media type only',
    videoWithImagesMessage:
      'A post holds either images or a video — not both. Remove the current media to switch.',
    videoLabel: '1 video',
    videoPreparing: 'Preparing video…',
  },

  bookmarks: {
    back: 'Back',
    title: 'Saved',
    emptyTitle: "You haven't saved anything yet",
    emptySubtitle: 'Tap the bookmark on a post to find it here',
  },

  businessHub: {
    seeMore: 'See more',
    comingSoon: 'Coming soon',
    openCategoryA11y: (label: string) => `Open ${label}`,
    comingSoonA11y: (label: string) => `${label} — coming soon`,
    categories: {
      marketplace: 'MARKETPLACE',
      films: 'MOVIES',
      immobilier: 'REAL ESTATE',
      jeux: 'GAMES',
      musique: 'MUSIC',
      cours: 'COURSES',
    },
  },

  search: {
    placeholder: 'Search users...',
    emptyState: 'Search by username or name',
    searchError: 'Search failed. Please try again.',
    noResults: (query: string) => `No users found for '@${query}'`,
    clearSearch: 'Clear search',
  },
};
