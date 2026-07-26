import { Outlet } from 'react-router-dom';

export default function BaseLayout() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            RetentionAI
          </p>
        </header>
        <section className="flex flex-1 items-center py-12">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
