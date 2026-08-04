# Segurança do Maxled CRM

Este documento avalia, item a item, uma lista de práticas de segurança em
nuvem (a mesma usada por empresas para avaliar um portfólio de vários
aplicativos SaaS) e explica o que se aplica ao Maxled CRM — um sistema só,
com poucos usuários — e o que já existe, o que foi implementado agora, e o
que não se aplica a este cenário.

Legenda: ✅ já existia · 🆕 implementado nesta revisão · 📋 é prática/processo,
não uma funcionalidade · ➖ não se aplica ao Maxled

## Gestão de identidade e acesso (IAM)

- **Autenticação multifator (MFA)** — 🆕 Implementada. Em **Meu perfil**,
  qualquer usuário pode ativar a verificação em duas etapas usando um app
  autenticador (Google Authenticator, Authy, Microsoft Authenticator, etc.).
  Uma vez ativada, o login passa a pedir a senha **e** um código de 6
  dígitos que muda a cada 30 segundos. Se alguém perder o acesso ao app
  autenticador, o Mediador consegue desativar a verificação daquela conta em
  **Perfil → [nome do vendedor]**, do mesmo jeito que já desbloqueia um
  acesso travado por senha errada repetida.
- **Single Sign-On (SSO)** — ➖ Não se aplica. SSO existe pra reduzir o
  número de senhas quando a pessoa usa vários sistemas diferentes da mesma
  empresa. O Maxled é o único sistema — não há outra senha pra unificar.
- **Revisar permissões regularmente** — ✅ Já existe a base técnica: cada
  papel (Vendedor, Mediador, etc.) só enxerga e edita o que está definido na
  tabela de permissões, visível em **Config**. A "revisão regular" em si é
  um processo, não uma funcionalidade — vale um lembrete periódico (ex.:
  a cada trimestre) pra conferir se os papéis de cada pessoa ainda fazem
  sentido.

## Proteção de dados

- **Criptografia em trânsito (TLS)** — ✅ Já existe. O Vercel (onde o app
  roda) força HTTPS em todas as conexões automaticamente.
- **Criptografia em repouso** — ✅ Já existe. O banco de dados (Neon,
  Postgres gerenciado) criptografa os dados armazenados por padrão.
- **Backup contínuo e plano de recuperação de desastres** — ✅ Já existe. O
  Neon mantém backups automáticos com recuperação por ponto no tempo (dá
  pra restaurar o banco pra um horário específico dos últimos dias). Não é
  algo que o Maxled precisa implementar — é uma característica do provedor
  do banco.
- **Monitoramento de compartilhamento de arquivos e dados** — ➖ Não se
  aplica no formato genérico do item (controlar links de Google
  Drive/Dropbox compartilhados por engano). Dentro do Maxled, imagens de
  Comunicados e anexos de negócios ficam associados a um registro
  específico, sem link público compartilhável.

## Governança e conformidade

- **LGPD** — 📋 Relevante e vale revisão. O Maxled armazena dados pessoais
  de clientes (nome, telefone, e-mail, CNPJ). Já existe controle de acesso
  por papel e log de atividades (ver abaixo), que ajudam a atender
  princípios da LGPD como necessidade e rastreabilidade — mas uma política
  de privacidade formal e um processo pra atender pedidos de exclusão de
  dados de clientes é decisão de negócio, não algo a implementar sozinho no
  código.
- **GDPR / HIPAA** — ➖ Não se aplicam. GDPR é a lei europeia equivalente à
  LGPD; HIPAA é uma lei americana específica pra dados de saúde. O Maxled
  opera no Brasil, com dados comerciais B2B — nenhuma das duas se aplica.
- **Certificações de fornecedores (SOC 2, ISO 27001)** — 📋 Isso é avaliar
  os fornecedores usados (Vercel e Neon), não o Maxled em si. Os dois têm
  certificação SOC 2 publicada — vale conferir a página de segurança de
  cada um se precisar apresentar isso formalmente pra algum cliente.
- **Políticas de app sancionado/tolerado/não sancionado** — ➖ Esse item é
  pra empresas com um portfólio de vários aplicativos SaaS que o time usa
  por conta própria (shadow IT). O Maxled é o único sistema interno da
  operação.

## Monitoramento e visibilidade

- **CASB (Cloud Access Security Broker)** — ➖ Não se aplica. É uma
  ferramenta pra uma empresa controlar o acesso a vários aplicativos SaaS ao
  mesmo tempo — não algo que um único CRM implementa dentro dele mesmo.
- **Detectar e bloquear aplicativos não autorizados** — ➖ Mesma lógica do
  item de CASB — é sobre o conjunto de ferramentas que a empresa usa, não
  sobre o Maxled.
- **Auditar logs de acesso e atividades suspeitas** — ✅ Já existe. Em
  **Config**, fica visível o registro de atividades (quem criou, editou ou
  excluiu clientes, negócios, prospecções etc.), com filtro por vendedor e
  por tipo de ação. Vendedores veem só as próprias atividades; o Mediador
  vê tudo.

## Resumo do que foi implementado nesta revisão

1. Verificação em duas etapas (MFA) por app autenticador, com opção de
   desativação pelo Mediador em caso de perda de acesso.
2. Filtros por vendedor e por tipo de ação no registro de atividades
   (Config), pra tornar a auditoria de fato utilizável no dia a dia.

O restante já estava coberto pela infraestrutura (Vercel/Neon) ou não se
aplica ao tamanho e formato atual da operação.
