import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UnitsRedirectPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const queryString = Object.entries(searchParams)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
    .join('&');

  const destination = `/homes/${params.unitId}${queryString ? `?${queryString}` : ''}`;
  redirect(destination);
}
