import "server-only";
import ExcelJS from "exceljs";
import type { FullExportData } from "@/lib/full-export";

const CLIENTES_HEADERS = [
  "Proprietário", "Tipo de Pessoa", "Nome", "Sobrenome", "Empresa", "CNPJ", "E-mail",
  "Telefone", "Celular", "Telefone Residencial", "Telefone do Assistente",
  "Origem do Lead", "Fornecedor", "Perfil", "Cargo", "Departamento",
  "Rua", "Número", "Cidade", "Estado", "CEP",
  "Inscrição Estadual", "E-mail Financeiro", "E-mail NF-e", "Endereço de Entrega",
  "Aniversário", "Potencial Comercial", "Status CRM", "Último Contato", "Próximo Contato",
  "Observações", "Criado em",
];

const PROSPECCOES_HEADERS = [
  "Proprietário", "Nome do Prospect", "Cliente/Empresa", "Telefone", "E-mail",
  "Temperatura", "Perfil", "Etapa Atual", "Data de Contato", "Último Toque",
  "Convertido em Cliente?", "Convertido em", "Observações", "Criado em",
];

const NEGOCIACOES_HEADERS = [
  "Proprietário", "Cliente", "Nome do Negócio", "Valor", "Etapa",
  "Status de Pagamento", "Forma de Pagamento", "A Caminho Desde", "Prazo A Caminho",
  "Criado em", "Atualizado em",
];

/** Builds the 3-sheet workbook (Clientes / Prospecções / Negociações) that
 * backs the automatic OneDrive/download sync — same field set as
 * getFullExportData, just rendered as a real .xlsx instead of JSON. Sheet
 * names and column order are fixed so a daily regeneration always lands in
 * the same shape, whatever tool consumes it next (OneDrive upload, direct
 * download, etc). */
export function buildFullExportWorkbook(data: FullExportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const clientesSheet = wb.addWorksheet("Clientes");
  clientesSheet.addRow(CLIENTES_HEADERS);
  data.clientes.forEach((c) =>
    clientesSheet.addRow([
      c.proprietario, c.tipoPessoa, c.nome, c.sobrenome, c.empresa, c.cnpj, c.email,
      c.telefone, c.celular, c.telefoneResidencial, c.telefoneAssistente,
      c.origemLead, c.fornecedor, c.perfil, c.cargo, c.departamento,
      c.rua, c.numero, c.cidade, c.estado, c.cep,
      c.inscricaoEstadual, c.emailFinanceiro, c.emailNfe, c.enderecoEntrega,
      c.aniversario, c.potencialComercial, c.statusCrm, c.ultimoContato, c.proximoContato,
      c.observacoes, c.criadoEm,
    ]),
  );

  const prospeccoesSheet = wb.addWorksheet("Prospecções");
  prospeccoesSheet.addRow(PROSPECCOES_HEADERS);
  data.prospeccoes.forEach((p) =>
    prospeccoesSheet.addRow([
      p.proprietario, p.nomeProspect, p.clienteEmpresa, p.telefone, p.email,
      p.temperatura, p.perfil, p.etapaAtual, p.dataContato, p.ultimoToque,
      p.convertidoEmCliente, p.convertidoEm, p.observacoes, p.criadoEm,
    ]),
  );

  const negociacoesSheet = wb.addWorksheet("Negociações");
  negociacoesSheet.addRow(NEGOCIACOES_HEADERS);
  data.negociacoes.forEach((d) =>
    negociacoesSheet.addRow([
      d.proprietario, d.cliente, d.nomeNegocio, d.valor, d.etapa,
      d.statusPagamento, d.formaPagamento, d.aCaminhoDesde, d.prazoACaminho,
      d.criadoEm, d.atualizadoEm,
    ]),
  );

  for (const sheet of [clientesSheet, prospeccoesSheet, negociacoesSheet]) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 18;
    });
  }

  return wb;
}
