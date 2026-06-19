import type { ChapterContent } from "@/types/chapterContent";
import { BASIC_CONTENT } from "./chapterContent.basic";
import { ADVANCED_CONTENT } from "./chapterContent.advanced";

/** Rich learning content for every chapter, keyed by chapter id. */
export const CHAPTER_CONTENT: Record<string, ChapterContent> = {
  ...BASIC_CONTENT,
  ...ADVANCED_CONTENT,
};

export const getChapterContent = (id: string): ChapterContent | undefined =>
  CHAPTER_CONTENT[id];
