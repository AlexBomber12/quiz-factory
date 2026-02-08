export type StyleCard = {
  id: string;
  label: string;
  tone_guidance: string;
  structure_guidance: string;
  do_list: string[];
  dont_list: string[];
};

export const DEFAULT_STYLE_ID = "balanced";

export const STYLE_CARDS: Record<string, StyleCard> = {
  analytical: {
    id: "analytical",
    label: "Analytical",
    tone_guidance: "Use a precise and objective tone focused on evidence and trade-offs.",
    structure_guidance: "Prefer tight structure with short sections, bullet points, and explicit risk notes.",
    do_list: [
      "Use checklists where useful.",
      "Name concrete trade-offs and constraints.",
      "Call out assumptions and risks explicitly.",
      "Prioritize actionable recommendations."
    ],
    dont_list: [
      "Do not use vague motivational language.",
      "Do not hide uncertainty or known limitations.",
      "Do not use long narrative detours."
    ]
  },
  intuitive: {
    id: "intuitive",
    label: "Intuitive",
    tone_guidance: "Use a warm and encouraging tone with clear emotional framing.",
    structure_guidance: "Use short narrative flow with examples, metaphors, and gentle reflective prompts.",
    do_list: [
      "Include relatable examples.",
      "Use simple metaphors to explain patterns.",
      "Name emotional states in a supportive way.",
      "Offer gentle next-step prompts."
    ],
    dont_list: [
      "Do not sound clinical or detached.",
      "Do not overload with technical jargon.",
      "Do not use harsh or judgmental language."
    ]
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    tone_guidance: "Use a neutral and practical tone with concise, actionable wording.",
    structure_guidance: "Use short paragraphs supported by focused bullet points.",
    do_list: [
      "Keep explanations specific and grounded.",
      "Balance clarity with brevity.",
      "Provide practical actions with context."
    ],
    dont_list: [
      "Do not overstate certainty.",
      "Do not be overly technical or overly poetic.",
      "Do not produce long, dense paragraphs."
    ]
  }
};
