import { redirect } from 'next/navigation';

interface PageProps {
  params: { unitId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function UnitsRedirectPage({ params, searchParams }: PageProps) {
  const queryString = Object.entries(searchParams)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
    .join('&');

  const destination = `/homes/${params.unitId}${queryString ? `?${queryString}` : ''}`;
  redirect(destination);
}
