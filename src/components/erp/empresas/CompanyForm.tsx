"use client";

import { useState } from "react";
import { ActionForm, type ClientActionResult } from "@/components/erp/ActionForm";
import { Card, Field, btnPrimary, inputCls } from "@/components/erp/ui";
import { UFS } from "@/components/erp/empresas/ufs";

export type CompanyFormValues = {
  id?: string;
  code: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  taxRegime: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  active: boolean;
  maxDiscountPct: string;
  approvalAmountLimit: string | null;
  fiscalEnvironment: "HOMOLOGACAO" | "PRODUCAO";
  fiscalProvider: string;
  fiscalSeries: number;
  nextFiscalNumber: number;
};

export function CompanyForm({
  company,
  action,
  editable,
  isMediator,
}: {
  company: CompanyFormValues;
  action: (fd: FormData) => Promise<ClientActionResult>;
  editable: boolean;
  isMediator: boolean;
}) {
  const [env, setEnv] = useState(company.fiscalEnvironment);
  const [provider, setProvider] = useState(company.fiscalProvider);
  const [nextNumber, setNextNumber] = useState(String(company.nextFiscalNumber));
  const numberChanged = nextNumber !== String(company.nextFiscalNumber);

  const t = (name: keyof CompanyFormValues, label: string, opts: { className?: string; placeholder?: string; type?: string } = {}) => (
    <Field label={label} className={opts.className}>
      <input
        name={name}
        type={opts.type ?? "text"}
        defaultValue={(company[name] as string | null) ?? ""}
        placeholder={opts.placeholder}
        disabled={!editable}
        className={inputCls}
      />
    </Field>
  );

  return (
    <ActionForm action={action} className="flex flex-col gap-4" successMessage="Salvo.">
      {company.id && <input type="hidden" name="id" value={company.id} />}

      <Card title="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t("code", "Código (ex.: A, B)")}
          {t("name", "Razão social", { className: "lg:col-span-2" })}
          {t("tradeName", "Nome fantasia")}
          {t("cnpj", "CNPJ", { placeholder: "00.000.000/0000-00" })}
          {t("stateRegistration", "Inscrição estadual")}
          {t("taxRegime", "Regime tributário", { placeholder: "A confirmar com a contabilidade" })}
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input type="checkbox" name="active" defaultChecked={company.active} disabled={!editable} /> Empresa ativa
          </label>
          {t("phone", "Telefone")}
          {t("email", "E-mail", { type: "email" })}
          <Field label="Descrição da operação" className="sm:col-span-2">
            <input name="description" defaultValue={company.description ?? ""} disabled={!editable} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card title="Endereço">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {t("street", "Logradouro", { className: "lg:col-span-3" })}
          {t("number", "Número")}
          {t("district", "Bairro", { className: "lg:col-span-2" })}
          {t("city", "Cidade", { className: "lg:col-span-2" })}
          <Field label="UF">
            <select name="state" defaultValue={company.state ?? ""} disabled={!editable} className={inputCls}>
              <option value="">-</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Field>
          {t("postalCode", "CEP")}
        </div>
      </Card>

      <Card title="Parâmetros comerciais">
        <p className="mb-3 text-xs text-ink-muted">
          Pedidos com desconto acima do limite, item abaixo do preço mínimo ou total acima do teto vão para aprovação da gerência.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Desconto máximo sem aprovação (%)">
            <input name="maxDiscountPct" type="number" step="0.01" min="0" max="100" defaultValue={company.maxDiscountPct} disabled={!editable} className={inputCls} />
          </Field>
          <Field label="Teto de aprovação automática (R$)">
            <input
              name="approvalAmountLimit"
              type="number"
              step="0.01"
              min="0"
              placeholder="Sem teto"
              defaultValue={company.approvalAmountLimit ?? ""}
              disabled={!editable}
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      <Card title="Parâmetros fiscais">
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Dados fiscais (CNPJ, IE, regime tributário, série e numeração) devem ser confirmados com a contabilidade antes da homologação.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ambiente">
            <select
              name="fiscalEnvironment"
              value={env}
              disabled={!editable}
              onChange={(e) => {
                const v = e.target.value as "HOMOLOGACAO" | "PRODUCAO";
                if (v === "PRODUCAO") {
                  if (provider === "simulador") {
                    window.alert("O simulador só opera em homologação. Integre o provedor fiscal real antes de mudar para produção.");
                    return;
                  }
                  if (!window.confirm("Em produção as notas têm validade fiscal. Confirma a mudança de ambiente?")) return;
                }
                setEnv(v);
              }}
              className={inputCls}
            >
              <option value="HOMOLOGACAO">Homologação (testes)</option>
              <option value="PRODUCAO">Produção</option>
            </select>
          </Field>
          <Field label="Provedor fiscal">
            <input
              name="fiscalProvider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={!editable}
              className={inputCls}
            />
          </Field>
          <Field label="Série">
            <input name="fiscalSeries" type="number" min="0" max="999" defaultValue={company.fiscalSeries} disabled={!editable} className={inputCls} />
          </Field>
          <Field label="Próximo número de NF-e">
            <input
              name="nextFiscalNumber"
              type="number"
              min="1"
              value={nextNumber}
              onChange={(e) => setNextNumber(e.target.value)}
              disabled={!editable || !isMediator}
              title={isMediator ? undefined : "Somente o Mediador ajusta a numeração"}
              className={inputCls}
            />
          </Field>
        </div>
        {isMediator && editable && numberChanged && (
          <label className="mt-3 flex items-start gap-2 text-xs text-critical">
            <input type="checkbox" name="confirmNextFiscalNumber" required />
            Confirmo a alteração da numeração. Números pulados precisam ser inutilizados junto à SEFAZ.
          </label>
        )}
      </Card>

      {editable && (
        <div>
          <button type="submit" className={btnPrimary}>
            {company.id ? "Salvar alterações" : "Criar empresa"}
          </button>
        </div>
      )}
    </ActionForm>
  );
}
