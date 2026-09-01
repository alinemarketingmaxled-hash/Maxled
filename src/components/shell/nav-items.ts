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
  type IconProps,
} from "@/components/shared/Icons";

export const NAV_ITEMS: { href: string; label: string; module: Module; icon: ComponentType<IconProps> }[] = [
  { href: "/", label: "Início", module: "analitica", icon: HomeIcon },
  { href: "/vendas", label: "Clientes", module: "vendas", icon: PhoneIcon },
  { href: "/negocios", label: "Negócios", module: "negocios", icon: BriefcaseIcon },
  { href: "/agenda", label: "Agenda", module: "agenda", icon: ClockIcon },
  { href: "/social", label: "Comunicados", module: "social", icon: StarIcon },
  { href: "/ia", label: "IA", module: "ia", icon: SparkleIcon },
  { href: "/perfil", label: "Perfil", module: "perfil", icon: UserIcon },
  { href: "/config", label: "Config", module: "config", icon: GearIcon },
];
