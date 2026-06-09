import { redirect } from 'next/navigation';

// The HPI Readiness board lives in the dev-app surface; this route exists so
// the full portal's sidebar (and a memorable URL) reach the same board.
export default function DeveloperHpiRedirect() {
  redirect('/dev-app/hpi');
}
