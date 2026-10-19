/** Telas operacionais do ERP em tema claro (§6), dentro do shell escuro. */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <div className="ops-light -m-3.5 min-h-full p-3.5 sm:-m-6 sm:p-6">{children}</div>;
}
