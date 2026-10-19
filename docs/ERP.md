# MAX LED ERP

Implementação do **Documento Mestre do Projeto** (escopo funcional, arquitetura,
segurança, integrações e plano de implementação) sobre o CRM existente. O CRM
continua igual (Clientes, Negócios, Agenda, Comunicados, IA); o ERP acrescenta
os módulos operacionais, fiscais e financeiros, separados por empresa.

Stack: Next.js 16 (App Router, server actions), Prisma 7 + PostgreSQL,
NextAuth (JWT), Tailwind 4. Toda regra de negócio roda no servidor
(`src/lib/erp/*`); as telas apenas chamam essas funções.

---

## 1. Estrutura multiempresa (§2)

- Tabela `Company` com duas empresas iniciais: **A** (iluminação/tecnologia e
  Mercado Livre) e **B** (importação e exportação). Cadastro, parâmetros
  comerciais e fiscais em **Gestão → Empresas**.
- Cada produto, fornecedor, pedido, movimento de estoque, nota fiscal, título
  financeiro, compra, programação e anúncio tem `companyId`.
- `UserCompany` define quais empresas cada usuário opera (matriz em
  Empresas). O Mediador vê todas.
- A **empresa ativa** fica num cookie httpOnly, mas é revalidada contra o
  vínculo do usuário em toda leitura (`src/lib/erp/company.ts`); um cookie
  adulterado cai na primeira empresa permitida. Toda consulta do ERP filtra
  pela empresa ativa, e páginas de detalhe usam `{ id, companyId }` — um link
  de outra empresa responde 404.
- Trocar de empresa volta para a raiz do módulo e limpa o cache de navegação
  do cliente: nenhuma tela anterior reaparece com dados da outra empresa.
- **Consolidado**: Diretoria e Mediador podem ver Painel e Relatórios somando
  as empresas a que têm acesso; os registros originais nunca se misturam (os
  relatórios mostram também a quebra por empresa).
- **Transferências entre empresas** (Estoque → Transferências) registram
  origem, destino, itens, usuário e documento, com saída e entrada casadas.
- Os dados fiscais das empresas (CNPJ, IE, regime) vêm **em branco** em
  produção e precisam ser confirmados com a contabilidade antes da
  homologação.

## 2. Perfis e permissões (§3)

Matriz em `src/lib/permissions.ts`, exibida em **Config → Permissões**. Toda
página chama `requireView(módulo)` e toda server action confere permissão de
edição no servidor — esconder botão nunca é a única proteção.

| Perfil (role) | Acesso principal |
|---|---|
| Administrador (`ADMIN`) | Empresas, usuários/acesso por empresa, configurações técnicas, integrações. Não lê Financeiro/Fiscal. |
| Diretoria (`MANAGER`) | Indicadores e relatórios, inclusive consolidados; aprova pedidos, compras e pagamentos. |
| Gerente comercial (`SALES_MANAGER`) | Vendas, clientes, aprovações comerciais, metas, programação, portal. |
| Vendedor (`SELLER`) | Sua carteira, cotações/pedidos próprios, programações próprias. Sem Fiscal/Financeiro. |
| Estoque/expedição (`STOCK`) | Produtos (sem alterar preço/custo), saldos, movimentos, inventário, separação, conferência, despacho, Mercado Livre. |
| Compras/importação (`PURCHASING`) | Fornecedores, solicitações/cotações de compra, importação, custos; recebimento. |
| Financeiro (`FINANCE`) | Contas a receber/pagar, baixas, fluxo de caixa, conciliação. |
| Fiscal (`FISCAL`) | Emissão, rejeições, cancelamentos, dados fiscais de produtos. |
| Marketing (`MARKETING`) | Clientes/prospecção (consulta), relatórios comerciais. |
| Mediador (`MEDIATOR`) | Superusuário herdado do CRM. |
| Cliente (`CUSTOMER`) | Só existe na sessão do Portal; a matriz nega todos os módulos internos. |

Regras específicas:

- Vendedor não recebe Fiscal nem Financeiro.
- Preço de venda e preço mínimo: só Diretoria, Gerente comercial, Admin e
  Mediador (`canEditPrices`); custo também por Compras (`canEditCosts`).
  Custos e margens ficam ocultos para vendedor, suporte e marketing.
- Aprovação comercial: Gerente comercial, Diretoria, Mediador.
- Aprovação de contas a pagar e de compras: Diretoria e Mediador.
- Caixas de e-mail: cada usuário lê só as próprias e as compartilhadas com
  ele explicitamente; o Admin configura contas, mas não lê caixas alheias.
- Auditoria: aprovações, reprovações, alterações de preço, cancelamentos,
  ajustes de estoque, emissões, baixas, conciliações e mudanças de acesso vão
  para `ActivityLog` (com `companyId`), visível em Config → Logs.
- Senhas com bcrypt, bloqueio após 7 tentativas, MFA (TOTP) opcional,
  sessões JWT com expiração de 12h.

## 3. Fluxo integrado (§5) e regras

```
Cotação ──enviar──> [dentro dos limites] ──> Aprovado + reserva de estoque
                └─> [fora dos limites]  ──> Aguardando aprovação ──aprovar──> Aprovado + reserva
Aprovado ──> NF-e (homologação) ──autorizada──> Contas a receber (parcelas)
Aprovado ──> Separação ──> Conferência (outra pessoa) ──> Pronto ──despacho (exige NF autorizada)──> Enviado (baixa) ──> Entregue
Contas a receber ──baixa (total/parcial)──> Conciliação
Compra aprovada ──> Contas a pagar ; Recebimento ──> Entrada no estoque + custo médio
```

**Aprovação comercial** (decisão em aberto §12, padrão adotado — ajustável
por empresa): vai para aprovação o pedido com item abaixo do preço mínimo,
desconto (do item ou do pedido) acima do limite da empresa (padrão 5%) ou
total acima do teto configurado. Dentro dos limites, aprova automaticamente e
registra "aprovação automática". Aprovações manuais gravam autor e data.

**Estoque** (`src/lib/erp/stock.ts`): saldos físico, reservado e bloqueado
por produto; disponível = físico − reservado − bloqueado. Cada alteração de
saldo é um `StockMovement` com usuário, data, motivo, quantidade, documento e
saldo resultante. Decrementos são `UPDATE` condicionais no banco (não há
corrida que deixe saldo negativo).

- Política de baixa (decisão §12, padrão adotado): **reserva na aprovação,
  baixa na expedição**. Cancelamento antes do envio libera a reserva.
- **Kits/pacotes/caixas com componentes** não têm saldo próprio: vender 1 kit
  de 25 LEDs reserva e baixa 25 unidades do SKU do LED.
- **Sem dupla baixa**: cada efeito tem uma chave de idempotência única
  (`order:<id>:reserve|ship:<item>:<produto>`, `receipt:<req>:<item>`,
  `transfer:<req>:…`, `manual:<req>`). Reprocessar uma operação, um duplo
  clique ou uma notificação repetida do Mercado Livre não movimenta de novo.

**Programação de clientes**: nunca baixa estoque; gera tarefa ou cotação
(conforme a programação), uma vez por data (`CustomerScheduleRun` único).

**Fiscal** (`src/lib/erp/fiscal.ts`): no máximo uma nota ativa por pedido
(chave única no banco). Rejeitada → corrige cadastro → reenviar usa a mesma
nota. Cancelamento exige justificativa de 15+ caracteres, mercadoria não
enviada e nenhum pagamento baixado. Tributos **não** são calculados por
percentuais fixos no ERP: ficam a cargo do provedor fiscal.

> O provedor fiscal atual ainda não foi informado. Enquanto isso o ERP usa um
> **simulador de homologação**: valida os dados obrigatórios como a SEFAZ
> (CNPJ do emitente, CPF/CNPJ e endereço do destinatário, NCM dos itens) e
> devolve chave de acesso de 44 dígitos com DV módulo 11, protocolo e XML
> marcados "SEM VALOR FISCAL". Ele recusa operar em produção. Para o
> provedor real, implementar a interface `FiscalProvider` em `fiscal.ts`
> (emitir/cancelar) e configurar o certificado digital no servidor do
> provedor — o ERP nunca recebe o certificado pelo navegador.

**Financeiro** (`src/lib/erp/finance.ts`): faturamento (nota), contas a
receber (parcelas da nota), liquidação (baixas totais/parciais) e conciliação
(baixa conferida com o extrato) são etapas separadas. Cada baixa leva uma
`requestKey` única e trava o título (`SELECT … FOR UPDATE`). Contas a pagar
precisam de aprovação da Diretoria antes do pagamento. Valores sempre em
`Decimal`, arredondados por linha; parcelas somam exatamente o total.

## 4. Módulos e rotas

| Módulo | Rota | Observações |
|---|---|---|
| Painel | `/painel` | Escuro (executivo); seções conforme permissões; consolidado para Diretoria. |
| Cotações e pedidos | `/pedidos` | Itens com pesquisa por SKU, disponibilidade, descontos, parcelas, frete. |
| Produtos | `/produtos` | Catálogo técnico, fiscal, kits, fornecedores. |
| Estoque | `/estoque` | Saldos, movimentos, ajustes, inventário, transferências. |
| Expedição | `/expedicao` | Fila de separação, conferência, embalagem, despacho, ocorrências, devoluções. |
| Programação | `/programacao` | Recorrências por cliente; cron `/api/cron/schedules`. |
| Compras | `/compras` | Fornecedores, solicitações, cotações, importação, rateio de custos, recebimento. |
| Fiscal | `/fiscal` | Pendentes, rejeitadas, autorizadas, canceladas, XML, DANFE. |
| Financeiro | `/financeiro` | Receber, pagar, fluxo de caixa, conciliação. |
| Mercado Livre | `/mercado-livre` | Conexão OAuth, anúncios ↔ SKU/kit, pedidos, fila de integração, sincronização de estoque. |
| E-mails | `/emails` | Caixas individuais IMAP/SMTP, associação a clientes/pedidos. |
| Relatórios | `/relatorios` | Vendas, produtos, ML/kits, compras, fiscal, financeiro; exportação CSV. |
| Empresas | `/empresas` | Cadastro, parâmetros, acesso de usuários por empresa. |
| Portal do cliente (gestão) | `/portal-clientes` | Acessos de clientes e solicitações. |
| Portal do cliente | `/portal` | Login próprio; só os dados do próprio cliente. |

Interface: menu e painel escuros (preto/grafite/dourado discreto); telas
operacionais em tema claro (§6). Layout fluido; tabelas rolam dentro do
próprio cartão no celular.

## 5. Integrações

Todas registram eventos em `IntegrationEvent` (chave de idempotência única,
tentativas, último erro) e podem ser reprocessadas pela tela do módulo sem
duplicar pedidos, notas, títulos ou movimentos. Segredos (senhas IMAP/SMTP,
tokens) ficam cifrados com AES-256-GCM (`ERP_ENCRYPTION_KEY`) e nunca são
enviados ao navegador.

- **Mercado Livre**: cadastrar app em developers.mercadolivre.com.br,
  informar Client ID/Secret e Redirect URI
  (`https://<domínio>/api/integrations/mercadolivre/callback`) em Mercado
  Livre → Configuração, e apontar a URL de notificações para
  `https://<domínio>/api/integrations/mercadolivre/webhook` (tópico
  `orders_v2`). Pedidos pagos entram como pedidos aprovados com reserva;
  anúncio sem vínculo de SKU fica na fila com erro até ser mapeado. Há um
  simulador de pedido para homologação.
- **E-mail**: cada caixa precisa de host/porta/TLS de IMAP e SMTP e usuário/
  senha do provedor do domínio (decisão §12). Sincronização manual ou pelo
  cron `/api/cron/emails`. Anexos de envio limitados a 4MB no total (limite
  de requisição da Vercel).
- **Fiscal**: ver seção 3.

Crons (Vercel, `vercel.json`), protegidos por `CRON_SECRET`:
`/api/cron/advance-deals` (CRM), `/api/cron/schedules`,
`/api/cron/mercadolivre`, `/api/cron/emails`.

## 6. Ambientes, backup e recuperação (§7)

- **Ambientes separados**: um banco e um projeto (ou Environment) por
  ambiente — desenvolvimento (local), homologação (preview da Vercel com
  banco próprio) e produção. Nunca reaproveitar `DATABASE_URL` entre eles.
  Empresas em homologação ficam com `fiscalEnvironment = HOMOLOGACAO`.
- **Migrações**: `npm run build` executa `prisma migrate deploy`. A migração
  `erp_foundation` cria as tabelas do ERP, as empresas A e B e vincula os
  usuários existentes (todos à A; Diretoria/Admin também à B).
- **Backup**: usar o backup gerenciado do Postgres (Neon: histórico/PITR;
  Supabase: backups diários) e, adicionalmente, dump lógico agendado:
  `pg_dump --format=custom --no-owner "$DATABASE_URL" > maxled-$(date +%F).dump`
  guardado fora do provedor do banco.
- **Restauração testada** (fazer antes da produção e periodicamente):
  1. criar um banco vazio de teste;
  2. `pg_restore --no-owner --dbname "$DATABASE_URL_TESTE" maxled-AAAA-MM-DD.dump`;
  3. `DATABASE_URL=$DATABASE_URL_TESTE npx prisma migrate status` (deve
     estar em dia);
  4. subir a aplicação apontando para esse banco e conferir login, um
     pedido, um título e o saldo de um produto.
- O export completo existente (`/api/full-export`) continua disponível para
  planilha, mas não substitui o backup do banco.

## 7. Testes

- `npm run erp:selftest` — teste de ponta a ponta das regras do núcleo contra
  um banco de desenvolvimento semeado (`npx prisma db seed`): totais com vários
  itens, kit baixando componentes, reprocessamento sem duplicidade, aprovação
  com autor/data, despacho exigindo NF, NF em homologação gerando parcelas uma
  vez, baixa idempotente, isolamento entre empresas e carteiras. Recusa rodar
  contra produção.
- Usuários de teste do seed (senha `maxled123`): `gerente@`, `diretoria@`,
  `estoque@`, `compras@`, `financeiro@`, `fiscal@`, `marketing@`
  (`@maxledtec.com.br`), além do mediador e do vendedor do CRM.

## 8. Decisões em aberto (§12) — padrão adotado até a definição

| Tema | Padrão implementado | Onde ajustar |
|---|---|---|
| Dois valores mínimos do produto | Preço mínimo de venda (abaixo → aprovação) e estoque mínimo (alerta de reposição) | Cadastro do produto |
| Aprovação comercial | Só fora dos limites: preço mínimo, desconto > limite, total > teto | Empresas → parâmetros comerciais |
| Baixa de estoque | Reserva na aprovação, baixa na expedição | `orders.ts` |
| Acesso às caixas | Caixa própria + compartilhamento explícito | E-mails → contas |
| Hospedagem | Vercel + Postgres gerenciado (como o CRM atual) | — |
| E-mail | Configurável por caixa (host, porta, TLS, usuário) | E-mails → contas |
| Integrações existentes | Simulador fiscal em homologação; ML pronto para OAuth | Fiscal / Mercado Livre |

## 9. Pendências para produção

1. Confirmar com a contabilidade CNPJ, IE, regime tributário e regras de
   tributação de cada empresa; definir CFOP/CST junto ao provedor fiscal.
2. Informar o provedor fiscal atual e implementar o adaptador real
   (`FiscalProvider`), com certificado digital no provedor; homologar.
3. Autorizar a conta do Mercado Livre (OAuth) e mapear os anúncios.
4. Levantar os dados técnicos do e-mail do domínio (sem compartilhar senhas
   em documentos) e cadastrar as caixas.
5. Testar em celular, tablet, notebook e computador e nos navegadores usados
   pela equipe.
6. Executar e registrar o teste de restauração de backup (seção 6).
