import { Assignment, Lesson, User } from './types';

export const mockTeacher: User = {
  id: 't1',
  name: 'Ms. Sarah Johnson',
  email: 'sarah@school.com',
  role: 'teacher',
  avatar: '',
};

export const mockStudent: User = {
  id: 's1',
  name: 'Alex Chen',
  email: 'alex@student.com',
  role: 'student',
  avatar: '',
};

export const mockAssignments: Assignment[] = [
  {
    id: 'a1',
    title: 'Essay: My Favorite Book',
    description: 'Write a 500-word essay about your favorite book. Include a summary, your personal opinion, and why you recommend it.',
    dueDate: '2026-04-05',
    createdAt: '2026-03-20',
    submissions: [
      {
        id: 'sub1',
        assignmentId: 'a1',
        studentId: 's1',
        studentName: 'Alex Chen',
        content: 'My favorite book is...',
        submittedAt: '2026-03-25',
        grade: 92,
        feedback: 'Excellent analysis! Great vocabulary usage.',
      },
    ],
  },
  {
    id: 'a2',
    title: 'Grammar Worksheet: Tenses',
    description: 'Complete the worksheet on past, present, and future tenses. Pay attention to irregular verbs.',
    dueDate: '2026-04-02',
    createdAt: '2026-03-22',
    submissions: [],
  },
  {
    id: 'a3',
    title: 'Reading Comprehension: Chapter 5',
    description: 'Read Chapter 5 of "To Kill a Mockingbird" and answer the comprehension questions.',
    dueDate: '2026-04-10',
    createdAt: '2026-03-24',
    submissions: [],
  },
];

export const generateLessons = (): Lesson[] => {
  const editedLessons = [
    { id: 1, title: 'Introduction to English', content: 'Welcome to the English class! Today we cover basics of grammar and sentence structure.', isEdited: true },
    { id: 2, title: 'Parts of Speech', content: 'Nouns, verbs, adjectives, adverbs — the building blocks of English.', googleDocsLink: 'https://docs.google.com/document/d/example1', isEdited: true },
    { id: 3, title: 'Sentence Structure', content: 'Learn about subjects, predicates, and how to form complete sentences.', isEdited: true },
    { id: 4, title: 'Tenses Overview', content: 'Past, present, future — understanding when things happen.', googleDocsLink: 'https://docs.google.com/document/d/example2', isEdited: true },
    { id: 5, title: 'Reading Comprehension Basics', content: 'Strategies for understanding and analyzing written text.', isEdited: true },
  ];

  const lessons: Lesson[] = [];
  for (let i = 1; i <= 100; i++) {
    const edited = editedLessons.find(l => l.id === i);
    if (edited) {
      lessons.push(edited);
    } else {
      lessons.push({
        id: i,
        title: `Lesson ${i}`,
        isEdited: false,
      });
    }
  }
  return lessons;
};
