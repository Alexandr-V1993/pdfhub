import { notFound } from 'next/navigation';
import { TOOLS, getTool } from '@/lib/tools';
import ToolRunner from '@/components/ToolRunner';
import JsonLd from '@/components/JsonLd';
import { toolMeta, toolLd } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }) {
  const { tool } = await params;
  const t = getTool(tool);
  return t ? toolMeta(t) : {};
}

export default async function ToolPage({ params }) {
  const { tool } = await params;
  const t = getTool(tool);
  if (!t) notFound();
  return (<><JsonLd data={toolLd(t, `/${t.slug}`)} /><ToolRunner slug={t.slug} /></>);
}
