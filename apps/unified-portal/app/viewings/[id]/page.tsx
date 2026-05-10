import { redirect } from 'next/navigation';

export default function ViewingByIdRedirect({ params }: { params: { id: string } }) {
  redirect(`/agent/viewings?focus=${encodeURIComponent(params.id)}`);
}
