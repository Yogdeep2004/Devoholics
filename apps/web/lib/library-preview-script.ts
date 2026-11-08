/** Scripted loop for the signed-out Library preview. Plain data so it can be tested. */
export type LibraryStage = { saved: number; following: number; interests: number; feed: boolean; caption: 0 | 1 | 2 | 3; ms: number };

export const LIBRARY_CAPTIONS = [
  { title: "Save what you want to revisit", body: "Bookmark any tool from its profile and find it here later." },
  { title: "Follow what you depend on", body: "Releases and maintenance warnings for followed tools rise to the top of your feed." },
  { title: "Say what you care about", body: "Pick categories and matching updates get a boost." },
  { title: "See why each update is there", body: "Every card lists the exact rules that ranked it. No black box." },
] as const;

export const LIBRARY_STAGES: LibraryStage[] = [
  { saved: 0, following: 0, interests: 0, feed: false, caption: 0, ms: 1100 },
  { saved: 1, following: 0, interests: 0, feed: false, caption: 0, ms: 1100 },
  { saved: 2, following: 0, interests: 0, feed: false, caption: 0, ms: 1100 },
  { saved: 2, following: 1, interests: 0, feed: false, caption: 1, ms: 1600 },
  { saved: 2, following: 1, interests: 1, feed: false, caption: 2, ms: 1000 },
  { saved: 2, following: 1, interests: 2, feed: false, caption: 2, ms: 1300 },
  { saved: 2, following: 1, interests: 2, feed: true, caption: 3, ms: 3600 },
];

export const LIBRARY_FINAL: LibraryStage = { ...LIBRARY_STAGES[LIBRARY_STAGES.length - 1] };
export const MAX_SAVED = 2;
