import type { ComponentType } from "react";
import type { Module } from "@/lib/permissions";
import {
  HomeIcon,
  PhoneIcon,
  BriefcaseIcon,
  ClockIcon,
  StarIcon,
  SparkleIcon,
  UserIcon,
  GearIcon,
  GridIcon,
  BoxIcon,
  LayersIcon,
  CartIcon,
  TruckIcon,
  ShoppingBagIcon,
  FileTextIcon,
  WalletIcon,
  RepeatIcon,
  StoreIcon,
  MailIcon,
  BarChartIcon,
  BuildingIcon,
  KeyIcon,
  type IconProps,
} from "@/components/shared/Icons";

export type NavSection = "CRM" | "ERP" | "Gestão";

export const NAV_ITEMS: {
  href: string;
  label: string;
  module: Module;
  icon: ComponentType<IconProps>;
  section: NavSection;
}[] = [
  { href: "/", label: "Início", module: "analitica", icon: HomeIcon, section: "CRM" },
  { href: "/vendas", label: "Clientes", module: "vendas", icon: PhoneIcon, section: "CRM" },
  { href: "/negocios", label: "Negócios", module: "negocios", icon: BriefcaseIcon, section: "CRM" },
  { href: "/agenda", label: "Agenda", module: "agenda", icon: ClockIcon, section: "CRM" },
  { href: "/social", label: "Comunicados", module: "social", icon: StarIcon, section: "CRM" },
  { href: "/ia", label: "IA", module: "ia", icon: SparkleIcon, section: "CRM" },

  { href: "/painel", label: "Painel", module: "painel", icon: GridIcon, section: "ERP" },
  { href: "/pedidos", label: "Cotações e pedidos", module: "pedidos", icon: CartIcon, section: "ERP" },
  { href: "/produtos", label: "Produtos", module: "produtos", icon: BoxIcon, section: "ERP" },
  { href: "/estoque", label: "Estoque", module: "estoque", icon: LayersIcon, section: "ERP" },
  { href: "/expedicao", label: "Expedição", module: "expedicao", icon: TruckIcon, section: "ERP" },
  { href: "/programacao", label: "Programação", module: "programacao", icon: RepeatIcon, section: "ERP" },
  { href: "/compras", label: "Compras", module: "compras", icon: ShoppingBagIcon, section: "ERP" },
  { href: "/fiscal", label: "Fiscal", module: "fiscal", icon: FileTextIcon, section: "ERP" },
  { href: "/financeiro", label: "Financeiro", module: "financeiro", icon: WalletIcon, section: "ERP" },
  { href: "/mercado-livre", label: "Mercado Livre", module: "mercadolivre", icon: StoreIcon, section: "ERP" },
  { href: "/emails", label: "E-mails", module: "emails", icon: MailIcon, section: "ERP" },
  { href: "/relatorios", label: "Relatórios", module: "relatorios", icon: BarChartIcon, section: "ERP" },

  { href: "/empresas", label: "Empresas", module: "empresas", icon: BuildingIcon, section: "Gestão" },
  { href: "/portal-clientes", label: "Portal do cliente", module: "portalAdmin", icon: KeyIcon, section: "Gestão" },
  { href: "/perfil", label: "Perfil", module: "perfil", icon: UserIcon, section: "Gestão" },
  { href: "/config", label: "Config", module: "config", icon: GearIcon, section: "Gestão" },
];
