import { notFound } from 'next/navigation';
import { ownConversions, getConversion } from '@/lib/conversions';
import ConvertRunner from '@/components/ConvertRunner';
import JsonLd from '@/components/JsonLd';
import { convMeta, toolLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() { return ownConversions().map((c) => ({ id: c.id })); }

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = getConversion(id);
  return c ? convMeta(c) : {};
}

export default async function Page({ params }) {
  const { id } = await params;
  const c = getConversion(id);
  if (!c || c.href) notFound();
  return (<><JsonLd data={toolLd({ title: `Конвертер ${c.from} в ${c.to}`, desc: `Конвертация ${c.from} в ${c.to} онлайн.` }, `/convert/${id}`)} /><ConvertRunner id={id} /></>);
}
