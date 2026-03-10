export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export type Subject = {
  id: string;
  name: string;
  icon: string;
  color: string;
  textbook: string;
};

export const SUBJECTS: Subject[] = [
  {
    id: "chinese",
    name: "语文",
    icon: "BookOpen",
    color: "bg-red-500",
    textbook: "义务教育教科书·语文",
  },
  {
    id: "math",
    name: "数学",
    icon: "Calculator",
    color: "bg-blue-500",
    textbook: "义务教育教科书·数学",
  },
  {
    id: "english",
    name: "英语",
    icon: "Languages",
    color: "bg-purple-500",
    textbook: "义务教育教科书·英语",
  },
  {
    id: "morality",
    name: "道德与法治",
    icon: "ShieldCheck",
    color: "bg-orange-500",
    textbook: "义务教育教科书·道德与法治",
  },
  {
    id: "science",
    name: "科学",
    icon: "FlaskConical",
    color: "bg-emerald-500",
    textbook: "义务教育教科书·科学",
  },
];

export type LearningMode = "explanation" | "exercise" | "qa";

export interface Message {
  role: "user" | "assistant";
  content: string;
}
