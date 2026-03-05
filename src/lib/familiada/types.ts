export type GameDoc = {
  title: string;
  ownerUid: string;
  status: "setup" | "live" | "ended";
  createdAt: any;
  updatedAt: any;
};

export type TeamDoc = {
  name: string;
  members: string[];
  score: number;
  createdAt: any;
};

export type RoundDoc = {
  index: number;
  title: string;
  multiplier: number; // 1,2,3
  type: "normal" | "final";
  createdAt: any;
};

export type Answer = { text: string; points: number; variants?: string[] };

export type QuestionDoc = {
  index: number;
  text: string;
  timeLimitSec: number;
  answers: Answer[];
  createdAt: any;
};

export type LiveStateDoc = {
  currentRoundId: string | null;
  currentQuestionId: string | null;
  revealedIdx: number[];
  strikesByTeam: Record<string, number>;
  timer: {
    running: boolean;
    startedAt: any | null; // Firestore Timestamp
    durationSec: number;
  };
};