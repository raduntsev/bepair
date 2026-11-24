import type { Theory } from '../courses';
import { M1 } from './m1';
import { M2 } from './m2';
import { M3 } from './m3';
import { M4 } from './m4';
import { M5 } from './m5';
import { M6 } from './m6';
import { M7 } from './m7';

/*
  Theory for «Кто я и чего хочу?», one entry per lesson id, a file per module.
  Written in the voice of a family psychologist — warm, plain, with stories from
  a couple's life, a quiz and something to try in every lesson. The ideas are
  retold from the course's own lesson notes; quotes are short and attributed;
  every link was opened and answered when it was added.
*/
export const WHO_AM_I_THEORY: Record<string, Theory> = { ...M1, ...M2, ...M3, ...M4, ...M5, ...M6, ...M7 };
