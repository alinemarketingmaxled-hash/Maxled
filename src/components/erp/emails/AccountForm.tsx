import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Field, btnPrimary, inputCls } from "@/components/erp/ui";

export type AccountFormValues = {
  id: string;
  ownerId: string;
  emailAddress: string;
  displayName: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  active: boolean;
};

/** Cadastro/edição de caixa. A senha é só de escrita: nunca volta ao
 * navegador; em branco na edição mantém a atual. */
export function AccountForm({
  action,
  account,
  owners,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  account?: AccountFormValues;
  /** Só para admin: escolher o dono da caixa. */
  owners?: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={action} resetOnSuccess={!account} className="flex flex-col gap-3">
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {owners && (
          <Field label="Dono da caixa">
            <select name="ownerId" defaultValue={account?.ownerId ?? ""} className={inputCls}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="E-mail">
          <input name="emailAddress" type="email" required defaultValue={account?.emailAddress} className={inputCls} />
        </Field>
        <Field label="Nome de exibição">
          <input name="displayName" defaultValue={account?.displayName ?? ""} className={inputCls} />
        </Field>
        <Field label="Usuário de autenticação">
          <input name="username" required defaultValue={account?.username} autoComplete="off" className={inputCls} />
        </Field>
        <Field label={account ? "Senha (em branco mantém a atual)" : "Senha"}>
          <input name="password" type="password" required={!account} autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Servidor IMAP">
          <input name="imapHost" required defaultValue={account?.imapHost} placeholder="imap.seudominio.com.br" className={inputCls} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="Porta IMAP">
            <input name="imapPort" type="number" defaultValue={account?.imapPort ?? 993} className={inputCls} />
          </Field>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-muted">
            <input type="checkbox" name="imapSecure" defaultChecked={account?.imapSecure ?? true} /> TLS
          </label>
        </div>
        <Field label="Servidor SMTP">
          <input name="smtpHost" required defaultValue={account?.smtpHost} placeholder="smtp.seudominio.com.br" className={inputCls} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="Porta SMTP">
            <input name="smtpPort" type="number" defaultValue={account?.smtpPort ?? 465} className={inputCls} />
          </Field>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-muted">
            <input type="checkbox" name="smtpSecure" defaultChecked={account?.smtpSecure ?? true} /> TLS direto
          </label>
        </div>
        <label className="flex items-center gap-1.5 self-end pb-2 text-xs text-ink-muted">
          <input type="checkbox" name="active" defaultChecked={account?.active ?? true} /> Caixa ativa
        </label>
      </div>
      <p className="text-[11px] text-ink-faint">
        TLS marcado: conexão segura direta (IMAP 993, SMTP 465). Desmarcado: STARTTLS obrigatório (IMAP 143, SMTP 587).
      </p>
      <div>
        <button className={btnPrimary}>{account ? "Salvar alterações" : "Cadastrar caixa"}</button>
      </div>
    </ActionForm>
  );
}
