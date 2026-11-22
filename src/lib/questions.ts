import { tr } from '@/lib/i18n';

/*
  Eight questions to set the tone. Answers change nothing in the interface,
  so every one can be skipped and none is required. Question 2 is a date: it
  becomes the start of «дней вместе».
*/
export const QUESTIONS = [
  tr('Как вы познакомились?', 'How did you meet?'),
  tr('Какой день вы считаете началом?', 'Which day do you count as the beginning?'),
  tr('Что вас чаще всего успокаивает друг в друге?', 'What in each other calms you most often?'),
  tr('О чём вам сложнее всего говорить вслух?', 'What is hardest for you to say out loud?'),
  tr('Что вы обычно делаете, когда у партнёра тяжёлый день?', 'What do you usually do when your partner has a hard day?'),
  tr('Какая мелочь делает ваш день лучше?', 'What small thing makes your day better?'),
  tr('Чего вам не хватает в обычной неделе?', 'What is missing from an ordinary week?'),
  tr('Что вы хотели бы говорить друг другу чаще?', 'What would you like to say to each other more often?'),
];

export const DATE_QUESTION = 2;
