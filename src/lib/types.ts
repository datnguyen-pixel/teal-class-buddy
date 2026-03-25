export type UserRole = 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  createdAt: string;
  submissions?: Submission[];
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileUrl?: string;
  submittedAt: string;
  grade?: number;
  feedback?: string;
}

export interface Lesson {
  id: number;
  title: string;
  content?: string;
  googleDocsLink?: string;
  pdfUrl?: string;
  isEdited: boolean;
}
